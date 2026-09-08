# Tranzlator — Mô tả giao diện hiện tại (cho Designer)

Tài liệu này mô tả **những gì app đang có** để designer thiết kế lại. Không phải wireframe mong muốn, mà là hiện trạng: màn hình nào, vùng nào, nút nào, trạng thái nào. Designer được tự do thay đổi bố cục, màu, typography; nhưng **mọi nút, trạng thái, thông điệp liệt kê dưới đây đều phải có chỗ đứng** trong bản thiết kế mới, trừ khi được ghi rõ là "có thể bỏ".

Ngôn ngữ giao diện: tiếng Việt, lẫn một số từ tiếng Anh ngắn (Jobs, Start, Pause, Export, Settings). Designer có thể đề xuất chuẩn hoá về một thứ tiếng.

---

## 0. App này làm gì (đọc 1 phút)

Người dùng nội bộ tải một file Markdown lên. App cắt tài liệu thành nhiều **chunk** nhỏ, gửi từng chunk cho AI dịch, rồi ghép lại thành file đã dịch. Ngoài dịch, app còn **tóm tắt**: gom nhiều chunk thành **section**, viết một bản **ngữ cảnh chung** cho cả tài liệu, rồi tóm tắt từng section.

Người dùng mang API key của họ. Key lưu trong trình duyệt, không lưu trên server.

Ba khái niệm lặp lại xuyên suốt giao diện:

| Khái niệm | Là gì | Ký hiệu trên UI |
|---|---|---|
| **Chunk** | Một đoạn nhỏ của tài liệu, đơn vị dịch | `#0`, `#1`, `#2`… |
| **Section** | Một nhóm chunk liên tiếp, đơn vị tóm tắt | `§1`, `§2`… kèm dải chunk `3–8` |
| **Ngữ cảnh chung** | Một bản tóm tắt toàn tài liệu do AI viết, người dùng sửa được, dùng để "mớm" cho AI khi dịch và tóm tắt | `§0` |

---

## 1. Danh sách màn hình

| # | Màn hình | Đường dẫn | Mục đích |
|---|---|---|---|
| 1 | Đăng nhập | `/login` | Nhập mật khẩu admin (chỉ hiện khi bật auth) |
| 2 | Danh sách job | `/` | Xem các tài liệu đã tải, tạo job mới, xoá job |
| 3 | Màn hình job | `/job/{id}` | Nơi làm việc chính: 2 tab **Translate** và **Summary** |
| — | Thanh trên cùng | mọi trang trừ login | Logo, link Jobs, trạng thái key, nút Settings, Đăng xuất |
| — | Ngăn Settings | trượt từ phải, mọi trang | Cấu hình AI, prompt, ngưỡng |
| — | Modal Export | trên màn hình job | Xem, copy, tải file kết quả |

Hiện tại chỉ có **light mode và dark mode tự động** theo hệ điều hành, không có nút chuyển.

---

## 2. Thanh trên cùng (Top bar)

Cao khoảng 44px, dính ở trên khi cuộn, nền trắng mờ. Ẩn trên trang login.

Từ trái sang phải:

1. **Tranzlator** — tên app, đậm, bấm về trang danh sách job.
2. **Jobs** — link về trang danh sách job (trùng chức năng với logo, có thể bỏ một).
3. *(khoảng trống đẩy các mục sau sang phải)*
4. **Chip preset** — tên bộ prompt đang dùng (`Truyện`) hoặc `Tuỳ chỉnh`, thêm `*` khi working copy khác preset. Bấm mở Settings thẳng vào tab Prompt. Chỉ hiện từ 1024px.
5. **Chip trạng thái key** — bấm vào đều mở Settings:
   - Xanh lá: `● có key` (1 key) hoặc `● 3 key` (nhiều key)
   - Đỏ: `○ chưa có key — nhập ngay`
6. **Tên model đang dùng** — chữ nhỏ xám, ví dụ `gpt-4o-mini`. Ẩn trên màn hình hẹp.
7. **Settings** — nút viền, mở ngăn Settings.
8. **Đăng xuất** — link chữ xám, chỉ hiện khi auth bật.

---

## 3. Màn hình Đăng nhập

Một card nhỏ (khoảng 384px) căn giữa màn hình.

- Tiêu đề **Tranzlator**
- Phụ đề: "Tool nội bộ — nhập mật khẩu admin để vào."
- Ô **Mật khẩu** (ẩn ký tự, tự focus)
- Khối lỗi đỏ khi sai mật khẩu hoặc mất kết nối server
- Nút **Đăng nhập** full-width, xanh dương. Vô hiệu khi ô trống. Khi đang gửi đổi chữ thành "Đang vào…"
- Chú thích nhỏ dưới cùng: "Phiên lưu bằng cookie httpOnly, hạn 30 ngày. API key của LLM không liên quan tới mật khẩu này."

---

## 4. Màn hình Danh sách job

Trang đơn giản, không sidebar. Đã làm lại theo `CR-v0.2-jobs-list.md`. Không còn tiêu đề "Jobs" và dòng phụ đề — thanh công cụ là thứ đầu tiên trên trang.

