// Loom's cloths (loom-float.js, loom-levels.js): a nonogram of floats. The clue of a pick or a thread is the lengths of its own
// yarn's floats (gold's among them), the solver is the nonogram line solver's, a shaft ties crossings into one variable, a
// crossing of one colour is settled and a float runs on across it, and every level of the ladder is a cloth whose clues have
// exactly one answer, the same from the same seed. The page's ids are checked against loom.html.
import { readFileSync } from "node:fs";
import { makePuzzle, makeUnique, count, grade, start, propagate, done, nextStep, met, lineMet, fixed, isKnown, stateOf, WARP, WEFT, GOLD } from "../loom-float.js";
import { LEVELS, CHAPTERS, WEAVES, levelOf, chapterOf, makeLevel, starsFor, seedOf, GOLD_YARN } from "../loom-levels.js";
import { YARNS } from "../loom-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const W = WARP, F = WEFT, G = GOLD;
const txt = clue => clue.map(([n, k]) => (k === 2 ? `${n}g` : n)).join(" ");

// ---------- a clue is the lengths of a yarn's floats ----------
{
  // 5 threads of yarn 0, 3 picks of yarn 1: a pick's weft shows where it is over, a thread's warp where it is
  const cells = [W, W, F, F, F,  F, W, W, W, F,  F, F, F, F, F];
  const p = makePuzzle({ w: 5, h: 3, warp: Array(5).fill(0), weft: Array(3).fill(1), cells });
  check(txt(p.clues[0]) === "3" && txt(p.clues[1]) === "1 1" && txt(p.clues[2]) === "5", "a pick's clue is the lengths of its weft's floats, in order");
  check(txt(p.clues[3]) === "1" && txt(p.clues[4]) === "2" && txt(p.clues[5]) === "1" && txt(p.clues[6]) === "1" && txt(p.clues[7]) === "", "a thread's clue is the lengths of its warp's floats down it");
  check(p.lines.length === 8 && p.lines.slice(0, 3).every(l => l.cells.length === 5) && p.lines.slice(3).every(l => l.cells.length === 3), "rows first, then columns");
  check(met(p, p.sol) && lineMet(p, 0, p.sol) && !met(p, Uint8Array.from(cells.map((c, i) => (i === 0 ? F : c)))), "a cloth meets its clues; change one crossing and it doesn't");
  check(JSON.stringify(p.clues) === JSON.stringify(JSON.parse(JSON.stringify(p.clues))), "clues keep through JSON");
}
{
  // gold: a third yarn, hiding both; a clue lists its floats among the line's own in the order they come
  const cells = [F, G, G, F, W,  W, W, G, F, F];
  const p = makePuzzle({ w: 5, h: 2, warp: Array(5).fill(0), weft: [1, 1], gold: 6, cells });
  check(txt(p.clues[0]) === "1 2g 1" && txt(p.clues[1]) === "1g 2", "gold's floats are listed in a line's clue with the line's own, in order");
  check(txt(p.clues[2]) === "1" && txt(p.clues[3]) === "1g 1" && txt(p.clues[4]) === "2g" && txt(p.clues[5]) === "" && txt(p.clues[6]) === "1", "and a thread keeps its warp's floats apart from gold's: the crossings under gold are gold's");
}
{
  // colour: a crossing whose yarns are one colour shows that colour whichever is over, so it is settled and a float runs across it
  const warp = [0, 1, 0, 1], weft = [0, 1];
  const cells = [W, F, W, F,  W, W, F, W];
  const p = makePuzzle({ w: 4, h: 2, warp, weft, cells });
  check(p.tied[0] === 1 && p.tied[2] === 1 && p.tied[5] === 1 && p.tied[7] === 1 && p.tied[1] === 0 && fixed(p, 0) && !fixed(p, 1), "crossings of one colour are settled, the rest are the player's");
  // pick 0 (yarn 0) shows yarn 0 at the two settled crossings and wherever its weft is over: all four; pick 1 (yarn 1) shows
  // it at the settled ones and where its weft is over, but not where the warp 0 lies over it
  check(txt(p.clues[0]) === "4" && txt(p.clues[1]) === "3", "a settled crossing counts as its line's own colour, so a float runs across it");
  const q = makePuzzle({ w: 3, h: 1, warp: [0, 0, 0], weft: [0], cells: [W, F, W] });
  check(txt(q.clues[0]) === "3" && q.tied.every(t => t === 1), "a float runs on across settled crossings");
}

