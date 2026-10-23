import { useEffect, useSyncExternalStore } from "react";
import { createStore } from "../core/store";

/** One short message at a time; a new one replaces the old. */
const toastStore = createStore<{ message: string | null; id: number }>({ message: null, id: 0 });

const TOAST_MS = 2000;

export function showToast(message: string): void {
  toastStore.set({ message, id: toastStore.get().id + 1 });
}

/** Renders the current toast at the bottom of the screen and hides it after a moment. */
export function ToastHost() {
  const { message, id } = useSyncExternalStore(toastStore.subscribe, toastStore.get);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => toastStore.set({ message: null }), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [message, id]);
  return (
    <div className="toast-host" role="status" aria-live="polite">
      {message && (
        <div key={id} className="toast">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.5 8.5l3 3 6-7" />
          </svg>
          {message}
        </div>
      )}
    </div>
  );
}
