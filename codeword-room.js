// Codeword's split key at a table (README, Codeword): the pair's one grid, pure, so tests/codeword.mjs can play a
// match through the database's round trip. The key is split between the two seats: seat 0 holds the numbers 1 to 13,
// seat 1 the numbers 14 to 26. Each player sees only their own numbers in the grid (the other's cells show none until
// their letter is in), writes letters in only for their own numbers, and can suggest a letter for a cell of the
// other's, which shows on the other's board for them to write in or wave away. Letters, hints and checks are the
// team's; the time runs from the deal to the last right letter. codeword.js joins the room (together.js) and draws.
//
//   { v: 1, mode: "split", app, created, asked, puzzle (packed: codeword-engine.js), put: { n7: { l, by } },
//     sug: { n7: { l, by, at } }, shown: { n7: 1 }, hints, checks, marks: { n7: 1 }, log: { s0: [{ n, b, a, m }] },
//     done, players: { uid: { name, slot, pid, online } } }
// Numbers are keyed n1 to n26, never 1 to 26, which the database would hand back as a list with holes; and nothing
// empty is relied on (the database keeps no empty object).
import { unpack, holderOf, HINT, CHECK } from "./codeword-rules.js";

export const BRANCH = "codeword-split";
const K = n => `n${n}`;
const LOG = 40;                       // undo steps kept for each player

/** A new table for the pair: this puzzle (packed), dealt now, for the request asked (its time) or none. */
export function freshTable(players, { app = 1, puzzle, asked = 0, now = Date.now() }) {
  return { v: 1, mode: "split", app, created: now, asked: asked || 0, puzzle, hints: 0, checks: 0, done: 0, players };
}
export const isTable = g => g?.v === 1 && g.mode === "split" && !!g.puzzle && Number.isFinite(g.created);
/** The marker a request leaves before its table is dealt: which match it's for (README: a request is routed). */
export const marker = (mode, asked) => ({ v: 1, mode: mode === "race" ? "race" : "stub", asked });

// ---------- reading the table ----------
/** The puzzle at the table, unpacked once per packed object. */
const seen = new WeakMap();
export function puzzleOf(g) {
  if (!g?.puzzle) return null;
  if (!seen.has(g.puzzle)) seen.set(g.puzzle, unpack(g.puzzle));
  return seen.get(g.puzzle);
}
export const isFixedAt = (g, p, n) => p.givens.includes(n) || !!g.shown?.[K(n)];
/** A number's letter at the table: given, shown by a hint, or written in by its holder; null if none. */
export const letterAt = (g, p, n) => (isFixedAt(g, p, n) ? p.letters[n] : g.put?.[K(n)]?.l || null);
/** The number a letter is on at the table, or 0. */
export const holdingAt = (g, p, ch) => { for (let n = 1; n <= 26; n++) if (letterAt(g, p, n) === ch) return n; return 0; };
/** The suggestion standing for a number: { l, by, at }, or null. */
export const suggestionFor = (g, n) => g.sug?.[K(n)] || null;
export const filledAt = (g, p) => { let k = 0; for (let n = 1; n <= 26; n++) if (letterAt(g, p, n)) k++; return k; };
export const wrongAt = (g, p) => [...Array(26).keys()].map(i => i + 1).filter(n => !isFixedAt(g, p, n) && g.put?.[K(n)]?.l && g.put[K(n)].l !== p.letters[n]);
export const solvedAt = (g, p) => filledAt(g, p) === 26 && !wrongAt(g, p).length;
export const isMarked = (g, n) => !!g.marks?.[K(n)];
/** The table as a solo run would have it, for the engine's helpers: { put, shown, marks, hints, checks }. */
export function asRun(g) {
  const put = {}, shown = {};
  for (const [k, v] of Object.entries(g.put || {})) if (v?.l) put[Number(k.slice(1))] = v.l;
  for (const k of Object.keys(g.shown || {})) shown[Number(k.slice(1))] = 1;
  return { put, shown, log: [], marks: Object.keys(g.marks || {}).map(k => Number(k.slice(1))), hints: g.hints || 0, checks: g.checks || 0, ms: 0, done: !!g.done };
}
/** The team's score once it's done: seconds from the deal to the last right letter, and the hints' and checks'. */
export const tableScore = g => (g.done ? Math.round((g.done - g.created) / 1000) + HINT * (g.hints || 0) + CHECK * (g.checks || 0) : null);

// ---------- what a player does (each inside a transaction: false leaves the table as it was) ----------
/**
 * Why `slot` can't write ch in for n, or "" if they can: "theirs" (n is the other's number), "fixed" (given or shown),
 * "taken" (ch is fixed on another number), "partner" (ch is on one of the other's numbers: theirs to move), "done".
 */
