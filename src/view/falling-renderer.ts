/**
 * Canvas 2D renderer for falling notes on the glass: inverted light bars
 * drop towards their keys and sink into the bottom edge. A hit sends up a
 * burst of light as its bar keeps falling, a missed note dims as it sinks,
 * and a wrong key gives a faint flash.
 *
 * It draws what a FallingSession says and advances it once per frame. The
 * same pre-rendered glow sprites as the rising bars keep each frame cheap.
 */
import { RANGE_HIGH, RANGE_LOW } from "../core/notes";
import type { FallingSession } from "../score/falling";
import type { AnchorSet, KeyAnchor } from "./effects-renderer";
import { buildColourSprites, type BeamSprites, type ColourSprites } from "./glow-sprites";
import { noteColour, rgba, samplePalette, type PaletteId } from "./palettes";

/** Real seconds a bar takes to fall the full height of the glass, at any speed. */
export const FALL_SECONDS = 2.6;
/** Gap between two bars of the same key, so repeated notes read apart: a share of a beat, at least this many pixels. */
const NOTE_GAP_MIN = 10;
const NOTE_GAP_BEATS = 0.18;
const MISS_FADE = 0.5;
const BURST_SECONDS = 0.45;
const FLASH_SECONDS = 0.25;
const MAX_MOTES = 60;

interface Mote {
  x: number;
  y: number;
  vy: number;
  vx: number;
  age: number;
  life: number;
  size: number;
  sprites: ColourSprites;
}

interface Flash {
  midi: number;
  age: number;
  life: number;
  sprites: ColourSprites;
  strength: number;
}

const WRONG_COLOUR = { glow: { r: 150, g: 160, b: 182 }, core: { r: 225, g: 230, b: 240 } };

