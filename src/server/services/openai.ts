import Groq from "groq-sdk";
import fs from "fs/promises";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
  const filePath = path.join(process.cwd(), "uploads", audioKey);
  const fileBuffer = await fs.readFile(filePath);
  const file = new File([fileBuffer], "recording.webm", { type: "audio/webm" });

  const transcription = await groq.audio.transcriptions.create({
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
  const completion = await groq.chat.completions.create({
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

  const parsed = JSON.parse(cleaned) as SummaryResult;
  return parsed;
}

export { groq };
