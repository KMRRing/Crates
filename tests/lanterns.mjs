// Lanterns (lanterns-engine.js): the board, the rules checked against every set of lanterns on small boards by a plain
// search, the generator (one answer, across sizes and levels, the same puzzle for a seed on every device, today's the same
// for everyone), the grading (each level solves a puzzle and the one below doesn't), the steps a hint takes (each true of
// the answer, and enough to solve a puzzle alone), the rules the marks break, a run through JSON and the database's round
// trip; the sea's geometry (lanterns-3d.js, the parts that need no WebGL); and the page wired to it.
import fs from "node:fs";
import { SIZES, LEVELS, ORDER, DAILY, NONE, LIGHT, DOT, board, puzzleOf, startOf, solveAs, gradeOf, count, answerOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "../lanterns-engine.js";
import { cellAtGround, cellXZ, runsFrom } from "../lanterns-model.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/** Whether a set of lanterns (a flag a cell) is an answer, by the rules as the page's Rules say them and nothing of the solver's. */
function plainMeets(N, grid, set) {
  const at = (r, c) => r * N + c, rock = x => grid[x] !== ".";
  const sees = (a, b) => {                                   // in one row or column with no rock between
    const ra = Math.floor(a / N), ca = a % N, rb = Math.floor(b / N), cb = b % N;
    if (ra !== rb && ca !== cb) return false;
    if (ra === rb) { for (let c = Math.min(ca, cb) + 1; c < Math.max(ca, cb); c++) if (rock(at(ra, c))) return false; }
    else for (let r = Math.min(ra, rb) + 1; r < Math.max(ra, rb); r++) if (rock(at(r, ca))) return false;
    return true;
  };
  const lamps = [];
  for (let x = 0; x < N * N; x++) if (set[x]) { if (rock(x)) return false; lamps.push(x); }
  for (const a of lamps) for (const b of lamps) if (a < b && sees(a, b)) return false;
  for (let x = 0; x < N * N; x++) {
    if (rock(x)) {
      if (grid[x] === "#") continue;
      const r = Math.floor(x / N), c = x % N;
      let n = 0;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < N && cc < N && set[at(rr, cc)]) n++; }
      if (n !== +grid[x]) return false;
    } else if (!set[x] && !lamps.some(l => sees(l, x))) return false;
  }
  return true;
}

// ---------- the board ----------
{
  let fine = true;
  for (const N of [4, 7, 10, 14]) {
    const { nb } = board(N);
    fine &&= nb.length === N * N;
    for (let x = 0; x < N * N; x++) for (const y of nb[x]) if (y >= 0) fine &&= nb[y].includes(x);
    fine &&= nb.reduce((n, a) => n + a.filter(y => y >= 0).length, 0) === 4 * N * (N - 1);
  }
  check(fine, "boards: each cell's neighbours agree both ways");
  const P = puzzleOf(5, ".....#...#.2.#....1.....#");
  check(P.see[0][0] === 0 && same(Array.from(P.see[0]).sort((a, b) => a - b), [0, 1, 2, 3, 4]), "a cell's sight starts with itself, and runs to the next rock or the edge");
  check(same(Array.from(P.see[12]).sort((a, b) => a - b), [2, 7, 12, 17, 22]) && P.see[11].length === 0, "a lantern's light stops at a rock, and a rock lights nothing");
  check(same(P.touch[11].slice().sort((a, b) => a - b), [6, 10, 12, 16]) && P.touch[5].length === 0, "a numbered rock touches its open neighbours, and a rock with no number lists none");
}

