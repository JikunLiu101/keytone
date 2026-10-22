import { describe, expect, it } from "vitest";
import { noteColour, rgba, samplePalette } from "./palettes";

const luminance = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

describe("palettes", () => {
  it("gets brighter from low to high notes", () => {
    for (const id of ["aurora", "amber"] as const) {
      const low = noteColour(id, 24, 24, 88).glow;
      const high = noteColour(id, 88, 24, 88).glow;
      expect(luminance(high)).toBeGreaterThan(luminance(low));
    }
  });

  it("keeps aurora cool and amber warm", () => {
    const aurora = samplePalette("aurora", 0.5);
    const amber = samplePalette("amber", 0.5);
    expect(aurora.b).toBeGreaterThan(aurora.r);
    expect(amber.r).toBeGreaterThan(amber.b);
  });

  it("separates the notes of a chord", () => {
    const c = noteColour("aurora", 60, 24, 88).glow;
    const e = noteColour("aurora", 64, 24, 88).glow;
    expect(c).not.toEqual(e);
  });

  it("clamps positions outside the range", () => {
    expect(samplePalette("amber", -1)).toEqual(samplePalette("amber", 0));
    expect(samplePalette("amber", 2)).toEqual(samplePalette("amber", 1));
  });

  it("formats rgba strings", () => {
    expect(rgba({ r: 1.4, g: 2, b: 3 }, 2)).toBe("rgba(1, 2, 3, 1.000)");
  });
});
