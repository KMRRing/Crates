// Bridges (bridges-engine.js): the board and its links, the rules checked against every way of building bridges on small
// boards found by a plain search, the generator (one answer, across seeds, every size and level, the same puzzle for a
// seed on every device, today's the same for everyone), the grading (each level solves what it should and the one below
// does not), hints (each step true of the answer, and enough to solve a puzzle alone), the rules the marks break, and
// a run through JSON and the database's round trip; and the page wired to it.
import fs from "node:fs";
import { SIZES, LEVELS, ORDER, DAILY, layoutOf, puzzleOf, solveAs, gradeOf, count, answerOf, generate, randomBoard, rngOf, nextMark, withMark, solvedBy, crossed, breaks, hintFor, levelOn } from "../bridges-engine.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const root = new URL("../", import.meta.url).pathname;

/** Every way to build the bridges of a board, by a plain search of what each island, cell and group allows (nothing of the solver's). */
function everyAnswer(size, grid, lay = layoutOf(size, grid)) {
  const out = [], L = lay.links.length, left = lay.isl.map(x => x.n), cur = new Array(L).fill(0);
  const cellsOf = l => {                                    // the water a link would run over
    const a = lay.isl[lay.links[l].a], b = lay.isl[lay.links[l].b], cells = [];
    for (let r = a.r, c = a.c; r !== b.r || c !== b.c; r += Math.sign(b.r - a.r), c += Math.sign(b.c - a.c)) if (r !== a.r || c !== a.c) cells.push(r * size + c);
    return cells;
  };
  const runs = Array.from({ length: L }, (_, l) => cellsOf(l));
  const fine = () => {
    const taken = new Set();
    for (let l = 0; l < L; l++) if (cur[l]) for (const c of runs[l]) { if (taken.has(c)) return false; taken.add(c); }
    const seen = new Set([0]), todo = [0];                  // joined: walk from the first island over the bridges
    while (todo.length) {
      const x = todo.pop();
      for (let l = 0; l < L; l++) {
        if (!cur[l]) continue;
        const { a, b } = lay.links[l], y = a === x ? b : b === x ? a : -1;
        if (y >= 0 && !seen.has(y)) { seen.add(y); todo.push(y); }
      }
    }
    return seen.size === lay.isl.length;
  };
  (function go(l) {
    if (l === L) { if (left.every(x => x === 0) && fine()) out.push(cur.join("")); return; }
    const { a, b } = lay.links[l];
    for (let k = 0; k <= 2 && k <= left[a] && k <= left[b]; k++) { left[a] -= k; left[b] -= k; cur[l] = k; go(l + 1); left[a] += k; left[b] += k; }
    cur[l] = 0;
  })(0);
  return out;
}

// ---------- the board ----------
{
  const lay = layoutOf(5, "1.3.1.....3.4.....2.......1");
  // islands in reading order; links to the right, then down; a link needs a cell of water between its islands
  check(lay.isl.length === 7 && lay.isl[0].n === 1 && lay.isl[1].r === 0 && lay.isl[1].c === 2, "islands are read off the grid in reading order");
  check(lay.links.every(l => lay.isl[l.a].r <= lay.isl[l.b].r && (l.vertical ? lay.isl[l.a].c === lay.isl[l.b].c : lay.isl[l.a].r === lay.isl[l.b].r)), "a link joins two islands in one row or one column");
  const adj = layoutOf(4, "11......2.2.....");
  check(!adj.links.some(l => !l.vertical && adj.isl[l.a].r === 0), "islands side by side have no link (no room for a bridge)");
  const x = layoutOf(5, "..2.." + "....." + "2...2" + "....." + "..2..");
  check(x.links.length === 2 && x.cross[0].length === 1 && x.cross[0][0] === 1 && x.cross[1][0] === 0, "links that cross are found, both ways round");
}

// ---------- the rules, against every way ----------
{
  let fine = 0, cases = 0, withAnswers = 0, many = 0;
  const rng = rngOf(91);
  for (const size of [5, 6, 7]) for (let t = 0; t < 80; t++) {
    const { grid } = randomBoard(size, rng, 5 + Math.floor(rng() * 5), rng() * 0.8);
    const chars = [...grid];
    if (t % 3 === 2) {                                       // a number off by one, usually leaving no answer
      const at = chars.findIndex(c => c !== "." && rng() < 0.3);
      if (at >= 0) chars[at] = String(Math.max(1, Math.min(8, +chars[at] + (rng() < 0.5 ? 1 : -1))));
    }
    const g = chars.join(""), lay = layoutOf(size, g);
    if (lay.links.length > 13 || lay.isl.length < 3) continue;
    const want = everyAnswer(size, g, lay).length, got = count(lay, 1000);
    cases++;
    if (want > 0) withAnswers++;
    if (want > 1) many++;
    if (got === want) fine++; else console.log("  differs:", size, g, "plain", want, "solver", got);
  }
  check(fine === cases && withAnswers > cases / 3 && many > 0, `the solver counts exactly the answers a plain search finds, on ${cases} boards (${withAnswers} with answers, ${many} with several)`);
}

