import { describe, expect, it } from "vitest";
import { errorCode, errorHint } from "@/lib/errors";

describe("errorCode", () => {
  it("trích mã HTTP từ message", () => {
    expect(errorCode("HTTP 429: LLM lỗi tạm thời — Rate limit reached")).toBe("429");
    expect(errorCode("HTTP 401: LLM từ chối, kiểm tra API key")).toBe("401");
    expect(errorCode("HTTP 503: LLM lỗi tạm thời")).toBe("503");
  });

  it("không có mã thì trả null", () => {
    expect(errorCode("Timeout sau 120s")).toBeNull();
    expect(errorCode(null)).toBeNull();
  });

  it("không nhầm số khác thành mã lỗi", () => {
    expect(errorCode("LLM không trả thẻ <translation> sau 3 lần thử")).toBeNull();
  });
});

describe("errorHint", () => {
  it("429 có gợi ý giảm concurrency", () => {
    expect(errorHint("429")).toMatch(/concurrency/);
  });
  it("mã lạ thì không bịa gợi ý", () => {
    expect(errorHint("418")).toBeNull();
  });
});
