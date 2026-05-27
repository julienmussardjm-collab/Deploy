import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, Pause, Play, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/client/lib/utils";

type RecordingState = "idle" | "recording" | "paused" | "stopped" | "error";

type MicError =
  | "permission-denied"
  | "no-microphone"
  | "https-required"
  | "browser-incompatible"
  | "unknown";

interface AudioRecorderProps {
  onAudioReady: (blob: Blob, duration: number) => void;
  onError?: (error: string) => void;
  maxSizeMB?: number;
}

const MAX_FILE_SIZE_MB = 16;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getMicErrorMessage(err: MicError): { title: string; description: string } {
  switch (err) {
    case "permission-denied":
      return {
        title: "Microphone permission denied",
        description:
          "Please allow microphone access in your browser settings and try again.",
      };
    case "no-microphone":
      return {
        title: "No microphone detected",
        description:
          "Please connect a microphone to your device and try again.",
      };
    case "https-required":
      return {
        title: "HTTPS required",
        description:
          "Microphone access requires a secure connection (HTTPS). Please use HTTPS or localhost.",
      };
    case "browser-incompatible":
      return {
        title: "Browser not supported",
        description:
          "Your browser doesn't support audio recording. Please use Chrome, Firefox, or Edge.",
      };
    default:
      return {
        title: "Recording error",
        description: "An unexpected error occurred. Please try again.",
      };
  }
}

