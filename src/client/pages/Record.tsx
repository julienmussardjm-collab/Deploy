import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import AudioRecorder from "@/client/components/AudioRecorder";
import { trpc } from "@/client/lib/trpc";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/client/components/ui/card";
import { Progress } from "@/client/components/ui/progress";

type UploadStep = "recording" | "processing" | "done" | "error";

const STEP_LABELS: Record<UploadStep, string> = {
  recording: "Waiting for recording",
  processing: "Uploading & processing your meeting...",
  done: "Done! Redirecting...",
  error: "An error occurred",
};

const STEP_PROGRESS: Record<UploadStep, number> = {
  recording: 0,
  processing: 50,
  done: 100,
  error: 0,
};

export default function Record() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [recorderName, setRecorderName] = useState("");
  const [titleError, setTitleError] = useState("");
  const [step, setStep] = useState<UploadStep>("recording");
  const [errorMessage, setErrorMessage] = useState("");
  const [recordingReady, setRecordingReady] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const uploadAndProcessMutation = trpc.meetings.uploadAndProcess.useMutation();

  function handleAudioReady(blob: Blob, _duration: number) {
    setAudioBlob(blob);
    setRecordingReady(true);
  }

  function handleRecorderError(error: string) {
    setErrorMessage(error);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError("Meeting title is required");
      return;
    }
    if (!audioBlob) {
      setErrorMessage("Please record audio before uploading.");
      return;
    }

    setTitleError("");
    setErrorMessage("");

    try {
      setStep("processing");
      const mimeType = audioBlob.type || "audio/webm";
      const extension = mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("wav")
        ? "wav"
        : "webm";
      const filename = `recording_${Date.now()}.${extension}`;

      // Use FileReader to safely convert Blob → base64 without
      // hitting the call-stack limit that String.fromCharCode(...chunk) can
      // trigger on large recordings (>8 MB).
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          // result is "data:<mime>;base64,<data>" — strip the prefix
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1]);
        };
        reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
        reader.readAsDataURL(audioBlob);
      });

      const result = await uploadAndProcessMutation.mutateAsync({
        title: title.trim(),
        recorderName: recorderName.trim() || undefined,
        audioData: base64,
        filename,
        contentType: mimeType,
      });

      setStep("done");
      setTimeout(() => {
        navigate(`/meeting/${result.id}`);
      }, 800);
    } catch (err) {
      setStep("error");
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    }
  }

  const isSubmitting = step === "processing";
  const isComplete = step === "done";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">New Recording</h1>
        <p className="text-slate-500 mt-1">
          Record your meeting audio and let AI transcribe and summarize it.
        </p>
      </div>

      {/* Progress bar for upload steps */}
      {step !== "recording" && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              {STEP_LABELS[step]}
            </span>
            {step !== "error" && (
              <span className="text-sm text-slate-500">
                {STEP_PROGRESS[step]}%
              </span>
            )}
          </div>
          <Progress value={STEP_PROGRESS[step]} />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Meeting Details */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Details</CardTitle>
            <CardDescription>
              Provide information about this meeting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Meeting Title <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Q3 Planning Session"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (e.target.value.trim()) setTitleError("");
                }}
                disabled={isSubmitting || isComplete}
                className={titleError ? "border-red-400 focus-visible:ring-red-400" : ""}
              />
              {titleError && (
                <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {titleError}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Recorded by{" "}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <Input
                placeholder="Your name (optional)"
                value={recorderName}
                onChange={(e) => setRecorderName(e.target.value)}
                disabled={isSubmitting || isComplete}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                No login required — just enter your name if you'd like to
                attribute this recording.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Audio Recorder */}
        <Card>
          <CardHeader>
            <CardTitle>Audio Recording</CardTitle>
            <CardDescription>
              Record your meeting audio. Max file size: 16 MB (~20-30 minutes)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AudioRecorder
              onAudioReady={handleAudioReady}
              onError={handleRecorderError}
              maxSizeMB={16}
            />
          </CardContent>
        </Card>

        {/* Error message */}
        {(errorMessage || step === "error") && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-900">
                Something went wrong
              </p>
              <p className="text-sm text-red-700 mt-0.5">{errorMessage}</p>
              {step === "error" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 border-red-300 text-red-700"
                  onClick={() => {
                    setStep("recording");
                    setErrorMessage("");
                  }}
                >
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button
            type="submit"
            size="lg"
            disabled={!recordingReady || isSubmitting || isComplete || !title.trim()}
            className="flex-1 sm:flex-none gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {STEP_LABELS[step]}
              </>
            ) : isComplete ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Done! Redirecting...
              </>
            ) : (
              <>
                Upload & Process
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>

          {!recordingReady && !isSubmitting && (
            <p className="text-sm text-slate-500">
              Record audio first to enable upload
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
