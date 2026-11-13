// Settle's players, pure: a search that knows the whole deal (it finds each level's best plan: the par and the plan the tests replay),
// a bot that sees what a player does (the two parcels offered) and looks two moves ahead with them, and the simple players a level
// must defeat (13 November 2026, Korbi: "early levels way too easy ('everything in this column, then the rest')... a simple strat...
// will win. that needs to change"): one that keeps each metal in its own crucible, one that takes the move that looks best at once,
// and one that plays at random. Korbi, 6 November 2026: "a very good planner should always win": the search does, on every level.
import { RECIPES } from "./settle-alloys.js";
import { newGame, act, options, draw } from "./settle-engine.js";

/** How far the best block standing is toward some order, 0 to 1: the parcels in place of a block's, over its size. */
export function progress(tanks, orderIds) {
  let best = 0;
  const height = Math.max(0, ...tanks.map(t => t.length));
  for (const id of orderIds) {
    const o = RECIPES[id];
    for (let r = 0; r < height; r++) for (let c = 0; c + o.w <= tanks.length; c++) {
      const have = {};
      for (let x = c; x < c + o.w; x++) for (let y = r; y < r + o.k; y++) { const p = tanks[x][y]; if (p) have[p.m] = (have[p.m] || 0) + 1; }
      let ok = 0;
      for (const [m, k] of Object.entries(o.parts)) ok += Math.min(have[m] || 0, k);
      best = Math.max(best, ok / o.n);
    }
  }
  return best;
}
/** How good a position is for the player: casts made, a block nearly ready, little clutter, no dross, zinc not about to burn. */
export function value(s) {
  const parcels = s.tanks.reduce((a, t) => a + t.length, 0), dross = s.tanks.reduce((a, t) => a + t.filter(p => p.m === "X").length, 0);
  const risk = s.burn ? s.tanks.reduce((a, t) => a + (t.at(-1)?.m === "Zn" ? t.at(-1).a * t.at(-1).a / 6 : 0), 0) : 0;
  const full = s.tanks.filter(t => t.length >= s.height).length;
  return s.casts * 100 + progress(s.tanks, s.orders) * 30 - parcels * .6 - dross * 2 - risk - full * 4 + (s.fuel || 0) * .5;
}
const tie = mv => Math.sin(mv.reduce((a, x, i) => a + (x + 5) * (i + 1) * 12.9898, 0)) * .01;   // a fixed tie-break, so a bot is the same every run

/** The best move a player who sees the two parcels offered would make: two moves ahead with them, a move list or null. */
export function think(s) {
  let best = null;
  for (const mv of options(s)) {
    const a = act(s, mv).state;
    let v = a.won ? 1e6 : value(a);
    if (!a.over) for (const mv2 of options(a)) {
      if (mv[0] >= 0 && mv2[0] === mv[0]) continue;                 // the slot just poured holds a parcel not seen yet
      const b = act(a, mv2).state;
      v = Math.max(v, (b.won ? 1e6 : value(b)) - .5);
    }
    v += tie(mv);
    if (!best || v > best.v) best = { mv, v };
  }
  return best?.mv ?? null;
}
/** The move that looks best at once. */
export function greedy(s) {
  let best = null;
  for (const mv of options(s)) { const a = act(s, mv).state, v = (a.won ? 1e6 : value(a)) + tie(mv); if (!best || v > best.v) best = { mv, v }; }
  return best?.mv ?? null;
}
/** "Everything in this column, then the rest": each metal its own crucible, in the order the metals first come; when it is full, the
 *  emptiest other one; it skims when it must, and does nothing else. */
export function columns(s, home = {}) {
  const pours = options(s).filter(mv => mv[0] >= 0), skimming = options(s).find(mv => mv[0] === -1);
  if (!pours.length) return skimming ?? null;
  const slot = s.hand[0] ? 0 : 1, m = s.hand[slot], open = pours.filter(mv => mv[0] === slot).map(mv => mv[1]);
  if (!open.length) return pours[0];
  if (home[m] === undefined) home[m] = Object.keys(home).length % s.cols;
  if (open.includes(home[m])) return [slot, home[m]];
  return [slot, open.map(c => [s.tanks[c].length, c]).sort((a, b) => a[0] - b[0])[0][1]];
}
/** A move at random (seeded). */
export const randomly = seed => { let k = 0; return s => { const o = options(s); return o.length ? o[Math.floor(draw(seed, k++) * o.length)] : null; }; };

/** Plays a melt to its end (or `limit` turns) with a player (think by default): the final game. */
export function playOut(s, limit = 200, player = think) {
  const home = {};
  for (let k = 0; k < limit && !s.over; k++) {
    const mv = player === columns ? columns(s, home) : player(s);
    if (!mv) break;
    s = act(s, mv).state;
  }
  return s;
}

const keyOf = s => `${s.n}|${s.hand.join("")}|${s.fuel}|${s.tanks.map(t => t.map(p => p.m + (p.s ? "!" : "") + (p.m === "Zn" ? p.a : "")).join("")).join("/")}`;
/**
 * Searches a melt with the whole deal known (beam search, `width` positions a turn): { plan (move lists), turns, state } for the fewest
 * turns to the goal it finds, or null. The par of a level.
 */
export function search(spec, seed, { width = 400, limit = 70 } = {}) {
  let layer = [{ s: newGame(spec, seed), plan: [] }];
  for (let depth = 0; depth < limit && layer.length; depth++) {
    const next = new Map();
    for (const { s, plan } of layer) for (const mv of options(s)) {
      const st = act(s, mv).state, p = [...plan, mv];
      if (st.won) return { plan: p, turns: p.length, state: st };
      if (st.over) continue;
      const key = keyOf(st), f = value(st), prev = next.get(key);
      if (!prev || prev.f < f) next.set(key, { s: st, plan: p, f });
    }
    layer = [...next.values()].sort((a, b) => b.f - a.f).slice(0, width);
  }
  return null;
}