export default function AudioRecorder({
  onAudioReady,
  onError,
  maxSizeMB = MAX_FILE_SIZE_MB,
}: AudioRecorderProps) {
  const [state, setStateValue] = useState<RecordingState>("idle");
  const [micError, setMicError] = useState<MicError | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [estimatedSize, setEstimatedSize] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const durationRef = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopEverything() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
  }

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    const level = Math.min(100, Math.round((avg / 128) * 100));
    setAudioLevel(level);
    animFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  async function startRecording() {
    setMicError(null);
    setRecordedBlob(null);
    setDuration(0);
    durationRef.current = 0;
    setEstimatedSize(0);
    chunksRef.current = [];

    // Check browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isHttp =
        typeof window !== "undefined" &&
        window.location.protocol === "http:" &&
        window.location.hostname !== "localhost";
      if (isHttp) {
        setMicError("https-required");
      } else {
        setMicError("browser-incompatible");
      }
      setStateValue("error");
      return;
    }

    if (typeof MediaRecorder === "undefined") {
      setMicError("browser-incompatible");
      setStateValue("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Set up audio analyser
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Determine best supported MIME type for recording.
      // audio/mp4 is a *container* format; browsers don't support recording to it.
      // The correct cross-browser fallback chain is webm → ogg → wav.
      const CANDIDATE_TYPES = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/wav",
      ];
      const mimeType =
        CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ??
        "";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          // Estimate size
          const totalSize = chunksRef.current.reduce(
            (acc, c) => acc + c.size,
            0
          );
          setEstimatedSize(totalSize);

          // Auto-stop if over size limit
          if (totalSize > maxSizeMB * 1024 * 1024) {
            stopRecording();
            onError?.(`Recording exceeded ${maxSizeMB}MB limit. Recording stopped.`);
          }
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setStateValue("stopped");
        setAudioLevel(0);
      };

      mediaRecorder.start(1000); // collect chunks every 1s
      setStateValue("recording");

      // Start duration timer
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => d + 1);
      }, 1000);

      // Start audio level animation
      updateAudioLevel();
    } catch (err) {
      let errorType: MicError = "unknown";
      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          errorType = "permission-denied";
        } else if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          errorType = "no-microphone";
        } else if (err.name === "NotSupportedError") {
          errorType = "browser-incompatible";
        }
      }
      setMicError(errorType);
      setStateValue("error");
      onError?.(getMicErrorMessage(errorType).description);
    }
  }

  function pauseRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      setStateValue("paused");
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setAudioLevel(0);
    }
  }

  function resumeRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      setStateValue("recording");
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => d + 1);
      }, 1000);
      updateAudioLevel();
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
  }

  function handleUseRecording() {
    if (recordedBlob) {
      onAudioReady(recordedBlob, durationRef.current);
    }
  }

  function resetRecorder() {
    stopEverything();
    setStateValue("idle");
    setMicError(null);
    setDuration(0);
    durationRef.current = 0;
    setAudioLevel(0);
    setRecordedBlob(null);
    setEstimatedSize(0);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }

  const sizeMB = (estimatedSize / (1024 * 1024)).toFixed(2);
  const sizePercent = Math.min((estimatedSize / (maxSizeMB * 1024 * 1024)) * 100, 100);

  if (state === "error" && micError) {
    const { title, description } = getMicErrorMessage(micError);
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">{title}</h3>
            <p className="mt-1 text-sm text-red-700">{description}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
              onClick={resetRecorder}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main recorder UI */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* Duration display */}
        <div className="text-center mb-6">
          <div
            className={cn(
              "text-5xl font-mono font-bold tracking-wider transition-colors",
              state === "recording"
                ? "text-red-600"
                : state === "paused"
                ? "text-yellow-600"
                : "text-slate-800"
            )}
          >
            {formatDuration(duration)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {state === "idle" && "Ready to record"}
            {state === "recording" && (
              <span className="inline-flex items-center gap-1.5 text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                Recording...
              </span>
            )}
            {state === "paused" && (
              <span className="text-yellow-600">Paused</span>
            )}
            {state === "stopped" && "Recording complete"}
          </div>
        </div>

        {/* Audio level indicator */}
        {(state === "recording" || state === "paused") && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Mic className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-xs text-slate-500">Audio Level</span>
              <span className="text-xs text-slate-400 ml-auto">{audioLevel}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-75",
                  audioLevel > 80
                    ? "bg-red-500"
                    : audioLevel > 50
                    ? "bg-yellow-500"
                    : "bg-green-500"
                )}
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        )}

        {/* Size indicator (when recording) */}
        {(state === "recording" || state === "paused") && estimatedSize > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">File size</span>
              <span className="text-xs text-slate-500">
                {sizeMB} MB / {maxSizeMB} MB
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  sizePercent > 85
                    ? "bg-red-500"
                    : sizePercent > 70
                    ? "bg-yellow-500"
                    : "bg-blue-500"
                )}
                style={{ width: `${sizePercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          {state === "idle" && (
            <Button
              size="lg"
              onClick={startRecording}
              className="gap-2 bg-red-600 hover:bg-red-700 text-white px-8"
            >
              <Mic className="h-5 w-5" />
              Start Recording
            </Button>
          )}

          {state === "recording" && (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={pauseRecording}
                className="gap-2"
              >
                <Pause className="h-5 w-5" />
                Pause
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Stop
              </Button>
            </>
          )}

          {state === "paused" && (
            <>
              <Button
                size="lg"
                onClick={resumeRecording}
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <Play className="h-5 w-5" />
                Resume
              </Button>
              <Button
                variant="destructive"
                size="lg"
                onClick={stopRecording}
                className="gap-2"
              >
                <Square className="h-5 w-5" />
                Stop
              </Button>
            </>
          )}

          {state === "stopped" && (
            <>
              <Button
                variant="outline"
                size="lg"
                onClick={resetRecorder}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Re-record
              </Button>
              <Button
                size="lg"
                onClick={handleUseRecording}
                className="gap-2"
              >
                Use Recording
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Recorded preview */}
      {state === "stopped" && recordedBlob && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Preview recording</p>
          <audio
            controls
            className="w-full h-10"
            src={URL.createObjectURL(recordedBlob)}
          />
          <p className="mt-2 text-xs text-slate-500">
            Duration: {formatDuration(duration)} &middot; Size:{" "}
            {(recordedBlob.size / (1024 * 1024)).toFixed(2)} MB
          </p>
        </div>
      )}
    </div>
  );
}