**Thanh công cụ** (một thẻ trắng bo tròn, bọc dòng khi hẹp), từ trái sang phải:
- **Ô search** theo tên job, có icon ⌕ và nút × xoá nhanh. Gõ xong 300ms tự tìm, Enter tìm ngay. Tối đa 100 ký tự, không phân biệt hoa thường, có dấu ≠ không dấu.
- **Tag ▾** — dropdown đa chọn, mỗi dòng có checkbox, tên tag và số job; trong dropdown có ô lọc nhanh. Chọn xong hiện chip tag ngay dưới thanh công cụ, mỗi chip có × để bỏ.
- **☆ Favorite** — toggle, bật thì chỉ hiện job favorite (kể cả job đang archive).
- **Gồm archive** — checkbox. Tắt (mặc định) = ẩn job archived. Bật = hiện cả archived. *(CR đề xuất bộ chọn 3 trạng thái; chốt lại còn 1 checkbox vì mặc định đã là "ẩn".)*
- **Xoá bộ lọc** — chỉ hiện khi đang có lọc.
- Bên phải: **＋ New job** — mở/đóng khối tạo job ngay dưới (không phải modal), gồm vùng **kéo-thả / bấm chọn file .md** (tối đa 2 MB) và ô **paste text** + nút **Tạo job từ text**. Lỗi hiện thành khối đỏ.

Toàn bộ trạng thái lọc nằm trên URL (`?q=&tags=&fav=1&archived=include&page=2`) nên F5 và share link giữ nguyên. Đổi bộ lọc → về trang 1.

**Dòng tóm tắt**: "42 job" hoặc "8 job khớp" khi có lọc, kèm "· trang 2/3" khi nhiều trang. Lúc đang gọi API hiện "Đang tải…".

**Danh sách job** — mỗi hàng:

| Vùng | Nội dung |
|---|---|
| Trái | 📌 nếu đã ghim · ★/☆ favorite, bấm toggle ngay tại hàng |
| Chính | Tên job (link mở) + badge xám **Archived** nếu archived. Dưới tên: chip tag (bấm = lọc theo tag đó) và ngày giờ tạo |
| Tiến độ | Dịch `12/40` + thanh mỏng (xanh = xong, đỏ = lỗi) + `3 lỗi` đỏ nếu có · Tóm tắt `§4/9` |
| Phải | Menu **⋯**: Ghim / Bỏ ghim (ẩn khi archived) · Favorite · Archive / Unarchive · **Xoá job** (đỏ, hỏi xác nhận) |

- Job đã ghim nằm trên cùng dưới nhãn nhỏ **ĐÃ GHIM**, ngăn với phần còn lại bằng một đường kẻ.
- Hàng archived mờ đi (opacity 60%) nhưng vẫn bấm được bình thường.

**Phân trang** cuối danh sách khi có nhiều hơn 1 trang: `‹ 1 2 3 … 7 ›`, kèm chữ "20 / trang".

**Trạng thái trống**
- Chưa có job nào: "Chưa có job nào." + nút **＋ New job**.
- Có lọc nhưng không khớp: "Không có job nào khớp." + nút **Xoá bộ lọc**. Nếu đang ẩn archive mà trong archive có job khớp, hiện thêm nút "Có N job trong archive khớp — Tìm trong archive".

---

## 5. Màn hình Job

Đây là màn hình chính, chiếm toàn bộ chiều cao còn lại dưới top bar, **không cuộn cả trang**, chỉ cuộn bên trong từng vùng.

### 5.1 Bố cục tổng

