import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEndpointAllowed, normalizeEndpoint, translate } from "@/lib/llm";

function jsonRes(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const params = {
  endpoint: "https://api.example.com/v1",
  apiKey: "sk-test",
  model: "m",
  systemPrompt: "dịch đi",
  temperature: 0.2,
  source: "# Hello",
};

afterEach(() => vi.restoreAllMocks());

describe("normalizeEndpoint", () => {
  it("tự nối /chat/completions", () => {
    expect(normalizeEndpoint("https://a.com/v1")).toBe("https://a.com/v1/chat/completions");
    expect(normalizeEndpoint("https://a.com/v1/")).toBe("https://a.com/v1/chat/completions");
    expect(normalizeEndpoint("https://a.com/v1/chat/completions")).toBe(
      "https://a.com/v1/chat/completions"
    );
  });
});

describe("assertEndpointAllowed", () => {
  it("chặn http khi chưa bật cờ", () => {
    delete process.env.ALLOW_HTTP_ENDPOINT;
    expect(() => assertEndpointAllowed("http://localhost:11434/v1")).toThrow();
    process.env.ALLOW_HTTP_ENDPOINT = "1";
    expect(() => assertEndpointAllowed("http://localhost:11434/v1")).not.toThrow();
    delete process.env.ALLOW_HTTP_ENDPOINT;
  });
});

describe("translate", () => {
  it("bóc thẻ, bỏ rác quanh thẻ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes("Đây nhé:\n<translation>\n# Xin chào\n</translation>\nOK?"))
    );
    const out = await translate(params);
    expect(out.translated).toBe("# Xin chào");
    expect(out.attempts).toBe(1);
    expect(out.error).toBeNull();
  });

  it("quên thẻ → retry 3 lần rồi báo lỗi, giữ raw", async () => {
    const fetchMock = vi.fn(async () => jsonRes("quên thẻ luôn"));
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate(params);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(out.translated).toBeNull();
    expect(out.attempts).toBe(3);
    expect(out.raw).toBe("quên thẻ luôn");
    expect(out.error).toMatch(/translation/);
  });

  it("quên thẻ lần 1, lần 2 có thẻ → thành công", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        n += 1;
        return n === 1 ? jsonRes("thiếu thẻ") : jsonRes("<translation>ok</translation>");
      })
    );
    const out = await translate(params);
    expect(out.translated).toBe("ok");
    expect(out.attempts).toBe(2);
  });

  it("401 → fail ngay, không retry", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate(params);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.error).toMatch(/401/);
  });
});
