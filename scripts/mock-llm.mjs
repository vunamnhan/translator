// Mock LLM: dịch = viết hoa chữ cái đầu + đổi nội dung code block (để test restore code block gốc).
import { createServer } from "node:http";

let calls = 0;
createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    calls += 1;
    const parsed = JSON.parse(body);
    const user = parsed.messages.find((m) => m.role === "user").content;
    const src = user.replace(/^<source>\n/, "").replace(/\n<\/source>$/, "");

    // Chunk chứa "FORCE_NOTAG" → cố tình quên thẻ để test retry.
    if (src.includes("FORCE_NOTAG")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: "Đây là bản dịch nè (quên thẻ)" } }] }));
      return;
    }

    // LLM "dịch" cả code block sai bét → app phải khôi phục byte gốc.
    const translated = src.replace(/^(\s*)(?![|`\-#>])(\p{L})/gmu, (m, sp, ch) => sp + ch.toUpperCase())
      .replace(/const /g, "CONST_DICH_SAI ");

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { content: `Chào bạn, đây nè:\n<translation>\n${translated}\n</translation>\nHết.` } }],
      })
    );
  });
}).listen(9899, () => console.log("mock llm on 9899"));
