import { db } from "@/db";
import { chunks, jobs, sections } from "@/db/schema";
import { bad, ok } from "@/lib/http";
import { and, asc, eq, ne } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Đưa job về trạng thái vừa tạo để chạy lại từ đầu.
 *
 * Xoá thứ do các lần chạy sinh ra: bản dịch, tóm tắt chunk, tóm tắt section,
 * lỗi, raw response, số lần gọi. **Giữ** thứ của người dùng và của cấu trúc:
 * văn bản gốc, phần nguồn đã sửa tay, bố cục chunk, danh sách section, tag,
 * và ngữ cảnh chung (tốn tiền tạo, lại hay được sửa tay — muốn bỏ thì tạo lại
 * ở tab Summary).
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);

  const now = new Date();

  // Chunk `skipped` (front matter) không đụng tới: nó chưa bao giờ được dịch.
  await db
    .update(chunks)
    .set({
      status: "pending",
      translated: null,
      warning: null,
      error: null,
      rawResponse: null,
      attempts: 0,
      edited: false,
      summary: null,
      prevSummaryUsed: false,
      updatedAt: now,
    })
    .where(and(eq(chunks.jobId, id), ne(chunks.status, "skipped")));

  await db
    .update(sections)
    .set({
      status: "pending",
      summary: null,
      error: null,
      rawResponse: null,
      attempts: 0,
      updatedAt: now,
    })
    .where(eq(sections.jobId, id));

  const [updated] = await db.update(jobs).set({ updatedAt: now }).where(eq(jobs.id, id)).returning();
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

  return ok({ job: updated, chunks: chunkRows, sections: sectionRows });
}
