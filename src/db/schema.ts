import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  real,
  jsonb,
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
  context: text("context"),
  contextEdited: boolean("context_edited").notNull().default(false),
  summaryTokens: integer("summary_tokens").notNull().default(6000),
  contextMaxTokens: integer("context_max_tokens").notNull().default(80000),
  /** CR v0.2 — tổ chức danh sách job. */
  tags: text("tags").array().notNull().default([]),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  favorite: boolean("favorite").notNull().default(false),
  /** CR v0.4 — 'auto' | 'heading' | 'blank' | 'marker' | 'manual'. Chỉ để hiện chip + cảnh báo Rechunk. */
  chunkMode: text("chunk_mode").notNull().default("auto"),
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
    /** CR v0.5 — tóm tắt ngắn của chunk, do chính cú gọi dịch trả về. Sửa tay được. */
    summary: text("summary"),
    /** CR v0.5 — lần dịch gần nhất có kèm khối <previous_chunk_summary> hay không. */
    prevSummaryUsed: boolean("prev_summary_used").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("chunks_job_idx").on(t.jobId, t.idx), index("chunks_job").on(t.jobId)]
);

export const sections = pgTable(
  "sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    heading: text("heading").notNull(),
    chunkFrom: integer("chunk_from").notNull(),
    chunkTo: integer("chunk_to").notNull(),
    summary: text("summary"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    rawResponse: text("raw_response"),
    attempts: integer("attempts").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sections_job_idx").on(t.jobId, t.idx), index("sections_job").on(t.jobId)]
);

/** CR v0.3 — bộ prompt đặt tên, dùng chung cho mọi trình duyệt mở tool. */
export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  translatePrompt: text("translate_prompt").notNull(),
  summaryPrompt: text("summary_prompt").notNull(),
  /** null / rỗng = dùng CONTEXT_PROMPT cố định của app. */
  contextPrompt: text("context_prompt"),
  /** CR v0.5 — null / rỗng = dùng DEFAULT_CHUNK_SUMMARY_PROMPT của app. */
  chunkSummaryPrompt: text("chunk_summary_prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** CR v0.6 — mẫu prompt của Assistant Writer. Không dính gì tới jobs / presets. */
export const writerPrompts = pgTable("writer_prompts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Có `{{placeholder}}`; app điền ở front-end, server không parse. */
  template: text("template").notNull(),
  /** Giá trị mặc định của từng placeholder. Key `text` bị bỏ khi lưu. */
  fields: jsonb("fields").$type<Record<string, string>>().notNull().default({}),
  /** null = dùng temperature trong Settings. */
  temperature: real("temperature"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobs.$inferSelect;
export type Chunk = typeof chunks.$inferSelect;
export type Section = typeof sections.$inferSelect;
export type Preset = typeof presets.$inferSelect;
export type WriterPrompt = typeof writerPrompts.$inferSelect;
