import { db } from "@/db";
import { jobs } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { regenerateSections } from "@/lib/sectionStore";
import { clampSummaryTokens } from "@/lib/validate";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<{ summaryTokens?: number }>(req);
  if (!body) return bad("Body không hợp lệ");

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) return bad("Không tìm thấy job", 404);

  const summaryTokens = clampSummaryTokens(body.summaryTokens ?? job.summaryTokens);
  const rows = await regenerateSections(id, summaryTokens);

  const [updated] = await db
    .update(jobs)
    .set({ summaryTokens, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();

  return ok({ job: updated, sections: rows });
}
