// What every level's puzzle must be, shared by tests/bridges-puzzles*.mjs (each takes a part of the ladder, to keep every test under five seconds):
// one answer by reasoning at the level the puzzle says, its twist really in it (and no clue that isn't needed: a road, a strait,
// the rule against loops), the answer a true building (every number made, no two bridges crossing at a height, every realm joined,
// no ring where there may be none, every strait's number made, no road over its width), the same twice, the hints alone building it.
import { ORDER, layoutOf, count, answerOf, gradeOf, flagsOf, breaks, whatBreaks, hintFor, puzzleOf, solvedBy, withMark, moreOf } from "../bridges-engine.js";
import { gapAt, lineOf, onBoard } from "../bridges-lattice.js";
import { LEVELS, seedOf, levelPuzzle, parOf } from "../bridges-levels.js";

/** Whether a puzzle forbids rings: it is in its twist, not a field of its own. */
export const treeOf = p => flagsOf(p.twist || "none").tree;
/** The three seeds a level is tried with: its own (the puzzle everyone gets first), and two others. */
export const seedsOf = i => [seedOf(i), 4001 + i, 77001 + 31 * i];

/** The layout of a generated puzzle: the engine's layoutOf with every field it carries. */
export const layOfPuzzle = p => layoutOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills || "", p.roads || "", moreOf(p));

/**
 * Looks at levels `from` to `to - 1`, each with the seeds `picks` (indices into seedsOf), and prints what it finds through
 * `check(ok, what)`. The first pick is looked at hardest (every clue needed, the hints, the same twice).
 */
