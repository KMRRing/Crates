// Mines (mines-grid.js, mines-solid.js, mines-solve.js, mines-engine.js, mines-bot.js, mines-team.js): the three
// tilings and the three solids, and who touches whom on each (the cube's edges and corners, the Goldberg sphere's
// twelve pentagons); the rules of a field (digging, the flood, flags, chording, strikes, the end); the solver, every
// deduction it makes checked against every way the mines could lie, flat and round a solid; fields dealt that clear
// without a guess, at the reasoning their level asks, on every shape; hints; the computer rival and partner; the
// split of a team's numbers (the shares make the whole and neither clears the field alone); the team's field through
// the database's own round trip; a run kept as JSON; and today's field, the same for everyone.
import { SHAPES, neighbours, outline, cellAt, shareOf, extent } from "../mines-grid.js";
import { SOLIDS, solidBoard, solidShares } from "../mines-solid.js";
import { solve, createSolver, placements } from "../mines-solve.js";
import { FIELDS, MINES, TARGET, SIZES, LEVELS, STRIKE, HINT, dims, deal, fieldOf, bbbv, newRun, dig, flag, chord, score, minesLeft, safeLeft,
  started, hint, needsBoth, readerOf, daily, WEEK, weekdayOf, describe, settingsOf, rng, graphOf, isSolid, tilingOf, shapeOf,
  SHAPES as EVERY } from "../mines-engine.js";
import { PACES, rivalPlan, rivalAt, partnerMove, SPEAK_AFTER, PRESS_AFTER } from "../mines-bot.js";
import { teamMove, teamField, teamScore, readers, freshField } from "../mines-team.js";
import { freshDuel, sayReady, startAll, rematch } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const db = g => roundTrip(JSON.parse(JSON.stringify(g)));
const shapes = Object.keys(SHAPES), solids = Object.keys(SOLIDS), every = Object.keys(EVERY);

// ---------- the tilings ----------
for (const [shape, w, h] of [["square", 7, 6], ["hex", 7, 6], ["tri", 9, 6]]) {
  const nb = neighbours(shape, w, h), n = w * h;
  const sym = nb.every((l, i) => l.every(j => nb[j].includes(i)) && !l.includes(i) && new Set(l).size === l.length);
  const most = Math.max(...nb.map(l => l.length));
  check(sym && most === SHAPES[shape].most, `${shape}: neighbours both ways, each cell touching at most ${SHAPES[shape].most}`);
  const pts = i => outline(shape, w, i).pts;
  const touch = (a, b) => pts(a).some(([x, y]) => pts(b).some(([u, v]) => Math.hypot(x - u, y - v) < 1e-6));
  let geo = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && touch(i, j) !== nb[i].includes(j)) geo++;
  check(!geo, `${shape}: a cell's neighbours are exactly the cells its outline touches`);
  const hits = [...Array(n).keys()].every(i => { const o = outline(shape, w, i); return cellAt(shape, w, h, o.cx, o.cy) === i; });
  const e = extent(shape, w, h);
  check(hits && cellAt(shape, w, h, -1, -1) === -1 && cellAt(shape, w, h, e.w + 2, e.h + 2) === -1, `${shape}: a finger on a cell's middle finds it, off the field nothing`);
  for (const people of [2, 3, 4, 6]) {
    const share = [...Array(n).keys()].map(i => shareOf(shape, w, i, people)), sizes = Array.from({ length: people }, (_, k) => share.filter(s => s === k).length);
    check(share.every(s => s >= 0 && s < people) && Math.max(...sizes) - Math.min(...sizes) <= Math.ceil(n / people / 2) + 1,
      `${shape}: ${people} players' shares cover every cell, about evenly (${sizes.join("/")})`);
  }
}
{
  const nb = neighbours("square", 6, 6);
  const chess = [...Array(36).keys()].every(i => nb[i].filter(j => Math.abs(j - i) === 1 || Math.abs(j - i) === 6).every(j => shareOf("square", 6, j, 2) !== shareOf("square", 6, i, 2)));
  check(chess, "squares for two: a chessboard, every cell's four edge neighbours the other player's");
}

