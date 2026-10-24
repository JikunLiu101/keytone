/**
 * Falling-notes play-along (spec §10.1, §10.2). Pure timing and judging, so
 * it can be tested without a screen; the renderer only draws what this says.
 *
 * Song time is in seconds of the score at 100 % speed. Real time advances it
 * by `speed`, so the ±HIT_WINDOW judging window stays the same in real time
 * at any speed.
 */
import { barBeats, eventBeats, pitchMidi, type Score } from "./score";

/** A press within this many real seconds of a note's start counts as a hit. */
export const HIT_WINDOW = 0.25;
/** How long the summary waits after the last note leaves. */
const END_PAUSE = 0.6;

export interface FallNote {
  /** Index in the timeline. */
  id: number;
  midi: number;
  /** Song seconds. */
  start: number;
  end: number;
  /** Practice step (one per note or chord). */
  step: number;
  state: "pending" | "hit" | "missed";
  /** Song time when it was judged. */
  judgedAt?: number;
}

export interface Timeline {
  notes: FallNote[];
  /** Song seconds of one beat and one bar. */
  beat: number;
  bar: number;
  /** When the last note ends. */
  end: number;
  steps: number;
}

export function buildTimeline(score: Score): Timeline {
  const beat = 60 / score.tempo;
  const notes: FallNote[] = [];
  let t = 0;
  let step = 0;
  for (const e of score.events) {
    const length = eventBeats(e) * beat;
    if (e.kind !== "rest" && e.pitches.length) {
      const midis = [...new Set(e.pitches.map((p) => pitchMidi(p, score.key)))];
      for (const midi of midis) {
        notes.push({ id: notes.length, midi, start: t, end: t + length, step, state: "pending" });
      }
      step++;
    }
    t += length;
  }
  return { notes, beat, bar: barBeats(score.time) * beat, end: t, steps: step };
}

export type FallStatus = "ready" | "countIn" | "playing" | "paused" | "done";

export type PressResult = { kind: "hit"; note: FallNote } | { kind: "wrong" } | { kind: "ignored" };

export class FallingSession {
  status: FallStatus = "ready";
  /** Song seconds; negative during the count-in. */
  time = 0;
  perfect = 0;
  missing = 0;
  /** Practice: the step waiting to be played. */
  step = 0;
  readonly timeline: Timeline;
  private resumeTo: FallStatus = "playing";

  constructor(
    score: Score,
    public practice: boolean,
    public speed = 1,
  ) {
    this.timeline = buildTimeline(score);
    this.reset();
  }

  get notes(): FallNote[] {
    return this.timeline.notes;
  }

  /** Back to the start, before the count-in. */
  reset(): void {
    this.status = "ready";
    this.time = -this.timeline.bar;
    this.perfect = 0;
    this.missing = 0;
    this.step = 0;
    for (const n of this.notes) {
      n.state = "pending";
      n.judgedAt = undefined;
    }
  }

  start(): void {
    if (this.status === "ready" || this.status === "done") {
      this.reset();
      this.status = "countIn";
    } else if (this.status === "paused") {
      this.status = this.resumeTo;
    }
  }

  pause(): void {
    if (this.status === "countIn" || this.status === "playing") {
      this.resumeTo = this.status;
      this.status = "paused";
    }
  }

  get running(): boolean {
    return this.status === "countIn" || this.status === "playing";
  }

  /** Count-in beat (1-based) while counting in, else 0. */
  get countBeat(): number {
    if (this.status !== "countIn") return 0;
    return Math.floor((this.time + this.timeline.bar) / this.timeline.beat) + 1;
  }

  /** Start time of the practice step being waited for. */
  private stepTime(): number | null {
    const note = this.notes.find((n) => n.step === this.step);
    return note ? note.start : null;
  }

  /** Advance by `dt` real seconds. */
  update(dt: number): void {
    if (!this.running) return;
    let next = this.time + dt * this.speed;
    if (this.practice) {
      // Practice: the score stops with the waiting note at the bottom edge.
      const wait = this.stepTime();
      if (wait !== null && next > wait) next = Math.max(this.time, wait);
    }
    this.time = next;
    if (this.status === "countIn" && this.time >= 0) this.status = "playing";
    if (!this.practice) {
      const window = HIT_WINDOW * this.speed;
      for (const n of this.notes) {
        if (n.state === "pending" && this.time > n.start + window) {
          n.state = "missed";
          n.judgedAt = this.time;
          this.missing++;
        }
      }
    }
    const allJudged = this.practice ? this.step >= this.timeline.steps : this.notes.every((n) => n.state !== "pending");
    if (allJudged && this.time >= this.timeline.end + END_PAUSE) this.status = "done";
  }

  /** A key went down. */
  press(midi: number): PressResult {
    if (!this.running) return { kind: "ignored" };
    if (this.practice) {
      const note = this.notes.find((n) => n.step === this.step && n.midi === midi && n.state === "pending");
      if (!note) return { kind: "wrong" };
      this.judge(note);
      if (this.notes.every((n) => n.step !== this.step || n.state === "hit")) this.step++;
      return { kind: "hit", note };
    }
    const window = HIT_WINDOW * this.speed;
    let best: FallNote | null = null;
    for (const n of this.notes) {
      if (n.state !== "pending" || n.midi !== midi) continue;
      const off = Math.abs(n.start - this.time);
      if (off <= window && (!best || off < Math.abs(best.start - this.time))) best = n;
    }
    if (!best) return { kind: "wrong" };
    this.judge(best);
    this.perfect++;
    return { kind: "hit", note: best };
  }

  /** The step being played now: the practice step, or the first with a note still to come. */
  currentStep(): number {
    if (this.practice) return this.step;
    const next = this.notes.find((n) => n.state === "pending");
    return next ? next.step : this.timeline.steps;
  }

  /**
   * Jump back (or forward) to a step: its notes and everything after are to
   * play again, and the clock starts a little before it so its bar falls in.
   */
  seekStep(step: number, lead = 1.2): void {
    const target = Math.max(0, Math.min(this.timeline.steps, step));
    for (const n of this.notes) {
      if (n.step < target) {
        // Skipped forward over it: count as played in practice, leave as-is otherwise.
        if (this.practice && n.state === "pending") n.state = "hit";
        continue;
      }
      if (n.state === "hit" && !this.practice) this.perfect--;
      if (n.state === "missed") this.missing--;
      n.state = "pending";
      n.judgedAt = undefined;
    }
    this.step = target;
    const first = this.notes.find((n) => n.step === target);
    const start = first ? first.start : this.timeline.end;
    this.time = Math.max(-this.timeline.bar, start - lead * this.speed);
    if (this.status === "done") this.status = "playing";
  }

  private judge(note: FallNote): void {
    note.state = "hit";
    note.judgedAt = this.time;
  }
}
