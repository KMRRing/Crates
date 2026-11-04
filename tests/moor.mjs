// Moor (moor-engine.js): the rules checked against a plain search, the solver's soundness (it never claims a cell the answer
// doesn't have, and a puzzle it finishes has one answer), the generator (one answer, across sizes and levels, the same
// puzzle for a seed on every device, today's the same for everyone), the grading, the steps a hint takes (each true of the
// answer, and enough to solve a puzzle alone), the rules the marks break, and the page wired to it.
import fs from "node:fs";
import { SIZES, LEVELS, ORDER, DAILY, NONE, BARGE, WATER, geo, puzzleOf, startOf, solveAs, gradeOf, count, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "../moor-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

/** Whether a set of barges is an answer, by the rules as the page's Rules say them and nothing of the solver's. */
function plainMeets(P, tents) {
  const { N, dock } = P, set = new Set(tents);
  if (tents.length !== P.docks.length) return false;
  for (const t of tents) {
    if (dock[t]) return false;
    const r = Math.floor(t / N), c = t % N;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && set.has((r + dr) * N + c + dc) && r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N) return false;
  }
  for (let i = 0; i < N; i++) {
    if (tents.filter(t => Math.floor(t / N) === i).length !== P.rows[i] || tents.filter(t => t % N === i).length !== P.cols[i]) return false;
  }
  // each barge a dock of its own beside it (every assignment tried: small boards only)
  const used = new Set();
  const go = k => {
    if (k === tents.length) return true;
    const t = tents[k], r = Math.floor(t / N), c = t % N;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr, cc = c + dc, d = rr * N + cc;
      if (rr < 0 || cc < 0 || rr >= N || cc >= N || !dock[d] || used.has(d)) continue;
      used.add(d);
      if (go(k + 1)) return true;
      used.delete(d);
    }
    return false;
  };
  return go(0);
}
const bargesOf = sol => [...sol].map((ch, i) => (ch === BARGE ? i : -1)).filter(i => i >= 0);

// ---------- the board ----------
{
  const g = geo(6);
  check(g.ns4[0].length === 2 && g.ns4[7].length === 4 && g.ns8[0].length === 3 && g.ns8[7].length === 8 && g.lines.length === 12, "a board knows its neighbours and its twelve lines");
  const P = puzzleOf(6, "1" + "0".repeat(35), "0".repeat(35) + "1");
  check(P.docks.length === 1 && P.rows[5] === 1 && P.cols[5] === 1 && P.rows[0] === 0, "the counts are the answer's");
  check(startOf(P)[0] === 2 && startOf(P)[1] === 0 && startOf(P)[7] === 2 && startOf(P)[14] === 2, "a start has the dock's cell and every cell with no dock beside it as open water");
  check(nextMark(NONE) === BARGE && nextMark(BARGE) === WATER && nextMark(WATER) === NONE, "a tap cycles clear, barge, water");
  check(withMark("000", 1, "1") === "010", "a mark goes in its cell");
  check(levelOn(8, "hard") === "hard" && levelOn(8, "nonsense") === "medium" && levelOn(6, "expert") === "hard" && levelOn(8, "expert") === "expert", "a level the page doesn't know is Medium");
}

