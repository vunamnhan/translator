/**
 * Biến trong prompt dịch. App **không** tự nối khối ngữ cảnh vào prompt nữa —
 * người dùng đặt `{{ten_bien}}` ở đâu thì khối nằm ở đó, và tự viết câu hướng dẫn
 * quanh nó. Thứ duy nhất app còn tự nối là output contract, vì parser dựa vào thẻ.
 *
 * Luật thuần: route dùng để điền, Settings dùng để hiện bảng help. Cùng một danh
 * sách, đừng khai báo bản thứ hai trong component.
 */

/** Cùng dạng với placeholder của Assistant Writer (v0.6) để người dùng chỉ phải nhớ một cú pháp. */
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]{1,40})\s*\}\}/g;

export type PromptVar =
  | "general_context"
  | "sliding_window_context"
  | "previous_chunk_summary"
  | "previous_chunk_content"
  | "previous_chunk_source"
  | "chunk_source"
  | "full_source";

export interface PromptVarSpec {
  name: PromptVar;
  /** Một dòng mô tả, hiện ngay dưới ô prompt. */
  hint: string;
  /** Điều kiện để biến có giá trị. Không thoả thì nó rỗng và cả đoạn bị bỏ. */
  needs: string | null;
}

export const PROMPT_VARS: PromptVarSpec[] = [
  {
    name: "chunk_source",
    hint: "Nội dung chunk đang dịch (bản gốc)",
    needs: null,
  },
  {
    name: "general_context",
    hint: "Ngữ cảnh chung của job",
    needs: "bật “Dùng ngữ cảnh chung khi dịch” và job đã tạo ngữ cảnh chung",
  },
  {
    name: "sliding_window_context",
    hint: "Tóm tắt các đoạn xa + nguyên văn mấy đoạn gần nhất",
    needs: "nấc Cửa sổ trượt",
  },
  {
    name: "previous_chunk_summary",
    hint: "Tóm tắt đoạn liền trước",
    needs: "ngữ cảnh mạch khác Tắt, và đoạn trước đã có tóm tắt",
  },
  {
    name: "previous_chunk_content",
    hint: "Nguyên văn bản dịch của đoạn liền trước",
    needs: "ngữ cảnh mạch khác Tắt, và đoạn trước đã dịch xong",
  },
  {
    name: "previous_chunk_source",
    hint: "Nguyên văn bản gốc của đoạn liền trước",
    needs: "ngữ cảnh mạch khác Tắt",
  },
  {
    name: "full_source",
    hint: "Toàn bộ văn bản gốc của job — cẩn thận, tài liệu dài là mỗi cú gọi tốn từng đó token",
    needs: null,
  },
];

const KNOWN = new Set<string>(PROMPT_VARS.map((v) => v.name));

export type PromptValues = Partial<Record<PromptVar, string | null>>;

export function isPromptVar(name: string): name is PromptVar {
  return KNOWN.has(name);
}

/** Prompt có nhắc tới biến này không. Dùng để khỏi query thứ chẳng ai cần. */
export function hasVar(template: string, name: PromptVar): boolean {
  for (const m of template.matchAll(PLACEHOLDER)) {
    if (m[1] === name) return true;
  }
  return false;
}

function value(values: PromptValues, name: PromptVar): string {
  const v = values[name];
  return typeof v === "string" ? v : "";
}

/**
 * Điền một lượt, **không đệ quy** — giá trị chứa `{{x}}` không bị thay tiếp.
 *
 * Biến rỗng thì **bỏ cả đoạn văn** chứa nó (đoạn = khối dòng liền nhau, ngăn bằng
 * dòng trống). Nhờ vậy người dùng gói thẻ và câu hướng dẫn chung một đoạn với
 * placeholder, không có ngữ cảnh thì cả cụm biến mất chứ không để lại thẻ rỗng.
 * Đoạn có nhiều biến chỉ bị bỏ khi **mọi** biến trong đó đều rỗng.
 *
 * Placeholder lạ (`{{gi_do}}`) giữ nguyên chữ: đó là văn bản của người dùng,
 * app không có quyền xoá.
 */
export function fillPrompt(template: string, values: PromptValues): string {
  // Giữ luôn dấu ngăn để không phá cách xuống dòng người dùng đã gõ.
  const parts = template.split(/(\r?\n[ \t]*\r?\n)/);
  const out: string[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const para = parts[i];
    const sep = parts[i + 1] ?? "";

    const names: PromptVar[] = [];
    for (const m of para.matchAll(PLACEHOLDER)) {
      if (isPromptVar(m[1])) names.push(m[1]);
    }
    // Cả đoạn chỉ nói về ngữ cảnh đang không có → bỏ luôn đoạn lẫn dấu ngăn.
    if (names.length > 0 && names.every((n) => value(values, n).trim().length === 0)) continue;

    out.push(
      para.replace(PLACEHOLDER, (all, name: string) =>
        isPromptVar(name) ? value(values, name) : all
      ) + sep
    );
  }

  return out.join("").replace(/\s+$/, "");
}
