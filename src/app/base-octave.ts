/**
 * Which base octave applies, and where a change to it goes (spec §13.3).
 * Pure functions; services.ts wires them to the stores.
 */
import { BASE_OCTAVES } from "../core/notes";
import type { ResolvedScore } from "../score/library";
import type { Settings } from "./settings";

type ScoreRef = Pick<ResolvedScore, "id" | "builtin" | "score">;

/** A user score's own base octave, or the one remembered for a built-in; null when it has none. */
export function ownOctave(s: Pick<Settings, "builtinOctaves">, score: ScoreRef): number | null {
  return score.builtin ? (s.builtinOctaves[score.id] ?? null) : score.score.octave;
}

/** True when the current score decides the base: it is shown, or open in the editor. */
function scoreDecides(s: Pick<Settings, "scoreView">, editing: boolean): boolean {
  return editing || s.scoreView !== "off";
}

/** The base octave that applies now. */
export function appliedOctave(s: Pick<Settings, "baseOctave" | "builtinOctaves" | "scoreView">, score: ScoreRef, editing: boolean): number {
  return scoreDecides(s, editing) ? (ownOctave(s, score) ?? s.baseOctave) : s.baseOctave;
}

/**
 * One octave down (−1) or up (+1) from the base that applies, and where it is
 * kept: the global setting, a built-in's entry in the settings, or the score
 * itself. Null past C2 or C5, and while the editor is open: there its
 * Register field changes it (spec §13.4), and a change from outside would be
 * overwritten by the editor's own copy of the score.
 */
export function octaveChange(
  s: Pick<Settings, "baseOctave" | "builtinOctaves" | "scoreView">,
  score: ScoreRef,
  editing: boolean,
  direction: 1 | -1,
): { target: "global" | "builtin" | "score"; octave: number } | null {
  if (editing) return null;
  const octave = appliedOctave(s, score, editing) + direction;
  if (!(BASE_OCTAVES as readonly number[]).includes(octave)) return null;
  const target = !scoreDecides(s, editing) ? "global" : score.builtin ? "builtin" : "score";
  return { target, octave };
}
