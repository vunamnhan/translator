export const FRONT_MATTER = `---
title: Tài liệu
tags: [a, b]
---

# Heading 1

Đoạn văn đầu tiên với [link](https://example.com) và \`inline code\`.

## Section 2

\`\`\`ts
const x = 1;
console.log("giữ nguyên  bytes\\t nhé");
\`\`\`

| Cột A | Cột B |
|---|---|
| 1 | 2 |
| 3 | 4 |

- item một
- item hai
  - item lồng

> blockquote nè

<div class="html-block">raw html</div>

---

Đoạn cuối không có newline cuối file.`;

/** Tài liệu 100+ block để test invariant. */
export function bigDoc(blocks = 120): string {
  const parts: string[] = ["---\nid: big\n---\n"];
  for (let i = 0; i < blocks; i++) {
    if (i % 7 === 0) parts.push(`## Section ${i}\n`);
    else if (i % 7 === 3) parts.push(`\`\`\`js\nconst n${i} = ${i};\n\`\`\`\n`);
    else if (i % 7 === 5) parts.push(`| a | b |\n|---|---|\n| ${i} | ${i + 1} |\n`);
    else parts.push(`Đoạn số ${i} ${"lorem ipsum dolor sit amet ".repeat(3 + (i % 5))}\n`);
  }
  return parts.join("\n");
}
