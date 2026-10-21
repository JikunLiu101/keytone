/** Musical dynamic marking for a MIDI velocity, e.g. 89 → "mf". */
const MARKS: readonly [number, string][] = [
  [16, "ppp"],
  [32, "pp"],
  [48, "p"],
  [64, "mp"],
  [80, "mf"],
  [96, "f"],
  [112, "ff"],
];

export function dynamicMark(velocity: number): string {
  for (const [upTo, mark] of MARKS) if (velocity <= upTo) return mark;
  return "fff";
}
