import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { engine, hub, settings } from "../app/services";
import { OCTAVE_ACTION_SHIFT, actionForCode, codeLabel } from "../core/keymap";
import { MAX_OCTAVE_SHIFT } from "../core/notes";
import { isTyping } from "../input/keyboard-input";
import { useSettings, useT } from "../i18n/useT";
import { DEFAULT_SCORE_ID } from "../score/builtin-scores";
import { edit, editorActionForCode, type EditorAction, type EditorState } from "../score/editor";
import { layoutJianpu } from "../score/jianpu-layout";
import {
  addScore,
  duplicateScore,
  listScores,
  removeScore,
  uniqueTitle,
  untitled,
  updateScoreData,
} from "../score/library";
import {
  KEY_NAMES,
  TEMPO_MAX,
  TEMPO_MIN,
  TIME_SIGNATURES,
  barBeats,
  emptyScore,
  parseScore,
  serializeScore,
  type KeyName,
  type Score,
  type TimeSignature,
} from "../score/score";
import { CloseIcon } from "./icons";
import { JianpuLines, keyLabel, lineSlots } from "./JianpuView";
import { useCurrentScore, useSheetSize } from "./ScoreSheet";

/** How long an auditioned note sounds. */
const AUDITION_MS = 320;

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File names can't hold some characters; keep the rest of the title. */
function safeFilename(title: string): string {
  return (title.replace(/[\\/:*?"<>|]+/g, " ").trim() || "score") + ".txt";
}

/**
 * Full-width score editor over the glass and control panel. The keys stay
 * visible below it (and playable with the mouse), but typing goes to the
 * score: digits enter notes, held octave keys add octave dots.
 */
export function ScoreEditor({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { language, bindings, scoreKeyHints } = useSettings();
  const resolved = useCurrentScore();
  const readOnly = resolved.builtin;
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [state, setStateRaw] = useState<EditorState>({ score: resolved.score, cursor: resolved.score.events.length });
  // Edits read the latest state from here, so fast typing and key repeat
  // never work from a copy React hasn't re-rendered yet.
  const stateRef = useRef(state);
  const setState = (next: EditorState) => {
    stateRef.current = next;
    setStateRaw(next);
  };
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const held = useRef(new Set<string>());
  const fileRef = useRef<HTMLInputElement>(null);

  // Switching to another score loads it.
  useEffect(() => {
    setState({ score: resolved.score, cursor: resolved.score.events.length });
    setDraft(null);
    // Only when the score itself changes, not on our own saves.
  }, [resolved.id]);

  // Fit the editor between the top of the window and the top of the keys.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const keys = document.querySelector<HTMLElement>(".keys");
    if (!root || !keys) return;
    const fit = () => root.style.setProperty("--editor-bottom", `${Math.max(0, innerHeight - keys.getBoundingClientRect().top + 8)}px`);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => rootRef.current?.focus(), []);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((m) => (m === text ? null : m)), 2400);
  };

  const commit = (next: EditorState) => {
    setState(next);
    if (!readOnly) updateScoreData(resolved.id, next.score);
  };

  const apply = (action: EditorAction) => {
    if (readOnly) return;
    const current = stateRef.current;
    const result = edit(current, action);
    if (result.rejected) flash(t("editor.outOfRange"));
    if (result.state !== current) commit(result.state);
    if (result.audition) {
      engine.unlock();
      for (const midi of result.audition) hub.press("editor", midi, settings.get().velocity);
      window.setTimeout(() => result.audition?.forEach((m) => hub.release("editor", m)), AUDITION_MS);
    }
  };

  const applyRef = useRef(apply);
  applyRef.current = apply;

  // Typing: digits and symbols edit the score; octave keys are held for dots.
  useEffect(() => {
    const octave = () => {
      let shift = 0;
      for (const code of held.current) {
        const action = actionForCode(settings.get().bindings, code);
        if (action && action !== "sustain") shift += OCTAVE_ACTION_SHIFT[action];
      }
      return Math.max(-MAX_OCTAVE_SHIFT, Math.min(MAX_OCTAVE_SHIFT, shift));
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (isTyping(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
      const bound = actionForCode(settings.get().bindings, e.code);
      if (bound && bound !== "sustain") {
        held.current.add(e.code);
        e.preventDefault();
        return;
      }
      const action = editorActionForCode(e.code, octave());
      if (!action) return;
      e.preventDefault();
      applyRef.current(action);
    };
    const onUp = (e: KeyboardEvent) => held.current.delete(e.code);
    const onBlur = () => held.current.clear();
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [onClose]);

  // Layout: all lines, scrolling; a slot is sized to the editor's width.
  const [slot, setSlot] = useState(36);
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const measure = () => setSlot(Math.max(30, Math.min(44, body.clientWidth / 30)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, []);
  const size = useSheetSize(bodyRef, slot, [scoreKeyHints]);
  const layout = useMemo(
    () => layoutJianpu(state.score, { slotsPerLine: size.slotsPerLine, linesPerPage: Number.MAX_SAFE_INTEGER }),
    [state.score, size.slotsPerLine],
  );
  const lines = layout.pages[0];
  // Lines grow from the left as you type instead of stretching across the paper.
  const widest = Math.max(size.slotsPerLine, ...lines.map((l) => lineSlots(l.bars)));

  // Keep the cursor in view.
  useEffect(() => {
    bodyRef.current?.querySelector(".j-caret")?.closest(".j-line")?.scrollIntoView({ block: "nearest" });
  }, [state.cursor, lines]);

  const setMeta = (patch: Partial<Score>) => {
    const current = stateRef.current;
    commit({ ...current, score: { ...current.score, ...patch } });
  };

  const text = draft ?? serializeScore(state.score);
  const textErrors = useMemo(() => (draft === null ? [] : parseScore(draft).errors), [draft]);
  const onText = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    const next = parseScore(e.target.value).score;
    commit({ score: next, cursor: Math.min(stateRef.current.cursor, next.events.length) });
  };

  const select = (id: string) => settings.set({ scoreId: id, scoreView: settings.get().scoreView === "off" ? "jianpu" : settings.get().scoreView });

  const onNew = () => select(addScore(serializeScore(emptyScore(uniqueTitle(untitled(language), language)))));
  const onDuplicate = () => select(duplicateScore(resolved.id, language));
  // Deleting asks inside the editor: browsers can silently block confirm() pop-ups.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  useEffect(() => setConfirmingDelete(false), [resolved.id]);
  const onDelete = () => {
    setConfirmingDelete(false);
    removeScore(resolved.id);
    select(DEFAULT_SCORE_ID);
  };
  const onExport = () => download(safeFilename(resolved.title), serializeScore({ ...state.score, title: resolved.title }));
  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const raw = await file.text();
    const { score, errors } = parseScore(raw);
    if (!score.events.length) {
      flash(t("editor.importFailed"));
      return;
    }
    if (!score.title) score.title = file.name.replace(/\.[^.]+$/, "");
    select(addScore(serializeScore(score)));
    if (errors.length) flash(t("editor.importWarnings"));
  };

  const pickupChoices = useMemo(() => {
    const bar = barBeats(state.score.time);
    const out: number[] = [];
    for (let b = 0; b < bar; b += 0.5) out.push(b);
    return out;
  }, [state.score.time]);

  const hold = (code: string | null, label: string) =>
    code ? (
      <span>
        <kbd>{codeLabel(code)}</kbd> {label}
      </span>
    ) : null;

  return (
    <div className="editor" ref={rootRef} tabIndex={-1} role="dialog" aria-modal="false" aria-label={t("editor.title")}>
      <header className="editor-head">
        <h2 className="editor-heading">{t("editor.title")}</h2>
        <label className="score-select">
          <span className="visually-hidden">{t("score.choose")}</span>
          <select value={resolved.id} onChange={(e) => select(e.target.value)}>
            <optgroup label={t("editor.builtins")}>
              {listScores(language)
                .filter((s) => s.builtin)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
            </optgroup>
            {listScores(language).some((s) => !s.builtin) && (
              <optgroup label={t("editor.mine")}>
                {listScores(language)
                  .filter((s) => !s.builtin)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </label>
        <div className="editor-actions">
          <button className="button button--ghost" onClick={onNew}>
            {t("editor.new")}
          </button>
          <button className="button button--ghost" onClick={onDuplicate}>
            {t("editor.duplicate")}
          </button>
          {!readOnly && (
            <button className="button button--ghost" onClick={() => setConfirmingDelete(true)}>
              {t("editor.delete")}
            </button>
          )}
          <button className="button button--ghost" onClick={() => fileRef.current?.click()}>
            {t("editor.import")}
          </button>
          <button className="button button--ghost" onClick={onExport}>
            {t("editor.export")}
          </button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={onImport} />
          <button className="icon-button" onClick={onClose} aria-label={t("editor.done")} title={t("editor.done")}>
            <CloseIcon />
          </button>
        </div>
      </header>

      {confirmingDelete && !readOnly && (
        <div className="editor-banner editor-banner--danger" role="alert">
          <span>{t("editor.confirmDelete").replace("{title}", resolved.title)}</span>
          <button className="button button--danger" onClick={onDelete} autoFocus>
            {t("editor.delete")}
          </button>
          <button className="button button--ghost" onClick={() => setConfirmingDelete(false)}>
            {t("editor.cancel")}
          </button>
        </div>
      )}

      {readOnly && (
        <div className="editor-banner">
          <span>{t("editor.readOnly")}</span>
          <button className="button" onClick={onDuplicate}>
            {t("editor.copyToEdit")}
          </button>
        </div>
      )}

      <div className="editor-fields">
        <label className="field field--title">
          <span className="control-label">{t("editor.fieldTitle")}</span>
          <input
            type="text"
            value={readOnly ? resolved.title : state.score.title}
            disabled={readOnly}
            placeholder={untitled(language)}
            onChange={(e) => setMeta({ title: e.target.value })}
          />
        </label>
        <label className="field">
          <span className="control-label">{t("editor.fieldKey")}</span>
          <select value={state.score.key} disabled={readOnly} onChange={(e) => setMeta({ key: e.target.value as KeyName })}>
            {KEY_NAMES.map((k) => (
              <option key={k} value={k}>
                1={keyLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="control-label">{t("editor.fieldTime")}</span>
          <select
            value={state.score.time}
            disabled={readOnly}
            onChange={(e) => setMeta({ time: e.target.value as TimeSignature, pickup: 0 })}
          >
            {TIME_SIGNATURES.map((ts) => (
              <option key={ts} value={ts}>
                {ts}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="control-label">{t("editor.fieldTempo")}</span>
          <input
            type="number"
            min={TEMPO_MIN}
            max={TEMPO_MAX}
            value={state.score.tempo}
            disabled={readOnly}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n > 0) setMeta({ tempo: Math.round(Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, n))) });
            }}
          />
        </label>
        <label className="field" title={t("editor.pickupHelp")}>
          <span className="control-label">{t("editor.fieldPickup")}</span>
          <select
            value={state.score.pickup}
            disabled={readOnly}
            onChange={(e) => setMeta({ pickup: Number(e.target.value) })}
          >
            {pickupChoices.map((b) => (
              <option key={b} value={b}>
                {b === 0 ? t("editor.pickupNone") : t("editor.pickupBeats").replace("{n}", String(b))}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className="editor-sheet sheet-like"
        data-hints={scoreKeyHints || undefined}
        style={{ ["--j-slot" as string]: `${slot}px` }}
        ref={bodyRef}
        onPointerDown={(e) => {
          // A click on empty paper puts the cursor at the end.
          if (e.target === e.currentTarget) apply({ type: "end" });
        }}
      >
        <JianpuLines
          lines={lines}
          endsScore
          widest={widest}
          cursor={readOnly ? undefined : state.cursor}
          eventCount={state.score.events.length}
          onPick={readOnly ? undefined : (cursor) => apply({ type: "moveTo", cursor })}
        />
        {state.score.events.length === 0 && !readOnly && (
          <p className="editor-empty">
            <i className="j-caret j-caret--inline" />
            {t("editor.emptyHint")}
          </p>
        )}
      </div>

      <footer className="editor-foot">
        <p className="editor-keys" aria-live="polite">
          {message ? (
            <span className="editor-message">{message}</span>
          ) : (
            <>
              <span>
                <kbd>1</kbd>–<kbd>7</kbd> {t("editor.keyNotes")}
              </span>
              <span>
                <kbd>0</kbd> {t("editor.keyRest")}
              </span>
              <span>
                <kbd>-</kbd> {t("editor.keyExtend")}
              </span>
              <span>
                <kbd>/</kbd> {t("editor.keyHalve")}
              </span>
              <span>
                <kbd>.</kbd> {t("editor.keyDot")}
              </span>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd> {t("editor.keySharpFlat")}
              </span>
              {hold(bindings.octaveDown1, t("editor.keyLow"))}
              {hold(bindings.octaveUp1, t("editor.keyHigh"))}
              <span>
                <kbd>←</kbd>
                <kbd>→</kbd> {t("editor.keyMove")}
              </span>
              <span>
                <kbd>⌫</kbd> {t("editor.keyBackspace")}
              </span>
            </>
          )}
        </p>
        <details className="editor-text">
          <summary>{t("editor.textView")}</summary>
          <textarea
            value={readOnly ? serializeScore({ ...state.score, title: resolved.title }) : text}
            readOnly={readOnly}
            spellCheck={false}
            rows={6}
            onFocus={() => !readOnly && setDraft(serializeScore(state.score))}
            onBlur={() => setDraft(null)}
            onChange={onText}
          />
          {textErrors.length > 0 && (
            <ul className="editor-errors">
              {textErrors.slice(0, 4).map((err, i) => (
                <li key={i}>
                  {err.line ? t("editor.line").replace("{n}", String(err.line)) : ""}
                  {t(`parse.${err.code}`).replace("{x}", err.detail ?? "")}
                </li>
              ))}
            </ul>
          )}
        </details>
      </footer>
    </div>
  );
}
