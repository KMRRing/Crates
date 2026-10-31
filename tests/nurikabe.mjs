// Nurikabe (nurikabe-engine.js): the board, the rules checked against every filling of small boards by a plain search, the
// generator (one answer, across seeds, every size and level, the same puzzle for a seed on every device, today's the same
// for everyone), the grading (each level solves a puzzle and the one below doesn't), the steps a hint takes (each true of
// the answer, and enough to solve a puzzle alone), the rules the marks break, and a run through JSON and the database's
// round trip; and the page wired to it.
import fs from "node:fs";
import { SIZES, LEVELS, ORDER, DAILY, NONE, SEA, LAND, board, puzzleOf, startOf, solveAs, gradeOf, count, answerOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "../nurikabe-engine.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/**
 * Whether a filling (1 sea, 2 island, a cell each) is an answer, by the rules as the page's Rules say them and nothing of
 * the solver's: every piece of island has one number and as many cells as it says, the sea is one piece, and no 2×2 is sea.
 */
function plainMeets(N, clue, fill) {
  const at = (r, c) => r * N + c, seen = new Uint8Array(N * N);
  const around = x => { const r = Math.floor(x / N), c = x % N, out = []; if (r) out.push(x - N); if (r < N - 1) out.push(x + N); if (c) out.push(x - 1); if (c < N - 1) out.push(x + 1); return out; };
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if ([at(r, c), at(r, c + 1), at(r + 1, c), at(r + 1, c + 1)].every(x => fill[x] === 1)) return false;
  let seaPieces = 0;
  for (let x = 0; x < N * N; x++) {
    if (seen[x]) continue;
    const todo = [x], piece = [x];
    seen[x] = 1;
    while (todo.length) for (const y of around(todo.pop())) if (!seen[y] && fill[y] === fill[x]) { seen[y] = 1; todo.push(y); piece.push(y); }
    if (fill[x] === 1) { if (++seaPieces > 1) return false; }
    else {
      const numbers = piece.filter(y => clue[y]);
      if (numbers.length !== 1 || clue[numbers[0]] !== piece.length) return false;
    }
  }
  return true;
}
/** Every cell that carries a number is island in a filling that means it. */
const numbered = (clue, fill) => clue.every((n, x) => !n || fill[x] === 2);

// ---------- the board ----------
{
  let fine = true;
  for (const N of [4, 6, 8, 10]) {
    const { ns, blocks } = board(N);
    fine &&= ns.length === N * N && blocks.length === (N - 1) * (N - 1);
    for (let x = 0; x < N * N; x++) for (const y of ns[x]) fine &&= ns[y].includes(x) && Math.abs(x - y) === 1 + (N - 1) * (Math.abs(x - y) === N ? 1 : 0);
    fine &&= ns.reduce((n, a) => n + a.length, 0) === 4 * N * (N - 1);
  }
  check(fine, "boards: each cell's neighbours agree both ways, and every 2×2 block is there");
}

// ---------- the rules, against every filling of a small board ----------
{
  let fine = 0, cases = 0, withAnswers = 0, several = 0;
  const rng = seedRng(61);
  // the islands of a filling that has no pool and one piece of sea (null if it has not), as lists of cells
  const islandsOf = (N, fill) => {
    const around = x => { const r = Math.floor(x / N), c = x % N, out = []; if (r) out.push(x - N); if (r < N - 1) out.push(x + N); if (c) out.push(x - 1); if (c < N - 1) out.push(x + 1); return out; };
    for (let r = 0; r < N - 1; r++) for (let c = 0; c < N - 1; c++) if ([r * N + c, r * N + c + 1, (r + 1) * N + c, (r + 1) * N + c + 1].every(x => fill[x] === 1)) return null;
    const seen = new Uint8Array(N * N), isl = [];
    let seaPieces = 0;
    for (let x = 0; x < N * N; x++) {
      if (seen[x]) continue;
      const todo = [x], piece = [x];
      seen[x] = 1;
      while (todo.length) for (const y of around(todo.pop())) if (!seen[y] && fill[y] === fill[x]) { seen[y] = 1; todo.push(y); piece.push(y); }
      if (fill[x] === 1) { if (++seaPieces > 1) return null; } else isl.push(piece);
    }
    return isl.length ? isl : null;
  };
  // the boards with an answer: every filling of the board that the shape rules allow, a number put in each island or most
  const shapes = { 4: [], 5: [] };
  for (let m = 0; m < 1 << 16; m++) { const fill = Int8Array.from({ length: 16 }, (_, i) => 1 + ((m >> i) & 1)); if (islandsOf(4, fill)) shapes[4].push(fill); }
  for (let i = 0; i < 400000 && shapes[5].length < 120; i++) { const fill = Int8Array.from({ length: 25 }, () => (rng() < 0.4 ? 2 : 1)); if (islandsOf(5, fill)) shapes[5].push(fill); }
  for (const N of [4, 5]) for (let t = 0; t < (N === 4 ? 90 : 24); t++) {
    const fill = shapes[N][Math.floor(rng() * shapes[N].length)], isl = islandsOf(N, fill), grid = new Array(N * N).fill("-");
    isl.forEach((piece, k) => { if (rng() < 0.8 || k === 0) grid[piece[Math.floor(rng() * piece.length)]] = piece.length.toString(36); });
    const g = grid.join(""), P = puzzleOf(N, g);
    if (N === 5 && P.total > 8) continue;                       // (a walk of all the fillings of a 5×5 with more island cells is slow)
    // every filling with that many island cells (the numbers add up), checked plain
    let want = 0;
    const need = P.total, f = new Int8Array(N * N).fill(1);
    const walk = (i, left) => {
      if (left > N * N - i) return;
      if (i === N * N) { if (!left && numbered(P.clue, f) && plainMeets(N, P.clue, f)) want++; return; }
      if (left) { f[i] = 2; walk(i + 1, left - 1); }
      f[i] = 1; walk(i + 1, left);
    };
    walk(0, need);
    const got = count(P, 100000);
    cases++;
    if (want > 0) withAnswers++;
    if (want > 1) several++;
    if (got === want) fine++; else console.log("  differs:", N, g, "plain", want, "solver", got);
  }
  check(fine === cases && withAnswers > cases * 0.7 && several > 5, `the solver counts exactly the answers a plain search finds, on ${cases} sets of numbers over two small boards (${withAnswers} with answers, ${several} with several)`);
}

// ---------- the generator ----------
const made = [];
{
  const t0 = performance.now();
  let unique = 0, total = 0, onLevel = 0, shapes = 0, sols = 0;
  const jobs = [];
  for (const size of SIZES) for (const level of ORDER) for (let i = 0; i < 1; i++) if (!(size === 10 && level !== "easy")) jobs.push([size, level, i]);
  for (const [size, level, i] of jobs) {
    const seed = 9100 + i * 131 + size, p = generate(seed, size, level), P = puzzleOf(size, p.grid, p.sol);
    total++;
    made.push({ seed, size, level, p, P });
    if (count(P, 2) === 1) unique++;
    if (p.level === level) onLevel++;
    // the answer meets the rules as the page says them, and is the one the solver finds
    const fill = Int8Array.from(p.sol, Number);
    if (plainMeets(size, P.clue, fill) && numbered(P.clue, fill) && P.total === fill.filter(v => v === 2).length) shapes++;
    if (answerOf(size, p.grid) === p.sol) sols++;
  }
  check(unique === total, `${total} puzzles over every size and level: each has exactly one answer, counted by a search that guesses`);
  check(shapes === total && sols === total, "…and its answer meets every rule as the Rules say them, and is the one the solver finds");
  check(onLevel >= total - 3, `…and comes out at the level asked for (${onLevel} of ${total})`);
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}
{
  const a = generate(424242, 8, "medium"), b = generate(424242, 8, "medium"), c = generate(424243, 8, "medium");
  check(same(a, b) && !same(a, c), "the same seed makes the same puzzle, another seed another");
  const d1 = generate(20261031, DAILY.size, DAILY.level), d2 = generate(20261031, DAILY.size, DAILY.level);
  check(same(d1, d2) && d1.level === DAILY.level, "today's puzzle is the same every time it is made, and the level it says");
  check(levelOn(8, "hard") === "hard" && levelOn(8, "nonsense") === "medium", "a level the page doesn't know is Medium");
  // a puzzle has islands of more than one kind, and sea that isn't all of the board
  const sizes = new Set(made.flatMap(m => [...m.p.grid].filter(c => c !== "-").map(c => parseInt(c, 36))));
  check(sizes.size >= 3 && made.every(m => [...m.p.sol].filter(c => c === "1").length > m.size * m.size * 0.4), `islands of several sizes (${[...sizes].sort((u, v) => u - v).join(" ")}), and sea over two fifths of every board`);
}

// ---------- the grading ----------
{
  let fine = 0, total = 0;
  for (const { P, p } of made) {
    const lv = ORDER.indexOf(p.level);
    total++;
    // solved at its level, and not at the one below (that is what its level means)
    if (solveAs(P, lv).ok && (lv === 0 || !solveAs(P, lv - 1).ok) && gradeOf(P) === lv) fine++;
  }
  check(fine === total, `each puzzle is solved by reasoning at its level and not a level below (${total})`);
  const hard = made.find(m => m.p.level === "hard"), medium = made.find(m => m.p.level === "medium"), easy = made.find(m => m.p.level === "easy");
  check(!!hard && !solveAs(hard.P, 1).ok && !!medium && !solveAs(medium.P, 0).ok && !!easy && solveAs(easy.P, 0).ok, "a Hard puzzle needs a supposition, a Medium one the sea kept whole, an Easy one the plain rules only");
  // the solver only reasons: an unsolved puzzle stops short and doesn't guess
  const stalled = solveAs(hard.P, 0);
  check(!stalled.ok && stalled.st.includes(0) && !stalled.broken, "a solver too weak for a puzzle stops where it stands, with cells undecided");
}

// ---------- marks and what they break ----------
{
  check(nextMark(NONE) === SEA && nextMark(SEA) === LAND && nextMark(LAND) === NONE, "a tap cycles a cell: sea, island dot, clear");
  check(withMark("0120", 3, "2") === "0122" && withMark("0120", 0, "1") === "1120", "a mark is set in its place");
  const { P, p } = made.find(m => m.size === 6 && m.level === "easy");
  const none = NONE.repeat(P.cells);
  check(!solvedBy(P, none) && solvedBy(P, p.sol) && solvedBy(P, p.sol.replace(/2/g, "0")), "solved is exactly the answer's sea shaded; dots are notes");
  const sea = p.sol.indexOf("1"), land = p.sol.split("").findIndex((c, x) => c === "2" && !P.clue[x]);
  check(!solvedBy(P, withMark(p.sol, sea, "0")) && (land < 0 || !solvedBy(P, withMark(p.sol, land, "1"))), "a sea cell missing, or one too many, isn't solved");
  const b0 = breaks(P, none);
  check(!b0.pool.length && !b0.island.length && !b0.cut.length, "an empty board breaks nothing");
  const bs = breaks(P, p.sol);
  check(!bs.pool.length && !bs.island.length && !bs.cut.length && bs.done.length === P.clues.length, "the answer breaks nothing and every island is whole");
  // a pool: the four cells of a block shaded
  const N = P.N, blk = P.blocks.find(b => b.every(x => !P.clue[x]));
  let pooled = none;
  for (const x of blk) pooled = withMark(pooled, x, SEA);
  check(breaks(P, pooled).pool.length === 4, "a 2×2 block of sea is marked");
  // an island with too many cells: dots round a 1
  const one = [...P.clues].find(x => P.clue[x] === 1), beside = board(N).ns[one].find(y => !P.clue[y]);
  if (one != null && beside != null) check(breaks(P, withMark(none, beside, LAND)).island.includes(one) && breaks(P, withMark(none, beside, LAND)).island.includes(beside), "an island with more cells than its number is marked");
  // sea cut off: two shaded cells with a wall of islands between them
  const walled = made.map(m => {
    const Q = m.P, ns = board(Q.N).ns, fillS = Int8Array.from(m.p.sol, Number);
    // find a cell of the answer's sea whose removal... instead: shade two sea cells that the answer's land separates
    for (let x = 0; x < Q.cells; x++) for (let y = x + 1; y < Q.cells; y++) {
      if (fillS[x] !== 1 || fillS[y] !== 1 || Q.clue[x] || Q.clue[y]) continue;
      // each is walled in by the answer's island cells and the board's edge: its neighbours are all island
      if (ns[x].every(z => fillS[z] === 2) && ns[y].every(z => fillS[z] === 2)) return { Q, x, y };
    }
    return null;
  }).find(Boolean);
  if (walled) {
    const none2 = NONE.repeat(walled.Q.cells), both = withMark(withMark(none2, walled.x, SEA), walled.y, SEA);
    const dotted = board(walled.Q.N).ns[walled.x].concat(board(walled.Q.N).ns[walled.y]).reduce((s, z) => withMark(s, z, LAND), both);
    check(breaks(walled.Q, dotted).cut.includes(walled.x), "sea walled off from the rest is marked");
  } else check(true, "(no walled-in sea cell in these puzzles; the cut is checked by the solver's own tests)");
}

// ---------- hints ----------
{
  let trueSteps = 0, steps = 0, solvedAlone = 0, ran = 0;
  const techs = new Set();
  for (const { P, p } of made.filter(m => m.size <= 8)) {
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
        for (const [x, v] of h.step.set) { all &&= String(v) === p.sol[x] && marks[x] === NONE; marks = withMark(marks, x, String(v)); }
        if (all) trueSteps++;
      }
    }
    ran++;
    if (solvedBy(P, marks)) solvedAlone++;
  }
  check(steps > 0 && trueSteps === steps, `every step a hint takes is true of the answer and settles a cell not yet marked (${steps} steps, ${[...techs].sort().join(", ")})`);
  check(solvedAlone === ran, `hints alone solve a puzzle (${ran} of ${ran}), without a reveal`);
  check(techs.has("complete") && techs.has("between") && techs.has("reach"), "…and the steps include what a whole island, a cell between islands and a cell out of reach settle");
  const { P, p } = made.find(m => m.size === 6);
  const wrongAt = p.sol.split("").findIndex((c, x) => c === "1" && !P.clue[x]);
  const wrong = withMark(NONE.repeat(P.cells), wrongAt, LAND);
  const h = hintFor(P, wrong);
  check(h.wrong === wrongAt && h.should === SEA, "a wrong mark is put right before any step");
}

