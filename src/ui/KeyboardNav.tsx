import { useRef, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from "react";
import { hub, keyboardWindow } from "../app/services";
import { useT } from "../i18n/useT";
import type { KeyboardLayout } from "../view/layout";
import { clampScroll, scrollForPointer } from "../view/viewport";

/**
 * Compact-mode navigator: a thumbnail of the whole keyboard with a frame
 * showing the visible part. Drag or tap it to move the frame; sounding notes
 * light up so you can see where you are playing.
 */
export function KeyboardNav({ layout }: { layout: KeyboardLayout }) {
  const t = useT();
  const win = useSyncExternalStore(keyboardWindow.subscribe, keyboardWindow.get);
  const sounding = useSyncExternalStore(hub.subscribe, hub.getSounding);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const total = layout.whiteCount;

  const moveTo = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    keyboardWindow.set({ scroll: scrollForPointer((clientX - box.left) / box.width, win.visible, total), manual: true });
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragging.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Tracking still works without capture.
    }
    moveTo(e.clientX);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current === e.pointerId) moveTo(e.clientX);
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current === e.pointerId) dragging.current = null;
  };
  // Arrow keys move by one key, Page Up/Down by an octave.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    keyboardWindow.set({ scroll: clampScroll(Math.round(win.scroll) + step, win.visible, total), manual: true });
  };

  const first = layout.keys.find((k) => !k.black && k.x >= Math.round(win.scroll));
  return (
    <div
      ref={ref}
      className="kb-nav"
      role="slider"
      tabIndex={0}
      aria-label={t("nav.label")}
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(total - win.visible))}
      aria-valuenow={Math.round(win.scroll)}
      aria-valuetext={first?.name}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onKeyDown={onKeyDown}
    >
      {layout.keys.map((key) => (
        <span
          key={key.midi}
          className={`kb-nav-key ${key.black ? "kb-nav-key--black" : ""} ${sounding.has(key.midi) ? "kb-nav-key--on" : ""}`}
          style={{ left: `${(key.x / total) * 100}%`, width: `${(key.width / total) * 100}%` }}
        />
      ))}
      <span
        className="kb-nav-frame"
        style={{ left: `${(win.scroll / total) * 100}%`, width: `${(Math.min(win.visible, total) / total) * 100}%` }}
      />
    </div>
  );
}
