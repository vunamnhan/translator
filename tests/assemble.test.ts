import { describe, expect, it } from "vitest";
import { assembleMarkdown, assembleSummary } from "@/lib/assemble";

describe("assembleMarkdown", () => {
  it("ghép đúng thứ tự, skipped dùng source, chưa dịch thì có marker", () => {
    const out = assembleMarkdown([
      { idx: 2, status: "pending", source: "C\n", translated: null },
      { idx: 0, status: "skipped", source: "---\na: 1\n---\n\n", translated: null },
      { idx: 1, status: "done", source: "B gốc\n\n", translated: "B dịch\n\n" },
    ]);
    expect(out).toBe("---\na: 1\n---\n\nB dịch\n\n<!-- UNTRANSLATED -->\nC\n");
  });
});

describe("assembleSummary", () => {
  it("context ở đầu, rồi ## heading + summary theo idx", () => {
    const md = assembleSummary("## Tổng quan\nTài liệu X", [
      { idx: 1, heading: "Phần hai", summary: "- b" },
      { idx: 0, heading: "Phần một", summary: "- a" },
    ]);
    expect(md).toBe("## Tổng quan\nTài liệu X\n\n## Phần một\n\n- a\n\n## Phần hai\n\n- b\n");
  });

  it("section chưa tóm tắt vẫn có heading, đánh dấu rõ", () => {
    const md = assembleSummary(null, [{ idx: 0, heading: "A", summary: null }]);
    expect(md).toBe("## A\n\n_(chưa tóm tắt)_\n");
  });
});