```
┌─ Top bar ────────────────────────────────────────────────────────────┐
├─ Header job ─────────────────────────────────────────────────────────┤
│ ←  Tên job ✎  ★ 📌  [chip tag] [+tag]  [Translate|Summary]  12/40 xong │
│                          [Start] [Dịch lại lỗi] [Export] [⋯]         │
├─ Tiến độ mảnh 3px (rộng bằng cột trái) + % ······· [A− 15px A+] ─────┤
├─ (dải "job đang ở archive" + nút Unarchive, nếu có) ─────────────────┤
├─ (dải cảnh báo / thông báo, có nút × để đóng) ───────────────────────┤
├──────────────┬───────────────────────────────────────────────────────┤
│  SIDEBAR     │  KHUNG ĐỌC (Preview)                                  │
│  ~25% rộng   │  ~75% rộng                                            │
│  cuộn riêng  │  cuộn riêng                                           │
│              │                                                       │
│  danh sách   │  bản dịch / tóm tắt đã render đẹp như bài viết        │
│  thẻ (bar)   │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

Dưới 1024px bố cục đổi hẳn: chỉ còn khung đọc, sidebar thành sheet trượt từ đáy (xem mục 14).

### 5.2 Header job

Một dòng, các mục bọc xuống dòng khi hẹp:

- **←** link nhỏ về danh sách job
- **Tên job** — bấm vào để đổi tên tại chỗ. Khi hover hiện bút chì ✎. Khi sửa: ô input viền xanh, gợi ý "Enter lưu · Esc huỷ", đang lưu thì "đang lưu…"
- **Bộ chuyển tab** dạng segmented control 2 nút: **Translate** | **Summary**. Tab active nền xanh chữ trắng.
- **Thống kê** (chữ xám, đổi theo tab):
  - Tab Translate: `12/40 xong` · `3 lỗi` (đỏ) · `2 cảnh báo` (vàng)
  - Tab Summary: `4/9 section` · `1 lỗi` (đỏ)
- **Chip model · host** — font mono nền xám, ví dụ `gpt-4o-mini · api.openai.com`. Hover hiện tooltip URL đầy đủ sẽ gọi.
- **Cụm nút bên phải** (đổi theo tab, xem 5.5 và 5.6)

### 5.3 Các dải cảnh báo / thông báo (dưới header, trên vùng 2 cột)

Có thể xuất hiện 0 đến 3 dải cùng lúc, mỗi dải một dòng:

| Dải | Màu | Khi nào | Nội dung |
|---|---|---|---|
| Lệch chunk tokens | vàng | Settings để ngưỡng chunk khác với job, và job đã có bản dịch | "Settings để chunk 2000 token, job này đang chunk theo 1500." + nút **Chunk lại theo 2000** + chú "(mất toàn bộ bản dịch hiện có)" |
| Lệch section tokens | vàng | tương tự cho ngưỡng section, và đã có tóm tắt | "Settings để section 8000 token, job này đang gom theo 6000." + nút **Gom lại theo 8000** + "(mất toàn bộ tóm tắt section)" |
| Chưa có ngữ cảnh chung | xám nhạt, chữ nhỏ | Tab Translate, toggle "Dùng ngữ cảnh chung" bật nhưng job chưa có ngữ cảnh | "Toggle 'Dùng ngữ cảnh chung' đang bật nhưng job này **chưa có ngữ cảnh chung** — dịch vẫn chạy bình thường. Tạo ở tab Summary." (chữ Summary là link chuyển tab) |
| Thông báo chung | xanh dương nhạt | sau một hành động | Ví dụ: "Chưa có API key — mở Settings trên thanh trên cùng để nhập.", "Đang có một vòng lặp chạy — Pause trước đã.", "Đã chunk lại theo 1500 token: 42 chunk", "Tạo ngữ cảnh chung thất bại: HTTP 401" |

Các dải này hiện tại **không có nút đóng**, tự biến mất khi điều kiện hết. Designer có thể gợi ý cách gọn hơn (toast, banner thu gọn).

### 5.4 SIDEBAR — quy ước chung cho thẻ (bar)

**Đây là phần quan trọng nhất cần thiết kế lại.** Sidebar là một danh sách dọc các **thẻ** (gọi là *bar*). Ba loại thẻ (chunk, section, ngữ cảnh chung) dùng **cùng một khuôn** để hai tab nhìn giống nhau.

**Thẻ ở trạng thái thu gọn** = 1 dòng, cao khoảng 32px, bấm vào bất kỳ đâu để mở/đóng:

```
┌──────────────────────────────────────────────────────┐
│ #12  [done]  [429]  ⚠  ✎   Dòng đầu tiên của đoạn văn…│
└──────────────────────────────────────────────────────┘
 │     │       │      │  │   └ text preview, cắt bằng "…"
 │     │       │      │  └ đã sửa tay
 │     │       │      └ có cảnh báo (hover xem nội dung)
 │     │       └ mã lỗi HTTP, nền đỏ đậm chữ trắng (chỉ khi lỗi)
 │     └ pill trạng thái (xem bảng màu)
 └ số thứ tự, font mono, xám
```

**Pill trạng thái** (chữ nhỏ 11px, nền nhạt):

| Trạng thái | Màu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| `pending` | xám | chưa làm | |
| `translating` / `summarizing` | xanh dương, **nhấp nháy** (pulse) | AI đang xử lý | |
| `done` | xanh lá | xong | |
| `error` | đỏ | thất bại sau khi đã thử lại | luôn đi kèm ô mã lỗi nếu bắt được HTTP code |
| `skipped` | hổ phách | bỏ qua, không dịch (front matter YAML) | chỉ có ở chunk |

**Thẻ khi được chọn (mở rộng)**: viền chuyển xanh dương, nền trắng, đổ bóng nhẹ. Đồng thời khung đọc bên phải **tự cuộn tới và tô sáng** đoạn tương ứng. Ngược lại, bấm vào một đoạn trong khung đọc thì thẻ tương ứng ở sidebar mở ra và cuộn tới.

**Chỉ một thẻ mở tại một thời điểm.** Mở thẻ khác thì thẻ cũ tự đóng.

**Phần thân thẻ khi mở rộng** (chung cho cả 3 loại):

1. Khối lỗi đỏ (nếu có): thông báo lỗi thô + dòng gợi ý theo mã, ví dụ `429 — bị giới hạn tốc độ — giảm concurrency hoặc chờ rồi Dịch lại lỗi`. Bảng gợi ý đầy đủ ở mục 8.
2. Khối cảnh báo vàng (chỉ chunk): ví dụ "⚠ Bản dịch dài gấp 3 lần bản gốc".
3. **Hàng tab nhỏ + nút hành động**: tab gạch chân kiểu underline, bên phải cùng hàng là bộ đếm `×2` (số lần đã gọi AI, hover giải thích) và nút hành động chính màu xanh.
4. **Vùng nội dung** cao cố định khoảng 300px (14 dòng), font mono 11px, cuộn bên trong.

Chi tiết từng loại thẻ ở 5.5 và 5.6.

### 5.5 Tab Translate

**Cụm nút header (bên phải)**:
- **Start** (xanh dương) — đổi thành **Resume** nếu đã có chunk xong. Khi đang chạy đổi thành **Pause** (màu hổ phách). Vô hiệu khi vòng lặp Summary đang chạy.
- **Dịch lại lỗi (3)** — viền, kèm số lỗi trong ngoặc. Vô hiệu khi không có lỗi hoặc đang chạy.
- **Export** — viền, mở modal Export.

**Sidebar**: danh sách **thẻ chunk** theo thứ tự `#0, #1, #2…`. Có thể lên tới hàng trăm thẻ.

