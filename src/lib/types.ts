import type { ChunkMode, ChunkStatus, SectionStatus } from "./defaults";

export interface JobDTO {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  archivedAt: string | null;
  pinnedAt: string | null;
  source: string;
  systemPrompt: string;
  model: string;
  endpoint: string;
  chunkTokens: number;
  context: string | null;
  contextEdited: boolean;
  summaryTokens: number;
  contextMaxTokens: number;
  /** CR v0.4 — quy tắc đã dùng lúc cắt. */
  chunkMode: ChunkMode;
  createdAt: string;
  updatedAt: string;
}

export interface ChunkDTO {
  id: string;
  jobId: string;
  idx: number;
  source: string;
  sourceOverride: string | null;
  translated: string | null;
  status: ChunkStatus;
  warning: string | null;
  error: string | null;
  rawResponse: string | null;
  attempts: number;
  edited: boolean;
  updatedAt: string;
}

export interface SectionDTO {
  id: string;
  jobId: string;
  idx: number;
  heading: string;
  chunkFrom: number;
  chunkTo: number;
  summary: string | null;
  status: SectionStatus;
  error: string | null;
  rawResponse: string | null;
  attempts: number;
  updatedAt: string;
}

export interface JobListItem {
  id: string;
  name: string;
  tags: string[];
  favorite: boolean;
  archivedAt: string | null;
  pinnedAt: string | null;
  createdAt: string;
  updatedAt: string;
  total: number;
  done: number;
  errors: number;
  sectionsTotal: number;
  sectionsDone: number;
}

export interface JobListResponse {
  items: JobListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface TagCount {
  tag: string;
  count: number;
}
