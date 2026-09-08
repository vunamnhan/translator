import { db } from "@/db";
import { chunks, sections } from "@/db/schema";
import { buildSections } from "./sectioner";
import { asc, eq } from "drizzle-orm";

/** Xoá sections cũ rồi gom lại từ chunk hiện tại. Tóm tắt section mất theo — đúng mục 2.3 CR. */
export async function regenerateSections(jobId: string, summaryTokens: number) {
  const rows = await db
    .select()
    .from(chunks)
    .where(eq(chunks.jobId, jobId))
    .orderBy(asc(chunks.idx));

  const pieces = buildSections(rows, summaryTokens);

  await db.delete(sections).where(eq(sections.jobId, jobId));
  if (pieces.length === 0) return [];

  return db
    .insert(sections)
    .values(
      pieces.map((p) => ({
        jobId,
        idx: p.idx,
        heading: p.heading,
        chunkFrom: p.chunkFrom,
        chunkTo: p.chunkTo,
        status: "pending",
      }))
    )
    .returning()
    .then((r) => r.sort((a, b) => a.idx - b.idx));
}
