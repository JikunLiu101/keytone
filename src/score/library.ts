/** Finds the score to show for an id. User scores join here in the editor step. */
import type { Language } from "../i18n/strings";
import { BUILTIN_SCORES, findBuiltin } from "./builtin-scores";
import { parseScore, type Score } from "./score";

export interface ResolvedScore {
  id: string;
  title: string;
  builtin: boolean;
  score: Score;
}

export interface ScoreEntry {
  id: string;
  title: string;
  builtin: boolean;
}

const parsed = new Map<string, Score>();

function builtinScore(id: string, text: string): Score {
  let score = parsed.get(id);
  if (!score) {
    score = parseScore(text).score;
    parsed.set(id, score);
  }
  return score;
}

/** The score for `id`, falling back to the first built-in when it is unknown. */
export function resolveScore(id: string, language: Language): ResolvedScore {
  const builtin = findBuiltin(id) ?? BUILTIN_SCORES[0];
  return {
    id: builtin.id,
    title: builtin.titles[language],
    builtin: true,
    score: builtinScore(builtin.id, builtin.text),
  };
}

/** Every score the user can pick, in menu order. */
export function listScores(language: Language): ScoreEntry[] {
  return BUILTIN_SCORES.map((s) => ({ id: s.id, title: s.titles[language], builtin: true }));
}
