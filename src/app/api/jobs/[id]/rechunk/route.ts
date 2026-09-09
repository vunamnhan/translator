import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { chunkMarkdown } from "@/lib/chunker";
import { bad, ok, readJson } from "@/lib/http";
import { asc, eq } from "drizzle-orm";
import { clampTokens } from "@/lib/validate";
import { regenerateSections } from "@/lib/sectionStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<{ chunkTokens?: number }>(req);
  if (!body) return bad("Body không hợp lệ");

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);

  const chunkTokens = clampTokens(body.chunkTokens);
  const pieces = chunkMarkdown(job.source, chunkTokens);

  await db.delete(chunks).where(eq(chunks.jobId, id));
  await db.insert(chunks).values(
    pieces.map((p, i) => ({
      jobId: id,
      idx: i,
      source: p.source,
      status: p.skip ? "skipped" : "pending",
    }))
  );

  const [updated] = await db
    .update(jobs)
    // Chunk lại là cắt theo cỡ token → bố cục theo rule cũ mất, mode về 'auto' (CR v0.4 §4.2).
    .set({ chunkTokens, chunkMode: "auto", updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();

  // Chunk đổi → section cũ vô nghĩa: xoá và gom lại. Ngữ cảnh chung giữ nguyên (mục 2.3 CR).
  const sectionRows = await regenerateSections(id, job.summaryTokens);

  const rows = await db.select().from(chunks).where(eq(chunks.jobId, id)).orderBy(asc(chunks.idx));
  return ok({ job: updated, chunks: rows, sections: sectionRows });
}
