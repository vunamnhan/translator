# Change Request v0.7 — Cửa sổ trượt ngữ cảnh khi dịch

Bổ sung cho `REQUIREMENTS.md` (v0) và các CR v0.1–v0.6. Mục đích: v0.5 chỉ bơm tóm tắt **một** đoạn liền trước, nên tầng giữa bị trống — ngữ cảnh chung nói về cả tài liệu ở mức khái quát, tóm tắt đoạn trước nói về đúng một đoạn, còn chục đoạn vừa rồi thì không có gì. Xưng hô vừa đổi, tên riêng vừa chọn cách dịch, giọng văn vừa thiết lập đều nằm ở tầng đó. CR này thay khối một đoạn bằng **khối ngữ cảnh mạch**: tóm tắt của mọi đoạn đã dịch, cộng **nguyên văn** N đoạn gần nhất, tất cả gói trong một ngân sách token.

Đã cân nhắc và **loại**: gửi nguyên văn toàn bộ phần đã dịch. Chi phí tăng theo bình phương (job 200 chunk × 1500 token tốn khoảng 30 triệu token input, so với 3 triệu của cách này), lỗi dịch sớm bị chép lại mãi, và khung "viết tiếp" đẩy model từ dịch sang sáng tác — phá ràng buộc 1-1 mà export, khôi phục code block và kiểm bảng / URL đang dựa vào.

## 1. Tóm tắt phạm vi

| # | Thay đổi | Ảnh hưởng |
|---|---|---|
| 1 | Setting `chainMode` ba nấc `off` / `prev` / `window` thay boolean `chainPrevSummary` | Settings, migration localStorage |
| 2 | Lib thuần `contextWindow.ts`: chọn nội dung + dựng khối, route và UI dùng chung | `src/lib` |
| 3 | Khối `<translated_so_far>` (tóm tắt xa + nguyên văn gần) thay `<previous_chunk_summary>` ở chế độ `window` | Contract, `llm.ts` |
| 4 | Ngân sách token cho cả khối, vượt thì cắt từ đầu xa nhất, có warning khi bị cắt | API, UI |
| 5 | Hai setting `contextWindowChunks`, `contextTokens` | Settings |
| 6 | **Placeholder trong prompt dịch** (`{{general_context}}`, `{{sliding_window_context}}`…): app thôi tự nối khối ngữ cảnh, chỉ còn tự nối output contract | `promptVars.ts`, prompt mặc định, Settings |

Ngoài phạm vi: gộp các tóm tắt bị cắt thành một khối tổng hợp (lần sau, xem 2.3); dịch lại dây chuyền khi đoạn xa đổi; áp cửa sổ cho luồng tóm tắt section hoặc cho Assistant Writer (v0.6); đưa khối ngữ cảnh vào `raw_response` hay export; đổi cách tính `jobs.context`.

**Không có migration DB.** `chunks.summary` và `chunks.translated` của v0.5 đã đủ nguyên liệu, `prev_summary_used` đổi nghĩa chứ không đổi kiểu (2.4). Số `0006` đã bị CR v0.6 giữ chỗ cho `writer_prompts`, v0.7 không đụng tới.

## 2. Quy tắc nghiệp vụ

### 2.1 Ba chế độ ngữ cảnh mạch (`chainMode`)

| Nấc | Khối bơm vào | Cần `chunkSummary`? | Vòng lặp |
|---|---|---|---|
| `off` | không | không | song song như v0.2 |
| `prev` | `<previous_chunk_summary>` — y hệt v0.5 | **có**, tắt thì không chọn được | 1-1 |
| `window` | `<translated_so_far>` — tóm tắt xa + nguyên văn gần | không bắt buộc | 1-1 |

