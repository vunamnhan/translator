# Change Request v0.5 — Tóm tắt chunk và chuỗi ngữ cảnh đoạn trước

Bổ sung cho `REQUIREMENTS.md` (v0) và các CR v0.1–v0.4. Mục đích: khi dịch tuần tự, đoạn sau đôi khi mở đầu bất ngờ vì model không biết đoạn trước nói gì. CR này cho mỗi cú gọi dịch trả thêm **tóm tắt ngắn của chunk**, lưu lại, và có tuỳ chọn **bơm tóm tắt chunk trước** vào prompt của chunk kế tiếp. Bật tuỳ chọn đó thì vòng lặp dịch **buộc chạy tuần tự** 1-1.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Cú gọi dịch trả **hai thẻ** `<translation>` + `<summary>` trong cùng một response khi bật | Contract, `llm.ts` |
| 2 | Cột `chunks.summary`, sửa tay được | DB, API, UI |
| 3 | Setting **`chunkSummary`** (tạo tóm tắt chunk) và **`chainPrevSummary`** (gửi kèm tóm tắt chunk trước) | Settings |
| 4 | Chế độ chuỗi: pool = 1, theo idx tăng dần, **dừng khi đứt chuỗi**, có nút "Tiếp tục bất chấp" | Vòng lặp front-end |
| 5 | Prompt tóm tắt chunk nằm trong **preset** (v0.3), có mặc định app | DB `presets`, Settings, tab Prompt |

Ngoài phạm vi: dùng tóm tắt chunk để dựng tóm tắt section (v0.1 vẫn gọi LLM riêng), dịch lại dây chuyền khi tóm tắt đoạn trước đổi, gửi kèm nhiều hơn một đoạn trước, tóm tắt cho luồng tóm tắt section, đưa tóm tắt chunk vào export.

## 2. Quy tắc nghiệp vụ

### 2.1 Tạo tóm tắt chunk (`chunkSummary`)
- Tắt (mặc định): hành vi v0, contract một thẻ, không tạo, không lưu gì.
- Bật: **cùng một cú gọi dịch** yêu cầu trả `<translation>…</translation>` rồi `<summary>…</summary>`. Không gọi riêng.
- Nội dung tóm tắt: theo prompt tóm tắt chunk của preset (mục 2.4). Mặc định app yêu cầu 2–4 câu tiếng Việt: đoạn nói gì, chủ thể / nhân vật đang xuất hiện, và **đoạn kết thúc ở trạng thái nào** (dở câu chuyện, đang liệt kê, vừa đặt câu hỏi…).
- Lưu vào `chunks.summary`, cắt cứng 1 000 ký tự sau trim.
- Xử lý thẻ:
  - Thiếu `<translation>` → retry tối đa 3 lần với reminder như v0 (reminder nhắc **cả hai thẻ**).
  - Có `<translation>`, thiếu `<summary>` → **nhận bản dịch**, `summary = null`, `warning` thêm "Model không trả tóm tắt chunk". **Không retry** vì bản dịch là thứ chính.
  - `<summary>` rỗng sau trim → coi như thiếu.
- Tắt `chunkSummary` khi đã có tóm tắt cũ: giữ nguyên trong DB, không xoá, chỉ không tạo thêm. Dịch lại chunk khi đang tắt → `summary` của chunk đó **giữ nguyên** (không ghi đè bằng null).
- Chunk `skipped` (front matter) không có tóm tắt.

### 2.2 Gửi kèm tóm tắt chunk trước (`chainPrevSummary`)
- Chỉ bật được khi `chunkSummary` bật. Tắt `chunkSummary` thì tự tắt luôn cái này.
- Khi dịch chunk `i`, server tìm **chunk liền trước** theo idx, bỏ qua chunk `skipped`. Gọi là `prev`.
  - `prev` có `status = done` và `summary` khác null → bơm khối `<previous_chunk_summary>` (mục 4.1).
  - `prev` done nhưng `summary` null (dịch từ trước khi bật, hoặc model quên thẻ) → dịch **không** kèm khối, `warning` "Không có tóm tắt đoạn trước".
  - `prev` chưa done (pending / translating / error) → route trả `409 { error: "Chuỗi đứt: chunk #k chưa dịch xong", brokenAt: k }`, **không gọi LLM**, trừ khi client gửi `force: true` (mục 2.3).
  - Không có `prev` (chunk đầu) → dịch bình thường, không khối, không warning.
