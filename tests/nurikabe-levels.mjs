// Dujiang's ladder (nurikabe-levels.js): chapters in order, every level a kind of puzzle the engine can deal, the first puzzle of a
// level the same for everyone, and the stars. The small levels' puzzles are made and checked here (one answer, the level
// asked for); tests/nurikabe-ladder.mjs makes every level's, which takes a while.
import { LEVELS, CHAPTERS, COUNT, chapterOf, seedOf, kindOf, levelPuzzle, parOf, starsFor } from "../nurikabe-levels.js";
import { SIZES, ORDER, twistOn, puzzleOf, count } from "../nurikabe-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(COUNT === LEVELS.length && COUNT >= 24 && new Set(LEVELS.map(L => L.name)).size === COUNT, `${COUNT} levels, each with a name of its own`);
check(LEVELS.every(L => SIZES.includes(L.size) && ORDER.includes(L.level) && twistOn(L.twist) === L.twist), "every level asks for a size, a level and a twist the engine knows (twist names canonical)");
check(CHAPTERS[0].from === 0 && CHAPTERS.every((c, i) => !i || c.from > CHAPTERS[i - 1].from) && CHAPTERS.at(-1).from < COUNT && chapterOf(0) === 0 && chapterOf(COUNT - 1) === CHAPTERS.length - 1, "the chapters run in order from the first level to the last");
// each chapter brings its one twist; the gauntlet mixes them
const chapterTwists = CHAPTERS.map((c, i) => new Set(LEVELS.slice(c.from, CHAPTERS[i + 1]?.from ?? COUNT).map(L => L.twist)));
check(chapterTwists[0].size === 1 && chapterTwists[0].has("none") && chapterTwists[1].size === 1 && chapterTwists[1].has("ranges") && chapterTwists[2].size === 1 && chapterTwists[2].has("unknown") && chapterTwists[3].size === 1 && chapterTwists[3].has("bridges")
  && [...chapterTwists.at(-1)].every(t => t.includes("+")), "the plain game, then bounds, unknown islands and arch bridges each in a chapter of their own, then a gauntlet of mixed twists");
check(new Set(LEVELS.map((_, i) => seedOf(i))).size === COUNT && kindOf(3).size === LEVELS[3].size, "each level has a seed of its own");
check(levelPuzzle(1)?.grid === levelPuzzle(1)?.grid && levelPuzzle(1).grid !== levelPuzzle(1, 4).grid, "a level's first puzzle is the same every time, and a new seed makes another");
{
  const p = { grid: "1-2---3", level: "medium", bd: "---?---" }, par = parOf(p);
  check(par > 0 && starsFor(p, par) === 3 && starsFor(p, par * 2) === 2 && starsFor(p, par * 2 + 1) === 1 && parOf({ ...p, bd: "-------" }) < par, "stars: three within the par, two within twice it, else one; a ? counts as a stone");
}
{
  let fine = 0, small = 0;
  for (let i = 0; i < COUNT; i++) {
    if (LEVELS[i].size > 6) continue;
    const p = levelPuzzle(i), P = puzzleOf(LEVELS[i].size, p.grid, p.sol, p);
    small++;
    if (count(P, 2) === 1 && p.level === LEVELS[i].level) fine++;
    else console.log("  level", i + 1, LEVELS[i].name, "came", p.level);
  }
  check(small >= 6 && fine === small, `the ${small} small levels deal a puzzle with one answer at the level they ask for`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("nurikabe levels: the ladder holds");
