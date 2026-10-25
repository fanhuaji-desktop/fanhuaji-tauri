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

  it("marks a line added in the middle as an insert", () => {
    expect(diffLines(["a", "c"], ["a", "b", "c"])).toEqual([
      { t: "equal", conv: "a" },
      { t: "insert", conv: "b" },
      { t: "equal", conv: "c" },
    ]);
  });

  it("pads the shorter side in the large-input fallback", () => {
    const o = Array.from({ length: 2001 }, (_, i) => `o${i}`);
    const c = Array.from({ length: 2002 }, (_, i) => `o${i}`);
    const rows = diffLines(o, c);
    expect(rows).toHaveLength(2002);
    expect(rows[2001]).toEqual({ t: "replace", orig: "", conv: "o2001" });
    expect(diffLines(c, o)[2001]).toEqual({ t: "replace", orig: "o2001", conv: "" });
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

  it("renders inserted, removed and blank lines", () => {
    const added = renderDiff("a", "a\nb", "Taiwan");
    expect(added.changedLines).toBe(1);
    expect(added.html).toContain('class="diff-line added"');
    const removed = renderDiff("a\nb", "a", "Taiwan");
    expect(removed.changedLines).toBe(0);
    expect(removed.html).toContain('class="diff-line removed"');
    expect(renderDiff("", "", "Taiwan").html).toContain("&nbsp;");
    expect(renderDiff("", "y", "Taiwan").html).toContain("&nbsp;");
    expect(renderDiff("a", "a\n", "Taiwan").html).toContain('<span class="chg">&nbsp;</span>');
    expect(renderDiff("a\n", "a", "Taiwan").html).toContain('<div class="diff-orig">&nbsp;</div>');
    expect(renderDiff("我软件", "我軟體", "Taiwan").html).toContain(
      '我<span class="chg">軟體</span>',
    );
  });

  it("marks Simplified output for a Simplified face", () => {
    expect(renderDiff("軟體", "软件", "Simplified").html).toContain('lang="zh-Hans"');
  });
});
