/**
 * Light-bar colour palettes. Instead of a full rainbow, each palette is one
 * harmonious family; pitch moves along it (low notes deep, high notes
 * bright), with a small per-note offset so the notes of a chord still differ.
 * Pure functions, no DOM.
 */

export type PaletteId = "aurora" | "amber";

export const PALETTE_IDS: readonly PaletteId[] = ["aurora", "amber"];

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Gradient stops from the lowest to the highest note. */
const STOPS: Record<PaletteId, readonly Rgb[]> = {
  // Cool: deep violet → indigo → blue → cyan → ice. Echoes the LCD's cyan.
  aurora: [
    { r: 112, g: 74, b: 255 },
    { r: 84, g: 106, b: 255 },
    { r: 62, g: 150, b: 255 },
    { r: 86, g: 214, b: 255 },
    { r: 196, g: 244, b: 255 },
  ],
  // Warm: deep amber → amber → gold → pale gold → warm white. Echoes the felt and floor light.
  amber: [
    { r: 255, g: 110, b: 36 },
    { r: 255, g: 150, b: 52 },
    { r: 255, g: 196, b: 92 },
    { r: 255, g: 222, b: 150 },
    { r: 255, g: 240, b: 214 },
  ],
};

/** Small offset per pitch class (fraction of the gradient) so chord tones separate. */
const PITCH_CLASS_SHIFT = [0, 0.03, -0.02, 0.04, -0.03, 0.02, -0.04, 0.01, -0.01, 0.03, -0.02, 0.04];

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Sample a palette at position 0…1. */
export function samplePalette(id: PaletteId, position: number): Rgb {
  const stops = STOPS[id];
  const p = Math.max(0, Math.min(1, position)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  return mix(stops[i], stops[i + 1], p - i);
}

export interface NoteColour {
  /** Saturated colour for glow and bloom. */
  glow: Rgb;
  /** Bright, near-white tint for the filament at the bar's centre. */
  core: Rgb;
}

/** Colour of a note within the playable range [low, high]. */
export function noteColour(id: PaletteId, midi: number, low: number, high: number): NoteColour {
  const position = (midi - low) / Math.max(1, high - low) + PITCH_CLASS_SHIFT[midi % 12];
  const glow = samplePalette(id, position);
  return { glow, core: mix(glow, { r: 255, g: 255, b: 255 }, 0.6) };
}

export function rgba(c: Rgb, alpha: number): string {
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}