// ---------- the rules, against every set of lanterns on small boards ----------
{
  let fine = 0, cases = 0, withAnswers = 0, several = 0;
  const rng = seedRng(61);
  for (let t = 0; t < 140; t++) {
    const N = 4 + (t % 2), cells = N * N, grid = new Array(cells).fill(".");
    const rocks = N === 4 ? 2 + Math.floor(rng() * 4) : 8 + Math.floor(rng() * 4);       // (a 5×5 board with more white cells than 16 is too slow to walk)
    for (let i = 0; i < rocks; i++) grid[Math.floor(rng() * cells)] = rng() < 0.55 ? String(Math.floor(rng() * 3)) : "#";
    const g = grid.join(""), P = puzzleOf(N, g), whites = Array.from(P.whites);
    if (whites.length > 16) continue;
    let want = 0;
    for (let m = 0; m < 1 << whites.length; m++) {
      const set = new Int8Array(cells);
      for (let i = 0; i < whites.length; i++) if ((m >> i) & 1) set[whites[i]] = 1;
      if (plainMeets(N, g, set)) want++;
    }
    const got = count(P, 100000);
    cases++;
    if (want > 0) withAnswers++;
    if (want > 1) several++;
    if (got === want) fine++; else console.log("  differs:", N, g, "plain", want, "solver", got);
  }
  check(fine === cases && withAnswers > cases * 0.4 && several > 8, `the solver counts exactly the answers a plain search finds, on ${cases} boards of two small sizes (${withAnswers} with answers, ${several} with several)`);
}

// ---------- the generator ----------
const made = [];
{
  const t0 = performance.now();
  let unique = 0, total = 0, onLevel = 0, shapes = 0, sols = 0;
  const jobs = [];
  for (const level of ORDER) jobs.push([7, level]);
  for (const level of ["easy", "medium", "hard"]) jobs.push([10, level]);
  jobs.push([14, "medium"]);
  for (const [size, level] of jobs) {
    const seed = 9100 + size * 7 + ORDER.indexOf(level), p = generate(seed, size, level), P = puzzleOf(size, p.grid, p.sol);
    total++;
    made.push({ seed, size, level, p, P });
    if (count(P, 2) === 1) unique++;
    if (p.level === level) onLevel++;
    // the answer meets the rules as the page says them, and is the one the solver finds
    if (plainMeets(size, p.grid, Int8Array.from(p.sol, Number))) shapes++;
    if (answerOf(size, p.grid) === p.sol) sols++;
  }
  check(unique === total, `${total} puzzles over the sizes and levels: each has exactly one answer, counted by a search that guesses`);
  check(shapes === total && sols === total, "…and its answer meets every rule as the Rules say them, and is the one the solver finds");
  check(onLevel >= total - 2, `…and comes out at the level asked for (${onLevel} of ${total})`);
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}
{
  const a = generate(424242, 7, "medium"), b = generate(424242, 7, "medium"), c = generate(424243, 7, "medium");
  check(same(a, b) && !same(a, c), "the same seed makes the same puzzle, another seed another");
  const d1 = generate(20261104, DAILY.size, DAILY.level), d2 = generate(20261104, DAILY.size, DAILY.level);
  check(same(d1, d2) && d1.level === DAILY.level, "today's puzzle is the same every time it is made, and the level it says");
  check(levelOn(10, "expert") === "expert" && levelOn(10, "nonsense") === "medium", "a level the page doesn't know is Medium");
  const nums = new Set(made.flatMap(m => [...m.p.grid].filter(c => c >= "0" && c <= "4")));
  check(nums.size >= 4 && made.every(m => [...m.p.grid].some(c => c === "#" || (c >= "0" && c <= "4"))), `rocks with several numbers (${[...nums].sort().join(" ")}) in every puzzle`);
}

// ---------- the grading ----------
{
  let fine = 0, total = 0;
  for (const { P, p } of made) {
    const lv = ORDER.indexOf(p.level);
    total++;
    if (solveAs(P, lv).ok && (lv === 0 || !solveAs(P, lv - 1).ok) && gradeOf(P) === lv) fine++;
  }
  check(fine === total, `each puzzle is solved by reasoning at its level and not a level below (${total})`);
  const hard = made.find(m => m.p.level === "hard"), medium = made.find(m => m.p.level === "medium"), easy = made.find(m => m.p.level === "easy");
  check(!!hard && !solveAs(hard.P, 1).ok && !!medium && !solveAs(medium.P, 0).ok && !!easy && solveAs(easy.P, 0).ok, "a Hard puzzle needs a supposition, a Medium one a look ahead, an Easy one the plain rules only");
  const stalled = solveAs(hard.P, 0);
  check(!stalled.ok && stalled.st.includes(0) && !stalled.broken, "a solver too weak for a puzzle stops where it stands, with cells undecided");
}

