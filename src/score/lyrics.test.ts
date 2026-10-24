import { describe, expect, it } from "vitest";
import { BUILTIN_SCORES } from "./builtin-scores";
import { alignLyrics, buildLyrics, lyricSlots, parseLyrics, type LyricItem } from "./lyrics";
import { parseScore } from "./score";

/** Items as short strings: a word's text ("+" when it continues on the next note), "-" hold, "0" skip. */
const show = (items: LyricItem[]) => items.map((i) => (i.kind === "word" ? i.text + (i.joinNext ? "+" : "") : i.kind === "hold" ? "-" : "0"));

describe("parseLyrics", () => {
  it("gives each Chinese character a slot and reads holds", () => {
    expect(show(parseLyrics("祝你生日快乐--"))).toEqual(["祝", "你", "生", "日", "快", "乐", "-", "-"]);
  });

  it("splits English words on a hyphen between letters, and holds on a hyphen on its own", () => {
    expect(show(parseLyrics("hap-py birth-day to you --"))).toEqual(["hap+", "py", "birth+", "day", "to", "you", "-", "-"]);
  });

  it("marks the parts of a split word", () => {
    const [hap, py] = parseLyrics("hap-py");
    expect(hap).toMatchObject({ kind: "word", joinNext: true, joinPrev: false });
    expect(py).toMatchObject({ kind: "word", joinNext: false, joinPrev: true });
  });

  it("reads 0 as a note that is not sung, and keeps punctuation with the previous word", () => {
    expect(show(parseLyrics("无关0风月，我提笔-等 0 你回"))).toEqual(["无", "关", "0", "风", "月，", "我", "提", "笔", "-", "等", "0", "你", "回"]);
  });

  it("keeps apostrophes and digits inside words", () => {
    expect(show(parseLyrics("don't stop 2000"))).toEqual(["don't", "stop", "2000"]);
  });

  it("treats full-width hyphen and zero like - and 0", () => {
    expect(show(parseLyrics("乐－０"))).toEqual(["乐", "-", "0"]);
  });

  it("treats line breaks as spaces and ignores spaces between Chinese characters", () => {
    expect(show(parseLyrics("one\ntwo 一 二"))).toEqual(["one", "two", "一", "二"]);
  });

  it("records where each item is in the text", () => {
    const items = parseLyrics("ab-cd 乐");
    expect(items.map((i) => [i.from, i.to])).toEqual([
      [0, 2],
      [3, 5],
      [6, 7],
    ]);
  });

  it("has no items for empty or blank text", () => {
    expect(parseLyrics("")).toEqual([]);
    expect(parseLyrics("  \n ")).toEqual([]);
  });
});

describe("lyricSlots", () => {
  it("counts notes and the dashes that hold them, but not rests or a rest's dashes", () => {
    const { score } = parseScore("---\n1 - 0 - [1 3] 2/");
    expect(lyricSlots(score)).toEqual([
      { event: 0, ext: 0 },
      { event: 0, ext: 1 },
      { event: 2, ext: 0 },
      { event: 3, ext: 0 },
    ]);
  });
});

describe("alignLyrics", () => {
  it("fills slots in order and reports leftovers and words that fall on a dash", () => {
    const { score } = parseScore("---\n1 - 2");
    const result = alignLyrics(lyricSlots(score), parseLyrics("一 二 三 四"));
    expect(result.bySlot.map((i) => (i?.kind === "word" ? i.text : null))).toEqual(["一", "二", "三"]);
    expect(show(result.extra)).toEqual(["四"]);
    expect(result.misplaced).toEqual([1]);
  });

  it("leaves extra notes without lyrics", () => {
    const { score } = parseScore("---\n1 2 3");
    expect(alignLyrics(lyricSlots(score), parseLyrics("一")).bySlot.map((i) => i !== null)).toEqual([true, false, false]);
  });
});

describe("buildLyrics", () => {
  it("is null for a score without lyrics", () => {
    expect(buildLyrics(parseScore("---\n1 2").score)).toBeNull();
    expect(buildLyrics(parseScore("---\n1 2\n---\n   ").score)).toBeNull();
  });

  it("looks items up by slot and keeps the leftovers", () => {
    const lyrics = buildLyrics(parseScore("---\n1 - 2\n---\n一-二三").score)!;
    expect(lyrics.itemAt({ event: 0, ext: 1 })?.kind).toBe("hold");
    expect(lyrics.itemAt({ event: 1, ext: 0 })).toMatchObject({ kind: "word", text: "二" });
    expect(lyrics.itemAt({ event: 9, ext: 0 })).toBeNull();
    expect(show(lyrics.extra)).toEqual(["三"]);
  });
});

describe("built-in lyrics", () => {
  it("fill every built-in's slots exactly, in both languages, with no word on a dash", () => {
    for (const builtin of BUILTIN_SCORES) {
      const slots = lyricSlots(parseScore(builtin.text).score);
      for (const text of Object.values(builtin.lyrics)) {
        const { bySlot, extra, misplaced } = alignLyrics(slots, parseLyrics(text));
        expect(extra).toEqual([]);
        expect(bySlot.every((i) => i !== null)).toBe(true);
        expect(misplaced).toEqual([]);
      }
    }
  });
});
