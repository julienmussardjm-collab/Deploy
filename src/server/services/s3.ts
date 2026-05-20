import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function uploadAudioToS3(
  audioBuffer: Buffer,
  key: string,
  _contentType: string
): Promise<{ audioUrl: string; audioKey: string; size: number }> {
  const filePath = join(UPLOADS_DIR, key);
  await ensureDir(dirname(filePath));
  await writeFile(filePath, audioBuffer);

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
    await unlink(join(UPLOADS_DIR, key));
  } catch {
    // ignore missing files
  }
}

export function generateAudioKey(filename: string): string {
  const timestamp = Date.now();
  const randomSuffix = randomUUID().substring(0, 8);
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `audio/${timestamp}_${randomSuffix}_${sanitized}`;
}

export async function getAudioBuffer(key: string): Promise<Buffer> {
  return readFile(join(UPLOADS_DIR, key));
}
