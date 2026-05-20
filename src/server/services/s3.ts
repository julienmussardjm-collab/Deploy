import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function uploadAudioToS3(
  audioBuffer: Buffer,
  key: string,
  _contentType: string
): Promise<{ audioUrl: string; audioKey: string; size: number }> {
  const filePath = path.join(UPLOADS_DIR, key);
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, audioBuffer);

  return {
    audioUrl: `/uploads/${key}`,
    audioKey: key,
    size: audioBuffer.length,
  };
}

export async function getSignedUrlForKey(key: string): Promise<string> {
  return `/uploads/${key}`;
}

export async function deleteAudioFromS3(key: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOADS_DIR, key));
  } catch {
    // ignore missing files
  }
}

export function generateAudioKey(filename: string): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomUUID().substring(0, 8);
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `audio/${timestamp}_${randomSuffix}_${sanitized}`;
}

export async function getAudioBuffer(key: string): Promise<Buffer> {
  return fs.readFile(path.join(UPLOADS_DIR, key));
}
