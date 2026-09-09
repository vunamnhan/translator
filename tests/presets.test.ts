import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../src/lib/http";
import {
  contractWarning,
  copyName,
  MAX_PRESET_NAME,
  MAX_PROMPT_CHARS,
  normalizeContextPrompt,
  normalizeName,
  presetPromptSet,
  samePromptSet,
  validatePresetInput,
  type PresetDTO,
} from "../src/lib/presets";

const full = {
  name: "Truyện",
  translatePrompt: "dịch",
  summaryPrompt: "tóm tắt",
  contextPrompt: "ngữ cảnh",
};

describe("validatePresetInput", () => {
  it("nhận bộ đủ field", () => {
    expect(validatePresetInput(full)).toBeNull();
  });

  it("từ chối tên rỗng / chỉ khoảng trắng", () => {
    expect(validatePresetInput({ ...full, name: "   " })).toBe("Thiếu tên preset");
  });

  it("từ chối tên quá dài", () => {
    expect(validatePresetInput({ ...full, name: "x".repeat(MAX_PRESET_NAME + 1) })).toMatch(
      /Tên preset quá/
    );
  });

  it("bắt buộc prompt dịch và prompt tóm tắt", () => {
    expect(validatePresetInput({ ...full, translatePrompt: "" })).toBe("Thiếu prompt dịch");
    expect(validatePresetInput({ ...full, summaryPrompt: undefined })).toBe("Thiếu prompt tóm tắt");
  });

  it("chặn prompt quá dài", () => {
    expect(validatePresetInput({ ...full, translatePrompt: "x".repeat(MAX_PROMPT_CHARS + 1) })).toMatch(
      /quá 20000/
    );
  });

  it("context prompt là tuỳ chọn, null hợp lệ", () => {
    expect(validatePresetInput({ ...full, contextPrompt: null })).toBeNull();
    expect(validatePresetInput({ name: "a", translatePrompt: "b", summaryPrompt: "c" })).toBeNull();
  });

  it("PATCH bỏ qua field vắng mặt", () => {
    expect(validatePresetInput({ name: "Chỉ đổi tên" }, true)).toBeNull();
    expect(validatePresetInput({}, true)).toBeNull();
    expect(validatePresetInput({ name: "  " }, true)).toBe("Thiếu tên preset");
  });
});

describe("normalize", () => {
  it("trim tên", () => {
    expect(normalizeName("  Truyện  ")).toBe("Truyện");
    expect(normalizeName(42)).toBe("");
  });

  it("context prompt rỗng thành null — '' và null cùng nghĩa dùng prompt của app", () => {
    expect(normalizeContextPrompt("")).toBeNull();
    expect(normalizeContextPrompt("   \n ")).toBeNull();
    expect(normalizeContextPrompt(null)).toBeNull();
    expect(normalizeContextPrompt(" giữ nguyên cả khoảng trắng ")).toBe(
      " giữ nguyên cả khoảng trắng "
    );
  });
});

describe("samePromptSet", () => {
  const preset: PresetDTO = {
    id: "p1",
    name: "Truyện",
    translatePrompt: "dịch",
    summaryPrompt: "tóm tắt",
    contextPrompt: null,
    chunkSummaryPrompt: null,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("preset không có context prompt tương đương working copy rỗng", () => {
    expect(presetPromptSet(preset).contextPrompt).toBe("");
    expect(
      samePromptSet(
        { translatePrompt: "dịch", summaryPrompt: "tóm tắt", contextPrompt: "", chunkSummaryPrompt: "" },
        presetPromptSet(preset)
      )
    ).toBe(true);
  });

  it("bỏ qua khác biệt khoảng trắng đầu cuối", () => {
    expect(
      samePromptSet(
        {
          translatePrompt: "dịch\n",
          summaryPrompt: "  tóm tắt",
          contextPrompt: "\n",
          chunkSummaryPrompt: " ",
        },
        presetPromptSet(preset)
      )
    ).toBe(true);
  });

  it("khác nội dung thì báo khác", () => {
    expect(
      samePromptSet(
        {
          translatePrompt: "dịch khác",
          summaryPrompt: "tóm tắt",
          contextPrompt: "",
          chunkSummaryPrompt: "",
        },
        presetPromptSet(preset)
      )
    ).toBe(false);
  });
});

describe("chunkSummaryPrompt (CR v0.5)", () => {
  it("nhận null / rỗng, chặn quá dài", () => {
    expect(validatePresetInput({ ...full, chunkSummaryPrompt: null })).toBeNull();
    expect(validatePresetInput({ ...full, chunkSummaryPrompt: "tóm tắt chunk" })).toBeNull();
    expect(
      validatePresetInput({ ...full, chunkSummaryPrompt: "x".repeat(MAX_PROMPT_CHARS + 1) })
    ).toMatch(/Prompt tóm tắt chunk quá/);
  });

  it("đếm vào phần so 'đã sửa' của working copy", () => {
    const base = {
      translatePrompt: "dịch",
      summaryPrompt: "tóm tắt",
      contextPrompt: "",
      chunkSummaryPrompt: "",
    };
    expect(samePromptSet(base, { ...base, chunkSummaryPrompt: "khác" })).toBe(false);
  });
});

describe("contractWarning", () => {
  it("im lặng khi prompt không nhắc tới thẻ", () => {
    expect(
      contractWarning({
        translatePrompt: "dịch",
        summaryPrompt: "tóm",
        contextPrompt: "",
        chunkSummaryPrompt: "",
      })
    ).toBeNull();
  });

  it("cảnh báo khi user tự viết luật thẻ", () => {
    const warn = contractWarning({
      translatePrompt: "Bọc trong <translation>",
      summaryPrompt: "tóm",
      contextPrompt: "<context> gì đó",
      chunkSummaryPrompt: "",
    });
    expect(warn).toContain("<translation>");
    expect(warn).toContain("<context>");
  });
});

describe("copyName", () => {
  it("gợi ý tên khi lưu thành preset mới", () => {
    expect(copyName("Truyện")).toBe("Truyện (copy)");
    expect(copyName(null)).toBe("Preset mới");
  });
});

describe("isUniqueViolation", () => {
  it("bắt lỗi 23505 nằm trong cause — drizzle 0.44 bọc lỗi query lại", () => {
    const pg = Object.assign(new Error("duplicate key"), { code: "23505" });
    expect(isUniqueViolation(pg)).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error("Failed query"), { cause: pg }))).toBe(true);
  });

  it("không nhận nhầm lỗi khác", () => {
    expect(isUniqueViolation(new Error("bất kỳ"))).toBe(false);
    expect(isUniqueViolation(Object.assign(new Error("x"), { code: "23503" }))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