// ---------- the solver against a plain search, on boards dealt at random ----------
{
  let boards = 0, finished = 0, multi = 0, wrong = 0, unsound = 0;
  const rng = seedRng(7);
  for (let i = 0; i < 160; i++) {
    const N = 6, g = geo(N), want = 5 + Math.floor(rng() * 5), tents = [], blocked = new Uint8Array(N * N);
    for (const x of Array.from({ length: N * N }, (_, k) => k).sort(() => rng() - 0.5)) {
      if (tents.length >= want) break;
      if (blocked[x]) continue;
      tents.push(x); blocked[x] = 1; for (const y of g.ns8[x]) blocked[y] = 1;
    }
    const isT = new Set(tents), taken = new Map(), seen = new Set();
    const grab = t => { for (const c of [...g.ns4[t]].sort(() => rng() - 0.5)) { if (isT.has(c) || seen.has(c)) continue; seen.add(c); if (!taken.has(c) || grab(taken.get(c))) { taken.set(c, t); return true; } } return false; };
    for (const t of tents) { seen.clear(); grab(t); }
    const gr = new Array(N * N).fill("0"), so = new Array(N * N).fill("0");
    for (const [d, t] of taken) { gr[d] = "1"; so[t] = "1"; }
    const P = puzzleOf(N, gr.join(""), so.join(""));
    boards++;
    const answers = count(P, 5);
    for (let level = 0; level < 4; level++) {
      const r = solveAs(P, level);
      // soundness: every cell the solver decided agrees with the planted answer (which is one of the answers)
      if (answers === 1) for (let x = 0; x < P.cells; x++) if (r.st[x] && (r.st[x] === 1) !== (P.sol[x] === BARGE)) unsound++;
      if (r.solved) {
        finished++;
        if (answers !== 1) multi++;
        if (!plainMeets(P, bargesOf(P.sol)) || bargesOf(P.sol).some(x => r.st[x] !== 1)) wrong++;
      }
    }
  }
  check(boards === 160 && finished > 100, `the solver finishes many of 160 random boards at some level (${finished} finishes)`);
  check(multi === 0, "a board the solver finishes has exactly one answer (a plain search agrees, at every level)");
  check(wrong === 0 && unsound === 0, "the planted answer meets the rules as the page says them and the solver never decides a cell against it");
}

// ---------- the puzzles ----------
{
  const rows = [], times = {};
  const kinds = [[6, "easy", 2], [6, "medium", 2], [6, "hard", 2], [8, "easy", 2], [8, "medium", 2], [8, "hard", 2], [8, "expert", 2], [10, "medium", 1], [12, "hard", 1], [14, "easy", 1]];
  let allOne = true, allMeet = true, allGraded = true, nearest = true;
  for (const [size, level, n] of kinds) for (let s = 1; s <= n; s++) {
    const t = Date.now(), r = generate(100 * s + size, size, level);
    times[`${size}${level}`] = (times[`${size}${level}`] || 0) + Date.now() - t;
    if (!r) { allOne = false; continue; }
    const P = puzzleOf(size, r.grid, r.sol), grade = gradeOf(P);
    if (ORDER[grade] !== r.level) allGraded = false;
    if (size <= 8 && count(P, 2) !== 1) allOne = false;
    if (size <= 8 && !plainMeets(P, bargesOf(r.sol))) allMeet = false;
    if (solveAs(P, grade).st.some((v, x) => v === 1 && r.sol[x] !== BARGE)) allMeet = false;
    if (grade > 0 && solveAs(P, grade - 1).solved) allGraded = false;
    rows.push(r.level === level); if (r.level !== level) console.log("  (asked", size, level, "got", r.level, ")");
    if (r.level !== level) nearest = nearest && Math.abs(ORDER.indexOf(r.level) - ORDER.indexOf(level)) <= 2;
  }
  check(allOne, "every puzzle has exactly one answer (a plain search, up to 8×8) and the solver finishes it");
  check(allMeet, "the answer meets the rules as the page says them");
  check(allGraded, "a puzzle's level is the lowest at which its reasoning finishes it");
  check(rows.filter(Boolean).length >= rows.length - 3 && nearest, `the level asked for comes (${rows.filter(Boolean).length} of ${rows.length}); else the nearest`);
  const a = generate(4242, 8, "medium"), b = generate(4242, 8, "medium");
  check(JSON.stringify(a) === JSON.stringify(b), "a seed's puzzle is the same every time");
  const d = generate(20261104, DAILY.size, DAILY.level);
  check(!!d && JSON.stringify(d) === JSON.stringify(generate(20261104, DAILY.size, DAILY.level)), "today's puzzle is the same for everyone");
  for (const size of SIZES) check(!!generate(31, size, "easy"), `a ${size}×${size} puzzle comes`);
}

