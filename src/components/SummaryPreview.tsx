"use client";

import { useEffect, useMemo, useRef } from "react";
import { renderMarkdown } from "@/lib/renderMarkdown";
import type { SectionDTO } from "@/lib/types";

export const CONTEXT_ID = "__context__";

interface Props {
  context: string | null;
  sections: SectionDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Khung đọc bên phải — song song với Preview của tab Translate. */
export default function SummaryPreview({ context, sections, selectedId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  const contextHtml = useMemo(() => (context ? renderMarkdown(context) : ""), [context]);

  const rendered = useMemo(
    () =>
      sections.map((s) => ({
        id: s.id,
        idx: s.idx,
        heading: s.heading,
        status: s.status,
        // Giữ bản tóm tắt cũ trên màn hình trong lúc tóm tắt lại, chỉ làm mờ đi.
        html: s.summary ? renderMarkdown(s.summary) : "",
        stale: s.status === "summarizing" && Boolean(s.summary),
      })),
    [sections]
  );

  useEffect(() => {
    if (!selectedId) return;
    boxRef.current
      ?.querySelector(`[data-section="${selectedId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]);

  const anyDone = rendered.some((r) => r.html);

  return (
    <div
      ref={boxRef}
      className="h-full overflow-y-auto rounded border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900"
    >
      <div className="md-preview mx-auto max-w-3xl">
        <section
          data-section={CONTEXT_ID}
          onClick={() => onSelect(CONTEXT_ID)}
          className={`-mx-3 mb-4 scroll-mt-6 cursor-pointer rounded border-b border-neutral-200 px-3 pb-3 transition-colors dark:border-neutral-800 ${
            selectedId === CONTEXT_ID
              ? "bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:ring-blue-800"
              : ""
          }`}
        >
          {contextHtml ? (
            <div dangerouslySetInnerHTML={{ __html: contextHtml }} />
          ) : (
            <p className="my-1 text-sm text-neutral-500">
              Chưa có ngữ cảnh chung. Mở thẻ <strong>Ngữ cảnh chung</strong> bên trái rồi bấm{" "}
              <em>Tạo tóm tắt chung</em>.
            </p>
          )}
        </section>

        {!anyDone && (
          <p className="text-sm text-neutral-500">
            Chưa có tóm tắt nào. Bấm Start để tóm tắt, nội dung sẽ hiện ở đây.
          </p>
        )}

        {rendered.map((r) => {
          const selected = r.id === selectedId;
          return (
            <section
              key={r.id}
              data-section={r.id}
              onClick={() => onSelect(r.id)}
              className={`-mx-3 scroll-mt-6 cursor-pointer rounded px-3 py-1 transition-colors ${
                selected ? "bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:ring-blue-800" : ""
              }`}
            >
              <h2>{r.heading}</h2>
              {r.html ? (
                <div
                  className={r.stale ? "animate-pulse opacity-50" : undefined}
                  dangerouslySetInnerHTML={{ __html: r.html }}
                />
              ) : (
                <p className="my-1 text-xs italic text-neutral-400">
                  §{r.idx + 1} ·{" "}
                  {r.status === "summarizing"
                    ? "đang tóm tắt…"
                    : r.status === "error"
                      ? "lỗi"
                      : "chưa tóm tắt"}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
