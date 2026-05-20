import { vi } from "vitest";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "test-secret-key-at-least-32-characters-long";
process.env.GROQ_API_KEY = "gsk_test_key";
process.env.NODE_ENV = "test";

vi.mock("groq-sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi
            .fn()
            .mockResolvedValue("This is a test transcription of the meeting."),
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
                      "This meeting covered the quarterly planning session.",
                    keyPoints: [
                      "Discussed Q3 goals and targets",
                      "Reviewed budget allocation",
                      "Assigned action items",
                      "Scheduled follow-up meeting",
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

vi.mock("better-sqlite3", () => ({
  default: vi.fn().mockImplementation(() => ({
    pragma: vi.fn(),
    prepare: vi.fn().mockReturnValue({ run: vi.fn(), all: vi.fn(), get: vi.fn() }),
    exec: vi.fn(),
    close: vi.fn(),
  })),
}));

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

  const db = {
    query: {
      meetings: {
        findFirst: vi.fn().mockImplementation(() =>
          Promise.resolve(mockMeetings[0] ?? null)
        ),
        findMany: vi.fn().mockImplementation(() =>
          Promise.resolve([...mockMeetings])
        ),
      },
      users: {
        findFirst: vi.fn().mockImplementation(() =>
          Promise.resolve(mockUsers[0] ?? null)
        ),
      },
    },
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() => {
          const id = meetingIdCounter++;
          const meeting = {
            id,
            userId: null,
            recorderName: null,
            title: "Test Meeting",
            audioUrl: "/uploads/audio/test.webm",
            audioKey: "audio/test.webm",
            transcription: null,
            summary: null,
            keyPoints: null,
            status: "pending" as const,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          mockMeetings.push(meeting);
          return Promise.resolve([meeting]);
        }),
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
    },
  };

  return { db, schema: {} };
});
