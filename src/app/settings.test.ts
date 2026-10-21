import { describe, expect, it } from "vitest";
import { bindingError, defaultSettings, sanitize, withBinding } from "./settings";
import { detectLanguage } from "../i18n/strings";
import { DEFAULT_BINDINGS } from "../core/keymap";

describe("detectLanguage", () => {
  it("picks Chinese for zh locales and English otherwise", () => {
    expect(detectLanguage(["zh-CN", "en"])).toBe("zh");
    expect(detectLanguage(["zh-TW"])).toBe("zh");
    expect(detectLanguage(["en-US", "zh-CN"])).toBe("en");
    expect(detectLanguage([])).toBe("en");
  });
});

describe("bindings", () => {
  it("rejects note keys, modifiers and reserved keys", () => {
    expect(bindingError("KeyZ")).toBe("noteKey");
    expect(bindingError("Slash")).toBe("noteKey");
    expect(bindingError("ControlLeft")).toBe("modifier");
    expect(bindingError("Escape")).toBe("reserved");
    expect(bindingError("F5")).toBe("reserved");
    expect(bindingError("Digit1")).toBeNull();
    expect(bindingError("ShiftLeft")).toBeNull();
  });

  it("moves a key instead of binding it twice", () => {
    const next = withBinding(DEFAULT_BINDINGS, "octaveUp2", "ShiftRight");
    expect(next.octaveUp2).toBe("ShiftRight");
    expect(next.octaveUp1).toBeNull();
  });
});

describe("sanitize", () => {
  const defaults = defaultSettings("en");

  it("falls back to defaults for junk", () => {
    expect(sanitize(null, defaults)).toEqual(defaults);
    expect(sanitize("nope", defaults)).toEqual(defaults);
  });

  it("keeps valid values and clamps or drops bad ones", () => {
    const s = sanitize(
      {
        instrumentId: "flute",
        volume: 5,
        velocity: 0,
        reverb: false,
        language: "zh",
        bindings: { sustain: "KeyZ", octaveUp2: "Digit2", octaveDown1: null },
      },
      defaults,
    );
    expect(s.instrumentId).toBe("flute");
    expect(s.volume).toBe(1);
    expect(s.velocity).toBe(1);
    expect(s.reverb).toBe(false);
    expect(s.language).toBe("zh");
    expect(s.bindings.sustain).toBe("Space"); // note key rejected
    expect(s.bindings.octaveUp2).toBe("Digit2");
    expect(s.bindings.octaveDown1).toBeNull();
  });

  it("turns effects off by default when reduced motion is requested", () => {
    expect(defaultSettings("en", true).effects).toBe(false);
    expect(defaultSettings("en", false).effects).toBe(true);
    expect(sanitize({ effects: false }, defaults).effects).toBe(false);
  });

  it("drops unknown instruments", () => {
    expect(sanitize({ instrumentId: "kazoo" }, defaults).instrumentId).toBe(defaults.instrumentId);
  });
});
