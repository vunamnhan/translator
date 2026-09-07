# Tranzlator — Tài liệu yêu cầu (v1, quick & dirty)

Tool nội bộ dịch tài liệu Markdown bằng LLM theo kiểu bring-your-own-key. Không auth, admin tự quản.

## 1. Mục tiêu

- Upload 1 file `.md` hoặc nhập text vào một ô input → app chunk theo cấu trúc → gọi LLM dịch từng chunk (song song có giới hạn) → ghép lại thành file `.md` đã dịch.
- Người dùng sửa được system prompt, chỉnh ngưỡng chunk, sửa tay chunk và dịch lại từng chunk.
- State lưu Postgres để reload/mất mạng không mất tiến độ, resume được.

## 2. Ngoài phạm vi v1

- Auth / multi-user / phân quyền.
- Anthropic Messages API hay endpoint khác ngoài chuẩn OpenAI `/v1/chat/completions`.
- Gửi kèm chunk trước làm ngữ cảnh (dịch độc lập từng chunk).
- Output song ngữ. Chỉ xuất bản dịch.
- Định dạng khác `.md` (docx, pdf...).
- Tự động dọn job cũ. Admin xoá tay.

## 3. Stack

| Thành phần | Chọn |
|---|---|
| Framework | Next.js (App Router, TypeScript), deploy Vercel |
| UI | Tailwind, không cần component lib nặng |
| DB | Postgres (Neon / Vercel Postgres) + Drizzle ORM |
| Parse MD | `remark` / `mdast` để lấy block node + offset, cắt trực tiếp từ source string (không re-serialize, giữ nguyên bytes gốc) |
| LLM | Bất kỳ endpoint OpenAI-compatible (OpenAI, OpenRouter, Groq, DeepSeek, Ollama, vLLM...) |

## 4. Cấu hình (client-side, lưu `localStorage`)

| Key | Mặc định | Ghi chú |
|---|---|---|
| `endpoint` | `https://api.openai.com/v1` | Base URL, app tự nối `/chat/completions` |
| `apiKey` | rỗng | **Không bao giờ lưu server**. Gửi kèm mỗi request qua header `x-llm-key` |
| `model` | `gpt-4o-mini` | Text input tự do |
| `temperature` | `0.2` | |
| `systemPrompt` | prompt mặc định (mục 7) | Textarea, sửa on-the-fly |
| `chunkTokens` | `1500` | Ngưỡng gộp chunk, ước lượng `chars / 4`. Sửa được on-the-fly, xem mục 5.3 |
| `concurrency` | `3` | Slider 2–6 |

Cấu hình job (systemPrompt, model, chunkTokens, endpoint) được **snapshot vào DB** khi tạo job để restore đúng. API key thì không.

## 5. Chunking

### 5.1 Quy tắc

1. Parse MD thành danh sách **block node cấp 1** (heading, paragraph, list, table, code, blockquote, html, thematicBreak...). Mỗi block giữ `[start, end]` offset trong source gốc.
2. **Gộp** các block liên tiếp cho đến khi vượt `chunkTokens` thì đóng chunk. Không bao giờ cắt giữa 1 block.
3. Block **đơn lẻ vượt ngưỡng** (1 paragraph siêu dài): cắt tiếp theo câu (`. ` / `\n`) tới ngưỡng. Table và code block **không bao giờ cắt**, dù vượt ngưỡng.
4. **Heading** ưu tiên mở chunk mới nếu chunk hiện tại đã ≥ 50% ngưỡng (để chunk bám theo section).
5. Whitespace / dòng trống giữa các block giữ nguyên trong chunk để ghép lại ra đúng file gốc: `concat(chunks.source) === original`. Đây là **invariant bắt buộc**, có test.

### 5.2 Loại nội dung

| Loại | Xử lý |
|---|---|
| Code block (fenced / indented) | Gửi kèm lên LLM để nắm ngữ cảnh, prompt yêu cầu giữ nguyên. **Khi ghép ngược, app thay code block trong bản dịch bằng code block gốc từ source** (match theo thứ tự). Số code block gốc ≠ số trong bản dịch → chunk flag `warning`. |
| Table | Dịch nội dung cell, giữ nguyên cấu trúc `\|`. Validate: số dòng và số cột khớp gốc, lệch → flag `warning`. |
| Link / image | Dịch text hiển thị, giữ nguyên URL. Validate: số URL khớp, lệch → flag `warning`. |
| Front matter YAML | Chunk riêng, không dịch (`status = skipped`). |
| HTML inline/block | Gửi kèm, yêu cầu giữ tag. |

