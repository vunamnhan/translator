import { describe, expect, it } from "vitest";
import { buildContextInput, buildSections, type SectionInput } from "@/lib/sectioner";

function mk(idx: number, source: string, status = "pending"): SectionInput {
  return { idx, source, status };
}

/** ~1 token = 4 ký tự. */
function filler(tokens: number) {
  return "x".repeat(tokens * 4);
}

describe("buildSections", () => {
  it("gom hết chunk, không sót, dải liên tiếp", () => {
    const chunks = Array.from({ length: 100 }, (_, i) => mk(i, filler(200)));
    const sections = buildSections(chunks, 1000);

    expect(sections.length).toBeGreaterThan(1);
    expect(sections[0].chunkFrom).toBe(0);
    expect(sections[sections.length - 1].chunkTo).toBe(99);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i].chunkFrom).toBe(sections[i - 1].chunkTo + 1);
    }
  });

  it("bỏ chunk skipped (front matter) ra khỏi mọi section", () => {
    const chunks = [mk(0, "---\ntitle: x\n---\n", "skipped"), mk(1, "# A\n"), mk(2, "nội dung\n")];
    const sections = buildSections(chunks, 6000);
    expect(sections).toHaveLength(1);
    expect(sections[0].chunkFrom).toBe(1);
    expect(sections[0].chunkTo).toBe(2);
  });

  it("heading cấp 1/2 mở section mới khi section hiện tại đã ≥ 30% ngưỡng", () => {
    const chunks = [
      mk(0, `# Phần một\n${filler(400)}`),
      mk(1, `## Phần hai\n${filler(10)}`),
      mk(2, `### Không phải h1/h2\n${filler(400)}`),
    ];
    const sections = buildSections(chunks, 1000);
    expect(sections).toHaveLength(2);
    expect(sections[0].heading).toBe("Phần một");
    expect(sections[1].heading).toBe("Phần hai");
    expect(sections[1].chunkTo).toBe(2);
  });

  it("heading cấp 1/2 KHÔNG cắt khi section hiện tại còn quá ngắn", () => {
    const chunks = [mk(0, "# A\nngắn\n"), mk(1, "# B\nngắn\n")];
    const sections = buildSections(chunks, 6000);
    expect(sections).toHaveLength(1);
  });

  it("không có heading → đặt tên (đoạn N)", () => {
    const sections = buildSections([mk(0, "chỉ là đoạn văn")], 6000);
    expect(sections[0].heading).toBe("(đoạn 1)");
  });

  it("mỗi section không vượt ngưỡng quá 1 chunk", () => {
    const chunks = Array.from({ length: 20 }, (_, i) => mk(i, filler(300)));
    const sections = buildSections(chunks, 1000);
    for (const s of sections) {
      const n = s.chunkTo - s.chunkFrom + 1;
      // 1000 token / 300 token mỗi chunk → 4 chunk là vượt, không quá con số đó.
      expect(n).toBeLessThanOrEqual(4);
    }
  });
});

describe("buildContextInput", () => {
  const chunks = [mk(0, `# A\n${filler(500)}`), mk(1, `# B\n${filler(500)}`)];

  it("vừa ngưỡng → gửi nguyên văn", () => {
    const sections = buildSections(chunks, 6000);
    const out = buildContextInput(chunks, sections, 80000);
    expect(out.truncated).toBe(false);
    expect(out.text).toBe(chunks.map((c) => c.source).join(""));
  });

  it("vượt ngưỡng → skeleton có heading, ngắn hơn nguyên văn", () => {
    const sections = buildSections(chunks, 600);
    const out = buildContextInput(chunks, sections, 200);
    expect(out.truncated).toBe(true);
    expect(out.text).toContain("## A");
    expect(out.text.length).toBeLessThan(chunks.map((c) => c.source).join("").length);
  });

  it("skeleton giữ tối thiểu 300 ký tự mỗi section", () => {
    const many = Array.from({ length: 50 }, (_, i) => mk(i, `# H${i}\n${filler(500)}`));
    const sections = buildSections(many, 600);
    const out = buildContextInput(many, sections, 1000);
    expect(out.truncated).toBe(true);
    for (const part of out.text.split("\n\n## ")) {
      expect(part.length).toBeGreaterThan(280);
    }
  });
});
