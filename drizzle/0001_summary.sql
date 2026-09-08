ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "context" text;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "context_edited" boolean NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "summary_tokens" integer NOT NULL DEFAULT 6000;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "context_max_tokens" integer NOT NULL DEFAULT 80000;

CREATE TABLE IF NOT EXISTS "sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "idx" integer NOT NULL,
  "heading" text NOT NULL,
  "chunk_from" integer NOT NULL,
  "chunk_to" integer NOT NULL,
  "summary" text,
  "status" text NOT NULL DEFAULT 'pending',
  "error" text,
  "raw_response" text,
  "attempts" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "sections_job_idx" ON "sections" ("job_id", "idx");
CREATE INDEX IF NOT EXISTS "sections_job" ON "sections" ("job_id");
