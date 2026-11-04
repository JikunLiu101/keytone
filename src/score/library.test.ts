import { describe, expect, it } from "vitest";
import {
  addScore,
  duplicateScore,
  exportScore,
  listScores,
  removeScore,
  resolveScore,
  sanitizeLibrary,
  uniqueTitle,
  updateScore,
  userScores,
} from "./library";

describe("library", () => {
  it("adds, updates, resolves and removes user scores", () => {
    const id = addScore("title: Mine\n---\n1 2 3");
    expect(resolveScore(id, "en")).toMatchObject({ id, title: "Mine", builtin: false });
    updateScore(id, "title: Renamed\n---\n1");
    expect(resolveScore(id, "en").title).toBe("Renamed");
    removeScore(id);
    expect(listScores("en").some((s) => s.id === id)).toBe(false);
    // Unknown ids fall back to the first built-in.
    expect(resolveScore(id, "en").builtin).toBe(true);
  });

  it("numbers repeated titles", () => {
    const a = addScore(`title: ${uniqueTitle("Untitled", "en")}\n---\n`);
    const b = addScore(`title: ${uniqueTitle("Untitled", "en")}\n---\n`);
    expect([resolveScore(a, "en").title, resolveScore(b, "en").title]).toEqual(["Untitled", "Untitled 2"]);
    removeScore(a);
    removeScore(b);
  });

  it("keeps a score's own base octave when duplicating, and gives a built-in's copy the one passed", () => {
    const mine = addScore("title: Mine\noctave: 3\n---\n1");
    const copy = duplicateScore(mine, "en");
    expect(resolveScore(copy, "en").score.octave).toBe(3);
    const twinkle = duplicateScore("builtin:twinkle", "en", 5);
    expect(resolveScore(twinkle, "en").score.octave).toBe(5);
    for (const id of [mine, copy, twinkle]) removeScore(id);
  });

  it("exports a score as text, giving a built-in the base remembered for it", () => {
    expect(exportScore("builtin:twinkle", "en", 3)).toMatch(/^octave: 3$/m);
    expect(exportScore("builtin:twinkle", "en", null)).not.toContain("octave:");
    const mine = addScore("title: Mine\noctave: 5\n---\n1");
    expect(exportScore(mine, "en")).toMatch(/^octave: 5$/m);
    removeScore(mine);
  });

  it("duplicates a built-in into an editable copy", () => {
    const id = duplicateScore("builtin:twinkle", "zh");
    const copy = resolveScore(id, "zh");
    expect(copy.builtin).toBe(false);
    expect(copy.title).toBe("小星星（副本）");
    expect(copy.score.events.length).toBe(resolveScore("builtin:twinkle", "zh").score.events.length);
    removeScore(id);
    expect(userScores.get().list).toEqual([]);
  });

  it("gives built-ins lyrics in the UI language, and a copy keeps them", () => {
    expect(resolveScore("builtin:birthday", "zh").score.lyrics.startsWith("祝你生日快乐")).toBe(true);
    expect(resolveScore("builtin:birthday", "en").score.lyrics.startsWith("Hap-py")).toBe(true);
    const id = duplicateScore("builtin:birthday", "en");
    expect(resolveScore(id, "zh").score.lyrics.startsWith("Hap-py")).toBe(true);
    removeScore(id);
  });

  it("drops malformed stored entries", () => {
    expect(sanitizeLibrary([{ id: "user:a", text: "1" }, { id: "builtin:x", text: "1" }, { id: "user:b" }, null])).toEqual([
      { id: "user:a", text: "1" },
    ]);
    expect(sanitizeLibrary("junk")).toEqual([]);
  });
});
