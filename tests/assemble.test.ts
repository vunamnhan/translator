import { describe, expect, it } from "vitest";
import { assembleMarkdown } from "@/lib/assemble";

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
