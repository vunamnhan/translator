import { db } from "@/db";
import { presets } from "@/db/schema";
import { bad, isUniqueViolation, ok, readJson } from "@/lib/http";
import {
  normalizeContextPrompt,
  normalizeName,
  validatePresetInput,
  type PresetInput,
} from "@/lib/presets";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Danh sách preset, A→Z không phân biệt hoa thường. Trả đủ prompt — vài chục preset vẫn nhỏ. */
export async function GET() {
  const rows = await db.select().from(presets).orderBy(sql`lower(${presets.name})`);
  return ok(rows);
}

export async function POST(req: Request) {
  const body = await readJson<PresetInput>(req);
  if (!body) return bad("Body không hợp lệ");

  const error = validatePresetInput(body);
  if (error) return bad(error);

  try {
    const [preset] = await db
      .insert(presets)
      .values({
        name: normalizeName(body.name),
        translatePrompt: body.translatePrompt as string,
        summaryPrompt: body.summaryPrompt as string,
        contextPrompt: normalizeContextPrompt(body.contextPrompt),
      })
      .returning();
    return ok(preset, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return bad("Đã có preset trùng tên", 409);
    throw e;
  }
}
