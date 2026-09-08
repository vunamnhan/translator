# Change Request v0.2 — Trang Jobs (tag, search, paging, archive, pin, favorite) + né 429 (nhiều key, cool down)

Bổ sung cho `REQUIREMENTS.md` (v0) và `CR-v0.1-summary.md`. Mục đích: trang Jobs hiện là một bảng phẳng, nhiều job thì không tìm được, không dọn được. CR này thêm cách **tổ chức** job mà không thêm auth hay multi-user.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | **Tag** tự do trên job, lọc theo tag (nhiều tag, OR) | DB, API, UI job + Jobs |
| 2 | **Search** theo tên job | API, UI Jobs |
| 3 | **Paging** 20 job / trang | API, UI Jobs |
| 4 | **Archive / Unarchive**: dẹp khỏi list mặc định, vẫn xem và sửa bình thường | DB, API, UI |
| 5 | **Pin**: ghim lên đầu list | DB, API, UI |
| 6 | **Favorite**: đánh dấu sao, không đổi thứ tự, có filter riêng | DB, API, UI |
| 7 | **Nhiều API key** (tối đa 5), rotate round-robin cùng endpoint, đổi key khi 429 | Settings, vòng lặp front-end |
| 8 | **Cool down** giữa các cú gọi LLM, mặc định 5 giây | Settings, vòng lặp front-end |

Ngoài phạm vi: thao tác hàng loạt (chọn nhiều job), quản lý tag tập trung (đổi tên / gộp / màu tag), tìm trong nội dung tài liệu, tìm không dấu.

## 2. Quy tắc nghiệp vụ

### 2.1 Tag
- Tag là chuỗi tự do, user gõ trên màn hình job. Một job có 0..n tag.
- Chuẩn hoá khi lưu: trim, gộp khoảng trắng, **giữ nguyên hoa thường** người dùng gõ, nhưng **so trùng không phân biệt hoa thường** (gõ `API` khi job đã có `api` thì không thêm). Tối đa 32 ký tự / tag, tối đa 20 tag / job.
- Gợi ý khi gõ: danh sách tag đã dùng trên mọi job (kể cả archived), kèm số job dùng.
- Lọc theo tag ở trang Jobs: chọn nhiều tag, **OR** (job có ít nhất một tag được chọn).
- Bấm vào chip tag ở bất kỳ đâu = lọc theo tag đó.

### 2.2 Archive
- `archived_at` khác null = archived. Archive là **trạng thái hiển thị**, không phải khoá: job archived **mở được, dịch tiếp, sửa, export, tóm tắt** như bình thường.
- Archive → **tự bỏ pin**. Favorite **giữ nguyên**.
- List mặc định **không hiện** job archived. Job archived xuất hiện khi:
  - bật **"Tìm trong archive"** (áp cho search + filter tag), hoặc
  - chọn filter **"Chỉ archive"**, hoặc
  - chọn filter **Favorite** (favorite kéo cả job archived ra, không cần bật gì thêm).
- Unarchive → về list bình thường, không tự pin lại.
- Xoá job archived vẫn được, vẫn hỏi xác nhận.
- Màn hình job của job archived có dải nhắc "Job này đang ở archive" + nút **Unarchive**, mọi thứ khác không đổi.

### 2.3 Pin
- `pinned_at` khác null = pinned. Pin → job **luôn ở đầu list**, bất kể trang / search / filter, xếp theo `pinned_at` giảm dần (ghim sau lên trên).
- Pin job archived: không cho (nút Pin ẩn hoặc vô hiệu khi archived). Muốn pin phải Unarchive trước.
- Không giới hạn số job pin.

### 2.4 Favorite
- Boolean. Không ảnh hưởng thứ tự.
- Filter **Favorite** = chỉ hiện job favorite, **bao gồm cả archived**.

### 2.5 Search
- Chỉ tìm trong **tên job**. Chứa chuỗi, không phân biệt hoa thường (`ILIKE '%q%'`). Có dấu / không dấu là hai chuỗi khác nhau.
- Tối đa 100 ký tự. Trống = không lọc.
- Search và filter tag, favorite, archive **kết hợp AND** với nhau.

