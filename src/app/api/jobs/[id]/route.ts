import { db } from "@/db";
import { chunks, jobs, sections } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { normalizeTags } from "@/lib/tags";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);
  const rows = await db.select().from(chunks).where(eq(chunks.jobId, id)).orderBy(asc(chunks.idx));
  const sectionRows = await db
    .select()
    .from(sections)
    .where(eq(sections.jobId, id))
    .orderBy(asc(sections.idx));
  return ok({ job, chunks: rows, sections: sectionRows });
}

interface PatchBody {
  systemPrompt?: string;
  model?: string;
  endpoint?: string;
  name?: string;
  /** CR v0.2 */
  tags?: string[];
  archived?: boolean;
  pinned?: boolean;
  favorite?: boolean;
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
  if (body.tags !== undefined) patch.tags = normalizeTags(body.tags);
  if (typeof body.favorite === "boolean") patch.favorite = body.favorite;

  // Archive kéo theo bỏ pin (mục 2.2); favorite giữ nguyên.
  if (typeof body.archived === "boolean") {
    patch.archivedAt = body.archived ? new Date() : null;
    if (body.archived) patch.pinnedAt = null;
  }

  if (typeof body.pinned === "boolean") {
    if (body.pinned) {
      const [current] = await db.select().from(jobs).where(eq(jobs.id, id));
      if (!current) return bad("Không tìm thấy job", 404);
      // Vẫn archived sau khi áp patch lần này → từ chối pin.
      const stillArchived =
        patch.archivedAt !== undefined ? patch.archivedAt !== null : current.archivedAt !== null;
      if (stillArchived) return bad("Job đang ở archive — Unarchive trước rồi mới ghim được");
      patch.pinnedAt = new Date();
    } else {
      patch.pinnedAt = null;
    }
  }

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
