import { describe, expect, it } from "vitest";
import { FAMILIES, INSTRUMENTS, familyPlace, findInstrument, listMove, stepInstrument } from "./instruments";

describe("instruments", () => {
  it("has 21 instruments with unique ids, keeping every id from before version 5", () => {
    expect(INSTRUMENTS).toHaveLength(21);
    expect(new Set(INSTRUMENTS.map((i) => i.id)).size).toBe(21);
    const before = [
      "grand-piano", "wurlitzer", "cp80", "fm-piano", "drawbar-organ", "church-organ", "harpsichord",
      "strings", "choir", "flute", "brass", "nylon-guitar", "vibraphone", "xylophone", "music-box",
      "synth-lead", "synth-pad",
    ];
    for (const id of before) expect(findInstrument(id)).toBeDefined();
  });

  it("groups them into six families in the spec's order", () => {
    const byFamily = FAMILIES.map((f) => [f.id, INSTRUMENTS.filter((i) => i.family === f.id).map((i) => i.id)]);
    expect(byFamily).toEqual([
      ["pianos", ["grand-piano", "wurlitzer", "cp80", "fm-piano"]],
      ["organs", ["drawbar-organ", "church-organ", "harpsichord"]],
      ["strings", ["violin", "viola", "cello", "strings"]],
      ["winds", ["flute", "brass", "harmonica"]],
      ["plucked", ["nylon-guitar", "vibraphone", "xylophone", "music-box"]],
      ["voice", ["choir", "synth-lead", "synth-pad"]],
    ]);
  });

  it("lists instruments family by family, so stepping walks the families in order", () => {
    const order = FAMILIES.flatMap((f) => INSTRUMENTS.filter((i) => i.family === f.id).map((i) => i.id));
    expect(INSTRUMENTS.map((i) => i.id)).toEqual(order);
  });
});

describe("stepInstrument", () => {
  it("steps to the next or previous instrument and wraps at the ends", () => {
    expect(stepInstrument("grand-piano", 1).id).toBe("wurlitzer");
    expect(stepInstrument("cello", 1).id).toBe("strings");
    expect(stepInstrument("grand-piano", -1).id).toBe("synth-pad");
    expect(stepInstrument("synth-pad", 1).id).toBe("grand-piano");
  });

  it("starts from the first instrument for an unknown id", () => {
    expect(stepInstrument("nope", 1).id).toBe("wurlitzer");
  });
});

describe("familyPlace", () => {
  it("gives the family and the 1-based place in it", () => {
    expect(familyPlace("violin")).toEqual({ family: "strings", index: 1, count: 4 });
    expect(familyPlace("harmonica")).toEqual({ family: "winds", index: 3, count: 3 });
    expect(familyPlace("grand-piano")).toEqual({ family: "pianos", index: 1, count: 4 });
  });
});

describe("listMove", () => {
  // Columns of 4, 3, 4 items.
  const columns = [4, 3, 4];

  it("moves up and down within a column, stopping at its ends", () => {
    expect(listMove(columns, { col: 0, row: 1 }, "ArrowDown")).toEqual({ col: 0, row: 2 });
    expect(listMove(columns, { col: 0, row: 3 }, "ArrowDown")).toEqual({ col: 0, row: 3 });
    expect(listMove(columns, { col: 0, row: 0 }, "ArrowUp")).toEqual({ col: 0, row: 0 });
  });

  it("moves left and right between columns, keeping the row where it can", () => {
    expect(listMove(columns, { col: 0, row: 1 }, "ArrowRight")).toEqual({ col: 1, row: 1 });
    expect(listMove(columns, { col: 0, row: 3 }, "ArrowRight")).toEqual({ col: 1, row: 2 });
    expect(listMove(columns, { col: 2, row: 0 }, "ArrowRight")).toEqual({ col: 2, row: 0 });
    expect(listMove(columns, { col: 0, row: 2 }, "ArrowLeft")).toEqual({ col: 0, row: 2 });
  });
});