### 2.6 Sort và paging
- Thứ tự cố định: **pinned trước** (theo `pinned_at` desc), rồi **mới nhất trước** (`created_at` desc). Không có sort khác ở v0.2.
- 20 job / trang, phân trang số (1 2 3 … n), hiện tổng số job khớp bộ lọc. Đổi bộ lọc hoặc search → về trang 1.
- Toàn bộ trạng thái lọc nằm trên **URL query** (`?q=&tags=&fav=1&archived=only|include&page=2`) để F5 và share link giữ nguyên.

## 3. Data model (delta)

```
jobs (thêm)
  tags          text[]       not null default '{}'
  archived_at   timestamptz  null      -- null = active
  pinned_at     timestamptz  null      -- null = không pin
  favorite      boolean      not null default false

index
  jobs_tags_gin        GIN (tags)
  jobs_list            (archived_at, pinned_at desc nulls last, created_at desc)
  jobs_name_trgm       GIN (name gin_trgm_ops)   -- cần extension pg_trgm; không có thì bỏ, ILIKE vẫn chạy
```

Migration `drizzle/0002_jobs_list.sql`, idempotent như 0001.

## 4. API (delta)

### 4.1 `GET /api/jobs` — thêm query

| Param | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `q` | string | rỗng | search tên, ILIKE |
| `tags` | csv | rỗng | lọc OR theo tag |
| `fav` | `1` | — | chỉ favorite, gồm cả archived |
| `archived` | `only` \| `include` | (không có) | không có = ẩn archived; `include` = gồm cả; `only` = chỉ archived |
| `page` | int ≥ 1 | 1 | |
| `limit` | int | 20 | clamp 1..100 |

Response:
```
{ items: JobListItem[], page, limit, total }
```

`JobListItem` thêm: `tags`, `archivedAt`, `pinnedAt`, `favorite`, `updatedAt`, và thêm số section `sectionsDone / sectionsTotal` để list hiện được cả tiến độ tóm tắt.

### 4.2 `PATCH /api/jobs/:id` — nhận thêm

| Field | Hành vi |
|---|---|
| `tags: string[]` | thay toàn bộ mảng, chuẩn hoá theo 2.1 |
| `archived: boolean` | true → set `archived_at = now()`, **đồng thời `pinned_at = null`**; false → `archived_at = null` |
| `pinned: boolean` | true → `pinned_at = now()`; từ chối 400 nếu job đang archived; false → null |
| `favorite: boolean` | set thẳng |

### 4.3 `GET /api/tags`
Trả `[{ tag, count }]` distinct trên mọi job kể cả archived, sort count desc rồi tên. Dùng cho gợi ý và filter.

## 5. UI

### 5.1 Trang Jobs (`/`)

Bố cục mới, từ trên xuống:

**Thanh công cụ** (một hàng, bọc dòng khi hẹp):
- Ô **Search** theo tên, có icon, có nút xoá nhanh. Gõ xong 300ms tự tìm, hoặc Enter.
- **Bộ lọc tag**: dropdown đa chọn, liệt kê tag kèm số lượng, có ô lọc nhanh trong dropdown. Tag đã chọn hiện thành chip ngay cạnh, có x để bỏ.
- Toggle **★ Favorite**.
- Bộ chọn archive 3 trạng thái: **Ẩn archive** (mặc định) / **Gồm archive** / **Chỉ archive**. Nhãn "Tìm trong archive" tương đương "Gồm archive".
- Nút **Xoá bộ lọc** hiện khi có bất kỳ lọc nào.
- Bên phải: nút **New job** (giữ hành vi cũ).

**Dòng tóm tắt kết quả**: "42 job · trang 2/3". Khi có lọc: "8 job khớp".

**Danh sách job**: mỗi hàng gồm

| Vùng | Nội dung |
|---|---|
| Trái | Icon 📌 nếu pinned. ★ favorite (bấm toggle ngay tại hàng). |
| Chính | Tên job (link mở). Dưới tên: chip tag (bấm = lọc), chữ nhỏ ngày tạo. Nếu archived: badge xám **Archived**. |
| Tiến độ | Dịch `12/40` (+ `3 lỗi` đỏ) · Tóm tắt `4/9`. Thanh tiến độ mỏng, tuỳ designer. |
| Hành động | Menu `⋯` gồm: **Pin / Unpin** (ẩn khi archived), **Favorite / Bỏ favorite**, **Archive / Unarchive**, **Xoá** (đỏ, xác nhận). |

