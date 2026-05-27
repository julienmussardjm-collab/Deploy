import Groq, { toFile } from "groq-sdk";
import { readFile } from "fs/promises";
import { join } from "path";
import { Agent } from "https";
import * as dotenv from "dotenv";

dotenv.config();

// Vercel serverless: use a fresh HTTPS agent per Groq instance (no keep-alive).
// The groq-sdk default uses agentkeepalive whose pooled connections become stale
// between Lambda invocations, causing ECONNRESET → APIConnectionError.
const httpAgent = new Agent({ keepAlive: false });

// Lazy init — évite le crash au chargement si GROQ_API_KEY manque
let _groq: Groq | null = null;
function getGroq(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new Error("GROQ_API_KEY environment variable is not set");
    _groq = new Groq({
      apiKey,
      httpAgent,
      // Stay comfortably under Vercel Hobby's 60s function limit.
      // APIConnectionTimeoutError gives a clearer message than a gateway kill.
      timeout: 55_000,
    });
  }
  return _groq;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
}

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

export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string,
  contentType: string,
  language?: string
): Promise<TranscriptionResult> {
  const file = await toFile(buffer, filename, { type: contentType });
  const transcription = await getGroq().audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    language,
    response_format: "text",
  });
  return {
    text: transcription as unknown as string,
    language,
  };
}

export async function generateSummaryAndKeyPoints(
  transcription: string,
  title: string
): Promise<SummaryResult> {
  const completion = await getGroq().chat.completions.create({
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
        content: `Analyze the following meeting transcription titled "${title}".
Respond ONLY with a JSON object with these two keys:
- "summary": a concise 2-4 sentence summary (string)
- "keyPoints": an array of 5-10 key points (array of strings)

Transcription:
${transcription}`,
      },
    ],
  });

  const content = completion.choices[0].message.content ?? "";
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  return JSON.parse(cleaned) as SummaryResult;
}
