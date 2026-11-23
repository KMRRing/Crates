// Settle's rules (redesign of 23 November 2026, Korbi: "Settle right now is not good ... think about how it could be made into a
// good puzzle"; his choices: a pour moves all the top metal that fits, moves against a par with no limit, three chapters first).
//
// A row of crucibles, each holding up to its measures of molten metal. Metal always lies by weight, the heaviest at the foot, so a
// crucible is only how much of each metal it holds. A move tips one crucible into another that has room: all of its top metal
// (the lightest it holds) pours across, as much as fits, and sinks to its place by weight. Only the top ever comes out: copper
// under tin is held until the tin is gone. The moulds are the goal, each a recipe; a crucible that holds exactly a mould's recipe
// is cast into it at once and stands empty. Cast every mould.
//
// Pure: the page, the solver, the level maker and the tests share it. A state is { cups: [[count of each metal]], caps, cast:
// [mould done] } over a level's `metals` (heaviest first) and `moulds` ([[count of each metal]]).
import { METALS } from "./settle-alloys.js";

/** A level ready to play: metals heaviest first, each crucible's counts, the moulds' counts. spec: { caps, fill: [["Pb", ...] foot
 *  to top], moulds: [{ Pb: 1, Sn: 3 }] }. */
export function levelOf(spec) {
  const used = new Set([...spec.fill.flat(), ...spec.moulds.flatMap(m => Object.keys(m))]);
  const metals = [...used].sort((a, b) => METALS[b].dens - METALS[a].dens);
  const counts = list => metals.map(m => list.filter(x => x === m).length);
  const moulds = spec.moulds.map(m => metals.map(k => m[k] || 0));
  return { metals, caps: spec.caps.slice(), start: spec.fill.map(counts), moulds };
}
export const startOf = L => castAll(L, { cups: L.start.map(c => c.slice()), cast: L.moulds.map(() => false) }).state;

const sum = c => c.reduce((a, b) => a + b, 0);
/** The metal a crucible would pour (its lightest), or -1 when it is empty. */
export const topOf = cup => { for (let i = cup.length - 1; i >= 0; i--) if (cup[i]) return i; return -1; };
/** A crucible's measures foot to top, as metal indexes. */
export const layersOf = cup => cup.flatMap((n, i) => Array(n).fill(i));
const same = (a, b) => a.every((v, i) => v === b[i]);

/** Casts every crucible that holds exactly an open mould's recipe (the receiving one first): { state, casts: [{ cup, mould }] }. */
function castAll(L, s, order = null) {
  const casts = [], cups = s.cups.map(c => c.slice()), cast = s.cast.slice();
  for (const c of order || cups.keys()) {
    if (!sum(cups[c])) continue;
    const m = L.moulds.findIndex((r, i) => !cast[i] && same(r, cups[c]));
    if (m < 0) continue;
    cast[m] = true; casts.push({ cup: c, mould: m, holds: cups[c].slice() }); cups[c] = cups[c].map(() => 0);
  }
  return { state: { cups, cast }, casts };
}
/** What tipping crucible a into b would move: { metal, n }, or null when it can't (a empty, b full, the same crucible). */
export function pourOf(L, s, a, b) {
  if (a === b) return null;
  const t = topOf(s.cups[a]), room = L.caps[b] - sum(s.cups[b]);
  if (t < 0 || room <= 0) return null;
  return { metal: t, n: Math.min(s.cups[a][t], room) };
}
/** Tips a into b: { state, poured: { metal, n }, casts }, or null. */
export function pour(L, s, a, b) {
  const p = pourOf(L, s, a, b);
  if (!p) return null;
  const cups = s.cups.map(c => c.slice());
  cups[a][p.metal] -= p.n; cups[b][p.metal] += p.n;
  const after = castAll(L, { cups, cast: s.cast }, [b, a]);
  return { state: after.state, poured: p, casts: after.casts };
}
export const won = s => s.cast.every(Boolean);
/** Every move from a state, as [a, b]. */
export function movesOf(L, s) {
  const out = [];
  for (let a = 0; a < s.cups.length; a++) for (let b = 0; b < s.cups.length; b++) if (pourOf(L, s, a, b)) out.push([a, b]);
  return out;
}
export const keyOf = s => `${s.cups.map(c => c.join(".")).join("|")}/${s.cast.map(Number).join("")}`;

// ---------- the solver: the whole game is small enough to search ----------
/**
 * Every state reachable from s, by breadth: { par (fewest moves to cast every mould, Infinity if none), toWin (state key →
 * moves left on the shortest way, for the states from which one can still win) }. `cap` bounds the states looked at.
 */
export function solve(L, s, cap = 200000) {
  const seen = new Map([[keyOf(s), { s, d: 0, next: [] }]]), queue = [keyOf(s)], wins = [];
  for (let i = 0; i < queue.length && seen.size < cap; i++) {
    const k = queue[i], node = seen.get(k);
    if (won(node.s)) { wins.push(k); continue; }
    for (const [a, b] of movesOf(L, node.s)) {
      const t = pour(L, node.s, a, b).state, tk = keyOf(t);
      node.next.push(tk);
      if (!seen.has(tk)) { seen.set(tk, { s: t, d: node.d + 1, next: [] }); queue.push(tk); }
    }
  }
  // moves left to win, backwards from every won state
  const back = new Map();
  for (const [k, n] of seen) for (const t of n.next) { if (!back.has(t)) back.set(t, []); back.get(t).push(k); }
  const toWin = new Map(wins.map(k => [k, 0])), q = wins.slice();
  for (let i = 0; i < q.length; i++) for (const p of back.get(q[i]) || []) if (!toWin.has(p)) { toWin.set(p, toWin.get(q[i]) + 1); q.push(p); }
  return { par: toWin.get(keyOf(s)) ?? Infinity, toWin, states: seen.size, complete: seen.size < cap };
}
/** The best move from a state (one on a shortest way to cast every mould), or null when none wins from here. */
export function bestMove(L, s) {
  const { toWin } = solve(L, s);
  const here = toWin.get(keyOf(s));
  if (here == null || here === 0) return null;
  return movesOf(L, s).find(([a, b]) => toWin.get(keyOf(pour(L, s, a, b).state)) === here - 1) || null;
}

/** Stars for a level won in `moves`: three at par, two within two of it, one otherwise. */
export const starsFor = (par, moves) => (moves <= par ? 3 : moves <= par + 2 ? 2 : 1);
