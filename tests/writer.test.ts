import { describe, expect, it } from "vitest";
import {
  appendBlock,
  copyName,
  draftModified,
  fieldLabel,
  fillTemplate,
  MAX_FIELD_VALUE,
  MAX_WRITER_NAME,
  MAX_WRITER_TEMPLATE,
  normalizeFields,
  normalizeTemperature,
  parseTemplate,
  pruneFields,
  sameFields,
  validateWriterInput,
  type WriterPromptDTO,
} from "../src/lib/writerPrompts";

const seed = `Dựa vào văn bản sau:\n\n{{text}}\n\nHãy {{yeu_cau}}.\nGiọng văn: {{giong_van}}.`;

describe("parseTemplate", () => {
  it("sinh ô theo thứ tự xuất hiện, bỏ {{text}}", () => {
    expect(parseTemplate(seed)).toEqual({ names: ["yeu_cau", "giong_van"], hasText: true });
  });

  it("trùng tên → một ô", () => {
    expect(parseTemplate("Hãy {{a}} rồi {{b}} và lại {{a}}").names).toEqual(["a", "b"]);
  });

  it("cho khoảng trắng trong dấu ngoặc", () => {
    expect(parseTemplate("{{ ten_o }}").names).toEqual(["ten_o"]);
  });

  it("bỏ qua thứ không phải placeholder hợp lệ", () => {
    const t = "Thẻ <source> và {x} và {{a b}} và {{}} và {{" + "x".repeat(41) + "}}";
    expect(parseTemplate(t)).toEqual({ names: [], hasText: false });
  });

  it("không có {{text}} → hasText false", () => {
    expect(parseTemplate("Viết {{gi}} đi").hasText).toBe(false);
  });
});

describe("fillTemplate", () => {
  it("thay mọi chỗ, kể cả placeholder lặp lại", () => {
    expect(fillTemplate("Hãy {{a}} rồi {{b}} và lại {{a}}", { a: "chạy", b: "nghỉ" }, "")).toBe(
      "Hãy chạy rồi nghỉ và lại chạy"
    );
  });

  it("{{text}} lấy nội dung nơi gắn popup", () => {
    expect(fillTemplate(seed, { yeu_cau: "tóm tắt", giong_van: "gọn" }, "# Tài liệu")).toBe(
      "Dựa vào văn bản sau:\n\n# Tài liệu\n\nHãy tóm tắt.\nGiọng văn: gọn."
    );
  });

  it("ô rỗng / thiếu key → chuỗi rỗng, vẫn chạy được", () => {
    expect(fillTemplate("A{{a}}B{{b}}C", { a: "" }, "")).toBe("ABC");
  });

  it("không đệ quy: giá trị chứa {{b}} không bị thay tiếp", () => {
    expect(fillTemplate("{{a}} và {{b}}", { a: "{{b}}", b: "X" }, "")).toBe("{{b}} và X");
  });

  it("giữ nguyên chữ với <source> và ngoặc đơn", () => {
    expect(fillTemplate("<source> {x} {{a b}}", {}, "T")).toBe("<source> {x} {{a b}}");
  });
});

describe("fieldLabel", () => {
  it("gạch dưới thành khoảng trắng", () => {
    expect(fieldLabel("noi_dung_1")).toBe("noi dung 1");
  });
});

describe("normalizeFields / pruneFields / sameFields", () => {
  it("bỏ key text và giá trị không phải chuỗi", () => {
    expect(normalizeFields({ a: "1", text: "x", b: 3 })).toEqual({ a: "1" });
  });

  it("không phải object → rỗng", () => {
    expect(normalizeFields(["a"])).toEqual({});
    expect(normalizeFields(null)).toEqual({});
  });

  it("prune giữ key rỗng đang có trong template, bỏ key rỗng thừa", () => {
    expect(pruneFields({ a: "", b: "", c: "x" }, ["a"])).toEqual({ a: "", c: "x" });
  });

  it("rỗng và vắng mặt là một", () => {
    expect(sameFields({ a: "x", b: "" }, { a: "x" })).toBe(true);
    expect(sameFields({ a: "x" }, { a: "y" })).toBe(false);
  });
});

