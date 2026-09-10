import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertEndpointAllowed,
  buildContext,
  normalizeEndpoint,
  summarize,
  translate,
  writeText,
} from "@/lib/llm";
import { WRITER_CONTRACT } from "@/lib/defaults";

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

/** System message của call thứ `i` (mặc định call đầu). */
function systemAt(fetchMock: ReturnType<typeof vi.fn>, i = 0): string {
  const body = JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);
  return body.messages[0].content as string;
}

function systemOf(fetchMock: ReturnType<typeof vi.fn>): string {
  return systemAt(fetchMock);
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

describe("tóm tắt chunk trong cùng cú gọi (CR v0.5)", () => {
  it("tắt withSummary → system message y hệt v0.2, không nhắc <summary>", async () => {
    const off = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", off);
    await translate({ ...params, documentContext: "ngữ cảnh" });
    const base = systemOf(off);

    // Prompt tóm tắt chunk luôn được gửi kèm trong body, nhưng không bật cờ thì bỏ qua sạch.
    const stillOff = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", stillOff);
    const out = await translate({
      ...params,
      documentContext: "ngữ cảnh",
      chunkSummaryPrompt: "tóm tắt kiểu này",
    });

    expect(systemOf(stillOff)).toBe(base);
    expect(base).not.toContain("<summary>");
    expect(base).not.toContain("<previous_chunk_summary>");
    expect(base).not.toContain("<translated_so_far>");
    expect(out.summary).toBeNull();
  });

  it("bật → contract hai thẻ, bóc cả bản dịch lẫn tóm tắt", async () => {
    const fetchMock = vi.fn(async () =>
      jsonRes("<translation># Xin chào</translation>\n<summary>Đoạn chào hỏi.</summary>")
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate({ ...params, withSummary: true });

    const system = systemOf(fetchMock);
    expect(system).toContain("Trả về đúng hai thẻ");
    expect(system).toContain("Sau khi dịch, viết thêm phần tóm tắt");
    expect(out.translated).toBe("# Xin chào");
    expect(out.summary).toBe("Đoạn chào hỏi.");
  });

  it("prompt tóm tắt của preset thay mặc định app", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>a</translation><summary>b</summary>"));
    vi.stubGlobal("fetch", fetchMock);
    await translate({ ...params, withSummary: true, chunkSummaryPrompt: "tóm tắt kiểu truyện" });

    const system = systemOf(fetchMock);
    expect(system).toContain("tóm tắt kiểu truyện");
    expect(system).not.toContain("Sau khi dịch, viết thêm phần tóm tắt");
  });

  it("thứ tự: prompt dịch → ngữ cảnh chung → đoạn trước → prompt tóm tắt → contract", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>a</translation><summary>b</summary>"));
    vi.stubGlobal("fetch", fetchMock);
    await translate({
      ...params,
      withSummary: true,
      documentContext: "ngữ cảnh chung",
      previousSummary: "đoạn trước kể chuyện A",
      chunkSummaryPrompt: "PROMPT_TOM_TAT",
    });

    const system = systemOf(fetchMock);
    const at = (needle: string) => system.indexOf(needle);
    expect(at(params.systemPrompt)).toBeLessThan(at("<document_context>"));
    expect(at("<document_context>")).toBeLessThan(at("<previous_chunk_summary>"));
    expect(at("<previous_chunk_summary>")).toBeLessThan(at("PROMPT_TOM_TAT"));
    expect(at("PROMPT_TOM_TAT")).toBeLessThan(at("QUY TẮC ĐẦU RA"));
    expect(system).toContain("đoạn trước kể chuyện A");
  });

  it("thiếu <summary> → vẫn nhận bản dịch, không gọi lại", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate({ ...params, withSummary: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out.translated).toBe("ok");
    expect(out.summary).toBeNull();
  });

  it("<summary> rỗng coi như thiếu; tóm tắt dài bị cắt 1000 ký tự", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes("<translation>ok</translation><summary>   </summary>")));
    expect((await translate({ ...params, withSummary: true })).summary).toBeNull();

    const long = "x".repeat(1500);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonRes(`<translation>ok</translation><summary>${long}</summary>`))
    );
    expect((await translate({ ...params, withSummary: true })).summary).toHaveLength(1000);
  });

  it("quên <translation> → retry với reminder nhắc cả hai thẻ", async () => {
    const fetchMock = vi.fn(async () => jsonRes("quên hết"));
    vi.stubGlobal("fetch", fetchMock);
    const out = await translate({ ...params, withSummary: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const second = systemAt(fetchMock, 1);
    expect(second).toContain("NHẮC LẠI");
    expect(second).toContain("<translation>");
    expect(second).toContain("<summary>");
    expect(out.error).toMatch(/translation/);
  });
});