// ---------- the generator ----------
const made = [];
{
  const t0 = performance.now();
  let unique = 0, total = 0, onLevel = 0, built = 0;
  for (const size of SIZES) for (const level of ORDER) for (let i = 0; i < 3; i++) {
    const seed = 7300 + i * 211 + size, p = generate(seed, size, level), P = puzzleOf(size, p.grid, p.sol);
    total++;
    made.push({ seed, size, level, p, P });
    if (count(P.lay, 2) === 1) unique++;
    if (p.level === level) onLevel++;
    // the answer is built from the grid's own links, meets every number, crosses nothing and joins everything
    const marks = p.sol;
    const ok = marks.length === P.lay.links.length, b = breaks(P, marks);
    if (ok && !b.over.length && !b.cut.length && b.met.length === P.lay.isl.length && answerOf(size, p.grid) === p.sol && everyBridgeFree(P, marks)) built++;
  }
  check(unique === total, `${total} puzzles over every size and level: each has exactly one answer, counted by a search that guesses`);
  check(built === total, "…and its answer gives every island its number, crosses nothing, and is the one the solver finds");
  check(onLevel === total, `…and comes out at the level asked for (${onLevel} of ${total})`);
  console.log(`  (${Math.round(performance.now() - t0)} ms)`);
}
/** No two bridges of the answer cross: checked by the water they cover, not by the solver's own table of crossings. */
function everyBridgeFree(P, marks) {
  const { lay, size } = P, taken = new Set();
  for (let l = 0; l < marks.length; l++) {
    if (marks[l] === "0") continue;
    const a = lay.isl[lay.links[l].a], b = lay.isl[lay.links[l].b];
    for (let r = a.r, c = a.c; r !== b.r || c !== b.c; r += Math.sign(b.r - a.r), c += Math.sign(b.c - a.c)) {
      if (r === a.r && c === a.c) continue;
      if (taken.has(r * size + c)) return false;
      taken.add(r * size + c);
    }
  }
  return true;
}
{
  const a = generate(424242, 9, "medium"), b = generate(424242, 9, "medium"), c = generate(424243, 9, "medium");
  check(same(a, b) && !same(a, c), "the same seed makes the same puzzle, another seed another");
  const d1 = generate(20261031, DAILY.size, DAILY.level), d2 = generate(20261031, DAILY.size, DAILY.level);
  check(same(d1, d2) && d1.level === DAILY.level, "today's puzzle is the same every time it is made, and the level it says");
  check(levelOn(9, "hard") === "hard" && levelOn(9, "nonsense") === "medium", "a level the page doesn't know is Medium");
}

// ---------- the grading ----------
{
  let fine = 0;
  for (const { P, p } of made) {
    const lv = ORDER.indexOf(p.level), needs = [0, 1, 2].map(l => solveAs(P.lay, l).ok);
    if (needs[lv] && (lv === 0 || !needs[lv - 1]) && gradeOf(P.lay) === lv) fine++;
  }
  check(fine === made.length, `each puzzle is solved by reasoning at its level and not a level below (${made.length})`);
  const easy = made.find(m => m.p.level === "easy"), medium = made.find(m => m.p.level === "medium"), hard = made.find(m => m.p.level === "hard");
  check(!!easy && !!medium && !!hard && !solveAs(medium.P.lay, 0).ok && solveAs(medium.P.lay, 1).ok && !solveAs(hard.P.lay, 1).ok && solveAs(hard.P.lay, 2).ok,
    "a Medium puzzle needs the islands kept joined, a Hard one a trial as well");
  // four 1s at the corners of a square can only be paired off, and pairs are shut off from each other: no answer
  const square = layoutOf(5, "1.1.." + "....." + "1.1.." + "....." + ".....");
  check(count(square, 5) === 0 && everyAnswer(5, "1.1.." + "....." + "1.1.." + "....." + ".....").length === 0 && !solveAs(square, 2).ok, "a board with no answer is counted as none, and no level pretends to solve it");
}

