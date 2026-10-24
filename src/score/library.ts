/**
 * All scores the user can pick: the built-in ones (read-only) plus their own,
 * which are kept as text in localStorage.
 */
import { createStore } from "../core/store";
import type { Language } from "../i18n/strings";
import { BUILTIN_SCORES, findBuiltin } from "./builtin-scores";
import { parseScore, serializeScore, type ParseError, type Score } from "./score";

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

export interface UserScore {
  /** "user:…" */
  id: string;
  text: string;
}

export const LIBRARY_KEY = "keytone.scores.v1";

function storage(): globalThis.Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Read the stored list, dropping anything malformed. */
export function sanitizeLibrary(raw: unknown): UserScore[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is UserScore =>
      !!s && typeof s === "object" && typeof s.id === "string" && s.id.startsWith("user:") && typeof s.text === "string",
  );
}

function loadLibrary(): UserScore[] {
  try {
    const text = storage()?.getItem(LIBRARY_KEY);
    return text ? sanitizeLibrary(JSON.parse(text)) : [];
  } catch {
    return [];
  }
}

export const userScores = createStore({ list: loadLibrary() });

userScores.subscribe(() => {
  try {
    storage()?.setItem(LIBRARY_KEY, JSON.stringify(userScores.get().list));
  } catch {
    // Storage full or blocked: the scores just won't persist.
  }
});

function newId(): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `user:${random}`;
}

// ---------- Reading ----------

const parsed = new Map<string, { text: string; score: Score; errors: ParseError[] }>();

/** Parse with a small cache keyed by id, refreshed when the text changes. */
function parseCached(id: string, text: string): { score: Score; errors: ParseError[] } {
  const hit = parsed.get(id);
  if (hit && hit.text === text) return hit;
  const result = { text, ...parseScore(text) };
  parsed.set(id, result);
  return result;
}

export function findUserScore(id: string): UserScore | undefined {
  return userScores.get().list.find((s) => s.id === id);
}

export function untitled(language: Language): string {
  return language === "zh" ? "未命名" : "Untitled";
}

/** The score for `id`, falling back to the first built-in when it is unknown. */
export function resolveScore(id: string, language: Language): ResolvedScore {
  const user = findUserScore(id);
  if (user) {
    const { score } = parseCached(user.id, user.text);
    return { id: user.id, title: score.title || untitled(language), builtin: false, score };
  }
  const builtin = findBuiltin(id) ?? BUILTIN_SCORES[0];
  return {
    id: builtin.id,
    title: builtin.titles[language],
    builtin: true,
    // Lyrics follow the UI language, like the title.
    score: { ...parseCached(builtin.id, builtin.text).score, lyrics: builtin.lyrics[language] },
  };
}

/** Parse problems in a user score's text, for the editor. */
export function scoreErrors(id: string): ParseError[] {
  const user = findUserScore(id);
  return user ? parseCached(user.id, user.text).errors : [];
}

/** `base`, or `base 2`, `base 3`… so new scores don't all share one name. */
export function uniqueTitle(base: string, language: Language): string {
  const taken = new Set(listScores(language).map((s) => s.title));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Every score the user can pick: built-ins first, then their own. */
export function listScores(language: Language): ScoreEntry[] {
  return [
    ...BUILTIN_SCORES.map((s) => ({ id: s.id, title: s.titles[language], builtin: true })),
    ...userScores.get().list.map((s) => ({
      id: s.id,
      title: parseCached(s.id, s.text).score.title || untitled(language),
      builtin: false,
    })),
  ];
}

// ---------- Changing ----------

/** Add a score from text; returns its id. */
export function addScore(text: string): string {
  const id = newId();
  userScores.set({ list: [...userScores.get().list, { id, text }] });
  return id;
}

export function updateScore(id: string, text: string): void {
  userScores.set({ list: userScores.get().list.map((s) => (s.id === id ? { ...s, text } : s)) });
}

export function updateScoreData(id: string, score: Score): void {
  updateScore(id, serializeScore(score));
}

export function removeScore(id: string): void {
  userScores.set({ list: userScores.get().list.filter((s) => s.id !== id) });
  parsed.delete(id);
}

/** Copy any score (built-in or user) into a new user score; returns its id. */
export function duplicateScore(id: string, language: Language): string {
  const { score, title } = resolveScore(id, language);
  const suffix = language === "zh" ? "（副本）" : " (copy)";
  return addScore(serializeScore({ ...score, title: uniqueTitle(title + suffix, language) }));
}
