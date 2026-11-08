// Cross-number (Crossword's Numbers clues): the pool Quote's bank gives, the grids grown from it (every entry read
// off the grid is its answer, no run of squares is left without a clue, nothing in a clue gives another answer), a
// seed making the same grid, and the play rules taking digits.
// Run: node tests/crossnumber.mjs
import fs from "fs";
globalThis.window = {};
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const E = await import("../crossword-engine.js");
const N = await import("../crossnumber-engine.js");

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } else console.log(`ok   ${what}`); };

const pool = N.pool();
check(pool.length >= 150 && pool.every(p => /^\d{3,6}$/.test(p.answer)), `the pool is ${pool.length} questions with whole-number answers`);
check(new Set(pool.map(p => p.text)).size === pool.length && !pool.some(p => /\bthis\b/i.test(p.text)), "each stands alone, none twice");
check(E.KINDS.numbers === "Numbers" && E.kindOf("numbers") === "numbers", "Numbers is a kind of clue");

// every run of two squares or more, read off the rows, is exactly one entry's cells
const runs = rows => {
  const R = rows.length, C = rows[0].length, out = [];
  const white = (r, c) => r >= 0 && c >= 0 && r < R && c < C && rows[r][c] !== "#";
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    if (!white(r, c)) continue;
    if (!white(r, c - 1) && white(r, c + 1)) { let k = c; while (white(r, k)) k++; out.push(["across", r * C + c, k - c]); }
    if (!white(r - 1, c) && white(r + 1, c)) { let k = r; while (white(k, c)) k++; out.push(["down", r * C + c, k - r]); }
  }
  return out;
};
for (const level of ["easy", "medium", "hard"]) {
  const L = N.NUM_LEVELS[level];
  let made = 0, sound = true, sizes = true, texts = true, plays = true, said = true;
  for (let seed = 1; seed <= 25; seed++) {
    const p = E.makePuzzle({ seed, level, kind: "numbers" });
    if (!p) continue;
    made++;
    const C = p.rows[0].length;
    const found = runs(p.rows).map(r => r.join()).sort(), have = p.entries.map(e => [e.dir, e.cells[0], e.len].join()).sort();
    if (found.join("|") !== have.join("|")) sound = false;
    if (!p.entries.every(e => e.cells.map(k => p.rows[(k / C) | 0][k % C]).join("") === e.answer && e.letters === e.answer)) sound = false;
    if (p.rows.length > L.size || C > L.size) sizes = false;
    if (new Set(p.entries.map(e => e.text)).size !== p.entries.length || new Set(p.entries.map(e => e.answer)).size !== p.entries.length) texts = false;
    if (p.entries.some(e => p.entries.some(f => f !== e && e.text.replace(/,/g, "").includes(f.answer)))) said = false;
    const nums = E.numbers(p);
    if (!p.entries.every(e => nums[e.cells[0]] === e.num)) sound = false;
    const pl = E.freshPlay(p);
    if (/\d/.test(pl.letters) || E.solvedBy(pl, p)) plays = false;
    for (const e of p.entries) e.cells.forEach((k, i) => E.put(pl, p, k, e.letters[i]));
    if (!E.solvedBy(pl, p) || !E.full(pl)) plays = false;
  }
  check(made >= 24, `${level}: grids come (${made} of 25)`);
  check(sound, `${level}: the entries are exactly the runs of squares, read off right, numbered as printed`);
  check(sizes && texts && said, `${level}: within ${L.size} squares, no clue or answer twice, no clue gives another answer`);
  check(plays, `${level}: empty to start, solved by typing the digits`);
}
const a = E.makePuzzle({ seed: 7, level: "medium", kind: "numbers" }), b = E.makePuzzle({ seed: 7, level: "medium", kind: "numbers" });
check(JSON.stringify(a) === JSON.stringify(b), "a seed makes the same grid");
const q = E.makePuzzle({ seed: 7, level: "medium", kind: "numbers" }), pl = E.freshPlay(q);
check(E.put(pl, q, q.entries[0].cells[0], "1") && pl.letters[q.entries[0].cells[0]] === "1", "a digit goes in a square");
check(E.reveal(pl, q, [q.entries[1].cells[1]]) === 1 && E.check(pl, q, [q.entries[0].cells[0]]) <= 1, "reveal and check work on digits");
console.log(bad ? `${bad} FAILED` : "all passed");
process.exit(bad ? 1 : 0);
