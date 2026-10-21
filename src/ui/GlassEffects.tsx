import { useEffect, useRef } from "react";
import { hub } from "../app/services";
import { useSettings } from "../i18n/useT";
import { EffectsRenderer, type AnchorSet } from "../view/effects-renderer";
import type { KeyboardLayout } from "../view/layout";

/**
 * Light-bar canvas living on the glass panel. Because it sits in the glass's
 * own plane, the 3D transform gives the bars their perspective for free, and
 * key positions come straight from the layout (no screen measuring).
 */
export function GlassEffects({ layout }: { layout: KeyboardLayout }) {
  const { effects } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!effects || !canvas) return;

    // Positions in the canvas's own (untransformed) CSS pixels.
    const geometry = (): AnchorSet => {
      const whiteW = canvas.clientWidth / layout.whiteCount;
      const keys = new Map<number, { x: number; width: number }>();
      for (const key of layout.keys) {
        keys.set(key.midi, { x: (key.x + key.width / 2) * whiteW, width: key.width * whiteW });
      }
      return { originY: canvas.clientHeight, keys };
    };

    const renderer = new EffectsRenderer(canvas, geometry);
    // The canvas is seen at an angle and slightly magnified, so render a bit sharper.
    const resize = () => renderer.resize(canvas.clientWidth, canvas.clientHeight, (window.devicePixelRatio || 1) * 1.5);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const off = hub.onKey((e) => (e.type === "down" ? renderer.keyDown(e.midi) : renderer.keyUp(e.midi)));
    return () => {
      off();
      observer.disconnect();
      renderer.dispose();
    };
  }, [effects, layout]);

  return <canvas ref={canvasRef} className="glass-canvas" />;
}
