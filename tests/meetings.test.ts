import { describe, it, expect, beforeEach, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("../src/server/services/openai.js", () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    text: "This is a test transcription of the meeting.",
    language: "en",
  }),
  generateSummaryAndKeyPoints: vi.fn().mockResolvedValue({
    summary: "This meeting covered quarterly planning with key stakeholders.",
    keyPoints: [
      "Discussed Q3 goals and targets",
      "Reviewed budget allocation",
      "Assigned action items",
    ],
  }),
}));

vi.mock("../src/server/services/s3.js", () => ({
  getSignedUrlForKey: vi.fn().mockResolvedValue("/uploads/audio/test.webm"),
  uploadAudioToS3: vi.fn().mockResolvedValue({
    audioUrl: "/uploads/audio/test.webm",
    audioKey: "audio/test_123.webm",
    size: 1024,
  }),
  generateAudioKey: vi.fn().mockReturnValue("audio/test_123.webm"),
}));

vi.mock("../src/server/db/index.js", () => {
  const db = {
    query: {
      meetings: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      users: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
  };

  db.query.meetings.findMany.mockResolvedValue([]);
  db.query.users.findFirst.mockResolvedValue(null);

  db.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([
        {
          id: 1,
          userId: null,
          recorderName: null,
          title: "Test Meeting",
          audioUrl: "/uploads/audio/test.webm",
          audioKey: "audio/test_123.webm",
          transcription: null,
          summary: null,
          keyPoints: null,
          status: "pending",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    }),
  });

  db.update.mockReturnValue({
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue({}),
  });

  return { db, schema: {} };
});

import { meetingsRouter } from "../src/server/routers/meetings.js";
import type { Context } from "../src/server/trpc.js";

function createCaller(userId?: number) {
  const ctx: Context = { req: {} as never, res: {} as never, userId };
  return meetingsRouter.createCaller(ctx);
}

const pendingMeeting = {
  id: 1,
  userId: null,
  recorderName: "John Doe",
  title: "Q3 Planning",
  audioUrl: "/uploads/audio/test.webm",
  audioKey: "audio/test_123.webm",
  transcription: null,
  summary: null,
  keyPoints: null,
  status: "pending" as const,
  createdAt: new Date("2024-01-15"),
  updatedAt: new Date("2024-01-15"),
};

const doneMeeting = {
  ...pendingMeeting,
  id: 2,
  status: "done" as const,
  transcription: "This is a test transcription.",
  summary: "A concise summary of the meeting.",
  keyPoints: ["Point 1", "Point 2", "Point 3"],
};

describe("Meetings Router", () => {
  describe("meetings.create", () => {
    beforeEach(async () => {
      const { db } = await import("../src/server/db/index.js");
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([pendingMeeting]),
        }),
      });
    });

    it("should create a meeting with required fields", async () => {
      const caller = createCaller();
      const result = await caller.create({
        title: "Weekly Standup",
        audioUrl: "/uploads/audio/test.webm",
        audioKey: "audio/test_123.webm",
      });

      expect(result).toBeDefined();
      expect(result.title).toBeDefined();
      expect(result.status).toBe("pending");
    });

    it("should create a meeting with optional recorderName", async () => {
      const caller = createCaller();
      const result = await caller.create({
        title: "Team Sync",
        audioUrl: "/uploads/audio/test.webm",
        audioKey: "audio/test_456.webm",
        recorderName: "Jane Smith",
      });

      expect(result).toBeDefined();
    });

    it("should reject meeting with empty title", async () => {
      const caller = createCaller();
      await expect(
        caller.create({
          title: "",
          audioUrl: "/uploads/audio/test.webm",
          audioKey: "audio/test.webm",
        })
      ).rejects.toThrow();
    });

    it("should reject meeting with empty audioUrl", async () => {
      const caller = createCaller();
      await expect(
        caller.create({
          title: "Test Meeting",
          audioUrl: "",
          audioKey: "audio/test.webm",
        })
      ).rejects.toThrow();
    });
  });

  describe("meetings.getById", () => {
    it("should retrieve a meeting by ID", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(pendingMeeting);

      const caller = createCaller();
      const result = await caller.getById({ id: 1 });

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
      expect(result.title).toBe("Q3 Planning");
    });

    it("should return meeting with transcription when done", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(doneMeeting);

      const caller = createCaller();
      const result = await caller.getById({ id: 2 });

      expect(result).toBeDefined();
      expect(result.transcription).toBe("This is a test transcription.");
    });

    it("should throw NOT_FOUND for non-existent meeting", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);

      const caller = createCaller();
      await expect(caller.getById({ id: 9999 })).rejects.toThrow(TRPCError);
    });
  });

  describe("meetings.list", () => {
    beforeEach(async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findMany as ReturnType<typeof vi.fn>
      ).mockResolvedValue([pendingMeeting, doneMeeting]);
    });

    it("should list all meetings without filters", async () => {
      const caller = createCaller();
      const result = await caller.list({});
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should list meetings with search filter", async () => {
      const caller = createCaller();
      const result = await caller.list({ search: "Q3" });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should list meetings with date filters", async () => {
      const caller = createCaller();
      const result = await caller.list({
        dateFrom: "2024-01-01T00:00:00.000Z",
        dateTo: "2024-12-31T23:59:59.000Z",
      });
      expect(Array.isArray(result)).toBe(true);
    });

    it("should respect limit parameter", async () => {
      const caller = createCaller();
      const result = await caller.list({ limit: 10, offset: 0 });
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("meetings.processAudio", () => {
    beforeEach(async () => {
      const { db } = await import("../src/server/db/index.js");
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue({}),
      });
    });

    it("should process audio and return transcription and summary", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(pendingMeeting);

      const caller = createCaller();
      const result = await caller.processAudio({ meetingId: 1 });

      expect(result).toHaveProperty("transcription");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("keyPoints");
      expect(typeof result.transcription).toBe("string");
      expect(Array.isArray(result.keyPoints)).toBe(true);
    });

    it("should return existing results if already done", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(doneMeeting);

      const caller = createCaller();
      const result = await caller.processAudio({ meetingId: 2 });

      expect(result.transcription).toBe("This is a test transcription.");
      expect(result.summary).toBe("A concise summary of the meeting.");
    });

    it("should throw NOT_FOUND if meeting doesn't exist", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(null);

      const caller = createCaller();
      await expect(caller.processAudio({ meetingId: 9999 })).rejects.toThrow(
        TRPCError
      );
    });

    it("should update DB with results after processing", async () => {
      const { db } = await import("../src/server/db/index.js");
      (
        db.query.meetings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(pendingMeeting);

      const caller = createCaller();
      await caller.processAudio({ meetingId: 1 });

      expect(db.update).toHaveBeenCalled();
    });
  });
});
