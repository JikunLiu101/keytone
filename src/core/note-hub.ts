/**
 * NoteHub is the single stream of note events. Every input (computer keys,
 * mouse, later touch or MIDI) presses and releases notes here, and audio and
 * visuals subscribe to its events. It also owns sustain-pedal behaviour so
 * every instrument back end gets identical sustain.
 */

export type NoteEvent =
  | { type: "on"; midi: number; velocity: number }
  | { type: "off"; midi: number };

type Listener = (event: NoteEvent) => void;

export class NoteHub {
  /** midi → ids of the sources currently holding it down. */
  private holders = new Map<number, Set<string>>();
  /** Notes released while sustain was on; they keep sounding. */
  private sustained = new Set<number>();
  private sustainOn = false;
  private listeners = new Set<Listener>();
  private stateListeners = new Set<() => void>();
  private snapshot: ReadonlySet<number> = new Set();

  /** Subscribe to note on/off events. Returns an unsubscribe function. */
  onNote(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Subscribe to changes of the sounding-notes set (for useSyncExternalStore). */
  subscribe = (listener: () => void): (() => void) => {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  };

  /** Notes that are held or sustained. Stable reference until the next change. */
  getSounding = (): ReadonlySet<number> => this.snapshot;

  get isSustainOn(): boolean {
    return this.sustainOn;
  }

  press(source: string, midi: number, velocity: number): void {
    let holders = this.holders.get(midi);
    if (holders?.has(source)) return;
    const wasHeld = !!holders && holders.size > 0;
    if (!holders) {
      holders = new Set();
      this.holders.set(midi, holders);
    }
    holders.add(source);
    if (wasHeld) return; // already sounding from another source

    if (this.sustained.delete(midi)) {
      // Re-striking a sustained note restarts it, like a real piano.
      this.emit({ type: "off", midi });
    }
    this.emit({ type: "on", midi, velocity });
    this.changed();
  }

  release(source: string, midi: number): void {
    const holders = this.holders.get(midi);
    if (!holders?.delete(source)) return;
    if (holders.size > 0) return;
    this.holders.delete(midi);

    if (this.sustainOn) {
      this.sustained.add(midi);
      return; // still sounding, so the snapshot is unchanged
    }
    this.emit({ type: "off", midi });
    this.changed();
  }

  setSustain(on: boolean): void {
    if (on === this.sustainOn) return;
    this.sustainOn = on;
    if (on) {
      this.notify();
      return;
    }
    const toStop = [...this.sustained];
    this.sustained.clear();
    for (const midi of toStop) this.emit({ type: "off", midi });
    this.changed();
  }

  /** Stop everything and drop the pedal, e.g. when the window loses focus. */
  releaseAll(): void {
    const sounding = [...this.snapshot];
    this.holders.clear();
    this.sustained.clear();
    this.sustainOn = false;
    for (const midi of sounding) this.emit({ type: "off", midi });
    this.changed();
  }

  /** For useSyncExternalStore together with `subscribe`. */
  getSustain = (): boolean => this.sustainOn;

  private emit(event: NoteEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  private changed(): void {
    this.snapshot = new Set([...this.holders.keys(), ...this.sustained]);
    this.notify();
  }

  private notify(): void {
    for (const listener of this.stateListeners) listener();
  }
}
