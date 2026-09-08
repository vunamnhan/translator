import { db } from "@/db";
import { chunks, jobs, sections } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { assertEndpointAllowed, LlmError, summarize } from "@/lib/llm";
import { chunkText } from "@/lib/sectioner";
import { clampTemperature } from "@/lib/validate";
import { and, asc, eq, gte, lte } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface Body {
  endpoint?: string;
  model?: string;
  summaryPrompt?: string;
  temperature?: number;
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const apiKey = req.headers.get("x-llm-key") ?? "";
  if (!apiKey) return bad("Thiếu header x-llm-key", 401);

  const body = await readJson<Body>(req);
  if (!body) return bad("Body không hợp lệ");
  if (!body.endpoint || !body.model || !body.summaryPrompt) {
    return bad("Thiếu endpoint / model / summaryPrompt");
  }

  try {
    assertEndpointAllowed(body.endpoint);
  } catch (e) {
    return bad((e as LlmError).message);
  }

  const [section] = await db.select().from(sections).where(eq(sections.id, id));
  if (!section) return bad("Không tìm thấy section", 404);

  const [job] = await db.select().from(jobs).where(eq(jobs.id, section.jobId));
  if (!job) return bad("Không tìm thấy job", 404);
  // Tóm tắt section luôn cần ngữ cảnh chung (mục 4 CR).
  if (!job.context || job.context.trim().length === 0) {
    return bad("Chưa có ngữ cảnh chung — tạo tóm tắt chung trước");
  }

  const rows = await db
    .select()
    .from(chunks)
    .where(
      and(
        eq(chunks.jobId, section.jobId),
        gte(chunks.idx, section.chunkFrom),
        lte(chunks.idx, section.chunkTo)
      )
    )
    .orderBy(asc(chunks.idx));

  const source = rows
    .filter((c) => c.status !== "skipped")
    .map(chunkText)
    .join("");
  if (source.trim().length === 0) return bad("Section không có nội dung");

  await db
    .update(sections)
    .set({ status: "summarizing", error: null, updatedAt: new Date() })
    .where(eq(sections.id, id));

  const outcome = await summarize({
    endpoint: body.endpoint,
    apiKey,
    model: body.model,
    systemPrompt: body.summaryPrompt,
    temperature: clampTemperature(body.temperature),
    source,
    documentContext: job.context,
  });

  // Không khôi phục code block, không validate tỉ lệ — tóm tắt không phải bản dịch.
  const [row] = await db
    .update(sections)
    .set(
      outcome.translated === null
        ? {
            status: "error",
            error: outcome.error,
            rawResponse: outcome.raw,
            attempts: section.attempts + outcome.attempts,
            updatedAt: new Date(),
          }
        : {
            status: "done",
            summary: outcome.translated,
            error: null,
            rawResponse: outcome.raw,
            attempts: section.attempts + outcome.attempts,
            updatedAt: new Date(),
          }
    )
    .where(eq(sections.id, id))
    .returning();

  return ok(row);
}
