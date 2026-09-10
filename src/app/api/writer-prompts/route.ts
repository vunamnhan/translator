import { db } from "@/db";
import { writerPrompts } from "@/db/schema";
import { bad, isUniqueViolation, ok, readJson } from "@/lib/http";
import {
  normalizeFields,
  normalizeName,
  normalizeTemperature,
  validateWriterInput,
  type WriterPromptInput,
} from "@/lib/writerPrompts";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Danh sách mẫu, A→Z không phân biệt hoa thường (CR v0.6 §5.1). */
export async function GET() {
  const rows = await db.select().from(writerPrompts).orderBy(sql`lower(${writerPrompts.name})`);
  return ok(rows);
}

export async function POST(req: Request) {
  const body = await readJson<WriterPromptInput>(req);
  if (!body) return bad("Body không hợp lệ");

  const error = validateWriterInput(body);
  if (error) return bad(error);

  try {
    const [prompt] = await db
      .insert(writerPrompts)
      .values({
        name: normalizeName(body.name),
        template: body.template as string,
        fields: normalizeFields(body.fields),
        temperature: normalizeTemperature(body.temperature),
      })
      .returning();
    return ok(prompt, 201);
  } catch (e) {
    if (isUniqueViolation(e)) return bad("Đã có mẫu trùng tên", 409);
    throw e;
  }
}
