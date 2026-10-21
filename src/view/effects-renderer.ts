/**
 * Canvas 2D renderer for the rising light bars and press sparks. It knows
 * nothing about React or the DOM layout: it is given a canvas and a function
 * that reports where each key sits in canvas coordinates.
 */
import { LightBarModel, RISE_SPEED, barAlpha, barSpan, pitchHue } from "./light-bars";

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

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  hue: number;
  size: number;
}

const SPARKS_PER_PRESS = 8;
const SPARK_GRAVITY = 380;

function now(): number {
  return performance.now() / 1000;
}

export class EffectsRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly model = new LightBarModel();
  private sparks: Spark[] = [];
  private anchors: AnchorSet | null = null;
  private anchorsDirty = true;
  private raf = 0;
  private lastFrame = 0;
  private width = 0;
  private height = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly measure: () => AnchorSet | null,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
  }

  /** Match the canvas backing store to its CSS size. */
  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
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
    const t = now();
    this.model.down(midi, t);
    this.spawnSparks(midi);
    this.run();
  }

  keyUp(midi: number): void {
    this.model.up(midi, now());
    this.run();
  }

  clear(): void {
    this.model.clear();
    this.sparks = [];
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.clear();
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
  }

  private frame = (): void => {
    const t = now();
    const dt = Math.min(0.05, t - this.lastFrame);
    this.lastFrame = t;
    this.stepSparks(dt);
    const anchors = this.getAnchors();
    if (anchors) this.model.prune(t, anchors.originY);
    this.draw(t);
    // Keep animating only while something is on screen.
    this.raf = this.model.isEmpty && this.sparks.length === 0 ? 0 : requestAnimationFrame(this.frame);
  };

  private draw(time: number): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const anchors = this.getAnchors();
    if (!anchors) return;
    const maxHeight = anchors.originY;
    ctx.globalCompositeOperation = "lighter";

    for (const bar of this.model.bars) {
      const key = anchors.keys.get(bar.midi);
      if (!key) continue;
      const span = barSpan(bar, time, RISE_SPEED);
      const alpha = barAlpha(span, maxHeight);
      if (alpha <= 0) continue;
      const top = anchors.originY - Math.min(span.top, maxHeight);
      const bottom = anchors.originY - span.bottom;
      if (bottom <= top) continue;
      this.drawBar(key, top, bottom, pitchHue(bar.midi), alpha, bar.end === null);
    }

    for (const s of this.sparks) {
      const fade = 1 - s.age / s.life;
      ctx.fillStyle = `hsla(${s.hue}, 100%, 75%, ${0.9 * fade})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * (0.5 + 0.5 * fade), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalCompositeOperation = "source-over";
  }

  private drawBar(key: KeyAnchor, top: number, bottom: number, hue: number, alpha: number, held: boolean): void {
    const { ctx } = this;
    const core = key.width * 0.56;
    const height = bottom - top;

    // Soft outer glow.
    ctx.fillStyle = `hsla(${hue}, 95%, 60%, ${0.12 * alpha})`;
    roundRect(ctx, key.x - core * 1.1, top - 4, core * 2.2, height + 8, core);

    // Bar body, brighter towards its base.
    const gradient = ctx.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, `hsla(${hue}, 100%, 65%, ${0.35 * alpha})`);
    gradient.addColorStop(1, `hsla(${hue}, 100%, 72%, ${0.9 * alpha})`);
    ctx.fillStyle = gradient;
    roundRect(ctx, key.x - core / 2, top, core, height, core / 2);

    // Bright centre line.
    ctx.fillStyle = `hsla(${hue}, 100%, 92%, ${0.55 * alpha})`;
    roundRect(ctx, key.x - core * 0.15, top + 2, core * 0.3, Math.max(0, height - 4), core * 0.15);

    // Glow where a held bar meets the key.
    if (held) {
      const r = key.width * 1.6;
      const glow = ctx.createRadialGradient(key.x, bottom, 0, key.x, bottom, r);
      glow.addColorStop(0, `hsla(${hue}, 100%, 80%, 0.55)`);
      glow.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(key.x - r, bottom - r, r * 2, r * 2);
    }
  }

  private spawnSparks(midi: number): void {
    const anchors = this.getAnchors();
    const key = anchors?.keys.get(midi);
    if (!anchors || !key) return;
    const hue = pitchHue(midi);
    for (let i = 0; i < SPARKS_PER_PRESS; i++) {
      this.sparks.push({
        x: key.x + (Math.random() - 0.5) * key.width * 0.6,
        y: anchors.originY,
        vx: (Math.random() - 0.5) * 140,
        vy: -(140 + Math.random() * 220),
        age: 0,
        life: 0.45 + Math.random() * 0.4,
        hue: hue + (Math.random() - 0.5) * 30,
        size: 1.2 + Math.random() * 1.8,
      });
    }
  }

  private stepSparks(dt: number): void {
    for (const s of this.sparks) {
      s.age += dt;
      s.vy += SPARK_GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.age < s.life);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  if (w <= 0 || h <= 0) return;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}