describe("normalizeTemperature", () => {
  it("null / rỗng → null (theo Settings)", () => {
    expect(normalizeTemperature(null)).toBeNull();
    expect(normalizeTemperature("")).toBeNull();
    expect(normalizeTemperature("abc")).toBeNull();
  });

  it("kẹp 0..2, làm tròn bước 0.1", () => {
    expect(normalizeTemperature(0.74)).toBe(0.7);
    expect(normalizeTemperature(9)).toBe(2);
    expect(normalizeTemperature(-1)).toBe(0);
  });
});

describe("validateWriterInput", () => {
  const full = { name: "Viết lại", template: "Viết lại {{text}}", fields: { a: "1" }, temperature: 0.3 };

  it("nhận bộ đủ field", () => {
    expect(validateWriterInput(full)).toBeNull();
  });

  it("từ chối tên rỗng / quá dài", () => {
    expect(validateWriterInput({ ...full, name: "  " })).toBe("Thiếu tên mẫu");
    expect(validateWriterInput({ ...full, name: "x".repeat(MAX_WRITER_NAME + 1) })).toMatch(
      /Tên mẫu quá/
    );
  });

  it("từ chối template rỗng / quá dài", () => {
    expect(validateWriterInput({ ...full, template: "" })).toBe("Thiếu template");
    expect(validateWriterInput({ ...full, template: "x".repeat(MAX_WRITER_TEMPLATE + 1) })).toMatch(
      /Template quá/
    );
  });

  it("mẫu tĩnh không placeholder vẫn hợp lệ", () => {
    expect(validateWriterInput({ ...full, template: "Chào" })).toBeNull();
  });

  it("fields phải là object phẳng, value là chuỗi trong giới hạn", () => {
    expect(validateWriterInput({ ...full, fields: ["a"] })).toMatch(/object phẳng/);
    expect(validateWriterInput({ ...full, fields: { a: 1 } })).toMatch(/phải là chuỗi/);
    expect(
      validateWriterInput({ ...full, fields: { a: "x".repeat(MAX_FIELD_VALUE + 1) } })
    ).toMatch(/quá/);
  });

  it("temperature ngoài 0..2 → lỗi, null thì được", () => {
    expect(validateWriterInput({ ...full, temperature: 3 })).toMatch(/0\.\.2/);
    expect(validateWriterInput({ ...full, temperature: null })).toBeNull();
  });

  it("partial bỏ qua field vắng mặt", () => {
    expect(validateWriterInput({ fields: { a: "1" } }, true)).toBeNull();
    expect(validateWriterInput({}, true)).toBeNull();
    expect(validateWriterInput({})).toBe("Thiếu tên mẫu");
  });
});

describe("draftModified", () => {
  const prompt: WriterPromptDTO = {
    id: "p1",
    name: "M",
    template: "Hãy {{a}}",
    fields: { a: "x" },
    temperature: 0.7,
    updatedAt: "now",
  };
  const draft = { promptId: "p1", template: "Hãy {{a}}", values: { a: "x" }, temperature: 0.7, result: "" };

  it("chưa đụng gì → false", () => {
    expect(draftModified(draft, prompt)).toBe(false);
  });

  it("đổi giá trị / template / temperature → true", () => {
    expect(draftModified({ ...draft, values: { a: "y" } }, prompt)).toBe(true);
    expect(draftModified({ ...draft, template: "Hãy {{a}} nhé" }, prompt)).toBe(true);
    expect(draftModified({ ...draft, temperature: null }, prompt)).toBe(true);
  });

  it("không có mẫu đang chọn → không bao giờ 'đã sửa'", () => {
    expect(draftModified({ ...draft, promptId: null }, null)).toBe(false);
  });
});

describe("appendBlock", () => {
  it("ô đang rỗng → không thêm gì", () => {
    expect(appendBlock("", "mới")).toBe("mới");
  });

  it("chưa kết thúc bằng dòng trống → thêm dòng trống ngăn cách", () => {
    expect(appendBlock("cũ", "mới")).toBe("\n\nmới");
    expect(appendBlock("cũ\n", "mới")).toBe("\nmới");
    expect(appendBlock("cũ\n\n", "mới")).toBe("mới");
  });
});

describe("copyName", () => {
  it("gợi ý tên khi lưu thành mẫu mới", () => {
    expect(copyName("M")).toBe("M (copy)");
    expect(copyName(null)).toBe("Mẫu mới");
  });
});
