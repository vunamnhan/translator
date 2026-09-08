"use client";

import { useEffect, useState } from "react";
import {
  copyName,
  presetPromptSet,
  samePromptSet,
  type PromptSet,
} from "@/lib/presets";
import {
  createPreset,
  deletePreset,
  forgetPreset,
  loadPresets,
  PresetError,
  updatePreset,
  usePresetState,
} from "@/lib/presetStore";
import { useConfirm } from "./ConfirmDialog";
import { useNameDialog } from "./NameDialog";
import Menu from "./Menu";

interface Props {
  presetId: string | null;
  /** 3 prompt trong draft của drawer — thứ thực sự được gửi đi khi dịch. */
  prompts: PromptSet;
  /** Nạp preset vào draft (3 prompt + presetId), hoặc chỉ đổi presetId khi bỏ `prompts`. */
  onDraft: (patch: { presetId?: string | null; prompts?: PromptSet }) => void;
  /** Ghi working copy + presetId vào settings ngay, không chờ nút Lưu ở chân drawer. */
  onPersist: (presetId: string | null) => void;
}

/**
 * Thanh preset ở đầu tab Prompt (CR v0.3 §6.1). Preset nằm trên DB, working copy
 * nằm trong Settings — thanh này chỉ là cầu nối hai tầng, không tự gửi prompt đi đâu.
 */
export default function PresetBar({ presetId, prompts, onDraft, onPersist }: Props) {
  const { items, loading, error } = usePresetState();
  const { ask, dialog: confirmDialog } = useConfirm();
  const { askName, dialog: nameDialog } = useNameDialog();
  const [note, setNote] = useState<string | null>(null);

  // Nạp lúc mở tab Prompt, không nạp lúc mở app (§6.1). Nạp lại mỗi lần mở tab:
  // preset nằm trên DB, trình duyệt khác sửa được, danh sách cũ dễ lệch.
  useEffect(() => {
    void loadPresets(true);
  }, []);

  const current = items.find((p) => p.id === presetId) ?? null;
  // presetId trỏ tới preset đã bị xoá từ trình duyệt khác → coi như Tuỳ chỉnh (§7).
  const attached = current !== null;
  const modified = attached && !samePromptSet(prompts, presetPromptSet(current));

  /** 404 nghĩa là preset không còn trên DB: gỡ khỏi danh sách và về Tuỳ chỉnh, giữ working copy. */
  const handleGone = (e: unknown, id: string) => {
    if (e instanceof PresetError && e.status === 404) {
      forgetPreset(id);
      onDraft({ presetId: null });
      setNote("Preset không còn tồn tại — đã chuyển về Tuỳ chỉnh.");
      return true;
    }
    return false;
  };

  const select = async (id: string) => {
    if (id === (presetId ?? "")) return;
    if (modified) {
      const ok = await ask({
        title: "Bỏ thay đổi chưa lưu?",
        body: `Prompt đang khác preset «${current?.name}». Nạp preset khác sẽ mất phần sửa này.`,
        ok: "Bỏ thay đổi",
      });
      if (!ok) return;
    }
    setNote(null);
    if (!id) {
      // "— Tuỳ chỉnh —": gỡ preset nhưng giữ nguyên prompt đang dùng.
      onDraft({ presetId: null });
      return;
    }
    const next = items.find((p) => p.id === id);
    if (!next) return;
    onDraft({ presetId: next.id, prompts: presetPromptSet(next) });
  };

  const saveInto = async () => {
    if (!current) return;
    try {
      await updatePreset(current.id, prompts);
      // Ghi luôn vào settings: không để preset trên DB mới hơn thứ đang dùng (§3.2).
      onPersist(current.id);
      setNote(`Đã lưu preset «${current.name}».`);
    } catch (e) {
      if (handleGone(e, current.id)) return;
      setNote(`Lưu preset thất bại: ${(e as Error).message}`);
    }
  };

  const saveAsNew = () =>
    askName({
      title: "Lưu thành preset mới",
      ok: "Tạo preset",
      defaultValue: copyName(current?.name ?? null),
      submit: async (name) => {
        const created = await createPreset({ name, ...prompts });
        onDraft({ presetId: created.id });
        onPersist(created.id);
        setNote(`Đã tạo preset «${created.name}».`);
      },
    });

  const rename = () => {
    if (!current) return;
    askName({
      title: "Đổi tên preset",
      ok: "Đổi tên",
      defaultValue: current.name,
      submit: async (name) => {
        try {
          const updated = await updatePreset(current.id, { name });
          setNote(`Đã đổi tên thành «${updated.name}».`);
        } catch (e) {
          if (handleGone(e, current.id)) return;
          throw e;
        }
      },
    });
  };

  const remove = async () => {
    if (!current) return;
    const ok = await ask({
      title: `Xoá preset «${current.name}»?`,
      body: "Prompt đang dùng vẫn giữ nguyên, chỉ mất bộ prompt lưu trên DB.",
      ok: "Xoá preset",
    });
    if (!ok) return;
    try {
      await deletePreset(current.id);
    } catch (e) {
      if (!handleGone(e, current.id)) {
        setNote(`Xoá preset thất bại: ${(e as Error).message}`);
        return;
      }
    }
    onDraft({ presetId: null });
    onPersist(null);
    setNote("Đã xoá preset. Prompt hiện tại giữ nguyên.");
  };

  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm">
      {/* Dưới 1024px dropdown chiếm cả dòng, hai nút rơi xuống dòng dưới — chỉ bằng flex-wrap. */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Không có label chữ "Preset": drawer chỉ rộng 452px, thêm chữ là nút ⋯ rớt hàng. */}
        <select
          value={presetId ?? ""}
          disabled={loading || Boolean(error)}
          onChange={(e) => void select(e.target.value)}
          aria-label="Preset"
          title="Bộ prompt đang dùng"
          className="input h-9 w-full min-w-0 lg:h-8 lg:w-auto lg:min-h-0 lg:min-w-[124px] lg:flex-1"
        >
          <option value="">— Tuỳ chỉnh —</option>
          {items.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {modified && (
          <span title="Prompt đang khác preset" className="shrink-0 text-[11.5px] text-warn-fg">
            ● đã sửa
          </span>
        )}

        <button
          onClick={() => void saveInto()}
          disabled={!modified}
          className="btn btn-secondary h-9 shrink-0 py-0 text-[12.5px] lg:h-8"
        >
          Lưu preset
        </button>
        <Menu
          items={[
            { label: "Lưu thành preset mới…", onClick: saveAsNew },
            ...(attached
              ? [
                  { label: "Đổi tên…", onClick: rename },
                  { label: "Xoá preset…", onClick: () => void remove(), danger: true },
                ]
              : []),
          ]}
        />
      </div>

      {loading && <BarNote>Đang tải preset…</BarNote>}
      {error && (
        <BarNote>
          Không tải được preset ({error}).{" "}
          <button onClick={() => void loadPresets(true)} className="text-accent hover:underline">
            Thử lại
          </button>
          . Các ô prompt bên dưới vẫn dùng bình thường.
        </BarNote>
      )}
      {note && <BarNote>{note}</BarNote>}

      {confirmDialog}
      {nameDialog}
    </div>
  );
}

function BarNote({ children }: { children: React.ReactNode }) {
  return <p className="m-0 mt-2 text-[11.5px] leading-snug text-sand-600">{children}</p>;
}