- Ghi lại `chunks.prev_summary_used` (boolean) để UI biết chunk này dịch có ngữ cảnh đoạn trước hay không.
- Sửa tay `summary` của chunk `i` hoặc dịch lại chunk `i` sau khi chunk `i+1` đã done → chunk `i+1` hiện ⚠ "Tóm tắt đoạn trước đã đổi sau khi dịch" (so `chunks.updated_at` của `prev` với `chunks.updated_at` của chính nó, không lưu thêm cột). Không tự dịch lại dây chuyền.
- "Dịch lại" một chunk lẻ khi chuỗi bật: cũng theo quy tắc trên. `prev` chưa done → hỏi "Chunk trước chưa dịch xong, dịch không kèm ngữ cảnh?" → gửi `force: true`.

### 2.3 Vòng lặp dịch ở chế độ chuỗi
- `chainPrevSummary` bật → `runPool("translate")` **ép pool = 1**, ids sắp theo idx tăng dần, lấy chunk `pending` / `error` như cũ. Concurrency trong Settings vẫn giữ giá trị, chỉ không dùng cho luồng dịch; luồng tóm tắt section không đổi.
- Cool down vẫn áp (CR v0.2 §8.2). UI nhắc ở Settings: "Chuỗi bật → dịch 1-1, thời gian ≈ số chunk × (latency + cool down)".
- Gặp chunk lỗi (LLM lỗi, hết retry, 409 đứt chuỗi): **dừng vòng lặp** ngay tại đó, banner: *"Chuỗi đứt ở #12 — [Dịch lại #12] [Tiếp tục bất chấp]"*.
  - **Dịch lại #12**: chỉ dịch chunk đó; xong thì banner đổi thành [Resume].
  - **Tiếp tục bất chấp**: chạy tiếp từ chunk sau chỗ đứt, **trong lượt chạy này** mọi chunk có `prev` chưa done sẽ gửi `force: true` (dịch không kèm khối, warning "Không có tóm tắt đoạn trước"). Bấm Pause rồi Start lại → về chế độ nghiêm ngặt.
- Chuỗi tắt → vòng lặp như v0.2 (song song, xoay key, cool down), `chunkSummary` bật vẫn tạo tóm tắt cho từng chunk, chỉ không bơm.

### 2.4 Prompt tóm tắt chunk trong preset
- Preset (v0.3) thêm `chunk_summary_prompt` (null = mặc định app `DEFAULT_CHUNK_SUMMARY_PROMPT`). Working copy trong Settings thêm `chunkSummaryPrompt` (rỗng = mặc định app). Quy tắc nạp / lưu / "đã sửa" như 3 prompt hiện có.
- Prompt này **chỉ nói tóm tắt cái gì**, không nói luật thẻ. App tự nối contract hai thẻ khi `chunkSummary` bật.
- Mặc định app:
```
Sau khi dịch, viết thêm phần tóm tắt ngắn của đoạn vừa dịch bằng tiếng Việt, 2–4 câu:
- đoạn nói về gì, chủ thể / nhân vật nào đang xuất hiện;
- đoạn kết thúc ở trạng thái nào (đang dở câu chuyện, đang liệt kê, vừa đặt câu hỏi…).
Chỉ dùng để đoạn kế tiếp hiểu mạch. Không nhận xét, không lặp lại bản dịch.
```
- Seed 3 preset v0.3: `chunk_summary_prompt = null` (dùng mặc định). Preset **Truyện** có thể bổ sung sau câu "nêu cách xưng hô đang dùng giữa các nhân vật".

## 3. Data model (delta)