// ---------- the solids: who touches whom, against the geometry itself ----------
/** How many outline points two cells share, in 3D (corners are worked out once per cell, so a point is a point). */
const sharedPoints = (a, b) => a.pts.filter(p => b.pts.some(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-9)).length;
const symmetric = nb => nb.every((l, i) => l.every(j => nb[j].includes(i)) && !l.includes(i) && new Set(l).size === l.length);
const tally = list => { const t = {}; for (const x of list) t[x] = (t[x] || 0) + 1; return t; };
{
  for (const k of [2, 3, 4, 7]) {
    const b = solidBoard("cube", k), deg = tally(b.nb.map(l => l.length));
    check(b.n === 6 * k * k && symmetric(b.nb) && deg[7] === 24 && (deg[8] || 0) === b.n - 24,
      `the cube ${k}×${k}: ${b.n} cells, neighbours both ways, the 24 corner cells touching seven and every other eight`);
    let geo = 0;
    for (let i = 0; i < b.n; i++) for (let j = 0; j < b.n; j++) if (i !== j && (sharedPoints(b.cells[i], b.cells[j]) > 0) !== b.nb[i].includes(j)) geo++;
    check(!geo, `the cube ${k}×${k}: a cell's neighbours are exactly the cells its square shares a point with, across the cube's edges too`);
    // by where a cell lies on its face: in the middle all eight on its face; on an edge five on its face and the three
    // beyond the edge; at a corner three on its face and two on each of the other two faces, which touch each other
    let shapesRight = true;
    for (let i = 0; i < b.n; i++) {
      const c = b.cells[i], here = b.nb[i].filter(j => b.cells[j].face === c.face).length, away = tally(b.nb[i].filter(j => b.cells[j].face !== c.face).map(j => b.cells[j].face));
      const awayCounts = Object.values(away).sort().join(",");
      if (b.nb[i].length === 7) shapesRight &&= here === 3 && awayCounts === "2,2";
      else if (here === 8) shapesRight &&= awayCounts === "";
      else shapesRight &&= here === 5 && awayCounts === "3";
    }
    // the three cells round one of the cube's corners each touch seven, and one another
    const a = 1 / Math.sqrt(3), round = [...Array(b.n).keys()].filter(i => b.cells[i].pts.some(p => Math.hypot(p[0] - a, p[1] - a, p[2] - a) < 1e-9));
    check(shapesRight && round.length === 3 && round.every(i => b.nb[i].length === 7 && round.every(j => j === i || b.nb[i].includes(j))),
      `the cube ${k}×${k}: a middle cell touches eight on its face, an edge cell five and the three beyond the edge, a corner cell three and two on each other face (the three corner cells touching)`);
  }
  for (const k of [1, 2, 3, 5, 7]) {
    const b = solidBoard("sphere", k), deg = tally(b.nb.map(l => l.length));
    const pentagons = b.cells.filter((c, i) => b.nb[i].length === 5 && c.pts.length === 5).length;
    const hexagons = b.cells.filter((c, i) => b.nb[i].length === 6 && c.pts.length === 6).length;
    check(b.n === 10 * k * k + 2 && pentagons === 12 && hexagons === 10 * (k * k - 1) && symmetric(b.nb) && deg[5] === 12,
      `the sphere, Goldberg GP(${k},0): ${b.n} cells, exactly 12 pentagons touching five and ${hexagons} hexagons touching six, neighbours both ways`);
    let geo = 0;
    for (let i = 0; i < b.n; i++) for (let j = 0; j < b.n; j++) if (i !== j && (sharedPoints(b.cells[i], b.cells[j]) === 2) !== b.nb[i].includes(j)) geo++;
    const corners = new Set(b.cells.flatMap(c => c.pts.map(p => p.map(x => x.toFixed(9)).join(","))));
    const edges = b.nb.reduce((s, l) => s + l.length, 0) / 2;
    const onSphere = b.cells.every(c => Math.abs(Math.hypot(...c.c) - 1) < 1e-9 && c.pts.every(p => Math.abs(Math.hypot(...p) - 1) < 1e-9));
    check(!geo && corners.size - edges + b.n === 2 && corners.size === 20 * k * k && onSphere,
      `the sphere GP(${k},0): cells touch exactly when their outlines share an edge, the outlines' corners lie on the sphere, and corners − edges + cells = 2 (Euler's)`);
  }
  for (const k of [1, 2, 4]) {
    const b = solidBoard("geodesic", k), deg = tally(b.nb.map(l => l.length));
    let geo = 0;
    for (let i = 0; i < b.n; i++) for (let j = 0; j < b.n; j++) if (i !== j && (sharedPoints(b.cells[i], b.cells[j]) > 0) !== b.nb[i].includes(j)) geo++;
    const counts = k === 1 ? deg[9] === 20 : deg[11] === 60 && deg[12] === b.n - 60;
    check(b.n === 20 * k * k && symmetric(b.nb) && counts && !geo && b.side.every(l => l.length === 3),
      `the geodesic sphere ${k}: ${b.n} triangles, each touching every triangle it shares a point with (twelve, or eleven beside the twelve five-fold corners), three along its sides`);
  }
  // the shares of a solid field: every cell in one, about evenly, and for two the side neighbours mostly the other's
  for (const [shape, k, fine] of [["cube", 7, 0.9], ["sphere", 5, 0.62], ["geodesic", 4, 0.9]]) {
    const b = solidBoard(shape, k);
    for (const people of [2, 3, 4, 6]) {
      const share = solidShares(shape, k, people), sizes = Array.from({ length: people }, (_, s) => share.filter(x => x === s).length);
      check(share.length === b.n && share.every(s => s >= 0 && s < people) && Math.max(...sizes) - Math.min(...sizes) <= Math.ceil(b.n / people / 2) + 1,
        `${shape} ${k}: ${people} players' shares cover every cell, about evenly (${sizes.join("/")})`);
    }
    const two = solidShares(shape, k, 2);
    let apart = 0, pairs = 0;
    b.side.forEach((l, i) => l.forEach(j => { pairs++; if (two[i] !== two[j]) apart++; }));
    check(apart / pairs >= fine && solidShares(shape, k, 2) === two, `${shape} ${k} for two: ${Math.round(100 * apart / pairs)}% of side neighbours read by the other player (as fine as the solid allows), the same split each time`);
  }
  check(shapeOf("square", true) === "cube" && shapeOf("hex", true) === "sphere" && shapeOf("tri", true) === "geodesic" && shapeOf("hex", false) === "hex"
    && tilingOf("geodesic") === "tri" && tilingOf("square") === "square" && isSolid("cube") && !isSolid("hex"),
    "a tiling and the 3D switch make the field's shape, each chosen on its own");
  check(describe({ shape: "cube", size: "small", level: "easy" }) === "Small cube, easy" && describe({ shape: "sphere", size: "large", level: "hard" }) === "Large sphere, hard"
    && settingsOf({ shape: "geodesic" }).shape === "geodesic", "a solid field's name, and its settings kept");
}