- Job pinned nằm trên cùng, có đường kẻ hoặc nhãn nhỏ "Đã ghim" ngăn với phần còn lại.
- Hàng archived hiện mờ hơn (opacity), vẫn bấm được.

**Phân trang** cuối danh sách: `‹ 1 2 3 … 7 ›`, kèm "20 / trang" cố định.

**Trạng thái trống**:
- Chưa có job nào: "Chưa có job nào." + nút New job.
- Có lọc nhưng không khớp: "Không có job nào khớp." + nút Xoá bộ lọc. Nếu đang ẩn archive và có job archived khớp tên, gợi ý thêm: "Có 2 job trong archive khớp — Tìm trong archive".

### 5.2 Màn hình job (`/job/:id`) — delta

Header job thêm, ngay sau tên job:
- **★** toggle favorite.
- **📌** toggle pin (ẩn khi archived).
- **Chip tag** + ô thêm tag: gõ, gợi ý từ `/api/tags`, Enter thêm, Backspace ở ô trống xoá tag cuối, x trên chip để xoá. Lưu ngay mỗi lần thay đổi.
- Menu `⋯` có **Archive / Unarchive** và **Xoá**.

Job archived: dải xám ngay dưới header: "Job này đang ở archive — không hiện ở danh sách mặc định." + nút **Unarchive**. Không khoá gì.

### 5.3 Ghi chú cho designer
Trang Jobs đổi từ bảng sang danh sách có toolbar. Các thứ bắt buộc có: search, filter tag đa chọn, toggle favorite, bộ chọn archive 3 trạng thái, phân trang số, chip tag bấm được, phân biệt rõ pinned / archived / favorite trên từng hàng, menu hành động từng hàng. Cập nhật vào `UI-SPEC-current.md` mục 4 khi làm xong.

## 6. Cấu hình
Trang Jobs không thêm setting. `limit` cố định 20 ở UI, API cho 1..100 để dùng sau.

Phần né 429 thêm 2 setting (localStorage), chi tiết mục 8:

| Key | Mặc định | Ghi chú |
|---|---|---|
| `apiKeys` | `[]` | Mảng 1..5 key, **thay thế** `apiKey` cũ. Lần đầu load: nếu có `apiKey` cũ thì chuyển thành `apiKeys[0]` |
| `cooldownMs` | `5000` | 0..60000, bước 500. `0` = tắt |

## 7. Tiêu chí hoàn thành

1. Tạo 50 job → trang 1 có 20, phân trang đúng, tổng đúng.
2. Pin 3 job ở trang 3 → cả 3 lên đầu trang 1 theo thứ tự ghim sau lên trên.
3. Archive job đang pin → mất pin, biến khỏi list mặc định, hiện khi chọn "Gồm archive" hoặc "Chỉ archive".
4. Favorite một job rồi archive → filter Favorite vẫn hiện job đó mà không cần bật archive.
5. Search `abc` khớp `ABC-report.md`, không khớp `ábc.md`.
6. Lọc 2 tag → hiện job có bất kỳ tag nào trong 2 tag đó. Kết hợp search + tag + favorite = AND.
7. Thêm tag `API` vào job đã có `api` → không tạo trùng.
8. F5 hoặc share URL có query → trang mở đúng bộ lọc và trang.
9. Job archived vẫn Start dịch, tóm tắt, export, sửa chunk được. Gọi PATCH `pinned: true` lên job archived → 400.
10. Xoá job archived → xoá được, chunks / sections mất theo.

## 8. Né 429: nhiều key + cool down

Hai cơ chế độc lập, đều nằm ở **vòng lặp front-end**. Server không đổi: vẫn nhận đúng 1 key qua header `x-llm-key` mỗi request, vẫn retry backoff 2/4/8s bên trong một call như v0.

### 8.1 Nhiều API key (tối đa 5)

