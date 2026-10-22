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
 *
 * Performance: all soft light comes from small pre-rendered textures
 * (glow-sprites.ts) stretched with drawImage. No shadowBlur and no per-frame
 * gradients except the single haze wash, so a frame stays cheap even with
 * many notes and motes.
 */
import { RANGE_HIGH, RANGE_LOW } from "../core/notes";
import { buildColourSprites, type BeamSprites, type ColourSprites } from "./glow-sprites";
import { LightBarModel, barAlpha, barSpan } from "./light-bars";
import { noteColour, rgba, samplePalette, type PaletteId } from "./palettes";

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
  sprites: ColourSprites;
}

/** Seconds a released bar takes to travel the full height, on any screen size. */
const RISE_SECONDS = 2.4;
/** Motes released on a key press, then one every MOTE_INTERVAL while held. */
const MOTES_PER_PRESS = 3;
const MOTE_INTERVAL = 0.3;
const MAX_MOTES = 48;
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
  private palette: PaletteId = "aurora";
  /** "palette:midi" → that note's glow textures, built on first use. */
  private sprites = new Map<string, ColourSprites>();
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
    this.palette = palette;
  }

  /** Match the canvas backing store to its CSS size. */
  resize(width: number, height: number, scale: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
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

  private spritesFor(midi: number): ColourSprites {
    const key = `${this.palette}:${midi}`;
    let s = this.sprites.get(key);
    if (!s) {
      s = buildColourSprites(noteColour(this.palette, midi, RANGE_LOW, RANGE_HIGH));
      this.sprites.set(key, s);
    }
    return s;
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
      this.drawBeam(key, top, bottom, this.spritesFor(bar.midi), alpha, bar.end === null, anchors.originY);
    }

    for (const m of this.motes) this.drawMote(m, time);

    ctx.globalAlpha = 1;
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
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, top, this.width, anchors.originY - top);
  }

  /**
   * Primary + secondary: one beam, as three stretched textures — a wide soft
   * bloom, a softer body and a bright filament — each with a fading tail at
   * the top (and a soft lower end once detached). A held beam also pools
   * light at the bottom of the glass.
   */
  private drawBeam(
    key: KeyAnchor,
    top: number,
    bottom: number,
    sprites: ColourSprites,
    alpha: number,
    held: boolean,
    originY: number,
  ): void {
    const height = bottom - top;
    let tail = Math.min(height * 0.45, Math.max(24, height * 0.3));
    let end = held ? 0 : Math.min(height * 0.15, 30);
    if (tail + end > height) {
      const k = height / (tail + end);
      tail *= k;
      end *= k;
    }
    this.drawLayer(sprites.bloom, key.x, key.width * 2.2, top, bottom, tail, end, 0.38 * alpha);
    this.drawLayer(sprites.bloom, key.x, key.width * 0.6, top, bottom, tail, end, 0.6 * alpha);
    this.drawLayer(sprites.core, key.x, Math.max(4, key.width * 0.32), top, bottom, tail, end, alpha);
    if (held) {
      const rx = key.width * 1.9;
      const ry = key.width * 0.45;
      this.ctx.globalAlpha = 1;
      this.ctx.drawImage(sprites.pool, key.x - rx, originY - ry, rx * 2, ry * 2);
    }
  }

  private drawLayer(
    s: BeamSprites,
    cx: number,
    w: number,
    top: number,
    bottom: number,
    tail: number,
    end: number,
    alpha: number,
  ): void {
    const { ctx } = this;
    const x = cx - w / 2;
    const midTop = top + tail;
    const midBottom = bottom - end;
    ctx.globalAlpha = Math.min(1, alpha);
    if (tail > 0.5) ctx.drawImage(s.fadeIn, x, top, w, tail);
    if (midBottom > midTop) ctx.drawImage(s.body, x, midTop, w, midBottom - midTop);
    if (end > 0.5) ctx.drawImage(s.fadeOut, x, midBottom, w, end);
  }

  /** Ambient: a soft point of light that fades in, sways and fades out as it rises. */
  private drawMote(m: Mote, time: number): void {
    const life = m.age / m.life;
    const fade = Math.sin(Math.PI * Math.min(1, life)); // in and out
    const x = m.x + Math.sin(time * m.swayFreq * Math.PI * 2 + m.phase) * m.swayAmp;
    const r = m.size * 5;
    this.ctx.globalAlpha = 0.9 * fade;
    this.ctx.drawImage(m.sprites.mote, x - r, m.y - r, r * 2, r * 2);
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
      sprites: this.spritesFor(midi),
    });
  }
}
