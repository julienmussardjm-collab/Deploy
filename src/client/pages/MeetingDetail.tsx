import { useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
  FileText,
  Sparkles,
  ListChecks,
} from "lucide-react";
import { trpc } from "@/client/lib/trpc";
import { Button } from "@/client/components/ui/button";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { Progress } from "@/client/components/ui/progress";
import { useState } from "react";

type MeetingStatus = "pending" | "processing" | "done" | "error";

const PROCESSING_STEPS = [
  { label: "Uploading", threshold: 0 },
  { label: "Transcribing", threshold: 33 },
  { label: "Summarizing", threshold: 66 },
  { label: "Done", threshold: 100 },
];

function getProcessingProgress(status: MeetingStatus): number {
  switch (status) {
    case "pending":
      return 15;
    case "processing":
      return 55;
    case "done":
      return 100;
    case "error":
      return 0;
    default:
      return 0;
  }
}

function getStatusBadgeVariant(
  status: MeetingStatus
): "success" | "processing" | "warning" | "error" {
  switch (status) {
    case "done":
      return "success";
    case "processing":
      return "processing";
    case "pending":
      return "warning";
    case "error":
      return "error";
  }
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? (
        <>
          <CheckCircle className="h-3.5 w-3.5 text-green-600" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

function DownloadButton({
  text,
  filename,
}: {
  text: string;
  filename: string;
}) {
  function handleDownload() {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
      <Download className="h-3.5 w-3.5" />
      Download
    </Button>
  );
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const meetingId = parseInt(id || "0", 10);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    data: meeting,
    isLoading,
    error,
    refetch,
  } = trpc.meetings.getById.useQuery(
    { id: meetingId },
    {
      enabled: !!meetingId,
      refetchOnWindowFocus: false,
    }
  );

  // Polling when status is pending/processing
  useEffect(() => {
    const shouldPoll =
      meeting &&
      (meeting.status === "pending" || meeting.status === "processing");

    if (shouldPoll) {
      pollingRef.current = setInterval(() => {
        refetch();
      }, 2000);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [meeting?.status, refetch]);

  if (!meetingId || isNaN(meetingId)) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Invalid meeting ID
        </h2>
        <Link to="/dashboard">
          <Button variant="outline" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600">Loading meeting...</span>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Meeting not found
        </h2>
        <p className="text-slate-500 mb-6">
          This meeting may not exist or an error occurred.
        </p>
        <Link to="/dashboard">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const isProcessing =
    meeting.status === "pending" || meeting.status === "processing";
  const progress = getProcessingProgress(meeting.status);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Meeting Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start gap-3 justify-between mb-3">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight flex-1">
            {meeting.title}
          </h1>
          <Badge variant={getStatusBadgeVariant(meeting.status)} className="text-sm px-3 py-1">
            {meeting.status === "processing" && (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            )}
            {meeting.status === "done" && (
              <CheckCircle className="h-3 w-3 mr-1.5" />
            )}
            {meeting.status === "error" && (
              <AlertCircle className="h-3 w-3 mr-1.5" />
            )}
            {meeting.status.charAt(0).toUpperCase() + meeting.status.slice(1)}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {formatDate(meeting.createdAt)}
          </div>
          {(meeting.recorderName || meeting.user?.name) && (
            <div className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {meeting.recorderName || meeting.user?.name}
            </div>
          )}
        </div>
      </div>

      {/* Processing status */}
      {isProcessing && (
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">
                  AI is processing your meeting
                </p>
                <p className="text-sm text-blue-700">
                  This usually takes 1-2 minutes. Page updates automatically.
                </p>
              </div>
            </div>

            <Progress value={progress} className="mb-3" />

            <div className="flex justify-between">
              {PROCESSING_STEPS.map((s, i) => (
                <div key={s.label} className="flex flex-col items-center">
                  <div
                    className={`h-2 w-2 rounded-full mb-1 ${
                      progress >= s.threshold && i < PROCESSING_STEPS.length - 1
                        ? "bg-blue-600"
                        : progress >= 100 && i === PROCESSING_STEPS.length - 1
                        ? "bg-green-600"
                        : "bg-slate-300"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      progress >= s.threshold
                        ? "text-blue-700 font-medium"
                        : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error status */}
      {meeting.status === "error" && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Processing failed</p>
                <p className="text-sm text-red-700">
                  There was an error processing this meeting. Please try
                  recording again.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {meeting.summary && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 leading-relaxed">{meeting.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Points */}
      {(() => {
        // keyPoints is stored as JSON text in SQLite; Drizzle parses it but
        // guard against it coming back as a raw string just in case.
        let kp: string[] = [];
        if (Array.isArray(meeting.keyPoints)) {
          kp = meeting.keyPoints as string[];
        } else if (typeof meeting.keyPoints === "string") {
          try { kp = JSON.parse(meeting.keyPoints); } catch { kp = []; }
        }
        return kp.length > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ListChecks className="h-5 w-5 text-green-600" />
              Key Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {kp.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-slate-700 leading-relaxed">{point}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        ) : null;
      })()}

      {/* Transcription */}
      {meeting.transcription ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5 text-blue-600" />
                Full Transcription
              </CardTitle>
              <div className="flex gap-2">
                <CopyButton text={meeting.transcription} />
                <DownloadButton
                  text={meeting.transcription}
                  filename={`${meeting.title
                    .replace(/[^a-z0-9]/gi, "_")
                    .toLowerCase()}_transcription.txt`}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto rounded-lg bg-slate-50 p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
              {meeting.transcription}
            </div>
          </CardContent>
        </Card>
      ) : !isProcessing && meeting.status !== "error" ? (
        <Card>
          <CardContent className="py-8 text-center text-slate-500">
            <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p>No transcription available yet.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
