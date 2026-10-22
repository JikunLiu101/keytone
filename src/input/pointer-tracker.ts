import type { NoteHub } from "../core/note-hub";

/**
 * Tracks which note each pointer (mouse, finger, pen) is holding. Every
 * pointer is its own NoteHub source, so several fingers can hold a chord and
 * a finger sliding across keys plays them in turn (glissando).
 * Pure logic: the caller works out which key is under each pointer.
 */
export class PointerTracker {
  /** pointerId → note held by that pointer, or null while it is over no key. */
  private pointers = new Map<number, number | null>();

  constructor(
    private readonly hub: NoteHub,
    private readonly getVelocity: () => number,
  ) {}

  get activeCount(): number {
    return this.pointers.size;
  }

  isTracking(pointerId: number): boolean {
    return this.pointers.has(pointerId);
  }

  down(pointerId: number, midi: number | null): void {
    this.pointers.set(pointerId, null);
    this.moveTo(pointerId, midi);
  }

  /** The pointer moved; `midi` is the key now under it (null if none). */
  move(pointerId: number, midi: number | null): void {
    if (!this.pointers.has(pointerId)) return;
    this.moveTo(pointerId, midi);
  }

  up(pointerId: number): void {
    if (!this.pointers.has(pointerId)) return;
    this.moveTo(pointerId, null);
    this.pointers.delete(pointerId);
  }

  /** Release every pointer, e.g. when the window loses focus. */
  cancelAll(): void {
    for (const id of [...this.pointers.keys()]) this.up(id);
  }

  private moveTo(pointerId: number, midi: number | null): void {
    const previous = this.pointers.get(pointerId) ?? null;
    if (previous === midi) return;
    const source = `pointer:${pointerId}`;
    if (previous !== null) this.hub.release(source, previous);
    if (midi !== null) this.hub.press(source, midi, this.getVelocity());
    this.pointers.set(pointerId, midi);
  }
}
