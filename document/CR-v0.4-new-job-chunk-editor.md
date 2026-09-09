# Change Request v0.4 — Tạo job có xem trước và sửa chunk (chunk break theo quy tắc)

Bổ sung cho `REQUIREMENTS.md` (v0) và các CR v0.1–v0.3. Mục đích: hiện tại chọn file là job được tạo ngay, server tự cắt theo cỡ token. Với tài liệu ngắn hoặc cần dịch đúng từng đoạn (đoạn văn, từng mục theo heading) thì cách cắt tự động không kiểm soát được. CR này thêm **màn hình tạo job**: nhập văn bản, chọn **quy tắc ngắt chunk**, xem trước, sửa / chèn / xoá / tách / gộp chunk, ưng ý rồi mới tạo job.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Màn hình **Tạo job** (`/new`): upload file hoặc dán text, đặt tên | UI |
| 2 | **Quy tắc ngắt chunk** chọn nhanh: tự động theo cỡ token / theo heading / theo dòng trống / theo dấu ngắt tuỳ chỉnh | Chunker, UI |
| 3 | **Xem trước** danh sách chunk và **sửa trước khi tạo**: sửa text, xoá, chèn, tách, gộp | UI |
| 4 | `POST /api/jobs` nhận **`chunks[]`** đã duyệt thay vì (hoặc bên cạnh) `source` | API |
| 5 | Cột `jobs.chunk_mode` ghi lại quy tắc đã dùng, để nút Rechunk cảnh báo | DB |
| 6 | **Bản nháp** giữ trong localStorage, F5 không mất | UI |

Ngoài phạm vi: chèn / xoá / tách / gộp chunk trên **job đã tạo** (đã tạo là cố định bố cục; vẫn sửa nội dung chunk và dịch lại như v0), quy tắc ngắt theo regex tự do, nhiều dấu ngắt cùng lúc, undo nhiều bước.

## 2. Quy tắc nghiệp vụ

### 2.1 Quy tắc ngắt (chunk break rule)
Chọn **đúng một** quy tắc. Đổi quy tắc là cắt lại toàn bộ từ văn bản gốc.

| Rule | Cắt ở đâu | Ghi chú |
|---|---|---|
| `auto` | Như v0: gom block cấp 1 tới `chunkTokens`, block quá dài tách theo câu | Mặc định. Duy nhất rule này **đếm token** |
| `heading` | Mỗi heading **từ cấp 1 tới cấp N** (N = 1, 2, 3 chọn được) mở chunk mới. Heading nằm ở **đầu** chunk của nó | Phần trước heading đầu tiên (nếu có) là chunk 0 |
| `blank` | Mỗi đoạn văn = một chunk. Ranh giới là **một hoặc nhiều dòng trống** liên tiếp; các dòng trống đó thuộc về **chunk phía trước** | Dành cho văn bản ngắn, dịch từng đoạn |
| `marker` | Mỗi dòng **bằng đúng** chuỗi dấu ngắt (sau trim) mở chunk mới. Dòng dấu ngắt nằm ở **đầu** chunk mới | Mặc định `---`. User gõ chuỗi khác (1..64 ký tự) |

