"use client";

import { useMemo } from "react";
import ContextBar from "./ContextBar";
import SectionBar from "./SectionBar";
import SummaryPreview, { CONTEXT_ID } from "./SummaryPreview";
import type { ChunkDTO, JobDTO, SectionDTO } from "@/lib/types";

interface Props {
  job: JobDTO;
  chunks: ChunkDTO[];
  sections: SectionDTO[];
  running: boolean;
  otherLoopRunning: boolean;
  contextBusy: boolean;
  truncated: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onGenerateContext: () => void;
  onSaveContext: (value: string) => void;
  onResection: () => void;
  onSaveSummary: (id: string, value: string) => void;
  onResummarize: (id: string) => void;
  onJumpToChunk: (idx: number) => void;
}

/** Bố cục y hệt tab Translate: danh sách bên trái, khung đọc bên phải. */
export default function SummaryView({
  job,
  chunks,
  sections,
  running,
  otherLoopRunning,
  contextBusy,
  truncated,
  selectedId,
  onSelect,
  onGenerateContext,
  onSaveContext,
  onResection,
  onSaveSummary,
  onResummarize,
  onJumpToChunk,
}: Props) {
  const hasContext = Boolean(job.context && job.context.trim());

  /** Source của từng section, ghép từ chunk trong dải. */
  const sourceById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sections) {
      map.set(
        s.id,
        chunks
          .filter((c) => c.idx >= s.chunkFrom && c.idx <= s.chunkTo && c.status !== "skipped")
          .map((c) => c.sourceOverride ?? c.source)
          .join("")
      );
    }
    return map;
  }, [sections, chunks]);

  const toggle = (id: string) => onSelect(selectedId === id ? null : id);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-[minmax(260px,25%)_1fr]">
      <div className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
        <ContextBar
          job={job}
          expanded={selectedId === CONTEXT_ID}
          busy={contextBusy}
          truncated={truncated}
          onToggle={() => toggle(CONTEXT_ID)}
          onGenerate={onGenerateContext}
          onSave={onSaveContext}
        />

        {sections.length === 0 ? (
          <div className="space-y-3 rounded border border-dashed border-neutral-300 p-4 text-center dark:border-neutral-700">
            <p className="text-xs text-neutral-500">
              Chưa có section nào — job này tạo trước khi có chức năng tóm tắt.
            </p>
            <button
              onClick={onResection}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white"
            >
              Gom lại section
            </button>
          </div>
        ) : (
          sections.map((s) => (
            <SectionBar
              key={s.id}
              section={s}
              sourceText={sourceById.get(s.id) ?? ""}
              expanded={selectedId === s.id}
              disabled={!hasContext || running || otherLoopRunning}
              onToggle={toggle}
              onSaveSummary={onSaveSummary}
              onResummarize={onResummarize}
              onJumpToChunk={onJumpToChunk}
            />
          ))
        )}
      </div>

      <div className="min-h-0">
        <SummaryPreview
          context={job.context}
          sections={sections}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