// ---------- the rules ----------
// 5×4 squares, mines at (0,4) and (3,3); the start at (1,1) is empty
const M = (w, h, list, shape = "square") => { const m = new Uint8Array(w * h); for (const [r, c] of list) m[r * w + c] = 1; return m; };
{
  const f = fieldOf("square", 5, 4, M(5, 4, [[0, 4], [3, 3]]), 6);
  check(f.count === 2 && f.nums[6] === 0 && f.nums[3] === 1 && f.nums[8] === 2 - 1 && f.nums[13] === 1, "a field counts each cell's neighbouring mines");
  const run = newRun(f);
  check(dig(f, run, 0).why === "start" && run.cells === ".".repeat(20), "before the start is open, only the start can be dug");
  const r = dig(f, run, 6);
  check(r.ok && r.opened[0] === 6 && r.opened.length > 9 && run.cells[6] === "o" && run.cells[4] === "." && started(f, run.cells), "the empty start opens the patch round it, its border included");
  check(flag(f, run, 4) && run.cells[4] === "0" && minesLeft(f, run.cells) === 1 && dig(f, run, 4).why === "flag", "a flag marks a mine, counts off the mines left, and keeps its cell from digging");
  check(flag(f, run, 4) && run.cells[4] === "." && flag(f, run, 4), "a flag comes off again (and back)");
  check(!flag(f, run, 6) && dig(f, run, 6).why === "open", "an open cell takes no flag and no dig");
  const before = run.strikes, hit = dig(f, run, 18);
  check(hit.ok && hit.struck === 18 && run.cells[18] === "x" && run.strikes === before + 1 && !run.done && minesLeft(f, run.cells) === 0, "a mine dug is a strike: it stays, shown, and counts as found");
  check(score({ ms: 61400, strikes: 1, hints: 2 }) === 61 + STRIKE + 2 * HINT, "a score is the seconds on the clock plus the mines and hints");
  const h2 = fieldOf("square", 3, 3, M(3, 3, [[0, 0], [0, 2]]), 7), s = newRun(h2);
  dig(h2, s, 7);
  check(s.cells === "...oooooo", "a start on the bottom row opens the two rows above the mines' row");
  dig(h2, s, 0, { sudden: true });
  check(s.done && s.lost && !s.won && dig(h2, s, 1).why === "done", "played sudden, a mine ends the field");
}
{
  // chording, on a dealt field: a number with as many hidden neighbours as mines still missing flags them; one with
  // all its mines flagged digs the rest; a wrong flag under a chord digs a mine
  const f = deal({ seed: 3, shape: "square", size: "medium", level: "medium" }), run = newRun(f);
  dig(f, run, f.start);
  const find = test => [...Array(f.n).keys()].find(i => { if (run.cells[i] !== "o" || !f.nums[i]) return false; const nb = f.nb[i].map(j => run.cells[j]); return test(nb.filter(c => c === ".").length, nb.filter(c => c !== "." && c !== "o").length, f.nums[i]); });
  const full = find((hid, marked, v) => hid > 0 && hid + marked === v);
  const fc = full != null ? chord(f, run, full) : null;
  check(fc?.kind === "flag" && fc.cells.every(c => f.mine[c] && run.cells[c] === "0"), "a number with exactly as many hidden neighbours as mines left to find flags them all");
  const done = find((hid, marked, v) => hid > 0 && marked === v && f.nb.every(() => true));
  const before = safeLeft(f, run.cells), dc = done != null ? chord(f, run, done) : null;
  check(dc?.kind === "dig" && dc.results.every(r => r.ok && r.struck < 0) && safeLeft(f, run.cells) < before, "a number with all its mines flagged digs the rest round it");
  check(chord(f, run, f.start).kind === "none", "an empty cell has nothing to chord");
  const g = deal({ seed: 4, shape: "square", size: "medium", level: "medium" }), wrong = newRun(g);
  dig(g, wrong, g.start);
  const k = [...Array(g.n).keys()].find(i => wrong.cells[i] === "o" && g.nums[i] === 1 && g.nb[i].some(j => wrong.cells[j] === "." && !g.mine[j]) && g.nb[i].some(j => g.mine[j]));
  const safeOne = g.nb[k].find(j => wrong.cells[j] === "." && !g.mine[j]);
  flag(g, wrong, safeOne);
  const c = chord(g, wrong, k);
  check(c.kind === "dig" && wrong.strikes === 1 && c.results.some(r => r.struck >= 0), "a wrong flag makes a chord dig a mine: a strike");
}
{
  // 3BV: one empty patch opens a field's border at once; a number no empty cell touches is a click of its own
  const f = fieldOf("square", 4, 1, M(4, 1, [[0, 3]]), 0);
  check(bbbv(f) === 1, "3BV: one patch is one click");
  const g = fieldOf("square", 5, 1, M(5, 1, [[0, 1], [0, 3]]), 4);
  check(bbbv(g) === 3, "3BV: three cells cut off by mines are three clicks");
}

