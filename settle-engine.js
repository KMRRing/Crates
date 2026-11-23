// Settle's rules (redesign of 23 November 2026, Korbi: "Settle right now is not good ... think about how it could be made into a
// good puzzle"; his choices: a pour moves all the top metal that fits, moves against a par with no limit, three chapters first).
//
// A row of crucibles, each holding up to its measures of molten metal. Metal always lies by weight, the heaviest at the foot, so a
// crucible is only how much of each metal it holds. A move tips one crucible into another that has room: all of its top metal
// (the lightest it holds) pours across, as much as fits, and sinks to its place by weight. Only the top ever comes out: copper
// under tin is held until the tin is gone. The moulds are the goal, each a recipe; a crucible that holds exactly a mould's recipe
// is cast into it at once and stands empty. Cast every mould.
//
// The campaign's later chapters (23 November 2026, Korbi: "work on a lot more levels. think of twists as well") add, each in its
// own chapter and then for good:
//   dross, a scum lighter than every metal that no mould wants, and the slag pot, which takes anything and gives nothing back;
//   the teapot ladle, which pours from its foot: its heaviest metal, from under the rest;
//   zinc and charcoal: zinc left in a crucible without charcoal burns away once a pour is done (after any cast it completes);
//   charcoal floats on everything, never pours, and is no part of a recipe (a crucible casts with its charcoal still in it);
//   the liquation: lead meeting black copper draws its silver, a measure for a measure, and becomes rich lead; the copper is left plain.
//
// Pure: the page, the solver, the level maker and the tests share it. A state is { cups: [[count of each metal]], caps, cast:
// [mould done] } over a level's `metals` (heaviest first), `moulds` ([[count of each metal]]) and `kinds` (each crucible "",
// "slag" or "teapot").
import { METALS } from "./settle-alloys.js";

/** A level ready to play: metals heaviest first, each crucible's counts, the moulds' counts. spec: { caps, fill: [["Pb", ...] foot
 *  to top], moulds: [{ Pb: 1, Sn: 3 }] }. */
export function levelOf(spec) {
  const used = new Set([...spec.fill.flat(), ...spec.moulds.flatMap(m => Object.keys(m))]);
  const metals = [...used].sort((a, b) => METALS[b].dens - METALS[a].dens);
  const counts = list => metals.map(m => list.filter(x => x === m).length);
  const moulds = spec.moulds.map(m => metals.map(k => m[k] || 0));
  const at = id => metals.indexOf(id);
  return { metals, caps: spec.caps.slice(), kinds: spec.kinds ? spec.kinds.slice() : spec.caps.map(() => ""), start: spec.fill.map(counts), moulds,
    C: at("C"), Zn: at("Zn"), Pb: at("Pb"), Bk: at("Bk"), Pr: at("Pr"), Cu: at("Cu") };
}
export const startOf = L => castAll(L, { cups: L.start.map(c => c.slice()), cast: L.moulds.map(() => false) }).state;

const sum = c => c.reduce((a, b) => a + b, 0);
/** The metal a crucible would pour, or -1 when it has none: its lightest, or a teapot ladle's heaviest; never charcoal. */
export function topOf(cup, kind = "", C = -1) {
  if (kind === "teapot") { for (let i = 0; i < cup.length; i++) if (cup[i] && i !== C) return i; return -1; }
  for (let i = cup.length - 1; i >= 0; i--) if (cup[i] && i !== C) return i;
  return -1;
}
/** A crucible's measures foot to top, as metal indexes. */
export const layersOf = cup => cup.flatMap((n, i) => Array(n).fill(i));
/** A crucible's metal matches a recipe: every count the same, its charcoal aside. */
const same = (r, cup, C) => r.every((v, i) => i === C || v === cup[i]) && cup.some((v, i) => v && i !== C);

/** Casts every crucible that holds exactly an open mould's recipe (the receiving one first; never a slag pot); its charcoal stays.
 *  { state, casts: [{ cup, mould }] }. */
function castAll(L, s, order = null) {
  const casts = [], cups = s.cups.map(c => c.slice()), cast = s.cast.slice();
  for (const c of order || cups.keys()) {
    if (!sum(cups[c]) || L.kinds[c] === "slag") continue;
    const m = L.moulds.findIndex((r, i) => !cast[i] && same(r, cups[c], L.C));
    if (m < 0) continue;
    cast[m] = true; casts.push({ cup: c, mould: m, holds: cups[c].slice() }); cups[c] = cups[c].map((v, i) => (i === L.C ? v : 0));
  }
  return { state: { cups, cast }, casts };
}
/** The liquation in crucible c: its lead draws the silver of as much black copper, a measure for a measure. The measures turned. */
function liquate(L, cup) {
  if (L.Pb < 0 || L.Bk < 0) return 0;
  const n = Math.min(cup[L.Pb], cup[L.Bk]);
  if (!n) return 0;
  cup[L.Pb] -= n; cup[L.Bk] -= n; cup[L.Pr] += n; cup[L.Cu] += n;
  return n;
}
/** Zinc in a crucible with no charcoal burns away: the measures lost. */
function burn(L, cup) {
  if (L.Zn < 0 || !cup[L.Zn] || (L.C >= 0 && cup[L.C])) return 0;
  const n = cup[L.Zn];
  cup[L.Zn] = 0;
  return n;
}
/** What tipping crucible a into b would move: { metal, n }, or null when it can't (a empty, b full, the same crucible). */
export function pourOf(L, s, a, b) {
  if (a === b || L.kinds[a] === "slag") return null;
  const t = topOf(s.cups[a], L.kinds[a], L.C), room = L.caps[b] - sum(s.cups[b]);
  if (t < 0 || room <= 0) return null;
  return { metal: t, n: Math.min(s.cups[a][t], room) };
}
/**
 * Tips a into b: { state, poured: { metal, n }, liquated (measures of lead turned rich in b), mid (b as it lies once the pour has
 * settled and liquated, before anything casts or burns), casts, burnt: [{ cup, n }] }, or null.
 */
