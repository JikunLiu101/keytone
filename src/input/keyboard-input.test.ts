import { describe, expect, it } from "vitest";
import { fromInputMethod } from "./keyboard-input";

describe("fromInputMethod", () => {
  it("is true while composing, and for the key that ends a composition in Safari", () => {
    expect(fromInputMethod({ isComposing: true, keyCode: 27 })).toBe(true);
    // Safari sends Esc after compositionend: isComposing is false, keyCode is 229.
    expect(fromInputMethod({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(fromInputMethod({ isComposing: false, keyCode: 27 })).toBe(false);
  });
});