// ---------- the solver, checked against every way the mines could lie ----------
/**
 * Every way the mines could lie that agrees with what's open (st: -1 hidden, 0 open, 1 a known mine), exactly: each
 * placement of mines on the frontier (the hidden cells next to an open number) that every number allows, with the
 * mines it leaves for the other hidden cells, which no number touches and so are all alike (a placement is possible
 * when those mines fit there). Returns { front, rest (how many other hidden cells), out: [{ at (0/1 per frontier
 * cell), left (mines for the rest) }] }.
 */
function layouts(f, st) {
  const known = [...st].filter(v => v === 1).length, left = f.count - known;
  const front = [], at = new Map();
  let rest = 0;
  for (let i = 0; i < f.n; i++) {
    if (st[i] !== -1) continue;
    if (f.nb[i].some(j => st[j] === 0)) { at.set(i, front.length); front.push(i); } else rest++;
  }
  // each open number: the mines it still needs, and its frontier cells; and the numbers each frontier cell is under
  const rules = [];
  for (let i = 0; i < f.n; i++) {
    if (st[i] !== 0) continue;
    const cells = f.nb[i].filter(j => st[j] === -1).map(j => at.get(j));
    if (cells.length) rules.push({ need: f.nums[i] - f.nb[i].filter(j => st[j] === 1).length, cells, mines: 0, open: cells.length });
  }
  const under = front.map(() => []);
  for (const r of rules) for (const k of r.cells) under[k].push(r);
  const pick = new Uint8Array(front.length), out = [];
  const go = (k, m) => {
    if (m > left) return;
    if (k === front.length) { if (left - m <= rest) out.push({ at: pick.slice(), left: left - m }); return; }
    for (const v of [0, 1]) {
      pick[k] = v;
      let ok = true;
      for (const r of under[k]) { r.mines += v; r.open--; if (r.mines > r.need || r.mines + r.open < r.need) ok = false; }
      if (ok) go(k + 1, m + v);
      for (const r of under[k]) { r.mines -= v; r.open++; }
    }
  };
  go(0, 0);
  return { front, rest, out };
}
/** Whether cell c is a mine (or safe) in every way the mines could lie. */
function sure(ways, c, mine) {
  const k = ways.front.indexOf(c);
  if (k >= 0) return ways.out.every(w => w.at[k] === (mine ? 1 : 0));
  return ways.out.every(w => (mine ? w.left === ways.rest : w.left === 0));
}
{
  let steps = 0, wrong = 0, cleared = 0, checkedLevels = 0, levelBad = 0;
  const solidSteps = { cube: 0, sphere: 0, geodesic: 0 };
  const R = rng(99);
  for (const [shape, w, h, count] of [["square", 5, 5, 5], ["hex", 5, 5, 5], ["tri", 7, 4, 4], ["square", 6, 4, 5],
    ["cube", 3, 3, 9], ["sphere", 2, 2, 7], ["geodesic", 2, 2, 10]]) {
    for (let t = 0; t < 14; t++) {
      const { n, nb } = graphOf(shape, w, h), most = Math.max(...nb.map(l => l.length));
      const inner = [...Array(n).keys()].filter(i => nb[i].length === most);
      const start = inner[Math.floor(R() * inner.length)], banned = new Set([start, ...nb[start]]);
      const free = [...Array(n).keys()].filter(i => !banned.has(i));
      for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
      const mine = new Uint8Array(n);
      free.slice(0, count).forEach(i => { mine[i] = 1; });
      const f = fieldOf(shape, w, h, mine, start);
      const s = createSolver(f);
      s.open(start);
      for (let guard = 0; guard < 200 && !s.done; guard++) {
        const d = s.next(4);
        if (!d) break;
        const ways = layouts(f, s.st);
        for (const c of d.cells) if (!sure(ways, c, d.mine)) wrong++;
        if (isSolid(shape)) solidSteps[shape]++;
        // a deduction of one number or two is provable from those numbers alone
        if (d.level <= 2) {
          checkedLevels++;
          const cs = d.from.map(i => s.constraint(i)), vars = [...new Set(cs.flatMap(c => c.u))];
          const p = placements(vars, cs.map(c => ({ cells: c.u, lo: c.r, hi: c.r })));
          if (!p || !d.cells.every(c => p.forced.some(x => x.cell === c && x.mine === d.mine))) levelBad++;
        }
        steps++;
        s.apply(d);
      }
      if (s.done) cleared++;
    }
  }
  check(steps > 300 && !wrong && Object.values(solidSteps).every(x => x > 20),
    `every deduction (${steps}, on ${cleared} small fields cleared; on the cube, the sphere and the geodesic sphere ${Object.values(solidSteps).join(", ")}) agrees with every way the mines could lie`);
  check(checkedLevels > 50 && !levelBad, `a deduction graded one number or two follows from those numbers alone (${checkedLevels})`);
  // the check itself: a lone 1 in a 2×2 field could have its mine in any of the other three cells, so none is sure;
  // in a 3×2 field with the 0 beside it open as well, the cell by the 0 is safe and the corner the mine
  const free = layouts(fieldOf("square", 2, 2, M(2, 2, [[0, 0]]), 3), Int8Array.from([-1, -1, -1, 0]));
  const forced = layouts(fieldOf("square", 3, 2, M(3, 2, [[0, 0]]), 5), Int8Array.from([-1, -1, 0, 0, 0, 0]));
  check(free.out.length === 3 && [0, 1, 2].every(c => !sure(free, c, true) && !sure(free, c, false))
    && forced.out.length === 1 && sure(forced, 0, true) && sure(forced, 1, false) && !sure(forced, 1, true),
    "the check of every way the mines could lie tells a forced cell from a free one");
}
{
  // the patterns a person knows, each found at its level: a 1 with one hidden neighbour; the 1-2-1 on a wall
  const one = fieldOf("square", 3, 1, M(3, 1, [[0, 2]]), 0);
  const s = createSolver(one); s.open(0);
  const d = s.next(4);
  check(d?.level === 1 && d.mine && d.cells.join() === "2" && d.from.join() === "1", "one number: a 1 with one hidden neighbour has its mine there");
  // under a wall of hidden cells, mines at (0,1) and (0,3): the 1 at the end sees two of them, the 1 beside it three,
  // so the third is safe; no one number says so
  const pair = fieldOf("square", 5, 3, M(5, 3, [[0, 1], [0, 3]]), 12), sp = createSolver(pair);
  sp.open(12);
  const two = sp.next(4);
  check(sp.next(1) === null && two?.level === 2 && !two.mine && two.cells.includes(2) && two.from.includes(5) && two.from.includes(6),
    "two numbers: a 1 whose hidden cells are all under the 1 beside it frees that one's other cell (the 1-1)");
  // 1-2-1 on a wall: under the 1 2 1 the two outer cells are mines, the middle safe; found from two numbers
  const wall = fieldOf("square", 5, 3, M(5, 3, [[2, 1], [2, 3]]), 2);
  const r = solve(wall, { keepSteps: true });
  check(r.solved && r.max <= 2, "a 1-2-1 is cleared with no more than two numbers at a time");
}

