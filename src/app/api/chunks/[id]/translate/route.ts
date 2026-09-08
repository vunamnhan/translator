import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { assertEndpointAllowed, LlmError, translate } from "@/lib/llm";
import { postProcess } from "@/lib/postprocess";
import { clampTemperature } from "@/lib/validate";
import { eq } from "drizzle-orm";

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

  const [row] = await db
    .update(chunks)
    .set({
      status: "done",
      translated: processed.translated,
      warning: processed.warning,
      error: null,
      rawResponse: outcome.raw,
      attempts: chunk.attempts + outcome.attempts,
      edited: false,
      updatedAt: new Date(),
    })
    .where(eq(chunks.id, id))
    .returning();

  return ok(row);
}
