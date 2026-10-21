/**
 * Light-bar model: which bars exist and where they are at a given time.
 * Pure logic with no DOM or canvas, so any renderer can use it.
 *
 * A bar starts growing upward when a key goes down. When the key comes up the
 * bar detaches and keeps rising at the same speed until it leaves the screen.
 */

export interface LightBar {
  midi: number;
  /** Time (seconds) the key went down. */
  start: number;
  /** Time (seconds) the key came up, or null while still held. */
  end: number | null;
}

/** Vertical extent of a bar, in pixels above its origin (the key). */
export interface BarSpan {
  bottom: number;
  top: number;
}

/** Rise speed in pixels per second. */
export const RISE_SPEED = 170;

/** Very short taps still get a visible bar. */
export const MIN_BAR_HEIGHT = 8;

export function barSpan(bar: LightBar, time: number, speed = RISE_SPEED): BarSpan {
  const bottom = bar.end === null ? 0 : Math.max(0, (time - bar.end) * speed);
  const top = Math.max((time - bar.start) * speed, bottom + MIN_BAR_HEIGHT);
  return { bottom, top };
}

/** Opacity: full until 60% of the way up, then fading to 0 at maxHeight. */
export function barAlpha(span: BarSpan, maxHeight: number): number {
  const fadeStart = maxHeight * 0.6;
  if (span.bottom <= fadeStart) return 1;
  return Math.max(0, 1 - (span.bottom - fadeStart) / (maxHeight - fadeStart));
}

/** Rainbow hue by pitch class: C = red, then round the colour wheel. */
export function pitchHue(midi: number): number {
  return (midi % 12) * 30;
}

export class LightBarModel {
  readonly bars: LightBar[] = [];
  private held = new Map<number, LightBar>();

  down(midi: number, time: number): void {
    this.up(midi, time); // never two growing bars for the same key
    const bar: LightBar = { midi, start: time, end: null };
    this.bars.push(bar);
    this.held.set(midi, bar);
  }

  up(midi: number, time: number): void {
    const bar = this.held.get(midi);
    if (!bar) return;
    bar.end = time;
    this.held.delete(midi);
  }

  /** Drop bars whose bottom has risen past maxHeight. */
  prune(time: number, maxHeight: number, speed = RISE_SPEED): void {
    for (let i = this.bars.length - 1; i >= 0; i--) {
      if (barSpan(this.bars[i], time, speed).bottom >= maxHeight) this.bars.splice(i, 1);
    }
  }

  isHeld(midi: number): boolean {
    return this.held.has(midi);
  }

  get isEmpty(): boolean {
    return this.bars.length === 0;
  }

  clear(): void {
    this.bars.length = 0;
    this.held.clear();
  }
}