**Quy tắc**
- Tất cả key dùng **cùng endpoint và cùng model** trong Settings. Không hỗ trợ mỗi key một endpoint.
- Tối đa 5 key. Key rỗng bị bỏ khi lưu. Key trùng nhau bị gộp.
- 1 key → hành vi như cũ. ≥ 2 key → **rotate round-robin theo từng cú gọi**: cú gọi thứ k dùng `apiKeys[k mod n]`. Bộ đếm `k` giữ trong bộ nhớ trang, dùng chung cho cả 3 luồng (dịch chunk, tóm tắt section, tạo ngữ cảnh chung), reset khi tải lại trang.
- **Đổi key khi 429**: nếu một call trả 429 (sau khi server đã backoff hết) và `n ≥ 2`, front-end **thử lại ngay 1 lần** với key kế tiếp trong vòng, không chờ cool down. Vẫn 429 → đánh `error` như thường. Chỉ 1 lần thử lại bằng key khác cho mỗi chunk / section trong một lượt chạy, tránh xoay vòng vô hạn.
- 401 / 403 / 402 **không** đổi key tự động (lỗi cấu hình, phải người xử lý). Thông báo lỗi ghi rõ key nào: `key #2 (…a4f9): 401`.

**Settings UI (tab Chung)**
- Ô **API key** hiện tại đổi thành danh sách **API keys**: mỗi dòng một ô password + nút x xoá. Dưới cùng link **+ Thêm key** (ẩn khi đã 5). Luôn có ít nhất 1 ô.
- Mỗi ô hiện gợi ý `…a4f9` (4 ký tự cuối) khi đã có giá trị, để phân biệt key.
- Chú thích: "Nhiều key → app xoay vòng từng cú gọi, dính 429 thì đổi key kế tiếp. Các key phải cùng endpoint."

**Top bar**: chip key hiện `● 3 key` khi có nhiều key, `● có key` khi 1 key.

**Thông tin hiển thị khi chạy** (tuỳ chọn, designer quyết): trên thẻ chunk mở rộng, cạnh `×2` thêm `key #2` để biết chunk đó gọi bằng key nào. Không lưu DB, chỉ giữ trong bộ nhớ trang.

### 8.2 Cool down

**Quy tắc**
- `cooldownMs` là thời gian **mỗi worker nghỉ sau khi xong một call, trước khi lấy chunk / section tiếp theo**. Mặc định 5000ms. `0` = tắt.
- Áp cho vòng lặp **dịch** và vòng lặp **tóm tắt section**. Không áp cho tạo ngữ cảnh chung (1 call) và nút Dịch lại / Tóm tắt lại một cái lẻ.
- Với pool `concurrency = c`, tốc độ thực tế xấp xỉ **`c` call mỗi `cooldownMs`** (mặc định 3 call / 5 giây). Settings hiện dòng ước lượng này ngay dưới ô để người dùng hiểu hai số liên quan nhau.
- Call đầu tiên của mỗi worker **không** nghỉ. Lần thử lại bằng key khác (8.1) **không** nghỉ.
- **Pause** trong lúc worker đang nghỉ → dừng ngay, không đợi hết cool down.
- Cool down không thay backoff 429 phía server; hai cái cộng dồn.

**Settings UI (tab Chung)**, đặt ngay dưới Concurrency:
- **Cool down (giây)**: ô số, mặc định 5, min 0, max 60, bước 0.5.
- Dòng ước lượng: "≈ 3 call / 5s với concurrency 3". Cập nhật khi đổi một trong hai số.

**Trên thẻ đang chờ** (tuỳ chọn): worker đang nghỉ thì chunk kế tiếp chưa chuyển sang `translating`, người dùng có thể tưởng đứng. Header nên có nhãn nhỏ "đang nghỉ 5s…" khi tất cả worker đều đang trong cool down.

### 8.3 Không đổi
- Server, DB, API route không đổi. Key vẫn không lưu server, không log.
- Retry thẻ 3 lần và backoff HTTP trong một call giữ như v0.

## 9. Tiêu chí hoàn thành (né 429)

11. 3 key, concurrency 3, 9 chunk → log request thấy key luân phiên #1 #2 #3 #1 #2 #3…
12. Mock endpoint trả 429 cho key #1 → chunk đó được gọi lại ngay bằng key #2, trạng thái `done`, không qua `error`.
13. Mock trả 429 cho mọi key → chunk `error` sau đúng 1 lần đổi key, thông báo ghi số key.
14. Cool down 5s, concurrency 2, 6 chunk → tổng thời gian ≥ 10s (mỗi worker 3 call, 2 lần nghỉ); cool down 0 → không có khoảng nghỉ.
15. Pause khi worker đang nghỉ → nút đổi về Start / Resume ngay, không đợi hết 5s.
16. Load lại trang với `apiKey` cũ trong localStorage → tự chuyển thành `apiKeys[0]`, chip key vẫn xanh.