// ---------- fields dealt without a guess, at their level ----------
{
  const grades = {};
  let solved = 0, total = 0, startClear = 0, counts = 0, fit = 0, easyTop = 0, easyTotal = 0, solidTotal = 0;
  for (const shape of every) for (const size of Object.keys(SIZES)) for (const level of Object.keys(LEVELS)) {
    const xs = [];
    for (let k = 1; k <= 3; k++) {
      const f = deal({ seed: k * 7717 + 3, shape, size, level });
      total++;
      if (isSolid(shape)) solidTotal++;
      if (solve(f).solved) solved++;
      // the start: empty, nothing round it, and a whole neighbourhood (not one of a solid's odd cells, so it opens
      // as wide a patch as anywhere)
      if (!f.mine[f.start] && f.nb[f.start].every(j => !f.mine[j]) && f.nums[f.start] === 0 && f.nb[f.start].length === EVERY[shape].most) startClear++;
      if (f.count === dims({ shape, size, level }).count && f.n === dims({ shape, size, level }).n) counts++;
      const [lo, hi] = TARGET[shape][size][level].hard;
      if (f.grade.hard >= lo && f.grade.hard <= hi) fit++;
      if (level === "easy" && tilingOf(shape) !== "tri") { easyTotal++; if (f.grade.top <= 1) easyTop++; }
      xs.push(f.grade.hard);
    }
    grades[`${shape}:${size}:${level}`] = xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  check(solved === total && solidTotal === 81, `every field dealt clears from its start by reasoning alone, flat or round a solid (${solved}/${total})`);
  check(startClear === total && counts === total, "every start is empty, with no mine round it, and every field has its level's mines");
  check(fit >= total * 0.9, `fields meet their level's reasoning (${fit}/${total}; the rest the closest of ${400} tried)`);
  check(easyTop === easyTotal, "an easy field of squares or hexes, flat or on the cube or the sphere, never needs more than one number at a time");
  const ordered = every.every(sh => Object.keys(SIZES).every(sz => grades[`${sh}:${sz}:easy`] <= grades[`${sh}:${sz}:medium`] && grades[`${sh}:${sz}:medium`] <= grades[`${sh}:${sz}:hard`]));
  check(ordered, "every shape and size: hard fields need more than medium, medium more than easy");
  // a solid's levels take more mines than its flat tiling's, a share of the field: it has no edge to stick at
  const share = (shape, size, l) => dims({ shape, size, level: l }).count / dims({ shape, size, level: l }).n;
  check(solids.every(sh => Object.keys(SIZES).every(sz => Object.keys(LEVELS).every(l => share(sh, sz, l) > share(tilingOf(sh), sz, l)))),
    "a solid carries more mines for its size than the flat field of its tiling, level for level");
  for (const shape of ["hex", "cube", "geodesic"]) {
    const a = deal({ seed: 42, shape, size: "medium", level: "hard" }), b = deal({ seed: 42, shape, size: "medium", level: "hard" }), c = deal({ seed: 43, shape, size: "medium", level: "hard" });
    check(a.mine.join("") === b.mine.join("") && a.start === b.start && a.mine.join("") !== c.mine.join(""), `${shape}: a seed deals the same field every time, another seed another`);
  }
  check(describe({ shape: "tri", size: "large", level: "easy" }) === "Large triangles, easy" && settingsOf({ shape: "x" }).shape === "square", "a field's name, and settings checked");
  check(Object.values(FIELDS).every(s => Object.keys(s).length === 3) && Object.values(MINES).every(s => Object.values(s).every(l => l.length === 3)), "three sizes of each shape, three levels' mines each");
}

// ---------- hints ----------
{
  const f = deal({ seed: 5, shape: "square", size: "small", level: "medium" }), run = newRun(f);
  check(hint(f, run) === null, "no hint before the start is dug");
  dig(f, run, f.start);
  let right = 0, given = 0;
  for (let guard = 0; guard < 200 && !run.done; guard++) {
    const h = hint(f, run);
    if (!h) break;
    given++;
    if (h.cells.every(c => !!f.mine[c] === h.mine) && h.from.length >= (h.level === 4 ? 0 : 1)) right++;
    for (const c of h.cells) { if (h.mine) flag(f, run, c); else dig(f, run, c); }
  }
  check(given > 3 && right === given && run.won && !run.strikes, `hints alone clear a field, every one right (${given})`);
  const g = deal({ seed: 6, shape: "square", size: "small", level: "easy" }), r2 = newRun(g);
  dig(g, r2, g.start);
  const safe = [...Array(g.n).keys()].find(i => r2.cells[i] === "." && !g.mine[i] && g.nb[i].some(j => r2.cells[j] === "o"));
  flag(g, r2, safe);
  let named = false;
  for (let guard = 0; guard < 100 && !named; guard++) {
    const h = hint(g, r2);
    if (!h) break;
    if (!h.mine && h.cells.includes(safe)) named = true;
    else for (const c of h.cells) { if (h.mine) { if (r2.cells[c] === ".") flag(g, r2, c); } else if (r2.cells[c] === ".") dig(g, r2, c); }
  }
  check(named, "a hint never trusts a flag: it can name a flagged cell safe");
}

// ---------- the computer rival ----------
{
  const ends = { steady: 0, quick: 0, sharp: 0 };
  let whole = true, rising = true;
  for (let k = 1; k <= 4; k++) {
    const f = deal({ seed: k * 31, shape: "square", size: "medium", level: "medium" });
    for (const pace of Object.keys(PACES)) {
      const p = rivalPlan(f, pace);
      ends[pace] += p.end;
      whole &&= p.open.at(-1) === f.n - f.count && rivalAt(p, p.end).done && rivalAt(p, p.end).share === 1;
      rising &&= p.times.every((t, i) => !i || t >= p.times[i - 1]) && p.open.every((o, i) => !i || o >= p.open[i - 1]);
      const again = rivalPlan(f, pace);
      whole &&= again.end === p.end;
    }
  }
  check(whole && rising, "the rival clears its copy of the field, a cell at a time, the same way each time for a field");
  check(ends.sharp < ends.quick && ends.quick < ends.steady, `sharp is quicker than quick, quick than steady (${Object.values(ends).map(e => Math.round(e / 4000)).join(" / ")} s a medium field)`);
  let round = true;
  for (const shape of solids) {
    const f = deal({ seed: 64, shape, size: "medium", level: "medium" }), p = rivalPlan(f, "quick");
    round &&= p.open.at(-1) === f.n - f.count && rivalAt(p, p.end).done && rivalPlan(f, "quick").end === p.end;
  }
  check(round, "the rival clears a solid field too, the same way each time");
}

// ---------- the split, and the computer partner ----------
{
  let both = 0, total = 0, alone = 0, whole = 0;
  for (const shape of every) for (const level of ["easy", "hard"]) for (let k = 1; k <= 2; k++) {
    const f = deal({ seed: k * 101, shape, size: "small", level, team: true });
    total++;
    if (needsBoth(f)) both++;
    if (solve(f, { sees: i => readerOf(f, i, 2) === 0 }).solved || solve(f, { sees: i => readerOf(f, i, 2) === 1 }).solved) alone++;
    if (solve(f, { sees: i => readerOf(f, i, 2) === 0 || readerOf(f, i, 2) === 1 }).solved) whole++;
  }
  check(both === total && !alone && whole === total, `a team's field, flat or round a solid: the two shares together clear it, neither alone does (${total} fields)`);
  // two computer partners, each reading its half, clear fields together, asking and telling when stuck
  let cleared = 0, games = 0, mineDug = 0, talked = 0;
  for (const [shape, size] of [["square", "small"], ["hex", "small"], ["tri", "small"], ["cube", "small"], ["sphere", "small"], ["geodesic", "small"]]) for (let k = 1; k <= 2; k++) {
    const f = deal({ seed: k * 557, shape, size, level: "medium", team: true }), run = newRun(f), told = new Set(), asked = [new Set(), new Set()];
    dig(f, run, f.start);
    games++;
    let t = 0, last = 0;
    for (let guard = 0; guard < 3000 && !run.done; guard++) {
      const ms = [0, 1].map(me => partnerMove(f, { cells: run.cells, told }, { me, pace: "sharp", stuckMs: t - last, asked: asked[me], seed: k }));
      const live = ms.map((m, me) => (m ? { ...m, me } : null)).filter(Boolean);
      if (!live.length) { if (t - last >= PRESS_AFTER) break; t = last + (t - last < SPEAK_AFTER ? SPEAK_AFTER : PRESS_AFTER); continue; }
      const m = live.sort((a, b) => a.wait - b.wait || a.me - b.me)[0];
      t += m.wait;
      if (m.kind === "dig") { if (dig(f, run, m.cell).struck >= 0) mineDug++; last = t; }
      else if (m.kind === "flag") { flag(f, run, m.cell, m.me); last = t; }
      else { asked[m.me].add(`${m.why}:${m.cell}`); told.add(m.cell); talked++; last = t; }
    }
    if (run.won) cleared++;
  }
  check(cleared === games && !mineDug && talked > 0, `two computer partners, each with half the numbers, clear every field without a mine, by talking (${talked} numbers shown)`);
  const f = deal({ seed: 9, shape: "square", size: "small", level: "medium", team: true }), run = newRun(f);
  dig(f, run, f.start);
  const quiet = partnerMove(f, { cells: run.cells, told: new Set() }, { me: 1, pace: "quick", stuckMs: 0 });
  check(!quiet || quiet.kind !== "point", "a partner says nothing before the field has stood still a while");
  check(readers({ runs: { s0: { begun: 1 }, s1: { begun: 1 }, s2: {} } }, [0], { 1: 5000 }).join() === "0,1"
    && readers({ runs: { s0: { begun: 1 }, s1: { begun: 1 } } }, [0], { 1: 60000 }).join() === "0", "a player away a moment keeps their share; away long, it goes to the others");
}

// ---------- the team's field at the table, through the database's round trip ----------
{
  const f = deal({ seed: 77, shape: "square", size: "small", level: "medium", team: true });
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = db(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1) }, { app: 1, match: { seed: 77, shape: "square", size: "small", level: "medium", mode: "team" }, now: 1000 }));
  sayReady(g, 0, [0, 1], 1000); sayReady(g, 1, [0, 1], 1200); g = db(g);
  check(!!g.start && !teamField(g, f), "the match starts for both, with no field until the first move");
  check(!teamMove(g, f, 1, { kind: "dig", cell: (f.start + 1) % f.n }, { now: 5000 }) || (f.start + 1) % f.n === f.start, "nothing but the start can be dug first");
  check(teamMove(g, f, 0, { kind: "dig", cell: f.start }, { now: 5000 }), "Korbi digs the start");
  g = db(g);
  const fd = teamField(g, f);
  check(fd && fd.cells.length === f.n && fd.told.length === f.n && fd.cells[f.start] === "o" && fd.by.s0.dug === 1, "the field comes back from the database whole: its cells and what's been shown, as strings");
  check(!teamMove(g, f, 1, { kind: "dig", cell: f.start }, { now: 5100 }), "a move made on an older copy (the start, open already) is set aside");
  const mine = [...Array(f.n).keys()].find(i => f.mine[i] && f.nb[i].some(j => fd.cells[j] === "o"));
  check(teamMove(g, f, 1, { kind: "flag", cell: mine }, { now: 5200 }) && db(g).field.cells[mine] === "1", "Sarah's flag is hers (her seat on it)");
  g = db(g);
  check(!teamMove(g, f, 0, { kind: "dig", cell: mine }, { now: 5300 }), "a flag keeps its cell from anyone's dig");
  const mineNum = [...Array(f.n).keys()].find(i => g.field.cells[i] === "o" && f.nums[i] > 0 && readerOf(f, i, 2) === 0);
  check(teamMove(g, f, 0, { kind: "tell", cell: mineNum }, { now: 5400 }) && db(g).field.told[mineNum] === "1" && db(g).field.pings.s0.cell === mineNum, "showing a number marks it for everyone, and rings it");
  g = db(g);
  check(teamMove(g, f, 1, { kind: "ping", cell: 3 }, { now: 5500 }) && db(g).field.pings.s1.cell === 3, "pointing rings a cell");
  g = db(g);
  // the two of them clear it, each move by whoever's turn it is, through the round trip every time
  let turn = 0;
  for (let guard = 0; guard < 400 && !teamField(g, f).end; guard++) {
    const fdNow = teamField(g, f), run = { cells: fdNow.cells, strikes: fdNow.strikes, hints: 0, ms: 0, done: false, won: false, lost: false };
    const h = hint(f, run);
    if (!h) break;
    const c = h.mine ? h.cells.find(x => fdNow.cells[x] === ".") : h.cells[0];
    if (c == null) break;
    teamMove(g, f, turn, { kind: h.mine ? "flag" : "dig", cell: c }, { now: 6000 + guard * 1000 });
    g = db(g);
    turn = 1 - turn;
  }
  const end = teamField(g, f).end;
  check(end?.won && teamScore(g, teamField(g, f)) === Math.round((end.at - g.start) / 1000), "the team clears its field: its time from the shared start");
  check(!teamMove(g, f, 0, { kind: "dig", cell: 0 }, { now: 1e6 }), "a field over takes no more moves");
  rematch(g, 0, { seed: 78, shape: "square", size: "small", level: "medium", mode: "team" });
  g = db(g);
  check(!teamField(g, f) && teamMove(g, f, 0, { kind: "ping", cell: 1 }, { now: 2e6 }) && g.field.n === g.n && !g.field.end, "a rematch leaves the old field behind; its first move starts a new one");
  const lost = db(freshDuel({ a: seat("Korbi", 0) }, { app: 1, match: { seed: 77, mode: "team" }, now: 1 }));
  startAll(lost, 10);
  teamMove(lost, f, 0, { kind: "dig", cell: f.start }, { now: 20 });
  const someMine = [...Array(f.n).keys()].find(i => f.mine[i]);
  teamMove(lost, f, 0, { kind: "dig", cell: someMine }, { now: 30, sudden: true });
  check(teamField(lost, f).end && !teamField(lost, f).end.won && teamField(lost, f).strikes === 1, "played sudden, the team's first mine ends its field");
  check(freshField(f, 3).cells === ".".repeat(f.n), "a fresh field is all hidden");
}