- `window` **không** đòi `chunkSummary`: không có tóm tắt thì khối chỉ còn phần nguyên văn gần, vẫn chạy. Settings hiện chú vàng "Chưa bật Tạo tóm tắt chunk → khối chỉ có N đoạn gần nhất, không có phần xa".
- Tắt `chunkSummary` khi đang ở `prev` → về `off` (giữ luật v0.5). Đang ở `window` → **giữ nguyên** `window`.
- Hai khối `<translated_so_far>` và `<previous_chunk_summary>` **không bao giờ cùng xuất hiện**: ở `window` đoạn liền trước đã nằm nguyên văn trong cửa sổ rồi.

### 2.2 Chọn nội dung cho khối

Dịch chunk `k`. Server tự dựng khối từ DB, client không gửi nội dung đoạn nào lên.

1. Lấy mọi chunk cùng job có `idx < k`, bỏ chunk `skipped` (front matter). Gọi là danh sách trước.
2. **Cửa sổ nguyên văn**: đi ngược từ cuối danh sách trước, nhặt chunk `status = done` có `translated`, tối đa `contextWindowChunks` đoạn.
3. **Phần tóm tắt**: mọi chunk còn lại phía trước cửa sổ, `status = done` và `summary` khác null.
4. Chunk chưa `done`, hoặc `done` mà thiếu `summary`, thì **bỏ qua lặng lẽ** — không chèn chỗ trống, không warning. Riêng đoạn liền trước vẫn theo luật 409 của v0.5 (2.4).
5. Khối xếp theo **idx tăng dần**, phần tóm tắt trước, phần nguyên văn sau, đúng trình tự đọc.

### 2.3 Ngân sách và cắt bớt

Một con số duy nhất: `contextTokens`, ước lượng bằng `estimateTokens` sẵn có (chars / 4). Xếp chỗ theo thứ tự ưu tiên, **gần trước xa sau**:

1. Nguyên văn từ đoạn gần nhất lùi dần, còn chỗ thì thêm. Đoạn nào một mình đã vượt ngân sách thì bỏ khỏi cửa sổ và dùng `summary` của chính nó thay thế (chunk cắt theo rule ở v0.4 to nhỏ rất lệch, một đoạn 12 nghìn token là có thật).
2. Hết cửa sổ mới tới tóm tắt, cũng từ gần lùi dần.
3. Vượt ngân sách thì **bỏ tóm tắt xa nhất trước**. Đoạn càng xa càng ít ảnh hưởng câu đang dịch.

Bỏ mất từ một tóm tắt trở lên → chunk nhận `warning` "Ngữ cảnh bị cắt: bỏ N tóm tắt xa nhất". Dùng đúng ô warning hiện có, không thêm cột, không thêm kiểu thông báo mới.

Cắt xong khối vẫn rỗng (chunk đầu tài liệu, hoặc phía trước chưa dịch gì) → không bơm khối, không warning.

> Lần sau nâng được mà không đổi giao diện: thay "bỏ tóm tắt xa nhất" bằng "gộp chúng thành một khối tổng hợp cuộn". Chỗ nối là hàm thuần ở 2.6, phần còn lại không phải sửa.

### 2.4 Quan hệ với v0.5

- **Luật 409 giữ nguyên.** Đoạn liền trước (bỏ qua `skipped`) chưa `done` → `409 { error, brokenAt }`, không gọi LLM, không đổi status, trừ khi `force: true`. Áp cho cả `prev` lẫn `window`.
- **`force` ở chế độ `window`** nghĩa là dựng khối từ những gì đang có, thiếu đâu bỏ đó, cộng warning "Không có tóm tắt đoạn trước" như v0.5.
- **`chunks.prev_summary_used`** đổi nghĩa thành "lần dịch gần nhất có kèm khối ngữ cảnh mạch" (bất kể khối nào), kiểu và tên cột không đổi. Chip `⛓` giữ nguyên, đổi tooltip.
- **Cảnh báo "tóm tắt đoạn trước đã đổi"** vẫn chỉ soi đúng một đoạn liền trước. Cố ý: ở chế độ `window` thì đoạn nào cũng ảnh hưởng đoạn nào, mở rộng ra là nó kêu suốt ngày và mất hết ý nghĩa.
- Tạo tóm tắt chunk (`chunkSummary`) không đổi gì: vẫn đi chung cú gọi dịch, vẫn contract hai thẻ.

