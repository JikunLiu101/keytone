import { useEffect, useRef } from "react";
import { hub } from "../app/services";
import { useSettings } from "../i18n/useT";
import { EffectsRenderer, type AnchorSet } from "../view/effects-renderer";

/**
 * Screen-space canvas behind the keyboard where light bars rise. Key positions
 * are measured from invisible anchors on the 3D keyboard's top edge, so the
 * bars line up with the tilted keys.
 */
export function EffectsLayer() {
  const { effects } = useSettings();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!effects || !canvas) return;

    const measure = (): AnchorSet | null => {
      const box = canvas.getBoundingClientRect();
      const nodes = document.querySelectorAll<HTMLElement>("[data-anchor-midi]");
      if (!nodes.length) return null;
      const keys = new Map<number, { x: number; width: number }>();
      let originY = Infinity;
      for (const node of nodes) {
        const r = node.getBoundingClientRect();
        keys.set(Number(node.dataset.anchorMidi), { x: (r.left + r.right) / 2 - box.left, width: r.width });
        originY = Math.min(originY, r.top - box.top);
      }
      return { originY, keys };
    };

    const renderer = new EffectsRenderer(canvas, measure);
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      renderer.resize(width, height, window.devicePixelRatio || 1);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    // The keyboard can move without the canvas resizing (e.g. fonts, panel wrap).
    const keyboardEl = document.querySelector(".keyboard-body");
    const keyboardObserver = new ResizeObserver(() => renderer.invalidateAnchors());
    if (keyboardEl) keyboardObserver.observe(keyboardEl);

    const off = hub.onKey((e) => (e.type === "down" ? renderer.keyDown(e.midi) : renderer.keyUp(e.midi)));
    return () => {
      off();
      observer.disconnect();
      keyboardObserver.disconnect();
      renderer.dispose();
    };
  }, [effects]);

  return <canvas ref={canvasRef} className="effects-canvas" aria-hidden="true" />;
}
