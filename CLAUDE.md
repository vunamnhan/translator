# Tranzlator — context cho Claude

Tool nội bộ dịch + tóm tắt Markdown bằng LLM (bring-your-own-key). Spec gốc: `document/REQUIREMENTS.md`, delta v0.1 (chức năng Tóm tắt): `document/CR-v0.1-summary.md` — đọc trước khi sửa logic.

## Stack
Next.js 15 App Router + TypeScript, Tailwind, Postgres + Drizzle (`postgres-js`), remark/mdast để parse MD. Deploy Vercel.

## Ràng buộc bất di bất dịch
- `concat(chunks.source) === original` — có test ở `tests/chunker.test.ts`. Đụng vào chunker phải chạy `npm test`.
- Code block trong output phải **byte-identical** với gốc (`restoreCodeBlocks`).
- API key: chỉ qua header `x-llm-key`, **không** lưu DB, không log.
- Vòng lặp dịch **và** vòng lặp tóm tắt đều nằm ở front-end (`src/components/JobView.tsx`), dùng chung `runPool`. Server không loop/queue/cron; mỗi API call = 1 chunk / 1 section. Chỉ 1 vòng lặp active tại một thời điểm.
- Ngữ cảnh chung (`jobs.context`) bơm vào system prompt **sau** prompt user, **trước** output contract — xem `documentContextBlock` trong `src/lib/defaults.ts`.

## Bản đồ file
| File | Việc |
|---|---|
| `src/lib/chunker.ts` | Cắt MD theo block cấp 1 + tách block quá dài theo câu |
| `src/lib/sectioner.ts` | Gom chunk thành section để tóm tắt + dựng skeleton cho ngữ cảnh chung |
| `src/lib/sectionStore.ts` | Xoá + gom lại sections trong DB (dùng chung cho rechunk / resection / tạo job) |
| `src/lib/md.ts` | Wrapper remark: block offset, code block, table shape, URL |
| `src/lib/llm.ts` | Gọi endpoint OpenAI-compatible, retry thẻ + backoff. `runTagged` dùng chung cho `translate` / `summarize` / `buildContext` |
| `src/lib/postprocess.ts` | Khôi phục code block, validate bảng/URL/ratio |
| `src/lib/assemble.ts` | Ghép export bản dịch (`assembleMarkdown`) và export tóm tắt (`assembleSummary`) |
| `src/app/api/**` | 9 route theo mục 9 spec v0 + 7 route theo mục 8 CR v0.1 |
| `src/components/JobView.tsx` | Màn hình job: 2 tab Translate/Summary, pool concurrency, Start/Pause/Resume cho cả 2 luồng |
| `src/components/SummaryView.tsx` | Tab Summary: khối ngữ cảnh chung + toolbar section + danh sách section |
| `src/middleware.ts` | Auth cookie + redirect `/login`. **Phải nằm trong `src/`** vì project dùng src dir — để ở root là Next bỏ qua, không báo lỗi |
| `src/lib/settingsStore.ts` | Store settings dùng chung (useSyncExternalStore). Không quay lại useState-per-component: key nhập ở header sẽ không tới được JobView |

## Chạy
Chạy `npm run build` rồi quay lại `npm run dev` sẽ vỡ `.next` (`Cannot find module './xxx.js'`) — dùng `npm run dev:clean`.

`npm run dev` (cần `DATABASE_URL`), `npm test`. Schema init: chạy `drizzle/0000_init.sql` rồi `drizzle/0001_summary.sql` (0001 là delta CR v0.1: cột context/summary trên `jobs` + bảng `sections`; idempotent nên DB cũ chạy thẳng được).