```
chunks (thêm)
  summary             text     null
  prev_summary_used   boolean  not null default false

presets (thêm)
  chunk_summary_prompt  text   null
```
`jobs`, `sections` không đổi.

Migration `drizzle/0005_chunk_summary.sql`, idempotent: 3 lệnh `ADD COLUMN IF NOT EXISTS`.

## 4. Prompt và contract

### 4.1 Thứ tự system message (mở rộng `runTagged`)
```
[reminder nếu retry]
prompt dịch (preset)
<document_context>…</document_context>              (v0.1, nếu có)
<previous_chunk_summary>…</previous_chunk_summary>   (MỚI, nếu chuỗi bật và prev có tóm tắt)
prompt tóm tắt chunk (preset)                         (MỚI, nếu chunkSummary bật)
output contract                                       (một thẻ hoặc hai thẻ)
```
Khối đoạn trước:
```
<previous_chunk_summary>
{summary của prev}
</previous_chunk_summary>
Đây là tóm tắt đoạn ngay trước đoạn cần dịch, chỉ để hiểu mạch và giữ giọng, xưng hô nhất quán. Không dịch, không lặp lại nội dung này.
```

### 4.2 Contract hai thẻ (`OUTPUT_CONTRACT_WITH_SUMMARY`)
```
QUY TẮC ĐẦU RA BẮT BUỘC:
Trả về đúng hai thẻ, theo thứ tự:
<translation>bản dịch</translation>
<summary>tóm tắt ngắn của đoạn vừa dịch</summary>
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài hai thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.
```
Reminder khi retry: *"NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc bản dịch trong `<translation>` và tóm tắt trong `<summary>`."*

`extractTag` dùng lại cho từng thẻ. Khôi phục code block, validate bảng / URL / ratio (`postProcess`) chỉ chạy trên phần `<translation>`.

## 5. API (delta)

### 5.1 `POST /api/chunks/:id/translate` — body nhận thêm
```
withSummary?:     boolean   // = settings.chunkSummary
usePrevSummary?:  boolean   // = settings.chainPrevSummary
force?:           boolean   // bỏ qua kiểm tra prev chưa done
chunkSummaryPrompt?: string // working copy; rỗng → mặc định app
```
- Phản hồi: chunk DTO thêm `summary`, `prevSummaryUsed`.
- `usePrevSummary` và `prev` chưa done và không `force` → `409 { error, brokenAt }`, chunk **không** đổi status (không ghi `translating`).
- Không `withSummary` → hành vi v0 y nguyên, kể cả contract.

### 5.2 `PATCH /api/chunks/:id` — nhận thêm
`summary?: string | null`. Rỗng → null. Cập nhật `updated_at`.

### 5.3 `presets` (v0.3) — nhận thêm
`GET / POST / PATCH /api/presets` thêm field `chunkSummaryPrompt` (null / ≤ 20 000 ký tự), quy tắc như `contextPrompt`.

Không route mới. `GET /api/jobs/:id` trả chunk kèm 2 cột mới.

## 6. UI

### 6.1 Settings — tab Chung
Dưới cụm Concurrency / Cool down thêm:
- ☐ **Tạo tóm tắt chunk** (`chunkSummary`). Ghi chú: "Cùng cú gọi dịch, trả thêm thẻ `<summary>`, tốn thêm ~100 token output mỗi chunk."
- ☐ **Gửi kèm tóm tắt chunk trước** (`chainPrevSummary`), disable khi cái trên tắt. Ghi chú: "Dịch tuần tự 1-1, bỏ qua Concurrency. Thời gian ≈ số chunk × (latency + cool down)."
- Ô Concurrency hiện mờ + chữ "đang bị ép = 1 (chuỗi)" khi chuỗi bật.

### 6.2 Settings — tab Prompt
Thêm ô thứ tư **Chunk summary prompt (tóm tắt chunk)** sau ô Context prompt, placeholder "Để trống = dùng mặc định app", có "Xem mặc định". Nạp / lưu theo preset như 3 ô kia.

