import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;
const SIGNED_URL_EXPIRY = 3600; // 1 hour

export async function uploadAudioToS3(
  audioBuffer: Buffer,
  key: string,
  contentType: string
): Promise<{ audioUrl: string; audioKey: string; size: number }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: audioBuffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  const audioUrl = await getSignedUrlForKey(key);

  return {
    audioUrl,
    audioKey: key,
    size: audioBuffer.length,
  };
}

export async function getSignedUrlForKey(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: SIGNED_URL_EXPIRY });
}

export async function deleteAudioFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await s3Client.send(command);
}

export function generateAudioKey(filename: string): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `audio/${timestamp}_${randomSuffix}_${sanitized}`;
}

export { s3Client };
