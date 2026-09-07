const BASE = process.env.BASE ?? "http://localhost:3010";
const doc = `---
title: Tài liệu thử
---

# Tiêu đề chính

Đoạn mở đầu có [link](https://example.com/docs) và ảnh ![logo](https://cdn.example.com/l.png).

## Phần code

\`\`\`ts
const answer = 42;   // giữ nguyên   spacing	tab
\`\`\`

## Bảng

| Cột A | Cột B |
|---|---|
| một | hai |
| ba | bốn |

## Phần dài

${Array.from({ length: 6 }, (_, i) => `### Mục ${i}\n\nĐoạn nội dung số ${i} viết dài ra để ép chunker cắt thành nhiều chunk khác nhau, mỗi đoạn tầm vài trăm ký tự cho chắc ăn. Lặp lại cho đủ độ dài. Lặp lại cho đủ độ dài.`).join("\n\n")}

Đoạn này chứa FORCE_NOTAG để ép mock LLM quên thẻ và phải nằm riêng một chunk cuối, nội dung dài ra chút cho chắc chắn tách chunk. Lặp lại cho đủ dài. Lặp lại cho đủ dài. Lặp lại cho đủ dài.
`;

const j = async (r) => {
  const t = await r.text();
  try { return JSON.parse(t); } catch { return t; }
};

const created = await j(await fetch(`${BASE}/api/jobs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "thu.md", source: doc, systemPrompt: "Dịch sang tiếng Việt.",
    model: "mock", endpoint: "http://localhost:9899/v1", chunkTokens: 100,
  }),
}));

const jobId = created.job.id;
console.log(`job ${jobId} · ${created.chunks.length} chunks`);
console.log("invariant concat === original:", created.chunks.map(c => c.source).join("") === doc);
console.log("chunk 0 skipped:", created.chunks[0].status === "skipped");

// dịch song song 3
const queue = created.chunks.filter(c => c.status === "pending");
let i = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (i < queue.length) {
    const c = queue[i++];
    const res = await fetch(`${BASE}/api/chunks/${c.id}/translate`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-llm-key": "sk-mock" },
      body: JSON.stringify({ endpoint: "http://localhost:9899/v1", model: "mock", systemPrompt: "Dịch.", temperature: 0.2 }),
    });
    const row = await j(res);
    console.log(`  #${row.idx} → ${row.status}${row.warning ? ` ⚠ ${row.warning}` : ""}${row.error ? ` ✖ ${row.error} (attempts=${row.attempts})` : ""}`);
  }
}));

const after = await j(await fetch(`${BASE}/api/jobs/${jobId}`));
const exported = await (await fetch(`${BASE}/api/jobs/${jobId}/export`)).text();

const origCode = doc.match(/```ts[\s\S]*?```/)[0];
const codeChunk = after.chunks.find(c => c.source.includes("```ts"));
console.log("chunk chứa code status:", codeChunk.status);
console.log("code block trong BẢN DỊCH byte-identical:", codeChunk.status === "done" && codeChunk.translated.includes(origCode));
console.log("mock đã cố dịch sai code (CONST_DICH_SAI) nhưng bị khôi phục:", !exported.includes("CONST_DICH_SAI"));
console.log("code block byte-identical trong export:", exported.includes(origCode));
console.log("có marker UNTRANSLATED:", exported.includes("<!-- UNTRANSLATED -->"));
console.log("front matter giữ nguyên:", exported.startsWith("---\ntitle: Tài liệu thử\n---"));
console.log("URL giữ nguyên:", exported.includes("https://example.com/docs") && exported.includes("https://cdn.example.com/l.png"));
console.log("thứ tự đúng:", exported.indexOf("Tiêu đề chính") < exported.indexOf("Phần code") && exported.indexOf("Phần code") < exported.indexOf("Bảng"));
console.log("không lẫn rác ngoài thẻ:", !exported.includes("Chào bạn, đây nè") && !exported.includes("Hết."));

const err = after.chunks.find(c => c.status === "error");
console.log("chunk lỗi có raw để xem:", Boolean(err?.rawResponse), "| attempts:", err?.attempts);

// sửa tay + re-translate 1 chunk
const target = after.chunks.find(c => c.status === "done");
await fetch(`${BASE}/api/chunks/${target.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ translated: "SỬA TAY" }) });
const edited = await j(await fetch(`${BASE}/api/jobs/${jobId}`));
const t2 = edited.chunks.find(c => c.id === target.id);
console.log("sửa tay:", t2.translated === "SỬA TAY", "| edited flag:", t2.edited);

await fetch(`${BASE}/api/chunks/${target.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceOverride: "# Nguồn sửa tay\n\n" }) });
const re = await j(await fetch(`${BASE}/api/chunks/${target.id}/translate`, {
  method: "POST", headers: { "content-type": "application/json", "x-llm-key": "sk-mock" },
  body: JSON.stringify({ endpoint: "http://localhost:9899/v1", model: "mock", systemPrompt: "Dịch.", temperature: 0.2 }),
}));
console.log("re-translate theo sourceOverride:", re.translated.includes("Nguồn sửa tay"));

// chặn http khi không bật cờ được test riêng ở unit test; ở đây test thiếu key
const noKey = await fetch(`${BASE}/api/chunks/${target.id}/translate`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ endpoint: "https://api.openai.com/v1", model: "m", systemPrompt: "x" }),
});
console.log("thiếu x-llm-key → 401:", noKey.status === 401);

// rechunk
const rc = await j(await fetch(`${BASE}/api/jobs/${jobId}/rechunk`, {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chunkTokens: 2000 }),
}));
console.log(`rechunk 2000 → ${rc.chunks.length} chunk · invariant:`, rc.chunks.map(c => c.source).join("") === doc, "· bản dịch bị xoá:", rc.chunks.every(c => c.translated === null));

// xoá job → chunks cascade
await fetch(`${BASE}/api/jobs/${jobId}`, { method: "DELETE" });
const gone = await fetch(`${BASE}/api/jobs/${jobId}`);
console.log("xoá job → 404:", gone.status === 404);
