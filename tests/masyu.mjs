// Masyu (masyu-engine.js, on loop-engine.js): the board and its edges, the rules checked against every simple loop on small
// boards found by a plain search, the generator (one answer, across seeds, every size and level, the same puzzle for a
// seed on every device, today's the same for everyone), the grading (each level needs its hardest step and no harder),
// the steps a hint takes (each true of the answer, and enough to solve a puzzle alone), the rules the marks break, and
// a run through JSON and the database's round trip; and the page wired to it.
import fs from "node:fs";
import { SIZES, LEVELS, ORDER, DAILY, NONE, LINE, CROSS, WHITE, BLACK, board, puzzleOf, solveAs, gradeOf, count, answerOf, generate, circlesOf, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "../masyu-engine.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/** Every simple loop on the board, as a set of edges, by a plain walk of the cells (nothing of the solver's). */
function everyLoop(g) {
  const found = new Map(), used = new Uint8Array(g.E), seen = new Uint8Array(g.V);
  for (let s = 0; s < g.V; s++) {                       // a loop is found from its lowest cell, once each way round
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
/**
 * Whether a loop (a set of edges) meets the pearls, by the rules as the page's Rules say them and nothing of the solver's:
 * the loop through each pearl's cell, a white one straight with a turn in a cell beside it, a black one a turn with a
 * straight run into the next cell each way.
 */
function plainMeets(g, N, loop, circ) {
  const nbrs = x => g.vedges[x].filter(e => loop[e]).map(e => (g.ea[e] === x ? g.eb[e] : g.ea[e]));
  const at = x => [Math.floor(x / N), x % N];
  const straight = (x, [a, b]) => { const [r, c] = at(x), [r1, c1] = at(a), [r2, c2] = at(b); return r1 - r === r - r2 && c1 - c === c - c2; };
  for (let x = 0; x < N * N; x++) {
    if (!circ[x]) continue;
    const ns = nbrs(x);
    if (ns.length !== 2) return false;
    if (circ[x] === WHITE) {
      if (!straight(x, ns)) return false;
      if (!ns.some(n => { const m = nbrs(n); return m.length === 2 && !straight(n, m); })) return false;
    } else {
      if (straight(x, ns)) return false;
      if (!ns.every(n => { const m = nbrs(n); return m.length === 2 && straight(n, m); })) return false;
    }
  }
  return true;
}

// ---------- the board ----------
{
  let fine = true;
  for (const N of [4, 6, 8, 10]) {
    const b = board(N), { g, nb, eg } = b;
    fine &&= g.V === N * N && g.E === 2 * N * (N - 1);
    for (let x = 0; x < N * N; x++) for (let d = 0; d < 4; d++) {
      const e = eg[x * 4 + d], n = nb[x * 4 + d];
      fine &&= (e < 0) === (n < 0);
      if (e >= 0) fine &&= (g.ea[e] === x && g.eb[e] === n) || (g.eb[e] === x && g.ea[e] === n);
      if (e >= 0) fine &&= nb[n * 4 + [1, 0, 3, 2][d]] === x && eg[n * 4 + [1, 0, 3, 2][d]] === e;     // the way back is the same edge
    }
  }
  check(fine, "boards: each cell's four ways, an edge between two cells, and the way back along it, all agree");
  check(everyLoop(board(4).g).length === 213, `a plain walk finds the 213 loops of a 4×4 board (${everyLoop(board(4).g).length})`);
}

// ---------- the rules, against every loop ----------
{
  let fine = 0, cases = 0, withAnswers = 0, nonTrivial = 0;
  const rng = seedRng(77);
  for (const N of [4, 5]) {
    const b = board(N), { g } = b, loops = everyLoop(g);
    for (let t = 0; t < (N === 4 ? 90 : 60); t++) {
      // the pearls a real loop could have (some of them), or pearls at random (usually no answer)
      const circ = new Int8Array(N * N);
      if (t % 4 === 3) for (let x = 0; x < N * N; x++) circ[x] = rng() < 0.2 ? 1 + Math.floor(rng() * 2) : 0;
      else {
        const loop = loops[Math.floor(rng() * loops.length)], marks = Array.from(loop, v => (v ? LINE : CROSS)), P0 = puzzleOf(N, "-".repeat(N * N), marks.join(""));
        const { white, black } = circlesOf(P0, marks);
        for (const x of white) if (rng() < 0.7) circ[x] = WHITE;
        for (const x of black) if (rng() < 0.7) circ[x] = BLACK;
      }
      const grid = Array.from(circ, c => (c === WHITE ? "w" : c === BLACK ? "b" : "-")).join(""), P = puzzleOf(N, grid);
      const want = loops.filter(l => plainMeets(g, N, l, circ)).length, got = count(g, P, 100000);
      cases++;
      if (want > 0) withAnswers++;
      if (want > 1) nonTrivial++;
      if (got === want) fine++; else console.log("  differs:", N, grid, "plain", want, "solver", got);
    }
  }
  check(fine === cases && withAnswers > cases / 2 && nonTrivial > 10, `the solver counts exactly the loops a plain search finds, on ${cases} sets of pearls over two small boards (${withAnswers} with answers, ${nonTrivial} with several)`);
}

// ---------- the pearls a loop can have ----------
{
  let fine = true, all = 0;
  for (const seed of [3, 4, 5, 6]) for (const size of [6, 8]) {
    const p = generate(seed, size, "easy"), P = puzzleOf(size, p.grid, p.sol), marks = [...p.sol];
    const { white, black } = circlesOf(P, marks);
    // every pearl it offers is met by the loop (no pearl is wrong, each is done), and the grid's pearls are among them
    const Q = puzzleOf(size, Array.from({ length: size * size }, (_, x) => (white.includes(x) ? "w" : black.includes(x) ? "b" : "-")).join(""), p.sol), br = breaks(Q, p.sol);
    fine &&= br.wrong.length === 0 && br.done.length === Q.circles.length && Q.circles.length > 0;
    fine &&= [...p.grid].every((c, x) => c === "-" || (c === "w" ? white.includes(x) : black.includes(x)));
    all += Q.circles.length;
  }
  check(fine && all > 0, `the pearls a loop can have are all met by it (${all} over eight puzzles), and a puzzle uses only those`);
}

// ---------- the generator ----------
const made = [];
{
  const t0 = performance.now();
  let unique = 0, total = 0, onLevel = 0, shapes = 0, sols = 0;
  for (const size of SIZES) for (const level of ORDER) for (let i = 0; i < (size === 10 ? 1 : 2); i++) {
    const seed = 9100 + i * 131 + size, p = generate(seed, size, level), P = puzzleOf(size, p.grid, p.sol);
    total++;
    made.push({ seed, size, level, p, P });
    if (count(P.g, P, 2) === 1) unique++;
    if (p.level === level) onLevel++;
    // the answer is one loop through every cell it uses twice, passing every pearl as the rules say
    const st = Int8Array.from(p.sol, Number), loop = Uint8Array.from(st, s => (s === 1 ? 1 : 0));
    let ok = plainMeets(P.g, size, loop, P.circ);
    for (let x = 0; x < P.g.V; x++) { const d = P.g.vedges[x].filter(e => st[e] === 1).length; ok &&= d === 0 || d === 2; }
    if (ok && loop.reduce((n, v) => n + v, 0) >= 4 && solveAs(P.g, P, 2).ok) shapes++;
    if (answerOf(size, p.grid) === p.sol) sols++;
  }
  check(unique === total, `${total} puzzles over every size and level: each has exactly one answer, counted by a search that guesses`);
  check(shapes === total && sols === total, "…and its answer is one loop, passing every pearl as the rules say, and the one the solver finds");
  check(onLevel >= total - 2, `…and comes out at the level asked for (${onLevel} of ${total})`);
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}
{
  const a = generate(424242, 8, "medium"), b = generate(424242, 8, "medium"), c = generate(424243, 8, "medium");
  check(same(a, b) && !same(a, c), "the same seed makes the same puzzle, another seed another");
  const d1 = generate(20261031, DAILY.size, DAILY.level), d2 = generate(20261031, DAILY.size, DAILY.level);
  check(same(d1, d2) && d1.level === DAILY.level, "today's puzzle is the same every time it is made, and the level it says");
  check(levelOn(8, "hard") === "hard" && levelOn(8, "nonsense") === "medium", "a level the page doesn't know is Medium");
  // not every cell is on the loop (a loop through them all is no puzzle), and both kinds of pearl turn up
  const lens = made.map(m => [...m.p.sol].filter(c => c === LINE).length), kinds = new Set(made.flatMap(m => [...m.p.grid].filter(c => c !== "-")));
  check(kinds.has("w") && kinds.has("b") && made.some(m => [...m.p.sol].filter(c => c === LINE).length < m.size * m.size), `pearls of both colours, and some loops that skip cells (lengths ${lens.join(" ")})`);
}

// ---------- the grading ----------
{
  let fine = 0, total = 0, harder = 0;
  for (const { P, p } of made) {
    const lv = ORDER.indexOf(p.level);
    total++;
    const needs = [0, 1, 2].map(l => solveAs(P.g, P, l));
    // solved at its level, and not at the one below (that is what its level means)
    if (needs[lv].ok && (lv === 0 || !needs[lv - 1].ok) && gradeOf(P.g, P) === lv) fine++;
    // the hardest step it used is its level
    if (needs[lv].need === lv) harder++;
  }
  check(fine === total, `each puzzle is solved by reasoning at its level and not a level below (${total})`);
  check(harder === total, "…and the hardest step it used is exactly its level");
  const hard = made.find(m => m.p.level === "hard"), medium = made.find(m => m.p.level === "medium");
  check(!!hard && !solveAs(hard.P.g, hard.P, 1).ok && !!medium && !solveAs(medium.P.g, medium.P, 0).ok, "a Hard puzzle needs a longer trial than a Medium one allows, a Medium one a trial at all");
  const easy = made.filter(m => m.size === 10 && m.level === "easy"), hardTen = made.filter(m => m.size === 10 && m.level === "hard");
  const pearls = ms => ms.reduce((n, m) => n + [...m.p.grid].filter(c => c !== "-").length, 0) / ms.length;
  check(pearls(easy) >= pearls(hardTen), `an Easy puzzle shows at least as many pearls as a Hard one (${pearls(easy).toFixed(0)} against ${pearls(hardTen).toFixed(0)} on 10×10)`);
}

// ---------- marks and what they break ----------
{
  check(nextMark(NONE) === LINE && nextMark(LINE) === CROSS && nextMark(CROSS) === NONE, "a tap cycles an edge: line, crossed, clear");
  check(withMark("0120", 3, "2") === "0122" && withMark("0120", 0, "1") === "1120", "a mark is set in its place");
  const { P, p } = made.find(m => m.size === 6 && m.level === "easy");
  const none = NONE.repeat(P.g.E);
  check(!solvedBy(P, none) && solvedBy(P, p.sol) && solvedBy(P, p.sol.replace(/2/g, "0")), "solved is exactly the answer's lines drawn; crossed edges are notes");
  const e1 = p.sol.indexOf("1");
  check(!solvedBy(P, withMark(p.sol, e1, "0")) && !solvedBy(P, withMark(p.sol, p.sol.indexOf("2"), "1")), "a line missing, or one too many, isn't solved");
  const b0 = breaks(P, none);
  check(!b0.wrong.length && !b0.bad.length && !b0.loop.length && !b0.done.length, "an empty board breaks nothing");
  const bs = breaks(P, p.sol);
  check(!bs.wrong.length && bs.done.length === P.circles.length, "the answer meets every pearl");
  // a white pearl crossed by a line that turns: lines on both its axes
  const w = [...P.circles].find(x => P.circ[x] === WHITE);
  const E = (x, d) => P.eg[x * 4 + d];
  const straightAtIn = (Q, x) => { const e = d => Q.eg[x * 4 + d], none0 = NONE.repeat(Q.g.E); return e(0) >= 0 && e(1) >= 0 ? withMark(withMark(none0, e(0), LINE), e(1), LINE) : e(2) >= 0 && e(3) >= 0 ? withMark(withMark(none0, e(2), LINE), e(3), LINE) : null; };
  const turnAt = x => { for (const v of [0, 1]) for (const h of [2, 3]) if (E(x, v) >= 0 && E(x, h) >= 0) return withMark(withMark(none, E(x, v), LINE), E(x, h), LINE); return null; };
  check(w != null && breaks(P, turnAt(w)).wrong.includes(w), "a white pearl the loop turns at is marked");
  const inner = made.map(m => ({ P: m.P, x: [...m.P.circles].find(x => m.P.circ[x] === BLACK && straightAtIn(m.P, x)) })).find(m => m.x != null);   // (a black pearl in a corner can't be run straight through)
  check(!!inner && breaks(inner.P, straightAtIn(inner.P, inner.x)).wrong.includes(inner.x), "a black pearl the loop runs straight through is marked");
  // a dead end: a line whose other sides are all crossed
  const x = P.g.vedges.findIndex(es => es.length === 2), [ea, eb] = P.g.vedges[x];
  check(breaks(P, withMark(withMark(none, ea, LINE), eb, CROSS)).bad.includes(x), "a line running into crossed sides is a dead end, marked");
  // a loop that closes without being the answer: the four edges round a block of four cells
  const N = P.N, sq = [0, 1, N, N + 1].length && [P.eg[0 * 4 + 3], P.eg[1 * 4 + 1], P.eg[N * 4 + 3], P.eg[0 * 4 + 1]];
  let closed = none;
  for (const e of sq) closed = withMark(closed, e, LINE);
  check(breaks(P, closed).loop.length === 4 && !solvedBy(P, closed), "a closed loop that isn't the answer is marked");
}

// ---------- hints ----------
{
  let trueSteps = 0, steps = 0, solvedAlone = 0, ran = 0;
  const techs = new Set();
  for (const { P, p } of made.filter(m => m.size <= 8)) {
    let marks = NONE.repeat(P.g.E), n = 0;
    while (!solvedBy(P, marks) && n < P.g.E + 5) {
      const h = hintFor(P, marks);
      if (!h) break;
      n++;
      if (h.wrong != null) marks = withMark(marks, h.wrong, h.should);
      else if (h.reveal != null) marks = withMark(marks, h.reveal, h.should);
      else {
        steps++;
        techs.add(h.step.tech);
        let all = h.step.set.length > 0;
        for (const [e, v] of h.step.set) { all &&= String(v) === p.sol[e] && marks[e] === NONE; marks = withMark(marks, e, String(v)); }
        if (all) trueSteps++;
      }
    }
    ran++;
    if (solvedBy(P, marks)) solvedAlone++;
  }
  check(steps > 0 && trueSteps === steps, `every step a hint takes is true of the answer and settles an edge not yet marked (${steps} steps, ${[...techs].sort().join(", ")})`);
  check(solvedAlone === ran, `hints alone solve a puzzle (${ran} of ${ran}), without a reveal`);
  check(techs.has("white") && techs.has("black"), "…and the steps include what a white and a black pearl settle");
  const { P, p } = made.find(m => m.size === 6);
  const wrong = withMark(NONE.repeat(P.g.E), p.sol.indexOf("2"), LINE);
  const h = hintFor(P, wrong);
  check(h.wrong === p.sol.indexOf("2") && h.should === CROSS, "a wrong mark is put right before any step");
}

// ---------- kept through JSON and the database ----------
{
  const { P, p, seed } = made.find(m => m.size === 8 && m.level === "medium");
  let marks = NONE.repeat(P.g.E);
  for (const e of [...p.sol].map((c, i) => (c === LINE ? i : -1)).filter(i => i >= 0).slice(0, 6)) marks = withMark(marks, e, LINE);
  marks = withMark(marks, p.sol.indexOf("2"), CROSS);
  const run = { v: 1, mode: "random", seed, size: 8, level: "medium", came: p.level, grid: p.grid, sol: p.sol, marks, undo: [[3, "0", "1", 1788000000001]], redo: [], ms: 41250, hints: 1, done: null, lit: null };
  const back = JSON.parse(JSON.stringify(run)), Q = puzzleOf(back.size, back.grid, back.sol);
  check(same(back, run) && same(Array.from(Q.circ), Array.from(P.circ)) && !solvedBy(Q, back.marks), "a run in play survives JSON: its puzzle, marks, clock and hints");
  const db = roundTrip(JSON.parse(JSON.stringify(run)));
  check(db.marks === run.marks && db.grid === run.grid && same(db.undo, run.undo), "…and the database's round trip");
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "masyu.js", "utf8"), html = fs.readFileSync(root + "masyu.html", "utf8");
  const soon = fs.readFileSync(root + "soon-data.js", "utf8"), logos = fs.readFileSync(root + "soon-logos.js", "utf8"), css = fs.readFileSync(root + "masyu.css", "utf8");
  check(/id: "masyu",[^\n]*href: "\.\/masyu\.html"/.test(apps) && !/id: "masyu"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
  check(!/^ {2}masyu: \{/m.test(soon) && !/^ {2}masyu: `/m.test(logos), "the placeholder's entry and logos are gone");
  check(/roundOver\("masyu"\)/.test(page) && /noteDayTime\("masyu"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "masyu"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/masyu\.css/.test(html) && /masyu\.js/.test(html) && /class="masyu (full (titled )?)?fit-screen beside"/.test(html), "the page links its styles and script");
  check(/msy-white/.test(css) && /msy-black/.test(css) && /IN_FRAME/.test(page), "pearls are styled, and a watching frame draws the partner's board without writing");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("masyu: the rules, the generator, the grading, hints and the database hold");
