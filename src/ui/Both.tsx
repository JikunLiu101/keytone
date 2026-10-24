import { useSyncExternalStore } from "react";
import { settings } from "../app/services";
import { MESSAGES, type Language, type MessageKey } from "../i18n/strings";

const LANGUAGES: readonly Language[] = ["en", "zh"];
const LANG_ATTR: Record<Language, string> = { en: "en", zh: "zh-CN" };

/**
 * A label in both languages, stacked in one box with only the current one
 * shown, so the box is as wide and tall as the larger of the two whatever the
 * fonts. Controls built from these keep their place and size when the
 * language changes (spec §12.5). Pass a message key, or the two texts.
 */
export function Both(props: { k: MessageKey } | { en: string; zh: string }) {
  const language = useSyncExternalStore(settings.subscribe, () => settings.get().language);
  const text = (l: Language) => ("k" in props ? MESSAGES[l][props.k] : props[l]);
  return (
    <span className="both">
      {LANGUAGES.map((l) => (
        <span key={l} lang={LANG_ATTR[l]} className={l === language ? undefined : "both-off"} aria-hidden={l === language ? undefined : true}>
          {text(l)}
        </span>
      ))}
    </span>
  );
}
