// Asterism (asterism-engine.js; the genre called Star Battle elsewhere): the answer search against a plain one on small
// boards, the generator (one answer, regions joined with K stars each, across seeds, sizes, star counts and levels, the
// same puzzle for a seed on every device), the grading (each level needs its hardest step and no harder), the steps a hint
// takes (each true of the answer, and enough to solve a puzzle alone), the marks and the rules they break, a run through
// JSON; and the page wired to it.
import fs from "node:fs";
import { KINDS, STARS, SIZES, LEVELS, ORDER, DAILY, NONE, STAR, DOT, puzzleOf, answers, solveAs, gradeOf, findStep, generate, nextMark, withMark, solvedBy, breaks, hintFor, levelOn } from "../asterism-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const seedRng = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

// ---------- the answer search against a plain one ----------
{
  // every arrangement of one star a row on a 5×5 board, by trying every order of the columns
  const N = 5, perms = [];
  const walk = (cols, used) => { if (cols.length === N) { perms.push(cols.slice()); return; } for (let c = 0; c < N; c++) if (!used[c] && (!cols.length || Math.abs(cols.at(-1) - c) > 1)) { used[c] = 1; cols.push(c); walk(cols, used); cols.pop(); used[c] = 0; } };
  walk([], []);
  const rng = seedRng(7);
  let agree = 0, total = 0, withAnswers = 0;
  for (let t = 0; t < 40; t++) {
    // a random cut into five pieces (not even joined: the search does not care)
    const reg = Array.from({ length: N * N }, () => Math.floor(rng() * N)).join("");
    const P = puzzleOf(N, 1, reg);
    const plain = perms.filter(p => { const seen = new Set(p.map((c, r) => reg[r * N + c])); return seen.size === N; }).length;
    const found = answers(P, 1000).length;
    total++; if (found === plain) agree++;
    if (plain) withAnswers++;
  }
  check(agree === total && withAnswers >= 3, `the answer search agrees with a plain search of every order of the columns (${total} random cuts of 5×5, ${withAnswers} with an answer)`);
}

// ---------- the board ----------
{
  const P = puzzleOf(5, 1, "0000011112111222233322344".replace(/./g, ch => ch)), diag = P.nbr[12];
  check(P.nbr[0].length === 3 && P.nbr[12].length === 8 && P.nbr[2].length === 5, "a cell touches 3, 5 or 8 others, corners included");
  check(P.groups.length === 15 && P.groups.slice(0, 5).every(g => g.cells.length === 5) && P.groups.slice(10).reduce((n, g) => n + g.cells.length, 0) === 25, "rows, columns and regions are all there");
  check(diag.includes(6) && diag.includes(18), "the diagonals count as touching");
  check(KINDS[1].join() === "5,6,7,8,9,10" && KINDS[2].join() === "8,9,10" && STARS.join() === "1,2", "one star on 5 to 10, two stars on 8 to 10");
  check(levelOn(8, 1, "bogus") === "medium" && levelOn(8, 1, "hard") === "hard", "an unknown level is Medium");
}

