import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  source: text("source").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  model: text("model").notNull(),
  endpoint: text("endpoint").notNull(),
  chunkTokens: integer("chunk_tokens").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    source: text("source").notNull(),
    sourceOverride: text("source_override"),
    translated: text("translated"),
    status: text("status").notNull().default("pending"),
    warning: text("warning"),
    error: text("error"),
    rawResponse: text("raw_response"),
    attempts: integer("attempts").notNull().default(0),
    edited: boolean("edited").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chunks_job_idx").on(t.jobId, t.idx), index("chunks_job").on(t.jobId)]
);

export type Job = typeof jobs.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