// ---------- a run kept as JSON, and today's field ----------
{
  let carried = true;
  for (const shape of ["hex", "cube", "sphere", "geodesic"]) {
    const f = deal({ seed: 1234, shape, size: "small", level: "medium" });
    let run = newRun(f);
    dig(f, run, f.start);
    run = JSON.parse(JSON.stringify({ ...run, ms: 12345 }));
    for (let guard = 0; guard < 300 && !run.done; guard++) {
      const h = hint(f, run);
      if (!h) break;
      for (const c of h.cells) { if (h.mine) { if (run.cells[c] === ".") flag(f, run, c); } else dig(f, run, c); }
      run = JSON.parse(JSON.stringify(run));
    }
    carried &&= run.won && run.ms === 12345 && safeLeft(f, run.cells) === 0 && !run.strikes;
  }
  check(carried, "a run kept as JSON at every move carries on to the end, flat or round a solid, hints alone clearing it");
  check(WEEK.length === 7 && WEEK.every(d => SHAPES[d.shape] && SIZES[d.size] && LEVELS[d.level]), "a field for each day of the week");
  check(weekdayOf(20261019) === "Monday" && daily(20261019).size === "small" && daily(20261019).level === "easy" && daily(20261024).size === "large", "Monday's field is small and easy, Saturday's large");
  const day = 20261020, d1 = deal({ seed: day, ...daily(day) }), d2 = deal({ seed: day, ...daily(day) }), d3 = deal({ seed: day + 1, ...daily(day + 1) });
  check(d1.mine.join("") === d2.mine.join("") && d1.start === d2.start && (d1.mine.join("") !== d3.mine.join("") || d1.shape !== d3.shape), "today's field is the same on every device, tomorrow's another");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("mines: every field clears without a guess, at its level, alone or as a team");
