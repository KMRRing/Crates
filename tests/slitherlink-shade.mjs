// Slitherlink's shaded puzzles (slitherlink-engine.js, "With shading" in the menu): some cells marked as inside the loop
// or outside it, which settle edges through the sides the loop divides the board into. The rule checked against every
// loop on small boards by a plain even-odd count; the generator (one answer, on its level, the shading true of the
// answer, enough of it kept); hints and the rules the marks break; that the plain puzzles are the puzzles they were
// before shading came (today's, links); and the page wired to it. The plain game is tests/slitherlink.mjs.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { SIZES, ORDER, NONE, LINE, CROSS, INSIDE, OUTSIDE, geometry, puzzleOf, solveAs, gradeOf, count, answerOf, generate, withMark, solvedBy, breaks, hintFor } from "../slitherlink-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/** Every simple loop on the board, as a set of edges, by a plain walk of the corners (nothing of the solver's). */
function everyLoop(g) {
  const found = new Map(), used = new Uint8Array(g.E), seen = new Uint8Array(g.V);
  for (let s = 0; s < g.V; s++) {
    seen[s] = 1;
    const walk = (x, len) => {
      for (const e of g.vedges[x]) {
        if (used[e]) continue;
        const y = g.ea[e] === x ? g.eb[e] : g.ea[e];
        if (y === s) { if (len >= 3) { used[e] = 1; found.set(used.join(""), Uint8Array.from(used)); used[e] = 0; } continue; }
        if (y < s || seen[y]) continue;
        used[e] = 1; seen[y] = 1;
        walk(y, len + 1);
        used[e] = 0; seen[y] = 0;
      }
    };
    walk(s, 0);
    seen[s] = 0;
  }
  return [...found.values()];
}
/** Which cells a loop encloses, by the even-odd rule: a cell is inside when an odd number of the loop's vertical edges lie to its left in its row. Not the solver's way. */
function insideOf(g, loop) {
  return Array.from({ length: g.cells }, (_, k) => {
    const r = Math.floor(k / g.C), c = k % g.C;
    let n = 0;
    for (let j = 0; j <= c; j++) n += loop[g.H + r * (g.C + 1) + j];
    return n % 2 === 1;
  });
}
const numbersOf = (g, l) => Int8Array.from({ length: g.cells }, (_, k) => [0, 1, 2, 3].reduce((n, j) => n + l[g.ce[k * 4 + j]], 0));

// ---------- the rule, against every loop ----------
{
  let fine = 0, cases = 0, withAnswers = 0, several = 0, shadedSets = 0;
  const rng = seedRng(4242);
  for (const [R, C] of [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4]]) {
    const g = geometry(R, C), loops = everyLoop(g), info = loops.map(l => ({ inside: insideOf(g, l), nums: numbersOf(g, l) }));
    for (let t = 0; t < 36; t++) {
      // the clues of a real loop (numbers, or which side a cell is on) with some taken away, or marks at random (usually no answer)
      const { nums, inside: ins } = info[Math.floor(rng() * loops.length)];
      const clue = Int8Array.from({ length: g.cells }, (_, k) => {
        const roll = rng();
        if (t % 6 === 5) return roll < 0.5 ? (rng() < 0.5 ? INSIDE : OUTSIDE) : -1;       // shading at random, whatever the loop
        return roll < 0.3 ? nums[k] : roll < 0.6 ? (ins[k] ? INSIDE : OUTSIDE) : -1;
      });
      if (clue.some(c => c > 4)) shadedSets++;
      const ok = ({ inside, nums: n }) => Array.from(clue).every((c, k) => c < 0 || (c <= 4 ? n[k] === c : c === INSIDE ? inside[k] : !inside[k]));
      const want = info.filter(ok).length, got = count(g, clue, 1000);
      cases++;
      if (want > 0) withAnswers++;
      if (want > 1) several++;
      if (got === want) fine++; else console.log("  differs:", R, C, Array.from(clue).join(" "), "plain", want, "solver", got);
    }
  }
  check(fine === cases && withAnswers > cases / 3 && several > 20, `the solver counts exactly the loops a plain search finds, with numbers and shading, on ${cases} sets of clues over five small boards (${shadedSets} shaded, ${withAnswers} with an answer, ${several} with several)`);
}

