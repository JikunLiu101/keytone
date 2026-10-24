import { useEffect, useSyncExternalStore } from "react";
import { createStore } from "../core/store";

/** "done" confirms something that happened; "warn" says why something didn't. */
export type ToastKind = "done" | "warn";

/** One short message at a time; a new one replaces the old. */
const toastStore = createStore<{ message: string | null; kind: ToastKind; id: number }>({ message: null, kind: "done", id: 0 });

const TOAST_MS = 2000;

export function showToast(message: string, kind: ToastKind = "done"): void {
  toastStore.set({ message, kind, id: toastStore.get().id + 1 });
}

/** Renders the current toast near the top of the stage and hides it after a moment. */
export function ToastHost() {
  const { message, kind, id } = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => toastStore.set({ message: null }), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, id]);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {message && (
        <div key={id} className={`toast toast--${kind}`}>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {kind === "warn" ? <path d="M8 3.5v5.5M8 12v.5" /> : <path d="M3.5 8.5l3 3 6-7" />}
          </svg>
          {message}
        </div>
      )}
    </div>
  );
}
