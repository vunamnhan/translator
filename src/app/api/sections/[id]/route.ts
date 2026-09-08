import { db } from "@/db";
import { sections } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface PatchBody {
  summary?: string | null;
  status?: "pending";
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<PatchBody>(req);
  if (!body) return bad("Body không hợp lệ");

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if ("summary" in body) {
    patch.summary = body.summary;
    if (typeof body.summary === "string" && body.summary.length > 0) {
      patch.status = "done";
      patch.error = null;
    }
  }
  if (body.status === "pending") {
    patch.status = "pending";
    patch.error = null;
    patch.attempts = 0;
  }

  const [row] = await db.update(sections).set(patch).where(eq(sections.id, id)).returning();
  if (!row) return bad("Không tìm thấy section", 404);
  return ok(row);
}