// ---------- the shaded puzzles ----------
const made = [];
{
  const t0 = performance.now();
  let unique = 0, total = 0, onLevel = 0, true_ = 0, enough = 0, solvable = 0, sols = 0, mixed = 0;
  for (const size of [5, 7, 10]) for (const level of ORDER) {
    if (size === 10 && level === "hard") continue;                                    // about a second apiece: measured outside the suite
    for (let i = 0; i < (size === 10 ? 1 : 2); i++) {
      const seed = 7700 + i * 97 + size, p = generate(seed, size, level, true), P = puzzleOf(size, p.grid, p.sol);
      total++;
      made.push({ seed, size, level, p, P });
      if (count(P.g, P.clue, 2) === 1) unique++;
      if (p.level === level) onLevel++;
      // the shading is true of the answer, by the even-odd rule, and the numbers are its numbers
      const st = Int8Array.from(p.sol, c => (c === LINE ? 1 : 0)), inside = insideOf(P.g, st), nums = numbersOf(P.g, st);
      if (Array.from(P.clue).every((c, k) => c < 0 || (c <= 4 ? nums[k] === c : c === INSIDE ? inside[k] : !inside[k]))) true_++;
      const shades = Array.from(P.clue).filter(c => c > 4).length, numbers = Array.from(P.clue).filter(c => c >= 0 && c <= 4).length;
      if (shades >= Math.round(P.g.cells * 0.12)) enough++;
      if (shades > 0 && numbers > 0 && /[io]/.test(p.grid)) mixed++;
      if (P.shaded && p.shade === true && solveAs(P.g, P.clue, ORDER.indexOf(p.level)).ok) solvable++;
      if (answerOf(size, p.grid) === p.sol) sols++;
    }
  }
  check(unique === total, `${total} shaded puzzles over every size and level: each has exactly one answer, counted by a search that guesses`);
  check(true_ === total && sols === total, "…every shaded and dotted cell is right by the even-odd count of the answer, every number its own, and the answer the one the solver finds");
  check(enough === total && mixed === total && solvable === total, "…each keeps at least an eighth of its cells shaded or dotted beside its numbers, says it is shaded, and is solved by reasoning at its level");
  check(onLevel >= total - 2, `…and comes out at the level asked for (${onLevel} of ${total})`);
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
  const a = generate(5151, 7, "medium", true), b = generate(5151, 7, "medium", true), c = generate(5151, 7, "medium");
  check(JSON.stringify(a) === JSON.stringify(b) && !/[io]/.test(c.grid) && c.shade === undefined, "the same seed makes the same shaded puzzle; the plain puzzle of that seed has no shading and says nothing of it");
  // a level's puzzle needs its level: a Medium shaded puzzle fails at Easy, and a Hard one at Medium
  const med = made.find(m => m.p.level === "medium" && m.size === 7), hard = made.find(m => m.p.level === "hard" && m.size === 7);
  check(!solveAs(med.P.g, med.P.clue, 0).ok && !solveAs(hard.P.g, hard.P.clue, 1).ok && gradeOf(hard.P.g, hard.P.clue) === 2, "a Medium shaded puzzle needs a trial and a Hard one a longer trial, as plain ones do");
}

