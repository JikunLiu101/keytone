/** Read-only scores that ship with the app. Public-domain melodies only. */
import type { Language } from "../i18n/strings";

export interface BuiltinScore {
  id: string;
  /** Shown instead of the text's `title:` so the name follows the UI language. */
  titles: Record<Language, string>;
  /** Lyrics in each UI language, like the titles (spec §11.3). */
  lyrics: Record<Language, string>;
  text: string;
}

export const BUILTIN_SCORES: readonly BuiltinScore[] = [
  {
    id: "builtin:twinkle",
    titles: { en: "Twinkle, Twinkle, Little Star", zh: "小星星" },
    lyrics: {
      en: "Twin-kle, twin-kle, lit-tle star, - how I won-der what you are! - up a-bove the world so high, - like a dia-mond in the sky. - twin-kle, twin-kle, lit-tle star, - how I won-der what you are! -",
      zh: "一闪一闪亮晶晶，-满天都是小星星。-挂在天上放光明，-好像许多小眼睛。-一闪一闪亮晶晶，-满天都是小星星。-",
    },
    text: `title: Twinkle, Twinkle, Little Star
key: C
time: 4/4
tempo: 100
---
1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 - |
5 5 4 4 | 3 3 2 - | 5 5 4 4 | 3 3 2 - |
1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 - |
`,
  },
  {
    id: "builtin:birthday",
    titles: { en: "Happy Birthday to You", zh: "生日快乐" },
    lyrics: {
      en: "Hap-py birth-day to you, - hap-py birth-day to you, - hap-py birth-day dear friend, - hap-py birth-day to you! - -",
      zh: "祝你生日快乐，-祝你生日快乐，-祝你生日快乐，-祝你生日快乐！--",
    },
    text: `title: Happy Birthday to You
key: C
time: 3/4
tempo: 100
pickup: 1
---
5./ 5// | 6 5 1' | 7 - 5./ 5// | 6 5 2' | 1' - 5./ 5// |
5' 3' 1' | 7 6 4'./ 4'// | 3' 1' 2' | 1' - - |
`,
  },
];

export const DEFAULT_SCORE_ID = BUILTIN_SCORES[0].id;

export function findBuiltin(id: string): BuiltinScore | undefined {
  return BUILTIN_SCORES.find((s) => s.id === id);
}
