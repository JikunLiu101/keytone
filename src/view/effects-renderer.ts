/**
 * Canvas 2D renderer for the light bars on the glass. It knows nothing about
 * React or the DOM layout: it is given a canvas and a function that reports
 * where each key sits in canvas coordinates.
 *
 * Three layers, so the light reads as light rather than flat shapes:
 * - primary: each bar is a soft beam with a bright filament and a fading tail;
 * - secondary: a bloom around every bar and a pool of light where a held bar
 *   meets the bottom of the glass;
 * - ambient: motes that drift up from held keys, and a faint haze that rises
 *   with how much is being played.
 * Colour comes from one palette family (see palettes.ts), not a rainbow.
 */
import { RANGE_HIGH, RANGE_LOW } from "../core/notes";
import { LightBarModel, barAlpha, barSpan } from "./light-bars";
import { noteColour, rgba, samplePalette, type NoteColour, type PaletteId } from "./palettes";

export interface KeyAnchor {
  /** Horizontal centre of the key, in CSS pixels from the canvas's left. */
  x: number;
  width: number;
}

export interface AnchorSet {
  /** Where bars start: CSS pixels from the canvas's top. Bars rise above it. */
  originY: number;
  keys: Map<number, KeyAnchor>;
}

interface Mote {
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayFreq: number;
  phase: number;
  age: number;
  life: number;
  size: number;
  colour: NoteColour;
}

/** Seconds a released bar takes to travel the full height, on any screen size. */
const RISE_SECONDS = 2.4;
/** Motes released on a key press, then one every MOTE_INTERVAL while held. */
const MOTES_PER_PRESS = 4;
const MOTE_INTERVAL = 0.22;
const MAX_MOTES = 70;
/** How quickly the ambient haze follows the amount being played (per second). */
const HAZE_FOLLOW = 3;

function now(): number {
  return performance.now() / 1000;
}

