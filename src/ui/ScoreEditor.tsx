import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from "react";
import { engine, hub, settings } from "../app/services";
import { OCTAVE_ACTION_SHIFT, actionForCode, codeLabel } from "../core/keymap";
import { MAX_OCTAVE_SHIFT } from "../core/notes";
import { isTyping } from "../input/keyboard-input";
import { useSettings, useT } from "../i18n/useT";
import { DEFAULT_SCORE_ID } from "../score/builtin-scores";
import {
  edit,
  editorActionForCode,
  pasteEvents,
  selectedEvents,
  selectionRange,
  type EditorAction,
  type EditorState,
} from "../score/editor";
import { createHistory } from "../score/history";
import { layoutLines, sameSheetBox, sheetMetrics, type SheetBox } from "../score/jianpu-layout";
import {
  addScore,
  duplicateScore,
  listScores,
  removeScore,
  uniqueTitle,
  untitled,
  updateScoreData,
} from "../score/library";
import { buildLyrics } from "../score/lyrics";
import {
  KEY_NAMES,
  TEMPO_MAX,
  TEMPO_MIN,
  TIME_SIGNATURES,
  barBeats,
  emptyScore,
  parseScore,
  serializeEvents,
  serializeScore,
  type KeyName,
  type Score,
  type TimeSignature,
} from "../score/score";
import { CloseIcon } from "./icons";
import { Select } from "./Select";
import { showToast } from "./Toast";
import { JianpuLines, keyLabel } from "./JianpuView";
import { MelodyText } from "./MelodyText";
import { useCurrentScore, useMeasureSheet } from "./ScoreSheet";

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

/** Typing keeps adding to one undo step; deleting is its own step. */
function historyGroup(action: EditorAction): string | undefined {
  switch (action.type) {
    case "note":
    case "rest":
    case "extend":
    case "halve":
    case "dot":
    case "accidental":
      return "type";
    case "backspace":
    case "delete":
      return "delete";
    default:
      return undefined;
  }
}

/**
 * The cursor position for a click on a note's token or glyph: before it on
 * its left half, after it on its right half. A `-` belongs to its note, so a
 * click on one puts the cursor after the note (spec §11.4).
 */
function pickCursor(target: EventTarget | null, clientX: number): number | null {
  const el = target instanceof Element ? target.closest<HTMLElement>("[data-event]") : null;
  if (!el) return null;
  const event = Number(el.dataset.event);
  if (el.dataset.dash !== undefined) return event + 1;
  const box = el.getBoundingClientRect();
  return clientX < box.left + box.width / 2 ? event : event + 1;
}

/**
 * Full-width score editor over the glass and control panel. The keys stay
 * visible below it (and playable with the mouse), but typing goes to the
 * score: digits enter notes, held octave keys add octave dots. The sheet sits
 * on the left; the melody as text on the right (spec §11.4).
 */
