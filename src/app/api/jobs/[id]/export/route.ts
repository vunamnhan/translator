import { db } from "@/db";
import { chunks, jobs } from "@/db/schema";
import { assembleMarkdown } from "@/lib/assemble";
import { bad } from "@/lib/http";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);

  const rows = await db.select().from(chunks).where(eq(chunks.jobId, id)).orderBy(asc(chunks.idx));
  const md = assembleMarkdown(rows);
  const base = job.name.replace(/\.md$/i, "");

  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${encodeURIComponent(base)}.vi.md"`,
    },
  });
}
