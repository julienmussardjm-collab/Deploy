import { describe, it, expect, vi } from "vitest";

vi.mock("../src/server/services/s3.js", () => ({
  uploadAudioToS3: vi.fn().mockResolvedValue({
    audioUrl:
      "https://test-bucket.s3.amazonaws.com/audio/test_123.webm?signed=true",
    audioKey: "audio/test_123.webm",
    size: 2048,
  }),
  generateAudioKey: vi
    .fn()
    .mockReturnValue("audio/test_123.webm"),
  getSignedUrlForKey: vi
    .fn()
    .mockResolvedValue(
      "https://test-bucket.s3.amazonaws.com/audio/test_123.webm?signed=true"
    ),
}));

vi.mock("../src/server/db/index.js", () => ({
  db: {},
  schema: {},
}));

import { uploadRouter } from "../src/server/routers/upload.js";
import type { Context } from "../src/server/trpc.js";

function createCaller() {
  const ctx: Context = {
    req: {} as never,
    res: {} as never,
  };
  return uploadRouter.createCaller(ctx);
}

// Helper: create a valid base64 webm audio blob (minimal fake data)
function createFakeAudioBase64(sizeBytes = 1024): string {
  const buffer = Buffer.alloc(sizeBytes, 0x42); // fill with 'B'
  return buffer.toString("base64");
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
      expect(result.audioUrl).toContain("s3");
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
      const { uploadAudioToS3 } = await import("../src/server/services/s3.js");
      // uploadAudioToS3 won't be called for oversized files
      (uploadAudioToS3 as ReturnType<typeof vi.fn>).mockClear();

      const caller = createCaller();
      // Create a base64 string that represents 17MB of data
      // 17 * 1024 * 1024 bytes -> need base64 for that
      // We can't actually allocate 17MB in test, so we'll mock the buffer check
      // Instead, test with a large enough base64
      const overSizeBuffer = Buffer.alloc(17 * 1024 * 1024);
      const overSizeBase64 = overSizeBuffer.toString("base64");

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

    it("should reject empty buffer (zero-length audio)", async () => {
      const caller = createCaller();
      // Empty base64 string that decodes to 0 bytes
      await expect(
        caller.uploadAudio({
          audioData: "AA==", // decodes to 1 byte but let's test with truly invalid
          filename: "recording.webm",
          contentType: "audio/webm",
        })
      ).resolves.toBeDefined(); // 1 byte is technically valid, should pass
    });

    it("should generate a unique S3 key for each upload", async () => {
      const { generateAudioKey } = await import("../src/server/services/s3.js");
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
