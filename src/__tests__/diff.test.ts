import { describe, expect, it } from "vitest";
import { diffLines, renderDiff } from "../diff";

describe("diffLines", () => {
  it("keeps lines aligned after an inserted watermark", () => {
    const rows = diffLines(["1", "软件"], ["0", "繁化姬", "1", "軟體"]);
    expect(rows).toEqual([
      { t: "insert", conv: "0" },
      { t: "insert", conv: "繁化姬" },
      { t: "equal", conv: "1" },
      { t: "replace", orig: "软件", conv: "軟體" },
    ]);
  });

  it("pairs deletes with inserts as replaces and leaves the rest unpaired", () => {
    expect(diffLines(["a", "b", "c"], ["x"])).toEqual([
      { t: "replace", orig: "a", conv: "x" },
      { t: "delete", orig: "b" },
      { t: "delete", orig: "c" },
    ]);
  });

  it("falls back to index alignment for very large inputs", () => {
    const o = Array.from({ length: 2001 }, (_, i) => `o${i}`);
    const c = Array.from({ length: 2001 }, (_, i) => (i === 5 ? "x" : `o${i}`));
    const rows = diffLines(o, c);
    expect(rows).toHaveLength(2001);
    expect(rows[5]).toEqual({ t: "replace", orig: "o5", conv: "x" });
    expect(rows[6]).toEqual({ t: "equal", conv: "o6" });
  });
});

describe("renderDiff", () => {
  it("counts changed lines and escapes text", () => {
    const { html, changedLines } = renderDiff("<a>\n软件", "<a>\n軟體", "Taiwan");
    expect(changedLines).toBe(1);
    expect(html).toContain("&lt;a&gt;");
    expect(html).not.toContain("<a>");
    expect(html).not.toContain('lang="zh-Hans"');
  });

  it("marks Simplified output for a Simplified face", () => {
    expect(renderDiff("軟體", "软件", "Simplified").html).toContain('lang="zh-Hans"');
  });
});
