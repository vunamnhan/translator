import { db } from "@/db";
import { ok } from "@/lib/http";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Danh sách tag đã dùng trên MỌI job, kể cả archived — cho gợi ý lúc gõ và cho
 * dropdown lọc. Gom theo lower(tag) nên `API` và `api` về một dòng.
 */
export async function GET() {
  const rows = await db.execute<{ tag: string; count: number }>(sql`
    select min(t) as tag, count(*)::int as count
    from "jobs", unnest("jobs"."tags") as t
    group by lower(t)
    order by count desc, min(t) asc
  `);

  return ok(Array.from(rows));
}