export function ScoreEditor({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { language, bindings, scoreKeyHints, beatsPerLine } = useSettings();
  const resolved = useCurrentScore();
  const readOnly = resolved.builtin;
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const melodyRef = useRef<HTMLDivElement>(null);
  const [state, setStateRaw] = useState<EditorState>({ score: resolved.score, cursor: resolved.score.events.length, anchor: null });
  // Edits read the latest state from here, so fast typing and key repeat
  // never work from a copy React hasn't re-rendered yet.
  const stateRef = useRef(state);
  const setState = (next: EditorState) => {
    stateRef.current = next;
    setStateRaw(next);
  };
  const held = useRef(new Set<string>());
  const fileRef = useRef<HTMLInputElement>(null);
  // One undo history for everything in the editor; another score starts a new one.
  const history = useMemo(() => createHistory<EditorState>(), []);

  // Switching to another score loads it.
  useEffect(() => {
    setState({ score: resolved.score, cursor: resolved.score.events.length, anchor: null });
    history.clear();
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

  const flash = (text: string) => showToast(text, "warn");

  // Every change is saved straight away; the time shows that it was.
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  useEffect(() => setSavedAt(null), [resolved.id]);
  const persist = (score: Score) => {
    updateScoreData(resolved.id, score);
    setSavedAt(new Date());
  };
  /** Show `next`; when the score changed, remember the old state for undo and save. */
  const commit = (next: EditorState, group?: string) => {
    const current = stateRef.current;
    if (next.score !== current.score && !readOnly) {
      history.push(current, group);
      persist(next.score);
    }
    setState(next);
  };

  const undo = (redo = false) => {
    if (readOnly) return;
    const current = stateRef.current;
    const back = redo ? history.redo(current) : history.undo(current);
    if (!back) return;
    setState(back);
    persist(back.score);
  };
  const undoRef = useRef(undo);
  undoRef.current = undo;

  /** Save button and Ctrl/⌘+S: writes the score again and confirms it. */
  const save = () => {
    if (readOnly) {
      showToast(t("editor.cantSaveBuiltin"), "warn");
      return;
    }
    persist(stateRef.current.score);
    showToast(t("editor.saved").replace("{title}", stateRef.current.score.title || untitled(language)));
  };
  const saveRef = useRef(save);
  saveRef.current = save;

  const apply = (action: EditorAction) => {
    if (readOnly) return;
    const current = stateRef.current;
    const result = edit(current, action);
    if (result.rejected) flash(t("editor.outOfRange"));
    if (result.state !== current) commit(result.state, historyGroup(action));
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
      const mod = e.ctrlKey || e.metaKey;
      // Ctrl/⌘+S saves (even from a text field) instead of saving the web page.
      if (mod && e.code === "KeyS") {
        e.preventDefault();
        saveRef.current();
        return;
      }
      // One undo history for the melody, lyrics and fields, even from a text field.
      if (mod && !e.isComposing && (e.code === "KeyZ" || e.code === "KeyY")) {
        e.preventDefault();
        undoRef.current(e.code === "KeyY" || e.shiftKey);
        return;
      }
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (isTyping(e.target) || e.altKey) return;
      const { cursor, score } = stateRef.current;
      if (mod) {
        if (e.code === "KeyA") {
          e.preventDefault();
          applyRef.current({ type: "moveTo", cursor: 0 });
          applyRef.current({ type: "select", cursor: score.events.length });
        }
        return;
      }
      // Shift with ← / → / Home / End selects.
      if (e.shiftKey && (e.code === "ArrowLeft" || e.code === "ArrowRight" || e.code === "Home" || e.code === "End")) {
        e.preventDefault();
        const to = { ArrowLeft: cursor - 1, ArrowRight: cursor + 1, Home: 0, End: score.events.length }[e.code];
        applyRef.current({ type: "select", cursor: to });
        return;
      }
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

  // Copy, cut and paste notes (text fields keep their own).
  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const events = selectedEvents(stateRef.current);
      if (!events.length || !e.clipboardData) return;
      e.clipboardData.setData("text/plain", serializeEvents(events));
      e.preventDefault();
    };
    const onCut = (e: ClipboardEvent) => {
      if (isTyping(e.target) || !selectedEvents(stateRef.current).length) return;
      onCopy(e);
      applyRef.current({ type: "delete" });
    };
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const text = e.clipboardData?.getData("text/plain");
      if (!text) return;
      e.preventDefault();
      const { events, errors } = pasteEvents(text);
      if (!events.length) {
        flash(t("editor.pasteNothing"));
        return;
      }
      applyRef.current({ type: "insert", events });
      const [first] = errors;
      if (first) flash(`${t("editor.pasteSkipped")} ${t(`parse.${first.code}`).replace("{x}", first.detail ?? "")}`);
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [t]);

  // Click to place the cursor, Shift+click or drag to select: on the sheet and in the melody text.
  const dragging = useRef(false);
  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);
  const onPanePointerDown = (e: ReactPointerEvent<HTMLElement>, focus?: HTMLElement | null) => {
    if (readOnly || e.button !== 0) return;
    const at = pickCursor(e.target, e.clientX) ?? (e.target === e.currentTarget ? stateRef.current.score.events.length : null);
    if (at === null) return;
    e.preventDefault();
    (focus ?? rootRef.current)?.focus({ preventScroll: true });
    apply({ type: e.shiftKey ? "select" : "moveTo", cursor: at });
    dragging.current = true;
  };
  const onPanePointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!dragging.current || !(e.buttons & 1)) return;
    const at = pickCursor(e.target, e.clientX);
    if (at !== null && at !== stateRef.current.cursor) apply({ type: "select", cursor: at });
  };

  // Layout: all lines, scrolling, laid out like the sheet on the glass (spec §11.2).
  const [box, setBox] = useState<SheetBox>({ width: 0, linesPerPage: 1 });
  const metrics = useMemo(
    () => sheetMetrics(Math.max(0, box.width - 2), beatsPerLine, barBeats(state.score.time)),
    [box.width, beatsPerLine, state.score.time],
  );
  // The editor always shows the lyrics, whatever the switch on the panel says.
  const lyrics = useMemo(() => buildLyrics(state.score), [state.score]);
  useMeasureSheet(bodyRef, (next) => setBox((prev) => sameSheetBox(prev, next)), [scoreKeyHints, metrics.font, !!lyrics]);
  const lines = useMemo(() => layoutLines(state.score, beatsPerLine), [state.score, beatsPerLine]);
  const selection = selectionRange(state);

  // Keep the cursor in view on both sides.
  useEffect(() => {
    bodyRef.current?.querySelector(".j-caret")?.closest(".j-line")?.scrollIntoView({ block: "nearest" });
    melodyRef.current?.querySelector(".mt-caret")?.scrollIntoView({ block: "nearest" });
  }, [state.cursor, lines]);

  const setMeta = (patch: Partial<Score>) => {
    const current = stateRef.current;
    commit({ ...current, score: { ...current.score, ...patch } }, `meta:${Object.keys(patch).join()}`);
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
        <Select
          className="score-select"
          label={t("score.choose")}
          value={resolved.id}
          onChange={select}
          options={listScores(language).map((e) => ({
              value: e.id,
              label: e.title,
              group: t(e.builtin ? "editor.builtins" : "editor.mine"),
            }))}
        />
        <div className="editor-actions">
          <span className="editor-saved" aria-live="polite">
            {readOnly ? "" : savedAt ? t("editor.autoSavedAt").replace("{time}", savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })) : t("editor.autoSave")}
          </span>
          <button className="button editor-save" onClick={save} disabled={readOnly} title={t("editor.saveHint")}>
            {t("editor.save")}
          </button>
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
          <Select
            label={t("editor.fieldKey")}
            value={state.score.key}
            disabled={readOnly}
            onChange={(key: KeyName) => setMeta({ key })}
            options={KEY_NAMES.map((k) => ({ value: k, label: `1=${keyLabel(k)}` }))}
          />
        </label>
        <label className="field">
          <span className="control-label">{t("editor.fieldTime")}</span>
          <Select
            label={t("editor.fieldTime")}
            value={state.score.time}
            disabled={readOnly}
            onChange={(time: TimeSignature) => setMeta({ time, pickup: 0 })}
            options={TIME_SIGNATURES.map((ts) => ({ value: ts, label: ts }))}
          />
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
          <Select
            label={t("editor.fieldPickup")}
            value={state.score.pickup}
            disabled={readOnly}
            onChange={(pickup: number) => setMeta({ pickup })}
            options={pickupChoices.map((b) => ({
              value: b,
              label: b === 0 ? t("editor.pickupNone") : t("editor.pickupBeats").replace("{n}", String(b)),
            }))}
          />
        </label>
      </div>

      <div className="editor-main">
        <div
          className="editor-sheet sheet-like"
          data-hints={scoreKeyHints || undefined}
          style={{ ["--j-size" as string]: `${metrics.font}px` }}
          ref={bodyRef}
          onPointerDown={(e) => onPanePointerDown(e)}
          onPointerMove={onPanePointerMove}
        >
          <JianpuLines
            lines={lines}
            metrics={metrics}
            endsScore
            cursor={readOnly ? undefined : state.cursor}
            eventCount={state.score.events.length}
            selection={selection}
            lyrics={lyrics}
          />
          {state.score.events.length === 0 && !readOnly && (
            <p className="editor-empty">
              <i className="j-caret j-caret--inline" />
              {t("editor.emptyHint")}
            </p>
          )}
        </div>

        <div className="editor-side">
          <section className="editor-pane editor-pane--melody">
            <h3 className="control-label">{t("editor.melody")}</h3>
            <div
              className="editor-text-box"
              ref={melodyRef}
              onPointerDown={(e) => onPanePointerDown(e, melodyRef.current?.querySelector<HTMLElement>(".melody-text"))}
              onPointerMove={onPanePointerMove}
            >
              <MelodyText
                score={state.score}
                lines={lines}
                cursor={state.cursor}
                selection={selection}
                label={t("editor.melody")}
                readOnly={readOnly}
              />
            </div>
          </section>
        </div>
      </div>

      <footer className="editor-foot">
        <p className="editor-keys">
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
          <span>
            <kbd>Shift</kbd>+<kbd>←</kbd>
            <kbd>→</kbd> {t("editor.keySelect")}
          </span>
          <span>
            <kbd>Ctrl/⌘</kbd>+<kbd>C</kbd>
            <kbd>X</kbd>
            <kbd>V</kbd> {t("editor.keyClipboard")}
          </span>
          <span>
            <kbd>Ctrl/⌘</kbd>+<kbd>Z</kbd> {t("editor.keyUndo")}
          </span>
        </p>
      </footer>
    </div>
  );
}
