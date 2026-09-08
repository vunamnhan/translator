# Tranzlator — context cho Claude

Tool nội bộ dịch + tóm tắt Markdown bằng LLM (bring-your-own-key). Spec gốc: `document/REQUIREMENTS.md`, delta v0.1 (Tóm tắt): `document/CR-v0.1-summary.md`, delta v0.2 (tag/search/paging/archive/pin/favorite + nhiều key + cool down): `document/CR-v0.2-jobs-list.md` — đọc trước khi sửa logic. Giao diện hiện tại mô tả ở `document/UI-SPEC-current.md`, design gốc ở `document/UI Tranzlator/Tranzlator.dc.html`.

## Stack
Next.js 15 App Router + TypeScript, Tailwind, Postgres + Drizzle (`postgres-js`), remark/mdast để parse MD. Deploy Vercel.

## Ràng buộc bất di bất dịch
- `concat(chunks.source) === original` — có test ở `tests/chunker.test.ts`. Đụng vào chunker phải chạy `npm test`.
- Code block trong output phải **byte-identical** với gốc (`restoreCodeBlocks`).
- API key: chỉ qua header `x-llm-key`, **không** lưu DB, không log.
- Vòng lặp dịch **và** vòng lặp tóm tắt đều nằm ở front-end (`src/components/JobView.tsx`), dùng chung `runPool`. Server không loop/queue/cron; mỗi API call = 1 chunk / 1 section. Chỉ 1 vòng lặp active tại một thời điểm.
- Ngữ cảnh chung (`jobs.context`) bơm vào system prompt **sau** prompt user, **trước** output contract — xem `documentContextBlock` trong `src/lib/defaults.ts`.
- Xoay key + cool down nằm ở front-end. Server vẫn nhận đúng 1 key qua `x-llm-key` mỗi request, không biết gì về vòng xoay.
- Chỉ light mode. Design không có palette tối nên đừng thêm lại `dark:`.
- Responsive chỉ có **một mốc 1024px** và làm **hoàn toàn bằng CSS**: cùng một cây DOM ở mọi khổ, không `useMediaQuery`, không render hai nhánh markup. Class đổi bố cục (`.pane-list`, `.action-dock`, `.sheet`) nằm ở `globals.css` — sửa ở đó, đừng rải `lg:` mới vào component.

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
| `src/lib/settingsStore.ts` | Store settings dùng chung (useSyncExternalStore). Không quay lại useState-per-component: key nhập ở header sẽ không tới được JobView. Cũng là chỗ chuyển `apiKey` (v0.1) sang `apiKeys[]` (v0.2) |
| `src/lib/runner.ts` | Xoay key round-robin, nhận diện 429, cool down cắt được giữa chừng |
| `src/lib/tags.ts` | Chuẩn hoá tag (trim, gộp trùng không phân biệt hoa thường, 32 ký tự, 20 tag) |
| `src/lib/modelHistory.ts` | Lịch sử model đã dùng cho gợi ý ở ô Model (localStorage riêng, không nằm trong settings) |
| `src/lib/readingSize.ts` | Cỡ chữ khung đọc, lưu localStorage, dùng chung 2 tab |
| `src/lib/readMode.ts` | Chế độ đọc của mobile: nút ở `AppHeader`, thứ bị giấu ở `JobView` nên phải là store. Cố ý không lưu localStorage |
| `src/components/JobList.tsx` | Trang Jobs: search + lọc tag + favorite + archive + phân trang, state nằm trên URL query |
| `src/components/chrome.tsx` | Thanh tiến độ, banner, panel danh sách trái, khung đọc (`ReadingPane`). Panel danh sách dưới 1024px là sheet đáy — state `listOpen` ở `JobView`, CSS quyết định nó có nghĩa hay không |
| `src/app/globals.css` + `tailwind.config.ts` | Token của design. Đổi màu/bo/shadow ở globals, đừng rải hex trong component |

## Chạy
Chạy `npm run build` rồi quay lại `npm run dev` sẽ vỡ `.next` (`Cannot find module './xxx.js'`) — dùng `npm run dev:clean`.

`npm run dev` (cần `DATABASE_URL`), `npm test`. Schema init: chạy lần lượt `drizzle/0000_init.sql`, `drizzle/0001_summary.sql` (delta CR v0.1: cột context/summary trên `jobs` + bảng `sections`), `drizzle/0002_jobs_list.sql` (delta CR v0.2: tags/archived_at/pinned_at/favorite + index). 0001 và 0002 idempotent nên DB cũ chạy thẳng được.

Viết subquery trong route `GET /api/jobs` phải ghi thẳng `"jobs"."id"`: select một bảng thì drizzle render cột thành `"id"` không có tiền tố, vào trong subquery lại trỏ nhầm sang `"chunks"."id"` và đếm ra 0.
