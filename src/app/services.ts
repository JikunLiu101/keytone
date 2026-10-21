/** App-wide singletons wiring core, input and audio together. */
import { AudioEngine } from "../audio/audio-engine";
import { KeyboardController } from "../core/keyboard-controller";
import { DEFAULT_BINDINGS, type KeyBindings } from "../core/keymap";
import { NoteHub } from "../core/note-hub";

/** Live settings read by the controller on every key press. */
export const settings = {
  bindings: { ...DEFAULT_BINDINGS } as KeyBindings,
  /** MIDI velocity 1–127 used for keyboard and mouse notes. */
  velocity: 100,
  /** Master volume 0–1. */
  volume: 0.8,
};

export const hub = new NoteHub();

export const keyboard = new KeyboardController(hub, {
  getBindings: () => settings.bindings,
  getVelocity: () => settings.velocity,
});

export const engine = new AudioEngine(hub);
engine.setVolume(settings.volume);

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, { __keytone: { hub, keyboard, engine, settings } });
}
