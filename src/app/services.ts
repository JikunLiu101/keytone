/** App-wide singletons wiring settings, core, input and audio together. */
import { AudioEngine } from "../audio/audio-engine";
import { KeyboardController } from "../core/keyboard-controller";
import { PointerTracker } from "../input/pointer-tracker";
import { NoteHub } from "../core/note-hub";
import { createDerived, createStore } from "../core/store";
import { BASE_MIDI, octaveC } from "../core/notes";
import { resolveScore, updateScoreData, userScores } from "../score/library";
import { appliedOctave, octaveChange } from "./base-octave";
import { loadSettings, saveSettings, type Settings } from "./settings";

/**
 * Layout override for testing: `?layout=compact` forces the touch layout on
 * any screen, `?layout=full` forces the full keyboard.
 */
export const layoutOverride: "compact" | "full" | null = (() => {
  const value = new URLSearchParams(location.search).get("layout");
  return value === "compact" || value === "full" ? value : null;
})();

const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches ?? false;
const smallTouchScreen =
  layoutOverride === "compact" || (coarsePointer && Math.min(innerWidth, innerHeight) < 600);

export const settings = createStore<Settings>(
  loadSettings(
    navigator.languages ?? [navigator.language],
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    smallTouchScreen,
  ),
);

/**
 * The visible part of the keyboard. In compact (touch) mode the keyboard is
 * wider than the screen; `scroll` is the first visible white key and
 * `visible` how many white keys fit.
 */
export const keyboardWindow = createStore({
  compact: false,
  scroll: 0,
  visible: 38,
  ready: false,
  stageHeight: 0,
  /** Set when the user moves the window themselves; pauses auto-follow until the song restarts. */
  manual: false,
});

/** Jianpu page on the glass, and how many pages the current score has. */
export const scorePage = createStore({ page: 0, count: 1 });

/** Set while the score editor is open: then its score's base applies, whatever the score view (spec §13.3). */
export const editorOpen = createStore({ open: false });

const currentScore = () => resolveScore(settings.get().scoreId, settings.get().language);

/** The base octave that applies now (spec §13.3). */
export const baseOctave = createDerived(
  () => appliedOctave(settings.get(), currentScore(), editorOpen.get().open),
  [settings, userScores, editorOpen],
);

/** Semitones between the base that applies and the base scores are written at (C3). */
export function baseShift(): number {
  return octaveC(baseOctave.get()) - BASE_MIDI;
}

/**
 * Move the base that applies one octave down or up, and keep it where it
 * belongs: the setting, a built-in's entry, or the shown score. Returns the new
 * octave and, for a score, its title; null at C2 / C5.
 */
export function stepBaseOctave(direction: 1 | -1): { octave: number; title: string | null } | null {
  const s = settings.get();
  const resolved = currentScore();
  const change = octaveChange(s, resolved, editorOpen.get().open, direction);
  if (!change) return null;
  if (change.target === "global") settings.set({ baseOctave: change.octave });
  else if (change.target === "builtin") settings.set({ builtinOctaves: { ...s.builtinOctaves, [resolved.id]: change.octave } });
  else updateScoreData(resolved.id, { ...resolved.score, octave: change.octave });
  return { octave: change.octave, title: change.target === "global" ? null : resolved.title };
}

// Save right away so the first-visit language choice sticks, then on every change.
saveSettings(settings.get());
settings.subscribe(() => saveSettings(settings.get()));

export const hub = new NoteHub();

export const keyboard = new KeyboardController(hub, {
  getBindings: () => settings.get().bindings,
  getVelocity: () => settings.get().velocity,
  getBase: () => octaveC(baseOctave.get()),
});

/** Mouse, touch and pen notes; each pointer is its own source. */
export const pointers = new PointerTracker(hub, () => settings.get().velocity);

export const engine = new AudioEngine(hub);

// Keep the audio engine in sync with settings.
let applied: Settings | null = null;
function applySettings(): void {
  const s = settings.get();
  if (s.volume !== applied?.volume) engine.setVolume(s.volume);
  if (s.reverb !== applied?.reverb) engine.setReverb(s.reverb);
  if (s.instrumentId !== applied?.instrumentId) void engine.setInstrument(s.instrumentId);
  if (s.language !== applied?.language) document.documentElement.lang = s.language === "zh" ? "zh-CN" : "en";
  applied = s;
}
applySettings();
settings.subscribe(applySettings);

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, { __keytone: { hub, keyboard, pointers, engine, settings, keyboardWindow, scorePage, baseOctave } });
}
