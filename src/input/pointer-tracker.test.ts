import { describe, expect, it } from "vitest";
import { NoteHub } from "../core/note-hub";
import { PointerTracker } from "./pointer-tracker";

function setup() {
  const hub = new NoteHub();
  const events: string[] = [];
  hub.onNote((e) => events.push(`${e.type} ${e.midi}`));
  const pointers = new PointerTracker(hub, () => 90);
  return { hub, events, pointers };
}

describe("PointerTracker", () => {
  it("lets several fingers hold a chord", () => {
    const { hub, events, pointers } = setup();
    pointers.down(1, 48);
    pointers.down(2, 52);
    pointers.down(3, 55);
    expect([...hub.getSounding()].sort()).toEqual([48, 52, 55]);
    pointers.up(2);
    expect(events).toEqual(["on 48", "on 52", "on 55", "off 52"]);
  });

  it("plays each key a finger slides across", () => {
    const { events, pointers } = setup();
    pointers.down(1, 48);
    pointers.move(1, 48); // same key: nothing new
    pointers.move(1, 50);
    pointers.move(1, null); // slid off the keys
    pointers.move(1, 52);
    pointers.up(1);
    expect(events).toEqual(["on 48", "off 48", "on 50", "off 50", "on 52", "off 52"]);
  });

  it("keeps a note sounding while another finger still holds it", () => {
    const { events, pointers } = setup();
    pointers.down(1, 60);
    pointers.down(2, 60);
    pointers.up(1);
    expect(events).toEqual(["on 60"]);
    pointers.up(2);
    expect(events).toEqual(["on 60", "off 60"]);
  });

  it("ignores moves and ups from pointers it is not tracking", () => {
    const { events, pointers } = setup();
    pointers.move(7, 60);
    pointers.up(7);
    expect(events).toEqual([]);
  });

  it("cancelAll releases every finger", () => {
    const { hub, pointers } = setup();
    pointers.down(1, 48);
    pointers.down(2, 52);
    pointers.cancelAll();
    expect(hub.getSounding().size).toBe(0);
    expect(pointers.activeCount).toBe(0);
  });
});
