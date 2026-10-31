// Slitherlink (slitherlink-engine.js): the board and its edges, the rules checked against every simple loop on small
// boards found by a plain search, the generator (one answer, across seeds, every size and level, the same puzzle for a
// seed on every device, today's the same for everyone), the grading (each level needs its hardest step and no harder),
// the steps a hint takes (each true of the answer, and enough to solve a puzzle alone), the rules the marks break, and
// a run through JSON and the database's round trip; and the page wired to it.
import fs from "node:fs";
import { SIZES, LEVELS, ORDER, DAILY, NONE, LINE, CROSS, geometry, puzzleOf, solveAs, gradeOf, count, answerOf, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "../slitherlink-engine.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/** Every simple loop on the board, as a set of edges, by a plain walk of the corners (nothing of the solver's). */
function everyLoop(g) {
  const found = new Map(), used = new Uint8Array(g.E), seen = new Uint8Array(g.V);
  for (let s = 0; s < g.V; s++) {                       // a loop is found from its lowest corner, once each way round
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

// ---------- the board ----------
{
  let fine = true;
  for (const [R, C] of [[2, 2], [3, 4], [5, 5], [10, 10]]) {
    const g = geometry(R, C);
    fine &&= g.E === (R + 1) * C + R * (C + 1) && g.V === (R + 1) * (C + 1) && g.cells === R * C;
    fine &&= g.vedges.every((es, x) => es.length >= 2 && es.length <= 4 && es.every(e => g.ea[e] === x || g.eb[e] === x));
    fine &&= g.ecells.every(cs => cs.length === 1 || cs.length === 2);
    for (let k = 0; k < g.cells; k++) fine &&= new Set(Array.from({ length: 4 }, (_, j) => g.ce[k * 4 + j])).size === 4;
    const corners = g.vedges.filter(es => es.length === 2).length;
    fine &&= corners === 4;
  }
  check(fine, "boards: edges, corners and cells all agree (a corner has two to four edges, a cell four, an edge one or two cells)");
  const g = geometry(3, 3);
  check(everyLoop(g).length === 213, `a plain walk finds the 213 loops of a 3×3 board (${everyLoop(g).length})`);
}

// ---------- the rules, against every loop ----------
{
  let fine = 0, cases = 0, withAnswers = 0;
  const rng = seedRng(77);
  for (const [R, C] of [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4]]) {
    const g = geometry(R, C), loops = everyLoop(g);
    const cluesOf = l => Int8Array.from({ length: g.cells }, (_, k) => [0, 1, 2, 3].reduce((n, j) => n + l[g.ce[k * 4 + j]], 0));
    for (let t = 0; t < 36; t++) {
      // the numbers of a real loop with some taken away, or numbers at random (usually no answer)
      const clue = t % 4 === 3 ? Int8Array.from({ length: g.cells }, () => (rng() < 0.6 ? Math.floor(rng() * 4) : -1)) : cluesOf(loops[Math.floor(rng() * loops.length)]);
      if (t % 4 !== 3) for (let k = 0; k < g.cells; k++) if (rng() < 0.15 + 0.08 * (t % 4) * 3) clue[k] = -1;
      const want = loops.filter(l => { for (let k = 0; k < g.cells; k++) if (clue[k] >= 0 && cluesOf(l)[k] !== clue[k]) return false; return true; }).length;
      const got = count(g, clue, 1000);
      cases++;
      if (want > 0) withAnswers++;
      if (got === want) fine++; else console.log("  differs:", R, C, Array.from(clue).join(" "), "plain", want, "solver", got);
    }
  }
  check(fine === cases && withAnswers > cases / 2, `the solver counts exactly the loops a plain search finds, on ${cases} sets of numbers over five small boards (${withAnswers} with answers)`);
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
    if (count(P.g, P.clue, 2) === 1) unique++;
    if (p.level === level) onLevel++;
    // the answer is one loop that meets every number
    const st = Int8Array.from(p.sol, Number);
    let lines = 0, ok = true;
    for (let e = 0; e < P.g.E; e++) lines += st[e] === 1 ? 1 : 0;
    for (let x = 0; x < P.g.V; x++) { const d = P.g.vedges[x].filter(e => st[e] === 1).length; ok &&= d === 0 || d === 2; }
    for (let k = 0; k < P.g.cells; k++) if (P.clue[k] >= 0) ok &&= [0, 1, 2, 3].filter(j => st[P.g.ce[k * 4 + j]] === 1).length === P.clue[k];
    if (ok && lines >= 4 && solveAs(P.g, P.clue, 2).ok) shapes++;
    if (answerOf(size, p.grid) === p.sol) sols++;
  }
  check(unique === total, `${total} puzzles over every size and level: each has exactly one answer, counted by a search that guesses`);
  check(shapes === total && sols === total, "…and its answer is one loop through every corner it uses twice, meeting every number, and the one the solver finds");
  check(onLevel >= total - 2, `…and comes out at the level asked for (${onLevel} of ${total})`);
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}
{
  const a = generate(424242, 7, "medium"), b = generate(424242, 7, "medium"), c = generate(424243, 7, "medium");
  check(same(a, b) && !same(a, c), "the same seed makes the same puzzle, another seed another");
  const d1 = generate(20261031, DAILY.size, DAILY.level), d2 = generate(20261031, DAILY.size, DAILY.level);
  check(same(d1, d2) && d1.level === DAILY.level, "today's puzzle is the same every time it is made, and the level it says");
  check(levelOn(7, "hard") === "hard" && levelOn(7, "nonsense") === "medium", "a level the page doesn't know is Medium");
}

// ---------- the grading ----------
{
  let fine = 0, total = 0, harder = 0;
  for (const { P, p } of made) {
    const lv = ORDER.indexOf(p.level);
    total++;
    const needs = [0, 1, 2].map(l => solveAs(P.g, P.clue, l));
    // solved at its level, and not at the one below (that is what its level means)
    if (needs[lv].ok && (lv === 0 || !needs[lv - 1].ok) && gradeOf(P.g, P.clue) === lv) fine++;
    // the hardest step it used is its level
    if (needs[lv].need === lv) harder++;
  }
  check(fine === total, `each puzzle is solved by reasoning at its level and not a level below (${total})`);
  check(harder === total, "…and the hardest step it used is exactly its level");
  const hard = made.find(m => m.p.level === "hard"), medium = made.find(m => m.p.level === "medium");
  check(!!hard && !solveAs(hard.P.g, hard.P.clue, 1).ok && !!medium && !solveAs(medium.P.g, medium.P.clue, 0).ok, "a Hard puzzle needs a longer trial than a Medium one allows, a Medium one a trial at all");
  const easy = made.filter(m => m.size === 10 && m.p.level === "easy"), hardTen = made.filter(m => m.size === 10 && m.p.level === "hard");
  const clues = ms => ms.reduce((n, m) => n + [...m.p.grid].filter(c => c !== "-").length, 0) / ms.length;
  check(clues(easy) > clues(hardTen), `an Easy puzzle shows more numbers than a Hard one (${clues(easy).toFixed(0)} against ${clues(hardTen).toFixed(0)} on 10×10)`);
}

// ---------- marks and what they break ----------
{
  check(nextMark(NONE) === LINE && nextMark(LINE) === CROSS && nextMark(CROSS) === NONE, "a tap cycles an edge: line, crossed, clear");
  check(withMark("0120", 3, "2") === "0122" && withMark("0120", 0, "1") === "1120", "a mark is set in its place");
  const { P, p } = made.find(m => m.size === 5 && m.level === "easy");
  const none = NONE.repeat(P.g.E);
  check(!solvedBy(P, none) && solvedBy(P, p.sol) && solvedBy(P, p.sol.replace(/2/g, "0")), "solved is exactly the answer's lines drawn; crossed edges are notes");
  const e1 = p.sol.indexOf("1");
  check(!solvedBy(P, withMark(p.sol, e1, "0")) && !solvedBy(P, withMark(p.sol, p.sol.indexOf("2"), "1")), "a line missing, or one too many, isn't solved");
  const b0 = breaks(P, none);
  check(!b0.over.length && !b0.bad.length && !b0.loop.length, "an empty board breaks nothing");
  // too many lines round a number
  const k = [...P.clue].findIndex(n => n === 0 || n === 1);
  const cell = Array.from({ length: 4 }, (_, j) => P.g.ce[k * 4 + j]);
  let m = none;
  for (let j = 0; j < 2 + P.clue[k]; j++) m = withMark(m, cell[j], LINE);
  check(breaks(P, m).over.includes(k), "more lines round a number than it says are marked");
  // a dead end: a line whose other sides are all crossed
  const x = P.g.vedges.findIndex(es => es.length === 2), [ea, eb] = P.g.vedges[x];
  check(breaks(P, withMark(withMark(none, ea, LINE), eb, CROSS)).bad.includes(x), "a line running into crossed sides is a dead end, marked");
  // a loop that closes without being the answer
  const g = P.g;                                          // the loop round the first cell alone
  let sq = none;
  for (const e of Array.from({ length: 4 }, (_, j) => g.ce[j])) sq = withMark(sq, e, LINE);
  check(P.clue[0] !== 4 && breaks(P, sq).loop.length === 4 && !solvedBy(P, sq), "a closed loop that isn't the answer is marked");
}

// ---------- hints ----------
{
  let trueSteps = 0, steps = 0, solvedAlone = 0, ran = 0;
  const techs = new Set();
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
  const { P, p } = made.find(m => m.size === 5);
  const wrong = withMark(NONE.repeat(P.g.E), p.sol.indexOf("2"), LINE);
  const h = hintFor(P, wrong);
  check(h.wrong === p.sol.indexOf("2") && h.should === CROSS, "a wrong mark is put right before any step");
}

// ---------- kept through JSON and the database ----------
{
  const { P, p, seed } = made.find(m => m.size === 7 && m.level === "medium");
  let marks = NONE.repeat(P.g.E);
  for (const e of [...p.sol].map((c, i) => (c === LINE ? i : -1)).filter(i => i >= 0).slice(0, 6)) marks = withMark(marks, e, LINE);
  marks = withMark(marks, p.sol.indexOf("2"), CROSS);
  const run = { v: 1, mode: "random", seed, size: 7, level: "medium", came: p.level, grid: p.grid, sol: p.sol, marks, undo: [[3, "0", "1"]], redo: [], ms: 41250, hints: 1, done: null, lit: null };
  const back = JSON.parse(JSON.stringify(run)), Q = puzzleOf(back.size, back.grid, back.sol);
  check(same(back, run) && same(Array.from(Q.clue), Array.from(P.clue)) && !solvedBy(Q, back.marks), "a run in play survives JSON: its puzzle, marks, clock and hints");
  const db = roundTrip(JSON.parse(JSON.stringify({ ...run, undo: [[3, "0", "1"]] })));
  check(db.marks === run.marks && db.grid === run.grid && same(db.undo, run.undo), "…and the database's round trip");
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "slitherlink.js", "utf8"), html = fs.readFileSync(root + "slitherlink.html", "utf8");
  const soon = fs.readFileSync(root + "soon-data.js", "utf8"), logos = fs.readFileSync(root + "soon-logos.js", "utf8");
  check(/id: "slitherlink",[^\n]*href: "\.\/slitherlink\.html"/.test(apps) && !/id: "slitherlink"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
  check(!/^ {2}slitherlink: \{/m.test(soon) && !/^ {2}slitherlink: `/m.test(logos), "the placeholder's entry and logos are gone");
  check(/roundOver\("slitherlink"\)/.test(page) && /noteDayTime\("slitherlink"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "slitherlink"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/slitherlink\.css/.test(html) && /slitherlink\.js/.test(html) && /class="slitherlink fit-screen beside"/.test(html), "the page links its styles and script");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("slitherlink: the rules, the generator, the grading, hints and the database hold");
