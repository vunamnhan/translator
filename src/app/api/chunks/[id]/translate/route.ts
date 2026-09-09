import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { WARN_NO_CHUNK_SUMMARY, WARN_NO_PREV_SUMMARY } from "@/lib/defaults";
import { bad, ok, readJson } from "@/lib/http";
import { assertEndpointAllowed, LlmError, translate } from "@/lib/llm";
import { postProcess } from "@/lib/postprocess";
import { clampTemperature } from "@/lib/validate";
import { and, desc, eq, lt, ne } from "drizzle-orm";
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
  /** CR v0.5 — bơm tóm tắt chunk trước (settings.chainPrevSummary). Cần `withSummary`. */
  usePrevSummary?: boolean;
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
  const useChain = withSummary && body.usePrevSummary === true;

  /**
   * Chuỗi bật: lấy chunk liền trước theo idx, bỏ qua front matter. Chunk trước chưa
   * dịch xong thì trả 409 và KHÔNG đụng vào status — client chưa mất gì để hoàn lại.
   */
  let previousSummary: string | null = null;
  let chainWarning: string | null = null;
  if (useChain) {
    const [prev] = await db
      .select()
      .from(chunks)
      .where(
        and(eq(chunks.jobId, chunk.jobId), lt(chunks.idx, chunk.idx), ne(chunks.status, "skipped"))
      )
      .orderBy(desc(chunks.idx))
      .limit(1);

    if (prev) {
      if (prev.status !== "done") {
        if (!body.force) {
          return NextResponse.json(
            { error: `Chuỗi đứt: chunk #${prev.idx} chưa dịch xong`, brokenAt: prev.idx },
            { status: 409 }
          );
        }
        chainWarning = WARN_NO_PREV_SUMMARY;
      } else if (prev.summary) {
        previousSummary = prev.summary;
      } else {
        chainWarning = WARN_NO_PREV_SUMMARY;
      }
    }
  }

  let documentContext: string | null = null;
  if (body.useContext !== false) {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, chunk.jobId));
    documentContext = job?.context ?? null;
  }

  await db
    .update(chunks)
    .set({ status: "translating", error: null, updatedAt: new Date() })
    .where(eq(chunks.id, id));

  const outcome = await translate({
    endpoint: body.endpoint,
    apiKey,
    model: body.model,
    systemPrompt: body.systemPrompt,
    temperature: clampTemperature(body.temperature),
    source,
    documentContext,
    withSummary,
    chunkSummaryPrompt: body.chunkSummaryPrompt,
    previousSummary,
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
      prevSummaryUsed: previousSummary !== null,
      updatedAt: new Date(),
    })
    .where(eq(chunks.id, id))
    .returning();

  return ok(row);
}
