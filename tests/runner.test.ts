import { describe, expect, it } from "vitest";
import { coolDown, isRateLimited, nextKey, pickKey } from "../src/lib/runner";

const keys = ["k1", "k2", "k3"];

describe("pickKey", () => {
  it("xoay vòng theo cú gọi", () => {
    expect([0, 1, 2, 3, 4].map((c) => pickKey(keys, c).key)).toEqual([
      "k1",
      "k2",
      "k3",
      "k1",
      "k2",
    ]);
  });

  it("một key thì luôn trả key đó", () => {
    expect(pickKey(["only"], 7)).toEqual({ key: "only", index: 0 });
  });
});

describe("nextKey", () => {
  it("quay vòng về đầu", () => {
    expect(nextKey(keys, 2)).toEqual({ key: "k1", index: 0 });
  });
});

describe("isRateLimited", () => {
  it("chỉ bắt 429", () => {
    expect(isRateLimited("HTTP 429: LLM lỗi tạm thời")).toBe(true);
    expect(isRateLimited("HTTP 401: LLM từ chối")).toBe(false);
    expect(isRateLimited(null)).toBe(false);
  });
});

describe("coolDown", () => {
  it("ngủ hết thời gian rồi trả true", async () => {
    const t0 = Date.now();
    await expect(coolDown(250, () => true)).resolves.toBe(true);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(200);
  });

  it("bị cắt giữa chừng thì trả false và không ngủ hết", async () => {
    let active = true;
    setTimeout(() => {
      active = false;
    }, 120);
    const t0 = Date.now();
    await expect(coolDown(5000, () => active)).resolves.toBe(false);
    expect(Date.now() - t0).toBeLessThan(1000);
  });
});
