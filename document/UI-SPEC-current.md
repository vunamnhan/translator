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
4. **Chip trạng thái key** — 2 trạng thái, bấm vào đều mở Settings:
   - Xanh lá: `● có key`
   - Đỏ: `○ chưa có key — nhập ngay`
5. **Tên model đang dùng** — chữ nhỏ xám, ví dụ `gpt-4o-mini`. Ẩn trên màn hình hẹp.
6. **Settings** — nút viền, mở ngăn Settings.
7. **Đăng xuất** — link chữ xám, chỉ hiện khi auth bật.

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

Trang đơn giản, padding 24px, không sidebar.

**Đầu trang**
- Tiêu đề **Jobs**
- Phụ đề: "Dịch Markdown bằng LLM · bring-your-own-key. Nhập API key ở Settings góc trên phải trước khi bấm Start."

**Nút New job** (xanh dương). Bấm thì **mở/đóng một khối tạo job** ngay dưới nút (không phải modal). Khối gồm:
- **Upload file .md** — input chọn file mặc định của trình duyệt. Chọn xong tạo job ngay và chuyển sang màn hình job.
- **Hoặc paste text** — textarea 6 dòng, font mono, placeholder `# Markdown here`. Dưới có nút **Tạo job từ text** (đen), vô hiệu khi trống.
- Lỗi hiện dạng khối đỏ: ví dụ "File vượt quá 2 MB".

**Bảng job** với 4 cột:

| Tên | Ngày | Tiến độ | (hành động) |
|---|---|---|---|
| tên file, đậm | ngày giờ tạo, xám | `12/40` chunk xong, kèm `3 lỗi` màu đỏ nếu có | **Mở** (link xanh) · **Xoá** (link đỏ) |

- Xoá hỏi xác nhận bằng hộp thoại mặc định của trình duyệt: `Xoá job "tên"? Toàn bộ chunk sẽ mất.`
- Trạng thái trống: một dòng giữa bảng "Chưa có job nào."

---

## 5. Màn hình Job

Đây là màn hình chính, chiếm toàn bộ chiều cao còn lại dưới top bar, **không cuộn cả trang**, chỉ cuộn bên trong từng vùng.

### 5.1 Bố cục tổng

```
┌─ Top bar ────────────────────────────────────────────────────────────┐
├─ Header job ─────────────────────────────────────────────────────────┤
│ ←  Tên job ✎   [Translate | Summary]   12/40 xong  3 lỗi   model·host │
│                                              [Start] [Dịch lại lỗi] [Export] │
├─ (dải cảnh báo, nếu có) ─────────────────────────────────────────────┤
├─ (dải thông báo, nếu có) ────────────────────────────────────────────┤
├──────────────┬───────────────────────────────────────────────────────┤
│  SIDEBAR     │  KHUNG ĐỌC (Preview)                                  │
│  ~25% rộng   │  ~75% rộng                                            │
│  cuộn riêng  │  cuộn riêng                                           │
│              │                                                       │
│  danh sách   │  bản dịch / tóm tắt đã render đẹp như bài viết        │
│  thẻ (bar)   │                                                       │
└──────────────┴───────────────────────────────────────────────────────┘
```

Trên màn hình dưới 1024px, hai cột xếp dọc: sidebar trên, khung đọc dưới.

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

## 6. Ngăn Settings (drawer)

Trượt từ **phải**, rộng tối đa 448px, nền phủ đen 30%. Bấm ngoài, nút "Đóng (Esc)" hoặc phím Esc để đóng. Nếu còn thay đổi chưa lưu thì hỏi xác nhận bỏ.

**Header**: tiêu đề "Settings" + "Đóng (Esc)".

**2 tab** kiểu underline: **Chung** | **Prompt**. Tab có thay đổi chưa lưu hiện dấu • cạnh tên.

