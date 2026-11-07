// Settle's players, pure: a search that knows the whole deal (it finds each level's best plan: the par and the plan the
// tests replay), and a bot that sees only what a player does (the two parcels offered) and looks two pours ahead with
// them. Korbi, 6 November 2026: "a very good planner should always win" in all three modes, so tests/settle.mjs plays the
// bot over a few hundred random melts and fails when it clears fewer than the target share.
import { RECIPES } from "./settle-alloys.js";
import { newGame, pour, skim, moves, skims } from "./settle-engine.js";

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
/** How good a position is for the player: casts made, a block nearly ready, little clutter, no dross. */
export function value(s) {
  const parcels = s.tanks.reduce((a, t) => a + t.length, 0), dross = s.tanks.reduce((a, t) => a + t.filter(p => p.m === "X").length, 0);
  const risk = s.burn ? s.tanks.reduce((a, t) => a + (t.at(-1)?.m === "Zn" ? t.at(-1).a * t.at(-1).a / 6 : 0), 0) : 0;
  const full = s.tanks.filter(t => t.length >= s.height).length;
  return s.casts * 100 + progress(s.tanks, s.orders) * 30 - parcels * .6 - dross * 2 - risk - full * 4;
}
/** The moves open: pours (slot 0 or 1, crucible) and skims (slot -1). */
export const options = s => [...moves(s), ...skims(s).map(c => ({ slot: -1, c }))];
const step = (s, mv) => (mv.slot < 0 ? skim(s, mv.c) : pour(s, mv.slot, mv.c));

/** The best move a player who sees the two parcels offered would make: two pours ahead with them, { slot, c } or null. */
export function think(s) {
  let best = null;
  for (const mv of options(s)) {
    const a = step(s, mv).state;
    let v = a.won ? 1e6 : value(a);
    if (!a.over && mv.slot >= 0) {
      // the other parcel offered still waits: pour it too, where it is best
      for (const mv2 of moves(a)) if (mv2.slot === 1 - mv.slot) {
        const b = pour(a, mv2.slot, mv2.c).state;
        v = Math.max(v, (b.won ? 1e6 : value(b)) - .5);
      }
    }
    v += Math.sin((mv.slot + 2) * 12.9898 + mv.c * 78.233) * .01;   // a fixed tie-break, so the bot is the same every run
    if (!best || v > best.v) best = { ...mv, v };
  }
  return best && { slot: best.slot, c: best.c };
}
/** Plays a melt with the bot to its end (or `limit` turns): the final game. */
export function playOut(s, limit = 200) {
  for (let k = 0; k < limit && !s.over; k++) {
    const mv = think(s);
    if (!mv) break;
    s = step(s, mv).state;
  }
  return s;
}

const keyOf = s => `${s.n}|${s.hand.join("")}|${s.tanks.map(t => t.map(p => p.m + (p.m === "Zn" ? p.a : "")).join("")).join("/")}`;
/**
 * Searches a melt with the whole deal known (beam search, `width` positions a turn): { plan: [[slot, crucible]], turns,
 * state } for the fewest turns to the goal it finds (slot -1: a skim), or null. The par of a level.
 */
export function search(spec, seed, { width = 400, limit = 70 } = {}) {
  let layer = [{ s: newGame(spec, seed), plan: [] }];
  for (let depth = 0; depth < limit && layer.length; depth++) {
    const next = new Map();
    for (const { s, plan } of layer) for (const mv of options(s)) {
      const st = step(s, mv).state, p = [...plan, [mv.slot, mv.c]];
      if (st.won) return { plan: p, turns: p.length, state: st };
      if (st.over) continue;
      const key = keyOf(st), f = value(st), prev = next.get(key);
      if (!prev || prev.f < f) next.set(key, { s: st, plan: p, f });
    }
    layer = [...next.values()].sort((a, b) => b.f - a.f).slice(0, width);
  }
  return null;
}
