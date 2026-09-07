import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);
  const rows = await db.select().from(chunks).where(eq(chunks.jobId, id)).orderBy(asc(chunks.idx));
  return ok({ job, chunks: rows });
}

interface PatchBody {
  systemPrompt?: string;
  model?: string;
  endpoint?: string;
  name?: string;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<PatchBody>(req);
  if (!body) return bad("Body không hợp lệ");

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.systemPrompt === "string") patch.systemPrompt = body.systemPrompt;
  if (typeof body.model === "string") patch.model = body.model;
  if (typeof body.endpoint === "string") patch.endpoint = body.endpoint;
  if (typeof body.name === "string") patch.name = body.name.slice(0, 200);

  const [job] = await db.update(jobs).set(patch).where(eq(jobs.id, id)).returning();
  if (!job) return bad("Không tìm thấy job", 404);
  return ok(job);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job] = await db.delete(jobs).where(eq(jobs.id, id)).returning();
  if (!job) return bad("Không tìm thấy job", 404);
  return ok({ deleted: job.id });
}
