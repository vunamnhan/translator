"use client";

import { useEffect, useMemo, useRef } from "react";
import { ReadingPane } from "./chrome";
import { renderMarkdown } from "@/lib/renderMarkdown";
import type { SectionDTO } from "@/lib/types";

export const CONTEXT_ID = "__context__";

interface Props {
  context: string | null;
  sections: SectionDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Chế độ đọc: chỉ còn bài, bấm vào đoạn không chọn/tô màu nữa. */
  readOnly?: boolean;
}

/** Khung đọc bên phải — song song với Preview của tab Translate. */
export default function SummaryPreview({
  context,
  sections,
  selectedId,
  onSelect,
  readOnly = false,
}: Props) {
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
    if (!selectedId || readOnly) return;
    boxRef.current
      ?.querySelector(`[data-section="${selectedId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId, readOnly]);

  const anyDone = rendered.some((r) => r.html);

  return (
    <ReadingPane boxRef={boxRef}>
      <section
        data-section={CONTEXT_ID}
        onClick={readOnly ? undefined : () => onSelect(CONTEXT_ID)}
        className={`mb-[26px] scroll-mt-6 rounded-[20px] bg-accent-100 px-5 py-[18px] transition-shadow ${
          readOnly ? "" : "cursor-pointer"
        } ${!readOnly && selectedId === CONTEXT_ID ? "ring-2 ring-inset ring-accent-300" : ""}`}
      >
        <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-accent-700">
          Ngữ cảnh chung · §0
        </div>
        {contextHtml ? (
          <div dangerouslySetInnerHTML={{ __html: contextHtml }} />
        ) : (
          <p className="my-1 text-sm text-sand-600">
            Chưa có ngữ cảnh chung. Mở thẻ <strong>Ngữ cảnh chung</strong> bên trái rồi bấm{" "}
            <em>Tạo tóm tắt chung</em>.
          </p>
        )}
      </section>

      {!anyDone && (
        <p className="py-10 text-center text-[13.5px] text-sand-600">
          Chưa có tóm tắt nào. Bấm Start để tóm tắt, nội dung sẽ hiện ở đây.
        </p>
      )}

      {rendered.map((r) => {
        const selected = !readOnly && r.id === selectedId;
        return (
          <section
            key={r.id}
            data-section={r.id}
            onClick={readOnly ? undefined : () => onSelect(r.id)}
            className={`-mx-3.5 mb-1.5 scroll-mt-6 rounded-[18px] px-3.5 py-2.5 transition-colors ${
              readOnly ? "" : "cursor-pointer"
            } ${selected ? "bg-accent-100 ring-2 ring-inset ring-accent-300" : ""}`}
          >
            <h3>{r.heading}</h3>
            {r.html ? (
              <div
                className={r.stale ? "animate-tz-pulse opacity-50" : undefined}
                dangerouslySetInnerHTML={{ __html: r.html }}
              />
            ) : (
              <div className="text-[12.5px] italic text-sand-500">
                §{r.idx + 1} ·{" "}
                {r.status === "summarizing"
                  ? "đang tóm tắt…"
                  : r.status === "error"
                    ? "lỗi"
                    : "chưa tóm tắt"}
              </div>
            )}
          </section>
        );
      })}
    </ReadingPane>
  );
}
