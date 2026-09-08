# Change Request v0.1 — Chức năng Tóm tắt

Bổ sung cho `REQUIREMENTS.md` (v0). Mục đích: người dùng đọc tóm tắt từng phân đoạn để có overview trước khi đọc/dịch, đồng thời dùng ngữ cảnh chung để dịch nhất quán hơn.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Thêm đơn vị **Section** (gom nhiều chunk dịch) để tóm tắt | Data model, chunking |
| 2 | Thêm **Tóm tắt chung** (document context + glossary), user sửa được trước khi dùng | Data model, UI, API |
| 3 | Bơm ngữ cảnh chung vào **tóm tắt section** | Prompt, API |
| 4 | Bơm ngữ cảnh chung vào **dịch chunk** (toggle, mặc định bật) | Prompt, API translate, settings |
| 5 | Tab Summary + export `<name>.summary.md` | UI, API |

Tóm tắt và dịch **độc lập**: có thể làm 1 trong 2 hoặc cả 2, thứ tự tuỳ ý. Nhưng để bơm ngữ cảnh thì tóm tắt chung phải có trước.

## 2. Section

### 2.1 Định nghĩa
Section = dải chunk dịch liên tiếp `[chunk_from, chunk_to]`. Không parse lại markdown, chỉ gom từ danh sách chunk có sẵn.

### 2.2 Quy tắc gom
1. Duyệt chunk theo `idx`, gộp cho đến khi tổng vượt `summaryTokens` (mặc định `6000`, cấu hình được) thì đóng section.
2. Chunk bắt đầu bằng heading cấp 1 hoặc 2 → **mở section mới** nếu section hiện tại đã ≥ 30% ngưỡng. Section bám theo cấu trúc tài liệu.
3. `heading` của section = heading đầu tiên trong dải, không có thì `"(đoạn N)"`.
4. Chunk `skipped` (front matter) không đưa vào section.

### 2.3 Re-chunk
- Re-chunk dịch (mục 5.3 v0) → **xoá toàn bộ sections**, gom lại. Tóm tắt section mất theo. Tóm tắt chung giữ nguyên.
- Đổi `summaryTokens` → gom lại sections, hỏi xác nhận nếu đã có tóm tắt section.

## 3. Tóm tắt chung (Document Context)

### 3.1 Input gửi LLM
- Tài liệu ≤ `contextMaxTokens` (mặc định `80000`, cấu hình được): gửi **nguyên văn** toàn bộ.
- Vượt ngưỡng: gửi **skeleton** = với mỗi section, lấy heading + N ký tự đầu (N tính để tổng vừa ngưỡng, tối thiểu 300 ký tự/section). Kèm ghi chú trong prompt là tài liệu bị rút gọn.

### 3.2 Output
Một call, contract thẻ `<context>`. Nội dung yêu cầu prompt trả về theo khung cố định:

```
## Tổng quan
(3–6 câu: tài liệu nói về gì, cho ai, giọng văn)

## Cấu trúc
(outline ngắn các phần chính)

## Thuật ngữ
- term gốc → cách dịch / giữ nguyên
- ...
```

Khung này để người đọc sửa dễ, không parse máy. Toàn bộ text lưu vào `jobs.context`.

### 3.3 Sửa trước khi dùng
- Hiển thị textarea, user sửa tự do, bấm Save → `jobs.context_edited = true`.
- Nút **Tóm tắt các section** và toggle bơm ngữ cảnh vào dịch **chỉ bật khi `jobs.context` không rỗng**.
- Tạo lại tóm tắt chung khi đã sửa → hỏi xác nhận, ghi đè.

## 4. Bơm ngữ cảnh

Cùng một block cho cả hai luồng, đặt trong system prompt **sau** prompt user, **trước** output contract:

```
<document_context>
{jobs.context}
</document_context>
Dùng ngữ cảnh trên để hiểu tài liệu và giữ thuật ngữ nhất quán. Chỉ xử lý nội dung trong <source>.
```

| Luồng | Điều kiện bơm |
|---|---|
| Tóm tắt section | Luôn bơm (bắt buộc có context mới chạy được) |
| Dịch chunk | Bơm khi `useContextForTranslation = true` (mặc định `true`) **và** `jobs.context` không rỗng. Rỗng thì dịch như v0, không báo lỗi |

Chunk đã dịch trước khi có context **không tự dịch lại**. User bấm Re-translate nếu muốn.

## 5. Tóm tắt section

