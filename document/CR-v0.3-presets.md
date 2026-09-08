# Change Request v0.3 — Translation preset (bộ prompt dịch + tóm tắt)

Bổ sung cho `REQUIREMENTS.md` (v0), `CR-v0.1-summary.md`, `CR-v0.2-jobs-list.md`. Mục đích: mỗi loại tài liệu cần một bộ prompt khác nhau (tài liệu code, document, truyện…). Hiện prompt chỉ có **một bản** trong Settings của trình duyệt, đổi loại tài liệu là phải paste lại tay. CR này thêm **preset**: bộ prompt đặt tên, lưu DB, nạp / sửa / lưu ngay trong tab Prompt của Settings drawer.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Bảng `presets`: tên + 3 prompt (dịch, tóm tắt section, ngữ cảnh chung) | DB |
| 2 | CRUD preset: `GET/POST /api/presets`, `PATCH/DELETE /api/presets/:id` | API |
| 3 | Tab Prompt của drawer: chọn preset để nạp, sửa, lưu đè, lưu thành preset mới, đổi tên, xoá | UI, Settings |
| 4 | Prompt **ngữ cảnh chung** sửa được theo preset (trống = dùng prompt cố định của app) | Settings, route context |
| 5 | Seed 3 preset mẫu: **Tài liệu code**, **Document**, **Truyện** | Migration |

Ngoài phạm vi: preset chứa thông số ngoài prompt (chunkTokens, temperature, model…), import/export preset ra file, gắn preset vào job (job vẫn chỉ snapshot `system_prompt` như v0), preset theo user (tool chưa multi-user), lịch sử phiên bản preset.

## 2. Khái niệm

- **Preset** = một bộ gồm `name` + `translate_prompt` + `summary_prompt` + `context_prompt` (tuỳ chọn). Lưu DB, dùng chung cho mọi trình duyệt mở tool.
- **Working copy** = 3 ô prompt trong Settings (localStorage) như hiện tại. Đây vẫn là thứ **thực sự được gửi đi** khi dịch / tóm tắt. Preset chỉ là nguồn để nạp vào working copy và nơi để cất working copy lại.
- Settings ghi thêm `presetId`: preset đang được nạp (null = không gắn preset nào, tức "Tuỳ chỉnh").
- Working copy **khác** nội dung preset đang gắn → trạng thái **"đã sửa"** (so sánh chuỗi sau trim từng prompt).

Tách hai tầng như vậy để: (a) đổi prompt thử nghiệm không làm hỏng preset, (b) route dịch / tóm tắt **không đổi**, vẫn nhận prompt trong body như v0 / v0.1.

## 3. Quy tắc nghiệp vụ

### 3.1 Preset
- `name`: 1..60 ký tự sau trim, **duy nhất không phân biệt hoa thường**. Trùng → 409.
- `translate_prompt`, `summary_prompt`: bắt buộc, 1..20 000 ký tự.
- `context_prompt`: tuỳ chọn, tối đa 20 000 ký tự. **Null / rỗng = dùng `CONTEXT_PROMPT` cố định của app** (giữ hành vi CR v0.1).
- Không có khái niệm preset "hệ thống" bị khoá: 3 preset seed sửa / xoá như preset thường. Xoá hết cũng được, tab Prompt khi đó chỉ còn working copy.
- Không giới hạn số preset. Sắp xếp theo tên A→Z.
- Không lưu output contract trong preset — app vẫn tự nối contract vào cuối prompt (`OUTPUT_CONTRACT` / `SUMMARY_CONTRACT` / `CONTEXT_CONTRACT`) như v0. Lưu preset mà prompt có chứa chuỗi `<translation>` / `<summary>` / `<context>` thì chỉ **cảnh báo** trên UI, không chặn.

### 3.2 Thao tác trong tab Prompt
| Thao tác | Điều kiện | Kết quả |
|---|---|---|
| **Chọn preset** (dropdown) | Working copy đang "đã sửa" → hỏi xác nhận "Bỏ thay đổi chưa lưu?" | Nạp 3 prompt của preset vào working copy, `presetId` = preset đó, hết "đã sửa" |
| **Lưu vào preset** | Có `presetId` và đang "đã sửa" | `PATCH /api/presets/:id` với 3 prompt hiện tại. Hết "đã sửa" |
| **Lưu thành preset mới** | Luôn | Hỏi tên (mặc định gợi ý `<tên preset cũ> (copy)` hoặc `Preset mới`). `POST /api/presets`. `presetId` = preset vừa tạo |
| **Đổi tên** | Có `presetId` | Hỏi tên mới, `PATCH` chỉ `name` |
| **Xoá preset** | Có `presetId` | Confirm. `DELETE`. `presetId` = null, **working copy giữ nguyên** (không mất prompt đang dùng) |
| **Về mặc định** (từng ô, có sẵn) | Luôn | Như cũ: nạp `DEFAULT_*` của app vào ô đó. Nếu đang gắn preset thì thành "đã sửa" |
| **Lưu** (nút chân drawer, có sẵn) | Draft khác settings | Như cũ: ghi working copy + `presetId` vào localStorage. **Không** đụng DB |

