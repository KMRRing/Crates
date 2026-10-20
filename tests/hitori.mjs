// Hitori (hitori-engine.js): the boards and their lines, the rules, the counting solver against a plain search of every
// shading, the generator (one answer, across many seeds, every board and level, the same puzzle for a seed on every
// device, today's the same for everyone), the grading (each level needs its hardest step and no harder), the steps a
// person takes (each true of the answer), hints, the rules the marks break, the split board (the two halves make the
// whole and neither alone finishes it), the computer rival, and a run and the split board's table through JSON and the
// database's round trip.
import { SHAPES, SIZES, LEVELS, LEVEL_LIST, levelsFor, levelOn, DAILY, U, B, W, boardOf, puzzleOf, encode, decode, solutions, obeys, maximal,
  freshState, stateOf, nextStep, apply, grade, levelOf, EXPERT_DEPTH, generate, emptyMarks, nextMark, withMark, solvedBy, breaks, hintFor,
  NONE, SHADE, KEEP, ownerOf, aloneSettles, rivalPlan, rivalAt, RIVALS } from "../hitori-engine.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Every shading that keeps the rules, found by a plain search (no reasoning of the solver's), up to limit. */
function everyShading(P, limit = 3) {
  const n = P.board.cells, st = new Int8Array(n).fill(-1), out = [];
  const fits = i => (st[i] === 1 ? !P.board.nbr[i].some(j => st[j] === 1) : !P.riv[i].some(j => st[j] === 0));
  (function go(i) {
    if (out.length >= limit) return;
    if (i === n) { const sh = Array.from(st, v => v === 1); if (obeys(P, sh)) out.push(sh.map(Number).join("")); return; }
    for (const v of [1, 0]) { st[i] = v; if (fits(i)) go(i + 1); st[i] = -1; if (out.length >= limit) return; }
  })(0);
  return out;
}

// ---------- boards ----------
{
  for (const n of SIZES.square) {
    const b = boardOf("square", n);
    const lines = b.lines.length === 2 * n && b.lines.every(l => l.length === n), each = b.linesOf.every(ks => ks.length === 2);
    const nbr = b.nbr.every((a, i) => a.length >= 2 && a.length <= 4 && a.every(j => b.nbr[j].includes(i)));
    if (!(lines && each && nbr)) check(false, `square ${n}: lines and neighbours`);
  }
  check(true, `square boards ${SIZES.square.join(", ")}: 2n lines of n, every cell in a row and a column, neighbours both ways`);
  for (const m of SIZES.hex) {
    const b = boardOf("hex", m), s = (m + 1) / 2;
    const count = b.cells === 3 * s * s - 3 * s + 1, dirs = [0, 1, 2].every(d => b.dir.filter(x => x === d).length === m);
    const lens = b.lines.every(l => l.length >= s && l.length <= m), each = b.linesOf.every(ks => ks.length === 3 && new Set(ks.map(k => b.dir[k])).size === 3);
    const touching = b.lines.every(l => l.every((c, i) => i === 0 || b.nbr[c].includes(l[i - 1])));
    const nbr = b.nbr.every((a, i) => a.length >= 3 && a.length <= 6 && a.every(j => b.nbr[j].includes(i)));
    if (!(count && dirs && lens && each && touching && nbr)) check(false, `hex ${m}: cells, lines and neighbours`);
  }
  check(true, `hex boards ${SIZES.hex.join(", ")}: 3s²-3s+1 cells, m lines in each of three directions (s to m long), every cell in one of each, cells next in a line are neighbours`);
  check(same(Array.from(decode(encode([1, 9, 10, 12]))), [1, 9, 10, 12]) && encode([10, 11, 12]) === "abc", "numbers to 12 are one character a cell (a, b, c past 9)");
}

