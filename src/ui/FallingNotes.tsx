import { useEffect, useRef, useState } from "react";
import { hub } from "../app/services";
import { useSettings, useT } from "../i18n/useT";
import { FallingSession, type FallStatus } from "../score/falling";
import type { AnchorSet } from "../view/effects-renderer";
import { FallingRenderer } from "../view/falling-renderer";
import type { KeyboardLayout } from "../view/layout";
import { ScoreMeta } from "./JianpuView";
import { useCurrentScore } from "./ScoreSheet";

const SPEEDS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
/** How long the summary stays up before a loop starts again. */
const LOOP_PAUSE_MS = 1600;

interface View {
  status: FallStatus;
  countBeat: number;
  perfect: number;
  missing: number;
}

function snapshot(s: FallingSession | null): View {
  return s
    ? { status: s.status, countBeat: s.countBeat, perfect: s.perfect, missing: s.missing }
    : { status: "ready", countBeat: 0, perfect: 0, missing: 0 };
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M5.5 3.5v9M10.5 3.5v9" />
    </svg>
  );
}

function RestartIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" />
    </svg>
  );
}

function LoopIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 7V6a2 2 0 0 1 2-2h7.5M10.5 2l2 2-2 2M13 9v1a2 2 0 0 1-2 2H3.5M5.5 14l-2-2 2-2" />
    </svg>
  );
}

/**
 * Falling-notes view on the glass: inverted light bars drop onto their keys.
 * Replaces the rising bars while it is shown. Transport sits at the top of
 * the glass; count-in and the end-of-song card sit in the middle.
 */
export function FallingNotes({ layout }: { layout: KeyboardLayout }) {
  const t = useT();
  const { practice, lightPalette } = useSettings();
  const resolved = useCurrentScore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<FallingSession | null>(null);
  const rendererRef = useRef<FallingRenderer | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [view, setView] = useState<View>(snapshot(null));
  const viewRef = useRef(view);

  // A new or edited score, or toggling practice, starts a fresh session.
  useEffect(() => {
    sessionRef.current = new FallingSession(resolved.score, practice, speed);
    // Development only: lets tests drive and inspect the session.
    if (import.meta.env.DEV) Object.assign(window, { __keytoneFalling: sessionRef.current });
    rendererRef.current?.redraw();
    const next = snapshot(sessionRef.current);
    viewRef.current = next;
    setView(next);
    // Speed changes are applied to the running session below, not by restarting.
  }, [resolved.score, practice]);

  useEffect(() => {
    if (sessionRef.current) sessionRef.current.speed = speed;
    rendererRef.current?.redraw();
  }, [speed]);

  // Renderer: runs the session's clock and draws every frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const geometry = (): AnchorSet => {
      const whiteW = canvas.clientWidth / layout.whiteCount;
      const keys = new Map<number, { x: number; width: number }>();
      for (const key of layout.keys) {
        keys.set(key.midi, { x: (key.x + key.width / 2) * whiteW, width: key.width * whiteW });
      }
      return { originY: canvas.clientHeight, keys };
    };
    const renderer = new FallingRenderer(canvas, geometry, () => sessionRef.current, () => {
      // Re-render the overlay only when something it shows has changed.
      const next = snapshot(sessionRef.current);
      const prev = viewRef.current;
      if (
        next.status !== prev.status ||
        next.countBeat !== prev.countBeat ||
        next.perfect !== prev.perfect ||
        next.missing !== prev.missing
      ) {
        viewRef.current = next;
        setView(next);
      }
    });
    rendererRef.current = renderer;
    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio || 1, 1.5));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [layout]);

  useEffect(() => rendererRef.current?.setPalette(lightPalette), [lightPalette]);

  // Key presses are judged against the falling notes.
  useEffect(
    () =>
      hub.onKey((e) => {
        if (e.type !== "down") return;
        const result = sessionRef.current?.press(e.midi);
        if (result?.kind === "hit") rendererRef.current?.burst(e.midi);
        else if (result?.kind === "wrong") rendererRef.current?.wrong(e.midi);
      }),
    [],
  );

  // Loop: after the summary has been up for a moment, go again.
  useEffect(() => {
    if (view.status !== "done" || !loop) return;
    const id = window.setTimeout(() => sessionRef.current?.start(), LOOP_PAUSE_MS);
    return () => window.clearTimeout(id);
  }, [view.status, loop]);

  const session = sessionRef.current;
  const running = view.status === "countIn" || view.status === "playing";
  const togglePlay = () => {
    if (!session) return;
    if (running) session.pause();
    else session.start();
    rendererRef.current?.redraw();
  };
  const restart = () => {
    session?.reset();
    session?.start();
    rendererRef.current?.redraw();
  };
  const empty = !session || session.notes.length === 0;

  return (
    <>
      <canvas ref={canvasRef} className="glass-canvas" aria-hidden="true" />
      <div className="fall-bar">
        <span className="fall-title">{resolved.title}</span>
        <ScoreMeta score={resolved.score} />
        <div className="fall-controls">
          <button
            className="fall-btn fall-btn--play"
            onClick={togglePlay}
            disabled={empty}
            aria-label={running ? t("fall.pause") : t("fall.play")}
            title={running ? t("fall.pause") : t("fall.play")}
          >
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="fall-btn" onClick={restart} disabled={empty} aria-label={t("score.restart")} title={t("score.restart")}>
            <RestartIcon />
          </button>
          <label className="fall-speed" title={t("fall.speed")}>
            <span className="visually-hidden">{t("fall.speed")}</span>
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)}%
                </option>
              ))}
            </select>
          </label>
          <button
            className={`fall-btn ${loop ? "fall-btn--on" : ""}`}
            role="switch"
            aria-checked={loop}
            onClick={() => setLoop(!loop)}
            aria-label={t("fall.loop")}
            title={t("fall.loop")}
          >
            <LoopIcon />
          </button>
        </div>
      </div>

      {view.status === "ready" && !empty && (
        <button className="fall-center fall-start" onClick={togglePlay}>
          <PlayIcon />
          <span>{t("fall.start")}</span>
        </button>
      )}
      {empty && <p className="fall-center fall-hint">{t("score.empty")}</p>}
      {view.status === "countIn" && (
        <span key={view.countBeat} className="fall-center fall-count" aria-live="polite">
          {view.countBeat}
        </span>
      )}
      {view.status === "paused" && <p className="fall-center fall-hint">{t("fall.paused")}</p>}
      {view.status === "done" && (
        <div className="fall-center fall-done" role="status">
          <span className="fall-done-title">{t("score.complete")}</span>
          {!practice && (
            <span className="fall-score">
              {t("fall.perfect")}: {view.perfect}, {t("fall.missing")}: {view.missing}
            </span>
          )}
          {!loop && (
            <button className="button" onClick={restart}>
              {t("score.again")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