export class EffectsRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly model = new LightBarModel();
  private motes: Mote[] = [];
  private anchors: AnchorSet | null = null;
  private anchorsDirty = true;
  private raf = 0;
  private lastFrame = 0;
  private width = 0;
  private height = 0;
  /** Backing-store scale; shadowBlur is in device pixels, so blur radii use it. */
  private scale = 1;
  private palette: PaletteId = "aurora";
  private colours = new Map<number, NoteColour>();
  /** Held keys → time until the next mote. */
  private emitters = new Map<number, number>();
  /** Smoothed 0…1 "how much is playing", drives the haze. */
  private haze = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly measure: () => AnchorSet | null,
    /** Called with true when something starts drawing and false when the canvas goes idle. */
    private readonly onActivity: (active: boolean) => void = () => {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  setPalette(palette: PaletteId): void {
    if (palette === this.palette) return;
    this.palette = palette;
    this.colours.clear();
  }

  /** Match the canvas backing store to its CSS size. */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    this.scale = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.anchorsDirty = true;
    this.draw(now());
  }

  /** Call when the keyboard may have moved (layout change, panel collapse). */
  invalidateAnchors(): void {
    this.anchorsDirty = true;
  }

  keyDown(midi: number): void {
    this.model.down(midi, now());
    this.emitters.set(midi, MOTE_INTERVAL);
    for (let i = 0; i < MOTES_PER_PRESS; i++) this.spawnMote(midi, true);
    this.run();
  }

  keyUp(midi: number): void {
    this.model.up(midi, now());
    this.emitters.delete(midi);
    this.run();
  }

  clear(): void {
    this.model.clear();
    this.motes = [];
    this.emitters.clear();
    this.haze = 0;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clear();
    this.onActivity(false);
  }

  private colour(midi: number): NoteColour {
    let c = this.colours.get(midi);
    if (!c) {
      c = noteColour(this.palette, midi, RANGE_LOW, RANGE_HIGH);
      this.colours.set(midi, c);
    }
    return c;
  }

  private getAnchors(): AnchorSet | null {
    if (this.anchorsDirty || !this.anchors) {
      this.anchors = this.measure();
      this.anchorsDirty = false;
    }
    return this.anchors;
  }

  private run(): void {
    if (this.raf) return;
    this.lastFrame = now();
    this.raf = requestAnimationFrame(this.frame);
    this.onActivity(true);
  }

  private frame = (): void => {
    const t = now();
    const dt = Math.min(0.05, t - this.lastFrame);
    this.lastFrame = t;
    const anchors = this.getAnchors();
    this.step(dt);
    if (anchors) this.model.prune(t, anchors.originY, anchors.originY / RISE_SECONDS);
    this.draw(t);
    // Keep animating only while something is on screen.
    const idle = this.model.isEmpty && this.motes.length === 0 && this.haze < 0.005;
    if (idle) {
      this.raf = 0;
      this.haze = 0;
      this.onActivity(false);
    } else {
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private step(dt: number): void {
    // Held keys keep releasing motes.
    for (const [midi, wait] of this.emitters) {
      const next = wait - dt;
      if (next <= 0) {
        this.spawnMote(midi, false);
        this.emitters.set(midi, MOTE_INTERVAL * (0.7 + Math.random() * 0.6));
      } else {
        this.emitters.set(midi, next);
      }
    }
    for (const m of this.motes) {
      m.age += dt;
      m.y += m.vy * dt;
      m.vy *= 1 - 0.25 * dt; // drag: they slow as they rise
    }
    this.motes = this.motes.filter((m) => m.age < m.life && m.y > -10);
    // Haze eases towards the number of held keys (saturating around four).
    const target = Math.min(1, this.emitters.size / 4);
    this.haze += (target - this.haze) * Math.min(1, HAZE_FOLLOW * dt);
  }

  private draw(time: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const anchors = this.getAnchors();
    if (!anchors) return;
    const maxHeight = anchors.originY;
    const speed = maxHeight / RISE_SECONDS;
    ctx.globalCompositeOperation = "lighter";

    this.drawHaze(anchors);

    for (const bar of this.model.bars) {
      const key = anchors.keys.get(bar.midi);
      if (!key) continue;
      const span = barSpan(bar, time, speed);
      const alpha = barAlpha(span, maxHeight);
      if (alpha <= 0) continue;
      const top = anchors.originY - Math.min(span.top, maxHeight);
      const bottom = anchors.originY - span.bottom;
      if (bottom <= top) continue;
      this.drawBeam(key, top, bottom, this.colour(bar.midi), alpha, bar.end === null, anchors.originY);
    }

    for (const m of this.motes) this.drawMote(m, time);

    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Ambient: a low, wide wash of the palette's middle colour that grows with playing. */
  private drawHaze(anchors: AnchorSet): void {
    if (this.haze < 0.005) return;
    const { ctx } = this;
    const tint = samplePalette(this.palette, 0.45);
    const top = anchors.originY * 0.35;
    const g = ctx.createLinearGradient(0, anchors.originY, 0, top);
    g.addColorStop(0, rgba(tint, 0.2 * this.haze));
    g.addColorStop(0.5, rgba(tint, 0.06 * this.haze));
    g.addColorStop(1, rgba(tint, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, top, this.width, anchors.originY - top);
  }

  /**
   * Primary + secondary: one beam. Soft bloom (shadowBlur) around a body whose
   * top trails off into a tail, with a fine bright filament inside. A held
   * beam also pools light at the bottom of the glass.
   */
  private drawBeam(
    key: KeyAnchor,
    top: number,
    bottom: number,
    colour: NoteColour,
    alpha: number,
    held: boolean,
    originY: number,
  ): void {
    const { ctx } = this;
    const height = bottom - top;
    const body = key.width * 0.42;
    const filament = Math.max(1.2, key.width * 0.07);
    // Tail: the top fades out; a detached beam also softens at its lower end.
    const vertical = (c: string, cTop: string, cBottom: string) => {
      const g = ctx.createLinearGradient(0, top, 0, bottom);
      g.addColorStop(0, cTop);
      g.addColorStop(Math.min(0.45, 24 / Math.max(height, 1) + 0.15), c);
      g.addColorStop(held ? 1 : 0.85, c);
      g.addColorStop(1, cBottom);
      return g;
    };

    // Bloom: a blurred, low-alpha column so the light spills onto the frost.
    ctx.shadowColor = rgba(colour.glow, 0.85 * alpha);
    ctx.shadowBlur = key.width * 1.2 * this.scale;
    ctx.fillStyle = vertical(rgba(colour.glow, 0.3 * alpha), rgba(colour.glow, 0), rgba(colour.glow, held ? 0.3 * alpha : 0));
    capsule(ctx, key.x - body / 2, top, body, height);

    // Body: softer, tighter glow.
    ctx.shadowBlur = key.width * 0.3 * this.scale;
    ctx.fillStyle = vertical(rgba(colour.glow, 0.5 * alpha), rgba(colour.glow, 0), rgba(colour.glow, held ? 0.5 * alpha : 0));
    capsule(ctx, key.x - body * 0.32, top, body * 0.64, height);

    // Filament: the hot centre line.
    ctx.shadowColor = rgba(colour.core, 0.9 * alpha);
    ctx.shadowBlur = key.width * 0.12 * this.scale;
    ctx.fillStyle = vertical(rgba(colour.core, 0.95 * alpha), rgba(colour.core, 0), rgba(colour.core, held ? 0.95 * alpha : 0));
    capsule(ctx, key.x - filament / 2, top, filament, height);
    ctx.shadowBlur = 0;

    if (held) this.drawPool(key, colour, originY);
  }

  /** Secondary: a flat, wide ellipse of light where a held beam leaves the glass's edge. */
  private drawPool(key: KeyAnchor, colour: NoteColour, originY: number): void {
    const { ctx } = this;
    const rx = key.width * 1.9;
    const ry = key.width * 0.45;
    ctx.save();
    ctx.translate(key.x, originY);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, rgba(colour.core, 0.7));
    g.addColorStop(0.35, rgba(colour.glow, 0.3));
    g.addColorStop(1, rgba(colour.glow, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  }

  /** Ambient: a soft point of light that fades in, sways and fades out as it rises. */
  private drawMote(m: Mote, time: number): void {
    const { ctx } = this;
    const life = m.age / m.life;
    const fade = Math.sin(Math.PI * Math.min(1, life)); // in and out
    const x = m.x + Math.sin(time * m.swayFreq * Math.PI * 2 + m.phase) * m.swayAmp;
    ctx.shadowColor = rgba(m.colour.glow, 0.9 * fade);
    ctx.shadowBlur = m.size * 4 * this.scale;
    ctx.fillStyle = rgba(m.colour.core, 0.85 * fade);
    ctx.beginPath();
    ctx.arc(x, m.y, m.size, 0, Math.PI * 2);
    ctx.fill();
  }

  private spawnMote(midi: number, burst: boolean): void {
    const anchors = this.getAnchors();
    const key = anchors?.keys.get(midi);
    if (!anchors || !key || this.motes.length >= MAX_MOTES) return;
    this.motes.push({
      x: key.x + (Math.random() - 0.5) * key.width * (burst ? 0.9 : 0.5),
      y: anchors.originY - Math.random() * 6,
      vy: -(burst ? 45 + Math.random() * 55 : 28 + Math.random() * 30),
      swayAmp: 3 + Math.random() * 7,
      swayFreq: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
      age: 0,
      life: 1.4 + Math.random() * 1.4,
      size: 0.8 + Math.random() * 1.4,
      colour: this.colour(midi),
    });
  }
}

/** A vertical rounded column; the radius follows the width so ends are soft. */
function capsule(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w / 2, h / 2));
  ctx.fill();
}
