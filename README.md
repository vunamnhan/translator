# Tranzlator

Quick and diry tool nội bộ dịch tài liệu Markdown bằng LLM, bring-your-own-key. Spec: [REQUIREMENTS.md](REQUIREMENTS.md).

## Chạy local

```bash
npm install
cp .env.example .env        # điền DATABASE_URL
psql "$DATABASE_URL" -f drizzle/0000_init.sql   # hoặc: npm run db:push
npm run dev
```

Mở http://localhost:3000 → đăng nhập (nếu có `ADMIN_PASSWORD`) → New job → upload `.md` hoặc paste text → Settings nhập API key → Start.

## Biến môi trường

| Env | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | có | Postgres (Neon / Vercel Postgres) |
| `ADMIN_PASSWORD` | không | Mật khẩu trang `/login`. Bỏ trống = không auth |
| `ALLOW_HTTP_ENDPOINT` | không | `1` để cho phép endpoint `http://` (Ollama local) |

API key của LLM **không** nằm trong env: lưu ở `localStorage` của trình duyệt, gửi kèm mỗi request qua header `x-llm-key`, server không log và không lưu.

## Kiến trúc

- `src/lib/chunker.ts` — cắt MD theo block cấp 1, giữ invariant `concat(chunks.source) === original`.
- `src/lib/llm.ts` — gọi endpoint OpenAI-compatible, retry thẻ `<translation>` (3 lần) + backoff HTTP 2/4/8s.
- `src/lib/postprocess.ts` — khôi phục code block gốc, validate bảng/URL/ratio → `warning`.
- `src/lib/assemble.ts` — ghép export, chunk chưa dịch giữ source + `<!-- UNTRANSLATED -->`.
- `src/components/JobView.tsx` — vòng lặp dịch nằm ở **front-end**: pool theo `concurrency`, Start/Pause/Resume. Server không queue, không cron.

## Test

```bash
npm test
```

## Deploy Vercel

1. Import repo, set env như bảng trên.
2. Chạy `drizzle/0000_init.sql` một lần trên DB.
3. Route `/api/chunks/:id/translate` có `maxDuration = 300`; timeout mỗi call LLM là 120s.

## Smoke test không cần API key thật

```bash
node scripts/mock-llm.mjs &                     # mock LLM ở http://localhost:9899/v1
DATABASE_URL=... ALLOW_HTTP_ENDPOINT=1 npx next dev -p 3010 &
node scripts/smoke.mjs                          # chạy full luồng qua API và in kết quả
```

Mock cố tình "dịch sai" code block và quên thẻ `<translation>` ở chunk chứa `FORCE_NOTAG`,
để kiểm tra khôi phục code block + retry + trạng thái `error`.
