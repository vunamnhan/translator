# Tranzlator — context cho Claude

Tool nội bộ dịch Markdown bằng LLM (bring-your-own-key). Spec gốc: `REQUIREMENTS.md` — đọc trước khi sửa logic.

## Stack
Next.js 15 App Router + TypeScript, Tailwind, Postgres + Drizzle (`postgres-js`), remark/mdast để parse MD. Deploy Vercel.

## Ràng buộc bất di bất dịch
- `concat(chunks.source) === original` — có test ở `tests/chunker.test.ts`. Đụng vào chunker phải chạy `npm test`.
- Code block trong output phải **byte-identical** với gốc (`restoreCodeBlocks`).
- API key: chỉ qua header `x-llm-key`, **không** lưu DB, không log.
- Vòng lặp dịch nằm ở front-end (`src/components/JobView.tsx`). Server không loop/queue/cron; mỗi API call = 1 chunk.

## Bản đồ file
| File | Việc |
|---|---|
| `src/lib/chunker.ts` | Cắt MD theo block cấp 1 + tách block quá dài theo câu |
| `src/lib/md.ts` | Wrapper remark: block offset, code block, table shape, URL |
| `src/lib/llm.ts` | Gọi endpoint OpenAI-compatible, retry thẻ + backoff |
| `src/lib/postprocess.ts` | Khôi phục code block, validate bảng/URL/ratio |
| `src/lib/assemble.ts` | Ghép export |
| `src/app/api/**` | 9 route theo mục 9 của spec |
| `src/components/JobView.tsx` | Màn hình job: pool concurrency, Start/Pause/Resume |
| `src/middleware.ts` | Auth cookie + redirect `/login`. **Phải nằm trong `src/`** vì project dùng src dir — để ở root là Next bỏ qua, không báo lỗi |
| `src/lib/settingsStore.ts` | Store settings dùng chung (useSyncExternalStore). Không quay lại useState-per-component: key nhập ở header sẽ không tới được JobView |

## Chạy
Chạy `npm run build` rồi quay lại `npm run dev` sẽ vỡ `.next` (`Cannot find module './xxx.js'`) — dùng `npm run dev:clean`.

`npm run dev` (cần `DATABASE_URL`), `npm test`, schema init bằng `drizzle/0000_init.sql`.
