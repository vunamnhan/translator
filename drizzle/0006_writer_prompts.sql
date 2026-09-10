-- CR v0.6 — mẫu prompt của Assistant Writer. Idempotent như 0003: bảng và index
-- IF NOT EXISTS, seed bằng WHERE NOT EXISTS nên chạy lại không nhân đôi và
-- KHÔNG ghi đè mẫu user đã sửa.

CREATE TABLE IF NOT EXISTS "writer_prompts" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"        text NOT NULL,
  "template"    text NOT NULL,
  "fields"      jsonb NOT NULL DEFAULT '{}'::jsonb,
  "temperature" real,
  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- Tên duy nhất không phân biệt hoa thường (CR v0.6 §3.1).
CREATE UNIQUE INDEX IF NOT EXISTS "writer_prompts_name_lower" ON "writer_prompts" (lower("name"));

INSERT INTO "writer_prompts" ("name", "template", "fields", "temperature")
SELECT
  'Dựa vào văn bản viết theo yêu cầu',
  $t$Dựa vào văn bản sau:

{{text}}

Hãy {{yeu_cau}}.
Giọng văn: {{giong_van}}. Viết bằng tiếng Việt, giữ định dạng Markdown.$t$,
  '{"yeu_cau": "viết lại thành bài hoàn chỉnh, đủ ý, mạch lạc", "giong_van": "rõ ràng, trung tính"}'::jsonb,
  0.7
WHERE NOT EXISTS (
  SELECT 1 FROM "writer_prompts" WHERE lower("name") = lower('Dựa vào văn bản viết theo yêu cầu')
);

INSERT INTO "writer_prompts" ("name", "template", "fields", "temperature")
SELECT
  'Viết lại cho rõ',
  $t$Viết lại văn bản sau cho rõ ràng, mạch lạc, giữ nguyên ý và định dạng Markdown. Không thêm ý mới.

{{text}}$t$,
  '{}'::jsonb,
  0.3
WHERE NOT EXISTS (
  SELECT 1 FROM "writer_prompts" WHERE lower("name") = lower('Viết lại cho rõ')
);

INSERT INTO "writer_prompts" ("name", "template", "fields", "temperature")
SELECT
  'Tóm tắt thành outline',
  $t$Đọc văn bản sau và lập outline Markdown (heading + gạch đầu dòng), tối đa {{do_sau}} cấp. Mỗi mục một câu.

{{text}}$t$,
  '{"do_sau": "3"}'::jsonb,
  0.2
WHERE NOT EXISTS (
  SELECT 1 FROM "writer_prompts" WHERE lower("name") = lower('Tóm tắt thành outline')
);

INSERT INTO "writer_prompts" ("name", "template", "fields", "temperature")
SELECT
  'Soạn tài liệu từ ghi chú',
  $t$Bạn là {{vai_tro}}. Từ các ghi chú sau, soạn thành tài liệu Markdown có heading, dành cho {{doc_gia}}.

Ghi chú:
{{ghi_chu}}$t$,
  '{"vai_tro": "technical writer", "doc_gia": "developer mới vào team", "ghi_chu": ""}'::jsonb,
  0.6
WHERE NOT EXISTS (
  SELECT 1 FROM "writer_prompts" WHERE lower("name") = lower('Soạn tài liệu từ ghi chú')
);