export function pour(L, s, a, b) {
  const p = pourOf(L, s, a, b);
  if (!p) return null;
  const cups = s.cups.map(c => c.slice());
  cups[a][p.metal] -= p.n; cups[b][p.metal] += p.n;
  const liquated = liquate(L, cups[b]), mid = cups[b].slice();
  const after = castAll(L, { cups, cast: s.cast }, [b, a]), burnt = [];
  for (const c of [b, a]) { const n = burn(L, after.state.cups[c]); if (n) burnt.push({ cup: c, n }); }
  return { state: after.state, poured: p, liquated, mid, casts: after.casts, burnt };
}
export const won = s => s.cast.every(Boolean);
/** Every move from a state, as [a, b]. */
export function movesOf(L, s) {
  const out = [];
  for (let a = 0; a < s.cups.length; a++) for (let b = 0; b < s.cups.length; b++) if (pourOf(L, s, a, b)) out.push([a, b]);
  return out;
}
// one character a count (no count reaches 32) and one a mould: a state's key is a short string, quick to make and to hash
const KEY = [];
export const keyOf = s => {
  let n = 0;
  for (const c of s.cups) { for (let i = 0; i < c.length; i++) KEY[n++] = c[i] + 48; KEY[n++] = 124; }
  for (const m of s.cast) KEY[n++] = m ? 49 : 48;
  KEY.length = n;
  return String.fromCharCode.apply(null, KEY);
};

/** The state after tipping a into b, as pour leaves it but with none of its account: the solver's step. Only the two crucibles
 *  touched are copied (a state is never changed once made). */
function step(L, s, a, b, metal, n) {
  const cups = s.cups.slice(), ca = cups[a] = s.cups[a].slice(), cb = cups[b] = s.cups[b].slice();
  ca[metal] -= n; cb[metal] += n;
  liquate(L, cb);
  let cast = s.cast;
  for (const c of [b, a]) {
    const cup = cups[c];
    if (L.kinds[c] === "slag" || !cup.some(v => v)) continue;
    const m = L.moulds.findIndex((r, i) => !cast[i] && same(r, cup, L.C));
    if (m < 0) continue;
    if (cast === s.cast) cast = cast.slice();
    cast[m] = true; cups[c] = cup.map((v, i) => (i === L.C ? v : 0));
  }
  for (const c of [b, a]) burn(L, cups[c]);                     // both are copies of this step's own
  return { cups, cast };
}

// ---------- the solver: the whole game is small enough to search ----------
/**
 * Every state reachable from s, by breadth: { par (fewest moves to cast every mould, Infinity if none), toWin (state key →
 * moves left on the shortest way, for the states from which one can still win) }. `cap` bounds the states looked at.
 */
export function solve(L, s, cap = 200000) {
  // states by number, the moves as two lists of numbers, then the moves reversed (each state's predecessors in one run of an array):
  // a search of a hundred thousand states this way is a second on a phone, where maps of keys to lists were several
  const ids = new Map([[keyOf(s), 0]]), states = [s], from = [], to = [], wins = [];
  for (let i = 0; i < states.length && states.length < cap; i++) {
    const st = states[i];
    if (won(st)) { wins.push(i); continue; }
    const n = st.cups.length;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const p = pourOf(L, st, a, b);
      if (!p) continue;
      const t = step(L, st, a, b, p.metal, p.n), tk = keyOf(t);
      let j = ids.get(tk);
      if (j === undefined) { j = states.length; ids.set(tk, j); states.push(t); }
      from.push(i); to.push(j);
    }
  }
  // moves left to win, backwards from every won state
  const N = states.length, head = new Int32Array(N + 1), rev = new Int32Array(to.length);
  for (const j of to) head[j + 1]++;
  for (let i = 0; i < N; i++) head[i + 1] += head[i];
  const at = head.slice(0, N);
  for (let e = 0; e < to.length; e++) rev[at[to[e]]++] = from[e];
  const d = new Int32Array(N).fill(-1), q = new Int32Array(N);
  let qn = 0;
  for (const w of wins) { d[w] = 0; q[qn++] = w; }
  for (let qi = 0; qi < qn; qi++) { const x = q[qi]; for (let e = head[x]; e < head[x + 1]; e++) { const y = rev[e]; if (d[y] < 0) { d[y] = d[x] + 1; q[qn++] = y; } } }
  return { par: d[0] < 0 ? Infinity : d[0], toWin: winsTable(ids, d), states: N, complete: N < cap };
}
/** A state key's moves left to win (undefined where none wins): a solve's answer for every state it reached. */
export function winsTable(ids, d) {
  const get = k => { const i = ids.get(k); return i === undefined || d[i] < 0 ? undefined : d[i]; };
  return { ids, d, get, has: k => get(k) !== undefined };
}
/** The best move from a state (one on a shortest way to cast every mould), or null when none wins from here; `toWin` a solve's table
 *  that reached this state (one from the level's start reaches every state play can). */
export function bestMove(L, s, toWin = solve(L, s).toWin) {
  const here = toWin.get(keyOf(s));
  if (here == null || here === 0) return null;
  return movesOf(L, s).find(([a, b]) => toWin.get(keyOf(pour(L, s, a, b).state)) === here - 1) || null;
}

/** Stars for a level won in `moves`: three at par, two within two of it, one otherwise. */
export const starsFor = (par, moves) => (moves <= par ? 3 : moves <= par + 2 ? 2 : 1);
