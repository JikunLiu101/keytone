import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { hub, scorePage } from "../app/services";
import { useSettings, useT } from "../i18n/useT";
import { fitBeats, layoutLines, layoutPages, pageOfEvent, sameSheetBox, sheetMetrics, type SheetBox } from "../score/jianpu-layout";
import { PRACTICE_START, isComplete, phraseStarts, practicePress, practiceSteps, practiceTarget } from "../score/practice";
import { onScoreCommand } from "../app/commands";
import { resolveScore, userScores } from "../score/library";
import { buildLyrics } from "../score/lyrics";
import { barBeats } from "../score/score";
import { JianpuLines, ScoreMeta } from "./JianpuView";

/** Phones: a beat is at least this wide, so digits stay readable. */
const MIN_PHONE_BEAT = 34;

/**
 * Measures `body`: its content width, and how many of its lines fit in its
 * height (from a drawn line). Re-measures when the body resizes or `deps`
 * change (anything that changes a line's height).
 */
export function useMeasureSheet(body: RefObject<HTMLElement | null>, onBox: (box: SheetBox) => void, deps: unknown[]): void {
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const width = el.clientWidth - parseFloat(style.paddingLeft || "0") - parseFloat(style.paddingRight || "0");
      const line = el.querySelector<HTMLElement>(".j-line");
      const lineHeight = line ? line.offsetHeight + parseFloat(getComputedStyle(line).marginTop || "0") : 0;
      onBox({ width, linesPerPage: lineHeight ? Math.max(1, Math.floor((el.clientHeight + 1) / lineHeight)) : 1 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [body, ...deps]);
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
export function ScoreSheet({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const { scoreKeyHints, scoreLyrics, practice, beatsPerLine } = useSettings();
  const resolved = useCurrentScore();
  const { score } = resolved;
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Phones: no computer keyboard, so no key hints; one line at a time.
  const hints = scoreKeyHints && !compact;
  const [hidden, setHidden] = useState(false);
  const [box, setBox] = useState<SheetBox>({ width: 0, linesPerPage: 1 });
  // Every beat has the same width: the line's width over N beats (spec §11.2),
  // fewer when the sheet is too narrow for N with readable digits.
  const wanted = compact ? Math.max(4, Math.min(beatsPerLine, Math.floor(box.width / MIN_PHONE_BEAT))) : beatsPerLine;
  const beats = fitBeats(Math.max(0, box.width - 2), wanted, barBeats(score.time));
  // A couple of px spare so rounding never pushes the last bar line out of view.
  const metrics = useMemo(() => {
    const m = sheetMetrics(Math.max(0, box.width - 2), beats, barBeats(score.time));
    // Phones keep the one-row sheet short enough for the glass.
    return compact ? { ...m, font: Math.min(17, m.font) } : m;
  }, [box.width, beats, score.time, compact]);
  const lyrics = useMemo(() => (scoreLyrics ? buildLyrics(score) : null), [score, scoreLyrics]);
  useMeasureSheet(bodyRef, (next) => setBox((prev) => sameSheetBox(prev, next)), [hints, hidden, metrics.font, !!lyrics]);

  const lines = useMemo(() => layoutLines(score, beats), [score, beats]);
  const pages = useMemo(() => layoutPages(lines, compact ? 1 : box.linesPerPage), [lines, compact, box.linesPerPage]);
  const { page } = useSyncExternalStore(scorePage.subscribe, scorePage.get);
  const pageCount = pages.length;
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
  // Shortcuts: Backspace (phrase back), held Backspace (restart), ← / → (one
  // note), and Enter to play again once complete.
  const starts = useMemo(() => phraseStarts(score, steps), [score, steps]);
  useEffect(() => {
    if (!practice) return;
    return onScoreCommand((command) => {
      const p = progressRef.current;
      const to = practiceTarget(command, p.step, starts, isComplete(steps, p));
      if (to === null) return;
      setProgress({ ...p, step: Math.max(0, Math.min(steps.length, to)), pressed: [] });
      setMiss(false);
    });
  }, [practice, steps, starts]);

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
    const target = pageOfEvent(pages, currentEvent);
    if (target !== scorePage.get().page) scorePage.set({ page: target });
  }, [currentEvent, pages]);

  return (
    <div
      ref={sheetRef}
      className={`sheet ${compact ? "sheet--compact" : ""} ${hidden ? "sheet--hidden" : ""}`}
      data-hints={hints || undefined}
      style={{ ["--j-size" as string]: `${metrics.font}px` }}
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
          <button
            className="sheet-restart"
            onClick={restart}
            title={`${t("score.restart")} (${t("sc.holdBackspace")})`}
            aria-label={t("score.restart")}
          >
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
          lines={pages[current]}
          metrics={metrics}
          lyrics={lyrics}
          endsScore={current === pageCount - 1}
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
