import OpenAI from "openai";
import * as dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
  audioUrl: string,
  language?: string
): Promise<TranscriptionResult> {
  // Fetch the audio from S3 signed URL
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch audio from S3: ${response.statusText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

  // Create a File object for the OpenAI API
  const audioFile = new File([audioBlob], "recording.webm", {
    type: "audio/webm",
  });

  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: language,
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
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a professional meeting assistant. Analyze meeting transcriptions and provide structured summaries.
Always respond with valid JSON matching the exact schema provided.`,
      },
      {
        role: "user",
        content: `Please analyze the following meeting transcription titled "${title}" and provide:
1. A concise summary (2-4 sentences)
2. Key points as an array of strings (5-10 points max)

Transcription:
${transcription}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "meeting_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "A concise 2-4 sentence summary of the meeting",
            },
            keyPoints: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Array of key points from the meeting (5-10 items)",
            },
          },
          required: ["summary", "keyPoints"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  const parsed = JSON.parse(content) as SummaryResult;
  return parsed;
}

export { openai };
