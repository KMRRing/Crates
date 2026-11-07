// Gears, the generator: makes a level. It draws a random route across an empty plate (the train's way, a self-avoiding walk),
// gives some of its squares to duos and trios, takes the hand from the pieces the route is made of, reads the loads' turns and
// the last load's off the train it drew, and then adds pillars until the solver finds the wanted number of answers. A route
// whose gears would jam against each other (two squares of it side by side, an even number of gears apart) is no level.
// Used to write the level files; no page loads it.
import { rng, mix } from "./pipes-pieces.js";
import { parseLevel, specOf, layRoute, check, beyond, back, shapeJoining, routeChar, SHAPES, GLYPH, LOAD_CHAR, SIDE, KINDS } from "./pipes-train.js";
import { solve } from "./pipes-train-solve.js";
import { discVoid } from "./pipes-gear-engine.js";

const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffled(a, r) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** A random route of n squares on a cols × rows plate, the mainspring before its first square and the load after its last:
 *  { passes: [{ c, a, b }], source: { c, d }, terminal: { c, d } } or null. `turns` is the fewest bends it may have. */
export function randomRoute(cols, rows, n, r, turns = 0, gone = new Set()) {
  const L0 = { cols, rows, size: cols * rows };
  const d0 = pick(r, [0, 1, 2, 3]), s = Math.floor(r() * L0.size), first = beyond(L0, s, d0);
  if (first < 0 || gone.has(s) || gone.has(first)) return null;
  const passes = [], used = new Set([s]);
  let tries = 0;
  const bends = () => passes.reduce((k, p) => k + (p.b !== back(p.a) ? 1 : 0), 0);
  function walk(c, a) {
    if (++tries > 4000) return false;
    used.add(c);
    for (const b of shuffled([0, 1, 2, 3].filter(x => x !== a), r)) {
      const next = beyond(L0, c, b);
      if (next < 0 || used.has(next) || gone.has(next)) continue;
      passes.push({ c, a, b });
      if (passes.length === n) { if (bends() >= turns) return true; }
      else if (walk(next, back(b))) return true;
      passes.pop();
    }
    used.delete(c);
    return false;
  }
  if (!walk(first, back(d0))) return null;
  const last = passes[passes.length - 1];
  return { passes, source: { c: s, d: d0 }, terminal: { c: beyond(L0, last.c, last.b), d: back(last.b) } };
}

/**
 * Makes a level from the seed: { spec, L, route, sols, nodes, rocks, loose, kills } or null when this seed gave nothing (the
 * caller tries the next). opts: cols, rows, pieces (the route's squares), duos, trios, loads, olds, turns (fewest bends),
 * rocks (the most pillars to try), maxSols (the most answers the level may have; 1 for a single answer).
 */
