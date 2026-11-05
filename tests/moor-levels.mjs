// Moor's ladder (moor-levels.js): the chapters, each level's kind and the stars. The shape of the ladder is checked here and a
// few of its puzzles made; tests/moor-ladder.mjs makes every level's own puzzle (slow: the nightly run).
import fs from "node:fs";
import { CHAPTERS, LEVELS, COUNT, chapterOf, seedOf, levelPuzzle, kindOf, parOf, starsFor } from "../moor-levels.js";
import { HEX_LEVELS, SIZES, HEX_SIZES, flagsOf, twistOn, puzzleOf, gradeOf, ORDER } from "../moor-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;

// ---------- the shape ----------
{
  check(COUNT === LEVELS.length && COUNT >= 40, `${COUNT} levels`);
  check(CHAPTERS[0].from === 0 && CHAPTERS.every((c, i) => i === 0 || c.from > CHAPTERS[i - 1].from) && CHAPTERS.every(c => c.from < COUNT && c.name && c.about), "chapters begin in order, each named and with what it brings");
  check(LEVELS.every((L, i) => L.name && L.level && ORDER.includes(L.level)) && new Set(LEVELS.map(L => L.name)).size === COUNT, "every level has a name of its own and a level");
  check(LEVELS.every(L => (L.shape === "hex" ? HEX_SIZES.includes(L.size) && HEX_LEVELS[L.size].includes(L.level) : SIZES.includes(L.size))), "every level is a size its board has, at a level the board can give");
  check(LEVELS.every(L => twistOn(L.twist) === L.twist), "every level's twist is written as the engine names it");
  const first = c => LEVELS[CHAPTERS[c].from], inChapter = c => LEVELS.filter((_, i) => chapterOf(i) === c);
  const has = (list, t) => list.some(L => flagsOf(L.twist)[t]);
  check(inChapter(0).every(L => L.twist === "none" && L.shape === "square"), "the first chapter is the plain game");
  check(inChapter(1).every(L => L.shape === "square") && has(inChapter(1), "walls") && !has(inChapter(1), "doubles") && !has(inChapter(1), "ranges"), "sea walls come alone");
  check(has(inChapter(2), "doubles") && inChapter(2).some(L => L.twist === "walls+doubles") && !has(inChapter(2), "ranges"), "double docks end on a block with the walls");
  check(has(inChapter(3), "ranges") && inChapter(3).some(L => L.twist !== "ranges" && flagsOf(L.twist).ranges), "ranges end on a block with what came before");
  check(inChapter(4).some(L => L.shape === "hex" && L.twist === "none") && inChapter(4).every(L => L.shape === "hex") && inChapter(4).some(L => L.twist !== "none"), "the hex basin begins plain and ends with the twists");
  check(inChapter(5).every(L => L.twist.split("+").length >= 2) && inChapter(5).some(L => L.shape === "hex") && inChapter(5).some(L => L.shape === "square"), "the gauntlet mixes two or three twists, on both boards");
  check(first(0).level === "easy" && LEVELS.at(-1).level === "expert", "the ladder runs from Easy to Expert");
  check(new Set(LEVELS.map((_, i) => seedOf(i))).size === COUNT, "every level has a seed of its own");
  check(JSON.stringify(kindOf(3)) === JSON.stringify({ size: LEVELS[3].size, level: LEVELS[3].level, twist: "none", shape: "square" }), "a level's kind is what the generator is asked for");
}

// ---------- a few puzzles ----------
{
  const t0 = Date.now();
  let ok = true, same = true;
  for (const i of [0, 6, 11, 17, 24, 30]) {
    const p = levelPuzzle(i), L = LEVELS[i];
    if (!p || p.level !== L.level) ok = false;
    if (!p) continue;
    const P = puzzleOf(L.size, p.grid, p.sol, { shape: L.shape, walls: p.walls, ranges: p.ranges }), f = flagsOf(L.twist);
    if (ORDER[gradeOf(P)] !== p.level || (f.walls && !p.walls) || (f.doubles && !/2/.test(p.grid)) || (f.ranges && !p.ranges) || (L.shape === "hex") !== (p.shape === "hex")) ok = false;
  }
  check(ok, "a level's own puzzle comes at its level, with its twists, on its board");
  same = JSON.stringify(levelPuzzle(11)) === JSON.stringify(levelPuzzle(11, seedOf(11)));
  check(same, "a level's own seed gives the same puzzle every time");
  console.log(`  (${Date.now() - t0} ms)`);
}

// ---------- the stars ----------
{
  const p = { ...levelPuzzle(2), size: LEVELS[2].size }, par = parOf(p);
  check(Number.isInteger(par) && par > 0, "the par is a whole number of seconds");
  check(starsFor(p, par) === 3 && starsFor(p, par + 1) === 2 && starsFor(p, 2 * par) === 2 && starsFor(p, 2 * par + 1) === 1 && starsFor(p, 0) === 3 && starsFor(p, 100000) === 1, "three stars within the par, two within twice it, one for solving it");
  const pars = [0, 5, 14, 22, 28].map(i => parOf({ ...levelPuzzle(i), size: LEVELS[i].size }));
  check(pars.every(x => x >= 15 && x <= 900), `every par is between fifteen seconds and fifteen minutes (${Math.min(...pars)} to ${Math.max(...pars)} s)`);
  const easy = parOf({ ...levelPuzzle(0), size: 6 }), big = parOf({ ...levelPuzzle(5), size: 10 });
  check(big > easy, "a bigger, harder puzzle has a longer par");
}

// ---------- the page ----------
{
  const page = fs.readFileSync(root + "moor.js", "utf8");
  check(/moor:camp/.test(page) && /moor:lruns/.test(page) && /moor:track/.test(page), "the ladder's saves are kept under moor:");
  check(/hashOf = s => \(isLevel\(s\)/.test(page) && /#lv=/.test(page), "a level has a link of its own");
}

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nall ok");