describe("Assistant Writer (CR v0.6)", () => {
  const writerParams = {
    endpoint: "https://api.example.com/v1",
    apiKey: "sk-test",
    model: "m",
    temperature: 0.7,
    prompt: "Dựa vào văn bản sau:\n\n# Tài liệu\n\nHãy viết outline.",
  };

  it("system chỉ có WRITER_CONTRACT, user là prompt thô không bọc <source>", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      jsonRes("<output>## Outline</output>")
    );
    vi.stubGlobal("fetch", fetchMock);
    const out = await writeText(writerParams);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.messages[0].content).toBe(WRITER_CONTRACT);
    expect(body.messages[1].content).toBe(writerParams.prompt);
    expect(body.messages[1].content).not.toContain("<source>");
    expect(out.output).toBe("## Outline");
    expect(out.attempts).toBe(1);
    expect(out.error).toBeNull();
  });

  it("quên thẻ → retry 3 lần, lần sau có reminder, rồi báo lỗi <output>", async () => {
    const fetchMock = vi.fn(async () => jsonRes("quên thẻ"));
    vi.stubGlobal("fetch", fetchMock);
    const out = await writeText(writerParams);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(systemAt(fetchMock, 1)).toContain("NHẮC LẠI");
    expect(out.output).toBeNull();
    expect(out.error).toMatch(/<output>/);
  });

  it("lỗi HTTP → trả error, không ném", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })));
    const out = await writeText(writerParams);
    expect(out.output).toBeNull();
    expect(out.error).toMatch(/401/);
  });
});

describe("khối ngữ cảnh mạch (CR v0.7)", () => {
  it("bơm contextBlock kể cả khi không tạo tóm tắt chunk", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", fetchMock);
    await translate({
      ...params,
      documentContext: "ngữ cảnh chung",
      contextBlock: "<translated_so_far>\n<recent>\n#3:\nđoạn đã dịch\n</recent>\n</translated_so_far>",
    });

    const system = systemOf(fetchMock);
    const at = (needle: string) => system.indexOf(needle);
    expect(system).toContain("đoạn đã dịch");
    expect(at("<document_context>")).toBeLessThan(at("<translated_so_far>"));
    expect(at("<translated_so_far>")).toBeLessThan(at("QUY TẮC ĐẦU RA"));
    // Nấc window không dùng contract hai thẻ nếu không bật tạo tóm tắt.
    expect(system).not.toContain("Trả về đúng hai thẻ");
  });

  it("contextBlock rỗng → không bơm gì", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<translation>ok</translation>"));
    vi.stubGlobal("fetch", fetchMock);
    await translate({ ...params, contextBlock: "   " });
    expect(systemOf(fetchMock)).not.toContain("<translated_so_far>");
  });

  it("luồng tóm tắt section không đụng tới khối này", async () => {
    const fetchMock = vi.fn(async () => jsonRes("<summary>ý chính</summary>"));
    vi.stubGlobal("fetch", fetchMock);
    await summarize({ ...params, contextBlock: "<translated_so_far>x</translated_so_far>" });
    expect(systemOf(fetchMock)).not.toContain("<translated_so_far>");
  });
});