Thẻ chunk mở rộng có 3 tab nhỏ:

| Tab | Nội dung | Sửa được? |
|---|---|---|
| **Nguồn** (có ✎ nếu đã sửa nguồn) | textarea văn bản gốc | Có. Rời ô (blur) là tự lưu, không có nút Save |
| **Bản dịch** | textarea bản dịch. Placeholder "chưa dịch" hoặc "(không dịch — front matter)" | Có. Blur tự lưu, thẻ hiện ✎ |
| **Raw** | khung chỉ đọc, phản hồi thô của AI lần cuối. Trống thì hiện khung nét đứt "Chưa có raw response — chunk này chưa gọi LLM lần nào." | Không |

Nút hành động: **Dịch lại** (xanh). Khi đang dịch: spinner + "Đang dịch…", vô hiệu. Ẩn với chunk `skipped`.

Tab mặc định khi mở thẻ: **Nguồn**.

**Khung đọc (Preview)**: một khung trắng viền mỏng, nội dung căn giữa rộng tối đa 768px, render như bài viết (heading, list, bảng, code có style). Mỗi chunk là một đoạn có thể bấm:
- Đã dịch: hiện bản dịch render.
- Đang dịch lại mà đã có bản cũ: bản cũ **mờ 50% + nhấp nháy**, giữ vị trí.
- Chưa dịch: một dòng nghiêng xám nhỏ `#12 · chưa dịch` / `đang dịch…` / `front matter, không dịch`.
- Đoạn đang chọn: nền xanh rất nhạt + viền ring xanh.
- Chưa có gì: "Chưa có bản dịch nào. Bấm Start để dịch, nội dung sẽ hiện ở đây."

### 5.6 Tab Summary

**Cụm nút header (bên phải)**:
- **Start / Resume / Pause** — giống Translate. Thêm điều kiện: vô hiệu nếu **chưa có ngữ cảnh chung** (tooltip "Cần có ngữ cảnh chung trước") hoặc chưa có section nào.
- **Tóm tắt lại lỗi (1)** — viền.
- **Gom lại section** — viền, tooltip "Xoá sections hiện tại và gom lại theo Section tokens trong Settings". Hỏi xác nhận nếu đã có tóm tắt.
- **Export summary** — viền.

**Sidebar**: thẻ đầu tiên luôn là **Ngữ cảnh chung** (`§0`), sau đó là các **thẻ section** `§1, §2…`.

**Thẻ Ngữ cảnh chung** (`§0`):
- Dòng thu gọn: `§0` · pill (`pending` xám / `generating` xanh nhấp nháy / `done` xanh lá) · ✎ nếu đã sửa tay · ⚠ nếu tài liệu quá dài phải gửi rút gọn · chữ "Ngữ cảnh chung".
- Mở rộng:
  - Khối vàng nếu ⚠: "Tài liệu dài quá 80000 token — đã gửi skeleton (heading + phần đầu mỗi section)."
  - Hàng công cụ: bên trái nhãn nguồn gốc ("chưa có" / "do LLM tạo" / "đã sửa tay"); bên phải nút **Save** (viền, vô hiệu khi chưa sửa, có dấu • khi có thay đổi) và nút **Tạo tóm tắt chung** (xanh; đổi thành **Tạo lại** nếu đã có, và hỏi xác nhận ghi đè; khi chạy: spinner + "Đang tạo…").
  - Textarea 14 dòng, placeholder "Chưa có ngữ cảnh chung — bấm 'Tạo tóm tắt chung', rồi sửa lại nếu cần."
  - Chú thích: "Bơm vào prompt tóm tắt section, và vào prompt dịch nếu bật toggle trong Settings."
  - **Khác chunk/section**: ngữ cảnh chung có nút Save riêng, không tự lưu khi blur.

**Thẻ section** (`§1…`):
- Dòng thu gọn: `§3` · pill · mã lỗi · **heading của section** (cắt "…") · bên phải cùng dải chunk `12–18` font mono xám.
- Mở rộng, 3 tab nhỏ:

| Tab | Nội dung | Sửa được? |
|---|---|---|
| **Tóm tắt** (mặc định) | textarea tóm tắt, placeholder "chưa tóm tắt" | Có, blur tự lưu |
| **Nguồn** | khung chỉ đọc, ghép văn bản gốc của các chunk trong dải | Không (sửa nguồn ở tab Translate) |
| **Raw** | như chunk | Không |

- Hàng nút bên phải: link **→ chunk 12–18** (bấm thì chuyển sang tab Translate, mở đúng chunk đầu và cuộn tới) · `×2` · nút **Tóm tắt lại** (xanh, spinner "Đang tóm tắt…").
- Nút Tóm tắt lại vô hiệu khi chưa có ngữ cảnh chung hoặc có vòng lặp đang chạy.

**Trạng thái trống của sidebar** (job cũ tạo trước khi có chức năng tóm tắt): dưới thẻ §0 là một khung nét đứt "Chưa có section nào — job này tạo trước khi có chức năng tóm tắt." + nút **Gom lại section**.