### 5.1 API `/api/sections/:id/summarize`
1. Ghép source của `chunk_from..chunk_to` (dùng `source_override` nếu có).
2. Messages: `summaryPrompt` + document_context block + contract thẻ `<summary>`; user message `<source>...</source>`.
3. Parse, retry, backoff, lưu `raw_response` giống mục 6.2 v0. Không có bước khôi phục code block hay validate tỉ lệ.
4. Lưu `summary`, `status`, `error`, `attempts`.

### 5.2 Prompt tóm tắt mặc định (sửa được)
```
Tóm tắt đoạn văn bản Markdown sau bằng tiếng Việt, 3–5 gạch đầu dòng.
Nêu ý chính, kết luận, con số hoặc quyết định quan trọng nếu có.
Không diễn giải thêm, không nhận xét.
```

### 5.3 Vòng lặp
Front-end, cùng cơ chế pool và Start / Pause / Resume như dịch. Cùng slider concurrency. Không chạy đồng thời với vòng lặp dịch (1 vòng lặp active tại một thời điểm, cho đơn giản).

## 6. Data model (delta)

```
jobs (thêm)
  context            text null
  context_edited     bool default false
  summary_tokens     int default 6000
  context_max_tokens int default 80000

sections (mới)
  id            uuid pk
  job_id        uuid fk → jobs (cascade delete)
  idx           int
  heading       text
  chunk_from    int
  chunk_to      int
  summary       text null
  status        text     -- pending | summarizing | done | error
  error         text null
  raw_response  text null
  attempts      int default 0
  updated_at    timestamptz
  unique (job_id, idx)
```

## 7. Cấu hình (delta, localStorage)

| Key | Mặc định |
|---|---|
| `summaryPrompt` | mục 5.2 |
| `summaryTokens` | `6000` |
| `contextMaxTokens` | `80000` |
| `useContextForTranslation` | `true` |

## 8. API routes (delta)

| Method | Route | Việc |
|---|---|---|
| `POST` | `/api/jobs/:id/context` | Header `x-llm-key`. Gọi LLM tạo tóm tắt chung (nguyên văn hoặc skeleton). Lưu `jobs.context` |
| `PATCH` | `/api/jobs/:id/context` | Body `{context}` → lưu bản user sửa |
| `POST` | `/api/jobs/:id/resection` | Body `{summaryTokens}` → gom lại sections |
| `GET` | `/api/jobs/:id/sections` | Danh sách section |
| `POST` | `/api/sections/:id/summarize` | Mục 5.1 |
| `PATCH` | `/api/sections/:id` | Sửa `summary` tay / reset `pending` |
| `GET` | `/api/jobs/:id/export-summary` | Trả `.md`: context ở đầu, rồi `## {heading}` + summary từng section theo `idx` |

`GET /api/jobs/:id` trả thêm `context`, `sections`.
`POST /api/chunks/:id/translate` nhận thêm `useContext: boolean`.

## 9. UI (delta)

Trang `/job/:id` thêm tab **Summary** cạnh tab **Translate**.

**Tab Summary**, từ trên xuống:
1. Khối **Ngữ cảnh chung**: textarea + nút *Tạo tóm tắt chung* / *Tạo lại*, nút *Save*, badge "đã sửa tay" nếu `context_edited`. Hiện ghi chú "tài liệu dài, dùng skeleton" khi rơi vào trường hợp đó.
2. Thanh công cụ section: tiến độ `done/total`, Start / Pause / Resume, Re-summarize errors, nút *Export summary*. Disabled khi chưa có context.
3. Danh sách section dạng outline: heading, badge status, summary (textarea sửa được), nút Re-summarize, link **"→ chunk 12–18"** chuyển sang tab Translate và scroll tới chunk đó.

**Tab Translate**: thêm toggle *Dùng ngữ cảnh chung* trong panel Settings, kèm nhắc "chưa có ngữ cảnh chung" nếu context rỗng.

**Export summary**: modal text block + Copy + Download `<name>.summary.md`, giống export dịch.

## 10. Tiêu chí hoàn thành (bổ sung)

1. Job 100 chunk → gom ra section bám heading, mỗi section ≤ ngưỡng, không sót chunk nào (trừ skipped).
2. Tài liệu vượt `contextMaxTokens` → gọi bằng skeleton, không lỗi context length.
3. Sửa context tay → tóm tắt section và dịch sau đó dùng đúng bản đã sửa (kiểm tra bằng log payload gửi LLM).
4. Tắt toggle → payload dịch không chứa `<document_context>`.
5. Re-chunk dịch → sections xoá và gom lại, context giữ nguyên.
6. Export summary đúng thứ tự, có heading từng section.
