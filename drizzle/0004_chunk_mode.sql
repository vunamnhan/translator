-- CR v0.4 — ghi lại quy tắc đã cắt chunk của job. Idempotent như 0001–0003.
-- Job cũ mặc định 'auto', đúng thực tế: trước v0.4 chỉ có một cách cắt.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "chunk_mode" text NOT NULL DEFAULT 'auto';
