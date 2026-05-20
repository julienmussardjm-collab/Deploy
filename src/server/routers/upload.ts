import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { uploadAudioToS3, generateAudioKey } from "../services/s3.js";
import { TRPCError } from "@trpc/server";

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB
const ALLOWED_CONTENT_TYPES = [
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
];

export const uploadRouter = router({
  uploadAudio: publicProcedure
    .input(
      z.object({
        audioData: z.string().min(1, "Audio data is required"), // base64
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // Validate content type
      const normalizedContentType = input.contentType.toLowerCase().trim();
      const isValidContentType = ALLOWED_CONTENT_TYPES.some((type) =>
        normalizedContentType.startsWith(type.split(";")[0])
      );

      if (!isValidContentType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Invalid content type: ${input.contentType}. Allowed types: ${ALLOWED_CONTENT_TYPES.join(", ")}`,
        });
      }

      // Decode base64 to buffer
      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(input.audioData, "base64");
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid base64 audio data",
        });
      }

      // Validate file size
      if (audioBuffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
      }

      if (audioBuffer.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Audio file is empty",
        });
      }

      // Generate unique S3 key
      const audioKey = generateAudioKey(input.filename);

      // Upload to S3
      const result = await uploadAudioToS3(
        audioBuffer,
        audioKey,
        input.contentType
      );

      return {
        audioUrl: result.audioUrl,
        audioKey: result.audioKey,
        size: result.size,
      };
    }),
});
