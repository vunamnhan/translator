import { OUTPUT_CONTRACT, REMINDER } from "./defaults";
import { extractTranslation } from "./postprocess";

const CALL_TIMEOUT_MS = 120_000;
const TAG_RETRIES = 3;
const HTTP_BACKOFF_MS = [2000, 4000, 8000];

export class LlmError extends Error {
  constructor(message: string, readonly raw: string | null = null) {
    super(message);
  }
}

export function normalizeEndpoint(endpoint: string): string {
  const base = endpoint.trim().replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(base)) return base;
  return `${base}/chat/completions`;
}

/** Chỉ cho https, trừ khi ALLOW_HTTP_ENDPOINT=1. */
export function assertEndpointAllowed(endpoint: string): void {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new LlmError("Endpoint không hợp lệ");
  }
  if (url.protocol === "https:") return;
  if (url.protocol === "http:" && process.env.ALLOW_HTTP_ENDPOINT === "1") return;
  throw new LlmError("Chỉ cho phép endpoint https:// (bật ALLOW_HTTP_ENDPOINT=1 để dùng http)");
}

export interface TranslateParams {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  source: string;
}

export interface TranslateOutcome {
  translated: string | null;
  raw: string | null;
  attempts: number;
  error: string | null;
}

interface RawCall {
  content: string;
}

async function callOnce(
  p: TranslateParams,
  messages: { role: string; content: string }[]
): Promise<RawCall> {
  const url = normalizeEndpoint(p.endpoint);
  let lastErr: LlmError | null = null;

  for (let i = 0; i <= HTTP_BACKOFF_MS.length; i++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${p.apiKey}`,
        },
        body: JSON.stringify({
          model: p.model,
          temperature: p.temperature,
          stream: false,
          messages,
        }),
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      });
    } catch (e) {
      lastErr = new LlmError(
        e instanceof Error && e.name === "TimeoutError"
          ? "Timeout sau 120s"
          : `Không gọi được endpoint: ${(e as Error).message}`
      );
      if (i < HTTP_BACKOFF_MS.length) {
        await sleep(HTTP_BACKOFF_MS[i]);
        continue;
      }
      throw lastErr;
    }

    if (res.ok) {
      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new LlmError("Response không có choices[0].message.content", JSON.stringify(json).slice(0, 4000));
      }
      return { content };
    }

    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new LlmError(`LLM từ chối (HTTP ${res.status}) — kiểm tra API key`, body.slice(0, 4000));
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new LlmError(`LLM lỗi tạm thời (HTTP ${res.status})`, body.slice(0, 4000));
      if (i < HTTP_BACKOFF_MS.length) {
        await sleep(HTTP_BACKOFF_MS[i]);
        continue;
      }
      throw lastErr;
    }
    throw new LlmError(`LLM lỗi (HTTP ${res.status})`, body.slice(0, 4000));
  }

  throw lastErr ?? new LlmError("Lỗi không xác định");
}

/** Gọi LLM, retry khi model quên thẻ <translation>. */
export async function translate(p: TranslateParams): Promise<TranslateOutcome> {
  let raw: string | null = null;
  let attempts = 0;

  for (let attempt = 1; attempt <= TAG_RETRIES; attempt++) {
    attempts = attempt;
    const system =
      attempt === 1
        ? `${p.systemPrompt}\n\n${OUTPUT_CONTRACT}`
        : `${REMINDER}\n\n${p.systemPrompt}\n\n${OUTPUT_CONTRACT}`;
    const messages = [
      { role: "system", content: system },
      { role: "user", content: `<source>\n${p.source}\n</source>` },
    ];

    try {
      const { content } = await callOnce(p, messages);
      raw = content;
      const extracted = extractTranslation(content);
      if (extracted !== null) {
        return { translated: extracted, raw, attempts, error: null };
      }
    } catch (e) {
      const err = e as LlmError;
      return { translated: null, raw: err.raw ?? raw, attempts, error: err.message };
    }
  }

  return {
    translated: null,
    raw,
    attempts,
    error: `LLM không trả thẻ <translation> sau ${TAG_RETRIES} lần thử`,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
