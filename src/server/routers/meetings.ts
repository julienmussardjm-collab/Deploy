import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { meetings } from "../db/schema.js";
import { eq, like, and, gte, lte, or, desc } from "drizzle-orm";
import {
  transcribeAudio,
  transcribeAudioBuffer,
  generateSummaryAndKeyPoints,
} from "../services/openai.js";
import { generateAudioKey, uploadAudioToS3 } from "../services/s3.js";
import { TRPCError } from "@trpc/server";

const MAX_FILE_SIZE = 16 * 1024 * 1024;
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

export const meetingsRouter = router({
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required").max(500),
        audioUrl: z.string().min(1, "Audio URL is required"),
        audioKey: z.string().min(1, "Audio key is required"),
        recorderName: z.string().max(255).optional(),
        userId: z.number().int().positive().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [created] = await db
        .insert(meetings)
        .values({
          title: input.title,
          audioUrl: input.audioUrl,
          audioKey: input.audioKey,
          recorderName: input.recorderName,
          userId: input.userId,
          status: "pending",
        })
        .returning();

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create meeting",
        });
      }

      return created;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, input.id),
        with: { user: true },
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Meeting with ID ${input.id} not found`,
        });
      }

      return meeting;
    }),

  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        dateFrom: z.string().datetime().optional(),
        dateTo: z.string().datetime().optional(),
        userId: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const conditions = [];

      if (input.search) {
        conditions.push(
          or(
            like(meetings.title, `%${input.search}%`),
            like(meetings.recorderName, `%${input.search}%`)
          )
        );
      }

      if (input.dateFrom) {
        conditions.push(gte(meetings.createdAt, new Date(input.dateFrom)));
      }

      if (input.dateTo) {
        conditions.push(lte(meetings.createdAt, new Date(input.dateTo)));
      }

      if (input.userId) {
        conditions.push(eq(meetings.userId, input.userId));
      }

      try {
        return await db.query.meetings.findMany({
          where: conditions.length > 0 ? and(...conditions) : undefined,
          orderBy: [desc(meetings.createdAt)],
          limit: input.limit,
          offset: input.offset,
          with: { user: true },
        });
      } catch (err) {
        console.error("[meetings.list] DB query failed:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "DB query failed",
        });
      }
    }),

  uploadAndProcess: publicProcedure
    .input(
      z.object({
        title: z.string().min(1, "Title is required").max(500),
        recorderName: z.string().max(255).optional(),
        userId: z.number().int().positive().optional(),
        audioData: z.string().min(1, "Audio data is required"),
        filename: z.string().min(1).max(255),
        contentType: z.string().min(1),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[uploadAndProcess] start", { filename: input.filename, contentType: input.contentType, dataLen: input.audioData.length });

      const normalizedContentType = input.contentType.toLowerCase().trim();
      const isValid = ALLOWED_CONTENT_TYPES.some((t) =>
        normalizedContentType.startsWith(t.split(";")[0])
      );
      if (!isValid) {
        console.error("[uploadAndProcess] invalid content type:", input.contentType);
        throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid content type: ${input.contentType}` });
      }

      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(input.audioData, "base64");
      } catch (e) {
        console.error("[uploadAndProcess] base64 decode error:", e);
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid base64 audio data" });
      }
      console.log("[uploadAndProcess] buffer size:", audioBuffer.length);
      if (audioBuffer.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Audio file is empty" });
      }
      if (audioBuffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "File size exceeds 16MB limit" });
      }

      const audioKey = generateAudioKey(input.filename);

      // Sur Vercel l'audio est traité depuis le buffer (pas de stockage fichier)
      // En dev local on sauvegarde sur disque pour la lecture
      await uploadAudioToS3(audioBuffer, audioKey, input.contentType);
      const audioUrl = audioKey;

      console.log("[uploadAndProcess] inserting meeting into DB");
      const [meeting] = await db
        .insert(meetings)
        .values({
          title: input.title,
          audioUrl,
          audioKey,
          recorderName: input.recorderName,
          userId: input.userId,
          status: "processing",
        })
        .returning();

      if (!meeting) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create meeting" });
      }
      console.log("[uploadAndProcess] meeting created, id:", meeting.id);

      try {
        console.log("[uploadAndProcess] starting transcription");
        const transcriptionResult = await transcribeAudioBuffer(
          audioBuffer,
          input.filename,
          input.contentType,
          input.language
        );
        console.log("[uploadAndProcess] transcription done, length:", transcriptionResult.text.length);

        const summaryResult = await generateSummaryAndKeyPoints(
          transcriptionResult.text,
          input.title
        );
        console.log("[uploadAndProcess] summary done");

        await db
          .update(meetings)
          .set({
            transcription: transcriptionResult.text,
            summary: summaryResult.summary,
            keyPoints: summaryResult.keyPoints,
            status: "done",
            updatedAt: new Date(),
          })
          .where(eq(meetings.id, meeting.id));

        return { id: meeting.id };
      } catch (error) {
        const errName = error instanceof Error ? error.constructor.name : typeof error;
        const errMsg = error instanceof Error ? error.message : String(error);
        const errStatus = (error as any)?.status;
        const errCause = (error as any)?.cause;
        console.error(
          `[uploadAndProcess] processing error [${errName}] status=${errStatus ?? "n/a"} cause=${errCause?.message ?? errCause ?? "n/a"}: ${errMsg}`
        );

        try {
          await db
            .update(meetings)
            .set({ status: "error", updatedAt: new Date() })
            .where(eq(meetings.id, meeting.id));
        } catch (dbErr) {
          console.error("[uploadAndProcess] failed to update meeting status:", dbErr);
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Processing failed: ${errMsg}`,
        });
      }
    }),

  processAudio: publicProcedure
    .input(
      z.object({
        meetingId: z.number().int().positive(),
        language: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const meeting = await db.query.meetings.findFirst({
        where: eq(meetings.id, input.meetingId),
      });

      if (!meeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Meeting with ID ${input.meetingId} not found`,
        });
      }

      if (meeting.status === "done") {
        return {
          transcription: meeting.transcription!,
          summary: meeting.summary!,
          keyPoints: meeting.keyPoints as string[],
        };
      }

      await db
        .update(meetings)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(meetings.id, input.meetingId));

      try {
        const transcriptionResult = await transcribeAudio(
          meeting.audioKey,
          input.language
        );

        const summaryResult = await generateSummaryAndKeyPoints(
          transcriptionResult.text,
          meeting.title
        );

        await db
          .update(meetings)
          .set({
            transcription: transcriptionResult.text,
            summary: summaryResult.summary,
            keyPoints: summaryResult.keyPoints,
            status: "done",
            updatedAt: new Date(),
          })
          .where(eq(meetings.id, input.meetingId));

        return {
          transcription: transcriptionResult.text,
          summary: summaryResult.summary,
          keyPoints: summaryResult.keyPoints,
        };
      } catch (error) {
        await db
          .update(meetings)
          .set({ status: "error", updatedAt: new Date() })
          .where(eq(meetings.id, input.meetingId));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }),
});
