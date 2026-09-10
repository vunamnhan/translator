import { bad, ok, readJson } from "@/lib/http";
import { assertEndpointAllowed, LlmError, writeText } from "@/lib/llm";
import { clampTemperature } from "@/lib/validate";
import { MAX_FILLED_PROMPT } from "@/lib/writerPrompts";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

interface Body {
  endpoint?: string;
  model?: string;
  temperature?: number;
  /** Prompt đã điền placeholder ở front-end. */
  prompt?: string;
}

/**
 * Một cú gọi Assistant Writer (CR v0.6 §5.5). Server **không** biết mẫu hay
 * placeholder — điền xong ở front-end rồi mới gửi, nên route này dùng lại được
 * cho mọi chỗ gắn popup sau này. Không ghi DB, không log prompt hay output.
 */
export async function POST(req: Request) {
  const apiKey = req.headers.get("x-llm-key") ?? "";
  if (!apiKey) return bad("Thiếu header x-llm-key", 401);

  const body = await readJson<Body>(req);
  if (!body) return bad("Body không hợp lệ");
  if (!body.endpoint || !body.model) return bad("Thiếu endpoint / model");
  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return bad("Thiếu prompt");
  }
  if (body.prompt.length > MAX_FILLED_PROMPT) return bad("Prompt sau khi điền quá dài");

  try {
    assertEndpointAllowed(body.endpoint);
  } catch (e) {
    return bad((e as LlmError).message);
  }

  const outcome = await writeText({
    endpoint: body.endpoint,
    apiKey,
    model: body.model,
    temperature: clampTemperature(body.temperature),
    prompt: body.prompt,
  });

  // Lỗi LLM trả 200 kèm `error` như route dịch, để UI dùng chung bảng gợi ý.
  return ok(outcome);
}