- Nạp preset chỉ đổi **draft** của drawer; vẫn phải bấm **Lưu** ở chân drawer để có hiệu lực, giống mọi setting khác. Dấu `•` trên tab Prompt hiện như hiện tại.
- "Lưu vào preset" / "Lưu thành preset mới" ghi DB **ngay**, độc lập với nút Lưu của drawer. Sau khi ghi DB thành công thì đồng thời ghi working copy vào settings luôn (để không có trạng thái preset trên DB mới hơn thứ đang dùng).
- Preset bị người khác sửa / xoá trên DB trong khi drawer đang mở: `PATCH` trả 404 → báo "Preset không còn tồn tại", chuyển `presetId` = null, giữ working copy. Không có lock, last-write-wins.
- Job đang chạy (vòng lặp dịch / tóm tắt active) thì đổi prompt có hiệu lực từ chunk / section **kế tiếp**, như hành vi đổi Settings hiện tại. Không cần chặn.

### 3.3 Prompt ngữ cảnh chung theo preset
- CR v0.1 để prompt ngữ cảnh chung cố định. v0.3 cho preset ghi đè: `context_prompt` của preset (nếu có) thay `CONTEXT_PROMPT`. `CONTEXT_TRUNCATED_NOTE` và `CONTEXT_CONTRACT` vẫn do app nối vào, preset không sửa được.
- Prompt ngữ cảnh chung nên giữ khung `## Tổng quan / ## Cấu trúc / ## Thuật ngữ` (hoặc khung tương đương) vì UI chỉ hiện text, không parse; nhưng không bắt buộc.
- Working copy có thêm ô `contextPrompt` (chuỗi rỗng = mặc định app).

### 3.4 Chuyển đổi settings cũ
- Settings đã có `systemPrompt`, `summaryPrompt`: giữ nguyên làm working copy, `presetId = null`, `contextPrompt = ""`. Không tự tạo preset từ settings cũ.
- Tên field trong Settings giữ `systemPrompt` (dịch) để không đổi code đang có; trong DB đặt `translate_prompt` cho rõ nghĩa.

## 4. Data model (delta)

```
presets
  id                uuid         pk default gen_random_uuid()
  name              text         not null
  translate_prompt  text         not null
  summary_prompt    text         not null
  context_prompt    text         null          -- null/'' = dùng CONTEXT_PROMPT của app
  created_at        timestamptz  not null default now()
  updated_at        timestamptz  not null default now()

unique index presets_name_lower ON presets (lower(name))
```

`jobs`, `chunks`, `sections` **không đổi**. Job vẫn snapshot `system_prompt` lúc tạo như v0; không lưu preset id lên job (ngoài phạm vi).

Migration `drizzle/0003_presets.sql`, idempotent như 0001 / 0002: `CREATE TABLE IF NOT EXISTS`, index `IF NOT EXISTS`, seed 3 preset bằng `INSERT … WHERE NOT EXISTS (SELECT 1 FROM presets WHERE lower(name) = lower(:name))` để chạy lại không nhân đôi và không ghi đè preset đã bị user sửa.

## 5. API (delta)

Tất cả route sau nằm sau auth cookie như các route hiện có. Không nhận / không cần `x-llm-key`.

### 5.1 `GET /api/presets`
→ `200 [{ id, name, translatePrompt, summaryPrompt, contextPrompt, updatedAt }]`, sắp theo `lower(name)` tăng dần. Trả đủ nội dung prompt (vài chục preset × 20 KB vẫn nhỏ), không cần route lấy lẻ.

### 5.2 `POST /api/presets`
Body `{ name, translatePrompt, summaryPrompt, contextPrompt? }` → `201 { preset }`.
- 400 nếu thiếu / vượt giới hạn mục 3.1.
- 409 nếu trùng tên (không phân biệt hoa thường).

### 5.3 `PATCH /api/presets/:id`
Body bất kỳ tập con của `{ name, translatePrompt, summaryPrompt, contextPrompt }` → `200 { preset }`. `contextPrompt: null` hoặc `""` đều lưu null. Cập nhật `updated_at`.
- 404 nếu không tồn tại, 409 nếu đổi tên trùng.

### 5.4 `DELETE /api/presets/:id`
→ `204`. 404 nếu không tồn tại.

### 5.5 `POST /api/jobs/:id/context` — nhận thêm
Body thêm `contextPrompt?: string`. Có và không rỗng → dùng thay `CONTEXT_PROMPT`; app vẫn nối `CONTEXT_TRUNCATED_NOTE` (khi cắt skeleton) và `CONTEXT_CONTRACT` như cũ. Thiếu / rỗng → hành vi v0.1.

