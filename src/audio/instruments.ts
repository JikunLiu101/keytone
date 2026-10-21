import { SplendidGrandPiano, type Smplr } from "smplr";

/** What the audio engine needs from any sound back end. */
export interface InstrumentBackend {
  /** Resolves when samples are loaded and the instrument can play. */
  ready: Promise<void>;
  start(midi: number, velocity: number): () => void;
  dispose(): void;
}

export interface InstrumentDef {
  id: string;
  /** English display name. Translations come with i18n in M2. */
  name: string;
  create(context: AudioContext, destination: AudioNode): InstrumentBackend;
}

/** Wrap a smplr instrument in the InstrumentBackend interface. */
function fromSmplr(inst: Smplr): InstrumentBackend {
  return {
    ready: inst.ready,
    start: (midi, velocity) => inst.start({ note: midi, velocity }),
    dispose: () => inst.dispose(),
  };
}

/**
 * Sample base URLs. smplr's public hosts are used by default; change these to
 * point at self-hosted copies of the samples.
 */
export const SAMPLE_URLS = {
  splendidGrandPiano: undefined as string | undefined,
};

export const INSTRUMENTS: readonly InstrumentDef[] = [
  {
    id: "grand-piano",
    name: "Grand Piano",
    create: (context, destination) =>
      fromSmplr(
        new SplendidGrandPiano(context, {
          destination,
          ...(SAMPLE_URLS.splendidGrandPiano ? { baseUrl: SAMPLE_URLS.splendidGrandPiano } : {}),
        }),
      ),
  },
];

export const DEFAULT_INSTRUMENT_ID = "grand-piano";
