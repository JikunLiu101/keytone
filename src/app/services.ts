/** App-wide singletons wiring settings, core, input and audio together. */
import { AudioEngine } from "../audio/audio-engine";
import { KeyboardController } from "../core/keyboard-controller";
import { PointerTracker } from "../input/pointer-tracker";
import { NoteHub } from "../core/note-hub";
import { createStore } from "../core/store";
import { loadSettings, saveSettings, type Settings } from "./settings";

export const settings = createStore<Settings>(
  loadSettings(
    navigator.languages ?? [navigator.language],
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  ),
);

// Save right away so the first-visit language choice sticks, then on every change.
saveSettings(settings.get());
settings.subscribe(() => saveSettings(settings.get()));

export const hub = new NoteHub();

export const keyboard = new KeyboardController(hub, {
  getBindings: () => settings.get().bindings,
  getVelocity: () => settings.get().velocity,
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
  Object.assign(window, { __keytone: { hub, keyboard, pointers, engine, settings } });
}
