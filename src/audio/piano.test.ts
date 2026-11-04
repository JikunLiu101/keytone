import { describe, expect, it, vi } from "vitest";
import { INSTRUMENTS } from "./instruments";

// Options each grand piano was created with.
const pianoOptions = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("smplr", () => {
  class Fake {
    ready = Promise.resolve();
    start() {
      return () => {};
    }
    dispose() {}
  }
  return {
    ElectricPiano: Fake,
    Mallet: Fake,
    Soundfont: Fake,
    SplendidGrandPiano: class extends Fake {
      constructor(_context: unknown, options: Record<string, unknown>) {
        super();
        pianoOptions.push(options);
      }
    },
  };
});

describe("grand piano", () => {
  it("lets a released note fade over 1.2 s (spec §13.5)", () => {
    INSTRUMENTS[0].create({} as AudioContext, {} as AudioNode);
    expect(pianoOptions.at(-1)?.decayTime).toBe(1.2);
  });
});
