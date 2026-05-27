import * as dotenv from "dotenv";

dotenv.config();

function getApiKey(): string {
  let key = process.env.GROQ_API_KEY?.trim() ?? "";
  // Strip accidental "GROQ_API_KEY=gsk_..." or "GROQ_API_KEY gsk_..." copy-paste prefix.
  const gskIdx = key.indexOf("gsk_");
  if (gskIdx > 0) key = key.slice(gskIdx);
  if (!key) throw new Error("GROQ_API_KEY environment variable is not set");
  return key;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
}

// Use Node.js 24 native fetch (undici) + native FormData/Blob instead of
// groq-sdk's node-fetch + agentkeepalive shim, which causes ECONNRESET on
// Vercel serverless due to stale pooled connections.
export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
  language?: string
): Promise<TranscriptionResult> {
  const apiKey = getApiKey();

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: contentType }), filename);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "text");
  if (language) form.append("language", language);
  // A prompt helps Whisper with domain vocabulary and avoids language confusion.
  form.append(
    "prompt",
    language === "fr"
      ? "Réunion professionnelle, discussion d'équipe, points d'action."
      : "Professional meeting, team discussion, action items."
  );

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    // @ts-ignore — signal is standard, TS lib may be behind
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq transcription error ${res.status}: ${body}`);
  }

  // response_format: "text" returns a plain text body
  const text = await res.text();
  return { text, language };
}

export async function generateSummaryAndKeyPoints(
  transcription: string,
  title: string
): Promise<SummaryResult> {
  const apiKey = getApiKey();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content:
            "You are a professional meeting assistant. Analyze meeting transcriptions and provide structured summaries. Always respond with valid JSON only, no markdown fences.",
        },
        {
          role: "user",
          content: `Analyze the following meeting transcription titled "${title}".\nRespond ONLY with a JSON object with these two keys:\n- "summary": a concise 2-4 sentence summary (string)\n- "keyPoints": an array of 5-10 key points (array of strings)\n\nTranscription:\n${transcription}`,
        },
      ],
    }),
    // @ts-ignore
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq chat error ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const content = json.choices[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as SummaryResult;
}

// Used by the legacy processAudio route: reads audio from disk then transcribes.
import { readFile } from "fs/promises";
import { join } from "path";

export async function transcribeAudio(
  audioKey: string,
  language?: string
): Promise<TranscriptionResult> {
  const IS_VERCEL = !!process.env.VERCEL;
  const uploadsDir = IS_VERCEL ? "/tmp/uploads" : join(process.cwd(), "uploads");
  const filePath = join(uploadsDir, audioKey);
  const fileBuffer = await readFile(filePath);
  const ext = audioKey.split(".").pop() ?? "webm";
  return transcribeAudioBuffer(fileBuffer, `recording.${ext}`, `audio/${ext}`, language);
}
