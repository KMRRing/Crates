// Codeword's frame (docs/codeword.md): the page never scrolls and nothing changes size mid-game. Two rules in its
// stylesheet keep that, and a browser can't be asked here, so they are read:
// - the grid's rows are as explicit as its columns (n equal tracks), never left to the engine to share out, so a row is
//   never a pixel taller than its neighbour and a letter or a number can never make one grow;
// - the part of the page under the grid is spaced by its parts' own margins, never by a gap between template rows, so a
//   part that is not there (the key table on a phone, the mystery word's row before there is one) leaves no dead gap.
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const css = fs.readFileSync(new URL("../codeword.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const rule = sel => (css.match(new RegExp(`(?:^|\\})\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`)) || [])[1] || "";

const board = rule(".cw-board"), side = rule(".cw-side");
check(/grid-template-rows:\s*repeat\(var\(--n\),\s*minmax\(0,\s*1fr\)\)/.test(board), "the grid's rows are n equal tracks, as its columns are");
check(/grid-auto-rows:\s*0/.test(board), "and no row beyond them");
check(side && !/(^|[;\s])(row-)?gap:/.test(side), "the part under the grid has no gap between its rows");
check(/\.cw-side\s*>\s*\*\s*\{\s*margin-top:/.test(css), "its parts are spaced by their own top margins");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("codeword frame: equal rows, parts spaced by margins");
