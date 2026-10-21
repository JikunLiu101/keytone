import type { NoteEvent, NoteHub } from "../core/note-hub";
import { INSTRUMENTS, type InstrumentBackend, type InstrumentDef } from "./instruments";

export type EngineStatus =
  | { state: "loading"; instrumentId: string }
  | { state: "ready"; instrumentId: string }
  | { state: "error"; instrumentId: string; message: string };

/**
 * Owns the AudioContext, master volume and the active instrument, and plays
 * note events coming from the NoteHub.
 */
export class AudioEngine {
  readonly context: AudioContext;
  private readonly master: GainNode;
  private current: { def: InstrumentDef; backend: InstrumentBackend } | null = null;
  /** midi → function that stops the voice started for it. */
  private voices = new Map<number, () => void>();
  private status: EngineStatus;
  private listeners = new Set<() => void>();
  private loadToken = 0;

  constructor(hub: NoteHub) {
    this.context = new AudioContext({ latencyHint: "interactive" });
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.status = { state: "loading", instrumentId: "" };
    hub.onNote(this.handleNote);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): EngineStatus => this.status;

  /** Browsers start audio suspended until a user gesture; call from one. */
  unlock(): void {
    if (this.context.state === "suspended") void this.context.resume();
  }

  /** Master volume, 0–1. Uses a squared curve so the slider feels even. */
  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.master.gain.setTargetAtTime(v * v, this.context.currentTime, 0.02);
  }

  /**
   * Load an instrument. The previous one keeps playing until the new one is
   * ready, then it is swapped in.
   */
  async setInstrument(id: string): Promise<void> {
    const def = INSTRUMENTS.find((i) => i.id === id);
    if (!def) throw new Error(`Unknown instrument: ${id}`);
    const token = ++this.loadToken;
    this.setStatus({ state: "loading", instrumentId: id });

    const backend = def.create(this.context, this.master);
    try {
      await backend.ready;
    } catch (err) {
      backend.dispose();
      if (token === this.loadToken) {
        this.setStatus({ state: "error", instrumentId: id, message: String(err) });
      }
      return;
    }
    if (token !== this.loadToken) {
      backend.dispose(); // a newer selection won the race
      return;
    }
    const previous = this.current;
    this.current = { def, backend };
    // Release old voices (they fade out naturally), then dispose the old instrument.
    for (const stop of this.voices.values()) stop();
    this.voices.clear();
    if (previous) setTimeout(() => previous.backend.dispose(), 2000);
    this.setStatus({ state: "ready", instrumentId: id });
  }

  private handleNote = (event: NoteEvent): void => {
    if (event.type === "on") {
      this.unlock();
      if (!this.current) return;
      this.voices.get(event.midi)?.();
      this.voices.set(event.midi, this.current.backend.start(event.midi, event.velocity));
    } else {
      const stop = this.voices.get(event.midi);
      this.voices.delete(event.midi);
      stop?.();
    }
  };

  private setStatus(status: EngineStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener();
  }
}
