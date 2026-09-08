import { afterEach, describe, expect, it, vi } from "vitest";
import { assertEndpointAllowed, buildContext, normalizeEndpoint, summarize, translate } from "@/lib/llm";

function jsonRes(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

process.env.LLM_BACKOFF_MS = "1,1,1";

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

  it("HTTP 200 nhưng body là lỗi → lấy đúng mã + message của provider", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 400, message: "Model không tồn tại" } }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate(params);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.error).toBe("HTTP 400: Model không tồn tại");
    expect(out.raw).toContain("Model không tồn tại");
  });

  it("429 kèm message của provider hiện ra trong error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { message: "Rate limit reached for gpt-4o-mini" } }), {
            status: 429,
          })
      )
    );
    const out = await translate({ ...params });
    expect(out.error).toMatch(/^HTTP 429:/);
    expect(out.error).toMatch(/Rate limit reached/);
  });

  it("401 → fail ngay, không retry", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate(params);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.error).toMatch(/401/);
  });
});

/** System message của call đầu tiên. */
function systemOf(fetchMock: ReturnType<typeof vi.fn>): string {
  const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
  return body.messages[0].content as string;
}

describe("bơm ngữ cảnh chung", () => {
  it("có documentContext → payload chứa block, đặt trước output contract", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", fetchMock);
    await translate({ ...params, documentContext: "## Tổng quan\nTài liệu về X" });

    const system = systemOf(fetchMock);
    expect(system).toContain("<document_context>");
    expect(system).toContain("Tài liệu về X");
    expect(system.indexOf("<document_context>")).toBeGreaterThan(system.indexOf(params.systemPrompt));
    expect(system.indexOf("<document_context>")).toBeLessThan(system.indexOf("QUY TẮC ĐẦU RA"));
  });

  it("không truyền / rỗng → payload không có block", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", fetchMock);
    await translate({ ...params, documentContext: "   " });
    expect(systemOf(fetchMock)).not.toContain("<document_context>");
  });
});

describe("summarize / buildContext", () => {
  it("summarize bóc thẻ <summary>", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes("<summary>\n- ý chính\n</summary>")));
    const out = await summarize({ ...params, documentContext: "ngữ cảnh" });
    expect(out.translated).toBe("- ý chính");
    expect(out.error).toBeNull();
  });

  it("summarize quên thẻ → báo đúng tên thẻ", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes("không thẻ")));
    const out = await summarize(params);
    expect(out.error).toMatch(/<summary>/);
  });

  it("buildContext bóc thẻ <context>", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes("<context>## Tổng quan\nabc</context>")));
    const out = await buildContext(params);
    expect(out.translated).toBe("## Tổng quan\nabc");
  });
});
