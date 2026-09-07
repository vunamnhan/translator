CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "source" text NOT NULL,
  "system_prompt" text NOT NULL,
  "model" text NOT NULL,
  "endpoint" text NOT NULL,
  "chunk_tokens" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chunks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "idx" integer NOT NULL,
  "source" text NOT NULL,
  "source_override" text,
  "translated" text,
  "status" text NOT NULL DEFAULT 'pending',
  "warning" text,
  "error" text,
  "raw_response" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "edited" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "chunks_job_idx" ON "chunks" ("job_id", "idx");
CREATE INDEX IF NOT EXISTS "chunks_job" ON "chunks" ("job_id");
