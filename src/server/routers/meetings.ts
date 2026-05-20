import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { db } from "../db/index.js";
import { meetings } from "../db/schema.js";
import { eq, like, and, gte, lte, or, desc } from "drizzle-orm";
import {
  transcribeAudio,
  generateSummaryAndKeyPoints,
} from "../services/openai.js";
import { TRPCError } from "@trpc/server";

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

      return db.query.meetings.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(meetings.createdAt)],
        limit: input.limit,
        offset: input.offset,
        with: { user: true },
      });
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