export function checkLevels(check, from, to, picks) {
  let ok = true, why = "", total = 0, hit = 0, worst = 0, clues = 0, needed = 0, hinted = 0;
  const fail = (i, seed, what) => { if (ok) why = `level ${i + 1}, seed ${seed}: ${what}`; ok = false; };
  const t0 = performance.now();
  for (let i = from; i < to; i++) {
    const L = LEVELS[i], T = flagsOf(L.twist);
    picks.forEach((pick, n) => {
      const seed = seedsOf(i)[pick], t = performance.now(), p = levelPuzzle(i, seed), took = performance.now() - t;
      worst = Math.max(worst, took); total++;
      if (!p) return fail(i, seed, "no puzzle");
      if (p.level === L.level) hit++;
      const lay = layOfPuzzle(p), P = puzzleOf(p.size, p.grid, p.sol, p.kinds || "", p.realms || "", p.hills || "", p.roads || "", moreOf(p));
      if (p.size !== L.size || p.sol.length !== lay.links.length || (p.shape === "hex") !== (L.shape === "hex")) fail(i, seed, "wrong size, board or answer");
      if (p.shape === "hex" && [...p.grid].some((ch, k) => ch !== "." && !onBoard(p.size, true, Math.floor(k / p.size), k % p.size))) fail(i, seed, "an island off the hex board");
      if (count(lay, 2) !== 1) fail(i, seed, "not one answer");
      if (answerOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills || "", p.roads || "", moreOf(p)) !== p.sol) fail(i, seed, "another answer than its own");
      const got = gradeOf(lay);
      if (got !== ORDER.indexOf(p.level)) fail(i, seed, "graded differently than it says");
      // the twists are in the puzzle, and only the ones the level has
      if (T.ranges !== /[+-]/.test(p.kinds || "")) fail(i, seed, T.ranges ? "no bounds" : "bounds it shouldn't have");
      if (T.realms !== (lay.realmSize[0] > 0 && lay.realmSize[1] > 0)) fail(i, seed, T.realms ? "one realm only" : "realms it shouldn't have");
      if (T.realms && (lay.realmSize[0] < 3 || lay.realmSize[1] < 3)) fail(i, seed, "a realm too small");
      if (T.hills !== !!p.hills) fail(i, seed, "hills missing, or there when they shouldn't be");
      const narrow = [...(p.roads || "")].filter(c => c === "1").length, wide = [...(p.roads || "")].filter(c => c === "3").length;
      if (T.narrow !== narrow > 0 || T.wide !== wide > 0) fail(i, seed, "narrow or wide roads missing, or there when they shouldn't be");
      if ((T.narrow || T.wide) && narrow + wide < 2) fail(i, seed, "fewer than two road clues");
      if (T.straits !== !!p.straits) fail(i, seed, "straits missing, or there when they shouldn't be");
      if (p.twist !== undefined && p.twist !== L.twist) fail(i, seed, "the twist is not written as the level has it");
      // the answer is a valid building: bridges within an island's bound and a road's width, none across another, each realm joined, straits made
      const sums = lay.isl.map(() => 0);
      lay.links.forEach((l, k) => {
        sums[l.a] += +p.sol[k]; sums[l.b] += +p.sol[k];
        if (+p.sol[k] > l.cap) fail(i, seed, "a road with more bridges than it holds");
      });
      lay.isl.forEach((x, k) => { if (sums[k] < Math.max(x.mn, 1) || sums[k] > x.mx) fail(i, seed, "an island with a number the bridges don't make"); });
      const cells = new Set();
      lay.links.forEach((l, k) => {
        if (!+p.sol[k]) return;
        const a = lay.isl[l.a], b = lay.isl[l.b];
        for (let r = a.r, c = a.c; r !== b.r || c !== b.c; r += Math.sign(b.r - a.r), c += Math.sign(b.c - a.c)) {
          const at = r * p.size + c;
          if (at === a.r * p.size + a.c) continue;
          const key = `${at}${l.high ? "h" : "l"}`;                  // a viaduct and a low bridge may share a cell, nothing else
          if (cells.has(key)) fail(i, seed, "bridges cross");
          cells.add(key);
          if (p.grid[at] !== ".") fail(i, seed, "a bridge over an island");
        }
      });
      const par = lay.isl.map((_, k) => k), find = x => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
      let rings = 0;
      lay.links.forEach((l, k) => { if (+p.sol[k]) { const a = find(l.a), b = find(l.b); if (a === b) rings++; else par[a] = b; } });
      const comps = new Set(lay.isl.map((x, k) => `${x.realm}:${find(k)}`));
      if (comps.size !== (T.realms ? 2 : 1)) fail(i, seed, "the islands of a realm are not one network");
      if (T.tree && rings) fail(i, seed, "a ring in a puzzle with no loops");
      if (T.straits) {                                                // each strait's number is what the answer has across its gap (counted from the cells here, not the layout's groups)
        let made = 0;
        for (let g = 0; g < p.straits.length; g++) {
          if (p.straits[g] === ".") continue;
          const { fam, gap } = gapAt(p.size, g);
          let n = 0;
          lay.links.forEach((l, k) => { const a = lineOf(p.size, fam, lay.isl[l.a].r, lay.isl[l.a].c), b = lineOf(p.size, fam, lay.isl[l.b].r, lay.isl[l.b].c); if (Math.min(a, b) <= gap && gap < Math.max(a, b)) n += +p.sol[k]; });
          if (n !== +p.straits[g]) fail(i, seed, "a strait whose number the answer doesn't make");
          made++;
        }
        if (made < 2 || made !== lay.groups.length) fail(i, seed, "fewer than two straits, or the layout has others");
      }
      // the answer breaks no rule the page shows
      const b = breaks(P, p.sol);
      if (b.over.length || b.cut.length || b.straitsOver.length || b.ring.length || whatBreaks(P, p.sol) !== "") fail(i, seed, "the answer breaks a rule the page shows");
      if (b.straitsMet.length !== lay.groups.length) fail(i, seed, "a strait the answer doesn't meet");
      const par2 = parOf(p);
      if (!(par2 >= 15 && par2 <= 1200)) fail(i, seed, "a par out of reach");
      if (n > 0) return;
      // the first seed, looked at hardest: the same twice, every clue needed, the hints alone build it
      if (JSON.stringify(levelPuzzle(i, seed)) !== JSON.stringify(p)) fail(i, seed, "not the same twice");
      if (p.level === L.level) {
        const level = ORDER.indexOf(p.level), without = (field, value) => layoutOf(p.size, p.grid, p.kinds || "", p.realms || "", p.hills || "", field === "roads" ? value : p.roads || "", { ...moreOf(p), straits: field === "straits" ? value : p.straits || "", tree: field === "tree" ? false : treeOf(p) });
        const unneeded = (g) => g >= 0 && g <= level;                // solvable by reasoning at the level without it: the clue is decoration
        for (let c = 0; c < (p.roads || "").length; c++) if (p.roads[c] !== "2") { clues++; if (!(p.roads[c] === "3" && p.sol[c] === "3") && unneeded(gradeOf(without("roads", p.roads.slice(0, c) + "2" + p.roads.slice(c + 1))))) fail(i, seed, "a road clue that isn't needed"); else needed++; }
        for (let c = 0; c < (p.straits || "").length; c++) if (p.straits[c] !== ".") { clues++; if (unneeded(gradeOf(without("straits", p.straits.slice(0, c) + "." + p.straits.slice(c + 1))))) fail(i, seed, "a strait that isn't needed"); else needed++; }
        if (T.tree) { clues++; if (unneeded(gradeOf(without("tree")))) fail(i, seed, "the rule against loops isn't needed"); else needed++; }
      }
      let marks = "0".repeat(lay.links.length), steps = 0;
      while (!solvedBy(P, marks) && steps < 4 * lay.links.length + 5) {
        const h = hintFor(P, marks);
        if (!h) break;
        steps++;
        if (h.wrong != null) marks = withMark(marks, h.wrong, h.should);
        else if (h.reveal != null) marks = withMark(marks, h.reveal, h.should);
        else marks = withMark(marks, h.step.link, String(h.step.to));
      }
      if (solvedBy(P, marks)) hinted++; else fail(i, seed, "the hints alone don't build it");
    });
  }
  const levels = to - from, out = `levels ${from + 1} to ${to}`;
  check(ok, `${out}: every level makes a puzzle with one answer at its level, its twist in it, the answer a true building, the same twice, and the hints alone build it${why ? ` (${why})` : ""}`);
  check(hit >= total * 0.9, `${out}: nearly every puzzle comes out at the difficulty its level asks (${hit} of ${total})`);
  if (clues) check(needed === clues, `${out}: every road, strait and rule against loops left in a puzzle is needed: take it away and reasoning at the level no longer finishes (${needed} of ${clues})`);
  check(hinted === levels, `${out}: following the hints from an empty board builds each level's own puzzle (${hinted} of ${levels})`);
  console.log(`     ${total} puzzles in ${Math.round(performance.now() - t0)} ms, the slowest to make ${Math.round(worst)} ms`);
  check(worst < 4000, `${out}: no puzzle takes long to make`);
}
