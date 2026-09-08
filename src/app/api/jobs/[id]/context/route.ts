import { db } from "@/db";
import { chunks, jobs, sections } from "@/db/schema";
import { CONTEXT_PROMPT, CONTEXT_TRUNCATED_NOTE } from "@/lib/defaults";
import { bad, ok, readJson } from "@/lib/http";
import { assertEndpointAllowed, buildContext, LlmError } from "@/lib/llm";
import { buildContextInput } from "@/lib/sectioner";
import { clampContextMaxTokens, clampTemperature } from "@/lib/validate";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface PostBody {
  endpoint?: string;
  model?: string;
  temperature?: number;
  contextMaxTokens?: number;
  /** CR v0.3: preset ghi đè prompt ngữ cảnh chung. Rỗng / thiếu = prompt của app. */
  contextPrompt?: string;
}

/** Tạo tóm tắt chung: gửi nguyên văn nếu vừa ngưỡng, không thì gửi skeleton. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const apiKey = req.headers.get("x-llm-key") ?? "";
  if (!apiKey) return bad("Thiếu header x-llm-key", 401);

  const body = await readJson<PostBody>(req);
  if (!body) return bad("Body không hợp lệ");
  if (!body.endpoint || !body.model) return bad("Thiếu endpoint / model");

  try {
    assertEndpointAllowed(body.endpoint);
  } catch (e) {
    return bad((e as LlmError).message);
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);

  const contextMaxTokens = clampContextMaxTokens(body.contextMaxTokens ?? job.contextMaxTokens);
  const chunkRows = await db
    .select()
    .from(chunks)
    .where(eq(chunks.jobId, id))
    .orderBy(asc(chunks.idx));
  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.jobId, id))
    .orderBy(asc(sections.idx));

  const input = buildContextInput(chunkRows, sectionRows, contextMaxTokens);
  if (input.text.trim().length === 0) return bad("Job chưa có nội dung để tóm tắt");

  // Note cắt skeleton và contract vẫn do app nối, preset không sửa được (§3.3).
  const basePrompt =
    typeof body.contextPrompt === "string" && body.contextPrompt.trim()
      ? body.contextPrompt
      : CONTEXT_PROMPT;

  const outcome = await buildContext({
    endpoint: body.endpoint,
    apiKey,
    model: body.model,
    systemPrompt: input.truncated ? `${basePrompt}\n\n${CONTEXT_TRUNCATED_NOTE}` : basePrompt,
    temperature: clampTemperature(body.temperature),
    source: input.text,
  });

  if (outcome.translated === null) {
    return ok({ error: outcome.error, raw: outcome.raw, truncated: input.truncated }, 200);
  }

  const [updated] = await db
    .update(jobs)
    .set({
      context: outcome.translated,
      contextEdited: false,
      contextMaxTokens,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, id))
    .returning();

  return ok({ job: updated, truncated: input.truncated, error: null });
}

/** Lưu bản user sửa tay. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<{ context?: string }>(req);
  if (!body || typeof body.context !== "string") return bad("Body không hợp lệ");

  const [job] = await db
    .update(jobs)
    .set({ context: body.context, contextEdited: true, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();
  if (!job) return bad("Không tìm thấy job", 404);
  return ok(job);
}
