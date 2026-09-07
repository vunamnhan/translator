import { db } from "@/db";
import { chunks } from "@/db/schema";
import { bad, ok, readJson } from "@/lib/http";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

interface PatchBody {
  sourceOverride?: string | null;
  translated?: string | null;
  status?: "pending";
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await readJson<PatchBody>(req);
  if (!body) return bad("Body không hợp lệ");

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if ("sourceOverride" in body) {
    patch.sourceOverride = body.sourceOverride === "" ? null : body.sourceOverride ?? null;
  }
  if ("translated" in body) {
    patch.translated = body.translated;
    patch.edited = true;
    if (typeof body.translated === "string" && body.translated.length > 0) {
      patch.status = "done";
      patch.error = null;
    }
  }
  if (body.status === "pending") {
    patch.status = "pending";
    patch.error = null;
    patch.warning = null;
    patch.attempts = 0;
  }

  const [row] = await db.update(chunks).set(patch).where(eq(chunks.id, id)).returning();
  if (!row) return bad("Không tìm thấy chunk", 404);
  return ok(row);
}
