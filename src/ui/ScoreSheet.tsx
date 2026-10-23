import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { scorePage } from "../app/services";
import { useSettings, useT } from "../i18n/useT";
import { layoutJianpu, type SheetSize } from "../score/jianpu-layout";
import { resolveScore, userScores } from "../score/library";
import { JianpuLines, lineSlots, ScoreMeta } from "./JianpuView";

/** Rough line height in slots, used before a line has been measured. */
const LINE_SLOTS_GUESS = 1.9;

/**
 * How many slots fit on a line and lines on a page of `body`, given the
 * slot width in pixels. Re-measures when the body resizes.
 */
export function useSheetSize(body: RefObject<HTMLElement | null>, slot: number, deps: unknown[]): SheetSize {
  const [size, setSize] = useState<SheetSize>({ slotsPerLine: 24, linesPerPage: 3 });
  useLayoutEffect(() => {
    const el = body.current;
    if (!el || !slot) return;
    const measure = () => {
      const line = el.querySelector<HTMLElement>(".j-line");
      const lineHeight = line
        ? line.offsetHeight + parseFloat(getComputedStyle(line).marginTop || "0")
        : slot * LINE_SLOTS_GUESS;
      const next = {
        slotsPerLine: Math.max(4, Math.floor(el.clientWidth / slot)),
        linesPerPage: Math.max(1, Math.floor((el.clientHeight + 1) / lineHeight)),
      };
      setSize((prev) =>
        prev.slotsPerLine === next.slotsPerLine && prev.linesPerPage === next.linesPerPage ? prev : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [body, slot, ...deps]);
  return size;
}

/** The current score, re-read when the user's library changes. */
export function useCurrentScore() {
  const { scoreId, language } = useSettings();
  const library = useSyncExternalStore(userScores.subscribe, userScores.get);
  return useMemo(() => resolveScore(scoreId, language), [scoreId, language, library]);
}

/**
 * The jianpu sheet standing on the glass: header, as many lines as fit, and
 * page buttons. Light bars keep glowing through it from behind.
 */
export function ScoreSheet({ whiteCount }: { whiteCount: number }) {
  const t = useT();
  const { scoreKeyHints } = useSettings();
  const resolved = useCurrentScore();
  const { score } = resolved;
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // One slot (a note's width) is one white key.
  const [slot, setSlot] = useState(0);
  useLayoutEffect(() => {
    const pane = sheetRef.current?.parentElement;
    if (!pane) return;
    const measure = () => setSlot(pane.clientWidth / whiteCount);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [whiteCount]);
  const size = useSheetSize(bodyRef, slot, [scoreKeyHints]);

  const layout = useMemo(() => layoutJianpu(score, size), [score, size]);
  const { page } = useSyncExternalStore(scorePage.subscribe, scorePage.get);
  const pageCount = layout.pages.length;
  const current = Math.min(page, pageCount - 1);

  // A new score starts on its first page; tell page keys how many pages there are.
  useEffect(() => scorePage.set({ page: 0, count: pageCount }), [resolved.id, pageCount]);

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
        <ScoreMeta score={score} />
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
        <JianpuLines key={current} lines={layout.pages[current]} endsScore={current === pageCount - 1} widest={widest} />
        {score.events.length === 0 && <p className="sheet-empty">{t("score.empty")}</p>}
      </div>
    </div>
  );
}
