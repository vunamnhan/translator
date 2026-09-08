"use client";

import { useMemo } from "react";
import ContextBar from "./ContextBar";
import SectionBar from "./SectionBar";
import SummaryPreview, { CONTEXT_ID } from "./SummaryPreview";
import { ListPanel, type FilterDef } from "./chrome";
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
  /** id section → key thứ mấy đã gọi, chỉ trong bộ nhớ trang. */
  keyUsed: Record<string, number>;
  /** Ô tìm + chip lọc do JobView giữ state, để đổi tab là reset. */
  query: string;
  onQuery: (v: string) => void;
  filters: FilterDef[];
  filter: string;
  onFilter: (key: string) => void;
  /** Chế độ đọc (mobile) — giấu chrome, khoá chọn thẻ trong khung đọc. */
  readMode: boolean;
  /** Sheet danh sách ở mobile — state nằm trên JobView để hai tab dùng chung. */
  listOpen: boolean;
  onCloseList: () => void;
  onGenerateContext: () => void;
  onSaveContext: (value: string) => void;
  onResection: () => void;
  onSaveSummary: (id: string, value: string) => void;
  onResummarize: (id: string) => void;
  onJumpToChunk: (idx: number) => void;
}

/** Bố cục y hệt tab Translate: danh sách bên trái, khung đọc bên phải. */
export default function SummaryView({
  readMode,
  listOpen,
  onCloseList,
  job,
  chunks,
  sections,
  running,
  otherLoopRunning,
  contextBusy,
  truncated,
  selectedId,
  onSelect,
  keyUsed,
  query,
  onQuery,
  filters,
  filter,
  onFilter,
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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sections.filter((s) => {
      if (filter === "error" && s.status !== "error") return false;
      if (filter === "pending" && s.status !== "pending") return false;
      if (filter === "done" && s.status !== "done") return false;
      if (!q) return true;
      return `${s.heading}\n${s.summary ?? ""}\n${sourceById.get(s.id) ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [sections, filter, query, sourceById]);

  const toggle = (id: string) => onSelect(selectedId === id ? null : id);

  return (
    <div className="flex min-h-0 flex-1 gap-3 lg:px-5 lg:pb-4 lg:pt-3">
      <ListPanel
        open={listOpen}
        onClose={onCloseList}
        query={query}
        onQuery={onQuery}
        filters={filters}
        filter={filter}
        onFilter={onFilter}
        empty={sections.length > 0 && visible.length === 0 ? "Không có thẻ nào khớp bộ lọc." : null}
      >
        <div className="shrink-0">
          <ContextBar
            job={job}
            expanded={selectedId === CONTEXT_ID}
            busy={contextBusy}
            truncated={truncated}
            onToggle={() => toggle(CONTEXT_ID)}
            onGenerate={onGenerateContext}
            onSave={onSaveContext}
          />
        </div>

        {sections.length === 0 ? (
          <div className="shrink-0 space-y-3 rounded-[18px] border border-dashed border-sand-300 p-[18px] text-center">
            <p className="m-0 text-[12.5px] text-sand-600">
              Chưa có section nào — job này tạo trước khi có chức năng tóm tắt.
            </p>
            <button onClick={onResection} className="btn btn-primary btn-sm h-8">
              Gom lại section
            </button>
          </div>
        ) : (
          visible.map((s) => (
            <div key={s.id} className="shrink-0">
              <SectionBar
                section={s}
                keyIndex={keyUsed[s.id]}
                sourceText={sourceById.get(s.id) ?? ""}
                expanded={selectedId === s.id}
                disabled={!hasContext || running || otherLoopRunning}
                onToggle={toggle}
                onSaveSummary={onSaveSummary}
                onResummarize={onResummarize}
                onJumpToChunk={onJumpToChunk}
              />
            </div>
          ))
        )}
      </ListPanel>

      <div className="min-w-0 flex-1">
        <SummaryPreview
          context={job.context}
          sections={sections}
          selectedId={selectedId}
          onSelect={onSelect}
          readOnly={readMode}
        />
      </div>
    </div>
  );
}