// ---------- the rules ----------
{
  // 3x3:  1 1 2 / 2 3 1 / 3 2 1
  const P = puzzleOf("square", 3, "112231321");
  check(obeys(P, [1, 0, 0, 0, 0, 0, 0, 0, 0]) === false, "the right-hand column's two 1s both left unshaded break the rules");
  check(obeys(P, [1, 0, 0, 0, 0, 1, 0, 0, 0]), "shading the top-left 1 and the middle 1 of the right-hand column keeps them");
  check(obeys(P, [1, 0, 0, 0, 0, 0, 0, 0, 1]), "shading the top-left 1 and the bottom-right 1 keeps them: no repeat, nothing touching, the rest joined");
  check(!obeys(P, [1, 1, 0, 0, 0, 0, 0, 0, 1]), "two shaded cells side by side break them");
  check(!obeys(puzzleOf("square", 3, "121212121"), [0, 1, 0, 1, 0, 1, 0, 1, 0]), "kept cells cut apart (a shaded cross) break them");
  check(maximal(P, [1, 0, 0, 0, 0, 0, 0, 0, 1]) === false, "a shading with a cell that could be shaded on top is not maximal");
}

// ---------- counting the answers, against a plain search ----------
{
  let checked = 0, agree = 0;
  for (const [shape, size] of [["square", 5], ["square", 6], ["hex", 5], ["hex", 7]]) for (const level of levelsFor(shape, size)) for (let seed = 1; seed <= 4; seed++) {
    const p = generate(seed * 7 + size, shape, size, level), P = puzzleOf(shape, size, p.grid, p.sol);
    const all = everyShading(P), sols = solutions(P, 2);
    checked++;
    if (all.length === 1 && all[0] === p.sol && sols.length === 1 && Array.from(sols[0]).join("") === p.sol && maximal(P, Array.from(P.sol))) agree++;
  }
  check(agree === checked, `${agree} of ${checked} small puzzles have exactly one shading of all, by a plain search, and it's the generator's and the solver's`);
  // a shaded number given a value no line has: shading it is needless, so other shadings leave it unshaded (and may shade
  // a neighbour instead); the counting solver finds only the one where it's kept, and that one is not maximal (a cell
  // could be shaded on top of it): why both checks are needed
  const p = generate(11, "square", 5, "easy"), P0 = puzzleOf("square", 5, p.grid, p.sol), b = [...P0.sol.keys()].find(i => P0.sol[i]);
  const vals = Array.from(P0.val); vals[b] = 9;
  const Q = puzzleOf("square", 5, vals), every = everyShading(Q, 5), sols = solutions(Q, 2);
  check(every.length > 1 && sols.length === 1 && sols[0][b] === 0 && !maximal(Q, Array.from(sols[0])),
    `a needless shade: ${every.length} shadings in all; the counting solver keeps only the one without it, which isn't maximal`);
}

// ---------- the generator ----------
{
  let made = 0, unique = 0, graded = 0, atLevel = 0, offeredAll = 0;
  const t0 = performance.now();
  for (const shape of Object.keys(SHAPES)) for (const size of SIZES[shape].filter(n => n <= (shape === "hex" ? 9 : 10))) for (const level of levelsFor(shape, size)) for (let seed = 1; seed <= 3; seed++) {
    const p = generate(seed * 1009 + size * 31, shape, size, level);
    if (!p) continue;
    made++;
    const P = puzzleOf(shape, size, p.grid, p.sol), sols = solutions(P, 2);
    if (sols.length === 1 && Array.from(sols[0]).join("") === p.sol && maximal(P, Array.from(P.sol)) && obeys(P, Array.from(P.sol))) unique++;
    const g = grade(P);
    if (g.solved && g.level === p.level && Array.from(g.state.st).every((v, i) => (v === B) === (P.sol[i] === 1))) graded++;
    if (p.level === level) atLevel++;
    offeredAll++;
  }
  const ms = (performance.now() - t0) / made;
  check(made === offeredAll && made === 99, `${made} puzzles made, three of every board and size to 10 (hex to 9) at every level it offers`);
  check(unique === made, `${unique} of ${made} have one answer (the counting solver, a maximal shading that keeps the rules)`);
  check(graded === made, `${graded} of ${made} are solved by reasoning alone, at the level they're labelled, to their answer`);
  check(atLevel >= made * 0.95, `${atLevel} of ${made} came out at the level asked (the rest the nearest), ${ms.toFixed(0)} ms each here`);
  const a = generate(424242, "square", 9, "hard"), b = generate(424242, "square", 9, "hard"), c = generate(424243, "square", 9, "hard");
  check(same(a, b) && a.grid !== c.grid, "a seed makes the same puzzle every time (no clock, no Math.random), another seed another");
  const big = generate(5, "square", 12, "expert");
  check(!!big && solutions(puzzleOf("square", 12, big.grid), 2).length === 1, `12×12 Expert: one answer (came out ${big?.level}, ${big?.tries} tries)`);
  const d1 = generate(20261020, DAILY.shape, DAILY.size, DAILY.level), d2 = generate(20261020, DAILY.shape, DAILY.size, DAILY.level), d3 = generate(20261021, DAILY.shape, DAILY.size, DAILY.level);
  check(same(d1, d2) && d1.grid !== d3.grid && d1.level === "medium", "today's puzzle is the same on every device for a day (8×8 Medium from the date), tomorrow's another");
}