### 2.5 Vòng lặp

`chainMode !== "off"` → `runPool("translate")` ép pool = 1, theo idx tăng dần, dừng khi đứt chuỗi, banner hai nút. Y hệt v0.5 §2.3, chỉ đổi điều kiện bật từ `chainPrevSummary` sang `chainMode !== "off"`.

Chi phí và thời gian: khối ngữ cảnh làm input mỗi cú gọi phình lên, nên latency tăng theo. Settings nhắc: "Mỗi chunk gửi kèm tối đa `contextTokens` token ngữ cảnh — với nhiều key thì nên để đúng một key cho job này, vì xoay key làm hỏng prompt cache của provider."

### 2.6 Lib thuần dùng chung

`src/lib/contextWindow.ts`, không import DB, không gọi mạng:

```ts
pickContext(prev: ContextPiece[], opts: { windowChunks, contextTokens }): ContextPick
renderContextBlock(pick: ContextPick): string   // rỗng → ""
```
`ContextPick` gồm `summaries[]`, `verbatim[]`, `tokens`, `droppedSummaries`. Route dùng cả hai hàm để dựng khối; Settings và màn hình job dùng `pickContext` để ước lượng "sẽ gửi kèm khoảng X token". Một luật, hai nơi đọc, không chép thuật toán hai bản.

## 3. Data model

Không đổi bảng nào, không có migration. Nguyên liệu lấy từ `chunks.summary`, `chunks.translated`, `chunks.status`, `chunks.idx` đã có từ v0.5.

## 4. Prompt và contract

### 4.1 App thôi tự nối khối ngữ cảnh

Tới v0.6, app tự chèn `<document_context>`, `<previous_chunk_summary>` và câu hướng dẫn kèm theo vào system prompt. Câu chữ đó nằm trong code, người dùng không sửa được, mà nó lại là thứ quyết định model hiểu khối ngữ cảnh để làm gì.

Từ v0.7 đảo lại: **prompt dịch là của người dùng, app chỉ điền chỗ trống**. Người dùng đặt `{{ten_bien}}` ở đâu thì khối nằm ở đó, viết câu hướng dẫn quanh nó thế nào là tuỳ. Thứ **duy nhất** app còn tự nối là output contract, vì parser dựa vào thẻ `<translation>` — chỗ đó mà hỏng thì cả app hỏng.

Thứ tự system message rút còn:
```
[reminder nếu retry]
prompt dịch (preset) — đã điền placeholder
prompt tóm tắt chunk (preset)   (v0.5, nếu chunkSummary)
output contract                 (một thẻ hoặc hai thẻ)
```
Luồng tóm tắt section và tạo ngữ cảnh chung **không đổi**: hai luồng đó vẫn được app nối `<document_context>` như cũ.

### 4.2 Bảng biến

Cú pháp `{{ten}}` giống hệt placeholder của Assistant Writer (v0.6) để chỉ phải nhớ một kiểu.

| Biến | Nội dung | Có giá trị khi |
|---|---|---|
| `{{chunk_source}}` | Nội dung chunk đang dịch (bản gốc) | luôn luôn |
| `{{general_context}}` | Ngữ cảnh chung của job | bật "Dùng ngữ cảnh chung khi dịch" và job đã có ngữ cảnh chung |
| `{{sliding_window_context}}` | Tóm tắt các đoạn xa + nguyên văn mấy đoạn gần nhất | nấc `window` |
| `{{previous_chunk_summary}}` | Tóm tắt đoạn liền trước | nấc khác `off`, đoạn trước đã có tóm tắt |
| `{{previous_chunk_content}}` | Nguyên văn **bản dịch** đoạn liền trước | nấc khác `off`, đoạn trước đã dịch xong |
| `{{previous_chunk_source}}` | Nguyên văn **bản gốc** đoạn liền trước | nấc khác `off` |
| `{{full_source}}` | Toàn bộ văn bản gốc của job | luôn luôn |

