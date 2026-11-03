// Pipes, the puzzle: makes a level. It draws a random route across an empty board (the oil's way, crossing itself where a
// crossing is allowed), takes the hand from the pieces the route is made of, and then adds rock until the solver finds one
// answer and no other, and takes away whatever rock, old pipe or stake the answer doesn't need. Used to write
// pipes-puzzle-levels.js; no page loads it.
import { rng, mix, PIECES, KINDS } from "./pipes-pieces.js";
import { beyond, back, pieceJoining, parseLevel, specOf, layRoute, SIDE } from "./pipes-puzzle.js";
import { solve } from "./pipes-puzzle-solve.js";

const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffled(a, r) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/**
 * A random route of n passes on a cols × rows board, with the wellhead before its first square and the terminal after its
 * last: { route: "EESS…", source: { c, d }, terminal: { c, d } } or null. A square may be passed twice (a crossing) when
 * `cross` is true: both times straight, one across the other.
 */
export function randomRoute(cols, rows, n, r, cross = false) {
  const L0 = { cols, rows };
  const count = cols * rows;
  const sourceD = Math.floor(r() * 4);
  let s = Math.floor(r() * count);
  const first = beyond(L0, s, sourceD);
  if (first < 0) return null;
  const passes = [], via = new Array(count).fill(null).map(() => []);     // via[c]: the passes through square c
  let tries = 0;
  const sCell = s;
  function walk(c, a) {
    if (++tries > 4000) return false;
    if (passes.length === n) return false;
    const mine = via[c];
    const sides = shuffled([0, 1, 2, 3].filter(b => b !== a), r);
    for (const b of sides) {
      if (mine.length) {
        // the second pass over a square: straight, across the first (which must have been straight too)
        const p = mine[0];
        if (mine.length > 1 || !cross || b !== back(a) || p.b !== back(p.a) || a % 2 === p.a % 2) continue;
      }
      const next = beyond(L0, c, b);
      if (next < 0 || next === sCell) continue;
      mine.push({ a, b }); passes.push({ c, a, b });
      if (passes.length === n) {
        // the terminal goes beyond the last square, on open ground off the route
        if (!via[next].length) return true;
      } else if (walk(next, back(b))) return true;
      mine.pop(); passes.pop();
    }
    return false;
  }
  if (!walk(first, back(sourceD))) return null;
  const last = passes[passes.length - 1], t = beyond(L0, last.c, last.b);
  return { route: passes.map(p => SIDE[p.b]).join(""), source: { c: s, d: sourceD }, terminal: { c: t, d: back(last.b) }, passes, cols, rows };
}

/** A level (parsed) with nothing on the board but the route's wellhead and terminal; hand = the route's pieces. */
function bareLevel(R, id) {
  const { cols, rows, passes } = R, n = cols * rows;
  const map = Array.from({ length: rows }, () => Array(cols).fill("."));
  const put = (c, ch) => { map[Math.floor(c / cols)][c % cols] = ch; };
  put(R.source.c, "S"); put(R.terminal.c, "T");
  const cells = new Map();
  for (const p of passes) {
    const had = cells.get(p.c);
    cells.set(p.c, had ? "x" : pieceJoining(p.a, p.b));
  }
  const hand = {};
  for (const k of cells.values()) hand[k] = (hand[k] || 0) + 1;
  const spec = { id, map: map.map(row => row.join("")), out: SIDE[R.source.d], inlet: SIDE[R.terminal.d], hand: KINDS.filter(k => hand[k]).map(k => `${k}${hand[k]}`).join(" ") };
  return { spec, cells, n };
}

/**
 * Makes a level from the seed: { spec, L, routes } or null when this seed gave nothing (the caller tries the next).
 * opts: cols, rows, pieces (the route's passes), cross (crossings allowed), olds (pieces of the route left in the ground),
 * stakes (squares to pass in order), rocks (the most rock to try), maxSolutions (1 for a single answer).
 */