`POST /api/chunks/:id/translate`, `POST /api/sections/:id/summarize`, `POST /api/jobs`: **không đổi**, vẫn nhận prompt trong body.

## 6. UI — tab Prompt của Settings drawer

Tab Prompt hiện có 2 textarea (dịch, tóm tắt) + ghi chú "prompt ngữ cảnh chung cố định". v0.3 sửa thành:

### 6.1 Thanh preset (đầu tab)
```
Preset  [ Tài liệu code           ▾ ]  ● đã sửa      [Lưu vào preset] [⋯]
```
- Dropdown: danh sách preset A→Z, dòng đầu **"— Tuỳ chỉnh —"** (= `presetId` null). Đang gắn preset nào thì hiện tên đó.
- Nhãn **"đã sửa"** (chấm cam) chỉ hiện khi có preset và working copy khác preset.
- **Lưu vào preset**: chỉ enable khi "đã sửa". Bấm xong nhãn tắt, toast "Đã lưu preset «Tài liệu code»".
- Menu `⋯`: **Lưu thành preset mới…**, **Đổi tên…** (ẩn khi Tuỳ chỉnh), **Xoá preset…** (ẩn khi Tuỳ chỉnh). Hỏi tên bằng dialog nhỏ có 1 ô text + Huỷ / OK, lỗi 409 hiện ngay dưới ô, không đóng dialog.
- Load danh sách preset khi mở tab Prompt (không load lúc mở app). Đang load thì dropdown disable. Lỗi mạng → dropdown hiện "Không tải được preset" + nút thử lại; các textarea vẫn dùng bình thường.
- Dưới 1024px: dropdown chiếm cả dòng, hai nút xuống dòng dưới. Vẫn cùng DOM, chỉ CSS (giữ quy ước responsive hiện tại).

### 6.2 Ba ô prompt
1. **System prompt (dịch)** — như cũ, có "Về mặc định".
2. **Summary prompt (tóm tắt section)** — như cũ, có "Về mặc định".
3. **Context prompt (ngữ cảnh chung)** — **mới**, textarea thấp hơn (~130px), placeholder: *"Để trống = dùng prompt mặc định của app."* Có nút "Xem mặc định" mở rộng khối read-only chứa `CONTEXT_PROMPT` để user copy ra sửa. Ghi chú dưới ô: *"App vẫn tự nối contract thẻ `<context>` và ghi chú skeleton khi tài liệu bị cắt."*

Ghi chú "App tự nối output contract…" ở đầu tab giữ nguyên.

### 6.3 Chỗ khác
- Chip ở top bar cạnh chip key: tên preset đang dùng (`Truyện`, hoặc `Tuỳ chỉnh`), thêm `*` khi đã sửa. Bấm mở drawer thẳng vào tab Prompt. Không hiện dưới 1024px.
- Không có màn hình quản lý preset riêng. Mọi thứ trong tab Prompt.

## 7. Cấu hình (delta Settings, localStorage)

| Key | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `presetId` | `string \| null` | `null` | Preset đang gắn. Không còn trên DB → coi như null |
| `systemPrompt` | string | `DEFAULT_SYSTEM_PROMPT` | Không đổi |
| `summaryPrompt` | string | `DEFAULT_SUMMARY_PROMPT` | Không đổi |
| `contextPrompt` | string | `""` | Rỗng = dùng `CONTEXT_PROMPT` của app. Gửi trong body `POST /api/jobs/:id/context` |

## 8. Seed 3 preset mẫu

Nội dung seed dưới đây là **bản khởi điểm** để user sửa tiếp, không phải chuẩn cuối. Preset **Document** giữ đúng `DEFAULT_SYSTEM_PROMPT` / `DEFAULT_SUMMARY_PROMPT` hiện tại để không đổi hành vi mặc định.

### 8.1 Tài liệu code
`translate_prompt`
```
Bạn là kỹ sư phần mềm song ngữ, dịch tài liệu kỹ thuật Markdown sang tiếng Việt.
Yêu cầu:
- Giữ nguyên cấu trúc Markdown: heading, list, bảng, link, hình, code block, inline code.
- Không dịch code block, inline code, tên hàm, tên biến, tên file, đường dẫn, lệnh CLI, tên package, URL.
- Giữ nguyên bằng tiếng Anh các thuật ngữ đã thông dụng trong giới lập trình (API, endpoint, request, callback, commit, deploy…). Thuật ngữ ít gặp: dịch và mở ngoặc tiếng Anh lần đầu xuất hiện.
- Câu lệnh, cảnh báo, ghi chú (Note/Warning/Tip) dịch giữ đúng ý và giọng ngắn gọn.
- Không thêm giải thích ngoài văn bản gốc.
```
`summary_prompt`
```
Tóm tắt đoạn tài liệu kỹ thuật Markdown sau bằng tiếng Việt, 3–5 gạch đầu dòng.
Ưu tiên: mục đích của phần này, API / lệnh / cấu hình được nhắc tới (giữ nguyên tên tiếng Anh), điều kiện và ràng buộc quan trọng.
Không chép lại code. Không nhận xét.
```
`context_prompt`: null (dùng mặc định app).

