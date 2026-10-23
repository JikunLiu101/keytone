/**
 * Practice mode (spec §10.2): the player works through the score note by
 * note. Only pitch matters, never timing: rests and held beats are skipped,
 * a correct key advances, a wrong one does nothing.
 */
import { pitchMidi, type Score } from "./score";

export interface PracticeStep {
  /** Index of the score event this step plays. */
  event: number;
  /** Notes to press: one for a note, several for a chord. */
  midi: number[];
}

export interface PracticeState {
  /** Index into the steps; equals steps.length when complete. */
  step: number;
  /** Chord notes already pressed for the current step. */
  pressed: number[];
  /** Counts wrong presses, so the view can flash on each one. */
  misses: number;
}

export const PRACTICE_START: PracticeState = { step: 0, pressed: [], misses: 0 };

/** The notes and chords to play, in order. Rests are left out. */
export function practiceSteps(score: Score): PracticeStep[] {
  const steps: PracticeStep[] = [];
  score.events.forEach((e, event) => {
    if (e.kind === "rest" || !e.pitches.length) return;
    steps.push({ event, midi: [...new Set(e.pitches.map((p) => pitchMidi(p, score.key)))] });
  });
  return steps;
}

export function isComplete(steps: PracticeStep[], state: PracticeState): boolean {
  return state.step >= steps.length;
}

/** A key went down: advance if it belongs to the current step. */
export function practicePress(steps: PracticeStep[], state: PracticeState, midi: number): PracticeState {
  const step = steps[state.step];
  if (!step) return state;
  if (!step.midi.includes(midi)) return { ...state, misses: state.misses + 1 };
  const pressed = state.pressed.includes(midi) ? state.pressed : [...state.pressed, midi];
  // A chord is done once each of its notes has been pressed.
  if (step.midi.every((m) => pressed.includes(m))) return { ...state, step: state.step + 1, pressed: [] };
  return { ...state, pressed };
}