// ---------- the generator ----------
const connected = (N, reg, r) => {
  const cells = [...reg].map((v, x) => (+v === r ? x : -1)).filter(x => x >= 0), seen = new Set([cells[0]]), queue = [cells[0]];
  for (let q = 0; q < queue.length; q++) for (const d of [-N, N, -1, 1]) { const y = queue[q] + d; if (y < 0 || y >= N * N || (Math.abs(d) === 1 && Math.floor(y / N) !== Math.floor(queue[q] / N))) continue; if (+reg[y] === r && !seen.has(y)) { seen.add(y); queue.push(y); } }
  return seen.size === cells.length;
};
const made = [];
{
  const jobs = [];
  for (const k of STARS) for (const N of KINDS[k]) if (!(k === 2 && N === 10)) jobs.push([N, k, "medium"]);   // (a 10×10 with two stars takes a second or two: the nightly run has it)
  jobs.push([6, 1, "easy"], [8, 1, "easy"], [8, 1, "hard"], [8, 1, "expert"]);
  let seed = 11;
  for (const [N, k, level] of jobs) {
    const p = generate(seed += 7919, N, k, level);
    made.push({ N, k, level, p });
  }
  check(made.every(m => m.p), "a puzzle comes of every size, star count and level asked");
  const oneEach = made.every(({ N, k, p }) => {
    const P = puzzleOf(N, k, p.reg, p.sol), a = answers(P, 3);
    return a.length === 1 && a[0].join() === [...p.sol].map((v, x) => (v === "1" ? x : -1)).filter(x => x >= 0).join();
  });
  check(oneEach, `every puzzle has exactly one answer, the one it was made from (${made.length} puzzles)`);
  const shape = made.every(({ N, k, p }) => {
    const P = puzzleOf(N, k, p.reg, p.sol);
    return [...Array(N).keys()].every(r => connected(N, p.reg, r) && P.groups[2 * N + r].cells.filter(x => p.sol[x] === "1").length === k)
      && P.groups.every(g => g.cells.filter(x => p.sol[x] === "1").length === k);
  });
  check(shape, "every region is in one piece and every region, row and column holds its stars");
  const lonely = made.every(({ N, p }) => { const s = [...p.sol].map((v, x) => (v === "1" ? x : -1)).filter(x => x >= 0); return s.every(a => s.every(b => a === b || Math.abs(Math.floor(a / N) - Math.floor(b / N)) > 1 || Math.abs((a % N) - (b % N)) > 1)); });
  check(lonely, "no two stars of an answer touch");
  const again = generate(11 + 7919, 5, 1, "medium"), same = JSON.stringify(again) === JSON.stringify(made[0].p);
  check(same, "a seed makes the same puzzle every time");
  const d1 = generate(20261104, DAILY.size, DAILY.k, DAILY.level), d2 = generate(20261104, DAILY.size, DAILY.k, DAILY.level);
  check(JSON.stringify(d1) === JSON.stringify(d2) && d1.level === DAILY.level, "today's puzzle is the same for everyone and is its level");
  check(made.filter(m => m.level === "easy" && m.p.level === "easy").length === 2 && made.some(m => m.level === "expert" && m.p.level === "expert"), "Easy and Expert come of the sizes that have them");
}

// ---------- the grading ----------
{
  let fine = true, order = true;
  for (const { N, k, p } of made) {
    const P = puzzleOf(N, k, p.reg, p.sol), lv = ORDER.indexOf(p.level);
    const full = solveAs(P, 3), lower = lv > 0 ? solveAs(P, lv - 1) : { solved: false };
    if (!full.solved || full.level !== lv || lower.solved || gradeOf(P) !== lv) fine = false;
  }
  check(fine, "each puzzle is solved by reasoning to its level, and not by the level below");
  check(order && ORDER.every(l => LEVELS[l]) && ORDER.length === 4, "four levels");
}

// ---------- every step is true of the answer ----------
{
  let steps = 0, truth = true, techs = new Set();
  for (const { N, k, p } of made) {
    const P = puzzleOf(N, k, p.reg, p.sol), st = new Int8Array(N * N);
    for (let guard = 0; guard < 400; guard++) {
      const s = findStep(P, st, 3);
      if (!s) break;
      steps++; techs.add(s.tech);
      for (const [c, m] of s.set) { if ((m === 1) !== (p.sol[c] === "1") || st[c] !== 0) truth = false; st[c] = m; }
    }
  }
  check(truth && steps > 100, `every step marks only what the answer says, on a cell not yet marked (${steps} steps)`);
  check(["touch", "full", "only", "pattern", "look", "count", "trial"].every(t => techs.has(t)), `every kind of step is used: ${[...techs].join(", ")}`);
}