### 8.2 Document
`translate_prompt` = `DEFAULT_SYSTEM_PROMPT` hiện tại.
`summary_prompt` = `DEFAULT_SUMMARY_PROMPT` hiện tại.
`context_prompt`: null.

### 8.3 Truyện
`translate_prompt`
```
Bạn là dịch giả văn học, dịch truyện dạng Markdown sang tiếng Việt.
Yêu cầu:
- Giữ nguyên cấu trúc Markdown (heading chương, phân đoạn, in nghiêng, in đậm, dòng kẻ phân cảnh).
- Dịch tự nhiên, giàu cảm xúc, đúng giọng nhân vật; ưu tiên hay và trôi chảy hơn sát từng chữ.
- Xưng hô nhất quán theo quan hệ nhân vật trong phần ngữ cảnh chung; chưa rõ thì chọn xưng hô trung tính và giữ ổn định.
- Tên riêng nhân vật, địa danh: giữ nguyên trừ khi ngữ cảnh chung quy định cách phiên âm.
- Thành ngữ, chơi chữ: dịch thoát ý sang cách nói tiếng Việt tương đương, không dịch sát.
- Không thêm lời bình, không tóm tắt.
```
`summary_prompt`
```
Tóm tắt phần truyện sau bằng tiếng Việt, 3–5 gạch đầu dòng theo trình tự diễn biến.
Nêu: chuyện gì xảy ra, nhân vật nào xuất hiện, thay đổi quan trọng về quan hệ hoặc tình huống, chi tiết cài cắm nếu có.
Không bình luận, không đoán trước.
```
`context_prompt`
```
Bạn đọc toàn bộ truyện dạng Markdown dưới đây và viết phần "ngữ cảnh chung" bằng tiếng Việt,
dùng làm nền để dịch và tóm tắt từng phần sau này. Trả về đúng khung sau, không thêm phần nào khác:

## Tổng quan
(3–6 câu: thể loại, bối cảnh, giọng kể, ngôi kể)

## Nhân vật và xưng hô
- Tên (giữ nguyên / phiên âm) — vai trò — cách xưng hô với các nhân vật chính (tôi/anh/em/cậu/ngài…)
- ...

## Cấu trúc
(outline ngắn các chương / phần)

## Thuật ngữ và tên riêng
- term gốc → cách dịch / giữ nguyên
- ...
```

## 9. Tiêu chí hoàn thành

1. Chạy `drizzle/0003_presets.sql` hai lần trên DB đã có 0000–0002: không lỗi, đúng 3 preset seed, không nhân đôi.
2. Sửa preset seed rồi chạy lại migration: nội dung đã sửa **không** bị ghi đè.
3. Mở tab Prompt: dropdown liệt kê preset A→Z + "— Tuỳ chỉnh —"; chọn "Truyện" → 3 ô prompt đổi theo, tab Prompt hiện `•` cho tới khi bấm Lưu.
4. Chọn preset khác khi đang "đã sửa" → có confirm; huỷ thì không đổi gì.
5. Sửa ô dịch → nhãn "đã sửa" bật; "Lưu vào preset" → `PATCH` thành công, nhãn tắt, mở trình duyệt khác thấy nội dung mới.
6. "Lưu thành preset mới" trùng tên (khác hoa thường) → 409, dialog hiện lỗi, không tạo thêm.
7. Xoá preset đang gắn → dropdown về "Tuỳ chỉnh", 3 ô prompt **giữ nguyên** nội dung.
8. Preset gắn trong settings bị xoá từ trình duyệt khác → mở tab Prompt hiện "Tuỳ chỉnh", working copy giữ nguyên, bấm "Lưu vào preset" không crash.
9. Preset có `context_prompt` → "Tạo tóm tắt chung" dùng prompt đó (kiểm tra bằng raw response / log request phía client); preset không có → dùng prompt cố định như v0.1.
10. Dịch 1 chunk và tóm tắt 1 section với preset bất kỳ: request body vẫn chỉ có `systemPrompt` / `summaryPrompt` như trước, không có field preset — route dịch / tóm tắt không đổi.
11. `tests/chunker.test.ts` vẫn pass (CR không đụng chunker, chỉ để chắc).
12. Không có API key trong bảng `presets`, trong body preset, hay trong log.
