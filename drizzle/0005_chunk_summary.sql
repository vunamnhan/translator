-- CR v0.5 — tóm tắt chunk + chuỗi ngữ cảnh đoạn trước. Idempotent như 0001–0004.
-- Chunk cũ: summary NULL (chưa từng tạo), prev_summary_used false (dịch không kèm ngữ cảnh).
-- Preset cũ: chunk_summary_prompt NULL = dùng DEFAULT_CHUNK_SUMMARY_PROMPT của app.

ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "summary" text;
ALTER TABLE "chunks" ADD COLUMN IF NOT EXISTS "prev_summary_used" boolean NOT NULL DEFAULT false;
ALTER TABLE "presets" ADD COLUMN IF NOT EXISTS "chunk_summary_prompt" text;
