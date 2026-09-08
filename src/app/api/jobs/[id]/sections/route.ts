import { db } from "@/db";
import { sections } from "@/db/schema";
import { ok } from "@/lib/http";
import { asc, eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(sections)
    .where(eq(sections.jobId, id))
    .orderBy(asc(sections.idx));
  return ok(rows);
}
