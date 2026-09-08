import { describe, expect, it } from "vitest";
import { hasTag, normalizeTag, normalizeTags } from "../src/lib/tags";

describe("normalizeTag", () => {
  it("trim và gộp khoảng trắng, giữ hoa thường", () => {
    expect(normalizeTag("  Tax   AI  ")).toBe("Tax AI");
  });

  it("cắt còn 32 ký tự", () => {
    expect(normalizeTag("a".repeat(40))).toHaveLength(32);
  });
});

describe("normalizeTags", () => {
  it("bỏ rỗng và gộp trùng không phân biệt hoa thường", () => {
    expect(normalizeTags(["api", "API", "  ", "spec"])).toEqual(["api", "spec"]);
  });

  it("cắt còn 20 tag", () => {
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });

  it("bỏ phần tử không phải chuỗi", () => {
    expect(normalizeTags(["ok", 1, null] as unknown[])).toEqual(["ok"]);
  });

  it("không phải mảng thì ra mảng rỗng", () => {
    expect(normalizeTags("api")).toEqual([]);
  });
});

describe("hasTag", () => {
  it("so trùng không phân biệt hoa thường", () => {
    expect(hasTag(["api"], "API")).toBe(true);
    expect(hasTag(["api"], "apis")).toBe(false);
  });
});