// ---------- marks and what they break ----------
{
  check(nextMark(NONE) === LIGHT && nextMark(LIGHT) === DOT && nextMark(DOT) === NONE, "a tap cycles a cell: lantern, dot, clear");
  check(withMark("0120", 3, "2") === "0122" && withMark("0120", 0, "1") === "1120", "a mark is set in its place");
  const { P, p } = made.find(m => m.size === 7 && m.level === "easy");
  const none = NONE.repeat(P.cells);
  check(!solvedBy(P, none) && solvedBy(P, p.sol.replace(/0/g, m => m)) && solvedBy(P, p.sol.replace(/0/g, (m, i) => (i % 2 ? "2" : "0"))), "solved is exactly the answer's lanterns; dots are notes");
  const lamp = p.sol.indexOf("1"), blank = P.whites.find(x => p.sol[x] === "0");
  check(!solvedBy(P, withMark(p.sol, lamp, "0")) && !solvedBy(P, withMark(p.sol, blank, "1")), "a lantern missing, or one too many, isn't solved");
  const b0 = breaks(P, none);
  check(!b0.clash.length && !b0.over.length && !b0.dark.length && b0.lit.every(v => !v), "an empty board breaks nothing and lights nothing");
  const bs = breaks(P, p.sol);
  check(!bs.clash.length && !bs.over.length && !bs.short.length && !bs.dark.length && P.whites.every(x => bs.lit[x]) && bs.done.length === P.rocks.filter(b => P.num[b] > 0).length, "the answer breaks nothing, lights every white cell and meets every number");
  // two lanterns in one row with no rock between them
  let pair = null;
  for (const x of P.whites) for (const y of P.see[x]) if (y !== x && !pair) pair = [x, y];
  if (pair) check(breaks(P, withMark(withMark(none, pair[0], "1"), pair[1], "1")).clash.length === 2, "two lanterns shining on each other are both marked");
  // a rock with too many lanterns beside it
  const rock = P.rocks.find(b => P.num[b] === 0 && P.touch[b].length);
  if (rock != null) check(breaks(P, withMark(none, P.touch[rock][0], "1")).over.includes(rock), "a rock with more lanterns than its number is marked");
  // a cell that nothing can light: all the cells that see it dotted
  const x = P.whites[0];
  let dotted = none;
  for (const y of P.see[x]) dotted = withMark(dotted, y, "2");
  check(breaks(P, dotted).dark.includes(x), "a cell with every way to light it dotted is marked");
}

// ---------- hints ----------
{
  let trueSteps = 0, steps = 0, solvedAlone = 0, ran = 0;
  const techs = new Set();
  for (const { P, p } of made.filter(m => m.size <= 10)) {
    let marks = NONE.repeat(P.cells), n = 0;
    while (!solvedBy(P, marks) && n < P.cells + 5) {
      const h = hintFor(P, marks);
      if (!h) break;
      n++;
      if (h.wrong != null) marks = withMark(marks, h.wrong, h.should);
      else if (h.reveal != null) marks = withMark(marks, h.reveal, h.should);
      else {
        steps++;
        techs.add(h.step.tech);
        let all = h.step.set.length > 0;
        for (const [x, v] of h.step.set) {
          const is = v === 1 ? "1" : "2";
          all &&= (is === "1") === (p.sol[x] === "1") && marks[x] === NONE;
          marks = withMark(marks, x, is);
        }
        if (all) trueSteps++;
      }
    }
    ran++;
    if (solvedBy(P, marks)) solvedAlone++;
  }
  check(steps > 0 && trueSteps === steps, `every step a hint takes is true of the answer and settles a cell not yet marked (${steps} steps, ${[...techs].sort().join(", ")})`);
  check(solvedAlone === ran, `hints alone solve a puzzle (${ran} of ${ran}), without a reveal`);
  check(techs.has("shine") && techs.has("dark"), "…and the steps include what a lantern's line and a cell with one way to be lit settle");
  const { P, p } = made.find(m => m.size === 7);
  const wrongAt = P.whites.find(x => p.sol[x] === "0");
  const h = hintFor(P, withMark(NONE.repeat(P.cells), wrongAt, LIGHT));
  check(h.wrong === wrongAt && h.should === DOT, "a wrong mark is put right before any step");
}

