// The digit grid's pure parts, which Sudoku, Calcudoku and Kakuro share: the entries (digits-edit.js: writing, pencil
// marks, rubbing out, undo and redo as one move each, notes cleared from a written digit's peers, repeats found,
// everything through JSON), and the board's lines (linesOf in digits.js: heavy rules between regions, cages drawn in
// dashes inside their cells, a clue cell's diagonal).
import { freshEntries, validEntries, write, pencil, rub, fill, set, undo, redo, lastMoved, repeats } from "../digits-edit.js";
import { linesOf } from "../digits.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the entries ----------
{
  const e = freshEntries(16);
  check(validEntries(e, 16) && !validEntries(e, 81) && !validEntries({ ...e, v: e.v.slice(1) }, 16) && !validEntries(null, 16), "fresh entries for a grid, and only for its size");
  pencil(e, 5, 2); pencil(e, 5, 3); pencil(e, 6, 2);
  check(e.n[5] === ((1 << 2) | (1 << 3)) && e.n[6] === 1 << 2 && e.past.length === 3, "pencil marks, one move each");
  write(e, 1, 2, { clear: [5, 6, 9] });
  check(e.v[1] === 2 && e.n[5] === 1 << 3 && e.n[6] === 0 && e.past.length === 4, "a digit written clears its pencil mark from the cells given");
  check(!pencil(e, 1, 4) && e.n[1] === 0, "a cell with a digit takes no pencil marks");
  undo(e);
  check(e.v[1] === 0 && e.n[5] === ((1 << 2) | (1 << 3)) && e.n[6] === 1 << 2 && e.future.length === 1, "undo takes the digit and the marks it cleared back together");
  redo(e);
  check(e.v[1] === 2 && e.n[6] === 0 && e.future.length === 0 && lastMoved(e).sort().join() === "1,5,6", "redo puts it all back; the last move's cells are known");
  write(e, 1, 2);
  check(e.v[1] === 0, "writing the same digit again rubs it out");
  write(e, 1, 4); undo(e); pencil(e, 7, 1);
  check(e.future.length === 0, "a new move after an undo drops what redo would have done");
  rub(e, 5);
  check(e.n[5] === 0, "rubbing out an empty cell clears its marks");
  fill(e, { 2: 6, 3: 10 });
  check(e.n[2] === 6 && e.n[3] === 10 && (undo(e), e.n[2] === 0 && e.n[3] === 0), "every mark filled in is one move");
  set(e, [[0, 3, 0], [4, 1, 0]]);
  check(e.v[0] === 3 && e.v[4] === 1, "several cells set at once");
  const back = JSON.parse(JSON.stringify(e));
  check(validEntries(back, 16) && (undo(back), back.v[0] === 0 && back.v[4] === 0), "entries come back from JSON whole, their undo too");
  const many = freshEntries(9);
  for (let k = 0; k < 400; k++) pencil(many, k % 9, 1);
  check(many.past.length === 300, "undo keeps the last 300 moves");
}

// ---------- repeats ----------
{
  const values = [1, 2, 0, 1, 0, 0, 0, 0, 3];
  const units = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8]];
  const r = repeats(values, units);
  check(r.has(0) && r.has(3) && r.size === 2, "a digit twice in a unit marks both, and nothing else");
  check(repeats(values, [[2, 4, 5]]).size === 0, "empty cells are never repeats");
}

// ---------- the board's lines ----------
{
  const boxes = Array.from({ length: 16 }, (_, i) => Math.floor(Math.floor(i / 4) / 2) * 2 + Math.floor((i % 4) / 2));
  const svg = linesOf({ rows: 4, cols: 4, regions: boxes });
  const heavy = /class="dg-heavy" d="([^"]*)"/.exec(svg)?.[1] || "";
  check((heavy.match(/M/g) || []).length === 8 && svg.includes('class="dg-frame"') && (/class="dg-thin" d="([^"]*)"/.exec(svg)[1].match(/M/g) || []).length === 6,
    "a 4×4 of 2×2 boxes: eight heavy segments between the boxes, six hairlines, the frame");
  const cage = linesOf({ rows: 3, cols: 3, cages: [{ cells: [0, 1, 4], label: "6" }] });
  const dashes = /class="dg-cage" d="([^"]*)"/.exec(cage)?.[1] || "";
  check((dashes.match(/M/g) || []).length === 8, "an L of three cells: its outline in eight sides, each facing out of the cage");
  check(dashes.includes("M9 9H100") && dashes.includes("M9 91H109") && dashes.includes("M109 91V"),
    "set in from an outer corner, and at the inner corner the two sides meet (a cell's bottom running on to the side of the one below its neighbour)");
  const rules = linesOf({ rows: 2, cols: 2, cages: [{ cells: [0, 1] }, { cells: [2, 3] }], cageRules: true });
  check(/class="dg-heavy" d="M0 100H100M100 100H200"/.test(rules) && !rules.includes("dg-cage"), "Calcudoku's cages as heavy rules, with no dashes");
  const kakuro = linesOf({ rows: 2, cols: 2, kinds: ["clue", "", "", ""] });
  check(kakuro.includes('class="dg-split" d="M0 0L100 100"'), "a clue cell is split by its diagonal");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("digits: the entries, their undo, the repeats and the board's lines");
