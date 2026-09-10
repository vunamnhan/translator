import { describe, expect, it } from "vitest";
import {
  pickContext,
  renderContextBlock,
  type ContextPiece,
} from "../src/lib/contextWindow";

/** Chunk đã dịch xong, `translated` dài `chars` ký tự (≈ chars/4 token). */
function done(idx: number, chars: number, summary: string | null = `tóm tắt ${idx}`): ContextPiece {
  return { idx, status: "done", translated: "x".repeat(chars), summary };
}

const big = { windowChunks: 3, contextTokens: 100000 };

describe("pickContext", () => {
  it("danh sách trước rỗng → không có gì", () => {
    const pick = pickContext([], big);
    expect(pick.summaries).toEqual([]);
    expect(pick.verbatim).toEqual([]);
    expect(renderContextBlock(pick)).toBe("");
  });

  it("cửa sổ lấy đúng N đoạn cuối, phần còn lại xuống tóm tắt", () => {
    const prev = [0, 1, 2, 3, 4, 5, 6].map((i) => done(i, 400));
    const pick = pickContext(prev, big);

    expect(pick.verbatim.map((v) => v.idx)).toEqual([4, 5, 6]);
    expect(pick.summaries.map((s) => s.idx)).toEqual([0, 1, 2, 3]);
    expect(pick.droppedSummaries).toBe(0);
  });

  it("bỏ qua chunk chưa dịch và chunk front matter, không để lại chỗ trống", () => {
    const prev: ContextPiece[] = [
      done(0, 400),
      { idx: 1, status: "skipped", translated: null, summary: null },
      { idx: 2, status: "pending", translated: null, summary: null },
      done(3, 400),
      done(4, 400),
    ];
    const pick = pickContext(prev, { windowChunks: 3, contextTokens: 100000 });

    expect(pick.verbatim.map((v) => v.idx)).toEqual([0, 3, 4]);
    expect(pick.summaries).toEqual([]);
  });

  it("chunk done nhưng chưa có tóm tắt thì không lọt vào phần tóm tắt", () => {
    const prev = [done(0, 400, null), done(1, 400), done(2, 400), done(3, 400), done(4, 400)];
    const pick = pickContext(prev, big);

    expect(pick.verbatim.map((v) => v.idx)).toEqual([2, 3, 4]);
    expect(pick.summaries.map((s) => s.idx)).toEqual([1]);
  });

  it("hết ngân sách thì bỏ tóm tắt xa nhất và đếm đúng số bỏ", () => {
    // Cửa sổ 1 đoạn 100 token + vài tóm tắt ~5 token/dòng.
    const prev = [0, 1, 2, 3, 4, 5].map((i) => done(i, i === 5 ? 400 : 40, `tóm tắt ${i}`));
    const pick = pickContext(prev, { windowChunks: 1, contextTokens: 106 });

    expect(pick.verbatim.map((v) => v.idx)).toEqual([5]);
    expect(pick.summaries.length).toBeGreaterThan(0);
    expect(pick.droppedSummaries).toBe(5 - pick.summaries.length);
    expect(pick.summaries[0].idx).toBeGreaterThan(0);
    expect(pick.tokens).toBeLessThanOrEqual(106);
  });

  it("một đoạn to hơn cả ngân sách → rơi khỏi cửa sổ, dùng tóm tắt của chính nó", () => {
    const prev = [done(0, 400), done(1, 400), done(2, 40000)];
    const pick = pickContext(prev, { windowChunks: 3, contextTokens: 2000 });

    expect(pick.verbatim).toEqual([]);
    expect(pick.summaries.map((s) => s.idx)).toEqual([0, 1, 2]);
  });

  it("cửa sổ 0 đoạn → chỉ có tóm tắt", () => {
    const prev = [done(0, 400), done(1, 400)];
    const pick = pickContext(prev, { windowChunks: 0, contextTokens: 100000 });

    expect(pick.verbatim).toEqual([]);
    expect(pick.summaries.map((s) => s.idx)).toEqual([0, 1]);
  });

  it("cửa sổ luôn liền mạch tới đoạn cuối, không nhảy cóc lấp chỗ trống", () => {
    // Đoạn cuối quá to để vừa, đoạn trước nó nhỏ xíu — vẫn không được lấy bù.
    const prev = [done(0, 40), done(1, 40), done(2, 40000)];
    const pick = pickContext(prev, { windowChunks: 3, contextTokens: 3000 });

    expect(pick.verbatim).toEqual([]);
  });
});

describe("renderContextBlock", () => {
  const prev = [done(0, 40), done(1, 40), done(2, 40)];

  it("dựng đủ hai phần theo thứ tự idx tăng dần", () => {
    const block = renderContextBlock(pickContext(prev, { windowChunks: 1, contextTokens: 100000 }));

    expect(block).toContain("<translated_so_far>");
    expect(block).toContain("<summaries>\n#0: tóm tắt 0\n#1: tóm tắt 1\n</summaries>");
    expect(block).toContain("<recent>\n#2:\n");
    expect(block.indexOf("<summaries>")).toBeLessThan(block.indexOf("<recent>"));
    expect(block).toContain("KHÔNG dịch lại");
  });

  it("thiếu một phần thì bỏ hẳn thẻ con, không để thẻ rỗng", () => {
    const onlyRecent = renderContextBlock(
      pickContext([done(0, 40, null)], { windowChunks: 3, contextTokens: 100000 })
    );
    expect(onlyRecent).toContain("<recent>");
    expect(onlyRecent).not.toContain("<summaries>");

    const onlySummaries = renderContextBlock(
      pickContext(prev, { windowChunks: 0, contextTokens: 100000 })
    );
    expect(onlySummaries).toContain("<summaries>");
    expect(onlySummaries).not.toContain("<recent>");
  });
});
