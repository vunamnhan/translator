import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../src/lib/defaults";
import { fillPrompt, hasVar, PROMPT_VARS } from "../src/lib/promptVars";

const PROMPT = `Dịch sang tiếng Việt.

<document_context>
{{general_context}}
</document_context>
Dùng ngữ cảnh trên cho nhất quán.

<translated_so_far>
{{sliding_window_context}}
</translated_so_far>
KHÔNG dịch lại phần này.`;

describe("fillPrompt", () => {
  it("thay biến có giá trị, giữ nguyên phần còn lại", () => {
    const out = fillPrompt(PROMPT, {
      general_context: "Tài liệu về X",
      sliding_window_context: "<recent>\n#3:\nđoạn trước\n</recent>",
    });

    expect(out).toContain("<document_context>\nTài liệu về X\n</document_context>");
    expect(out).toContain("đoạn trước");
    expect(out.startsWith("Dịch sang tiếng Việt.")).toBe(true);
  });

  it("biến rỗng → bỏ cả đoạn văn chứa nó, không để lại thẻ rỗng", () => {
    const out = fillPrompt(PROMPT, { general_context: "Tài liệu về X" });

    expect(out).toContain("<document_context>");
    expect(out).not.toContain("<translated_so_far>");
    expect(out).not.toContain("KHÔNG dịch lại");
    expect(out).not.toContain("{{");
  });

  it("rỗng hết → chỉ còn đoạn không có biến", () => {
    expect(fillPrompt(PROMPT, {})).toBe("Dịch sang tiếng Việt.");
  });

  it("null và chuỗi trắng đều coi như rỗng", () => {
    expect(fillPrompt("a\n\n{{general_context}}", { general_context: null })).toBe("a");
    expect(fillPrompt("a\n\n{{general_context}}", { general_context: "   " })).toBe("a");
  });

  it("đoạn có nhiều biến chỉ bị bỏ khi mọi biến đều rỗng", () => {
    const tpl = "{{previous_chunk_summary}} / {{previous_chunk_content}}";
    expect(fillPrompt(tpl, { previous_chunk_content: "bản dịch" })).toBe(" / bản dịch");
    expect(fillPrompt(tpl, {})).toBe("");
  });

  it("placeholder lạ giữ nguyên chữ, không bị xoá cũng không bị thay", () => {
    const out = fillPrompt("giữ {{khong_biet}} lại\n\n{{general_context}}", {});
    expect(out).toBe("giữ {{khong_biet}} lại");
  });

  it("không thay đệ quy: giá trị chứa {{x}} không bị quét lại", () => {
    const out = fillPrompt("{{chunk_source}}", { chunk_source: "{{general_context}}" });
    expect(out).toBe("{{general_context}}");
  });

  it("giữ nguyên cách xuống dòng của các đoạn còn lại", () => {
    const tpl = "a\n\nb\nc\n\n{{general_context}}\n\nd";
    expect(fillPrompt(tpl, {})).toBe("a\n\nb\nc\n\nd");
  });
});

describe("hasVar", () => {
  it("nhận cả dạng có khoảng trắng trong ngoặc", () => {
    expect(hasVar("x {{ general_context }} y", "general_context")).toBe(true);
    expect(hasVar("x {{general_contextt}} y", "general_context")).toBe(false);
  });
});

describe("prompt dịch mặc định", () => {
  it("mang sẵn ba biến ngữ cảnh nên bật tính năng lên là chạy được ngay", () => {
    for (const name of [
      "general_context",
      "sliding_window_context",
      "previous_chunk_summary",
    ] as const) {
      expect(hasVar(DEFAULT_SETTINGS.systemPrompt, name)).toBe(true);
    }
  });

  it("không có ngữ cảnh nào thì rút về đúng phần yêu cầu dịch", () => {
    const out = fillPrompt(DEFAULT_SETTINGS.systemPrompt, {});
    expect(out).not.toContain("{{");
    expect(out).not.toContain("<document_context>");
    expect(out).not.toContain("<translated_so_far>");
    expect(out).toContain("Dịch tự nhiên, không dịch máy móc từng từ.");
  });

  it("mọi biến trong bảng help đều có tên hợp lệ và có mô tả", () => {
    for (const v of PROMPT_VARS) {
      expect(v.name).toMatch(/^[a-z0-9_]+$/);
      expect(v.hint.length).toBeGreaterThan(0);
    }
  });
});
