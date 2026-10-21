import { useMemo, useRef, useSyncExternalStore, type PointerEvent } from "react";
import { RANGE_HIGH, RANGE_LOW } from "../core/notes";
import { buildLayout, computerKeyLabels } from "../view/layout";
import { engine, hub, keyboard, settings } from "../app/services";
import { findInstrument } from "../audio/instruments";
import { useT } from "../i18n/useT";
import { GlassEffects } from "./GlassEffects";

const layout = buildLayout(RANGE_LOW, RANGE_HIGH);

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
  /** pointerId → note currently held by that pointer. */
  const pointers = useRef(new Map<number, number | null>());

  const moveTo = (pointerId: number, midi: number | null) => {
    const source = `pointer:${pointerId}`;
    const previous = pointers.current.get(pointerId) ?? null;
    if (previous === midi) return;
    if (previous !== null) hub.release(source, previous);
    if (midi !== null) hub.press(source, midi, settings.get().velocity);
    pointers.current.set(pointerId, midi);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    engine.unlock();
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(e.pointerId, midiAt(e.clientX, e.clientY));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    moveTo(e.pointerId, midiAt(e.clientX, e.clientY));
  };
  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    moveTo(e.pointerId, null);
    pointers.current.delete(e.pointerId);
  };

  return (
    <div className="stage">
      <div className="keyboard-body" style={{ ["--white-count" as string]: layout.whiteCount }}>
        <div className="keyboard-top" aria-hidden="true">
          <div className="grille" />
          <div className="lcd">
            <span className="lcd-main">{instrument ? t(instrument.nameKey) : "—"}</span>
            <span className="lcd-sub">
              {status.loadingId ? t("status.loading") : `${t("lcd.octave")} ${shift > 0 ? `+${shift}` : shift}`}
              {sustain ? ` · ${t("lcd.sustain")}` : ""}
            </span>
          </div>
          <span className="logo">KEYTONE</span>
          <div className="grille" />
        </div>
        <div className="keyboard-felt" aria-hidden="true" />
        <div
          className="keys"
          role="group"
          aria-label={t("keys.label")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onLostPointerCapture={onPointerEnd}
        >
          {layout.keys.map((key) => {
            const label = labels.get(key.midi);
            const classes = [
              "key",
              key.black ? "key--black" : "key--white",
              label ? "key--playable" : "",
              sounding.has(key.midi) ? "key--down" : "",
            ].join(" ");
            return (
              <div
                key={key.midi}
                className={classes}
                data-midi={key.midi}
                style={{ ["--x" as string]: key.x, ["--w" as string]: key.width }}
              >
                <span className="key-label">
                  {label && <span className="key-label__computer">{label}</span>}
                  {!key.black && <span className="key-label__note">{key.name}</span>}
                </span>
              </div>
            );
          })}
        </div>
        {/* Frosted glass panel standing behind the keys; light bars rise inside it. */}
        <div className="glass" aria-hidden="true">
          <div className="glass-pane">
            <GlassEffects layout={layout} />
            <div className="glass-frost" />
          </div>
        </div>
        <div className="glass-rail" aria-hidden="true" />
      </div>
    </div>
  );
}
