import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("open_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  lastSignedIn: integer("last_signed_in", { mode: "timestamp" }),
});

export const meetings = sqliteTable("meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  recorderName: text("recorder_name"),
  title: text("title").notNull(),
  audioUrl: text("audio_url").notNull(),
  audioKey: text("audio_key").notNull(),
  transcription: text("transcription"),
  summary: text("summary"),
  keyPoints: text("key_points", { mode: "json" }).$type<string[]>(),
  status: text("status", { enum: ["pending", "processing", "done", "error"] })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  meetings: many(meetings),
}));

export const meetingsRelations = relations(meetings, ({ one }) => ({
  user: one(users, {
    fields: [meetings.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
