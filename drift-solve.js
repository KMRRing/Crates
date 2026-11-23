// Drift's strong player. It sees only what the page shows (the crates and weather of the queue, the warehouse's crate, this turn's
// strays and rock) and searches through them, a beam of the best few lines a turn deep at a time, then lays the first crate of the
// best line it found. drift-plan.mjs has it prove each campaign level can be won by a player who reads the forecast, and set the
// level's par from the turns it took; the tests replay it. (One leak it is allowed: a squall forecast for a later turn lands where
// the engine will drop it, which the player sees only on that turn. The levels leave turns to spare against it.)
import { QUEUE, EMPTY, GOODS, newGame, lay, stow, moves, needLeft, foggy } from "./drift-engine.js";
import { SHAPES } from "./drift-shapes.js";

export const BEAM = 8;

// what the planner weighs: a crate an order wanted shipped, a wanted crate on the quay, a pair of one touching, an unwanted crate
// lying about, an empty square, and the squeeze below `tight` empty squares
export const WEIGH = { ship: 1000, have: 30, pair: 70, gap: 0, junk: 25, held: 20, room: 12, tight: 6, squeeze: 150 };

/** How good a quay is to be on: shipping what is wanted first, then pairs of a wanted good, then room to work in. */
function value(r, s, w, rare, P = WEIGH) {
  if (s.status === "won") return 1e9 - s.turns * 1e5;
  if (s.status === "lost") return -1e9 + s.turns;
  const need = needLeft(r, s), cells = s.cells;
  let v = 0, empty = 0;
  for (let c = 0; c < GOODS; c++) v += Math.min(s.shipped[c], r.orders[c]) * P.ship;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    if (c === EMPTY) { empty++; continue; }
    if (c < 0) continue;
    if (!need[c]) { v -= P.junk; continue; }
    v += P.have;
    const x = i % w;
    if (x < w - 1 && cells[i + 1] === c) v += P.pair * rare[c];
    if (cells[i + w] === c) v += P.pair * rare[c];
    if (P.gap && x < w - 2 && cells[i + 1] === EMPTY && cells[i + 2] === c) v += P.gap * rare[c];
    if (P.gap && cells[i + w] === EMPTY && cells[i + 2 * w] === c) v += P.gap * rare[c];
  }
  if (s.held && need[s.held.c]) v += P.held;
  v += empty * P.room;
  if (empty < P.tight) v -= (P.tight - empty) ** 2 * P.squeeze;
  return v;
}
const keyOf = s => s.cells.join() + (s.held ? `|${s.held.c}${s.held.k}` : "") + (s.stowed ? "*" : "");

/**
 * The best thing to do now: { at, stow } (stow the crate first, then lay the one that comes out), or null with nothing to do.
 * Looks no further than the forecast: no crate beyond the queue, no turn beyond it (none beyond this one in fog).
 */
export function think(r, s0, beam = BEAM, see = QUEUE) {
  if (s0.status !== "play") return null;
  const w = SHAPES[s0.shape].w, total = r.mix.slice(0, r.goods).reduce((a, b) => a + b, 0);
  const rare = r.mix.map(m => 1 + (1 - m / total) * 1.5);
  const lastCrate = s0.dealt - 1 + (see - QUEUE), depth = foggy(s0) && see === QUEUE ? 1 : see;
  // the crate to lay at a node is known if it came out of the warehouse or was in the queue the player saw
  const known = (t, fromHold) => fromHold || t.dealt - QUEUE <= lastCrate;
  let layer = [{ s: s0, first: null }], won = null, lost = null, last = null;
  for (let d = 0; d < depth && layer.length; d++) {
    const out = new Map();
    for (const node of layer) {
      const tries = [[node.s, false]];
      if (r.hold && !node.s.stowed) { const t = stow(r, node.s); if (t) tries.push([t, true]); }
      for (const [t, stowed] of tries) {
        if (!known(t, stowed && !!node.s.held)) continue;
        for (const i of moves(t)) {
          const n = lay(r, t, i).state, first = node.first || { at: i, stow: stowed }, v = value(r, n, w, rare);
          if (n.status === "won") { if (!won || v > won.v) won = { v, first }; continue; }
          if (n.status === "lost") { if (!lost || v > lost.v) lost = { v, first }; continue; }
          const k = keyOf(n), was = out.get(k);
          if (!was || v > was.v) out.set(k, { s: n, first, v });
        }
      }
    }
    layer = [...out.values()].sort((a, b) => b.v - a.v).slice(0, beam);
    if (layer.length) last = layer[0];
  }
  return (won || last || lost)?.first ?? null;
}

/** One move of a player: stow if it says so, then lay. */
export function step(r, s, m) { return lay(r, m.stow ? stow(r, s) : s, m.at).state; }

/** A whole game of a level by the strong player, to its end or `cap` turns: the final state and the moves made. */
export function solve(r, seed, cap = 200, beam = BEAM, see = QUEUE) {
  let s = newGame(r, seed);
  const made = [];
  for (let k = 0; k < cap && s.status === "play"; k++) {
    const m = think(r, s, beam, see);
    if (!m) break;
    made.push(m);
    s = step(r, s, m);
  }
  return { state: s, moves: made };
}