### 5.3 Re-chunk on-the-fly

- Đổi `chunkTokens` khi job **chưa có chunk nào dịch xong** → re-chunk ngay, không hỏi.
- Đã có chunk dịch xong → hỏi xác nhận, re-chunk sẽ **xoá toàn bộ bản dịch** của job. Không hỗ trợ merge.

## 6. Luồng dịch

### 6.1 Vòng lặp (front-end)

```
pool = concurrency
for chunk in chunks where status in (pending, error):
    await slot
    POST /api/chunks/:id/translate  (kèm key, endpoint, model, prompt)
    update UI theo response
```

- Front-end giữ vòng lặp, **server không loop, không queue, không cron**. Mỗi API call = 1 chunk = 1 LLM call (có retry nội bộ).
- Nút **Start / Pause / Resume**. Pause = ngừng lấy chunk mới, call đang chạy chạy hết.
- Reload trang → load job từ DB → chunk `pending`/`error` bấm Resume chạy tiếp.
- Timeout mỗi call: 120s (dưới giới hạn Vercel function).

### 6.2 API `/api/chunks/:id/translate`

1. Đọc chunk source (hoặc `sourceOverride` nếu user đã sửa).
2. Build messages:
   - `system`: `systemPrompt` của user **+ output contract cố định** (mục 7).
   - `user`: `<source>\n{chunk}\n</source>`
3. Gọi endpoint OpenAI-compatible, `stream: false`.
4. Parse: lấy nội dung trong `<translation>...</translation>` (regex, lấy cặp đầu tiên, `dotall`). Trim 1 newline đầu/cuối.
5. Không thấy thẻ → retry, tối đa **3 lần**, lần sau prepend nhắc nhở "Bạn quên thẻ". Vẫn fail → `status = error`, lưu raw response để user xem.
6. Hậu xử lý: khôi phục code block gốc, validate table/link (mục 5.2), tính `ratio = len(translated) / len(source)`. `ratio > 3` hoặc `< 0.3` → `warning`.
7. Lưu `translated`, `status`, `warning`, `attempts`, `rawResponse` (lần cuối), `error`.
8. Lỗi HTTP 429 / 5xx từ LLM → retry với backoff 2s, 4s, 8s. 401 → fail ngay, không retry.

### 6.3 Trạng thái chunk

```
pending → translating → done
                     ↘ error
done / error → (user sửa hoặc bấm re-translate) → pending
```

Thêm cờ `warning: string | null` độc lập với status, và `edited: boolean` khi user sửa tay bản dịch.

## 7. Prompt

**System prompt mặc định (user sửa được):**

```
Bạn là dịch giả chuyên nghiệp. Dịch văn bản Markdown sau sang tiếng Việt.
Yêu cầu:
- Giữ nguyên cấu trúc Markdown: heading, list, bảng, link, hình, code block, inline code.
- Không dịch nội dung trong code block và inline code. Không dịch URL.
- Giữ nguyên thuật ngữ kỹ thuật phổ biến bằng tiếng Anh.
- Dịch tự nhiên, không dịch máy móc từng từ.
```

**Output contract (app tự nối vào cuối system prompt, user không sửa được):**

```
QUY TẮC ĐẦU RA BẮT BUỘC:
Chỉ trả về bản dịch, bọc trong thẻ <translation></translation>.
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài thẻ.
Văn bản nguồn nằm trong thẻ <source></source>.
```

## 8. Data model (Postgres, Drizzle)

```
jobs
  id            uuid pk
  name          text            -- tên file upload
  source        text            -- md gốc, nguyên bytes
  system_prompt text            -- snapshot lúc tạo
  model         text
  endpoint      text            -- base URL, không có key
  chunk_tokens  int
  created_at    timestamptz
  updated_at    timestamptz

chunks
  id              uuid pk
  job_id          uuid fk → jobs (cascade delete)
  idx             int             -- thứ tự ghép
  source          text            -- slice gốc
  source_override text null       -- user sửa nguồn để dịch lại
  translated      text null
  status          text            -- pending | translating | done | error | skipped
  warning         text null
  error           text null
  raw_response    text null
  attempts        int default 0
  edited          bool default false
  updated_at      timestamptz
  unique (job_id, idx)
```

