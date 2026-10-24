/** User settings, their defaults, validation and localStorage persistence. */
import { DEFAULT_INSTRUMENT_ID, findInstrument } from "../audio/instruments";
import { DEFAULT_BINDINGS, NOTE_KEYS, type BindableAction, type KeyBindings } from "../core/keymap";
import { SHORTCUT_CODES } from "../core/shortcuts";
import { detectLanguage, type Language } from "../i18n/strings";
import { PALETTE_IDS, type PaletteId } from "../view/palettes";
import { DEFAULT_SCORE_ID } from "../score/builtin-scores";

/** How the current score is shown on the glass. */
export const SCORE_VIEWS = ["off", "jianpu", "falling"] as const;
export type ScoreView = (typeof SCORE_VIEWS)[number];

/** Beats per jianpu line the player can choose (spec §11.2). */
export const BEATS_PER_LINE = [8, 12, 16, 20, 24, 32] as const;

export interface Settings {
  instrumentId: string;
  /** Master volume 0–1. */
  volume: number;
  /** MIDI velocity 1–127 used for keyboard and mouse notes. */
  velocity: number;
  reverb: boolean;
  /** Rising light-bar effect. */
  effects: boolean;
  /** Light-bar colour family. */
  lightPalette: PaletteId;
  /** Score display on the glass. */
  scoreView: ScoreView;
  /** Score shown, a built-in or library id. */
  scoreId: string;
  /** Show the computer key under each jianpu note. */
  scoreKeyHints: boolean;
  /** Beats on one jianpu line; every beat has the same width. */
  beatsPerLine: number;
  /** Show the score's lyrics under the jianpu. */
  scoreLyrics: boolean;
  /** Practice mode: the score waits for the right note. */
  practice: boolean;
  language: Language;
  bindings: KeyBindings;
  panelCollapsed: boolean;
  /** Version of the default key bindings the stored ones were made with. */
  bindingsRev: number;
}

/** 2: ±2 octave keys got defaults (A and '). */
export const BINDINGS_REV = 2;

export const STORAGE_KEY = "keytone.settings.v1";

export function defaultSettings(language: Language, reducedMotion = false, smallTouchScreen = false): Settings {
  return {
    instrumentId: DEFAULT_INSTRUMENT_ID,
    volume: 0.8,
    velocity: 100,
    reverb: true,
    effects: !reducedMotion,
    lightPalette: "aurora",
    scoreView: "off",
    scoreId: DEFAULT_SCORE_ID,
    scoreKeyHints: true,
    beatsPerLine: 16,
    scoreLyrics: true,
    practice: false,
    language,
    bindings: { ...DEFAULT_BINDINGS },
    // Phones start with the panel tucked away so the keys get the room.
    panelCollapsed: smallTouchScreen,
    bindingsRev: BINDINGS_REV,
  };
}

/** Why a key can't be bound, or null if it can. */
export type BindingError = "noteKey" | "modifier" | "reserved" | "shortcut";

const MODIFIER_CODES = /^(Control|Alt|Meta|OS)(Left|Right)$/;
const RESERVED_CODES = new Set(["Escape", "Tab", "CapsLock", "ContextMenu"]);

export function bindingError(code: string): BindingError | null {
  if (!code || code === "Unidentified") return "reserved";
  if (NOTE_KEYS[code] !== undefined) return "noteKey";
  if (MODIFIER_CODES.test(code)) return "modifier";
  if (SHORTCUT_CODES.has(code)) return "shortcut";
  if (RESERVED_CODES.has(code) || /^F\d+$/.test(code)) return "reserved";
  return null;
}

/** Bind a key to an action. A key bound elsewhere is moved, never duplicated. */
export function withBinding(bindings: KeyBindings, action: BindableAction, code: string | null): KeyBindings {
  const next = { ...bindings };
  if (code !== null) {
    for (const other of Object.keys(next) as BindableAction[]) {
      if (next[other] === code) next[other] = null;
    }
  }
  next[action] = code;
  return next;
}

/** Merge stored data over defaults, dropping anything malformed. */
export function sanitize(raw: unknown, defaults: Settings): Settings {
  if (!raw || typeof raw !== "object") return defaults;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

  let bindings = { ...defaults.bindings };
  if (r.bindings && typeof r.bindings === "object") {
    const b = r.bindings as Record<string, unknown>;
    for (const action of Object.keys(bindings) as BindableAction[]) {
      const code = b[action];
      // Settings saved before ±2 had defaults stored null there: give them the
      // new defaults (unless that key is already used for something else).
      const oldUnset = code === null && (typeof r.bindingsRev === "number" ? r.bindingsRev : 1) < 2 && (action === "octaveDown2" || action === "octaveUp2");
      if (oldUnset) {
        const fallback = DEFAULT_BINDINGS[action];
        const taken = Object.values(b).includes(fallback);
        if (!taken) continue;
      }
      if (code === null) bindings = withBinding(bindings, action, null);
      else if (typeof code === "string" && bindingError(code) === null) {
        bindings = withBinding(bindings, action, code);
      }
    }
  }

  return {
    instrumentId:
      typeof r.instrumentId === "string" && findInstrument(r.instrumentId) ? r.instrumentId : defaults.instrumentId,
    volume: num(r.volume, 0, 1, defaults.volume),
    velocity: Math.round(num(r.velocity, 1, 127, defaults.velocity)),
    reverb: typeof r.reverb === "boolean" ? r.reverb : defaults.reverb,
    effects: typeof r.effects === "boolean" ? r.effects : defaults.effects,
    lightPalette: PALETTE_IDS.includes(r.lightPalette as PaletteId)
      ? (r.lightPalette as PaletteId)
      : defaults.lightPalette,
    scoreView: SCORE_VIEWS.includes(r.scoreView as ScoreView) ? (r.scoreView as ScoreView) : defaults.scoreView,
    scoreId: typeof r.scoreId === "string" && r.scoreId ? r.scoreId : defaults.scoreId,
    scoreKeyHints: typeof r.scoreKeyHints === "boolean" ? r.scoreKeyHints : defaults.scoreKeyHints,
    beatsPerLine: (BEATS_PER_LINE as readonly unknown[]).includes(r.beatsPerLine)
      ? (r.beatsPerLine as number)
      : defaults.beatsPerLine,
    scoreLyrics: typeof r.scoreLyrics === "boolean" ? r.scoreLyrics : defaults.scoreLyrics,
    practice: typeof r.practice === "boolean" ? r.practice : defaults.practice,
    language: r.language === "en" || r.language === "zh" ? r.language : defaults.language,
    bindings,
    panelCollapsed: typeof r.panelCollapsed === "boolean" ? r.panelCollapsed : defaults.panelCollapsed,
    bindingsRev: BINDINGS_REV,
  };
}

/** localStorage can be missing or throw (private mode, blocked storage). */
function storage(): globalThis.Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSettings(
  browserLanguages: readonly string[],
  reducedMotion: boolean,
  smallTouchScreen = false,
): Settings {
  const defaults = defaultSettings(detectLanguage(browserLanguages), reducedMotion, smallTouchScreen);
  try {
    const text = storage()?.getItem(STORAGE_KEY);
    return text ? sanitize(JSON.parse(text), defaults) : defaults;
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore: settings just won't persist.
  }
}