### 6.3 Card chunk (tab Translate)
- Dưới phần Bản dịch thêm hàng gấp mở **"Tóm tắt"**: hiện 1 dòng đầu, bấm mở ra textarea nhỏ, blur lưu qua `PATCH`. Chunk chưa có tóm tắt hiện "(chưa có)" mờ.
- Chip trên bar: `⛓` khi `prevSummaryUsed`, tooltip "Dịch có ngữ cảnh đoạn trước". ⚠ "Tóm tắt đoạn trước đã đổi" theo mục 2.2.
- Warning "Model không trả tóm tắt chunk" / "Không có tóm tắt đoạn trước" hiện chung chỗ warning hiện có.

### 6.4 Header job
- Chuỗi bật: chip **"Chuỗi 1-1"** thay chỗ hiện concurrency.
- Banner đứt chuỗi (mục 2.3) dùng `Banner` hiện có, màu đỏ, hai nút.

### 6.5 Ghi chú cho designer
Không màn hình mới. Thêm: 2 checkbox Settings, 1 textarea tab Prompt, 1 hàng gấp mở trong card chunk, 1 chip `⛓`, 1 biến thể banner có 2 nút.

## 7. Cấu hình (delta Settings, localStorage)

| Key | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `chunkSummary` | boolean | `false` | Tạo tóm tắt chunk trong cú gọi dịch |
| `chainPrevSummary` | boolean | `false` | Bơm tóm tắt chunk trước; ép dịch 1-1. Tự tắt khi `chunkSummary` tắt |
| `chunkSummaryPrompt` | string | `""` | Rỗng = mặc định app. Thuộc working copy preset (v0.3) |

## 8. Tiêu chí hoàn thành

1. `chunkSummary` tắt: request body và system message **y hệt** v0.2 (so raw), không có thẻ summary, cột `summary` không đổi.
2. Bật `chunkSummary`, chuỗi tắt, concurrency 3: dịch 10 chunk song song, mỗi chunk có `summary` ≤ 1 000 ký tự, `prevSummaryUsed = false`.
3. Mock model trả `<translation>` mà không `<summary>`: chunk `done`, `summary = null`, warning đúng chữ, **không** gọi lại LLM.
4. Mock model quên `<translation>`: retry với reminder nhắc hai thẻ, tối đa 3 lần như v0.
5. Bật chuỗi: vòng lặp gọi đúng 1 request tại một thời điểm, theo idx tăng dần, bỏ qua front matter; chunk #1 trở đi có khối `<previous_chunk_summary>` chứa đúng `summary` của chunk trước; `prevSummaryUsed = true`.
6. Chunk #5 lỗi khi chuỗi bật → vòng lặp dừng, #6 vẫn `pending`, banner "Chuỗi đứt ở #5" với hai nút.
7. Bấm "Tiếp tục bất chấp" → #6 dịch với `force: true`, không khối, warning "Không có tóm tắt đoạn trước", các chunk sau chạy tiếp bình thường có khối. Pause rồi Start lại → gặp `prev` lỗi lại dừng.
8. Gọi thẳng `POST /api/chunks/:id/translate` với `usePrevSummary: true` khi prev đang `pending` → 409 kèm `brokenAt`, status chunk không đổi, không có request tới LLM.
9. Sửa tay `summary` của #3 sau khi #4 đã done → #4 hiện ⚠ "Tóm tắt đoạn trước đã đổi"; dịch lại #4 → ⚠ mất.
10. Tắt `chunkSummary` → `chainPrevSummary` tự tắt, ô Concurrency hết mờ; dịch lại một chunk → `summary` cũ giữ nguyên.
11. Preset có `chunk_summary_prompt` → system message dùng prompt đó; null → dùng mặc định app. Tab Prompt nạp / lưu / "đã sửa" đúng cho ô thứ tư.
12. Chạy `0005_chunk_summary.sql` hai lần: không lỗi.
13. `npm test` pass; export bản dịch không chứa tóm tắt chunk.
14. Không có API key trong `summary`, `raw_response` hay log.
