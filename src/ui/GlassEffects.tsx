import { useEffect, useRef, type RefObject } from "react";
import { hub, settings } from "../app/services";
import { useSettings } from "../i18n/useT";
import { EffectsRenderer, type AnchorSet } from "../view/effects-renderer";
import type { KeyboardLayout } from "../view/layout";

/**
 * Light-bar canvas living on the glass panel. Because it sits in the glass's
 * own plane, the 3D transform gives the bars their perspective for free, and
 * key positions come straight from the layout (no screen measuring).
 *
 * The lit pane stops at the top of the LCD strip behind the glass, so the
 * display stays readable, and the glass only lights up while bars are drawn.
 */
export function GlassEffects({ layout }: { layout: KeyboardLayout }) {
  const { effects, lightPalette } = useSettings();
  const rendererRef = useRef<EffectsRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const glass = canvas?.closest<HTMLElement>(".glass");
    if (!effects || !canvas || !glass) return;

    // Positions in the canvas's own (untransformed) CSS pixels.
    const geometry = (): AnchorSet => {
      const whiteW = canvas.clientWidth / layout.whiteCount;
      const keys = new Map<number, { x: number; width: number }>();
      for (const key of layout.keys) {
        keys.set(key.midi, { x: (key.x + key.width / 2) * whiteW, width: key.width * whiteW });
      }
      return { originY: canvas.clientHeight, keys };
    };

    const renderer = new EffectsRenderer(canvas, geometry, (active) => glass.classList.toggle("glass--lit", active));
    renderer.setPalette(settings.get().lightPalette);
    rendererRef.current = renderer;
    // Development only: lets tests step the animation when the page is hidden.
    if (import.meta.env.DEV) Object.assign(window, { __keytoneEffects: renderer });
    // Glow is soft, so the canvas does not need full retina resolution; capping
    // it keeps per-frame work small on high-density screens.
    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight, Math.min(window.devicePixelRatio || 1, 1.5));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const off = hub.onKey((e) => (e.type === "down" ? renderer.keyDown(e.midi) : renderer.keyUp(e.midi)));
    return () => {
      off();
      observer.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [effects, layout]);

  // Switch colours without rebuilding the renderer.
  useEffect(() => {
    rendererRef.current?.setPalette(lightPalette);
  }, [lightPalette]);

  return <canvas ref={canvasRef} className="glass-canvas" aria-hidden="true" />;
}

/**
 * Keep the glass's lit pane clear of the LCD strip behind it: measure how
 * tall the strip looks through the glass and expose it as --lcd-clear
 * (glass pixels). Runs for every glass view (rising bars, sheet, falling).
 */
export function useLcdClear(glassRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const glass = glassRef.current;
    const strip = document.querySelector<HTMLElement>(".keyboard-top");
    if (!glass || !strip) return;
    const update = () => {
      const g = glass.getBoundingClientRect();
      const s = strip.getBoundingClientRect();
      const scale = g.height / (glass.clientHeight || 1);
      const clear = Math.max(0, (g.bottom - s.top) / (scale || 1));
      glass.style.setProperty("--lcd-clear", `${Math.round(clear)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    observer.observe(glass);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [glassRef]);
}
