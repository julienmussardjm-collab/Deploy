import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

// Sur Vercel sans stockage persistant, l'audio est traité depuis le buffer en mémoire
// et n'est pas sauvegardé (la transcription et le résumé sont stockés dans Turso)
const IS_VERCEL = !!process.env.VERCEL;
const UPLOADS_DIR = join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function uploadAudioToS3(
  audioBuffer: Buffer,
  key: string,
  _contentType: string
): Promise<{ audioUrl: string; audioKey: string; size: number }> {
  if (!IS_VERCEL) {
    // Dev local : stockage disque pour permettre la lecture
    const filePath = join(UPLOADS_DIR, key);
    await ensureDir(dirname(filePath));
    await writeFile(filePath, audioBuffer);
    return { audioUrl: `/uploads/${key}`, audioKey: key, size: audioBuffer.length };
  }

  // Vercel : pas de stockage persistant pour l'audio
  // La transcription se fait depuis le buffer en mémoire dans uploadAndProcess
  return { audioUrl: key, audioKey: key, size: audioBuffer.length };
}

export async function getSignedUrlForKey(key: string): Promise<string> {
  return IS_VERCEL ? key : `/uploads/${key}`;
}

export async function deleteAudioFromS3(key: string): Promise<void> {
  if (!IS_VERCEL) {
    try {
      await unlink(join(UPLOADS_DIR, key));
    } catch {
      // fichier déjà absent
    }
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