// ---------- the grading: each level needs its hardest step and no harder ----------
{
  let ok = 0, n = 0;
  for (const [shape, size] of [["square", 6], ["square", 8], ["hex", 7]]) for (const level of levelsFor(shape, size)) for (let seed = 1; seed <= 3; seed++) {
    const p = generate(seed * 389, shape, size, level), P = puzzleOf(shape, size, p.grid, p.sol), tier = { easy: 1, medium: 2, hard: 3, expert: 3 }[p.level];
    const lower = tier > 1 ? grade(P, { maxTier: tier - 1 }).solved : false, at = grade(P, { maxTier: tier });
    const deep = p.level === "expert" ? at.depth >= EXPERT_DEPTH : p.level === "hard" ? at.depth < EXPERT_DEPTH && at.trials > 0 : at.trials === 0;
    n++;
    if (!lower && at.solved && deep) ok++;
  }
  check(ok === n, `${ok} of ${n}: an Easy puzzle needs only the plain steps, a Medium the connection rule, a Hard a trial under ${EXPERT_DEPTH} rounds deep, an Expert one ${EXPERT_DEPTH} or more`);
  check(levelOf(1, 0, 0) === "easy" && levelOf(2, 0, 0) === "medium" && levelOf(3, EXPERT_DEPTH - 1, 5) === "hard" && levelOf(3, EXPERT_DEPTH, 1) === "expert", "levels by the hardest step and the deepest trial, never by how many there are");
  check(same(levelsFor("square", 8), LEVEL_LIST) && same(levelsFor("hex", 7), ["easy", "hard", "expert"]) && same(levelsFor("hex", 11), ["easy", "hard"]),
    "a square board offers every level, a hex board no Medium, the widest hex no Expert either");
  check(levelOn("hex", 7, "medium") === "hard" && levelOn("hex", 11, "expert") === "hard" && levelOn("square", 6, "expert") === "expert", "a level a board doesn't offer plays as the nearest above it, else below");
}

// ---------- the steps a person takes: each is true of the answer ----------
{
  let steps = 0, right = 0;
  const techs = new Set();
  for (const [shape, size, level] of [["square", 7, "medium"], ["square", 8, "expert"], ["hex", 9, "hard"], ["square", 10, "hard"]]) for (let seed = 1; seed <= 3; seed++) {
    const p = generate(seed * 97, shape, size, level), P = puzzleOf(shape, size, p.grid, p.sol), g = grade(P, { ways: true });
    for (const x of g.steps) { steps++; techs.add(x.tech); if (x.set.every(([i, v]) => (v === B) === (P.sol[i] === 1)) && (x.tech !== "trial" || (x.ways >= 1 && x.tried >= x.ways))) right++; }
  }
  check(right === steps, `${right} of ${steps} steps settle cells as the answer has them`);
  check(["beside", "rival", "pair", "sandwich", "lone", "cut", "trial"].every(t => techs.has(t)), `every kind of step is used: ${[...techs].join(", ")}`);
}

