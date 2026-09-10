# Change Request v0.6 — Assistant Writer (prompt mẫu có placeholder, gọi LLM, dán kết quả)

Bổ sung cho `REQUIREMENTS.md` (v0) và các CR v0.1–v0.5. Mục đích: trước khi cắt chunk, người dùng cần **tạo hoặc biến đổi văn bản** bằng LLM theo mẫu có sẵn, ví dụ "dựa vào văn bản này viết outline", "viết lại cho rõ". CR này thêm **Assistant Writer**: popup chọn prompt mẫu, tự sinh ô nhập theo placeholder, gọi LLM bằng key đang cấu hình, kết quả dán vào nơi đang mở popup. Popup là **thành phần độc lập**, v0.6 gắn vào trang New, sau này gắn chỗ khác không phải sửa lại.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Bảng `writer_prompts`: tên, template có placeholder `{{ten}}`, giá trị mặc định (jsonb), temperature tuỳ chọn | DB |
| 2 | CRUD `GET/POST /api/writer-prompts`, `PATCH/DELETE /api/writer-prompts/:id` | API |
| 3 | `POST /api/writer/run`: gọi LLM một cú với prompt đã điền, thẻ `<output>` | API |
| 4 | Popup **Assistant Writer** độc lập: chọn mẫu, điền, sửa mẫu, chạy, huỷ, xem và sửa kết quả, dán | UI (component dùng chung) |
| 5 | Gắn popup vào **trang New** bước 1, dán vào ô văn bản (thay thế / chèn cuối) | UI |
| 6 | Seed 4 mẫu | Migration |

Ngoài phạm vi: lịch sử lần chạy, streaming, gắn vào màn hình job / chunk editor (popup đã sẵn sàng, chỉ chưa gắn), khai báo nhãn / kiểu ô cho từng placeholder, chạy nhiều mẫu nối tiếp, import / export mẫu.

## 2. Khái niệm

- **Mẫu (writer prompt)** = `name` + `template` + `fields` + `temperature?`. Lưu DB, dùng chung mọi trình duyệt.
- **Placeholder** = `{{ten}}` trong template. `ten` chỉ gồm `A–Z a–z 0–9 _`, 1..40 ký tự. Mọi thứ khác (thẻ HTML, `<source>`, `{ }` đơn) là văn bản thường.
- **`fields`** = jsonb `{ "ten": "giá trị mặc định", … }`. Chỉ là mặc định để điền sẵn; người dùng không thấy và không sửa JSON.
- **Placeholder đặt trước** `{{text}}`: **không sinh ô nhập**, popup tự điền bằng nội dung do nơi gắn popup cung cấp (ở trang New là ô văn bản hiện tại). Không có nội dung thì điền chuỗi rỗng và cảnh báo vàng "{{text}} đang rỗng". Tên `text` không được dùng làm key trong `fields` (bị bỏ qua khi lưu).
- **Working copy** = giá trị đang điền trong popup. Chạy không đụng DB; chỉ hai nút "Lưu…" mới ghi DB (giống preset v0.3).

## 3. Quy tắc nghiệp vụ

### 3.1 Mẫu
- `name`: 1..60 ký tự sau trim, duy nhất không phân biệt hoa thường → trùng 409.
- `template`: 1..20 000 ký tự. Không bắt buộc có placeholder (mẫu tĩnh vẫn chạy được).
- `fields`: object phẳng, value là string ≤ 20 000 ký tự / key. Key không xuất hiện trong template **vẫn được lưu** (để đổi template qua lại không mất giá trị), nhưng UI không hiện.
- `temperature`: null hoặc 0..2, bước 0.1. Null → lấy `settings.temperature`.
- Sắp theo tên A→Z. Không giới hạn số mẫu. Không có mẫu "hệ thống" bị khoá: 4 mẫu seed sửa / xoá như thường.

### 3.2 Parse placeholder
- Regex `\{\{\s*([A-Za-z0-9_]{1,40})\s*\}\}`. Thứ tự ô nhập = thứ tự **xuất hiện lần đầu** trong template; trùng tên → một ô, thay ở mọi chỗ.
- Nhãn ô = tên placeholder, `_` đổi thành khoảng trắng (`noi_dung_1` → "noi dung 1"). Không có cấu hình nhãn.
- Mọi ô là **textarea nhiều dòng**, tự giãn tới 8 dòng rồi cuộn. Ô rỗng vẫn cho chạy (thay bằng chuỗi rỗng), chỉ tô viền vàng nhắc.
- Placeholder không hợp lệ (ví dụ `{{a b}}`) giữ nguyên chữ, không thay, không báo lỗi.

