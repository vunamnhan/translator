"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { Settings } from "./defaults";
import { getServerSnapshot, getSnapshot, hydrate, setSettings, subscribe } from "./settingsStore";

export function useSettings() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    hydrate();
  }, []);

  const update = useCallback((patch: Partial<Settings>) => setSettings(patch), []);

  return { settings: state.settings, update, loaded: state.loaded };
}
