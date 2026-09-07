"use client";

import { useEffect, useMemo, useRef } from "react";
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
        html: c.status === "done" && c.translated ? renderMarkdown(c.translated) : "",
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
    <div
      ref={boxRef}
      className="h-full overflow-y-auto rounded border border-neutral-300 bg-white p-6 dark:border-neutral-700 dark:bg-neutral-900"
    >
      {!anyDone && (
        <p className="text-sm text-neutral-500">
          Chưa có bản dịch nào. Bấm Start để dịch, nội dung sẽ hiện ở đây.
        </p>
      )}

      <div className="md-preview mx-auto max-w-3xl">
        {rendered.map((r) => {
          const selected = r.id === selectedId;
          return (
            <section
              key={r.id}
              data-chunk={r.id}
              onClick={() => onSelect(r.id)}
              className={`-mx-3 scroll-mt-6 cursor-pointer rounded px-3 py-1 transition-colors ${
                selected ? "bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-950/40 dark:ring-blue-800" : ""
              }`}
            >
              {r.html ? (
                <div dangerouslySetInnerHTML={{ __html: r.html }} />
              ) : (
                <p className="my-1 text-xs italic text-neutral-400">
                  #{r.idx} · {r.status === "skipped" ? "front matter, không dịch" : "chưa dịch"}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