**Khung đọc (SummaryPreview)**: giống Preview, nhưng:
- Trên cùng là khối **ngữ cảnh chung** render, có đường kẻ dưới ngăn với phần section. Chưa có thì: "Chưa có ngữ cảnh chung. Mở thẻ Ngữ cảnh chung bên trái rồi bấm Tạo tóm tắt chung."
- Mỗi section: **heading** (H2) + tóm tắt render. Chưa có thì `§3 · chưa tóm tắt` / `đang tóm tắt…` / `lỗi`.
- Bấm khối nào thì thẻ tương ứng ở sidebar mở.

### 5.7 Hành vi vòng lặp cần thể hiện

- Tại một thời điểm **chỉ một** trong hai vòng lặp (dịch hoặc tóm tắt) được chạy. Đang dịch mà sang tab Summary bấm Start → thông báo "Đang có một vòng lặp chạy — Pause trước đã."
- Khi chạy, nhiều thẻ **cùng lúc** ở trạng thái nhấp nháy (mặc định 3, tối đa 6). Sidebar dài, người dùng cần thấy tiến độ tổng ở header và nhìn thấy thẻ đang chạy dù đã cuộn xa. Hiện tại **chưa có** thanh tiến độ trực quan, chỉ có số `12/40` — designer nên đề xuất.
- Pause không dừng ngay: các thẻ đang chạy chạy nốt rồi mới dừng.
- Tải lại trang giữ nguyên tiến độ. Bấm Resume chạy tiếp các thẻ còn dở.

---

### 5.9 Tổ chức job trên header (CR v0.2)

Ngay sau tên job:
- **★ / ☆** — toggle favorite.
- **📌** — toggle ghim, **ẩn khi job đang archived** (muốn ghim phải Unarchive trước; API trả 400 nếu cố ghim job archived).
- **Chip tag + ô thêm tag** — gõ để lọc gợi ý từ toàn bộ tag đã dùng, Enter thêm, Backspace ở ô trống xoá tag cuối, × trên chip để xoá. Lưu ngay mỗi lần thay đổi. Tối đa 20 tag / job, 32 ký tự / tag, `API` và `api` coi là một.

Cuối hàng nút hành động có menu **⋯**: **Archive / Unarchive** và **Xoá job**.

Job archived: dải xám ngay dưới header — "Job này đang ở archive — không hiện ở danh sách mặc định." + nút **Unarchive**. Không khoá bất kỳ chức năng nào.

### 5.10 Khung đọc — chỉnh cỡ chữ

Cụm **A− · 15px · A+** nằm ở đầu phải hàng thanh tiến độ, ngay trên khung đọc (thanh tiến độ chỉ chiếm cột trái nên chỗ đó trống). Bấm số ở giữa để về mặc định. Khoảng 12–24px, lưu trong localStorage, dùng chung cho cả tab Translate và Summary. Ở chế độ đọc của mobile hàng thanh tiến độ bị giấu nên cụm này nhảy lên top bar (xem 14.1).

---

## 6. Ngăn Settings (drawer)

Trượt từ **phải**, rộng tối đa 448px, nền phủ đen 30%. Bấm ngoài, nút "Đóng (Esc)" hoặc phím Esc để đóng. Nếu còn thay đổi chưa lưu thì hỏi xác nhận bỏ.

**Header**: tiêu đề "Settings" + "Đóng (Esc)".

**2 tab** kiểu underline: **Chung** | **Prompt**. Tab có thay đổi chưa lưu hiện dấu • cạnh tên.

**Tab Chung**, từ trên xuống:
1. Chú thích: "Áp cho **mọi job**, kể cả job đã tạo. Lưu trong trình duyệt — API key không bao giờ được lưu trên server."
2. **API keys** — danh sách 1..5 ô password, placeholder `sk-...`. Ô đã có giá trị hiện 4 ký tự cuối (`…a4f9`) để phân biệt, kèm nút × xoá dòng (ẩn khi chỉ còn 1 dòng). Dưới cùng link **+ Thêm key** (ẩn khi đã 5 key). Chú: "Nhiều key → app xoay vòng từng cú gọi, dính 429 thì đổi key kế tiếp. Các key phải cùng endpoint."
3. **Endpoint (base URL)** — ô text, mặc định `https://api.openai.com/v1`. Chú "App tự nối /chat/completions."
4. **Model** — ô text kèm gợi ý các model đã dùng, mặc định `gpt-4o-mini`. Bấm vào ô là xổ danh sách (tối đa 10 dòng, mới nhất lên đầu, bỏ dòng đang trùng giá trị hiện tại); gõ thì lọc theo chuỗi con. Bấm một dòng để điền, hover hiện nút × để quên dòng đó. Esc đóng gợi ý trước, Esc lần nữa mới đóng drawer. Model chỉ được nhớ **khi bấm Lưu**, lưu riêng ở `localStorage` key `tranzlator.modelHistory` (không nằm trong settings).
5. **Temperature: 0.2** — ô số, bước 0.1, từ 0 đến 2.
6. **Concurrency: 3** — thanh trượt 2 đến 6.
7. **Cool down (giây)** — ô số, mặc định 5, từ 0 đến 60, bước 0.5. `0` = tắt. Dưới ô hiện ước lượng "≈ 3 call / 5s với concurrency 3. Mỗi worker nghỉ sau khi xong một call."
8. **Chunk tokens (ước lượng chars/4)** — ô số, mặc định 1500. Chú: "Đổi số này thì trang job sẽ nhắc chunk lại (chunk lại là mất bản dịch cũ)."
9. Đường kẻ, tiêu đề nhỏ **Tóm tắt**
10. Checkbox **Dùng ngữ cảnh chung khi dịch** (mặc định bật) + mô tả 2 dòng.
11. **Section tokens** và **Context max tokens** — 2 ô số cạnh nhau, mặc định 6000 và 80000. Chú: "Tài liệu vượt ngưỡng thì gửi skeleton (heading + phần đầu mỗi section)."

