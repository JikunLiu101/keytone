import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuditioner } from "./audition";
import { NoteHub } from "./note-hub";

describe("createAuditioner", () => {
  let hub: NoteHub;
  let events: string[];
  beforeEach(() => {
    vi.useFakeTimers();
    hub = new NoteHub();
    events = [];
    hub.onNote((e) => events.push(`${e.type}:${e.midi}`));
  });
  afterEach(() => vi.useRealTimers());

  it("sounds a note for a moment", () => {
    const audition = createAuditioner(hub, () => 100, 320);
    audition([48]);
    expect(events).toEqual(["on:48"]);
    vi.advanceTimersByTime(320);
    expect(events).toEqual(["on:48", "off:48"]);
  });

  it("sounds the same note again when it is entered twice quickly", () => {
    const audition = createAuditioner(hub, () => 100, 320);
    audition([48]);
    vi.advanceTimersByTime(100);
    audition([48]);
    expect(events).toEqual(["on:48", "off:48", "on:48"]);
    // The first note's timer must not cut the second one short.
    vi.advanceTimersByTime(250);
    expect(events).toEqual(["on:48", "off:48", "on:48"]);
    vi.advanceTimersByTime(70);
    expect(events).toEqual(["on:48", "off:48", "on:48", "off:48"]);
  });
});