export function makeLevel(seed, o) {
  const r = rng(mix(seed, 91));
  const gone = o.disc ? discVoid(o.cols) : new Set(), R = randomRoute(o.cols, o.rows, o.pieces, r, o.turns || 0, gone);
  if (!R) return null;
  // the mainspring and the load side by side would look meshed when they are not
  if (Math.abs(R.source.c % o.cols - R.terminal.c % o.cols) + Math.abs(Math.floor(R.source.c / o.cols) - Math.floor(R.terminal.c / o.cols)) < 2) return null;
  if (gone.has(R.terminal.c) || gone.has(R.source.c)) return null;
  const n = R.passes.length, cls = Array(n).fill(1);
  const idx = shuffled([...Array(n).keys()], r), duos = o.duos || 0, trios = o.trios || 0;
  idx.slice(0, duos).forEach(i => { cls[i] = 2; });
  idx.slice(duos, duos + trios).forEach(i => { cls[i] = 3; });
  const kind = R.passes.map((p, i) => (cls[i] === 1 ? "g" : `${cls[i] === 2 ? "d" : "t"}${shapeJoining(p.a, p.b)}`));
  const route = R.passes.map((p, i) => routeChar(cls[i], p.b)).join("");
  // the turn of the gear that enters each square, read off the train: the mainspring clockwise, then flipping at every mesh
  let e = 1;
  const enter = [];
  for (let i = 0; i < n; i++) { enter.push(e); e = (e ^ ((cls[i] - 1) & 1)) ^ 1; }
  const spin = e ? "ccw" : "cw";
  const grid = Array.from({ length: o.rows }, (_, y) => Array.from({ length: o.cols }, (__, x) => (gone.has(y * o.cols + x) ? "#" : ".")));   // the voids are rocks to the old rules
  const put = (c, ch) => { grid[Math.floor(c / o.cols)][c % o.cols] = ch; };
  const get = c => grid[Math.floor(c / o.cols)][c % o.cols];
  put(R.source.c, "S"); put(R.terminal.c, "T");
  const squares = R.passes.map(p => p.c), hand = {};
  kind.forEach(k => { hand[k] = (hand[k] || 0) + 1; });
  // loads on single gears, spread along the train; fixed gears anywhere else on it
  const loadAt = [], olds = [];
  const singles = shuffled(squares.map((c, i) => i).filter(i => cls[i] === 1), r);
  for (const i of singles.slice(0, o.loads || 0)) { loadAt.push(i); put(squares[i], LOAD_CHAR[enter[i]]); }
  for (const i of shuffled(squares.map((c, i) => i).filter(i => !loadAt.includes(i)), r).slice(0, o.olds || 0)) { olds.push(i); put(squares[i], GLYPH[kind[i]]); hand[kind[i]]--; }
  const handStr = () => KINDS.filter(k => hand[k] > 0).map(k => `${k}${hand[k]}`).join(" ");
  const build = () => parseLevel({ id: `w${seed}`, map: grid.map(row => row.join("")), out: SIDE[R.source.d], inlet: SIDE[R.terminal.d], hand: handStr(), spin });
  let L = build();
  const wanted = layRoute(L, route);
  if (!wanted || !check(L, wanted).solved) return null;           // the drawn train jams, or something else is off
  const free = c => get(c) === "." && !squares.includes(c);
  const maxSols = o.maxSols || 1, key = laid => laid.map(p => p || "").join(",");
  const rocks = [];
  const settled = s => !s.aborted && s.sols.length <= maxSols;
  for (let guard = 0; guard < 60; guard++) {
    const s = solve(L, maxSols + 1, 3e5);
    if (s.aborted) return null;
    if (settled(s)) break;
    const others = s.sols.filter(x => key(x.laid) !== key(wanted));
    const alt = pick(r, others).laid;
    const spots = alt.map((p, c) => (p && !wanted[c] && free(c) ? c : -1)).filter(c => c >= 0);
    if (!spots.length || rocks.length >= (o.rocks ?? 99)) return null;
    const c = pick(r, spots);
    rocks.push(c); put(c, "#");
    L = build();
  }
  let final = solve(L, maxSols + 1, 3e5);
  if (!settled(final) || !final.sols.some(x => key(x.laid) === key(wanted))) return null;
  // whatever pillar the answers don't need goes again
  for (const c of shuffled(rocks, r)) {
    put(c, ".");
    const t = build(), s = solve(t, maxSols + 1, 3e5);
    if (settled(s)) { rocks.splice(rocks.indexOf(c), 1); L = t; } else put(c, "#");
  }
  L = build();
  final = solve(L, maxSols + 1, 3e5);
  if (!settled(final)) return null;
  // every load and fixed gear should matter: with one taken away the level would have more answers. `loose` counts those that don't.
  let loose = 0;
  for (const i of loadAt) {
    const was = get(squares[i]);
    put(squares[i], ".");
    const s = solve(build(), maxSols + 1, 3e5);
    if (settled(s)) loose++;
    put(squares[i], was);
  }
  for (const i of olds) {
    const was = get(squares[i]);
    put(squares[i], "."); hand[kind[i]]++;
    const s = solve(build(), maxSols + 1, 3e5);
    if (settled(s)) loose++;
    put(squares[i], was); hand[kind[i]]--;
  }
  L = build();
  // how many answers the jam rule rules out
  const free2 = solve(L, 60, 3e5, { jams: false });
  return { spec: specOf(L), L, route, sols: final.sols.map(x => x.route), nodes: final.nodes, rocks: rocks.length, loose, kills: free2.sols.length - final.sols.length,
    duos, trios, loads: loadAt.length, olds: olds.length, spin };
}
export { SHAPES };