export function makeLevel(seed, opts) {
  const r = rng(mix(seed, 77));
  const R = randomRoute(opts.cols, opts.rows, opts.pieces, r, !!opts.cross);
  if (!R) return null;
  const { spec: bare, cells } = bareLevel(R, `m${seed}`);
  const grid = bare.map.map(row => [...row]);
  const cols = opts.cols;
  const routeCells = [...cells.keys()];
  const at = c => [Math.floor(c / cols), c % cols];
  const set = (c, ch) => { const [y, x] = at(c); grid[y][x] = ch; };
  const wantX = !!opts.cross;
  if (wantX && ![...cells.values()].includes("x")) return null;     // a crossing level needs one
  let hand = { ...parseLevel(bare).hand };
  // old pipe: some of the route's pieces stay in the ground
  const olds = [];
  const candidates = shuffled(routeCells.filter(c => cells.get(c) !== "x" || r() < 0.3), r);
  for (const c of candidates.slice(0, opts.olds || 0)) { olds.push(c); set(c, { h: "─", v: "│", ne: "└", nw: "┘", se: "┌", sw: "┐", x: "┼" }[cells.get(c)]); hand[cells.get(c)]--; }
  // stakes: squares of the route, numbered in the order the oil first comes to them
  const order = [];
  for (const p of R.passes) if (!order.includes(p.c)) order.push(p.c);
  const stakeCells = [];
  if (opts.stakes) {
    const pool = order.filter(c => !olds.includes(c));
    // spread: one from each equal stretch of the route
    for (let i = 0; i < opts.stakes; i++) {
      const lo = Math.floor(pool.length * i / opts.stakes), hi = Math.max(lo + 1, Math.floor(pool.length * (i + 1) / opts.stakes));
      stakeCells.push(pool[lo + Math.floor(r() * (hi - lo))]);
    }
    stakeCells.forEach((c, i) => set(c, String(i + 1)));
  }
  const handStr = () => KINDS.filter(k => hand[k] > 0).map(k => `${k}${hand[k]}`).join(" ");
  const build = () => parseLevel({ ...bare, id: bare.id, map: grid.map(row => row.join("")), hand: handStr() });
  const free = c => grid[at(c)[0]][at(c)[1]] === "." && !routeCells.includes(c);
  const rocks = [];
  const intended = () => build();
  let L = intended();
  const wanted = layRoute(L, R.route);
  if (!wanted) return null;
  // rock, one square at a time, taken from where another answer goes and the intended one doesn't
  for (let guard = 0; guard < 60; guard++) {
    const s = solve(L, 3, 2e5);
    if (s.aborted) return null;
    if (s.routes.length === 1) break;
    const others = s.routes.filter(x => x !== R.route);
    const alt = layRoute(L, pick(r, others));
    const spots = alt.map((p, c) => (p && !wanted[c] && free(c) ? c : -1)).filter(c => c >= 0);
    if (!spots.length || rocks.length >= (opts.rocks ?? 99)) return null;
    const c = pick(r, spots);
    rocks.push(c); set(c, "#");
    L = intended();
  }
  let final = solve(L, 2, 2e5);
  if (final.routes.length !== 1 || final.routes[0] !== R.route) return null;
  // whatever the answer doesn't need goes again: rock first
  for (const c of shuffled(rocks, r)) {
    set(c, ".");
    const t = intended();
    const s = solve(t, 2, 2e5);
    if (s.routes.length === 1 && !s.aborted) { rocks.splice(rocks.indexOf(c), 1); L = t; } else set(c, "#");
  }
  L = intended();
  final = solve(L, 2, 2e5);
  if (final.routes.length !== 1) return null;
  // every old pipe and stake should matter: with one taken away (the old pipe back in the hand, the stake unmarked) the
  // level would have more than one answer. `loose` counts those that don't.
  let loose = 0;
  for (const c of olds) {
    const was = grid[at(c)[0]][at(c)[1]], piece = cells.get(c);
    set(c, "."); hand[piece]++;
    const s = solve(intended(), 2, 2e5);
    if (s.routes.length === 1 && !s.aborted) loose++;
    set(c, was); hand[piece]--;
  }
  stakeCells.forEach((gone, i) => {
    stakeCells.forEach((c, j) => { if (j !== i) set(c, String(j < i ? j + 1 : j)); });
    set(gone, ".");
    const s = solve(intended(), 2, 2e5);
    if (s.routes.length === 1 && !s.aborted) loose++;
    stakeCells.forEach((c, j) => set(c, String(j + 1)));
  });
  return { spec: specOf(L), L, route: R.route, nodes: final.nodes, rocks: rocks.length, loose, olds: olds.length, stakes: stakeCells.length, passes: R.passes.length };
}