### 3.3 Điền và thay thế
- Prompt gửi đi = template với mọi `{{ten}}` thay bằng giá trị working copy, `{{text}}` thay bằng nội dung nơi gắn popup. Thay **một lượt**, không đệ quy (giá trị chứa `{{x}}` không được thay tiếp).
- Giới hạn prompt sau điền 400 000 ký tự (~100k token) → 400 "Prompt sau khi điền quá dài", không gọi LLM.

### 3.4 Chạy
- Một cú gọi, key lấy theo vòng xoay v0.2 §8.1; dính 429 và có ≥ 2 key → thử lại ngay 1 lần bằng key kế. Không cool down.
- Dùng `runTagged` với thẻ `<output>`: thiếu thẻ → retry tối đa 3 lần với reminder như dịch. Thứ tự message: system = `WRITER_CONTRACT`; user = prompt đã điền (**không** bọc `<source>`, khác luồng dịch).
- Có nút **Huỷ** (AbortController). Huỷ → popup về trạng thái điền, không có kết quả, không lỗi.
- Lỗi (401, 429 hết key, mạng, thiếu thẻ) hiện banner đỏ trong popup với gợi ý như bảng lỗi hiện có; working copy giữ nguyên để chạy lại.
- Kết quả hiện trong ô **Kết quả** (textarea, sửa được). Chạy lại → ghi đè kết quả cũ (không hỏi).

### 3.5 Dán kết quả
- Popup **không tự dán**. Ba nút: **Thay thế** (nội dung nơi gắn = kết quả), **Chèn cuối** (nối vào cuối, tự thêm dòng trống ngăn cách nếu nội dung cũ chưa kết thúc bằng dòng trống), **Copy**.
- Thay thế khi nơi gắn đang có nội dung → confirm "Thay toàn bộ văn bản hiện tại?".
- Thay thế / Chèn xong → đóng popup. Copy → giữ popup.

### 3.6 Lưu
| Nút | Điều kiện | Kết quả |
|---|---|---|
| **Lưu giá trị làm mặc định** | Có mẫu đang chọn, working copy khác `fields` | `PATCH` `fields` (và `template`, `temperature` nếu đang ở chế độ Sửa mẫu và có đổi) |
| **Lưu thành mẫu mới…** | Luôn | Hỏi tên. `POST` với template + working copy + temperature hiện tại. Chọn luôn mẫu mới |
| **Đổi tên…** / **Xoá mẫu…** | Có mẫu đang chọn | Như preset v0.3. Xoá → dropdown về "— Chọn mẫu —", template và giá trị đang điền **giữ nguyên** |

- Nhãn "đã sửa" hiện khi template hoặc giá trị khác record.
- Working copy (mẫu đang chọn, template, giá trị, kết quả) giữ trong **sessionStorage** key `tranzlator.writer` để đóng / mở popup hoặc chuyển tab trong cùng phiên không mất. Đóng trình duyệt là mất, cố ý.
- Mẫu bị xoá từ chỗ khác: `PATCH` 404 → báo, chuyển về "không mẫu", giữ working copy.

### 3.7 Chế độ Sửa mẫu
- Toggle "Sửa mẫu" mở thêm textarea `template` và ô `temperature` phía trên các ô nhập. Gõ template → parse lại ngay (debounce 300 ms), ô nhập sinh lại, giá trị ô trùng tên giữ nguyên, ô mới rỗng.
- Đây là cách duy nhất tạo placeholder mới. Không có màn hình quản lý mẫu riêng.

## 4. Data model (delta)

```
writer_prompts
  id           uuid         pk default gen_random_uuid()
  name         text         not null
  template     text         not null
  fields       jsonb        not null default '{}'
  temperature  real         null            -- null = theo Settings
  created_at   timestamptz  not null default now()
  updated_at   timestamptz  not null default now()

unique index writer_prompts_name_lower ON writer_prompts (lower(name))
```
Không đụng `jobs`, `chunks`, `sections`, `presets`.

Migration `drizzle/0006_writer_prompts.sql`, idempotent: `CREATE TABLE IF NOT EXISTS`, index `IF NOT EXISTS`, seed bằng `INSERT … WHERE NOT EXISTS (lower(name))` như 0003.

## 5. API (delta)

