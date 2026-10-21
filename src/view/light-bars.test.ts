import { describe, expect, it } from "vitest";
import { LightBarModel, MIN_BAR_HEIGHT, barAlpha, barSpan, pitchHue } from "./light-bars";

describe("barSpan", () => {
  it("grows from the key while held", () => {
    expect(barSpan({ midi: 60, start: 0, end: null }, 1, 100)).toEqual({ bottom: 0, top: 100 });
  });

  it("detaches and rises after release, keeping its length", () => {
    const span = barSpan({ midi: 60, start: 0, end: 0.5 }, 2, 100);
    expect(span).toEqual({ bottom: 150, top: 200 });
  });

  it("gives short taps a minimum height", () => {
    const span = barSpan({ midi: 60, start: 0, end: 0.01 }, 0.01, 100);
    expect(span.top - span.bottom).toBe(MIN_BAR_HEIGHT);
  });
});

describe("barAlpha", () => {
  it("is opaque low down and fades near the top", () => {
    expect(barAlpha({ bottom: 0, top: 10 }, 100)).toBe(1);
    expect(barAlpha({ bottom: 80, top: 90 }, 100)).toBeCloseTo(0.5);
    expect(barAlpha({ bottom: 100, top: 110 }, 100)).toBe(0);
  });
});

describe("pitchHue", () => {
  it("gives the same colour to the same note in every octave", () => {
    expect(pitchHue(48)).toBe(pitchHue(60));
    expect(pitchHue(61)).not.toBe(pitchHue(60));
  });
});

describe("LightBarModel", () => {
  it("tracks held keys and prunes bars that left the screen", () => {
    const model = new LightBarModel();
    model.down(60, 0);
    expect(model.isHeld(60)).toBe(true);
    model.up(60, 0.2);
    expect(model.isHeld(60)).toBe(false);
    model.prune(1, 1000, 100);
    expect(model.bars).toHaveLength(1);
    model.prune(20, 1000, 100);
    expect(model.isEmpty).toBe(true);
  });

  it("starts a new bar when a key is struck again", () => {
    const model = new LightBarModel();
    model.down(60, 0);
    model.down(60, 1);
    expect(model.bars).toHaveLength(2);
    expect(model.bars[0].end).toBe(1);
  });
});
