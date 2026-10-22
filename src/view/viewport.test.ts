import { describe, expect, it } from "vitest";
import { clampScroll, defaultScroll, scrollForPointer, shouldUseCompact } from "./viewport";

describe("shouldUseCompact", () => {
  it("uses compact mode on a landscape phone", () => {
    expect(shouldUseCompact(true, 844, 345, 38)).toBe(true);
  });

  it("uses compact mode on a portrait tablet", () => {
    expect(shouldUseCompact(true, 768, 760, 38)).toBe(true);
  });

  it("keeps the full keyboard on desktop, even when keys are small", () => {
    expect(shouldUseCompact(false, 1024, 560, 38)).toBe(false);
  });

  it("keeps the full keyboard on a touch screen that fits finger-size keys", () => {
    expect(shouldUseCompact(true, 1920, 900, 38)).toBe(false);
  });
});

describe("window scrolling", () => {
  it("clamps the window inside the keyboard", () => {
    expect(clampScroll(-3, 15, 38)).toBe(0);
    expect(clampScroll(30, 15, 38)).toBe(23);
    expect(clampScroll(5, 40, 38)).toBe(0);
  });

  it("centres the window where the mini keyboard is touched", () => {
    expect(scrollForPointer(0.5, 10, 38)).toBe(14);
    expect(scrollForPointer(0, 10, 38)).toBe(0);
    expect(scrollForPointer(1, 10, 38)).toBe(28);
  });

  it("starts at C3, the computer keyboard's home", () => {
    expect(defaultScroll(15, 38)).toBe(14);
    expect(defaultScroll(25, 38)).toBe(9);
  });
});
