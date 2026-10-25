import { Reverb } from "smplr";
import type { NoteEvent, NoteHub } from "../core/note-hub";
import { findInstrument, type InstrumentBackend, type InstrumentDef } from "./instruments";
import { primeMediaPlayback } from "./mobile-audio";

export interface EngineStatus {
  /** Instrument currently playing, or null before the first one loads. */
  currentId: string | null;
  /** Instrument being loaded, or null when idle. */
  loadingId: string | null;
  /** Last load failure, cleared on the next successful load or on going back to the instrument playing. */
  errorId: string | null;
  /** True once the browser lets the AudioContext run (after a user gesture). */
  audioRunning: boolean;
}

/** Send level for the "light" reverb. */
const REVERB_SEND = 0.22;

/**
 * Owns the AudioContext, master volume, reverb and the active instrument, and
 * plays note events coming from the NoteHub.
 */
export class AudioEngine {
  readonly context: AudioContext;
  private readonly master: GainNode;
  private readonly reverbSend: GainNode;
  private reverbOn = false;
  private current: { def: InstrumentDef; backend: InstrumentBackend } | null = null;
  /** midi → function that stops the voice started for it. */
  private voices = new Map<number, () => void>();
  private status: EngineStatus = { currentId: null, loadingId: null, errorId: null, audioRunning: false };
  private listeners = new Set<() => void>();
  private loadToken = 0;

  constructor(hub: NoteHub) {
    this.context = new AudioContext({ latencyHint: "interactive" });
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);

    // Reverb as a send: master → send gain → reverb (wet only) → destination.
    this.reverbSend = this.context.createGain();
    this.reverbSend.gain.value = 0;
    this.master.connect(this.reverbSend);
    this.setupReverb();

    // Track whether audio may play (suspended until a gesture; iOS can also
    // "interrupt" it, e.g. during a call).
    this.status.audioRunning = this.context.state === "running";
    this.context.addEventListener("statechange", () => {
      const running = this.context.state === "running";
      if (running !== this.status.audioRunning) this.setStatus({ audioRunning: running });
    });

    hub.onNote(this.handleNote);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): EngineStatus => this.status;

  /**
   * Browsers start audio suspended until a user gesture; call from one. On
   * phones only some gestures count (touchend, click), so this is safe to call
   * from every gesture: it keeps trying until the context is running.
   */
  unlock(): void {
    if (this.context.state === "running") return;
    primeMediaPlayback();
    this.context.resume().catch(() => {
      // Not a qualifying gesture yet; the next one will try again.
    });
  }

  /** Master volume, 0–1. Uses a squared curve so the slider feels even. */
  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.master.gain.setTargetAtTime(v * v, this.context.currentTime, 0.02);
  }

  setReverb(on: boolean): void {
    this.reverbOn = on;
    this.reverbSend.gain.setTargetAtTime(on ? REVERB_SEND : 0, this.context.currentTime, 0.05);
  }

  /**
   * Load an instrument. The previous one keeps playing until the new one is
   * ready, then it is swapped in.
   */
  async setInstrument(id: string): Promise<void> {
    const def = findInstrument(id);
    if (!def) throw new Error(`Unknown instrument: ${id}`);
    if (this.current?.def.id === id && !this.status.loadingId) {
      // Back to the instrument still playing after another failed: that failure is no longer the choice.
      if (this.status.errorId) this.setStatus({ errorId: null });
      return;
    }
    const token = ++this.loadToken;
    this.setStatus({ loadingId: id });

    let backend: InstrumentBackend | null = null;
    try {
      backend = def.create(this.context, this.master);
      await backend.ready;
    } catch (err) {
      console.error(`Failed to load instrument "${id}"`, err);
      backend?.dispose();
      if (token === this.loadToken) this.setStatus({ loadingId: null, errorId: id });
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
    this.setStatus({ currentId: id, loadingId: null, errorId: null });
  }

  private async setupReverb(): Promise<void> {
    try {
      const reverb = new Reverb(this.context);
      await reverb.ready();
      reverb.getParam("dry")?.setValueAtTime(0, this.context.currentTime);
      reverb.getParam("wet")?.setValueAtTime(1, this.context.currentTime);
      this.reverbSend.connect(reverb.input);
      reverb.connect(this.context.destination);
      this.setReverb(this.reverbOn);
    } catch (err) {
      // Reverb needs AudioWorklet; without it we simply play dry.
      console.warn("Reverb unavailable", err);
    }
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

  private setStatus(patch: Partial<EngineStatus>): void {
    this.status = { ...this.status, ...patch };
    for (const listener of this.listeners) listener();
  }
}
