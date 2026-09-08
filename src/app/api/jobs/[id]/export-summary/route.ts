import { db } from "@/db";
import { jobs, sections } from "@/db/schema";
import { assembleSummary } from "@/lib/assemble";
import { bad } from "@/lib/http";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);

  const rows = await db
    .select()
    .from(sections)
    .where(eq(sections.jobId, id))
    .orderBy(asc(sections.idx));
  const md = assembleSummary(job.context, rows);
  const base = job.name.replace(/\.md$/i, "");

  return new Response(md, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${encodeURIComponent(base)}.summary.md"`,
    },
  });
}
