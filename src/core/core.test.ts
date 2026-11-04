import { describe, expect, it } from "vitest";
import { NoteHub, type NoteEvent } from "./note-hub";
import { KeyboardController } from "./keyboard-controller";
import { DEFAULT_BINDINGS, type KeyBindings } from "./keymap";
import { BASE_MIDI, RANGE_HIGH, RANGE_LOW, noteName, octaveC, playableRange, rangeLabel } from "./notes";
import { createDerived, createStore } from "./store";
import { computerKeyLabels } from "../view/layout";

function setup(bindings: KeyBindings = { ...DEFAULT_BINDINGS }, base: () => number = () => 48) {
  const hub = new NoteHub();
  const events: string[] = [];
  hub.onNote((e: NoteEvent) => events.push(`${e.type} ${noteName(e.midi)}`));
  const keys = new KeyboardController(hub, { getBindings: () => bindings, getVelocity: () => 100, getBase: base });
  return { hub, keys, events };
}

describe("notes", () => {
  it("covers C1–E6", () => {
    expect(noteName(RANGE_LOW)).toBe("C1");
    expect(noteName(RANGE_HIGH)).toBe("E6");
  });

  it("gives a playable range of 65 keys from Z two octaves down to / two octaves up, at every base", () => {
    const names = [2, 3, 4, 5].map((o) => playableRange(octaveC(o))).map((r) => [noteName(r.low), noteName(r.high), r.high - r.low]);
    expect(names).toEqual([
      ["C0", "E5", 64],
      ["C1", "E6", 64],
      ["C2", "E7", 64],
      ["C3", "E8", 64],
    ]);
  });
});

describe("rangeLabel", () => {
  it("names the playable range at a base, for messages", () => {
    expect(rangeLabel(octaveC(4))).toBe("C2–E7");
    expect(rangeLabel(BASE_MIDI)).toBe("C1–E6");
  });
});

describe("computerKeyLabels", () => {
  it("labels the keys from the base and the octave shift", () => {
    expect(computerKeyLabels(0, 60).get(60)).toBe("Z");
    expect(computerKeyLabels(1, 60).get(72)).toBe("Z");
  });
});

describe("createDerived", () => {
  it("notifies once per change of the computed value, not on every source change", () => {
    const a = createStore({ n: 1 });
    const b = createStore({ on: false });
    const derived = createDerived(() => (b.get().on ? a.get().n * 10 : 0), [a, b]);
    let calls = 0;
    derived.subscribe(() => calls++);
    a.set({ n: 2 });
    expect([derived.get(), calls]).toEqual([0, 0]);
    b.set({ on: true });
    expect([derived.get(), calls]).toEqual([20, 1]);
    a.set({ n: 3 });
    expect([derived.get(), calls]).toEqual([30, 2]);
    b.set({ on: true });
    expect(calls).toBe(2);
  });
});

describe("KeyboardController", () => {
  it("plays from the base", () => {
    const { keys, events } = setup(undefined, () => 60);
    keys.keyDown("KeyZ");
    keys.keyDown("Slash");
    expect(events).toEqual(["on C4", "on E5"]);
  });

  it("is not cut to the piano's range", () => {
    const { keys, events } = setup(undefined, () => 72);
    keys.keyDown("Quote");
    keys.keyDown("Slash");
    expect(events).toEqual(["on E8"]);
  });

  it("keeps a held note's pitch when the base changes", () => {
    let base = 48;
    const { keys, events } = setup(undefined, () => base);
    keys.keyDown("KeyZ");
    base = 60;
    keys.keyUp("KeyZ");
    expect(events).toEqual(["on C3", "off C3"]);
  });

  it("maps the bottom row to C3–E4", () => {
    const { keys, events } = setup();
    for (const code of ["KeyZ", "KeyS", "KeyM", "Comma", "KeyL", "Period", "Semicolon", "Slash"]) {
      keys.keyDown(code);
    }
    expect(events).toEqual(["on C3", "on C#3", "on B3", "on C4", "on C#4", "on D4", "on D#4", "on E4"]);
  });

  it("ignores unmapped keys and auto-repeat", () => {
    const { keys, events } = setup();
    expect(keys.keyDown("KeyQ")).toBe(false);
    keys.keyDown("KeyZ");
    keys.keyDown("KeyZ", true);
    expect(events).toEqual(["on C3"]);
  });

  it("shifts octaves only while the octave key is held", () => {
    const { keys, events } = setup();
    keys.keyDown("ShiftRight");
    keys.keyDown("KeyZ");
    keys.keyUp("ShiftRight");
    keys.keyDown("KeyX");
    expect(events).toEqual(["on C4", "on D3"]);
  });

  it("keeps a note's pitch fixed after the octave changes", () => {
    const { keys, events } = setup();
    keys.keyDown("KeyZ");
    keys.keyDown("ShiftLeft");
    keys.keyUp("KeyZ");
    expect(events).toEqual(["on C3", "off C3"]);
  });

  it("cancels left and right Shift, and clamps to ±2", () => {
    const bindings = { ...DEFAULT_BINDINGS, octaveUp2: "Digit2" };
    const { keys } = setup(bindings);
    keys.keyDown("ShiftLeft");
    keys.keyDown("ShiftRight");
    expect(keys.getOctaveShift()).toBe(0);
    keys.keyUp("ShiftLeft");
    keys.keyDown("Digit2");
    expect(keys.getOctaveShift()).toBe(2);
    keys.keyUp("ShiftRight");
    expect(keys.getOctaveShift()).toBe(2);
  });

  it("releases an octave key even if bindings changed while it was held", () => {
    const bindings: KeyBindings = { ...DEFAULT_BINDINGS };
    const { keys } = setup(bindings);
    keys.keyDown("ShiftRight");
    bindings.octaveUp1 = "Digit1";
    keys.keyUp("ShiftRight");
    expect(keys.getOctaveShift()).toBe(0);
  });

  it("recovers a stuck Shift when the browser says Shift is up", () => {
    const { keys, events } = setup();
    keys.keyDown("ShiftRight");
    // The keyup for ShiftRight was lost; the next key arrives with shiftKey = false.
    keys.syncShift(false, "KeyZ");
    keys.keyDown("KeyZ");
    expect(keys.getOctaveShift()).toBe(0);
    expect(events).toEqual(["on C3"]);
    // While Shift really is held, nothing is released.
    keys.keyDown("ShiftLeft");
    keys.syncShift(true, "KeyX");
    expect(keys.getOctaveShift()).toBe(-1);
  });

  it("reset releases everything", () => {
    const { keys, hub, events } = setup();
    keys.keyDown("Space");
    keys.keyDown("KeyZ");
    keys.keyDown("ShiftRight");
    keys.reset();
    expect(keys.getOctaveShift()).toBe(0);
    expect(hub.getSounding().size).toBe(0);
    expect(events).toEqual(["on C3", "off C3"]);
  });
});