// ---------- marks, rule breaks, hints ----------
{
  const p = generate(77, "square", 8, "medium"), P = puzzleOf("square", 8, p.grid, p.sol), n = P.board.cells;
  check(nextMark(NONE) === SHADE && nextMark(SHADE) === KEEP && nextMark(KEEP) === NONE, "a tap goes unmarked, shaded, kept, unmarked");
  const answer = Array.from(P.sol, v => (v ? SHADE : NONE)).join("");
  check(solvedBy(P, answer) && solvedBy(P, Array.from(P.sol, v => (v ? SHADE : KEEP)).join("")) && !solvedBy(P, withMark(answer, P.sol.indexOf(1), NONE)),
    "solved the moment exactly the answer is shaded, kept marks or not");
  check(!breaks(P, answer).any, "the answer breaks no rule");
  const a = P.sol.indexOf(1), nb = P.board.nbr[a][0];
  const touching = breaks(P, withMark(withMark(emptyMarks(P), a, SHADE), nb, SHADE));
  check(touching.touch.includes(a) && touching.touch.includes(nb), "two shaded side by side: both shown");
  const [x, y] = P.riv.map((r, i) => [i, r[0]]).find(([, j]) => j != null);
  check(breaks(P, withMark(withMark(emptyMarks(P), x, KEEP), y, KEEP)).twice.length === 2, "a number kept twice in a line: both shown");
  const corner = withMark(withMark(emptyMarks(P), 1, SHADE), 8, SHADE);
  check(same(breaks(P, corner).cut, [0]), "the corner walled in by two shaded cells: shown as cut off");
  // hints: a wrong mark first, then the next step, and hints alone solve a puzzle
  const wrongAt = [...P.sol.keys()].find(i => !P.sol[i]);
  const h1 = hintFor(P, withMark(emptyMarks(P), wrongAt, SHADE));
  check(h1.wrong === wrongAt && h1.should === KEEP, "a hint finds a wrong mark first, and says what it should be");
  let marks = emptyMarks(P), hints = 0;
  while (!solvedBy(P, marks) && hints < n) {
    const h = hintFor(P, marks);
    if (!h?.step) break;
    for (const [i, v] of h.step.set) marks = withMark(marks, i, v === B ? SHADE : KEEP);
    hints++;
  }
  check(solvedBy(P, marks), `hints alone solve it, a step at a time (${hints} hints)`);
}

// ---------- the split board ----------
{
  for (const shape of Object.keys(SHAPES)) for (const size of SIZES[shape]) {
    const b = boardOf(shape, size), mine = [...Array(b.cells).keys()].filter(i => ownerOf(b, i) === 0);
    if (Math.abs(2 * mine.length - b.cells) > 1) check(false, `${shape} ${size}: the halves are even`);
  }
  check(true, "every board splits into halves within a cell of each other, every cell seen by one player (the first seat the top half)");
  let held = 0, made = 0, alone = [], whole = 0;
  for (const [shape, size, level] of [["square", 6, "easy"], ["square", 8, "medium"], ["square", 8, "hard"], ["hex", 7, "hard"], ["square", 10, "medium"]]) for (let seed = 1; seed <= 3; seed++) {
    const p = generate(seed * 211, shape, size, level), P = puzzleOf(shape, size, p.grid, p.sol), n = P.board.cells;
    const halves = [0, 1].map(slot => aloneSettles(P, Array.from({ length: n }, (_, i) => ownerOf(P.board, i) === slot)));
    const both = aloneSettles(P, Array(n).fill(true));
    made++;
    if (halves.every(st => st.includes(U))) held++;
    alone.push(...halves.map(st => Math.round((100 * st.filter(v => v !== U).length) / n)));
    if (!both.includes(U) && Array.from(both).every((v, i) => (v === B) === (P.sol[i] === 1))) whole++;
    // what a half settles is true of the answer (it reasons soundly from what it sees)
    if (!halves.every(st => Array.from(st).every((v, i) => v === U || (v === B) === (P.sol[i] === 1)))) check(false, `${shape} ${size} ${level} ${seed}: a half settled a cell wrongly`);
  }
  check(held === made, `${held} of ${made}: neither half's numbers finish the board alone (each settles ${Math.min(...alone)}% to ${Math.max(...alone)}% of it)`);
  check(whole === made, `${whole} of ${made}: both halves together settle it all, as the answer has it`);
}

