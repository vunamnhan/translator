"use client";

import { useCallback, useEffect, useState } from "react";
import type { TagCount } from "./types";

/** Danh sách tag đã dùng trên mọi job — cho dropdown lọc và gợi ý lúc gõ. */
export function useTags() {
  const [tags, setTags] = useState<TagCount[]>([]);

  const reload = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (res.ok) setTags((await res.json()) as TagCount[]);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tags, reload };
}