// ---------- kept through JSON and the database ----------
{
  const { P, p, seed } = made.find(m => m.size === 10 && m.level === "medium");
  let marks = NONE.repeat(P.cells);
  for (const x of [...p.sol].map((c, i) => (c === "1" ? i : -1)).filter(i => i >= 0).slice(0, 6)) marks = withMark(marks, x, LIGHT);
  const run = { v: 1, mode: "random", seed, size: 10, level: "medium", came: p.level, grid: p.grid, sol: p.sol, marks, undo: [[3, "0", "1", 1788000000001]], redo: [], ms: 41250, hints: 1, done: null, lit: null };
  const back = JSON.parse(JSON.stringify(run)), Q = puzzleOf(back.size, back.grid, back.sol);
  check(same(back, run) && same(Array.from(Q.num), Array.from(P.num)) && !solvedBy(Q, back.marks), "a run in play survives JSON: its puzzle, marks, clock and hints");
  const db = roundTrip(JSON.parse(JSON.stringify(run)));
  check(db.marks === run.marks && db.grid === run.grid && same(db.undo, run.undo), "…and the database's round trip");
}

// ---------- the sea's geometry (no WebGL needed) ----------
{
  check(cellAtGround(7, -3.4, -3.4) === 0 && cellAtGround(7, 3.4, 3.4) === 48 && cellAtGround(7, 0, 0) === 24 && cellAtGround(7, 3.6, 0) === -1 && cellAtGround(7, 0, -3.6) === -1, "a point of the water is the cell under it, or none off the board");
  const [x, z] = cellXZ(7, 48);
  check(x === 3 && z === 3 && same(cellXZ(8, 0), [-3.5, -3.5]) && cellAtGround(7, x, z) === 48, "a cell's middle is where the water says it is");
  const black = new Uint8Array(49);
  black[22] = 1;                                              // two cells below the lantern's
  const r = runsFrom(7, black, 8);
  check(same(r, [1, 1, 1, 5]), "a lantern's beams run to the next rock or the edge, each way");
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "lanterns.js", "utf8"), html = fs.readFileSync(root + "lanterns.html", "utf8");
  const css = fs.readFileSync(root + "lanterns.css", "utf8"), three = fs.readFileSync(root + "lanterns-3d.js", "utf8");
  check(/id: "lanterns",[^\n]*href: "\.\/lanterns\.html"/.test(apps) && /^ {2}lanterns: `<svg class="k-ico"/m.test(apps), "the tile opens the game, with an Office icon");
  check(/roundOver\("lanterns"\)/.test(page) && /noteDayTime\("lanterns"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "lanterns"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/lanterns\.css/.test(html) && /lanterns\.js/.test(html) && /class="lanterns full titled fit-screen beside"/.test(html), "the page links its styles and script");
  check(/lan-num/.test(css) && /lan-c\.lit/.test(css) && /IN_FRAME/.test(page), "numbers and lit water are styled, and a watching frame draws the board without writing");
  check(/import\("\.\/lanterns-3d\.js"\)/.test(page) && /prefs\.view/.test(page) && /id="viewBtn"/.test(html) && /setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/.test(three) && !/<filter|feGaussian|shadowMap\.enabled = true/.test(three),
    "3D is an optional view, loaded when asked for, with the pixel ratio capped at 2 and no filters or shadows");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("lanterns: the rules, the generator, the grading, hints and the database hold");