Quy tắc chung cho mọi rule:
- **Dấu hiệu cắt là một phần văn bản, không bị bỏ**: heading vẫn là heading, dòng trống vẫn là dòng trống, `---` vẫn là `---`. Rule chỉ quyết định ranh giới.
- **Không trim, không chuẩn hoá** nội dung khi cắt. `concat(chunks) === văn bản gốc` đúng với mọi rule, kiểm bằng test như `auto`.
- **Không cắt xuyên** fenced code block (` ``` ` / `~~~`), bảng, front matter: heading, dòng trống, dấu ngắt nằm **trong** code fence hoặc front matter thì bỏ qua; bảng không có dòng trống nên tự an toàn.
- Front matter (nếu có) luôn là chunk 0 riêng và `skipped`, như v0.
- Rule `heading` / `blank` / `marker` **không đếm token, không làm tròn, không gộp / tách thêm**. Chunk to hay nhỏ là do văn bản. UI chỉ **cảnh báo** cỡ (mục 2.4), không tự sửa.
- Văn bản không có điểm cắt nào (ví dụ chọn `heading` mà không có heading) → 1 chunk duy nhất + banner nhắc "Không tìm thấy điểm ngắt, chọn quy tắc khác hoặc tách tay".

### 2.2 Sửa chunk trước khi tạo
Sau khi cắt, danh sách chunk là **bản nháp trong trình duyệt**, sửa tự do:

| Thao tác | Hành vi |
|---|---|
| **Sửa text** | Textarea của chunk đang chọn. Không trim. Ước lượng token cập nhật khi blur |
| **Xoá chunk** | Bỏ chunk, đánh lại số. Chunk cuối cùng thì không xoá được (còn tối thiểu 1) |
| **Chèn chunk** | "Chèn trước" / "Chèn sau": thêm chunk rỗng, focus vào textarea |
| **Tách** | Đặt con trỏ trong textarea, bấm "Tách tại con trỏ": chunk thành hai, phần sau bắt đầu từ con trỏ. Con trỏ ở đầu / cuối thì không tách |
| **Gộp với chunk sau** | Nối text hai chunk (không thêm ký tự nào), chunk sau biến mất |
| **Cắt lại** | Chọn rule khác (hoặc đổi N / dấu ngắt): nếu đã có sửa tay → confirm "Cắt lại sẽ bỏ mọi chỉnh sửa". Cắt lại luôn từ **văn bản gốc** đã nhập, không từ chunk đang sửa |
| **Sửa văn bản gốc** | Nút "Sửa văn bản gốc" mở lại ô nhập; lưu → cắt lại theo rule hiện tại (cũng confirm nếu đã sửa tay) |

- Tách / gộp / chèn / xoá **không** làm đổi rule. Rule chỉ là điểm xuất phát.
- Không có undo. Sai thì cắt lại.
- Tách tay **giữa** code fence được phép nhưng UI đánh dấu chunk đó cảnh báo đỏ "Code block bị cắt đôi, dịch có thể hỏng khôi phục code" (mục 2.4).

### 2.3 Tạo job
- Bấm **Tạo job** → gửi `name`, `chunkMode`, `chunks[]` (mảng string theo thứ tự) + các setting như hiện tại. Server ghép `source = chunks.join("")` rồi lưu, vì vậy ràng buộc `concat(chunks.source) === job.source` **đúng theo cách dựng**.
- Chunk **rỗng hoặc chỉ khoảng trắng** bị bỏ qua khi tạo (báo trước trên UI: "3 chunk rỗng sẽ bị bỏ").
- Chunk (trừ chunk cuối) **không kết thúc bằng xuống dòng** thì server **thêm `\n`** vào cuối chunk đó trước khi ghép, để hai chunk không dính vào nhau khi export. UI nhắc ở chunk bị ảnh hưởng: "Sẽ tự thêm xuống dòng cuối chunk". Đây là chỗ **duy nhất** app sửa nội dung user nhập.
- Chunk 0 là front matter hợp lệ → `skipped`, còn lại `pending`. Không suy đoán gì thêm.
- Tạo xong: xoá bản nháp localStorage, chuyển sang `/job/:id`.
- Sau khi tạo: **không** chèn / xoá / tách / gộp nữa. Sửa nội dung chunk và "Dịch lại" như v0 vẫn dùng bình thường. Nút **Rechunk** ở màn hình job vẫn có nhưng với `chunk_mode ≠ auto` thì confirm nêu rõ "Job này cắt theo quy tắc «heading»; cắt lại theo cỡ token sẽ bỏ bố cục đó".

### 2.4 Cảnh báo cỡ chunk
Hiện ở từng bar và tổng kết đầu danh sách, chỉ cảnh báo, không chặn:

| Mức | Điều kiện | Hiển thị |
|---|---|---|
| Nhỏ | < 20 token (trừ chunk trống / front matter) | Xám nhạt "ngắn" |
| Bình thường | ≤ `chunkTokens` (setting) | Không gì |
| Lớn | > `chunkTokens` | Vàng, kèm số token ước lượng |
| Quá lớn | > 8 000 token ước lượng | Đỏ "Có thể vượt giới hạn output của model" |
| Code cắt đôi | Số fence ` ``` ` / `~~~` trong chunk là **lẻ** | Đỏ "Code block bị cắt đôi" |

Ước lượng token = chars / 4 như `estimateTokens` hiện có.

### 2.5 Bản nháp (localStorage)
- Key `tranzlator.draft`. Nội dung: `{ name, rawSource, rule, headingLevel, marker, chunks[], editedManually, updatedAt }`. Ghi debounce 500 ms sau mọi thay đổi.
- Mở `/new` mà có nháp → banner "Có bản nháp «tên» lúc hh:mm — [Tiếp tục] [Bỏ]". Chưa chọn thì màn hình trống, không tự nạp.
- Nháp vượt ~4 MB (giới hạn localStorage) → không ghi, banner vàng "Bản nháp quá lớn, không lưu tự động". Tạo job vẫn được.
- Chỉ **một** nháp. Bắt đầu nhập văn bản mới khi đang có nháp = ghi đè (đã qua bước chọn Tiếp tục / Bỏ nên không hỏi lại).
- Tạo job thành công → xoá nháp.

## 3. Data model (delta)

```
jobs (thêm)
  chunk_mode   text   not null default 'auto'   -- 'auto' | 'heading' | 'blank' | 'marker' | 'manual'
```
- `manual` = có sửa tay (tách / gộp / chèn / xoá / sửa text) sau khi cắt bằng bất kỳ rule nào. Chỉ để hiển thị và để Rechunk cảnh báo; không ảnh hưởng logic dịch.
- `chunks`, `sections`, `presets` không đổi. `source_override` vẫn dùng như v0.

Migration `drizzle/0004_chunk_mode.sql`, idempotent: `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS chunk_mode text NOT NULL DEFAULT 'auto'`. Job cũ mặc định `auto`, đúng thực tế.

## 4. API (delta)

### 4.1 `POST /api/jobs` — nhận thêm
```
{
  name, systemPrompt, model, endpoint, chunkTokens, summaryTokens, contextMaxTokens,   // như cũ
  chunks?:    string[]      // MỚI: chunk đã duyệt, theo thứ tự
  chunkMode?: 'auto' | 'heading' | 'blank' | 'marker' | 'manual'   // MỚI, mặc định 'auto'
  source?:    string        // như cũ, chỉ dùng khi KHÔNG có chunks
}
```
- Có `chunks` → bỏ qua `source`, không gọi `chunkMarkdown`. Server: lọc chunk trắng, thêm `\n` cuối chunk thiếu (mục 2.3), `source = join("")`, insert chunk theo thứ tự, chunk 0 front matter → `skipped`.
- Không có `chunks` → hành vi v0 (giữ cho script / test cũ).
- Giới hạn: tổng `Buffer.byteLength(source)` ≤ 2 MB như cũ (413); số chunk sau lọc 1..2 000 (400); `chunkMode` ngoài danh sách → 400.
- Phản hồi không đổi: `{ job, chunks, sections }`. Section gom như v0.1 trên các chunk vừa tạo.

### 4.2 `POST /api/jobs/:id/rechunk`
Không đổi. Gọi thành công thì set `chunk_mode = 'auto'`.

Không thêm route xem trước: **cắt theo rule chạy ở front-end** (`src/lib/chunker.ts` là code thuần, import được cả hai phía). Server không cần biết rule, chỉ nhận kết quả.

## 5. Chunker (delta)

Thêm vào `src/lib/chunker.ts`:
```
type ChunkRule =
  | { kind: 'auto'; chunkTokens: number }
  | { kind: 'heading'; maxLevel: 1 | 2 | 3 }
  | { kind: 'blank' }
  | { kind: 'marker'; marker: string }

chunkByRule(source: string, rule: ChunkRule): ChunkPiece[]
```
- `auto` → gọi `chunkMarkdown` hiện có.
- Ba rule còn lại đi **theo dòng**, có máy trạng thái theo dõi: đang trong fence (` ``` ` / `~~~`, khớp đúng loại và độ dài mở), đang trong front matter (chỉ ở đầu file), để bỏ qua điểm cắt bên trong.
- Bảo toàn từng byte: cắt ở **offset**, ghép slice, không dựng lại chuỗi. Xuống dòng `\r\n` giữ nguyên.
- Test bổ sung trong `tests/chunker.test.ts`: mỗi rule × (văn bản thường, có code fence chứa `#` / `---` / dòng trống, có front matter, `\r\n`, không có điểm cắt) đều thoả `concat === source`; điểm cắt đúng vị trí mong đợi; heading cấp > N không cắt.

## 6. UI — màn hình Tạo job (`/new`)

Thay nút "New" ở trang Jobs: bấm → `/new` (không còn mở file picker trực tiếp). Kéo thả file vào trang Jobs vẫn hoạt động nhưng cũng đưa sang `/new` với văn bản đã nạp.

### 6.1 Bước 1 — Nhập
Khi chưa có văn bản, trang chỉ có:
- Ô **Tên job** (mặc định lấy tên file khi upload; dán text thì `untitled.md`).
- Vùng **kéo thả / chọn file** `.md` `.txt` (2 MB) **hoặc** textarea lớn để dán. Hai cái cạnh nhau trên desktop, xếp dọc dưới 1024px.
- Nút **Cắt chunk** → sang bước 2 với rule mặc định `auto`.

### 6.2 Bước 2 — Xem trước và sửa
Bố cục **giống màn hình job** (tái dùng `ListPanel`, bar card, `ReadingPane`):

```
┌ Top bar: ← Jobs | Tên job [.....] | [Tạo job]                                   ┐
├ Thanh rule: (•) Tự động  ( ) Heading ≤ [H2 ▾]  ( ) Dòng trống  ( ) Dấu ngắt [---]   [Sửa văn bản gốc] ┤
├ Tổng kết: 24 chunk · 3 lớn · 1 code cắt đôi · 2 rỗng sẽ bỏ                          ┤
├──────────────┬──────────────────────────────────────────────────────────────────┤
│ #0  ▮ 120 tok │  Textarea chunk đang chọn (monospace, không trim)                 │
│ #1  ▮ 980 tok │                                                                  │
│ #2  ▮ 2.1k ⚠  │  [Chèn trước] [Chèn sau] [Tách tại con trỏ] [Gộp với sau] [Xoá] │
│ …             │  Ghi chú cảnh báo của chunk này (nếu có)                         │
└──────────────┴──────────────────────────────────────────────────────────────────┘
```
- **Thanh rule** là radio quick-switch. Đổi rule / đổi N / đổi dấu ngắt → cắt lại ngay (confirm nếu đã sửa tay). Dấu ngắt gõ xong blur mới áp.
- **Bar card**: `#idx`, ước lượng token, chip cảnh báo theo mục 2.4, 2 dòng đầu nội dung làm preview. Bấm chọn → textarea bên phải. Chunk rỗng hiện chữ "(rỗng)" mờ.
- **Ô sửa**: textarea cao hết khung, không auto-trim, không auto-format. Ước lượng token cập nhật khi blur.
- Nút thao tác nằm dưới textarea. Dưới 1024px: danh sách là sheet đáy như màn hình job, nút thao tác vào `action-dock`.
- **Tạo job** disable khi tên trống hoặc không còn chunk có nội dung. Đang tạo thì spinner, lỗi hiện banner đỏ, nháp giữ nguyên.
- **← Jobs** khi có nháp: không hỏi, nháp đã tự lưu.

### 6.3 Màn hình job — delta
- Header hiện chip `Cắt: heading ≤ H2` / `Cắt: tay` / không hiện gì với `auto`.
- Rechunk confirm thêm câu cảnh báo khi `chunk_mode ≠ auto` (mục 2.3).

### 6.4 Ghi chú cho designer
- Đây là màn hình thứ ba dùng chung bộ "bar" (sau Translate và Summary). Chỉ thêm 1 trạng thái bar mới: **rỗng** (mờ, chữ nghiêng) và các chip cảnh báo cỡ.
- Không có nút Lưu nháp: nháp tự lưu, chỉ cần dòng nhỏ "Đã lưu nháp hh:mm:ss" ở tổng kết.

## 7. Cấu hình (delta Settings, localStorage)

| Key | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `chunkRule` | `'auto' \| 'heading' \| 'blank' \| 'marker'` | `'auto'` | Rule dùng lần gần nhất, để `/new` lần sau mở đúng rule |
| `headingLevel` | 1..3 | 2 | Cho rule `heading` |
| `chunkMarker` | string 1..64 | `---` | Cho rule `marker` |

`chunkTokens` giữ nguyên, chỉ ảnh hưởng rule `auto` và ngưỡng cảnh báo "lớn".

## 8. Tiêu chí hoàn thành

1. `npm test`: mọi rule × mọi ca ở mục 5 pass, `concat === source`, kể cả `\r\n` và file không có điểm cắt.
2. Văn bản có `#` và `---` **trong** code fence: rule `heading` và `marker` không cắt ở đó.
3. Rule `blank`: 3 đoạn văn cách nhau 1 và 2 dòng trống → 3 chunk, dòng trống nằm cuối chunk trước, export ra bằng đúng văn bản gốc.
4. Rule `heading` với N = 2: H3 không cắt; H1 và H2 cắt, heading ở đầu chunk.
5. Chọn `marker` với dấu `<!-- cut -->` → cắt đúng, dòng dấu ngắt vẫn nằm trong chunk mới, không mất.
6. Rule khác `auto`: chunk 12k ký tự vẫn là **một** chunk, bar tô đỏ, không bị tách.
7. Tách tại con trỏ rồi gộp lại → nội dung bằng đúng trước khi tách.
8. Xoá 2 chunk, chèn 1 chunk rỗng, sửa text 1 chunk, bấm Tạo job → job có đúng số chunk (rỗng bị bỏ), `job.source === chunks.join("")` sau khi thêm `\n`, `chunk_mode = 'manual'`.
9. Tạo job không sửa tay với rule `heading` → `chunk_mode = 'heading'`; Rechunk ở màn hình job hỏi xác nhận có nêu rule cũ; đồng ý → `chunk_mode = 'auto'`.
10. Đang sửa tay, đổi rule → có confirm; huỷ thì không mất gì.
11. F5 giữa chừng → banner nháp; Tiếp tục → đúng tên, rule, chunk, chunk đang sửa; Bỏ → trang trống và localStorage sạch.
12. Tạo job thành công → nháp bị xoá, mở `/new` không còn banner.
13. `POST /api/jobs` với `chunks` 2 001 phần tử → 400; tổng > 2 MB → 413; không có `chunks` → hành vi v0 không đổi.
14. Dưới 1024px: danh sách chunk là sheet đáy, nút thao tác trong dock, không có nhánh markup riêng.
