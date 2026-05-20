import { vi } from "vitest";

// Mock environment variables
process.env.DATABASE_URL = "mysql://test:test@localhost:3306/test_db";
process.env.JWT_SECRET = "test-secret-key-at-least-32-characters-long";
process.env.OPENAI_API_KEY = "sk-test-key";
process.env.AWS_ACCESS_KEY_ID = "test-access-key";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
process.env.AWS_REGION = "us-east-1";
process.env.AWS_S3_BUCKET = "test-bucket";
process.env.NODE_ENV = "test";

// Mock OpenAI
vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue("This is a test transcription of the meeting."),
        },
      },
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    summary:
                      "This meeting covered the quarterly planning session with key stakeholders.",
                    keyPoints: [
                      "Discussed Q3 goals and targets",
                      "Reviewed budget allocation",
                      "Assigned action items to team members",
                      "Scheduled follow-up meeting for next week",
                    ],
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

// Mock AWS S3
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
  PutObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi
    .fn()
    .mockResolvedValue(
      "https://test-bucket.s3.amazonaws.com/audio/test-key.webm?signed=true"
    ),
}));

// Mock the database
vi.mock("../src/server/db/index.js", () => {
  const mockMeetings: Array<{
    id: number;
    userId: number | null;
    recorderName: string | null;
    title: string;
    audioUrl: string;
    audioKey: string;
    transcription: string | null;
    summary: string | null;
    keyPoints: string[] | null;
    status: "pending" | "processing" | "done" | "error";
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  const mockUsers: Array<{
    id: number;
    openId: string | null;
    name: string;
    email: string;
    role: "user" | "admin";
    createdAt: Date;
    updatedAt: Date;
    lastSignedIn: Date | null;
  }> = [];

  let meetingIdCounter = 1;
  let userIdCounter = 1;

  const db = {
    query: {
      meetings: {
        findFirst: vi.fn().mockImplementation(({ where } = {}) => {
          if (!where) return Promise.resolve(mockMeetings[0] || null);
          // Simple mock: return first meeting
          return Promise.resolve(mockMeetings.find((m) => m) || null);
        }),
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([...mockMeetings])
        ),
      },
      users: {
        findFirst: vi.fn().mockImplementation(() =>
          Promise.resolve(mockUsers[0] || null)
        ),
      },
    },
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnThis(),
      $returningId: vi.fn().mockImplementation(() => {
        const id = meetingIdCounter++;
        const meeting = {
          id,
          userId: null,
          recorderName: null,
          title: "Test Meeting",
          audioUrl: "https://test.s3.amazonaws.com/audio/test.webm",
          audioKey: "audio/test.webm",
          transcription: null,
          summary: null,
          keyPoints: null,
          status: "pending" as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        mockMeetings.push(meeting);
        return Promise.resolve([{ id }]);
      }),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue({}),
    })),
    _mockMeetings: mockMeetings,
    _mockUsers: mockUsers,
    _resetMeetings: () => {
      mockMeetings.length = 0;
      meetingIdCounter = 1;
    },
    _addMeeting: (meeting: (typeof mockMeetings)[number]) => {
      mockMeetings.push(meeting);
    },
    _addUser: (user: (typeof mockUsers)[number]) => {
      mockUsers.push(user);
      userIdCounter++;
    },
  };

  return { db, schema: {} };
});