Không lưu API key ở bất kỳ bảng nào. Không log key.

## 9. API routes

| Method | Route | Việc |
|---|---|---|
| `GET` | `/api/jobs` | List job (id, name, created_at, tiến độ done/total) |
| `POST` | `/api/jobs` | Body: `{name, source, systemPrompt, model, endpoint, chunkTokens}` → chunk + tạo job, trả job + chunks |
| `GET` | `/api/jobs/:id` | Job + toàn bộ chunks |
| `POST` | `/api/jobs/:id/rechunk` | Body `{chunkTokens}` → xoá chunks, chunk lại |
| `PATCH` | `/api/jobs/:id` | Sửa `system_prompt`, `model`, `endpoint` |
| `DELETE` | `/api/jobs/:id` | Xoá job + chunks |
| `GET` | `/api/jobs/:id/export` | Trả `.md` ghép: `done` → translated, `skipped` → source, còn lại → source + marker `<!-- UNTRANSLATED -->` |
| `POST` | `/api/chunks/:id/translate` | Header `x-llm-key`. Body `{endpoint, model, systemPrompt, temperature}`. Mục 6.2 |
| `PATCH` | `/api/chunks/:id` | Sửa `source_override` / `translated` / reset `status = pending` |

## 10. UI

### 10.1 Trang `/` — danh sách job
- Bảng job: tên, ngày, tiến độ `done/total`, nút mở, nút xoá (confirm).
- Nút **New job**: chọn file `.md` (hoặc paste text) → tạo job → chuyển sang `/job/:id`.

### 10.2 Trang `/job/:id` — màn hình chính

Layout 3 vùng:

**Thanh trên**: tên job, tiến độ (`done / total`, số error, số warning), nút Start / Pause / Resume, nút Re-translate all errors, nút Export, nút Settings.

**Panel Settings (drawer)**: toàn bộ mục 4. Đổi `chunkTokens` → áp dụng mục 5.3. Đổi system prompt → áp dụng cho các call tiếp theo, không dịch lại cái đã xong.

**Danh sách chunk (2 cột song song)**: mỗi hàng = 1 chunk
- Trái: source (textarea, sửa được → lưu `source_override`).
- Phải: translated (textarea, sửa được → `edited = true`). Chưa dịch thì trống + badge status.
- Badge màu theo status; icon warning kèm tooltip nội dung warning; error hiện thông báo + nút xem raw response.
- Nút **Re-translate** từng chunk → reset `pending` → gọi translate ngay (không cần Start).
- Sửa source rồi bấm Re-translate → dịch theo `source_override`.

### 10.3 Export
- Nút Export mở modal: **text block hiển thị toàn bộ MD** đã ghép (monospace, scroll), nút **Copy** và nút **Download `.md`** (tên `<name>.vi.md`).
- Chunk chưa dịch được ghép bằng source gốc + marker để không mất nội dung.

## 11. Bảo mật / vận hành

- Không auth. Thêm 1 env `ADMIN_PASSWORD` + middleware basic auth với trang login.
- API key chỉ đi qua header, không log, không lưu.
- Server proxy nhận `endpoint` từ client: **chỉ cho phép `https://`** trừ khi `ALLOW_HTTP_ENDPOINT=1` (dev local với Ollama).
- Giới hạn upload: 2 MB / file.

## 12. Tiêu chí hoàn thành

1. Upload md 100+ block → chunk đúng, `concat(source) === original` (test tự động).
2. Dịch song song 3, pause/resume, reload trang vẫn resume đúng.
3. LLM trả lời có rác ngoài thẻ → bản dịch sạch, không lẫn.
4. LLM quên thẻ → retry, sau 3 lần fail thì `error`, có raw để xem.
5. Code block trong output **byte-identical** với gốc.
6. Sửa tay 1 chunk, re-translate 1 chunk, export ra đúng thứ tự.
7. Xoá job → chunks mất theo.