// ---------- the solver: the nonogram's line logic, across the crossings ----------
{
  // two answers (a checker either way about) take a pre-woven crossing to settle
  const p = makePuzzle({ w: 2, h: 2, warp: [0, 0], weft: [1, 1], cells: [W, F, F, W] });
  check(count(p).count === 2 && grade(p) === 0, "a cloth whose clues fit two cloths has no single answer (grade 0)");
  const gave = makeUnique(p, 3);
  check(gave === 1 && count(p).count === 1 && p.given.some(g => g === 1), "a crossing pre-woven makes it one");
  const a = start(p);
  check(propagate(p, a) !== null && done(a) && [...Array(p.n).keys()].every(i => stateOf(a[p.cls[i]]) === p.sol[i]), "and the solver finds the cloth");
}
{
  let ok = 0, tried = 0;
  for (const lv of LEVELS.filter(l => l.kind === "random" || l.kind === "gold")) {
    const m = makeLevel(lv, 4242), p = m.puzzle;
    if (m.grade > 2) continue;
    tried++;
    // follow the hints: each step is one line's logic from what is already right, and ends in the cloth
    let known = start(p), steps = 0, good = true;
    while (!done(known) && steps++ < p.n) {
      const s = nextStep(p, known);
      if (!s) { const t = Uint8Array.from(known); propagate(p, t); known = t; continue; }
      if (s.state !== p.sol[s.cell]) good = false;
      known[p.cls[s.cell]] = 1 << s.state;
    }
    if (good && done(known)) ok++;
  }
  check(tried > 0 && ok === tried, `hints follow the line logic and are always right, to the end (${tried} cloths)`);
}

// ---------- a shaft ties crossings together ----------
{
  const w = makePuzzle({ w: 4, h: 4, warp: Array(4).fill(0), weft: Array(4).fill(1), tie: { col: [0, 1, 0, 1], row: [0, 1, 0, 1] }, cells: Array.from({ length: 16 }, (_, i) => ((i % 4) + Math.floor(i / 4)) % 2 ? F : W) });
  check(w.classes === 4 && w.cls[0] === w.cls[2] && w.cls[0] === w.cls[10] && w.cls[0] !== w.cls[1], "threads on one shaft and picks lifted alike are one variable: plain weave has four");
  // a tied crossing (one colour) must not drag the crossings that share its shafts: it is a class of its own
  const c = makePuzzle({ w: 4, h: 4, warp: [0, 1, 0, 1], weft: [0, 0, 1, 1], tie: { col: [0, 1, 0, 1], row: [0, 1, 0, 1] }, cells: Array.from({ length: 16 }, (_, i) => ((i % 4) + Math.floor(i / 4)) % 2 ? F : W) });
  const tiedClasses = new Set(), freeClasses = new Set();
  for (let i = 0; i < 16; i++) (c.tied[i] ? tiedClasses : freeClasses).add(c.cls[i]);
  check([...tiedClasses].every(k => !freeClasses.has(k)) && tiedClasses.size === c.tied.reduce((n, t) => n + t, 0), "a crossing of one colour shares no class with the others");
  check(count(c, { limit: 5 }).count >= 1, "and a plaid on a draft still has its answer");
}