- `{{chunk_source}}` trùng với thứ đã nằm trong `<source>` ở user message. Đặt vào là gửi hai lần — quyền của người dùng, nhưng có ghi chú nhắc.
- `{{full_source}}` chỉ query khi prompt thật sự nhắc tới: cột `jobs.source` có thể vài MB, không lôi ra cho mỗi cú gọi.
- Nội dung của `{{sliding_window_context}}` chỉ gồm phần dữ liệu (`<summaries>` và `<recent>`), **không** có thẻ bao ngoài, **không** có câu hướng dẫn. Hai thứ đó người dùng tự viết.

### 4.3 Luật điền

- Thay **một lượt, không đệ quy**: giá trị chứa `{{x}}` không bị quét lại.
- Biến rỗng → **bỏ cả đoạn văn** chứa nó, đoạn = khối dòng liền nhau ngăn bằng dòng trống. Nhờ vậy người dùng gói thẻ, biến và câu hướng dẫn chung một đoạn; không có ngữ cảnh thì cả cụm biến mất chứ không để lại thẻ rỗng lơ lửng.
- Đoạn có nhiều biến chỉ bị bỏ khi **mọi** biến trong đó đều rỗng.
- Placeholder lạ (`{{gi_do}}`) **giữ nguyên chữ**: đó là văn bản của người dùng, app không có quyền xoá.
- Cách xuống dòng của các đoạn còn lại giữ nguyên, chỉ cắt khoảng trắng thừa ở cuối chuỗi.

### 4.4 Prompt dịch mặc định

`DEFAULT_SYSTEM_PROMPT` mang sẵn ba khối kèm biến, mỗi khối một đoạn văn, nên bật tính năng lên là chạy đúng như v0.6 mà vẫn sửa được từng chữ:

```
Bạn là dịch giả chuyên nghiệp. Dịch văn bản Markdown sau sang tiếng Việt.
Yêu cầu:
- …

<document_context>
{{general_context}}
</document_context>
Dùng ngữ cảnh trên để hiểu tài liệu và giữ thuật ngữ nhất quán. Chỉ xử lý nội dung trong <source>.

<translated_so_far>
{{sliding_window_context}}
</translated_so_far>
Đây là phần đã dịch trước đoạn cần dịch, xếp theo thứ tự: tóm tắt các đoạn xa trước, nguyên văn mấy đoạn gần nhất sau.
Dùng khối này để giữ mạch, giọng văn, cách xưng hô và cách dịch tên riêng cho nhất quán.
KHÔNG dịch lại, KHÔNG viết tiếp, KHÔNG lặp lại bất kỳ nội dung nào trong khối này. Chỉ dịch đúng phần nằm trong <source>.

<previous_chunk_summary>
{{previous_chunk_summary}}
</previous_chunk_summary>
Đây là tóm tắt đoạn ngay trước đoạn cần dịch, chỉ để hiểu mạch và giữ giọng, xưng hô nhất quán. Không dịch, không lặp lại nội dung này.
```

Ba câu cấm ở khối giữa vẫn là thứ quan trọng nhất về chất lượng, nhưng giờ nó là **mặc định gợi ý**, không phải luật cứng: nhìn thấy vài nghìn token văn xuôi của chính mình mà không bị cấm thì model rất dễ kể tiếp thay vì dịch.

Preset đã lưu trên DB từ trước **không** có placeholder. App không tự sửa prompt của ai; Settings hiện cảnh báo (§6.2) để người dùng tự thêm biến hoặc bấm "Về mặc định" rồi lưu lại vào preset.

