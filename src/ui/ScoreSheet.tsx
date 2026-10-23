import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { scorePage } from "../app/services";
import { codeLabel } from "../core/keymap";
import { useSettings, useT } from "../i18n/useT";
import { BAR_OVERHEAD, barGlyphs, keyHint, layoutJianpu, type Bar, type Glyph, type SheetSize } from "../score/jianpu-layout";
import { resolveScore } from "../score/library";
import type { KeyName, Pitch } from "../score/score";

/** "Db" → "♭D", "F#" → "♯F": jianpu writes the accidental first (1=♭E). */
function keyLabel(key: KeyName): string {
  if (key.length === 1) return key;
  return (key[1] === "b" ? "♭" : "♯") + key[0];
}

/** Small arrow: hold the octave-up (or down) key. Drawn, since UI fonts lack a crisp ↑ at this size. */
function ShiftArrow({ up }: { up: boolean }) {
  return (
    <svg className="j-shift" viewBox="0 0 8 10" aria-hidden="true">
      <path d={up ? "M4 1v8M1 4l3-3 3 3" : "M4 9V1M1 6l3 3 3-3"} />
    </svg>
  );
}

function HintLabel({ midi }: { midi: number }) {
  const hint = keyHint(midi);
  if (!hint) return <span className="j-hint">–</span>;
  return (
    <span className="j-hint">
      {Array.from({ length: Math.abs(hint.shift) }, (_, i) => (
        <ShiftArrow key={i} up={hint.shift > 0} />
      ))}
      {codeLabel(hint.code)}
    </span>
  );
}

function Dots({ count }: { count: number }) {
  return <>{Array.from({ length: count }, (_, i) => <i key={i} className="j-octave-dot" />)}</>;
}

function Accidental({ value }: { value: number }) {
  if (!value) return null;
  return <span className="j-acc">{value > 0 ? "♯" : "♭"}</span>;
}

function PitchDigits({ pitches }: { pitches: Pitch[] }) {
  // A chord stacks its notes, lowest at the bottom.
  if (pitches.length > 1) {
    return (
      <span className="j-chord">
        {[...pitches].reverse().map((p, i) => (
          <span key={i} className="j-chord-note">
            <Accidental value={p.accidental} />
            {p.degree}
            {p.octave !== 0 && <sup className="j-chord-oct">{p.octave > 0 ? "'".repeat(p.octave) : ",".repeat(-p.octave)}</sup>}
          </span>
        ))}
      </span>
    );
  }
  const p = pitches[0];
  return (
    <>
      <Accidental value={p.accidental} />
      {p.degree}
    </>
  );
}

function GlyphView({ glyph }: { glyph: Glyph }) {
  const single = glyph.type === "note" && glyph.pitches.length === 1 ? glyph.pitches[0] : null;
  const high = single && single.octave > 0 ? single.octave : 0;
  const low = single && single.octave < 0 ? -single.octave : 0;
  return (
    <span className={`j-glyph j-glyph--${glyph.type}`} data-event={glyph.event}>
      <span className="j-high">
        <Dots count={high} />
      </span>
      <span className="j-main">
        <span className="j-digit">
          {glyph.type === "dash" ? "–" : glyph.type === "rest" ? "0" : <PitchDigits pitches={glyph.pitches} />}
          {glyph.dotted && <span className="j-aug">·</span>}
        </span>
      </span>
      <span className="j-lines">
        {Array.from({ length: glyph.underlines }, (_, i) => (
          <i key={i} className="j-underline" />
        ))}
      </span>
      <span className="j-low">
        <Dots count={low} />
      </span>
      <span className="j-key">{glyph.type === "note" && glyph.midi.map((m, i) => <HintLabel key={i} midi={m} />)}</span>
    </span>
  );
}

function BarView({ bar, final }: { bar: Bar; final: boolean }) {
  // Bars share a line's width in proportion to their slots, so every note
  // gets about one key's width.
  return (
    <div className={`j-bar ${final ? "j-bar--final" : ""}`} style={{ flexGrow: barGlyphs(bar) + BAR_OVERHEAD }}>
      {bar.groups.map((group, i) => (
        <span key={i} className="j-beam">
          {group.map((g, k) => (
            <GlyphView key={k} glyph={g} />
          ))}
        </span>
      ))}
    </div>
  );
}

/**
 * The jianpu sheet standing on the glass: header, two lines of four bars,
 * and page buttons. Light bars keep glowing through it from behind.
 */
