import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "@/lib/chunker";
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
