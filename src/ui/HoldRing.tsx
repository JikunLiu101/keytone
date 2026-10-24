import { useSyncExternalStore } from "react";
import { backspaceHold } from "../app/commands";
import { RESTART_HOLD_MS } from "../core/shortcuts";
import { useT } from "../i18n/useT";

/**
 * While Backspace is held, a ring fills up; when it is full the score starts
 * over. It appears only after a short moment, so quick taps don't flash it.
 */
export function HoldRing() {
  const t = useT();
  const { since } = useSyncExternalStore(backspaceHold.subscribe, backspaceHold.get);
  if (since === null) return null;
  return (
    <div className="hold-ring" role="status" style={{ ["--hold-ms" as string]: `${RESTART_HOLD_MS}ms` }}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="hold-ring-track" cx="18" cy="18" r="15" />
        <circle className="hold-ring-fill" cx="18" cy="18" r="15" pathLength={100} />
      </svg>
      <span>{t("hold.restart")}</span>
    </div>
  );
}
