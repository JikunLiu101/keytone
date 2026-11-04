import { stepBaseOctave } from "../app/services";
import { noteName, octaveC } from "../core/notes";
import type { MessageKey } from "../i18n/strings";
import { showToast } from "./Toast";

/**
 * Move the base octave down (−1) or up (+1) and say where it went, naming the
 * score when the change is kept with it (spec §13.4). Nothing at C2 / C5.
 */
export function stepRegister(direction: 1 | -1, t: (key: MessageKey) => string): void {
  const result = stepBaseOctave(direction);
  if (!result) return;
  const name = noteName(octaveC(result.octave));
  showToast(
    result.title === null
      ? t("toast.register").replace("{name}", name)
      : t("toast.registerScore").replace("{name}", name).replace("{title}", result.title),
  );
}
