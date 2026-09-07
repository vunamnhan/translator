import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import type { Root, RootContent, Code, Table, Link, Image } from "mdast";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml", "toml"]);

export function parseMarkdown(source: string): Root {
  return processor.parse(source) as Root;
}

export interface BlockRef {
  type: string;
  start: number;
  end: number;
}

/** Block node cấp 1 kèm offset trong source gốc. */
export function topLevelBlocks(source: string): BlockRef[] {
  const tree = parseMarkdown(source);
  const out: BlockRef[] = [];
  for (const node of tree.children as RootContent[]) {
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined) continue;
    out.push({ type: node.type, start, end });
  }
  return out;
}

function walk(node: unknown, fn: (n: RootContent) => void) {
  const n = node as { children?: unknown[] } & RootContent;
  fn(n);
  if (Array.isArray(n.children)) {
    for (const c of n.children) walk(c, fn);
  }
}

export interface Slice {
  start: number;
  end: number;
  text: string;
}

/** Mọi code block (fenced + indented) kèm slice nguyên bytes. */
export function codeBlocks(source: string): Slice[] {
  const tree = parseMarkdown(source);
  const out: Slice[] = [];
  walk(tree, (n) => {
    if (n.type !== "code") return;
    const c = n as Code;
    const start = c.position?.start.offset;
    const end = c.position?.end.offset;
    if (start === undefined || end === undefined) return;
    out.push({ start, end, text: source.slice(start, end) });
  });
  return out.sort((a, b) => a.start - b.start);
}

export interface TableShape {
  rows: number;
  cols: number[];
}

export function tableShapes(source: string): TableShape[] {
  const tree = parseMarkdown(source);
  const out: TableShape[] = [];
  walk(tree, (n) => {
    if (n.type !== "table") return;
    const t = n as Table;
    out.push({
      rows: t.children.length,
      cols: t.children.map((r) => r.children.length),
    });
  });
  return out;
}

/** URL của link + image, theo thứ tự xuất hiện. */
export function urls(source: string): string[] {
  const tree = parseMarkdown(source);
  const out: string[] = [];
  walk(tree, (n) => {
    if (n.type === "link") out.push((n as Link).url);
    else if (n.type === "image") out.push((n as Image).url);
  });
  return out;
}