// ---------- the ladder ----------
check(LEVELS.length === 26 && new Set(LEVELS.map(l => l.id)).size === 26 && CHAPTERS.length === 4, "26 levels in four chapters, each with its own id");
check(LEVELS.every(l => chapterOf(l) && levelOf(l.id) === l && l.name && l.story && l.w >= 5 && l.h >= 5 && l.grade[0] <= l.grade[1]), "each level has a chapter, a name, a story, a size and a grade range");
check(LEVELS.every(l => l.id.endsWith("-1") === (LEVELS.filter(m => m.chapter === l.chapter)[0] === l)), "each chapter's first level is numbered 1 (the one that is always open)");
{
  // a recipe's yarn digits must name a yarn it lists, and the lists must name yarns that exist
  const bads = LEVELS.filter(l => l.kind === "colour" && (!l.yarns.every(y => YARNS[y]) || [...l.warp, ...l.weft].some(d => l.yarns[+d] === undefined)));
  check(!bads.length && GOLD_YARN === YARNS.length, `colour recipes use only yarns they list (${bads.map(l => l.id)})`);
  check(Object.values(WEAVES).every(w => w.tie.length === w.S && w.tie.every(r => r.length === w.S) && w.thread.every(s => s >= 0 && s < w.S) && w.tread.every(s => s >= 0 && s < w.S)), "every weave's tie-up, threading and treadling fit its shafts");
}
{
  // every level's canonical cloth, and two more seeds of each of the smaller ones (the biggest take the longest to make)
  let one = 0, same = 0, inGrade = 0, made = 0, total = 0, ms = 0, worst = 0;
  for (const lv of LEVELS) for (const k of lv.w * lv.h <= 100 ? [0, 1, 2] : [0]) {
    const seed = k === 0 ? seedOf(lv) : 91 * k + LEVELS.indexOf(lv) * 7919;
    total++;
    const t = performance.now(), m = makeLevel(lv, seed), dt = performance.now() - t;
    ms += dt; worst = Math.max(worst, dt);
    if (!m) continue;
    made++;
    const p = m.puzzle;
    if (count(p).count === 1) one++;
    if (lv.w * lv.h <= 100) {
      const again = makeLevel(lv, seed);
      if (JSON.stringify([again.puzzle.sol, again.puzzle.given, again.puzzle.clues]) === JSON.stringify([p.sol, p.given, p.clues])) same++;
    } else same++;
    if (grade(p) === m.grade && m.grade >= 1 && m.given <= lv.givens) inGrade++;
  }
  check(made === total, `every level makes a cloth (${made} of ${total} tried)`);
  check(one === total, "and every cloth's clues have exactly one answer");
  check(same === total, "and the same level and seed is the same cloth");
  check(inGrade === total, "and its grade is the one reported, with no more pre-woven crossings than the level allows");
  check(worst < 3000, `and none takes long to make (${(ms / total).toFixed(0)} ms on average, ${worst.toFixed(0)} at worst)`);
  // the hardest of each chapter's range is the one it asks for, where it asks for hardness
  const asked = LEVELS.filter(l => l.grade[0] >= 2).map(l => makeLevel(l, seedOf(l)).grade >= 2);
  check(asked.every(Boolean), "the levels that ask for line logic or a guess need it");
}
{
  // the first cloth of a level is the same for everyone; another seed is another cloth
  const lv = levelOf("plain-5");
  check(seedOf(lv) === 1000 + LEVELS.indexOf(lv) && JSON.stringify(makeLevel(lv, 1).puzzle.sol) !== JSON.stringify(makeLevel(lv, 2).puzzle.sol), "a level's first cloth is canonical, and another seed is another cloth");
  // a mirrored cloth has mirrored clues
  const p = makeLevel(levelOf("plain-2"), 7).puzzle;
  check(p.clues.slice(p.h).every((c, i) => JSON.stringify(c) === JSON.stringify(p.clues[p.h + p.w - 1 - i])), "a mirrored cloth has its thread clues mirrored");
  // a named weave is what it is called: twill's diagonal runs one thread along each pick, plain is a checker
  const t = makeLevel(levelOf("weaves-3"), 5).puzzle, sol = t.sol;
  const diag = d => { for (let r = 0; r + 1 < t.h; r++) for (let c = 0; c < t.w; c++) { const c2 = c + d; if (c2 >= 0 && c2 < t.w && sol[r * t.w + c] !== sol[(r + 1) * t.w + c2]) return false; } return true; };
  check(diag(1) !== diag(-1), "twill's pattern moves one thread along each pick, one way or the other");
  const pl = makeLevel(levelOf("weaves-1"), 5).puzzle;
  check(pl.sol.every((v, i) => (i % pl.w === 0 || v !== pl.sol[i - 1]) && (i < pl.w || v !== pl.sol[i - pl.w])), "plain weave is a checker: no two neighbours alike");
  check(pl.classes === 4 && pl.given.reduce((n, g) => n + g, 0) <= 1, "and has four crossings to find, with a pre-woven one to settle which way about");
}

// ---------- stars ----------
check(starsFor(0, 0) === 3 && starsFor(1, 0) === 2 && starsFor(0, 1) === 2 && starsFor(2, 1) === 2 && starsFor(3, 1) === 1 && starsFor(9, 9) === 1, "stars: none wrong and no hint is three, up to three together two, finishing one");

// ---------- the page ----------
{
  const html = readFileSync(new URL("../loom.html", import.meta.url), "utf8");
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const used = new Set();
  for (const f of ["loom.js", "loom-play.js", "loom-draft.js", "loom-kit.js"]) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/\$\("([A-Za-z]+)"\)/g)) used.add(m[1]);
  }
  const missing = [...used].filter(id => !ids.has(id));
  check(used.size > 10 && !missing.length, `every id the scripts look up is in loom.html (${used.size}; missing: ${missing.join(", ") || "none"})`);
  const js = readFileSync(new URL("../loom.js", import.meta.url), "utf8");
  check(/roundOver\("loom"\)/.test(readFileSync(new URL("../loom-play.js", import.meta.url), "utf8")) && /roundOver\("loom"\)/.test(readFileSync(new URL("../loom-draft.js", import.meta.url), "utf8")), "both games end a round for Random mode");
  check(/loom:track/.test(js) && /loom:run2/.test(readFileSync(new URL("../loom-play.js", import.meta.url), "utf8")) && /loom:camp/.test(readFileSync(new URL("../loom-kit.js", import.meta.url), "utf8")), "what the page shows is kept under loom: keys (track, run, stars)");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("loom cloths: clues are float lengths (gold among them), colour settles a crossing, a shaft ties crossings, the solver and its hints, 26 levels each with one answer from any seed");
