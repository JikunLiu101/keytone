import { describe, expect, it } from "vitest";
import {
  addScore,
  duplicateScore,
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

  it("duplicates a built-in into an editable copy", () => {
    const id = duplicateScore("builtin:twinkle", "zh");
    const copy = resolveScore(id, "zh");
    expect(copy.builtin).toBe(false);
    expect(copy.title).toBe("小星星（副本）");
    expect(copy.score.events.length).toBe(resolveScore("builtin:twinkle", "zh").score.events.length);
    removeScore(id);
    expect(userScores.get().list).toEqual([]);
  });

  it("drops malformed stored entries", () => {
    expect(sanitizeLibrary([{ id: "user:a", text: "1" }, { id: "builtin:x", text: "1" }, { id: "user:b" }, null])).toEqual([
      { id: "user:a", text: "1" },
    ]);
    expect(sanitizeLibrary("junk")).toEqual([]);
  });
});
