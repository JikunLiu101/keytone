import { ElectricPiano, Mallet, Soundfont, SplendidGrandPiano, type Smplr } from "smplr";
import type { MessageKey } from "../i18n/strings";

/** What the audio engine needs from any sound back end. */
export interface InstrumentBackend {
  /** Resolves when samples are loaded and the instrument can play. */
  ready: Promise<void>;
  start(midi: number, velocity: number): () => void;
  dispose(): void;
}

export type CreditId = "splendid" | "gregSullivan" | "vcsl" | "fluidR3";

export interface InstrumentDef {
  id: string;
  /** i18n key of the display name. */
  nameKey: MessageKey;
  credit: CreditId;
  create(context: AudioContext, destination: AudioNode): InstrumentBackend;
}

export interface Credit {
  name: string;
  author: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
}

export const CREDITS: Readonly<Record<CreditId, Credit>> = {
  splendid: {
    name: "Splendid Grand Piano",
    author: "AKAI Steinway samples, via sfzinstruments",
    license: "Public domain",
    licenseUrl: "https://github.com/sfzinstruments/SplendidGrandPiano",
    sourceUrl: "https://github.com/smpldsnds/sfzinstruments-splendid-grand-piano",
  },
  gregSullivan: {
    name: "Greg Sullivan E-Pianos",
    author: "Greg Sullivan",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://github.com/smpldsnds/sfzinstruments-greg-sullivan-e-pianos",
  },
  vcsl: {
    name: "Versilian Community Sample Library (VCSL)",
    author: "Versilian Studios / Sam Gossner",
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    sourceUrl: "https://github.com/sgossner/VCSL",
  },
  fluidR3: {
    name: "FluidR3_GM",
    author: "Frank Wen, via gleitz/midi-js-soundfonts",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    sourceUrl: "https://github.com/gleitz/midi-js-soundfonts",
  },
};

/**
 * Optional sample-host overrides. Leave undefined to use smplr's public hosts;
 * set them to serve samples from your own server or bucket.
 */
export const SAMPLE_HOSTS: {
  /** Base URL of a Splendid Grand Piano sample folder. */
  splendidGrandPiano?: string;
  /** Builds the URL of a FluidR3_GM instrument file, e.g. `${base}/${name}-ogg.js`. */
  soundfontUrl?: (name: string) => string;
} = {};

/** Wrap a smplr instrument in the InstrumentBackend interface. */
function fromSmplr(inst: Smplr): InstrumentBackend {
  return {
    ready: inst.ready,
    start: (midi, velocity) => inst.start({ note: midi, velocity }),
    dispose: () => inst.dispose(),
  };
}

function soundfont(id: string, nameKey: MessageKey, gmName: string): InstrumentDef {
  return {
    id,
    nameKey,
    credit: "fluidR3",
    create: (context, destination) =>
      fromSmplr(
        new Soundfont(context, {
          destination,
          kit: "FluidR3_GM",
          instrument: gmName,
          ...(SAMPLE_HOSTS.soundfontUrl ? { instrumentUrl: SAMPLE_HOSTS.soundfontUrl(gmName) } : {}),
        }),
      ),
  };
}

function electricPiano(id: string, nameKey: MessageKey, name: string, credit: CreditId): InstrumentDef {
  return {
    id,
    nameKey,
    credit,
    create: (context, destination) => fromSmplr(new ElectricPiano(context, { destination, instrument: name })),
  };
}

function mallet(id: string, nameKey: MessageKey, name: string): InstrumentDef {
  return {
    id,
    nameKey,
    credit: "vcsl",
    create: (context, destination) => fromSmplr(new Mallet(context, { destination, instrument: name })),
  };
}

export const INSTRUMENTS: readonly InstrumentDef[] = [
  {
    id: "grand-piano",
    nameKey: "inst.grandPiano",
    credit: "splendid",
    create: (context, destination) =>
      fromSmplr(
        new SplendidGrandPiano(context, {
          destination,
          ...(SAMPLE_HOSTS.splendidGrandPiano ? { baseUrl: SAMPLE_HOSTS.splendidGrandPiano } : {}),
        }),
      ),
  },
  electricPiano("wurlitzer", "inst.wurlitzer", "WurlitzerEP200", "gregSullivan"),
  electricPiano("cp80", "inst.cp80", "CP80", "gregSullivan"),
  electricPiano("fm-piano", "inst.fmPiano", "TX81Z", "vcsl"),
  soundfont("drawbar-organ", "inst.drawbarOrgan", "drawbar_organ"),
  soundfont("church-organ", "inst.churchOrgan", "church_organ"),
  soundfont("harpsichord", "inst.harpsichord", "harpsichord"),
  soundfont("strings", "inst.strings", "string_ensemble_1"),
  soundfont("choir", "inst.choir", "choir_aahs"),
  soundfont("flute", "inst.flute", "flute"),
  soundfont("brass", "inst.brass", "brass_section"),
  soundfont("nylon-guitar", "inst.nylonGuitar", "acoustic_guitar_nylon"),
  mallet("vibraphone", "inst.vibraphone", "Vibraphone - Soft Mallets"),
  mallet("xylophone", "inst.xylophone", "Xylophone - Medium Mallets"),
  soundfont("music-box", "inst.musicBox", "music_box"),
  soundfont("synth-lead", "inst.synthLead", "lead_2_sawtooth"),
  soundfont("synth-pad", "inst.synthPad", "pad_2_warm"),
];

export const DEFAULT_INSTRUMENT_ID = "grand-piano";

export function findInstrument(id: string): InstrumentDef | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}
