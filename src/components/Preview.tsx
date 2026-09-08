"use client";

import { useEffect, useMemo, useRef } from "react";
import { ReadingPane } from "./chrome";
import { renderMarkdown } from "@/lib/renderMarkdown";
import type { ChunkDTO } from "@/lib/types";

interface Props {
  chunks: ChunkDTO[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Preview({ chunks, selectedId, onSelect }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  const rendered = useMemo(
    () =>
      chunks.map((c) => ({
        id: c.id,
        idx: c.idx,
        status: c.status,
        // Giữ bản dịch cũ trên màn hình trong lúc dịch lại, chỉ làm mờ đi.
        html: c.translated ? renderMarkdown(c.translated) : "",
        stale: c.status === "translating" && Boolean(c.translated),
      })),
    [chunks]
  );

  useEffect(() => {
    if (!selectedId) return;
    boxRef.current
      ?.querySelector(`[data-chunk="${selectedId}"]`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedId]);

  const anyDone = rendered.some((r) => r.html);

  return (
    <ReadingPane boxRef={boxRef}>
      {!anyDone && (
        <p className="py-16 text-center text-[13.5px] text-sand-600">
          Chưa có bản dịch nào. Bấm Start để dịch, nội dung sẽ hiện ở đây.
        </p>
      )}

      {rendered.map((r) => {
        const selected = r.id === selectedId;
        return (
          <section
            key={r.id}
            data-chunk={r.id}
            onClick={() => onSelect(r.id)}
            className={`-mx-3.5 mb-1.5 cursor-pointer scroll-mt-6 rounded-[18px] px-3.5 py-2.5 transition-colors ${
              selected ? "bg-accent-100 ring-2 ring-inset ring-accent-300" : ""
            }`}
          >
            {r.html ? (
              <div
                className={r.stale ? "animate-tz-pulse opacity-50" : undefined}
                dangerouslySetInnerHTML={{ __html: r.html }}
              />
            ) : (
              <div className="text-[12.5px] italic text-sand-500">
                #{r.idx} ·{" "}
                {r.status === "skipped"
                  ? "front matter, không dịch"
                  : r.status === "translating"
                    ? "đang dịch…"
                    : r.status === "error"
                      ? "lỗi"
                      : "chưa dịch"}
              </div>
            )}
          </section>
        );
      })}
    </ReadingPane>
  );
}
