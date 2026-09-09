import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../src/lib/defaults";

/** localStorage giả, đủ dùng cho store. */
function mockStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  };
}

async function freshStore(seed?: string) {
  vi.resetModules();
  const storage = mockStorage();
  if (seed) storage.setItem(SETTINGS_KEY, seed);
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { addEventListener: () => {} });
  const mod = await import("../src/lib/settingsStore");
  mod.hydrate();
  return { mod, storage };
}

beforeEach(() => vi.unstubAllGlobals());

describe("settingsStore", () => {
  it("lưu settings xuống localStorage và cập nhật snapshot", async () => {
    const { mod, storage } = await freshStore();
    mod.setSettings({ apiKeys: ["sk-a"], model: "gpt-4o", cooldownMs: 2000 });

    expect(mod.getSnapshot().settings.apiKeys).toEqual(["sk-a"]);
    expect(mod.getSnapshot().settings.model).toBe("gpt-4o");

    const saved = JSON.parse(storage.getItem(SETTINGS_KEY)!);
    expect(saved.apiKeys).toEqual(["sk-a"]);
    expect(saved.cooldownMs).toBe(2000);
  });

  it("bỏ key rỗng và key trùng khi lưu", async () => {
    const { mod } = await freshStore();
    mod.setSettings({ apiKeys: ["sk-a", "  ", "sk-a", "sk-b"] });
    expect(mod.getSnapshot().settings.apiKeys).toEqual(["sk-a", "sk-b"]);
  });

  it("chuyển apiKey của v0.1 sang apiKeys khi load", async () => {
    const { mod } = await freshStore(JSON.stringify({ apiKey: "sk-cu", model: "gpt-4o-mini" }));
    expect(mod.getSnapshot().settings.apiKeys).toEqual(["sk-cu"]);
  });

  it("chuỗi không đứng một mình: tắt chunkSummary thì chainPrevSummary tắt theo", async () => {
    const { mod } = await freshStore(
      JSON.stringify({ chunkSummary: false, chainPrevSummary: true })
    );
    expect(mod.getSnapshot().settings.chainPrevSummary).toBe(false);

    mod.setSettings({ chunkSummary: true, chainPrevSummary: true });
    expect(mod.getSnapshot().settings.chainPrevSummary).toBe(true);

    mod.setSettings({ chunkSummary: false });
    expect(mod.getSnapshot().settings.chainPrevSummary).toBe(false);
  });

  it("thiếu key trong bản lưu cũ thì lấy mặc định", async () => {
    const { mod } = await freshStore(JSON.stringify({ model: "x" }));
    expect(mod.getSnapshot().settings.cooldownMs).toBe(DEFAULT_SETTINGS.cooldownMs);
    expect(mod.getSnapshot().settings.apiKeys).toEqual([]);
  });

  it("lưu xong thì mảng apiKeys bằng giá trị với draft — cơ sở để tính dirty", async () => {
    const { mod } = await freshStore();
    const draft = { ...DEFAULT_SETTINGS, apiKeys: ["sk-a"] };
    mod.setSettings(draft);
    const after = mod.getSnapshot().settings.apiKeys;
    // Tham chiếu khác nhau (store chuẩn hoá lại) nhưng giá trị phải trùng.
    expect(after).not.toBe(draft.apiKeys);
    expect(after).toEqual(draft.apiKeys);
  });
});