// ---------- marks, rules, hints ----------
{
  const { N, k, p } = made.find(m => m.N === 6 && m.k === 1);
  const P = puzzleOf(N, k, p.reg, p.sol), cells = [...p.sol].map((v, x) => (v === "1" ? x : -1)).filter(x => x >= 0);
  check(nextMark(NONE) === DOT && nextMark(DOT) === STAR && nextMark(STAR) === NONE, "a tap cycles empty, dot, star, empty");
  check(withMark("000", 1, STAR) === "010", "a mark is set by index");
  let marks = NONE.repeat(N * N);
  for (const c of cells) marks = withMark(marks, c, STAR);
  check(solvedBy(P, marks) && !breaks(P, marks).bad.size && !breaks(P, marks).over.length, "the answer's stars solve it and break nothing");
  check(!solvedBy(P, withMark(marks, cells[0], DOT)), "a missing star is not solved");
  check(solvedBy(P, withMark(marks, marks.indexOf(NONE), DOT)), "dots lie where they like: only the stars count");
  let touch = withMark(NONE.repeat(N * N), 0, STAR);
  touch = withMark(touch, N + 1, STAR);
  const b = breaks(P, touch);
  check(b.touch.length === 2 && b.bad.has(0) && b.bad.has(N + 1), "two stars at a corner are caught");
  let many = withMark(withMark(NONE.repeat(N * N), 0, STAR), 2, STAR);
  check(breaks(P, many).over.length >= 1, "two stars in a row of one-star is too many");
  const full = withMark(withMark(NONE.repeat(N * N), 0, STAR), N * N - 1, STAR);
  check(!breaks(P, full).touch.length, "far stars do not touch");
  // a hint puts a wrong mark right first, then steps; hints alone solve it
  const wrong = [...Array(N * N).keys()].find(x => p.sol[x] !== "1"), h1 = hintFor(P, withMark(NONE.repeat(N * N), wrong, STAR));
  check(h1.wrong === wrong && h1.should === DOT, "a hint puts a wrong star right first");
  const h2 = hintFor(P, withMark(NONE.repeat(N * N), cells[0], DOT));
  check(h2.wrong === cells[0] && h2.should === STAR, "and a dot on a star");
  let alone = true;
  for (const { N: n, k: kk, p: q } of made.slice(0, 6)) {
    const Q = puzzleOf(n, kk, q.reg, q.sol);
    let m = NONE.repeat(n * n), guard = 0;
    while (!solvedBy(Q, m) && guard++ < 400) {
      const h = hintFor(Q, m);
      if (!h) { alone = false; break; }
      if (h.step) for (const [c, v] of h.step.set) m = withMark(m, c, String(v));
      else m = withMark(m, h.wrong ?? h.reveal, h.should);
    }
    if (!solvedBy(Q, m)) alone = false;
  }
  check(alone, "following the hints alone solves a puzzle");
}

// ---------- a run through JSON ----------
{
  const { N, k, p } = made[2], run = { v: 1, mode: "random", seed: 5, size: N, k, level: "medium", came: p.level, reg: p.reg, sol: p.sol, marks: NONE.repeat(N * N), undo: [[3, "0", "2", 0]], redo: [], ms: 1234, hints: 1, done: null, lit: null };
  const back = JSON.parse(JSON.stringify(run));
  check(JSON.stringify(back) === JSON.stringify(run) && puzzleOf(back.size, back.k, back.reg, back.sol).sol.length === N * N, "a saved run comes back as it went");
}

// ---------- the pages ----------
{
  const read = f => fs.readFileSync(root + f, "utf8");
  const apps = read("apps.js"), page = read("asterism.js"), html = read("asterism.html"), css = read("asterism.css");
  check(/id: "asterism",[^\n]*href: "\.\/asterism\.html"/.test(apps) && /asterism: "time"/.test(read("suite.js")) && /asterism: "a puzzle solved"/.test(read("random-core.js")) && /asterism: \{ name: "Asterism"/.test(read("rooms.js")), "the tile, the games screen's figure, Random and the rooms list know it");
  check(/asterism: `<svg viewBox="0 0 20 20"/.test(apps) && /asterism: `<svg class="k-ico"/.test(apps) && /const ASTERISM_LOGO/.test(apps), "a logo in each of the three houses");
  check(/roundOver\("asterism"\)/.test(page) && /noteDayTime\("asterism"/.test(page) && /arrivedForToday\(\)/.test(page) && /onPause\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "asterism"\)/.test(page),
    "the page counts a solve for Random and for today, opens today's from the tile, stops its clock with the menu");
  check(/asterism\.css/.test(html) && /asterism\.js/.test(html) && /class="asterism full titled fit-screen beside"/.test(html), "the page links its styles and script, full screen and titled");
  check(!/\b(alert|confirm|prompt)\(/.test(page) && /IN_FRAME/.test(page), "no browser pop-ups, and a watching frame writes nothing");
  check(!/Star Battle/.test(page + html + css) && /star battle/.test(read("games-find.js")), "the old name is a search keyword only");
  check(/TIMES = "asterism:times"/.test(page), "times are kept lowest-first under asterism:times (the games screen reads a :best as highest-is-best)");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("asterism: the rules, the generator, the grading, hints and marks hold");
