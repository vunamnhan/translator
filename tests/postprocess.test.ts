import { describe, expect, it } from "vitest";
import {
  checkRatio,
  extractTranslation,
  postProcess,
  restoreCodeBlocks,
  validateTables,
  validateUrls,
} from "@/lib/postprocess";

describe("extractTranslation", () => {
  it("lấy đúng nội dung, bỏ rác ngoài thẻ", () => {
    const raw = `Chào bạn! Đây là bản dịch:\n<translation>\n# Tiêu đề\n</translation>\nCòn gì nữa không?`;
    expect(extractTranslation(raw)).toBe("# Tiêu đề");
  });

  it("lấy cặp thẻ đầu tiên", () => {
    const raw = `<translation>một</translation><translation>hai</translation>`;
    expect(extractTranslation(raw)).toBe("một");
  });

  it("không có thẻ → null", () => {
    expect(extractTranslation("dịch xong rồi nè")).toBeNull();
  });
});

describe("restoreCodeBlocks", () => {
  it("code block byte-identical với gốc", () => {
    const source = "Xem code:\n\n```ts\nconst a = 1; // giữ nguyên\n```\n";
    const translated = "See code:\n\n```ts\nconst a = 1; // KEPT translated wrongly\n```\n";
    const out = restoreCodeBlocks(source, translated);
    expect(out.warning).toBeNull();
    expect(out.text).toContain("const a = 1; // giữ nguyên");
    expect(out.text).not.toContain("KEPT translated wrongly");
  });

  it("lệch số code block → warning", () => {
    const source = "```js\na\n```\n\n```js\nb\n```\n";
    const translated = "```js\na\n```\n";
    const out = restoreCodeBlocks(source, translated);
    expect(out.warning).toMatch(/lệch/);
  });
});

describe("validate", () => {
  it("bảng khớp cấu trúc", () => {
    const s = "| A | B |\n|---|---|\n| 1 | 2 |\n";
    const t = "| A2 | B2 |\n|---|---|\n| 1 | 2 |\n";
    expect(validateTables(s, t)).toBeNull();
    expect(validateTables(s, "| A |\n|---|\n| 1 |\n")).toMatch(/cột|dòng/);
  });

  it("URL giữ nguyên", () => {
    const s = "[a](https://x.com) và ![i](https://y.com/i.png)";
    expect(validateUrls(s, "[a2](https://x.com) và ![i2](https://y.com/i.png)")).toBeNull();
    expect(validateUrls(s, "[a2](https://z.com) và ![i2](https://y.com/i.png)")).toMatch(/URL/);
  });

  it("ratio bất thường", () => {
    expect(checkRatio("x".repeat(100), "y".repeat(1000))).toMatch(/dài/);
    expect(checkRatio("x".repeat(100), "y".repeat(10))).toMatch(/ngắn/);
    expect(checkRatio("x".repeat(100), "y".repeat(120))).toBeNull();
  });
});

describe("postProcess", () => {
  it("gom nhiều warning", () => {
    const source = "| A | B |\n|---|---|\n| 1 | 2 |\n\n```js\nx\n```\n";
    const out = postProcess(source, "| A |\n|---|\n| 1 |\n");
    expect(out.warning).toMatch(/code block/);
    expect(out.warning).toMatch(/Bảng|bảng/);
  });
});
