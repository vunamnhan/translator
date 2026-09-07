import type { ChunkStatus } from "./defaults";

export interface JobDTO {
  id: string;
  name: string;
  source: string;
  systemPrompt: string;
  model: string;
  endpoint: string;
  chunkTokens: number;
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

export interface JobListItem {
  id: string;
  name: string;
  createdAt: string;
  total: number;
  done: number;
  errors: number;
}