/** Rough line height in slots, used before a line has been measured. */
const LINE_SLOTS_GUESS = 1.9;

export function ScoreSheet({ whiteCount }: { whiteCount: number }) {
  const t = useT();
  const { scoreId, scoreKeyHints, language } = useSettings();
  const resolved = useMemo(() => resolveScore(scoreId, language), [scoreId, language]);
  const { score } = resolved;
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  // One slot (a note's width) is one white key; lines and pages follow from the sheet's size.
  const [slot, setSlot] = useState(0);
  const [size, setSize] = useState<SheetSize>({ slotsPerLine: 24, linesPerPage: 3 });

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const body = bodyRef.current;
    const pane = sheet?.parentElement;
    if (!sheet || !body || !pane) return;
    const measure = () => {
      const slotPx = pane.clientWidth / whiteCount;
      if (!slotPx) return;
      setSlot(slotPx);
      const line = body.querySelector<HTMLElement>(".j-line");
      const lineHeight = line
        ? line.offsetHeight + parseFloat(getComputedStyle(line).marginTop || "0")
        : slotPx * LINE_SLOTS_GUESS;
      const next = {
        slotsPerLine: Math.max(4, Math.floor(body.clientWidth / slotPx)),
        linesPerPage: Math.max(1, Math.floor((body.clientHeight + 1) / lineHeight)),
      };
      setSize((prev) =>
        prev.slotsPerLine === next.slotsPerLine && prev.linesPerPage === next.linesPerPage ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    observer.observe(body);
    return () => observer.disconnect();
  }, [whiteCount, scoreKeyHints, slot]);

  const layout = useMemo(() => layoutJianpu(score, size), [score, size]);
  const { page } = useSyncExternalStore(scorePage.subscribe, scorePage.get);
  const pageCount = layout.pages.length;
  const current = Math.min(page, pageCount - 1);

  // A new score starts on its first page; tell page keys how many pages there are.
  useEffect(() => scorePage.set({ page: 0, count: pageCount }), [resolved.id, pageCount]);

  const lastLine = layout.pages[pageCount - 1].length - 1;
  const lineSlots = (bars: Bar[]) => bars.reduce((n, b) => n + barGlyphs(b) + BAR_OVERHEAD, 0);
  // The widest line sets the note spacing for all of them.
  const widest = Math.max(1, ...layout.pages.flat().map((l) => lineSlots(l.bars)));

  return (
    <div
      ref={sheetRef}
      className="sheet"
      data-hints={scoreKeyHints || undefined}
      style={slot ? { ["--j-slot" as string]: `${slot}px` } : undefined}
    >
      <header className="sheet-head">
        <span className="sheet-title">{resolved.title}</span>
        <span className="sheet-meta">
          <span>1={keyLabel(score.key)}</span>
          <span className="sheet-time">
            <span>{score.time.split("/")[0]}</span>
            <span>{score.time.split("/")[1]}</span>
          </span>
          <span>♩={score.tempo}</span>
        </span>
        {pageCount > 1 && (
          <nav className="sheet-pages" aria-label={t("score.pages")}>
            <button
              className="sheet-page-btn"
              disabled={current === 0}
              aria-label={t("score.prevPage")}
              onClick={() => scorePage.set({ page: current - 1 })}
            >
              ‹
            </button>
            <span className="sheet-page-num">
              {current + 1} / {pageCount}
            </span>
            <button
              className="sheet-page-btn"
              disabled={current === pageCount - 1}
              aria-label={t("score.nextPage")}
              onClick={() => scorePage.set({ page: current + 1 })}
            >
              ›
            </button>
          </nav>
        )}
      </header>
      <div className="sheet-body" ref={bodyRef}>
        {layout.pages[current].map((line, li) => {
          const isLastLine = current === pageCount - 1 && li === lastLine;
          const used = lineSlots(line.bars);
          return (
            <div key={`${current}-${li}`} className="j-line">
              {line.bars.map((bar, bi) => (
                <BarView key={bi} bar={bar} final={isLastLine && bi === line.bars.length - 1} />
              ))}
              {/* A short last line keeps the same note spacing instead of stretching. */}
              {isLastLine && used < widest && <div className="j-spacer" style={{ flexGrow: widest - used }} />}
            </div>
          );
        })}
        {score.events.length === 0 && <p className="sheet-empty">{t("score.empty")}</p>}
      </div>
    </div>
  );
}

