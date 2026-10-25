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

export type FamilyId = "pianos" | "organs" | "strings" | "winds" | "plucked" | "voice";

/** Instrument families, in display order, for grouping the selector. */
export const FAMILIES: readonly { id: FamilyId; nameKey: MessageKey }[] = [
  { id: "pianos", nameKey: "family.pianos" },
  { id: "organs", nameKey: "family.organs" },
  { id: "strings", nameKey: "family.strings" },
  { id: "winds", nameKey: "family.winds" },
  { id: "plucked", nameKey: "family.plucked" },
  { id: "voice", nameKey: "family.voice" },
];

export interface InstrumentDef {
  id: string;
  /** i18n key of the display name. */
  nameKey: MessageKey;
  family: FamilyId;
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

function soundfont(id: string, nameKey: MessageKey, family: FamilyId, gmName: string): InstrumentDef {
  return {
    id,
    nameKey,
    family,
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
    family: "pianos",
    credit,
    create: (context, destination) => fromSmplr(new ElectricPiano(context, { destination, instrument: name })),
  };
}

function mallet(id: string, nameKey: MessageKey, name: string): InstrumentDef {
  return {
    id,
    nameKey,
    family: "plucked",
    credit: "vcsl",
    create: (context, destination) => fromSmplr(new Mallet(context, { destination, instrument: name })),
  };
}

/** Every instrument, family by family in display order (spec §12.3); `[` / `]` step through it. */
export const INSTRUMENTS: readonly InstrumentDef[] = [
  {
    id: "grand-piano",
    nameKey: "inst.grandPiano",
    family: "pianos",
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
  soundfont("drawbar-organ", "inst.drawbarOrgan", "organs", "drawbar_organ"),
  soundfont("church-organ", "inst.churchOrgan", "organs", "church_organ"),
  soundfont("harpsichord", "inst.harpsichord", "organs", "harpsichord"),
  soundfont("violin", "inst.violin", "strings", "violin"),
  soundfont("viola", "inst.viola", "strings", "viola"),
  soundfont("cello", "inst.cello", "strings", "cello"),
  soundfont("strings", "inst.strings", "strings", "string_ensemble_1"),
  soundfont("flute", "inst.flute", "winds", "flute"),
  soundfont("brass", "inst.brass", "winds", "brass_section"),
  // FluidR3's harmonica covers the whole keyboard; VCSL's recorded one starts at C3 (spec §12.2).
  soundfont("harmonica", "inst.harmonica", "winds", "harmonica"),
  soundfont("nylon-guitar", "inst.nylonGuitar", "plucked", "acoustic_guitar_nylon"),
  mallet("vibraphone", "inst.vibraphone", "Vibraphone - Soft Mallets"),
  mallet("xylophone", "inst.xylophone", "Xylophone - Medium Mallets"),
  soundfont("music-box", "inst.musicBox", "plucked", "music_box"),
  soundfont("choir", "inst.choir", "voice", "choir_aahs"),
  soundfont("synth-lead", "inst.synthLead", "voice", "lead_2_sawtooth"),
  soundfont("synth-pad", "inst.synthPad", "voice", "pad_2_warm"),
];

export const DEFAULT_INSTRUMENT_ID = "grand-piano";

export function findInstrument(id: string): InstrumentDef | undefined {
  return INSTRUMENTS.find((i) => i.id === id);
}

/**
 * The instrument the picker shows, and ▲ / ▼ and `[` / `]` step from: the one
 * loading, else the one playing (still the old one after a failed load), else
 * the setting.
 */
export function shownInstrumentId(status: { loadingId: string | null; currentId: string | null }, chosen: string): string {
  return status.loadingId ?? status.currentId ?? chosen;
}

/** The next (1) or previous (−1) instrument in display order, wrapping at the ends. */
export function stepInstrument(id: string, direction: 1 | -1): InstrumentDef {
  const i = Math.max(0, INSTRUMENTS.findIndex((x) => x.id === id));
  return INSTRUMENTS[(i + direction + INSTRUMENTS.length) % INSTRUMENTS.length];
}

/**
 * Arrow-key move in the instrument list, laid out as columns (one per family,
 * `columns[i]` items long): ↑ / ↓ stay in the column, ← / → change column and
 * keep the row where that column is long enough. Moves stop at the edges.
 */
export function listMove(
  columns: readonly number[],
  at: { col: number; row: number },
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
): { col: number; row: number } {
  const clampRow = (col: number, row: number) => Math.max(0, Math.min(columns[col] - 1, row));
  switch (key) {
    case "ArrowUp":
      return { col: at.col, row: clampRow(at.col, at.row - 1) };
    case "ArrowDown":
      return { col: at.col, row: clampRow(at.col, at.row + 1) };
    case "ArrowLeft":
    case "ArrowRight": {
      const col = Math.max(0, Math.min(columns.length - 1, at.col + (key === "ArrowLeft" ? -1 : 1)));
      return { col, row: clampRow(col, at.row) };
    }
  }
}

/** An instrument's family and its 1-based place in it, e.g. violin → strings, 1 of 4. */
export function familyPlace(id: string): { family: FamilyId; index: number; count: number } {
  const family = findInstrument(id)?.family ?? INSTRUMENTS[0].family;
  const members = INSTRUMENTS.filter((i) => i.family === family);
  return { family, index: Math.max(0, members.findIndex((i) => i.id === id)) + 1, count: members.length };
}
