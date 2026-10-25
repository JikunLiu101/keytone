import { describe, expect, it, vi } from "vitest";
import type { NoteHub } from "../core/note-hub";
import { AudioEngine } from "./audio-engine";

// Instruments that fail to load in these tests.
const failing = vi.hoisted(() => new Set<string>());

vi.mock("smplr", () => ({
  Reverb: class {
    ready() {
      return new Promise(() => {});
    }
  },
}));
vi.mock("./mobile-audio", () => ({ primeMediaPlayback: () => {} }));
vi.mock("./instruments", () => ({
  findInstrument: (id: string) => ({
    id,
    create: () => ({
      ready: failing.has(id) ? Promise.reject(new Error("offline")) : Promise.resolve(),
      start: () => () => {},
      dispose: () => {},
    }),
  }),
}));

class FakeAudioContext {
  state = "suspended";
  currentTime = 0;
  destination = {};
  createGain() {
    return { connect() {}, gain: { value: 1, setTargetAtTime() {} } };
  }
  addEventListener() {}
  resume() {
    return Promise.resolve();
  }
}
vi.stubGlobal("AudioContext", FakeAudioContext);

const fakeHub = { onNote: () => () => {} } as unknown as NoteHub;

describe("AudioEngine.setInstrument", () => {
  it("clears a load error when the player goes back to the instrument still playing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const engine = new AudioEngine(fakeHub);
    await engine.setInstrument("violin");
    failing.add("harmonica");
    await engine.setInstrument("harmonica");
    expect(engine.getStatus()).toMatchObject({ currentId: "violin", errorId: "harmonica" });

    await engine.setInstrument("violin");
    expect(engine.getStatus()).toMatchObject({ currentId: "violin", loadingId: null, errorId: null });
  });
});
