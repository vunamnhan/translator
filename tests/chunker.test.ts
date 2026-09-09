import { describe, expect, it } from "vitest";
import {
  chunkByRule,
  chunkFlags,
  chunkMarkdown,
  estimateTokens,
  type ChunkRule,
} from "@/lib/chunker";
import { bigDoc, FRONT_MATTER } from "./fixture";

function concat(source: string, tokens: number) {
  return chunkMarkdown(source, tokens)
    .map((c) => c.source)
    .join("");
}

describe("chunkMarkdown", () => {
  it("giữ invariant concat(chunks) === original", () => {
    for (const tokens of [100, 300, 1500, 8000]) {
      expect(concat(FRONT_MATTER, tokens)).toBe(FRONT_MATTER);
      expect(concat(bigDoc(), tokens)).toBe(bigDoc());
    }
  });

  it("doc 100+ block chunk ra nhiều chunk", () => {
    const doc = bigDoc();
    const chunks = chunkMarkdown(doc, 300);
    expect(chunks.length).toBeGreaterThan(10);
    expect(chunks.every((c) => c.source.length > 0)).toBe(true);
  });

  it("front matter là chunk riêng, đánh dấu skip", () => {
    const chunks = chunkMarkdown(FRONT_MATTER, 1500);
    expect(chunks[0].skip).toBe(true);
    expect(chunks[0].source.startsWith("---\ntitle:")).toBe(true);
    expect(chunks.slice(1).every((c) => !c.skip)).toBe(true);
  });

  it("không cắt giữa code block dù vượt ngưỡng", () => {
    const code = "```js\n" + "// dòng code rất dài ".repeat(200) + "\n```\n";
    const doc = `# Tiêu đề\n\n${code}\nsau code\n`;
    const chunks = chunkMarkdown(doc, 100);
    expect(chunks.map((c) => c.source).join("")).toBe(doc);
    const holder = chunks.filter((c) => c.source.includes("```"));
    expect(holder.length).toBe(1);
    expect(holder[0].source.match(/```/g)?.length).toBe(2);
  });

  it("không cắt giữa table dù vượt ngưỡng", () => {
    const rows = Array.from({ length: 60 }, (_, i) => `| ô ${i} rất dài lắm luôn | ${i} |`).join("\n");
    const doc = `| A | B |\n|---|---|\n${rows}\n`;
    const chunks = chunkMarkdown(doc, 100);
    expect(chunks.length).toBe(1);
    expect(chunks[0].source).toBe(doc);
  });

  it("cắt paragraph siêu dài theo câu", () => {
    const para = Array.from({ length: 80 }, (_, i) => `Đây là câu số ${i} khá dài dòng.`).join(" ");
    const doc = `${para}\n`;
    const chunks = chunkMarkdown(doc, 60);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.source).join("")).toBe(doc);
  });

  it("heading mở chunk mới khi chunk hiện tại đã quá nửa ngưỡng", () => {
    const doc = `# A\n\n${"x".repeat(300)}\n\n## B\n\nngắn\n`;
    const chunks = chunkMarkdown(doc, 100);
    expect(chunks.some((c) => c.source.startsWith("## B"))).toBe(true);
    expect(chunks.map((c) => c.source).join("")).toBe(doc);
  });

  it("source rỗng → không có chunk", () => {
    expect(chunkMarkdown("", 1500)).toEqual([]);
  });
});

/* ── CR v0.4 — cắt theo quy tắc ─────────────────────────────────────────── */

const RULES: ChunkRule[] = [
  { kind: "auto", chunkTokens: 300 },
  { kind: "heading", maxLevel: 2 },
  { kind: "blank" },
  { kind: "marker", marker: "---" },
];

const CODEY = `# Tiêu đề

\`\`\`sh
# đây là comment, không phải heading

--- cũng không phải dấu ngắt
---
\`\`\`

Đoạn sau code.
`;

describe("chunkByRule", () => {
  it("mọi rule × mọi ca đều giữ concat === source", () => {
    const docs = [
      FRONT_MATTER,
      bigDoc(),
      CODEY,
      "chỉ một đoạn văn không có điểm ngắt nào cả",
      "# A\r\n\r\ndòng CRLF\r\n\r\n## B\r\n\r\nhết\r\n",
      "",
    ];
    for (const rule of RULES) {
      for (const doc of docs) {
        expect(chunkByRule(doc, rule).map((c) => c.source).join("")).toBe(doc);
      }
    }
  });

  it("heading: cắt ở H1/H2, H3 không cắt, heading nằm đầu chunk", () => {
    const doc = `mở đầu\n\n# A\n\nnội dung a\n\n### A3\n\nsâu\n\n## B\n\nnội dung b\n`;
    const parts = chunkByRule(doc, { kind: "heading", maxLevel: 2 }).map((c) => c.source);
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("mở đầu\n\n");
    expect(parts[1].startsWith("# A")).toBe(true);
    expect(parts[1].includes("### A3")).toBe(true);
    expect(parts[2].startsWith("## B")).toBe(true);
  });

  it("heading: cấp lớn hơn N không cắt", () => {
    const doc = `# A\n\nx\n\n## B\n\ny\n`;
    expect(chunkByRule(doc, { kind: "heading", maxLevel: 1 }).length).toBe(1);
    expect(chunkByRule(doc, { kind: "heading", maxLevel: 2 }).length).toBe(2);
  });

  it("blank: 3 đoạn cách nhau 1 và 2 dòng trống → 3 chunk, dòng trống ở cuối chunk trước", () => {
    const doc = `đoạn một\n\nđoạn hai\n\n\nđoạn ba\n`;
    const parts = chunkByRule(doc, { kind: "blank" }).map((c) => c.source);
    expect(parts).toEqual(["đoạn một\n\n", "đoạn hai\n\n\n", "đoạn ba\n"]);
    expect(parts.join("")).toBe(doc);
  });

  it("marker: dòng dấu ngắt mở chunk mới và không bị mất", () => {
    const doc = `phần một\n<!-- cut -->\nphần hai\n<!-- cut -->\nphần ba\n`;
    const parts = chunkByRule(doc, { kind: "marker", marker: "<!-- cut -->" }).map((c) => c.source);
    expect(parts.length).toBe(3);
    expect(parts[1].startsWith("<!-- cut -->\n")).toBe(true);
    expect(parts.join("")).toBe(doc);
  });

  it("không cắt ở # / --- / dòng trống nằm trong code fence", () => {
    for (const rule of RULES.slice(1)) {
      const parts = chunkByRule(CODEY, rule);
      const holder = parts.filter((p) => p.source.includes("```"));
      expect(holder.length).toBe(1);
      expect(holder[0].source.match(/```/g)?.length).toBe(2);
    }
  });

  it("front matter là chunk 0 riêng và skip với mọi rule", () => {
    for (const rule of RULES.slice(1)) {
      const parts = chunkByRule(FRONT_MATTER, rule);
      expect(parts[0].skip).toBe(true);
      expect(parts[0].source).toBe("---\ntitle: Tài liệu\ntags: [a, b]\n---\n");
      expect(parts.slice(1).every((p) => !p.skip)).toBe(true);
    }
  });

  it("không có điểm ngắt → đúng một chunk", () => {
    const doc = "chỉ một dòng duy nhất";
    for (const rule of RULES.slice(1)) {
      expect(chunkByRule(doc, rule).length).toBe(1);
    }
  });

  it("rule khác auto không đếm token: block 12k ký tự vẫn là một chunk", () => {
    const doc = "# A\n\n" + "x".repeat(12000) + "\n";
    const parts = chunkByRule(doc, { kind: "heading", maxLevel: 2 });
    expect(parts.length).toBe(1);
    expect(estimateTokens(parts[0].source)).toBeGreaterThan(2000);
  });
});

describe("chunkFlags", () => {
  it("phân mức theo cỡ và bắt code cắt đôi", () => {
    expect(chunkFlags("   \n", 1500)).toEqual(["empty"]);
    expect(chunkFlags("ngắn", 1500)).toEqual(["short"]);
    expect(chunkFlags("x".repeat(6000), 1000)).toEqual(["large"]);
    expect(chunkFlags("x".repeat(40000), 1500)).toEqual(["huge"]);
    expect(chunkFlags("```js\nconst a = 1;\n", 1500)).toContain("code-split");
    expect(chunkFlags("```js\nconst a = 1;\n```\n", 1500)).not.toContain("code-split");
  });

  it("front matter ngắn không bị gắn cờ 'short'", () => {
    expect(chunkFlags("---\nid: a\n---\n", 1500)).toEqual([]);
  });
});
