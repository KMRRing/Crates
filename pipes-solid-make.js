// Pipes on a solid: makes a level, as pipes-puzzle-make.js does for the flat Puzzle. It draws a random route over the solid (the
// oil's way, crossing itself where a crossing is allowed), takes the hand from the pieces the route is made of, adds rock until
// the solver finds one answer and no other, and takes away whatever rock, old pipe or stake the answer doesn't need. Used to write
// the levels files (pipes-solid-pick.mjs); no page loads it.
import { rng, mix } from "./pipes-pieces.js";
import { solidOf, parseLevel, layRoute, pieceJoining, handText } from "./pipes-solid.js";
import { solve } from "./pipes-solid-solve.js";

const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffled(a, r) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

/** A random route of n passes: { route, src: [tile, side], term: [tile, side], passes } or null. A tile may be passed twice (a
 *  crossing) when `cross` is true on squares: both times straight, one across the other. */
export function randomRoute(S, n, r, cross) {
  const t0 = Math.floor(r() * S.count), d0 = Math.floor(r() * S.tiles[t0].n);
  const passes = [], via = Array.from({ length: S.count }, () => []);
  let tries = 0;
  const [first, a0] = S.tiles[t0].nb[d0];
  function walk(c, a) {
    if (++tries > 6000) return false;
    const T = S.tiles[c], mine = via[c];
    for (const b of shuffled([...Array(T.n).keys()].filter(x => x !== a), r)) {
      if (!pieceJoining(T.n, a, b) && !(T.n === 4 && b === (a + 2) % 4)) continue;
      if (mine.length) {
        const p = mine[0];
        if (mine.length > 1 || !cross || T.n !== 4 || b !== (a + 2) % 4 || p.b !== (p.a + 2) % 4 || a % 2 === p.a % 2) continue;
      }
      const [next, side] = T.nb[b];
      if (next === t0) continue;
      mine.push({ a, b }); passes.push({ c, a, b });
      if (passes.length === n) { if (!via[next].length) { passes.term = [next, side]; return true; } }
      else if (walk(next, side)) return true;
      mine.pop(); passes.pop();
    }
    return false;
  }
  if (!walk(first, a0)) return null;
  return { route: passes.map(p => p.b).join(""), src: [t0, d0], term: passes.term, passes: passes.slice() };
}

/** Faces the route passes through, in order, counting a change of face: how far it wanders over the solid. */
const faceChanges = (S, passes) => passes.reduce((k, p, i) => k + (i && S.tiles[p.c].face !== S.tiles[passes[i - 1].c].face ? 1 : 0), 0);

/**
 * Makes a level from the seed: { spec, L, route, nodes, rocks, loose, … } or null when this seed gave nothing.
 * opts: solid, m, pieces (the route's passes), cross, olds, stakes, rocks (the most rock to try), edges (the fewest changes of face).
 */
export function makeLevel(seed, opts) {
  const r = rng(mix(seed, 91));
  const S = solidOf(opts.solid, opts.m || 1);
  const R = randomRoute(S, opts.pieces, r, !!opts.cross);
  if (!R || faceChanges(S, R.passes) < (opts.edges ?? 2)) return null;
  // the pieces the route is made of
  const cells = new Map();
  for (const p of R.passes) {
    const T = S.tiles[p.c], had = cells.get(p.c);
    cells.set(p.c, had ? "x0" : pieceJoining(T.n, p.a, p.b));
  }
  if (opts.cross && ![...cells.values()].includes("x0")) {
    // a straight passed twice isn't a crossing unless the route made it one: needs one
    return null;
  }
  const hand = {};
  for (const p of cells.values()) hand[p[0]] = (hand[p[0]] || 0) + 1;
  const spec = { id: `m${seed}`, solid: opts.solid, m: opts.m || 1, src: R.src, term: R.term, rocks: [], olds: {}, stakes: [] };
  const routeCells = [...cells.keys()], onRoute = new Set(routeCells);
  const build = () => parseLevel({ ...spec, hand: handText(hand) });
  // old pipe: some of the route's pieces stay in the ground
  const olds = shuffled(routeCells.filter(c => cells.get(c) !== "x0" || r() < 0.3), r).slice(0, opts.olds || 0);
  for (const c of olds) { spec.olds[c] = cells.get(c); hand[cells.get(c)[0]]--; }
  // stakes: tiles of the route, numbered in the order the oil first comes to them, one from each equal stretch
  const order = [];
  for (const p of R.passes) if (!order.includes(p.c)) order.push(p.c);
  if (opts.stakes) {
    const pool = order.filter(c => !olds.includes(c));
    for (let i = 0; i < opts.stakes; i++) {
      const lo = Math.floor(pool.length * i / opts.stakes), hi = Math.max(lo + 1, Math.floor(pool.length * (i + 1) / opts.stakes));
      spec.stakes.push(pool[lo + Math.floor(r() * (hi - lo))]);
    }
  }
  let L = build();
  const wanted = layRoute(L, R.route);
  if (!wanted) return null;
  // rock, one tile at a time, taken from where another answer goes and the intended one doesn't
  for (let guard = 0; guard < 80; guard++) {
    const s = solve(L, 3, 3e5);
    if (s.aborted) return null;
    if (s.routes.length === 1) break;
    const alt = layRoute(L, pick(r, s.routes.filter(x => x !== R.route)));
    const spots = alt.map((p, c) => (p && !wanted[c] && !onRoute.has(c) && !L.cells[c] ? c : -1)).filter(c => c >= 0);
    if (!spots.length || spec.rocks.length >= (opts.rocks ?? 99)) return null;
    spec.rocks.push(pick(r, spots));
    L = build();
  }
  let final = solve(L, 2, 3e5);
  if (final.routes.length !== 1 || final.routes[0] !== R.route) return null;
  // whatever the answer doesn't need goes again: rock first
  for (const c of shuffled(spec.rocks.slice(), r)) {
    const keep = spec.rocks.slice();
    spec.rocks = spec.rocks.filter(x => x !== c);
    const s = solve(build(), 2, 3e5);
    if (!(s.routes.length === 1 && !s.aborted)) spec.rocks = keep;
  }
  L = build();
  final = solve(L, 2, 3e5);
  if (final.routes.length !== 1) return null;
  // every old pipe and stake should matter: without one the level would have more than one answer. `loose` counts those that don't.
  let loose = 0;
  for (const c of olds) {
    const piece = spec.olds[c];
    delete spec.olds[c]; hand[piece[0]]++;
    const s = solve(build(), 2, 3e5);
    if (s.routes.length === 1 && !s.aborted) loose++;
    spec.olds[c] = piece; hand[piece[0]]--;
  }
  spec.stakes.forEach((gone, i) => {
    const was = spec.stakes;
    spec.stakes = was.filter((_, j) => j !== i);
    const s = solve(build(), 2, 3e5);
    if (s.routes.length === 1 && !s.aborted) loose++;
    spec.stakes = was;
  });
  spec.hand = handText(hand);
  return { spec, L, route: R.route, nodes: final.nodes, rocks: spec.rocks.length, loose, olds: olds.length, stakes: spec.stakes.length, passes: R.passes.length };
}