Tất cả sau auth cookie. Chỉ `run` cần `x-llm-key`.

### 5.1 `GET /api/writer-prompts`
→ `200 [{ id, name, template, fields, temperature, updatedAt }]` theo `lower(name)`.

### 5.2 `POST /api/writer-prompts`
Body `{ name, template, fields?, temperature? }` → `201 { prompt }`. 400 sai giới hạn mục 3.1, 409 trùng tên. Key `text` trong `fields` bị bỏ.

### 5.3 `PATCH /api/writer-prompts/:id`
Tập con `{ name, template, fields, temperature }` → `200 { prompt }`. `fields` là **thay toàn bộ**, không merge. 404 / 409.

### 5.4 `DELETE /api/writer-prompts/:id` → `204`.

### 5.5 `POST /api/writer/run`
Header `x-llm-key`. Body `{ endpoint, model, temperature, prompt }` (prompt đã điền, ≤ 400 000 ký tự).
→ `200 { output, raw, attempts }` hoặc `200 { output: null, error, raw, attempts }` (giữ kiểu trả lỗi LLM như route dịch để UI dùng chung bảng gợi ý). 400 thiếu field / prompt quá dài. Không ghi DB, không log prompt hay output.

Server **không** biết mẫu hay placeholder: điền ở front-end, `run` chỉ nhận prompt cuối. Nhờ vậy `run` dùng được cho mọi chỗ gắn popup sau này.

## 6. Prompt và contract

```
WRITER_CONTRACT:
QUY TẮC ĐẦU RA BẮT BUỘC:
Chỉ trả về kết quả, bọc trong thẻ <output></output>.
Không chào hỏi, không giải thích, không thêm bất kỳ nội dung nào ngoài thẻ.
Kết quả viết bằng Markdown nếu có cấu trúc (heading, list, bảng).

WRITER_REMINDER:
NHẮC LẠI: Lần trước bạn quên thẻ. Bắt buộc bọc toàn bộ kết quả trong <output></output>.
```
Thêm `WRITER_SPEC` vào `llm.ts` cạnh 3 spec hiện có; `runTagged` nhận thêm tuỳ chọn "user message thô" thay vì bọc `<source>`.

## 7. UI

### 7.1 Component `WriterDialog` (độc lập)
Props: `open`, `onClose`, `getText(): string` (nội dung cho `{{text}}`), `onReplace(text)`, `onAppend(text)`. Không biết gì về trang New, job hay chunk. Mọi state của popup và sessionStorage nằm trong component / store riêng `writerStore`.

Bố cục (dialog rộng ~720px, dưới 1024px là sheet toàn màn hình):
```
┌ Assistant Writer                                                    [×] ┐
│ Mẫu  [ Dựa vào văn bản viết theo yêu cầu ▾ ]  ● đã sửa   [Sửa mẫu ☐] [⋯] │
│ ── (chế độ Sửa mẫu) ─────────────────────────────────────────────────── │
│ Template  [textarea]                              Temperature [0.7]     │
│ ── Điền ─────────────────────────────────────────────────────────────── │
│ yeu cau     [textarea]                                                  │
│ giong van   [textarea]                                                  │
│ ⓘ {{text}} = văn bản đang có (1 240 ký tự)                              │
│ ── Kết quả ──────────────────────────────────────────────────────────── │
│ [textarea kết quả, sửa được]                                            │
├─────────────────────────────────────────────────────────────────────────┤
│ [Chạy ▷] [Huỷ]   [Lưu giá trị làm mặc định]     [Thay thế] [Chèn cuối] [Copy] │
└─────────────────────────────────────────────────────────────────────────┘
```
- Dropdown dòng đầu "— Chọn mẫu —". Chưa chọn mẫu: chỉ hiện template trống ở chế độ Sửa mẫu (bật sẵn) để gõ mẫu từ đầu.
- Menu `⋯`: Lưu thành mẫu mới…, Đổi tên…, Xoá mẫu…, Tải lại danh sách.
- Đang chạy: nút Chạy thành spinner + đếm giây, chỉ Huỷ bấm được, các ô khoá.
- Thay thế / Chèn cuối / Copy disable khi chưa có kết quả.
- Không có key → banner "Chưa có API key" + link mở Settings, như màn hình job.

### 7.2 Gắn vào trang New (bước 1)
- Nút **"✎ Assistant Writer"** cạnh vùng dán text. `getText` = ô văn bản hiện tại; `onReplace` / `onAppend` ghi vào ô đó (đã có nháp localStorage của v0.4 nên tự lưu theo).
- Bước 2 (đã cắt chunk) chưa gắn ở v0.6.