// ---------- marks and the rules they break ----------
{
  // a 6×6 with docks at 7 and 22, answers at 8 and 21 / 23 ...
  const grid = "0".repeat(36).split("");
  grid[7] = "1"; grid[22] = "1";
  const sol = "0".repeat(36).split("");
  sol[8] = "1"; sol[21] = "1";
  const P = puzzleOf(6, grid.join(""), sol.join(""));
  const put = list => { let m = NONE.repeat(36); for (const x of list) m = withMark(m, x, BARGE); return m; };
  check(solvedBy(P, put([8, 21])) && !solvedBy(P, put([8])) && !solvedBy(P, put([8, 21, 23])), "solved when exactly the answer's barges are moored");
  let b = breaks(P, put([8, 14]));
  check(b.touch.includes(8) && b.touch.includes(14) && breaks(P, put([8, 21])).touch.length === 0, "barges that touch (even at a corner) are marked");
  b = breaks(P, put([0]));
  check(b.stray.includes(0) && !breaks(P, put([8])).stray.length, "a barge with no dock beside it is stray");
  b = breaks(P, put([6, 8]));
  check(b.stray.includes(6) && b.stray.includes(8) && b.over.includes(1), "two barges for one dock are both stray, and a row with too many is over");
  b = breaks(P, put([8, 21]));
  check(b.full.includes(1) && b.moored.includes(7) && b.moored.includes(22), "a row with its barges is whole; a dock with its barge is moored");
}

// ---------- hints ----------
{
  let allTrue = true, solves = true, wrongFixed = true;
  for (const [size, level, seed] of [[6, "medium", 3], [8, "hard", 5], [8, "expert", 9], [10, "medium", 2]]) {
    const r = generate(seed, size, level), P = puzzleOf(size, r.grid, r.sol);
    let marks = NONE.repeat(size * size), guard = 0;
    while (!solvedBy(P, marks) && guard++ < 60) {
      const h = hintFor(P, marks);
      if (!h) break;
      if (h.step) { if (r.sol[h.step.x] !== BARGE) allTrue = false; marks = withMark(marks, h.step.x, BARGE); }
      else if (h.reveal != null) marks = withMark(marks, h.reveal, BARGE);
      else break;
    }
    if (!solvedBy(P, marks)) solves = false;
    // a wrong mark is put right first
    const x = r.sol.indexOf("0");
    const bad = P.dock[x] ? -1 : x;
    if (bad >= 0 && r.sol[bad] !== BARGE) { const h = hintFor(P, withMark(NONE.repeat(size * size), bad, BARGE)); if (h.wrong !== bad || h.should !== WATER) wrongFixed = false; }
  }
  check(allTrue, "every step a hint takes is true of the answer");
  check(solves, "hints alone, from an empty board, solve the puzzle");
  check(wrongFixed, "a wrong mark is the first hint, put right");
}

// ---------- the pages ----------
{
  const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "moor.js", "utf8"), html = fs.readFileSync(root + "moor.html", "utf8");
  const css = fs.readFileSync(root + "moor.css", "utf8"), three = fs.readFileSync(root + "moor-3d.js", "utf8");
  check(/id: "moor",[^\n]*href: "\.\/moor\.html"/.test(apps) && /moor: `<svg viewBox="0 0 20 20"/.test(apps) && /moor: `<svg class="k-ico"/.test(apps), "the tile opens the game, with a Modern logo and a Kontor icon");
  check(/roundOver\("moor"\)/.test(page) && /noteDayTime\("moor"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "moor"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/moor\.css/.test(html) && /moor\.js/.test(html) && /class="moor full titled fit-screen beside"/.test(html), "the page links its styles and script");
  check(/mr-clue/.test(css) && /mr-c\.barge/.test(css) && /IN_FRAME/.test(page), "counts and barges are styled, and a watching frame draws the partner's board without writing");
  check(/moor-3d\.js/.test(page) && /createModel/.test(three) && /import \* as THREE from "\.\/vendor\/three\.js"/.test(three) && !/alert\(|confirm\(|prompt\(/.test(page), "the 3D harbour loads only when asked for, from the bundled three.js");
  check(/Math\.min\(devicePixelRatio \|\| 1, 2\)/.test(three) && !/filter/.test(css + three), "WebGL's pixel ratio is capped at 2 and nothing uses an SVG filter");
}

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nall ok");
