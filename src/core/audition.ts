import type { NoteHub } from "./note-hub";

/**
 * Plays notes for a moment, as the score editor does for each note entered.
 * The same note entered again before the last one ended is released and
 * struck again, so it sounds every time; each note keeps its own timer, so
 * an earlier timer never cuts a later note short.
 */
export function createAuditioner(hub: NoteHub, velocity: () => number, ms: number): (midis: number[]) => void {
  const source = "editor";
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  return (midis) => {
    for (const midi of midis) {
      const pending = timers.get(midi);
      if (pending !== undefined) {
        clearTimeout(pending);
        hub.release(source, midi);
      }
      hub.press(source, midi, velocity());
      timers.set(
        midi,
        setTimeout(() => {
          timers.delete(midi);
          hub.release(source, midi);
        }, ms),
      );
    }
  };
}