export function whyNot(g, slot, n, ch) {
  const p = puzzleOf(g);
  if (!p || g.done) return "done";
  if (holderOf(n) !== slot) return "theirs";
  if (isFixedAt(g, p, n)) return "fixed";
  const m = holdingAt(g, p, ch);
  if (m && m !== n && isFixedAt(g, p, m)) return "taken";
  if (m && m !== n && holderOf(m) !== slot) return "partner";
  return "";
}
const logOf = (g, slot) => Object.values(g.log?.[`s${slot}`] || {}).filter(Boolean);
const keepLog = (g, slot, list) => { g.log = { ...(g.log || {}), [`s${slot}`]: list.slice(-LOG) }; if (!list.length) delete g.log[`s${slot}`]; };
const unmark = (g, ...ns) => { if (!g.marks) return; for (const n of ns) delete g.marks[K(n)]; if (!Object.keys(g.marks).length) delete g.marks; };
const settle = (g, now) => { const p = puzzleOf(g); if (!g.done && solvedAt(g, p)) g.done = now; };
/** Writes ch in for n; a letter on another of the player's own numbers moves here. */
export function writeIn(g, slot, n, ch, now = Date.now()) {
  if (whyNot(g, slot, n, ch)) return false;
  const p = puzzleOf(g), m = holdingAt(g, p, ch);
  if (m === n) return false;
  const before = g.put?.[K(n)]?.l || "";
  g.put = { ...(g.put || {}) };
  if (m) delete g.put[K(m)];
  g.put[K(n)] = { l: ch, by: slot };
  if (g.sug?.[K(n)]) { delete g.sug[K(n)]; if (!Object.keys(g.sug).length) delete g.sug; }
  keepLog(g, slot, [...logOf(g, slot), { n, b: before, a: ch, m }]);
  unmark(g, n, m);
  settle(g, now);
  return true;
}
/** Takes the letter out of one of the player's own numbers. */
export function takeOut(g, slot, n) {
  const p = puzzleOf(g);
  if (!p || g.done || holderOf(n) !== slot || isFixedAt(g, p, n) || !g.put?.[K(n)]) return false;
  keepLog(g, slot, [...logOf(g, slot), { n, b: g.put[K(n)].l, a: "", m: 0 }]);
  delete g.put[K(n)];
  if (!Object.keys(g.put).length) delete g.put;
  unmark(g, n);
  return true;
}
/** Takes back the player's own last change (only theirs: the other's are the other's to undo). */
export function takeBack(g, slot) {
  const list = logOf(g, slot), last = list.pop(), p = puzzleOf(g);
  if (!last || !p || g.done) return false;
  g.put = { ...(g.put || {}) };
  const free = (l, n) => { const at = holdingAt(g, p, l); return !at || at === n; };    // the letter is on no other number now
  // the number's letter out, the letter it took back where it came from, the number's old letter back: each only if a
  // hint hasn't fixed it somewhere since
  if (!isFixedAt(g, p, last.n)) delete g.put[K(last.n)];
  if (last.m && last.a && !isFixedAt(g, p, last.m) && free(last.a, last.m)) g.put[K(last.m)] = { l: last.a, by: slot };
  if (last.b && !isFixedAt(g, p, last.n) && free(last.b, last.n)) g.put[K(last.n)] = { l: last.b, by: slot };
  if (!Object.keys(g.put).length) delete g.put;
  keepLog(g, slot, list);
  unmark(g, last.n, last.m);
  return true;
}
/** Suggests ch for one of the other's numbers (n), for them to write in or wave away; "" takes a suggestion back. */
export function suggest(g, slot, n, ch, now = Date.now()) {
  const p = puzzleOf(g);
  if (!p || g.done || holderOf(n) === slot || isFixedAt(g, p, n) || (ch && letterAt(g, p, n) === ch)) return false;
  g.sug = { ...(g.sug || {}) };
  if (ch) g.sug[K(n)] = { l: ch, by: slot, at: now }; else delete g.sug[K(n)];
  if (!Object.keys(g.sug).length) delete g.sug;
  return true;
}
/** The holder waves a suggestion away. */
export function wave(g, slot, n) {
  if (holderOf(n) !== slot || !g.sug?.[K(n)]) return false;
  delete g.sug[K(n)];
  if (!Object.keys(g.sug).length) delete g.sug;
  return true;
}
/** A check, for the team: the numbers written in wrong are marked until they change. */
export function checkAt(g) {
  const p = puzzleOf(g);
  if (!p || g.done) return false;
  g.checks = (g.checks || 0) + 1;
  const wrong = wrongAt(g, p);
  if (wrong.length) g.marks = Object.fromEntries(wrong.map(n => [K(n), 1])); else delete g.marks;
  return true;
}
/** What's right at the table, { number: letter }: what a hint is worked out from (hintFor in codeword-engine.js). */
export function rightAt(g) {
  const p = puzzleOf(g), right = {};
  if (p) for (let n = 1; n <= 26; n++) if (letterAt(g, p, n) === p.letters[n]) right[n] = p.letters[n];
  return right;
}
/**
 * A hint, for the team: number n (the one hintFor found) shown for good, its letter taken off a wrong number it was
 * on, whoever's. False if n is already fixed.
 */
export function hintAt(g, n, now = Date.now()) {
  const p = puzzleOf(g);
  if (!p || g.done || !(n >= 1 && n <= 26) || isFixedAt(g, p, n)) return false;
  const ch = p.letters[n], m = holdingAt(g, p, ch);
  g.put = { ...(g.put || {}) };
  if (m && m !== n) delete g.put[K(m)];
  delete g.put[K(n)];
  if (!Object.keys(g.put).length) delete g.put;
  g.shown = { ...(g.shown || {}), [K(n)]: 1 };
  if (g.sug?.[K(n)]) { delete g.sug[K(n)]; if (!Object.keys(g.sug).length) delete g.sug; }
  g.hints = (g.hints || 0) + 1;
  unmark(g, n, m);
  settle(g, now);
  return true;
}
/** A new grid at the same table (the pair stays seated): every letter, suggestion and penalty goes. */
export function newGrid(g, puzzle, now = Date.now()) {
  for (const k of ["put", "sug", "shown", "marks", "log"]) delete g[k];
  Object.assign(g, { puzzle, created: now, hints: 0, checks: 0, done: 0 });
  return true;
}
/** The match as this player saw it, once solved, for the pair's record: a team result, lower better. */
export const resultOf = g => (g?.done ? { match: `split-${g.created}`, score: tableScore(g), won: true, coop: true, lower: true } : null);
