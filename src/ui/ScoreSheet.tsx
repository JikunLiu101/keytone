import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { hub, scorePage } from "../app/services";
import { useSettings, useT } from "../i18n/useT";
import { layoutJianpu, pageOfEvent, type SheetSize } from "../score/jianpu-layout";
import { PRACTICE_START, isComplete, practicePress, practiceSteps } from "../score/practice";
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
export function ScoreSheet({ whiteCount, compact = false }: { whiteCount: number; compact?: boolean }) {
  const t = useT();
  const { scoreKeyHints, practice } = useSettings();
  const resolved = useCurrentScore();
  const { score } = resolved;
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // One slot (a note's width) is one white key, measured from the keys themselves.
  const [slot, setSlot] = useState(0);
  useLayoutEffect(() => {
    const keys = document.querySelector<HTMLElement>(".keys");
    if (!keys) return;
    // Phone keys are wide; a narrower slot fits a few bars per row there.
    const measure = () => setSlot((keys.offsetWidth / whiteCount) * (compact ? 0.62 : 1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(keys);
    return () => observer.disconnect();
  }, [whiteCount, compact]);
  // Phones: no computer keyboard, so no key hints; one line at a time.
  const hints = scoreKeyHints && !compact;
  const [hidden, setHidden] = useState(false);
  const measured = useSheetSize(bodyRef, slot, [hints, hidden]);
  const size = useMemo(
    () => (compact ? { slotsPerLine: measured.slotsPerLine, linesPerPage: 1 } : measured),
    [compact, measured],
  );

  const layout = useMemo(() => layoutJianpu(score, size), [score, size]);
  const { page } = useSyncExternalStore(scorePage.subscribe, scorePage.get);
  const pageCount = layout.pages.length;
  const current = Math.min(page, pageCount - 1);

  // A new score starts on its first page; tell page keys how many pages there are.
  useEffect(() => scorePage.set({ page: 0, count: pageCount }), [resolved.id, pageCount]);

  // ---- Practice mode ----
  const steps = useMemo(() => practiceSteps(score), [score]);
  const [progress, setProgressState] = useState(PRACTICE_START);
  // Key events read the latest progress here, so quick notes are never lost.
  const progressRef = useRef(progress);
  const setProgress = (next: typeof progress) => {
    progressRef.current = next;
    setProgressState(next);
  };
  const [miss, setMiss] = useState(false);
  const complete = practice && isComplete(steps, progress);
  const restart = () => {
    setProgress(PRACTICE_START);
    setMiss(false);
  };
  // A new or edited score, or switching practice on, starts from the top.
  useEffect(restart, [steps, practice]);
  useEffect(() => {
    if (!practice) return;
    return hub.onKey((e) => {
      if (e.type !== "down") return;
      const p = progressRef.current;
      const next = practicePress(steps, p, e.midi);
      if (next === p) return;
      setProgress(next);
      setMiss(next.misses !== p.misses);
    });
  }, [practice, steps]);
  // A wrong note flashes the current note briefly.
  useEffect(() => {
    if (!miss) return;
    const id = window.setTimeout(() => setMiss(false), 320);
    return () => window.clearTimeout(id);
  }, [miss, progress.misses]);
  const currentEvent = practice ? (complete ? -1 : (steps[progress.step]?.event ?? -1)) : undefined;
  // Turn the page as soon as the next note is on it.
  useEffect(() => {
    if (currentEvent === undefined || currentEvent < 0) return;
    const target = pageOfEvent(layout, currentEvent);
    if (target !== scorePage.get().page) scorePage.set({ page: target });
  }, [currentEvent, layout]);

  // The widest line sets the note spacing for all of them.
  const widest = Math.max(1, ...layout.pages.flat().map((l) => lineSlots(l.bars)));

  return (
    <div
      ref={sheetRef}
      className={`sheet ${compact ? "sheet--compact" : ""} ${hidden ? "sheet--hidden" : ""}`}
      data-hints={hints || undefined}
      style={slot ? { ["--j-slot" as string]: `${slot}px` } : undefined}
    >
      {compact && (
        <button
          className="sheet-toggle"
          onClick={() => setHidden(!hidden)}
          aria-expanded={!hidden}
          aria-label={hidden ? t("score.show") : t("score.hide")}
          title={hidden ? t("score.show") : t("score.hide")}
        >
          {hidden ? t("score.show") : "×"}
        </button>
      )}
      <header className="sheet-head">
        <span className="sheet-title">{resolved.title}</span>
        <ScoreMeta score={score} />
        {practice && (
          <button className="sheet-restart" onClick={restart} title={t("score.restart")} aria-label={t("score.restart")}>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" />
            </svg>
          </button>
        )}
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
        <JianpuLines
          key={current}
          lines={layout.pages[current]}
          endsScore={current === pageCount - 1}
          widest={widest}
          current={currentEvent}
          miss={miss}
        />
        {score.events.length === 0 && <p className="sheet-empty">{t("score.empty")}</p>}
      </div>
      {complete && steps.length > 0 && (
        <div className="sheet-complete" role="status">
          <span className="sheet-complete-title">{t("score.complete")}</span>
          <button className="button" onClick={restart}>
            {t("score.again")}
          </button>
        </div>
      )}
    </div>
  );
}