**Tab Prompt**:
1. Chú thích: "App tự nối output contract vào cuối mỗi prompt — đừng tự viết luật thẻ trong này."
2. **Thanh preset** (CR v0.3) — xem 6.1.
3. Dải cảnh báo vàng khi prompt có chứa `<translation>` / `<summary>` / `<context>`: app đã tự nối luật thẻ, viết thêm dễ đá nhau. Chỉ cảnh báo, không chặn.
4. **System prompt (dịch)** — textarea 16 dòng mono. Dưới: chú "Nối thêm: bắt buộc thẻ <translation>." + link **Về mặc định** bên phải.
5. **Summary prompt (tóm tắt section)** — textarea 12 dòng, tương tự.
6. **Context prompt (ngữ cảnh chung)** — textarea thấp hơn (~130px), placeholder "Để trống = dùng prompt mặc định của app.". Link **Xem mặc định** bên phải mở khối read-only chứa `CONTEXT_PROMPT` để copy ra sửa. Chú: "App vẫn tự nối contract thẻ <context> và ghi chú skeleton khi tài liệu bị cắt."

### 6.1 Thanh preset (đầu tab Prompt, CR v0.3)

```
[ Tài liệu code  ▾ ]  ● đã sửa  [Lưu preset]  [⋯]
```

Không có chữ "Preset" đứng trước: drawer chỉ rộng 452px, thêm nhãn là nút ⋯ rớt xuống hàng dưới. Dropdown tự nói nó là gì (`aria-label`/`title` = Preset).

Hai tầng, đừng lẫn: **preset** nằm trên DB (dùng chung mọi trình duyệt), **working copy** là 3 ô prompt trong Settings (localStorage) — và working copy mới là thứ thực sự được gửi đi khi dịch. Thanh này chỉ nạp preset xuống working copy và cất working copy lên preset.

- **Dropdown** — preset A→Z, dòng đầu **— Tuỳ chỉnh —** (không gắn preset nào). Nạp preset khi working copy đang "đã sửa" thì hỏi xác nhận bỏ thay đổi. Chọn "Tuỳ chỉnh" chỉ gỡ preset, **giữ nguyên** prompt đang gõ.
- **● đã sửa** — chỉ hiện khi có preset và 3 prompt khác preset (so sau trim).
- **Lưu preset** — enable khi "đã sửa". Ghi DB ngay, đồng thời ghi working copy vào Settings luôn (không để preset trên DB mới hơn thứ đang dùng).
- **⋯** — Lưu thành preset mới… (luôn có, gợi ý tên `<tên cũ> (copy)`) · Đổi tên… · Xoá preset… (hai mục sau ẩn khi Tuỳ chỉnh). Hỏi tên bằng dialog 1 ô text; trùng tên → 409 hiện ngay dưới ô, dialog **không đóng**.
- Xoá preset: prompt đang dùng **giữ nguyên**, chỉ về "Tuỳ chỉnh".
- Danh sách nạp khi mở tab Prompt. Đang tải thì dropdown disable; lỗi mạng hiện "Không tải được preset" + **Thử lại**, các ô prompt vẫn dùng bình thường.
- Preset bị xoá từ trình duyệt khác: mọi thao tác trả 404 → về "Tuỳ chỉnh", giữ working copy, không crash.
- Nạp preset chỉ đổi **draft** — vẫn phải bấm **Lưu** ở chân drawer mới có hiệu lực, như mọi setting khác.
- Dưới 1024px dropdown chiếm cả dòng, hai nút rơi xuống dòng dưới (chỉ bằng `flex-wrap`, không nhánh markup riêng).

**Footer dính đáy**: nút **Lưu** (xanh, có • khi có thay đổi, vô hiệu khi không) · **Huỷ thay đổi** (viền) · bên phải trạng thái chữ nhỏ: `● chưa lưu` / `✓ đã lưu 14:32:05` / `✓ đã lưu`. Phím tắt Cmd/Ctrl+S để lưu.

---

## 7. Modal Export (dùng chung cho Export và Export summary)

Modal căn giữa, rộng tối đa 1152px, cao tối đa 85% màn hình, nền phủ đen 40%.

- **Tiêu đề**: "Export" hoặc "Export summary".
- **Ghi chú vàng** cạnh tiêu đề nếu chưa hoàn tất: "5 chunk chưa dịch → giữ source gốc + marker" hoặc "2 section chưa tóm tắt".
- **Cụm nút bên phải**: **Copy** (viền, đổi thành "Đã copy" 1.5 giây) · **Download .md** (xanh, tên file `ten.vi.md` hoặc `ten.summary.md`) · **Đóng** (chữ xám).
- **Thân**: khung xám font mono chữ nhỏ, cuộn, hiển thị toàn bộ nội dung Markdown thô.

---

## 8. Bảng mã lỗi và gợi ý (hiện trong thẻ khi lỗi)

Ô mã lỗi nền đỏ đậm hiện trên dòng thu gọn; mở thẻ ra thấy thông báo gốc + dòng gợi ý:

