import { describe, expect, it } from "vitest";
import { addModel, matchModels, normalizeModels, MAX_MODEL_HISTORY } from "../src/lib/modelHistory";

describe("addModel", () => {
  it("đẩy model mới lên đầu", () => {
    expect(addModel(["a", "b"], "c")).toEqual(["c", "a", "b"]);
  });

  it("gõ lại model cũ thì nhảy lên đầu chứ không nhân đôi", () => {
    expect(addModel(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("trim và bỏ qua chuỗi rỗng", () => {
    expect(addModel(["a"], "  b  ")).toEqual(["b", "a"]);
    expect(addModel(["a"], "   ")).toEqual(["a"]);
  });

  it("cắt còn tối đa MAX_MODEL_HISTORY", () => {
    let list: string[] = [];
    for (let i = 0; i < 15; i++) list = addModel(list, `m${i}`);
    expect(list).toHaveLength(MAX_MODEL_HISTORY);
    expect(list[0]).toBe("m14");
  });

  it("phân biệt hoa thường — tên model là định danh", () => {
    expect(addModel(["gpt-4o"], "GPT-4o")).toEqual(["GPT-4o", "gpt-4o"]);
  });
});

describe("normalizeModels", () => {
  it("bỏ rác trong localStorage", () => {
    expect(normalizeModels(["a", 1, null, " a ", "", "b"])).toEqual(["a", "b"]);
    expect(normalizeModels("nope")).toEqual([]);
  });
});

describe("matchModels", () => {
  it("chưa gõ gì thì gợi ý cả danh sách", () => {
    expect(matchModels(["a", "b"], "  ")).toEqual(["a", "b"]);
  });

  it("lọc theo chuỗi con, không phân biệt hoa thường", () => {
    expect(matchModels(["gpt-4o-mini", "claude-opus-5"], "GPT")).toEqual(["gpt-4o-mini"]);
  });

  it("gõ trùng y hệt một dòng thì không gợi ý lại chính nó", () => {
    expect(matchModels(["gpt-4o", "gpt-4o-mini"], "gpt-4o")).toEqual(["gpt-4o-mini"]);
  });
});
