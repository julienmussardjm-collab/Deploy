import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

// ── Cloudflare R2 ──────────────────────────────────────────────────────────────

function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

let _s3: S3Client | null = null;
function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

const bucket = () => process.env.R2_BUCKET_NAME!;

// ── Fallback disque local (dev sans R2) ────────────────────────────────────────

const UPLOADS_DIR = join(process.cwd(), "uploads");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

// ── Exports ────────────────────────────────────────────────────────────────────

export async function uploadAudioToS3(
  audioBuffer: Buffer,
  key: string,
  contentType: string
): Promise<{ audioUrl: string; audioKey: string; size: number }> {
  if (isR2Configured()) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: audioBuffer,
        ContentType: contentType,
      })
    );
    return { audioUrl: `r2://${key}`, audioKey: key, size: audioBuffer.length };
  }

  // Fallback local
  const filePath = join(UPLOADS_DIR, key);
  await ensureDir(dirname(filePath));
  await writeFile(filePath, audioBuffer);
  return { audioUrl: `/uploads/${key}`, audioKey: key, size: audioBuffer.length };
}

export async function getSignedUrlForKey(key: string): Promise<string> {
  if (isR2Configured()) {
    return awsGetSignedUrl(
      getS3(),
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: 3600 }
    );
  }
  return `/uploads/${key}`;
}

export async function deleteAudioFromS3(key: string): Promise<void> {
  if (isR2Configured()) {
    await getS3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return;
  }
  try {
    await unlink(join(UPLOADS_DIR, key));
  } catch {
    // fichier déjà absent
  }
}

export function generateAudioKey(filename: string): string {
  const timestamp = Date.now();
  const randomSuffix = randomUUID().substring(0, 8);
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `audio/${timestamp}_${randomSuffix}_${sanitized}`;
}

export async function getAudioBuffer(key: string): Promise<Buffer> {
  if (isR2Configured()) {
    const res = await getS3().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key })
    );
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  return readFile(join(UPLOADS_DIR, key));
}