## 5. API (delta)

### 5.1 `POST /api/chunks/:id/translate` — body nhận thêm

```
chainMode?:           "off" | "prev" | "window"   // thay usePrevSummary
contextWindowChunks?: number                       // 0..20, mặc định 3
contextTokens?:       number                       // 500..100000, mặc định 6000
```
- `usePrevSummary: true` của v0.5 vẫn nhận, hiểu là `chainMode: "prev"` (client cũ không vỡ).
- Ngoài ngân sách thì kẹp về biên, không trả 400.
- Phản hồi giữ nguyên hình dạng: vẫn là chunk DTO. Thông tin cắt bớt đi bằng `warning`, không thêm field, không đổi kiểu trả về.

Không route mới, không đổi `PATCH /api/chunks/:id`, không đụng preset.

## 6. UI

### 6.1 Settings — tab Chung

Thay checkbox "Gửi kèm tóm tắt chunk trước" bằng cụm ba nấc:

```
Ngữ cảnh mạch khi dịch
( ) Tắt
( ) Tóm tắt đoạn liền trước          ← mờ khi chưa bật Tạo tóm tắt chunk
(•) Cửa sổ trượt
     Cửa sổ                    [ 3 ]
     Trần ngữ cảnh (token)     [ 6000 ]
```
- Hai ô con chỉ hiện ở nấc `window`.
- Chú dưới cụm: "Dịch tuần tự 1-1, bỏ qua Concurrency. Mỗi chunk gửi kèm tối đa 6000 token ngữ cảnh, nên tốn token hơn hẳn — và nhiều key làm hỏng prompt cache, job này nên để một key."
- Ô Concurrency vẫn mờ kèm chữ "đang bị ép = 1 (chuỗi)" khi nấc khác `off`.

### 6.2 Settings — tab Prompt

Dưới ô **System prompt (dịch)**:
- Chú thích đổi lại: app chỉ nối thêm đúng luật thẻ `<translation>`, mọi khối ngữ cảnh đều do placeholder quyết định — không đặt vào prompt thì không gửi.
- **Bảng biến**, gập lại mặc định: một dòng "Biến dùng được trong prompt (7)" bấm để xổ. Mở ra là danh sách bấm được, mỗi dòng một tên biến (font mono) kèm một câu mô tả; bấm vào là chép `{{ten}}` vào clipboard và hiện chữ "đã chép" khoảng 1,5 giây. Đầu danh sách nhắc luật "biến rỗng thì cả đoạn văn chứa nó biến mất".

Cố ý **không** cảnh báo khi prompt thiếu biến: prompt là của người dùng, bỏ biến đi có thể là chủ ý. Bảng help nói rõ biến nào cần điều kiện gì là đủ.

### 6.3 Header job

Chip đổi theo nấc: `Chuỗi 1-1` cho `prev`, `Cửa sổ 3 + tóm tắt` cho `window`. Tooltip nói rõ khối đang gửi gồm gì.

### 6.4 Thẻ chunk

- Chip `⛓` giữ nguyên, tooltip đổi thành "Dịch có kèm ngữ cảnh mạch".
- Warning "Ngữ cảnh bị cắt: bỏ N tóm tắt xa nhất" hiện chung chỗ warning hiện có.
- Hàng gấp mở "Tóm tắt" của v0.5 không đổi.

### 6.5 Ghi chú cho designer

Không màn hình mới. Đổi một checkbox thành cụm radio ba nấc kèm hai ô số, thêm một bảng biến gập được (bấm-để-chép) dưới ô prompt dịch, đổi chữ trên một chip, thêm một câu warning.

## 7. Cấu hình (delta Settings, localStorage)