// ---------- the computer rival ----------
{
  const p = generate(5150, "square", 8, "medium"), P = puzzleOf("square", 8, p.grid, p.sol);
  const plans = Object.fromEntries(Object.keys(RIVALS).map(r => [r, rivalPlan(P, r, 5150)]));
  const rising = Object.values(plans).every(pl => pl.every((x, i) => i === 0 || (x.at > pl[i - 1].at && x.done >= pl[i - 1].done)) && pl.at(-1).done === 64);
  check(rising, "the rival's timetable rises step by step to every cell settled");
  check(plans.steady.at(-1).at > plans.quick.at(-1).at && plans.quick.at(-1).at > plans.sharp.at(-1).at, `Steady, Quick, Sharp: ${Object.entries(plans).map(([r, pl]) => `${r} ${Math.round(pl.at(-1).at / 1000)} s`).join(", ")} on 8×8 Medium`);
  check(same(rivalPlan(P, "quick", 5150), plans.quick), "the same puzzle and seed give the same timetable (a partner watching sees the same rival)");
  const mid = rivalAt(plans.quick, plans.quick[10].at, 64), end = rivalAt(plans.quick, plans.quick.at(-1).at + 1, 64);
  check(mid.done === plans.quick[10].done && !mid.finished && end.finished && end.done === 64, "where the rival is at a time on the clock, and when it has finished");
}

// ---------- kept through JSON and the database ----------
{
  const p = generate(321, "hex", 9, "hard"), P = puzzleOf("hex", 9, p.grid, p.sol);
  let marks = emptyMarks(P);
  for (const i of [...P.sol.keys()].filter(i => P.sol[i]).slice(0, 5)) marks = withMark(marks, i, SHADE);
  const run = { v: 1, mode: "random", seed: 321, shape: "hex", size: 9, level: "hard", came: p.level, grid: p.grid, sol: p.sol, marks, undo: [[3, ".", "#"]], redo: [], ms: 41250, hints: 1, done: null, lit: null, rival: "quick" };
  const back = JSON.parse(JSON.stringify(run)), Q = puzzleOf(back.shape, back.size, back.grid, back.sol);
  check(same(back, run) && same(Array.from(Q.val), Array.from(P.val)) && same(Array.from(Q.sol), Array.from(P.sol)) && !solvedBy(Q, back.marks), "a run in play survives JSON: its puzzle, marks, clock and hints as they were");
  // the split board as the table keeps it: strings and numbers, nothing the database drops or reshapes
  const g = { v: 1, app: 1, created: 1000, people: 2, n: 2, players: { a: { name: "Korbi", slot: 0, online: true }, b: { name: "Sarah", slot: 1, online: true, ping: "17:5000" } },
    match: { seed: 9, mode: "pair", shape: "square", size: 8, level: "medium", came: "medium", grid: generate(9, "square", 8, "medium").grid }, start: 4000,
    runs: { s0: { ready: true, begun: 4000 }, s1: { ready: true, begun: 4000 } }, pair: { n: 2, k: marks.slice(0, 64).replace(/[^.#o]/g, "."), b: "-".repeat(63) + "1", h: 0 } };
  const db = roundTrip(JSON.parse(JSON.stringify(g)));
  check(same(db.pair, g.pair) && db.match.grid === g.match.grid && db.players.b.ping === "17:5000", "the split board's marks, who made them, its hints and a pointed cell come back from the database as written");
  g.pair.done = { at: 99000 };
  check(roundTrip(JSON.parse(JSON.stringify(g))).pair.done.at === 99000, "and so does its solve");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("hitori: the rules, the generator, the grading, the split and the rival hold");