| Mã | Gợi ý |
|---|---|
| 429 | bị giới hạn tốc độ — giảm concurrency hoặc chờ rồi Dịch lại lỗi |
| 401 | API key sai hoặc hết hạn |
| 403 | key không có quyền với model này |
| 402 | hết credit / cần thanh toán |
| 404 | endpoint hoặc model không tồn tại |
| 500 / 502 | lỗi phía nhà cung cấp — thử lại sau |
| 503 | nhà cung cấp quá tải — thử lại sau |

Lỗi không có mã (mất mạng, AI quên định dạng sau 3 lần thử) chỉ hiện thông báo gốc.

---

## 9. Hộp thoại xác nhận

Dialog riêng của app (không còn dùng `confirm()` của trình duyệt): thẻ trắng bo tròn giữa màn, tiêu đề + nội dung + dòng đỏ "Hành động này không hoàn tác được." + nút **Huỷ** và nút xác nhận màu đỏ. Bấm nền hoặc Huỷ = không làm gì.

| Khi | Nội dung hiện tại |
|---|---|
| Xoá job | Xoá job "tên"? Toàn bộ chunk và section sẽ mất. |
| Chunk lại | Chunk lại sẽ XOÁ toàn bộ bản dịch và tóm tắt section của job này. Tiếp tục? |
| Gom lại section | Gom lại section sẽ XOÁ toàn bộ tóm tắt section. Tiếp tục? |
| Tạo lại ngữ cảnh chung | Tạo lại sẽ ghi đè ngữ cảnh chung hiện có. Tiếp tục? |
| Đóng Settings còn thay đổi | Còn thay đổi chưa lưu. Đóng và bỏ luôn? |
| Nạp preset khác khi đã sửa | Prompt đang khác preset «tên». Nạp preset khác sẽ mất phần sửa này. |
| Xoá preset | Xoá preset «tên»? Prompt đang dùng vẫn giữ nguyên, chỉ mất bộ prompt lưu trên DB. |

---

## 10. Bảng màu và style đang dùng

Đã áp theo design "organic" (`document/UI Tranzlator/Tranzlator.dc.html`). Token nằm ở `src/app/globals.css`, map sang Tailwind ở `tailwind.config.ts`.

- Nền trang: gradient xanh lá nhạt `#f1f8e6 → #e8f4d8`. Bề mặt: trắng. Chữ: `#1b2418`.
- Màu chính (accent): xanh lá `#3a7a24` + ramp 100–900. Pause: cam đất `#b4741a`. Lỗi/xoá: `#a3271a`. Đang chạy: xanh mòng két `#3d9aa8`. Cảnh báo: vàng nhạt `#fdf3dc`.
- Font: **Baloo 2** cho heading và nút, **Be Vietnam Pro** cho nội dung, **IBM Plex Mono** cho số/mã/textarea. Chọn 3 font này vì Caprasimo và Figtree trong design không có dải Latin Extended Additional nên tiếng Việt bị rơi font giữa chừng.
- Bo góc lớn: thẻ 18–30px, nút và ô nhập bo tròn hẳn (pill). Đổ bóng xanh mềm 3 mức.
- **Chỉ có light mode** — design không có palette tối nên `dark:` đã bị bỏ hết.

---

## 11. Những điểm yếu đã biết, mong designer giải quyết

1. **Sidebar dài** (hàng trăm thẻ) không có cách nhảy nhanh, không có lọc theo trạng thái (chỉ xem lỗi, chỉ xem cảnh báo, chỉ xem chưa dịch).
2. **Không có thanh tiến độ** trực quan, chỉ số đếm trong header.
3. Vùng nội dung trong thẻ mở rộng **cao cố định 300px**, với đoạn dài thì phải cuộn trong ô nhỏ.
4. Ba dải cảnh báo có thể xếp chồng làm header cao lên và đẩy vùng làm việc xuống.
5. Nút hành động **đổi theo tab** ở header khiến người dùng dễ nhầm đang thao tác cho luồng nào.
6. Chưa có cách **so sánh nguồn và bản dịch cạnh nhau** trong cùng một thẻ, phải chuyển tab Nguồn / Bản dịch.
7. Chip key đỏ ở top bar là cách duy nhất nhắc nhập key trước khi bắt đầu; người mới hay bấm Start rồi mới thấy thông báo.
8. Dialog xác nhận dùng hộp mặc định trình duyệt.
9. Từ ngữ lẫn Việt / Anh chưa thống nhất.

---

## 12. Những gì KHÔNG được đổi (ràng buộc sản phẩm)

- Người dùng phải **sửa được** ngữ cảnh chung trước khi dùng nó cho tóm tắt và dịch.
- Phải có cách **sửa nguồn và bản dịch của từng chunk** và **dịch lại một chunk**.
- Phải có cách **tóm tắt lại một section** và **nhảy từ section sang chunk tương ứng**.
- Sidebar và khung đọc phải **đồng bộ chọn** hai chiều.
- Trạng thái từng chunk / section phải nhìn thấy ngay ở dạng thu gọn.
- Raw response phải xem được khi cần debug.
- Cảnh báo mất dữ liệu (chunk lại, gom lại, tạo lại ngữ cảnh) phải bắt xác nhận.

---

## 13. Thay đổi sắp tới