### 7.3 Ghi chú cho designer
Một dialog mới, tái dùng dropdown + nhãn "đã sửa" + menu `⋯` của thanh preset. Ba vùng xếp dọc, cuộn bên trong dialog, thanh nút cố định đáy.

## 8. Seed 4 mẫu

| name | template | fields | temperature |
|---|---|---|---|
| Dựa vào văn bản viết theo yêu cầu | `Dựa vào văn bản sau:\n\n{{text}}\n\nHãy {{yeu_cau}}.\nGiọng văn: {{giong_van}}. Viết bằng tiếng Việt, giữ định dạng Markdown.` | `{ "yeu_cau": "viết lại thành bài hoàn chỉnh, đủ ý, mạch lạc", "giong_van": "rõ ràng, trung tính" }` | 0.7 |
| Viết lại cho rõ | `Viết lại văn bản sau cho rõ ràng, mạch lạc, giữ nguyên ý và định dạng Markdown. Không thêm ý mới.\n\n{{text}}` | `{}` | 0.3 |
| Tóm tắt thành outline | `Đọc văn bản sau và lập outline Markdown (heading + gạch đầu dòng), tối đa {{do_sau}} cấp. Mỗi mục một câu.\n\n{{text}}` | `{ "do_sau": "3" }` | 0.2 |
| Soạn tài liệu từ ghi chú | `Bạn là {{vai_tro}}. Từ các ghi chú sau, soạn thành tài liệu Markdown có heading, dành cho {{doc_gia}}.\n\nGhi chú:\n{{ghi_chu}}` | `{ "vai_tro": "technical writer", "doc_gia": "developer mới vào team", "ghi_chu": "" }` | 0.6 |

## 9. Cấu hình
Không thêm key Settings. Temperature, model, endpoint, key lấy từ Settings hiện có; mẫu có `temperature` riêng thì ưu tiên mẫu.

## 10. Tiêu chí hoàn thành

1. Chạy `0006_writer_prompts.sql` hai lần: không lỗi, đúng 4 mẫu, không nhân đôi, mẫu đã sửa không bị ghi đè.
2. Chọn mẫu "Dựa vào văn bản…" → sinh đúng 2 ô `yeu cau`, `giong van` theo thứ tự, điền sẵn giá trị; **không** có ô `text`; dòng ⓘ hiện số ký tự văn bản đang có.
3. Template `Hãy {{a}} rồi {{b}} và lại {{a}}` → 2 ô, prompt gửi đi thay cả 3 chỗ. Template chứa `<source>` và `{x}` → giữ nguyên chữ.
4. Giá trị ô chứa `{{b}}` → không bị thay tiếp (không đệ quy).
5. Chạy với mock trả không có thẻ → retry 3 lần rồi báo lỗi, working copy còn nguyên; mock trả `<output>` → kết quả hiện trong ô, sửa được.
6. Huỷ giữa chừng → request bị abort, popup về trạng thái điền, không banner lỗi.
7. Thay thế khi ô văn bản đang có nội dung → confirm; đồng ý → ô văn bản = kết quả, popup đóng, nháp v0.4 cập nhật. Chèn cuối → có dòng trống ngăn cách.
8. Sửa giá trị → "đã sửa" bật; "Lưu giá trị làm mặc định" → `PATCH` `fields`; mở trình duyệt khác thấy mặc định mới.
9. Bật Sửa mẫu, thêm `{{moi}}` vào template → ô mới xuất hiện ngay, ô cũ giữ giá trị; "Lưu thành mẫu mới" trùng tên → 409 hiện trong dialog.
10. Xoá mẫu đang chọn → dropdown về "— Chọn mẫu —", template và giá trị đang điền giữ nguyên.
11. Đóng popup, mở lại trong cùng tab → mẫu, giá trị, kết quả còn nguyên; mở tab mới → trống.
12. `POST /api/writer/run` với prompt 400 001 ký tự → 400, không có request tới LLM; không có `x-llm-key` → 401 như route dịch.
13. 2 key, mock 429 ở key #1 → gọi lại bằng key #2, kết quả bình thường, nhãn key trong lỗi nếu cả hai fail.
14. `WriterDialog` render được ở một trang thử không phải New chỉ với 5 props, không import gì từ trang New.
15. Không có API key, prompt hay output trong DB hay log server.
