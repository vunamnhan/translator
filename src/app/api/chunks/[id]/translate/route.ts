import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { pickContext, renderContextBody } from "@/lib/contextWindow";
import { fillPrompt, hasVar, type PromptValues } from "@/lib/promptVars";
import {
  normalizeChainMode,
  WARN_NO_CHUNK_SUMMARY,
  WARN_NO_PREV_SUMMARY,
  warnContextTrimmed,
} from "@/lib/defaults";
import { bad, ok, readJson } from "@/lib/http";
import { assertEndpointAllowed, LlmError, translate } from "@/lib/llm";
import { postProcess } from "@/lib/postprocess";
import { clampContextTokens, clampTemperature, clampWindowChunks } from "@/lib/validate";
import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface Body {
  endpoint?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  /** Bơm ngữ cảnh chung vào prompt dịch. Context rỗng thì dịch như v0, không báo lỗi. */
  useContext?: boolean;
  /** CR v0.5 — xin thêm thẻ <summary> trong cùng cú gọi (settings.chunkSummary). */
  withSummary?: boolean;
  /** CR v0.5 — client cũ: true nghĩa là `chainMode: "prev"`. */
  usePrevSummary?: boolean;
  /** CR v0.7 — ngữ cảnh mạch: "off" | "prev" | "window". */
  chainMode?: string;
  /** CR v0.7 — số đoạn gần nhất gửi nguyên văn ở chế độ window. */
  contextWindowChunks?: number;
  /** CR v0.7 — trần token cho cả khối ngữ cảnh mạch. */
  contextTokens?: number;
  /** CR v0.5 — bỏ qua kiểm tra chunk trước chưa dịch xong ("Tiếp tục bất chấp"). */
  force?: boolean;
  /** Working copy prompt tóm tắt chunk. Rỗng → mặc định app. */
  chunkSummaryPrompt?: string;
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const apiKey = req.headers.get("x-llm-key") ?? "";
  if (!apiKey) return bad("Thiếu header x-llm-key", 401);

  const body = await readJson<Body>(req);
  if (!body) return bad("Body không hợp lệ");
  if (!body.endpoint || !body.model || !body.systemPrompt) {
    return bad("Thiếu endpoint / model / systemPrompt");
  }

  try {
    assertEndpointAllowed(body.endpoint);
  } catch (e) {
    return bad((e as LlmError).message);
  }

  const [chunk] = await db.select().from(chunks).where(eq(chunks.id, id));
  if (!chunk) return bad("Không tìm thấy chunk", 404);
  if (chunk.status === "skipped") return ok(chunk);

  const source = chunk.sourceOverride ?? chunk.source;
  const withSummary = body.withSummary === true;
  // Client cũ (v0.5) chỉ biết `usePrevSummary`; nó tương đương nấc "prev".
  const chainMode = normalizeChainMode(
    body.chainMode ?? (body.usePrevSummary === true ? "prev" : "off"),
    withSummary
  );

  /**
   * Giá trị cho placeholder trong prompt dịch. Biến nào rỗng thì cả đoạn văn chứa
   * nó biến mất khỏi prompt — xem `fillPrompt`.
   */
  const vars: PromptValues = { chunk_source: source };
  let chainWarning: string | null = null;
  let trimWarning: string | null = null;

  /**
   * Ngữ cảnh mạch bật: lấy chunk liền trước theo idx, bỏ qua front matter. Chunk
   * trước chưa dịch xong thì trả 409 và KHÔNG đụng vào status — client chưa mất
   * gì để hoàn lại. Luật này áp cho cả "prev" lẫn "window" (CR v0.7 §2.4).
   */
  if (chainMode !== "off") {
    const [prev] = await db
      .select()
      .from(chunks)
      .where(
        and(eq(chunks.jobId, chunk.jobId), lt(chunks.idx, chunk.idx), ne(chunks.status, "skipped"))
      )
      .orderBy(desc(chunks.idx))
      .limit(1);

    if (prev && prev.status !== "done" && !body.force) {
      return NextResponse.json(
        { error: `Chuỗi đứt: chunk #${prev.idx} chưa dịch xong`, brokenAt: prev.idx },
        { status: 409 }
      );
    }

    if (prev) {
      // Ba biến về đoạn liền trước dùng được ở cả hai nấc.
      vars.previous_chunk_source = prev.sourceOverride ?? prev.source;
      if (prev.status === "done") {
        vars.previous_chunk_summary = prev.summary;
        vars.previous_chunk_content = prev.translated;
      }
    }

    if (chainMode === "prev") {
      if (prev && !(prev.status === "done" && prev.summary)) chainWarning = WARN_NO_PREV_SUMMARY;
    } else {
      // Cửa sổ trượt: dựng khối từ DB, client không gửi nội dung đoạn nào lên.
      const before = await db
        .select({
          idx: chunks.idx,
          status: chunks.status,
          translated: chunks.translated,
          summary: chunks.summary,
        })
        .from(chunks)
        .where(
          and(eq(chunks.jobId, chunk.jobId), lt(chunks.idx, chunk.idx), ne(chunks.status, "skipped"))
        )
        .orderBy(asc(chunks.idx));

      const pick = pickContext(before, {
        windowChunks: clampWindowChunks(body.contextWindowChunks),
        contextTokens: clampContextTokens(body.contextTokens),
      });
      vars.sliding_window_context = renderContextBody(pick);
      if (pick.droppedSummaries > 0) trimWarning = warnContextTrimmed(pick.droppedSummaries);
      if (prev && prev.status !== "done") chainWarning = WARN_NO_PREV_SUMMARY;
    }
  }

  // Chỉ chạm vào bảng jobs khi prompt thật sự nhắc tới — cột `source` có thể vài MB.
  const wantsContext = body.useContext !== false && hasVar(body.systemPrompt, "general_context");
  const wantsFullSource = hasVar(body.systemPrompt, "full_source");
  if (wantsContext || wantsFullSource) {
    const [job] = wantsFullSource
      ? await db
          .select({ context: jobs.context, source: jobs.source })
          .from(jobs)
          .where(eq(jobs.id, chunk.jobId))
      : await db.select({ context: jobs.context }).from(jobs).where(eq(jobs.id, chunk.jobId));
    if (wantsContext) vars.general_context = job?.context ?? null;
    if (wantsFullSource) vars.full_source = (job as { source?: string })?.source ?? null;
  }

  const systemPrompt = fillPrompt(body.systemPrompt, vars);

  await db
    .update(chunks)
    .set({ status: "translating", error: null, updatedAt: new Date() })
    .where(eq(chunks.id, id));

  const outcome = await translate({
    endpoint: body.endpoint,
    apiKey,
    model: body.model,
    systemPrompt,
    temperature: clampTemperature(body.temperature),
    source,
    withSummary,
    chunkSummaryPrompt: body.chunkSummaryPrompt,
  });

  if (outcome.translated === null) {
    const [row] = await db
      .update(chunks)
      .set({
        status: "error",
        error: outcome.error,
        rawResponse: outcome.raw,
        attempts: chunk.attempts + outcome.attempts,
        updatedAt: new Date(),
      })
      .where(eq(chunks.id, id))
      .returning();
    return ok(row, 200);
  }

  const processed = postProcess(source, outcome.translated);
  const warning =
    [
      processed.warning,
      chainWarning,
      trimWarning,
      withSummary && outcome.summary === null ? WARN_NO_CHUNK_SUMMARY : null,
    ]
      .filter((w): w is string => Boolean(w))
      .join(" · ") || null;

  const [row] = await db
    .update(chunks)
    .set({
      status: "done",
      translated: processed.translated,
      warning,
      error: null,
      rawResponse: outcome.raw,
      attempts: chunk.attempts + outcome.attempts,
      edited: false,
      // Tắt chunkSummary thì giữ nguyên tóm tắt cũ, không ghi đè bằng null (§2.1).
      ...(withSummary ? { summary: outcome.summary } : {}),
      // v0.7 đổi nghĩa: "lần dịch này có kèm ngữ cảnh mạch", biến nào có giá trị cũng tính.
      prevSummaryUsed: Boolean(
        vars.sliding_window_context?.trim() ||
          vars.previous_chunk_summary?.trim() ||
          vars.previous_chunk_content?.trim()
      ),
      updatedAt: new Date(),
    })
    .where(eq(chunks.id, id))
    .returning();

  return ok(row);
}
