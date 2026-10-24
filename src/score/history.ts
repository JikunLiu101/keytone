/**
 * Undo / redo history of snapshots (spec §11.4). `push` records the state
 * from before a change. Changes in the same group less than a second apart
 * (typing a word, say) make one undo step: only the first is kept.
 */
export interface History<T> {
  push(entry: T, group?: string): void;
  /** The state to go back to, given the current one; null when there is none. */
  undo(current: T): T | null;
  redo(current: T): T | null;
  clear(): void;
}

/** Changes in one group this close together are one undo step. */
const GROUP_MS = 1000;

export function createHistory<T>(limit = 200, now: () => number = () => Date.now()): History<T> {
  let past: T[] = [];
  let future: T[] = [];
  let lastGroup: string | undefined;
  let lastAt = -Infinity;
  return {
    push(entry, group) {
      const at = now();
      const sameStep = group !== undefined && group === lastGroup && at - lastAt < GROUP_MS;
      lastGroup = group;
      lastAt = at;
      future = [];
      if (sameStep) return;
      past.push(entry);
      if (past.length > limit) past = past.slice(past.length - limit);
    },
    undo(current) {
      const entry = past.pop();
      if (entry === undefined) return null;
      future.push(current);
      lastGroup = undefined;
      return entry;
    },
    redo(current) {
      const entry = future.pop();
      if (entry === undefined) return null;
      past.push(current);
      lastGroup = undefined;
      return entry;
    },
    clear() {
      past = [];
      future = [];
      lastGroup = undefined;
    },
  };
}