export class FallingRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private anchors: AnchorSet | null = null;
  private anchorsDirty = true;
  private raf = 0;
  private last = 0;
  private width = 0;
  private height = 0;
  private palette: PaletteId = "aurora";
  private sprites = new Map<string, ColourSprites>();
  private wrongSprites = buildColourSprites(WRONG_COLOUR);
  private motes: Mote[] = [];
  private flashes: Flash[] = [];
  /** Set once an idle frame has been drawn, so a paused screen costs nothing. */
  private idleDrawn = false;
  /** Cached edge-fade gradients for the current canvas height. */
  private edgeFade: { top: CanvasGradient; bottom: CanvasGradient } | null = null;
  private edgeFadeFor = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly measure: () => AnchorSet | null,
    private readonly getSession: () => FallingSession | null,
    /** Called after each frame's update, so the UI can follow status changes. */
    private readonly onFrame: () => void = () => {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not available");
    this.ctx = ctx;
    this.raf = requestAnimationFrame(this.frame);
  }

  setPalette(palette: PaletteId): void {
    this.palette = palette;
    this.redraw();
  }

  resize(width: number, height: number, scale: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * scale);
    this.canvas.height = Math.round(height * scale);
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.anchorsDirty = true;
    this.redraw();
  }

  /** Draw on the next frame even when nothing is moving (new score, reset, palette). */
  redraw(): void {
    this.idleDrawn = false;
  }

  invalidateAnchors(): void {
    this.anchorsDirty = true;
    this.redraw();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** A note was hit: light bursts up from its key. */
  burst(midi: number): void {
    const sprites = this.spritesFor(midi);
    this.flashes.push({ midi, age: 0, life: BURST_SECONDS, sprites, strength: 1 });
    const key = this.getAnchors()?.keys.get(midi);
    if (!key) return;
    for (let i = 0; i < 6 && this.motes.length < MAX_MOTES; i++) {
      this.motes.push({
        x: key.x + (Math.random() - 0.5) * key.width,
        y: (this.getAnchors()?.originY ?? this.height) - Math.random() * 4,
        vy: -(60 + Math.random() * 90),
        vx: (Math.random() - 0.5) * 30,
        age: 0,
        life: 0.6 + Math.random() * 0.7,
        size: 0.8 + Math.random() * 1.3,
        sprites,
      });
    }
  }

  /** A key that isn't due: a faint, neutral flash. */
  wrong(midi: number): void {
    this.flashes.push({ midi, age: 0, life: FLASH_SECONDS, sprites: this.wrongSprites, strength: 0.55 });
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

  private frame = (): void => {
    const now = performance.now() / 1000;
    const dt = this.last ? Math.min(0.05, now - this.last) : 0;
    this.last = now;
    const session = this.getSession();
    session?.update(dt);
    this.step(dt);
    const busy = !!session?.running || this.motes.length > 0 || this.flashes.length > 0;
    if (busy || !this.idleDrawn) this.draw(session);
    this.idleDrawn = !busy;
    this.onFrame();
    this.raf = requestAnimationFrame(this.frame);
  };

  private step(dt: number): void {
    for (const m of this.motes) {
      m.age += dt;
      m.y += m.vy * dt;
      m.x += m.vx * dt;
      m.vy *= 1 - 0.9 * dt;
    }
    this.motes = this.motes.filter((m) => m.age < m.life);
    for (const f of this.flashes) f.age += dt;
    this.flashes = this.flashes.filter((f) => f.age < f.life);
  }

  private draw(session: FallingSession | null): void {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    const anchors = this.getAnchors();
    if (!anchors || !session) return;
    const origin = anchors.originY;
    // Pixels per song second: a bar always takes FALL_SECONDS of real time to fall.
    const px = origin / (FALL_SECONDS * session.speed);
    const t = session.time;
    const gap = Math.max(NOTE_GAP_MIN, session.timeline.beat * NOTE_GAP_BEATS * px);
    ctx.globalCompositeOperation = "lighter";
    const contacts: { key: KeyAnchor; sprites: ColourSprites; alpha: number }[] = [];


    for (const n of session.notes) {
      const key = anchors.keys.get(n.midi);
      if (!key) continue;
      const bottom = origin - (n.start - t) * px;
      // Never shorter than a third of the bar, so very short notes still show.
      const top = Math.min(origin - (n.end - t) * px + gap, bottom - (n.end - n.start) * px * 0.35);
      if (top >= origin || bottom <= 0) continue;
      let alpha = 0.8;
      if (n.state === "hit") {
        alpha = 1; // a played note keeps falling, fully lit, into its key
      } else if (n.state === "missed") {
        alpha = 0.55 * Math.max(0, 1 - (t - (n.judgedAt ?? t)) / (MISS_FADE * session.speed));
        if (alpha <= 0) continue;
      } else if (session.practice ? n.step === session.step : Math.abs(n.start - t) < 0.4 * session.speed) {
        alpha = 1; // the note to play now
      }
      const sprites = this.spritesFor(n.midi);
      // Drawn at its true size: the canvas edges clip it, and the edge fades below soften that.
      this.drawBar(key, top, bottom, sprites, alpha, n.state === "missed");
      // Where a bar meets the keys it pools into light instead of being cut off.
      if (bottom >= origin - 2) contacts.push({ key, sprites, alpha });
    }

    this.fadeEdges(origin);
    this.drawHitLine(anchors);

    for (const c of contacts) {
      const rx = c.key.width * 1.5;
      const ry = c.key.width * 0.5;
      ctx.globalAlpha = 0.55 * c.alpha;
      ctx.drawImage(c.sprites.pool, c.key.x - rx, origin - ry, rx * 2, ry * 2);
    }

    for (const f of this.flashes) {
      const key = anchors.keys.get(f.midi);
      if (!key) continue;
      const k = 1 - f.age / f.life;
      const rx = key.width * (1.6 + (1 - k) * 1.2);
      const ry = key.width * 0.7;
      ctx.globalAlpha = f.strength * k * k;
      ctx.drawImage(f.sprites.pool, key.x - rx, origin - ry, rx * 2, ry * 2);
    }

    for (const m of this.motes) {
      const fade = Math.sin(Math.PI * Math.min(1, m.age / m.life));
      const r = m.size * 5;
      ctx.globalAlpha = 0.9 * fade;
      ctx.drawImage(m.sprites.mote, m.x - r, m.y - r, r * 2, r * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** A faint line where bars meet the keys, so the target is visible. */
  private drawHitLine(anchors: AnchorSet): void {
    const { ctx } = this;
    const tint = samplePalette(this.palette, 0.55);
    const g = ctx.createLinearGradient(0, anchors.originY - 14, 0, anchors.originY);
    g.addColorStop(0, rgba(tint, 0));
    g.addColorStop(1, rgba(tint, 0.18));
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, anchors.originY - 14, this.width, 14);
  }

  /**
   * Soften where the canvas clips the bars: they fade in from the glass's top
   * edge and melt into the bottom edge instead of stopping at a hard line.
   */
  private fadeEdges(origin: number): void {
    const { ctx } = this;
    const topBand = Math.min(48, origin * 0.12);
    const bottomBand = Math.min(16, origin * 0.05);
    if (!this.edgeFade || this.edgeFadeFor !== origin) {
      const top = ctx.createLinearGradient(0, 0, 0, topBand);
      top.addColorStop(0, "rgba(0,0,0,1)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      const bottom = ctx.createLinearGradient(0, origin - bottomBand, 0, origin);
      bottom.addColorStop(0, "rgba(0,0,0,0)");
      bottom.addColorStop(1, "rgba(0,0,0,0.7)");
      this.edgeFade = { top, bottom };
      this.edgeFadeFor = origin;
    }
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.edgeFade.top;
    ctx.fillRect(0, 0, this.width, topBand);
    ctx.fillStyle = this.edgeFade.bottom;
    ctx.fillRect(0, origin - bottomBand, this.width, bottomBand);
    ctx.globalCompositeOperation = "lighter";
  }

  /**
   * A falling bar, as three layers of light (wide bloom, body, bright core).
   * Each layer fades out at both ends over a length that matches its own
   * width, so the wide glow tapers longest and the core shortest: the ends
   * close softly like a beam of light rather than a cut-off strip.
   */
  private drawBar(key: KeyAnchor, top: number, bottom: number, sprites: ColourSprites, alpha: number, dim: boolean): void {
    const height = bottom - top;
    if (height < 1) return;
    const layers: [BeamSprites, number, number][] = [
      [sprites.bloom, key.width * 1.9, 0.3 * alpha],
      [sprites.bloom, key.width * 0.62, (dim ? 0.4 : 0.65) * alpha],
      [sprites.core, Math.max(4, key.width * 0.34), alpha],
    ];
    for (const [sprite, width, a] of layers) {
      // Trailing tail (top) is long and gentle; the leading end (bottom) closes sooner.
      let tail = Math.max(width * 0.9, Math.min(height * 0.4, 60));
      let lead = Math.max(width * 0.55, 14);
      if (tail + lead > height) {
        const k = height / (tail + lead);
        tail *= k;
        lead *= k;
      }
      this.drawLayer(sprite, key.x, width, top, bottom, tail, lead, a);
    }
  }

  private drawLayer(
    s: BeamSprites,
    cx: number,
    w: number,
    top: number,
    bottom: number,
    tail: number,
    tip: number,
    alpha: number,
  ): void {
    const { ctx } = this;
    const x = cx - w / 2;
    const bodyTop = top + tail;
    const bodyBottom = bottom - tip;
    ctx.globalAlpha = Math.min(1, alpha);
    if (tail > 0.5) ctx.drawImage(s.fadeIn, x, top, w, tail);
    if (bodyBottom > bodyTop) ctx.drawImage(s.body, x, bodyTop, w, bodyBottom - bodyTop);
    if (tip > 0.5) ctx.drawImage(s.fadeOut, x, bodyBottom, w, tip);
  }
}
