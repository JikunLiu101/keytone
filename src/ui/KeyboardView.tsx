import { memo, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { RANGE_HIGH, RANGE_LOW } from "../core/notes";
import { buildLayout, computerKeyLabels } from "../view/layout";
import { clampScroll, defaultScroll } from "../view/viewport";
import { engine, hub, keyboard, keyboardWindow, pointers } from "../app/services";
import { findInstrument } from "../audio/instruments";
import { GlassEffects, useLcdClear } from "./GlassEffects";
import { ScoreSheet } from "./ScoreSheet";
import { FallingNotes } from "./FallingNotes";
import { useSettings, useT } from "../i18n/useT";

export const layout = buildLayout(RANGE_LOW, RANGE_HIGH);

type KeyGeometry = (typeof layout.keys)[number];

/**
 * One key. Memoised so a note on/off re-renders only the key that changed,
 * not all 65.
 */
const Key = memo(function Key({ geometry, label, down }: { geometry: KeyGeometry; label?: string; down: boolean }) {
  const classes = [
    "key",
    geometry.black ? "key--black" : "key--white",
    label ? "key--playable" : "",
    down ? "key--down" : "",
  ].join(" ");
  return (
    <div
      className={classes}
      data-midi={geometry.midi}
      style={{ ["--x" as string]: geometry.x, ["--w" as string]: geometry.width }}
    >
      <span className="key-label">
        {label && <span className="key-label__computer">{label}</span>}
        {!geometry.black && <span className="key-label__note">{geometry.name}</span>}
      </span>
    </div>
  );
});

/** Find the key under a screen point. Hit-testing respects the 3D transform. */
function midiAt(x: number, y: number): number | null {
  const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-midi]");
  return el ? Number(el.dataset.midi) : null;
}

export function KeyboardView() {
  const sounding = useSyncExternalStore(hub.subscribe, hub.getSounding);
  const shift = useSyncExternalStore(keyboard.subscribe, keyboard.getOctaveShift);
  const labels = useMemo(() => computerKeyLabels(shift), [shift]);
  const sustain = useSyncExternalStore(hub.subscribe, hub.getSustain);
  const status = useSyncExternalStore(engine.subscribe, engine.getStatus);
  const instrument = status.currentId ? findInstrument(status.currentId) : undefined;
  const t = useT();
  const { scoreView } = useSettings();
  const win = useSyncExternalStore(keyboardWindow.subscribe, keyboardWindow.get);
  const stageRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);
  // Screen-fixed layer over the stage: on phones the keyboard (and its glass)
  // slides sideways, so the sheet and play controls live here instead.
  const [overlay, setOverlay] = useState<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => setHost(stageRef.current?.parentElement ?? null), []);

  // Place the overlay exactly over the lit part of the glass as it appears on
  // screen (the glass is tilted in 3D, so this is measured, not computed).
  useLayoutEffect(() => {
    const host = overlay?.parentElement;
    const pane = glassRef.current?.querySelector<HTMLElement>(".glass-pane");
    if (!win.compact || !overlay || !host || !pane) return;
    const place = () => {
      const s = host.getBoundingClientRect();
      const p = pane.getBoundingClientRect();
      overlay.style.top = `${Math.round(p.top - s.top)}px`;
      overlay.style.height = `${Math.round(p.height)}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(host);
    observer.observe(pane);
    window.addEventListener("resize", place);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      overlay.style.top = "";
      overlay.style.height = "";
    };
  }, [win.compact, win.stageHeight, overlay]);
  useLcdClear(glassRef);

  // Compact mode: work out how many white keys fit, and keep the window valid.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const keys = keysRef.current;
    if (!win.compact || !stage || !keys) return;
    const measure = () => {
      const keyWidth = keys.offsetWidth / layout.whiteCount;
      if (!keyWidth) return;
      const visible = Math.min(layout.whiteCount, (stage.clientWidth - 24) / keyWidth);
      const current = keyboardWindow.get();
      const scroll = current.ready
        ? clampScroll(current.scroll, visible, layout.whiteCount)
        : defaultScroll(visible, layout.whiteCount);
      // Only a window narrower than the keyboard is a real measurement.
      keyboardWindow.set({ visible, scroll, ready: visible < layout.whiteCount });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(keys);
    return () => observer.disconnect();
  }, [win.compact, win.stageHeight]);
  // One handler set for mouse, touch and pen. Each finger is tracked by its
  // pointerId, so chords and multi-finger slides work.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault(); // no text selection, no emulated mouse events
    engine.unlock();
    try {
      // Keep receiving this pointer's moves even when it leaves the keys.
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Capture can fail for a pointer that has already gone; tracking still works.
    }
    pointers.down(e.pointerId, midiAt(e.clientX, e.clientY));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.isTracking(e.pointerId)) return;
    pointers.move(e.pointerId, midiAt(e.clientX, e.clientY));
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => pointers.up(e.pointerId);

  return (
    <div className="stage" ref={stageRef}>
      <div
        className="keyboard-body"
        style={{
          ["--white-count" as string]: layout.whiteCount,
          ["--kb-scroll" as string]: win.compact ? win.scroll : 0,
        }}
      >
        <div className="keyboard-top" aria-hidden="true">
          <div className="grille" />
          <div className="lcd">
            <span className="lcd-main">{instrument ? t(instrument.nameKey) : "—"}</span>
            <span className="lcd-sub">
              {status.loadingId
                ? t("status.loading")
                : !status.audioRunning
                  ? t("audio.tapToStart")
                  : `${t("lcd.octave")} ${shift > 0 ? `+${shift}` : shift}`}
              {sustain ? ` · ${t("lcd.sustain")}` : ""}
            </span>
          </div>
          <span className="logo">KEYTONE</span>
          <div className="grille" />
        </div>
        <div className="keyboard-felt" aria-hidden="true" />
        <div
          ref={keysRef}
          className="keys"
          role="group"
          aria-label={t("keys.label")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
          {layout.keys.map((key) => (
            <Key key={key.midi} geometry={key} label={labels.get(key.midi)} down={sounding.has(key.midi)} />
          ))}
        </div>
        {/* Frosted glass panel standing behind the keys; light bars rise inside it,
            and it doubles as the music stand for the jianpu sheet. */}
        <div className="glass" ref={glassRef} data-score={scoreView !== "off" ? scoreView : undefined}>
          <div className="glass-pane">
            {scoreView === "falling" ? (
              <FallingNotes layout={layout} overlay={win.compact ? overlay : null} />
            ) : (
              <GlassEffects layout={layout} />
            )}
            <div className="glass-frost" aria-hidden="true" />
            {scoreView === "jianpu" && !win.compact && <ScoreSheet />}
          </div>
        </div>
        <div className="glass-rail" aria-hidden="true" />
      </div>
      {/* The overlay sits in the stage's parent: the stage clips sideways, and
          Chrome would drop taps on anything poking out of a clipped box. */}
      {host &&
        createPortal(
          <div className="stage-overlay" ref={setOverlay}>
            {scoreView === "jianpu" && win.compact && <ScoreSheet compact />}
          </div>,
          host,
        )}
    </div>
  );
}
