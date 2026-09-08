-- CR v0.2 — tag, archive, pin, favorite trên jobs. Idempotent như 0001.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}';
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "pinned_at" timestamptz;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "favorite" boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "jobs_tags_gin" ON "jobs" USING GIN ("tags");
CREATE INDEX IF NOT EXISTS "jobs_list"
  ON "jobs" ("archived_at", "pinned_at" DESC NULLS LAST, "created_at" DESC);

-- Index trgm cho search tên. Không có extension pg_trgm (hoặc không đủ quyền tạo)
-- thì bỏ qua — ILIKE vẫn chạy, chỉ chậm hơn.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "jobs_name_trgm" ON "jobs" USING GIN ("name" gin_trgm_ops);
EXCEPTION
  WHEN OTHERS THEN RAISE NOTICE 'Bỏ qua jobs_name_trgm: %', SQLERRM;
END
$$;
