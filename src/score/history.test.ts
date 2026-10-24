import { describe, expect, it } from "vitest";
import { createHistory } from "./history";

describe("createHistory", () => {
  it("undoes and redoes", () => {
    const h = createHistory<string>();
    h.push("a");
    h.push("b");
    expect(h.undo("c")).toBe("b");
    expect(h.undo("b")).toBe("a");
    expect(h.undo("a")).toBeNull();
    expect(h.redo("a")).toBe("b");
    expect(h.redo("b")).toBe("c");
    expect(h.redo("c")).toBeNull();
  });

  it("forgets the redo steps after a new change", () => {
    const h = createHistory<string>();
    h.push("a");
    expect(h.undo("b")).toBe("a");
    h.push("a");
    expect(h.redo("x")).toBeNull();
  });

  it("makes one undo step of changes in the same group less than a second apart", () => {
    let now = 0;
    const h = createHistory<string>(200, () => now);
    h.push("", "lyrics");
    now = 400;
    h.push("a", "lyrics");
    now = 800;
    h.push("ab", "lyrics");
    now = 2500;
    h.push("abc", "lyrics");
    expect(h.undo("abcd")).toBe("abc");
    expect(h.undo("abc")).toBe("");
  });

  it("keeps a different group as its own step", () => {
    let now = 0;
    const h = createHistory<string>(200, () => now);
    h.push("a", "lyrics");
    now = 100;
    h.push("b", "title");
    expect(h.undo("c")).toBe("b");
    expect(h.undo("b")).toBe("a");
  });

  it("drops the oldest steps past its limit, and can be cleared", () => {
    const h = createHistory<number>(2);
    h.push(1);
    h.push(2);
    h.push(3);
    expect(h.undo(4)).toBe(3);
    expect(h.undo(3)).toBe(2);
    expect(h.undo(2)).toBeNull();
    h.push(5);
    h.clear();
    expect(h.undo(6)).toBeNull();
  });
});
