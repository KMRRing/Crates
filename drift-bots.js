// Simple players for Drift, for the tests and for tuning the levels (the page does not load this): they only look at what
// the page shows, the queue and the turn beforehand (lay itself), never at what is still to be drawn.
import { newGame, lay, moves, room, needLeft } from "./drift-engine.js";
import { SHAPES } from "./drift-shapes.js";

function rng(seed) { let z = (seed * 2654435761) >>> 0 || 1; return () => ((z = (Math.imul(z, 1103515245) + 12345) & 0x7fffffff) / 0x7fffffff); }
const useful = (r, s0, ok) => { const left = needLeft(r, s0); return ok.reduce((a, n, c) => a + Math.min(n, left[c]), 0); };
/** Pairs of a still-needed good touching, rarer goods counting more: the raw material of the next shipment. */
function pairs(r, s, w) {
  const left = needLeft(r, s), tot = r.mix.reduce((a, b) => a + b, 0);
  let v = 0;
  s.cells.forEach((c, i) => {
    if (c < 0 || !left[c]) return;
    const k = 1 + (1 - r.mix[c] / tot) * 2;
    if (i % w < w - 1 && s.cells[i + 1] === c) v += k;
    if (s.cells[i + w] === c) v += k;
  });
  return v;
}
/** Crates shipped in a line too short for their order: spent, and no use. */
const wasted = (r, s0, t) => t.by.reduce((a, n, c) => a + (r.orders[c] && s0.shipped[c] < r.orders[c] ? n - t.ok[c] : 0), 0);
const widthOf = s => SHAPES[s.shape].w;
export const BOTS = {
  random: (r, s, rnd) => { const m = moves(s); return m[Math.floor(rnd() * m.length)]; },
  // the most crates shipped now, whatever the good (and for an endless game, the most room left)
  greedy: (r, s, rnd) => { let b = null, bv = -Infinity; for (const i of moves(s)) { const t = lay(r, s, i), v = t.cleared * 10 + room(t.state) * 0.1 + rnd() * 1e-3; if (v > bv) { bv = v; b = i; } } return b; },
  // only crates an order still wants
  needy: (r, s, rnd) => {
    const w = widthOf(s);
    let b = null, bv = -Infinity;
    for (const i of moves(s)) { const t = lay(r, s, i), v = (r.orders ? useful(r, s, t.ok) * 10 - wasted(r, s, t) * 6 + pairs(r, t.state, w) * 2 : t.gain) + room(t.state) * 0.1 + rnd() * 1e-3; if (v > bv) { bv = v; b = i; } }
    return b;
  },
  // as needy, and looks one crate ahead
  planner: (r, s, rnd) => {
    const w = widthOf(s);
    const score = (s0, t) => (r.orders ? useful(r, s0, t.ok) * 10 - wasted(r, s0, t) * 6 + pairs(r, t.state, w) * 2 : t.gain / 9) + room(t.state) * 0.1;
    const first = moves(s).map(i => { const t = lay(r, s, i); return [score(s, t) + rnd() * 1e-3, i, t]; }).sort((a, b) => b[0] - a[0]).slice(0, 6);
    let b = null, bv = -Infinity;
    for (const [v1, i, t] of first) {
      let v = v1;
      if (t.state.status === "play") { let nb = -Infinity; for (const j of moves(t.state)) nb = Math.max(nb, score(t.state, lay(r, t.state, j))); if (nb > -Infinity) v += nb * 0.8; }
      if (t.state.status === "won") v += 1e4;
      if (t.state.status === "lost") v -= 1e3;
      if (v > bv) { bv = v; b = i; }
    }
    return b;
  },
};
/** A whole game by a bot, to its end or `cap` turns. */
export function play(r, seed, bot, cap = 400) {
  let s = newGame(r, seed);
  const rnd = rng(seed + 17), f = BOTS[bot];
  for (let k = 0; k < cap && s.status === "play"; k++) { const i = f(r, s, rnd); if (i == null) break; s = lay(r, s, i).state; }
  return s;
}