describe("NoteHub sustain", () => {
  it("defers note-off until the pedal is released", () => {
    const { keys, events } = setup();
    keys.keyDown("Space");
    keys.keyDown("KeyZ");
    keys.keyUp("KeyZ");
    expect(events).toEqual(["on C3"]);
    keys.keyUp("Space");
    expect(events).toEqual(["on C3", "off C3"]);
  });

  it("re-striking a sustained note restarts it", () => {
    const { keys, events } = setup();
    keys.keyDown("Space");
    keys.keyDown("KeyZ");
    keys.keyUp("KeyZ");
    keys.keyDown("KeyZ");
    expect(events).toEqual(["on C3", "off C3", "on C3"]);
  });

  it("keeps a note held by another source sounding", () => {
    const hub = new NoteHub();
    const events: string[] = [];
    hub.onNote((e) => events.push(e.type));
    hub.press("key:KeyZ", 48, 100);
    hub.press("pointer:1", 48, 100);
    hub.release("key:KeyZ", 48);
    expect(events).toEqual(["on"]);
    hub.release("pointer:1", 48);
    expect(events).toEqual(["on", "off"]);
  });
});

describe("NoteHub key events", () => {
  it("reports finger up immediately even while sustain holds the sound", () => {
    const hub = new NoteHub();
    const keys: string[] = [];
    const notes: string[] = [];
    hub.onKey((e) => keys.push(`${e.type} ${e.midi}`));
    hub.onNote((e) => notes.push(`${e.type} ${e.midi}`));
    hub.setSustain(true);
    hub.press("a", 60, 100);
    hub.release("a", 60);
    expect(keys).toEqual(["down 60", "up 60"]);
    expect(notes).toEqual(["on 60"]);
    hub.press("a", 60, 100);
    expect(keys).toEqual(["down 60", "up 60", "down 60"]);
  });

  it("emits one down/up pair when two sources hold the same note", () => {
    const hub = new NoteHub();
    const keys: string[] = [];
    hub.onKey((e) => keys.push(e.type));
    hub.press("a", 60, 100);
    hub.press("b", 60, 100);
    hub.release("a", 60);
    hub.release("b", 60);
    expect(keys).toEqual(["down", "up"]);
  });

  it("releaseAll lifts held keys", () => {
    const hub = new NoteHub();
    const keys: string[] = [];
    hub.onKey((e) => keys.push(e.type));
    hub.press("a", 60, 100);
    hub.releaseAll();
    expect(keys).toEqual(["down", "up"]);
  });
});

import { dynamicMark } from "./dynamics";

describe("dynamicMark", () => {
  it("maps velocity to a dynamic marking", () => {
    expect(dynamicMark(1)).toBe("ppp");
    expect(dynamicMark(64)).toBe("mp");
    expect(dynamicMark(80)).toBe("mf");
    expect(dynamicMark(89)).toBe("f");
    expect(dynamicMark(127)).toBe("fff");
  });
});