Chưa có. `CR-v0.2-jobs-list.md` đã làm xong: trang Jobs (mục 4), tag / favorite / pin / archive trên màn hình job (mục 5), nhiều API key + cool down trong Settings (mục 6). `CR-v0.3-presets.md` đã làm xong: thanh preset + ô context prompt trong tab Prompt (mục 6.1), chip preset ở top bar (mục 2).

---

## 14. Responsive

Một mốc duy nhất: **1024px**. Từ 1024 trở lên là bố cục desktop mô tả ở các mục trên, **không đổi một pixel nào**. Dưới 1024 chuyển sang một cột.

Chọn 1024 chứ không 768: ở 768 hai cột chia ra khung đọc chỉ còn ~254px, hẹp hơn cả một cột trên điện thoại. Tablet dọc vì thế dùng bố cục một cột.

**Cách làm**: cùng một cây DOM ở mọi khổ, CSS chỉ đổi chỗ đặt. Không có nhánh markup riêng cho mobile, không có hook đo bề ngang màn hình. Các class dùng chung nằm ở `src/app/globals.css`:

| Class | < 1024px | ≥ 1024px |
|---|---|---|
| `.pane-list` | sheet trượt từ đáy, cao tối đa 78dvh, mở bằng nút "Danh sách" | cột trái tĩnh rộng `--pane-w` (392px) |
| `.pane-backdrop` | nền mờ sau sheet | không có |
| `.action-dock` | thanh dính đáy màn, cuộn ngang nếu thừa nút | nằm nguyên trong header job như cũ |
| `.sheet` | bottom sheet bo góc trên 28px | drawer phải 452px (Settings) hoặc modal giữa màn (Export) |
| `.sheet-grab` | thanh kéo nhỏ trên đầu sheet | ẩn |
| `.no-scrollbar` | giấu thanh cuộn của hàng cuộn ngang | — |
| `.reading-pane` | trải hết bề ngang màn, không bo góc, không đổ bóng, chỉ chừa 14px hai bên | card trắng bo 24px, đổ bóng, padding 30px |

State mở/đóng sheet danh sách (`listOpen` trong `JobView`) tồn tại ở mọi khổ; từ 1024 trở lên CSS cho cột hiện luôn nên state đó bị kệ.

**Khác biệt dưới 1024px**:

1. **Top bar** — một dòng, không bọc: ẩn chữ "Tranzlator" (dưới 640) và link "Jobs", chip key rút còn `●` / `○` (bỏ phần chữ dài), tên model chỉ hiện từ 1024.
2. **Màn job** — header job gom [tag][tab][số liệu] thành một hàng cuộn ngang (`display: contents` từ 1024 nên desktop không thấy khác biệt gì). Nút Start/Pause · Dịch lại lỗi · Export · ⋯ xuống thanh dính đáy, kèm nút **Danh sách** mở sheet chunk/section. Menu ⋯ bung **lên** vì nằm sát đáy.
3. **Danh sách job** — mỗi dòng job xuống 2 hàng: tên + ngày ở trên, tiến độ dịch và §tóm tắt ở dưới (trước đây ẩn hẳn dưới 640px). Toolbar rút chữ cho khỏi rơi hàng: nút **Gồm archive** còn `Archive`, **＋ New job** còn `＋ New` (chữ thừa bọc trong `span.hidden.lg:inline`, không render hai nút).
4. **Vùng chạm** — nút cao tối thiểu 40px, ô nhập 44px.
5. **Ô nhập luôn 16px** dù utility đặt nhỏ hơn — dưới 16px thì iOS tự phóng to trang khi focus.
6. **Khung đọc bỏ hẳn card** — không padding ngoài, không bo góc, không đổ bóng: chữ được thêm ~28px mỗi dòng. Chỗ chừa cho thanh nút đáy nằm trong chính khung đọc (`pb-20`) nên hàng bọc nó không cần padding dưới.
7. **Bảng trong khung đọc** cuộn ngang trong lòng nó, không đẩy cả trang.
8. **Chiều cao khung app** dùng `100dvh` (thanh địa chỉ của iOS ăn mất một khúc của `100vh`).
9. **Safe area** — thanh dính đáy và sheet chừa `env(safe-area-inset-bottom)`.

### 14.1 Chế độ đọc (chỉ mobile)

Nút 📖 ở top bar, **sát bên trái logo**, chỉ hiện khi đang ở màn job và chỉ dưới 1024px. Bấm vào thì:

- giấu card header job (tên, tag, tab Translate/Summary, số liệu)
- giấu hàng tiến độ, và **dời cụm A− / A+ lên top bar** — chỉnh cỡ chữ là thứ hay cần đúng lúc đang đọc. Chỗ cho nó lấy từ logo (logo ẩn ở chế độ đọc, chỉ ở mobile)
- giấu thanh nút dính đáy (Start · Dịch lại lỗi · Export · ⋯ · Danh sách)
- khoá tương tác trong khung đọc: bấm vào đoạn không chọn, không đổi màu, không có con trỏ tay

Còn lại đúng khung đọc và các dải cảnh báo. Nút đổi thành ✕ nền accent để thoát.

State nằm ở `src/lib/readMode.ts` (store dùng chung vì nút ở `AppHeader` còn thứ bị giấu ở `JobView`), **không lưu localStorage** — mở app lên mà thấy trống trơn thì tưởng hỏng. Vào chế độ đọc thì sheet danh sách tự đóng. Từ 1024px trở lên state này không có tác dụng gì.