**Tab Chung**, từ trên xuống:
1. Chú thích: "Áp cho **mọi job**, kể cả job đã tạo. Lưu trong trình duyệt — API key không bao giờ được lưu trên server."
2. **API key** — ô password, placeholder `sk-...`. Dưới ô: "23 ký tự — nhớ bấm Lưu ở dưới." hoặc "Chưa nhập key thì Start sẽ bị chặn."
3. **Endpoint (base URL)** — ô text, mặc định `https://api.openai.com/v1`. Chú "App tự nối /chat/completions."
4. **Model** — ô text, mặc định `gpt-4o-mini`.
5. **Temperature: 0.2** — ô số, bước 0.1, từ 0 đến 2.
6. **Concurrency: 3** — thanh trượt 2 đến 6.
7. **Chunk tokens (ước lượng chars/4)** — ô số, mặc định 1500. Chú: "Đổi số này thì trang job sẽ nhắc chunk lại (chunk lại là mất bản dịch cũ)."
8. Đường kẻ, tiêu đề nhỏ **Tóm tắt**
9. Checkbox **Dùng ngữ cảnh chung khi dịch** (mặc định bật) + mô tả 2 dòng.
10. **Section tokens (gom chunk để tóm tắt)** — ô số, mặc định 6000.
11. **Context max tokens (ngưỡng gửi nguyên văn)** — ô số, mặc định 80000. Chú: "Tài liệu vượt ngưỡng thì gửi skeleton (heading + phần đầu mỗi section)."

**Tab Prompt**:
1. Chú thích: "App tự nối output contract vào cuối mỗi prompt — đừng tự viết luật thẻ trong này."
2. **System prompt (dịch)** — textarea 16 dòng mono. Dưới: chú "Nối thêm: bắt buộc thẻ <translation>." + link **Về mặc định** bên phải.
3. **Summary prompt (tóm tắt section)** — textarea 12 dòng, tương tự.
4. Chú thích: "Prompt tạo ngữ cảnh chung là cố định trong app — sửa kết quả trực tiếp ở tab Summary của từng job."

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

## 9. Hộp thoại xác nhận (hiện dùng `confirm()` mặc định của trình duyệt)

Designer nên thiết kế dialog riêng cho các trường hợp sau, đều là hành động **xoá dữ liệu không hoàn tác**:

| Khi | Nội dung hiện tại |
|---|---|
| Xoá job | Xoá job "tên"? Toàn bộ chunk sẽ mất. |
| Chunk lại | Chunk lại sẽ XOÁ toàn bộ bản dịch và tóm tắt section của job này. Tiếp tục? |
| Gom lại section | Gom lại section sẽ XOÁ toàn bộ tóm tắt section. Tiếp tục? |
| Tạo lại ngữ cảnh chung | Tạo lại sẽ ghi đè ngữ cảnh chung hiện có. Tiếp tục? |
| Đóng Settings còn thay đổi | Còn thay đổi chưa lưu. Đóng và bỏ luôn? |

---

## 10. Bảng màu và style đang dùng (để designer biết xuất phát điểm)

- Nền trang: xám rất nhạt (`neutral-50`), dark mode gần đen.
- Màu chính: xanh dương (`blue-600`) cho nút chính, tab active, viền thẻ đang chọn.
- Pause / hành động nguy hiểm nhẹ: hổ phách (`amber-600`).
- Xoá, lỗi: đỏ. Cảnh báo: vàng. Xong: xanh lá.
- Font: system sans. Nội dung kỹ thuật (số thứ tự, model, textarea, raw) dùng **mono 11px**, hơi nhỏ, khó đọc, designer cân nhắc.
- Bo góc nhỏ (4px), viền 1px, ít đổ bóng. Nhìn chung là "tool kỹ thuật", chưa có bản sắc.

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

Trang Jobs (mục 4) sẽ được làm lại theo `CR-v0.2-jobs-list.md`: search, lọc tag, favorite, archive, pin, phân trang. Designer đọc CR đó mục 5 khi thiết kế trang Jobs.
