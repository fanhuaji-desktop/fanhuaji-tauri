import { type DiffSeg, escHtml, inlineDiff } from "./utils";

export type DiffRow =
  | { t: "equal"; conv: string }
  | { t: "replace"; orig: string; conv: string }
  | { t: "insert"; conv: string }
  | { t: "delete"; orig: string };

// Line-level LCS diff. zhconvert prepends a watermark block (a cue "0" +
// "Processed by 繁化姬 … zhconvert.org") to subtitle output; a naive index
// alignment would then mark every following line as changed. LCS treats the
// watermark as an insertion and keeps the rest aligned.
export function diffLines(o: string[], c: string[]): DiffRow[] {
  const n = o.length;
  const m = c.length;

  // Guard against pathological inputs (e.g. a file of single-character lines).
  if (n * m > 4_000_000) {
    const max = Math.max(n, m);
    const rows: DiffRow[] = [];
    for (let i = 0; i < max; i++) {
      const a = o[i] ?? "";
      const b = c[i] ?? "";
      rows.push(a === b ? { t: "equal", conv: b } : { t: "replace", orig: a, conv: b });
    }
    return rows;
  }

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = o[i] === c[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  const dels: string[] = [];
  const inss: string[] = [];
  // Pair a run of deletes with the following run of inserts as char-highlighted
  // replaces; leftovers become pure insert/delete rows.
  const flush = () => {
    const pairs = Math.max(dels.length, inss.length);
    for (let p = 0; p < pairs; p++) {
      const od = dels[p];
      const ic = inss[p];
      if (od !== undefined && ic !== undefined) rows.push({ t: "replace", orig: od, conv: ic });
      else if (ic !== undefined) rows.push({ t: "insert", conv: ic });
      else rows.push({ t: "delete", orig: od });
    }
    dels.length = 0;
    inss.length = 0;
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (o[i] === c[j]) {
      flush();
      rows.push({ t: "equal", conv: c[j] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      dels.push(o[i++]);
    } else {
      inss.push(c[j++]);
    }
  }
  while (i < n) dels.push(o[i++]);
  while (j < m) inss.push(c[j++]);
  flush();
  return rows;
}

const segsHtml = (segs: DiffSeg[]): string =>
  segs
    .map((g) => (g.changed ? `<span class="chg">${escHtml(g.text)}</span>` : escHtml(g.text)))
    .join("");

// Simplified output gets a Simplified Chinese face; the bundled Noto Sans TC would draw
// Traditional-style glyphs for characters both scripts share.
const SIMPLIFIED_CONVERTERS = new Set(["Simplified", "China", "WikiSimplified"]);

export function renderDiff(
  original: string,
  converted: string,
  converter: string,
): { html: string; changedLines: number } {
  const lang = SIMPLIFIED_CONVERTERS.has(converter) ? ' lang="zh-Hans"' : "";
  const rows = diffLines(original.split("\n"), converted.split("\n"));
  const out: string[] = [];
  let changedLines = 0;
  let ln = 0; // converted-side line number for display
  for (const r of rows) {
    if (r.t === "equal") {
      ln++;
      out.push(
        `<div class="diff-line"><span class="diff-num">${ln}</span><div class="diff-conv"${lang}>${escHtml(r.conv) || "&nbsp;"}</div></div>`,
      );
    } else if (r.t === "replace") {
      ln++;
      changedLines++;
      const d = inlineDiff(r.orig, r.conv);
      out.push(
        `<div class="diff-line changed"><span class="diff-num">${ln}</span><div><div class="diff-orig">${segsHtml(d.orig) || "&nbsp;"}</div><div class="diff-conv"${lang}>${segsHtml(d.conv)}</div></div></div>`,
      );
    } else if (r.t === "insert") {
      ln++;
      changedLines++;
      out.push(
        `<div class="diff-line added"><span class="diff-num">${ln}</span><div class="diff-conv"${lang}><span class="chg">${escHtml(r.conv) || "&nbsp;"}</span></div></div>`,
      );
    } else {
      out.push(
        `<div class="diff-line removed"><span class="diff-num">−</span><div class="diff-orig">${escHtml(r.orig) || "&nbsp;"}</div></div>`,
      );
    }
  }
  return { html: out.join(""), changedLines };
}
