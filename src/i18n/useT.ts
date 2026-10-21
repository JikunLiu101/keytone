import { useCallback, useSyncExternalStore } from "react";
import { settings } from "../app/services";
import { MESSAGES, type MessageKey } from "./strings";

/** Returns a translate function for the current UI language. */
export function useT(): (key: MessageKey) => string {
  const language = useSyncExternalStore(settings.subscribe, () => settings.get().language);
  return useCallback((key: MessageKey) => MESSAGES[language][key], [language]);
}

export function useSettings() {
  return useSyncExternalStore(settings.subscribe, settings.get);
}