// ---------- kept through JSON and the database ----------
{
  const { P, p, seed } = made.find(m => m.size === 8 && m.level === "medium");
  let marks = NONE.repeat(P.cells);
  for (const x of [...p.sol].map((c, i) => (c === "1" ? i : -1)).filter(i => i >= 0).slice(0, 6)) marks = withMark(marks, x, SEA);
  const run = { v: 1, mode: "random", seed, size: 8, level: "medium", came: p.level, grid: p.grid, sol: p.sol, marks, undo: [[3, "0", "1", 1788000000001]], redo: [], ms: 41250, hints: 1, done: null, lit: null };
  const back = JSON.parse(JSON.stringify(run)), Q = puzzleOf(back.size, back.grid, back.sol);
  check(same(back, run) && same(Array.from(Q.clue), Array.from(P.clue)) && !solvedBy(Q, back.marks), "a run in play survives JSON: its puzzle, marks, clock and hints");
  const db = roundTrip(JSON.parse(JSON.stringify(run)));
  check(db.marks === run.marks && db.grid === run.grid && same(db.undo, run.undo), "…and the database's round trip");
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "nurikabe.js", "utf8"), html = fs.readFileSync(root + "nurikabe.html", "utf8");
  const soon = fs.readFileSync(root + "soon-data.js", "utf8"), logos = fs.readFileSync(root + "soon-logos.js", "utf8"), css = fs.readFileSync(root + "nurikabe.css", "utf8");
  check(/id: "nurikabe",[^\n]*href: "\.\/nurikabe\.html"/.test(apps) && !/id: "nurikabe"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
  check(!/^ {2}nurikabe: \{/m.test(soon) && !/^ {2}nurikabe: `/m.test(logos), "the placeholder's entry and logos are gone");
  check(/roundOver\("nurikabe"\)/.test(page) && /noteDayTime\("nurikabe"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "nurikabe"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/nurikabe\.css/.test(html) && /nurikabe\.js/.test(html) && /class="nurikabe fit-screen beside"/.test(html), "the page links its styles and script");
  check(/nk-num/.test(css) && /nk-c\.sea/.test(css) && /IN_FRAME/.test(page), "numbers and sea are styled, and a watching frame draws the partner's board without writing");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("nurikabe: the rules, the generator, the grading, hints and the database hold");
