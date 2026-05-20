import { describe, it, expect, vi } from "vitest";

vi.mock("../src/server/services/s3.js", () => ({
  uploadAudioToS3: vi.fn().mockResolvedValue({
    audioUrl: "/uploads/audio/test_123.webm",
    audioKey: "audio/test_123.webm",
    size: 2048,
  }),
  generateAudioKey: vi.fn().mockReturnValue("audio/test_123.webm"),
  getSignedUrlForKey: vi.fn().mockResolvedValue("/uploads/audio/test_123.webm"),
}));

vi.mock("../src/server/db/index.js", () => ({
  db: {},
  schema: {},
}));

import { uploadRouter } from "../src/server/routers/upload.js";
import type { Context } from "../src/server/trpc.js";

function createCaller() {
  const ctx: Context = { req: {} as never, res: {} as never };
  return uploadRouter.createCaller(ctx);
}

function createFakeAudioBase64(sizeBytes = 1024): string {
  return Buffer.alloc(sizeBytes, 0x42).toString("base64");
}

describe("Upload Router", () => {
  describe("upload.uploadAudio", () => {
    it("should upload valid webm audio", async () => {
      const caller = createCaller();
      const result = await caller.uploadAudio({
        audioData: createFakeAudioBase64(2048),
        filename: "recording.webm",
        contentType: "audio/webm",
      });

      expect(result).toBeDefined();
      expect(result.audioUrl).toBeTruthy();
      expect(result.audioKey).toBeTruthy();
      expect(result.size).toBeGreaterThan(0);
    });

    it("should accept audio/webm;codecs=opus content type", async () => {
      const caller = createCaller();
      const result = await caller.uploadAudio({
        audioData: createFakeAudioBase64(1024),
        filename: "recording.webm",
        contentType: "audio/webm;codecs=opus",
      });

      expect(result).toBeDefined();
      expect(result.audioUrl).toContain("uploads");
    });

    it("should accept audio/ogg content type", async () => {
      const caller = createCaller();
      const result = await caller.uploadAudio({
        audioData: createFakeAudioBase64(1024),
        filename: "recording.ogg",
        contentType: "audio/ogg",
      });

      expect(result).toBeDefined();
    });

    it("should reject invalid content type", async () => {
      const caller = createCaller();
      await expect(
        caller.uploadAudio({
          audioData: createFakeAudioBase64(1024),
          filename: "recording.mp3",
          contentType: "image/jpeg",
        })
      ).rejects.toThrow();
    });

    it("should reject file exceeding 16MB size limit", async () => {
      const caller = createCaller();
      const overSizeBase64 = Buffer.alloc(17 * 1024 * 1024).toString("base64");
      await expect(
        caller.uploadAudio({
          audioData: overSizeBase64,
          filename: "recording.webm",
          contentType: "audio/webm",
        })
      ).rejects.toThrow(/exceeds maximum/i);
    });

    it("should reject empty audio data", async () => {
      const caller = createCaller();
      await expect(
        caller.uploadAudio({
          audioData: "",
          filename: "recording.webm",
          contentType: "audio/webm",
        })
      ).rejects.toThrow();
    });

    it("should resolve for minimal valid audio data", async () => {
      const caller = createCaller();
      await expect(
        caller.uploadAudio({
          audioData: "AA==",
          filename: "recording.webm",
          contentType: "audio/webm",
        })
      ).resolves.toBeDefined();
    });

    it("should generate a unique storage key for each upload", async () => {
      const { generateAudioKey } = await import(
        "../src/server/services/s3.js"
      );
      const caller = createCaller();

      await caller.uploadAudio({
        audioData: createFakeAudioBase64(1024),
        filename: "meeting1.webm",
        contentType: "audio/webm",
      });

      expect(generateAudioKey).toHaveBeenCalledWith("meeting1.webm");
    });
  });
});