// ---------- marks and what they break ----------
{
  check(nextMark("0") === "1" && nextMark("1") === "2" && nextMark("2") === "0", "a tap cycles a link: one bridge, two, none");
  check(withMark("0120", 3, "2") === "0122" && withMark("0120", 0, "1") === "1120", "a mark is set in its place");
  const { P, p } = made.find(m => m.size === 7 && m.level === "easy");
  const none = "0".repeat(P.lay.links.length);
  check(!solvedBy(P, none) && solvedBy(P, p.sol), "solved is exactly the answer's bridges built");
  const l1 = [...p.sol].findIndex(c => c !== "0");
  check(!solvedBy(P, withMark(p.sol, l1, "0")) && !solvedBy(P, withMark(p.sol, l1, p.sol[l1] === "1" ? "2" : "1")), "a bridge missing, or one too many, isn't solved");
  const b0 = breaks(P, none);
  check(!b0.over.length && !b0.cut.length && !b0.met.length, "an empty board breaks nothing");
  // an island with more bridges than its number: its first link, built twice, on a 1
  const one = P.lay.isl.findIndex(x => x.n === 1);
  if (one >= 0) {
    const ls = P.lay.byIsl[one];
    const m = withMark(none, ls[0], "2");
    check(breaks(P, m).over.includes(one), "an island given more bridges than its number is marked");
  }
  // two 1s joined into a pair: shut off from the rest
  const pair = puzzleOf(5, "1.1.." + "....." + "1.1.." + "....." + "....."), top = pair.lay.links.findIndex(l => !l.vertical && pair.lay.isl[l.a].r === 0);
  const shut = breaks(pair, withMark("0".repeat(pair.lay.links.length), top, "1")).cut;
  check(shut.length === 2 && shut.includes(pair.lay.links[top].a) && shut.includes(pair.lay.links[top].b), "two 1s joined to each other, and nothing else, are marked as shut off");
  const cr = puzzleOf(5, "..2.." + "....." + "2...2" + "....." + "..2.."), none5 = "00";
  check(crossed(cr, "10", 1) && crossed(cr, "01", 0) && !crossed(cr, none5, 0), "a bridge that would cross another is found, and not when nothing is built");
}

// ---------- hints ----------
{
  let trueSteps = 0, steps = 0, solvedAlone = 0, ran = 0;
  const techs = new Set();
  for (const { P, p } of made) {
    let marks = "0".repeat(P.lay.links.length), n = 0;
    while (!solvedBy(P, marks) && n < 4 * P.lay.links.length + 5) {
      const h = hintFor(P, marks);
      if (!h) break;
      n++;
      if (h.wrong != null) marks = withMark(marks, h.wrong, h.should);
      else if (h.reveal != null) marks = withMark(marks, h.reveal, h.should);
      else {
        steps++;
        techs.add(h.step.tech);
        const { link, to } = h.step;
        if (to <= +p.sol[link] && to > +marks[link]) trueSteps++;
        marks = withMark(marks, link, String(to));
      }
    }
    ran++;
    if (solvedBy(P, marks)) solvedAlone++;
  }
  check(steps > 0 && trueSteps === steps, `every step a hint takes is true of the answer and builds a bridge not yet there (${steps} steps, ${[...techs].sort().join(", ")})`);
  check(solvedAlone === ran, `hints alone solve a puzzle (${solvedAlone} of ${ran})`);
  const { P, p } = made.find(m => m.size === 7);
  const l = [...p.sol].findIndex(c => c === "0");
  const wrong = withMark("0".repeat(P.lay.links.length), l, "1");
  const h = hintFor(P, wrong);
  check(h.wrong === l && h.should === "0", "a bridge where the answer has none is cleared before any step");
}

// ---------- kept through JSON and the database ----------
{
  const { P, p, seed } = made.find(m => m.size === 9 && m.level === "medium");
  let marks = "0".repeat(P.lay.links.length);
  for (const l of [...p.sol].map((c, i) => (c !== "0" ? i : -1)).filter(i => i >= 0).slice(0, 5)) marks = withMark(marks, l, p.sol[l]);
  const run = { v: 1, mode: "random", seed, size: 9, level: "medium", came: p.level, grid: p.grid, sol: p.sol, marks, undo: [[3, "0", "1"]], redo: [], ms: 41250, hints: 1, done: null, lit: null };
  const back = JSON.parse(JSON.stringify(run)), Q = puzzleOf(back.size, back.grid, back.sol);
  check(same(back, run) && same(Q.lay.links, P.lay.links) && !solvedBy(Q, back.marks), "a run in play survives JSON: its puzzle, marks, clock and hints");
  const db = roundTrip(JSON.parse(JSON.stringify(run)));
  check(db.marks === run.marks && db.grid === run.grid && same(db.undo, run.undo), "…and the database's round trip");
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "bridges.js", "utf8"), html = fs.readFileSync(root + "bridges.html", "utf8");
  const soon = fs.readFileSync(root + "soon-data.js", "utf8"), logos = fs.readFileSync(root + "soon-logos.js", "utf8");
  check(/id: "bridges",[^\n]*href: "\.\/bridges\.html"/.test(apps) && !/id: "bridges"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
  check(!/^ {2}bridges: \{/m.test(soon) && !/^ {2}bridges: `/m.test(logos), "the placeholder's entry and logos are gone");
  check(/roundOver\("bridges"\)/.test(page) && /noteDayTime\("bridges"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "bridges"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/bridges\.css/.test(html) && /bridges\.js/.test(html) && /class="bridges fit-screen beside"/.test(html), "the page links its styles and script");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("bridges: the rules, the generator, the grading, hints and the database hold");