| Key | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `chainMode` | `"off" \| "prev" \| "window"` | `"off"` | Thay `chainPrevSummary` |
| `contextWindowChunks` | number | `3` | 0..20. 0 = chỉ tóm tắt, không nguyên văn |
| `contextTokens` | number | `6000` | 500..100000, trần cho cả khối |

Chuyển bản cũ khi đọc localStorage, cùng chỗ đã chuyển `apiKey` → `apiKeys`: `chainPrevSummary === true` → `chainMode = "prev"`, ngược lại `"off"`. Xong thì bỏ hẳn khoá cũ.

## 8. Tiêu chí hoàn thành

1. Prompt dịch không có biến nào: system message = đúng prompt đó + prompt tóm tắt chunk (nếu bật) + output contract, không có khối ngữ cảnh nào bị chèn thêm.
2. `chainMode = "prev"`, prompt mặc định: đoạn `<previous_chunk_summary>` được điền, đoạn `<translated_so_far>` biến mất cả thẻ lẫn câu hướng dẫn.
3. `chainMode = "window"`, cửa sổ 3, đã dịch xong 10 đoạn: `{{sliding_window_context}}` được thay bằng `<summaries>` chứa đúng tóm tắt đoạn 0–6 theo idx tăng dần và `<recent>` chứa nguyên văn đoạn 7, 8, 9.
4. Đoạn 4 chưa dịch (các đoạn khác xong): nó bị bỏ khỏi khối, không có chỗ trống, không warning, đoạn 5 vẫn nằm đúng thứ tự sau đoạn 3.
5. Front matter (`skipped`) không bao giờ xuất hiện trong khối, và không tính vào cửa sổ.
6. `contextTokens` để 1000 với job dài: khối cắt còn ≤ 1000 token ước lượng, giữ đủ phần nguyên văn gần nhất, chunk có warning "Ngữ cảnh bị cắt: bỏ N tóm tắt xa nhất" với N đúng.
7. Một đoạn trong cửa sổ dài hơn cả ngân sách: nó rơi khỏi `<recent>`, tóm tắt của chính nó vào `<summaries>`, không có khối nào vượt trần.
8. `chunkSummary` tắt, `chainMode = "window"`: nội dung biến chỉ có `<recent>`, không có thẻ `<summaries>` rỗng; Settings hiện chú vàng.
8b. Bỏ `{{sliding_window_context}}` khỏi prompt trong lúc nấc cửa sổ đang bật: cú dịch kế **không** có khối ngữ cảnh nào — app không tự chèn bù, cũng không cằn nhằn.
8c. Prompt có `{{khong_biet}}`: giữ nguyên chữ trong system message, không bị xoá, không báo lỗi.
9. Tắt `chunkSummary` khi đang ở `prev` → về `off`; đang ở `window` → giữ `window`.
10. Đoạn liền trước đang `pending`, `chainMode = "window"`, không `force` → `409 { brokenAt }`, status chunk không đổi, không có request tới LLM.
11. `force: true` → dịch được, khối dựng từ phần đã có, warning "Không có tóm tắt đoạn trước".
12. Bật `window` → vòng lặp chạy đúng một request tại một thời điểm, theo idx tăng dần; chip header ghi `Cửa sổ 3 + tóm tắt`.
13. Bản lưu cũ có `chainPrevSummary: true` → load lên thành `chainMode: "prev"`, khoá cũ biến mất khỏi localStorage sau lần lưu kế.
14. `pickContext` có test riêng cho: cửa sổ đủ chỗ, cửa sổ bị cắt, tóm tắt bị bỏ, danh sách trước rỗng, một đoạn quá khổ. `fillPrompt` có test cho: biến rỗng bỏ cả đoạn, đoạn nhiều biến, placeholder lạ, không đệ quy, giữ cách xuống dòng.
15. `npm test` pass; export bản dịch và export tóm tắt không chứa khối ngữ cảnh.
16. Không có API key trong khối ngữ cảnh, `raw_response` hay log.
