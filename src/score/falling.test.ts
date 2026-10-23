import { describe, expect, it } from "vitest";
import { FallingSession, HIT_WINDOW, buildTimeline } from "./falling";
import { parseScore } from "./score";

const score = (notes: string, header = "tempo: 60\n") => parseScore(`${header}---\n${notes}`).score;

/** Run the count-in and then `seconds` of song time at speed 1. */
function playTo(session: FallingSession, seconds: number): void {
  session.start();
  session.update(session.timeline.bar + seconds);
}

describe("buildTimeline", () => {
  it("times notes in seconds and skips rests", () => {
    const t = buildTimeline(score("1 0 3/ 5 -"));
    expect(t.notes.map((n) => [n.midi, n.start, n.end, n.step])).toEqual([
      [48, 0, 1, 0],
      [52, 2, 2.5, 1],
      [55, 2.5, 4.5, 2],
    ]);
    expect(t.beat).toBe(1);
    expect(t.bar).toBe(4);
    expect(t.end).toBe(4.5);
  });

  it("gives each chord note its own bar on one step", () => {
    const t = buildTimeline(score("[1 3 5]"));
    expect(t.notes.map((n) => n.step)).toEqual([0, 0, 0]);
  });
});

describe("FallingSession", () => {
  it("counts in for one bar, then plays", () => {
    const s = new FallingSession(score("1 2 3 4"), false);
    s.start();
    expect(s.status).toBe("countIn");
    s.update(1.2);
    expect(s.countBeat).toBe(2);
    s.update(3);
    expect(s.status).toBe("playing");
  });

  it("hits within the window and calls the rest wrong", () => {
    const s = new FallingSession(score("1 2"), false);
    playTo(s, 0.9);
    expect(s.press(48).kind).toBe("wrong"); // 0.9 s late
    expect(s.press(50).kind).toBe("hit"); // 0.1 s early
    expect(s.perfect).toBe(1);
  });

  it("marks notes nobody played as missing and finishes", () => {
    const s = new FallingSession(score("1 2"), false);
    playTo(s, HIT_WINDOW + 0.55); // past the first note, 0.2 s before the second
    expect(s.missing).toBe(1);
    s.press(50);
    s.update(2);
    expect(s.status).toBe("done");
    expect([s.perfect, s.missing]).toEqual([1, 1]);
  });

  it("keeps the window the same in real time at other speeds", () => {
    const s = new FallingSession(score("1"), false, 0.5);
    s.start();
    s.update(s.timeline.bar / 0.5 - 0.2); // 0.2 s real before the note
    expect(s.press(48).kind).toBe("hit");
  });

  it("practice waits for the right note and never misses", () => {
    const s = new FallingSession(score("1 2"), true);
    playTo(s, 5);
    expect(s.time).toBe(0);
    expect(s.press(52).kind).toBe("wrong");
    expect(s.press(48).kind).toBe("hit");
    s.update(5);
    expect(s.time).toBe(1);
    s.press(50);
    s.update(5);
    expect(s.status).toBe("done");
    expect(s.missing).toBe(0);
  });

  it("practice needs every note of a chord", () => {
    const s = new FallingSession(score("[1 3] 2"), true);
    playTo(s, 0);
    s.press(48);
    expect(s.step).toBe(0);
    s.press(52);
    expect(s.step).toBe(1);
  });

  it("pauses, resumes and restarts", () => {
    const s = new FallingSession(score("1 2"), false);
    playTo(s, 0.5);
    s.pause();
    s.update(10);
    expect(s.time).toBe(0.5);
    s.start();
    expect(s.status).toBe("playing");
    s.reset();
    expect([s.status, s.time]).toEqual(["ready", -4]);
  });

  it("ignores keys when not running", () => {
    expect(new FallingSession(score("1"), false).press(48).kind).toBe("ignored");
  });
});
