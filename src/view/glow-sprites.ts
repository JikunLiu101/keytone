/**
 * Pre-rendered glow textures. Drawing soft light with canvas shadowBlur or
 * fresh gradients every frame is very slow; instead each colour gets a few
 * small images drawn once (a soft beam cross-section, its fading ends, a
 * pool of light and a mote) that the renderer stretches with drawImage,
 * which the GPU does almost for free.
 */
import { rgba, type NoteColour, type Rgb } from "./palettes";

/** Horizontal resolution of beam textures; they are stretched to any width. */
const PROFILE_W = 64;
/** Vertical resolution of the fade textures. */
const FADE_H = 64;

export interface BeamSprites {
  /** Uniform section of the beam (1px tall, stretched vertically). */
  body: HTMLCanvasElement;
  /** Transparent at the top → full at the bottom: a beam's top tail. */
  fadeIn: HTMLCanvasElement;
  /** Full at the top → transparent at the bottom: a detached beam's lower end. */
  fadeOut: HTMLCanvasElement;
}

export interface ColourSprites {
  /** Wide, soft bloom around the beam. */
  bloom: BeamSprites;
  /** Narrow, bright filament. */
  core: BeamSprites;
  /** Round pool of light where a held beam meets the glass's edge. */
  pool: HTMLCanvasElement;
  /** Soft point of light. */
  mote: HTMLCanvasElement;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  return [c, ctx];
}

/** Gaussian-like horizontal falloff; `sharpness` > 1 narrows the bright centre. */
function profileAlpha(x: number, sharpness: number): number {
  const d = Math.abs(x / (PROFILE_W - 1) - 0.5) * 2; // 0 at centre, 1 at edges
  return Math.exp(-d * d * 4 * sharpness) * (1 - d * d); // forced to 0 at the edges
}

function beamSprites(colour: Rgb, sharpness: number): BeamSprites {
  const [body, bctx] = canvas(PROFILE_W, 1);
  for (let x = 0; x < PROFILE_W; x++) {
    bctx.fillStyle = rgba(colour, profileAlpha(x, sharpness));
    bctx.fillRect(x, 0, 1, 1);
  }
  const fade = (fromTop: boolean) => {
    const [c, ctx] = canvas(PROFILE_W, FADE_H);
    for (let y = 0; y < FADE_H; y++) {
      const t = y / (FADE_H - 1);
      const v = fromTop ? t : 1 - t;
      ctx.globalAlpha = v * v * (3 - 2 * v); // smoothstep
      ctx.drawImage(body, 0, y);
    }
    return c;
  };
  return { body, fadeIn: fade(true), fadeOut: fade(false) };
}

function radialSprite(size: number, stops: [number, string][]): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, col] of stops) g.addColorStop(at, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function buildColourSprites(colour: NoteColour): ColourSprites {
  return {
    bloom: beamSprites(colour.glow, 1),
    core: beamSprites(colour.core, 6),
    pool: radialSprite(64, [
      [0, rgba(colour.core, 0.7)],
      [0.35, rgba(colour.glow, 0.3)],
      [1, rgba(colour.glow, 0)],
    ]),
    mote: radialSprite(32, [
      [0, rgba(colour.core, 1)],
      [0.18, rgba(colour.core, 0.85)],
      [0.4, rgba(colour.glow, 0.35)],
      [1, rgba(colour.glow, 0)],
    ]),
  };
}