// ---------- hints and what the marks break ----------
{
  let trueSteps = 0, steps = 0, solvedAlone = 0, ran = 0, sides = 0;
  for (const { P, p } of made.filter(m => m.size <= 7)) {
    let marks = NONE.repeat(P.g.E), n = 0;
    while (!solvedBy(P, marks) && n < P.g.E + 5) {
      const h = hintFor(P, marks);
      if (!h) break;
      n++;
      if (h.wrong != null) marks = withMark(marks, h.wrong, h.should);
      else if (h.reveal != null) marks = withMark(marks, h.reveal, h.should);
      else {
        steps++;
        if (h.step.tech === "sides") sides++;
        let all = h.step.set.length > 0;
        for (const [e, v] of h.step.set) { all &&= String(v) === p.sol[e] && marks[e] === NONE; marks = withMark(marks, e, String(v)); }
        if (all) trueSteps++;
      }
    }
    ran++;
    if (solvedBy(P, marks)) solvedAlone++;
  }
  check(steps > 0 && trueSteps === steps && sides > 0, `every step a hint takes on a shaded puzzle is true of the answer (${steps} steps, ${sides} from the sides)`);
  check(solvedAlone === ran, `hints alone solve a shaded puzzle (${ran} of ${ran}), without a reveal`);
  const { P, p } = made.find(m => m.size === 7 && m.level === "easy");
  const b0 = breaks(P, NONE.repeat(P.g.E));
  check(!b0.shade.length && !breaks(P, p.sol).shade.length, "an empty board, and the answer, clash with no shading");
  // two neighbours shaded the same way, or the opposite way, with a line or a cross drawn between them
  const g = P.g;
  const tinted = Int8Array.from({ length: g.cells }, (_, k) => (k === 0 || k === 1 ? INSIDE : -1));
  const Q = { ...P, clue: tinted, shaded: true };
  const between = g.ecells.findIndex(cs => cs.length === 2 && cs.includes(0) && cs.includes(1));
  check(breaks(Q, withMark(NONE.repeat(g.E), between, LINE)).shade.includes(0) && !breaks(Q, withMark(NONE.repeat(g.E), between, CROSS)).shade.length, "a line between two tinted cells clashes (they are on the same side); a crossed one doesn't");
  const mixedPair = Int8Array.from({ length: g.cells }, (_, k) => (k === 0 ? INSIDE : k === 1 ? OUTSIDE : -1));
  check(breaks({ ...Q, clue: mixedPair }, withMark(NONE.repeat(g.E), between, CROSS)).shade.length > 0 && !breaks({ ...Q, clue: mixedPair }, withMark(NONE.repeat(g.E), between, LINE)).shade.length, "…and a crossed edge between a tinted cell and a dotted one clashes, a line there doesn't");
}

// ---------- the plain puzzles, before shading came ----------
{
  const GOLD = {
    "1/5/easy": "0f3ad5bd2a",
    "20261101/5/easy": "bce5d98049",
    "1/5/medium": "f1b1e4cc4b",
    "20261101/5/medium": "471c54b679",
    "1/5/hard": "8410a4d59f",
    "20261101/5/hard": "df4a01fb62",
    "1/7/easy": "c13776f215",
    "20261101/7/easy": "d3e4091f9e",
    "1/7/medium": "70065b9526",
    "20261101/7/medium": "361479975f",
    "1/7/hard": "be7ec7a835",
    "20261101/7/hard": "e4016ac255",
    "1/10/easy": "8e4da6167c",
    "20261101/10/easy": "aeda5f7d93",
    "1/10/medium": "f4f62e2c1e",
    "20261101/10/medium": "2d836ce019",
    "1/10/hard": "a57d0fdf5c",
    "20261101/10/hard": "de05baa97c"
  };
  const h = p => createHash("sha1").update(p.grid + "|" + p.sol + "|" + p.level).digest("hex").slice(0, 10);
  const wrong = Object.entries(GOLD).filter(([k, v]) => { const [seed, size, level] = k.split("/"); return h(generate(+seed, +size, level)) !== v; }).map(([k]) => k);
  check(!wrong.length, `puzzles made before shading came are the same puzzles (${Object.keys(GOLD).length} seeds, sizes and levels)${wrong.length ? `: ${wrong.join(", ")}` : ""}`);
}

// ---------- the page ----------
{
  const page = fs.readFileSync(root + "slitherlink.js", "utf8"), worker = fs.readFileSync(root + "slitherlink-worker.js", "utf8");
  check(/shade: shadeOn\(k\.twist\)/.test(page) && /generate\(seed, size, level, !!shade\)/.test(worker), "the page asks the worker for a shaded puzzle, and the worker makes one");
  check(/&t=shade/.test(page) && /h\.get\("t"\) === "shade"/.test(page) && /twist: puzzle\.shade/.test(page), "a link to a shaded puzzle says so, and a link's shading is read back");
  check(/kindKey = k => .*:shade/.test(page) && /twist: S\.twist/.test(page), "bests and spares are kept apart for shaded puzzles");
  check(/DAILY/.test(page) && !/DAILY[^\n]*twist/.test(page), "today's puzzle stays plain");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("slitherlink shading: the rule against every loop, shaded puzzles unique and true, hints, plain puzzles unchanged");
