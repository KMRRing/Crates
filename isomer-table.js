// Isomer for two (README, Isomer, Together): the pair's match, one puzzle split between two phones. Each holds half of
// the jumbles, the other's sealed on their screen, and half of each final's clue; a jumble solved drops its circled
// letters into the tray on both phones, and either can put the final together once both halves of the clue are said
// aloud. Pure: the table's state and every change to it, made inside a transaction (together.js), on the state as the
// database gives it back (tidy). tests/isomer.mjs plays it through the database's round trip.
import { PER_HINT } from "./isomer-engine.js";

export const APP = 1;
// The room's branch: { v: 1, kind: "pair", app, created, people (2), players, n (the game's number at this table),
// puzzle (makePuzzle's), owners (each jumble's seat), start (server time both were here, the team's clock from then),
// solved: { <item>: { by, at } }, hints: { s<seat>: n } (the jumbles' hinted letters, each phone its own), fh:
// { <final>: n } (a final's letters shown to both, first to last), done: { at, ms, score } }. Items are named w0…
// (the jumbles) and f0, f1 (the finals), never by number alone, which the database would read back as a list with holes.
export const isPair = g => g?.v === 1 && g.kind === "pair" && !!g.puzzle?.words;
export const itemKey = (p, i) => (i < p.words.length ? `w${i}` : `f${i - p.words.length}`);

/**
 * Each jumble's holder, shared out so each has as many, as long and as hard as the other: the words in order of length
 * and then depth, dealt to and fro (0, 1, 1, 0…), so of two five-letter words and two six-letter ones each holds one of
 * each length, and one of the two easier ones.
 */
export function ownersOf(p) {
  const order = p.words.map((_, i) => i).sort((a, b) => p.words[a].answer.length - p.words[b].answer.length || (p.words[a].depth || 0) - (p.words[b].depth || 0) || a - b);
  const owners = p.words.map(() => 0);
  order.forEach((i, k) => { owners[i] = [0, 1, 1, 0][k % 4]; });
  return owners;
}
/** A new table for the pair, with its first puzzle. */
export function freshPair(players, { puzzle, app = APP, now = Date.now() } = {}) {
  return { v: 1, kind: "pair", app, created: now, people: 2, players, n: 1, puzzle, owners: ownersOf(puzzle), start: null, solved: {}, hints: {}, fh: {}, done: null };
}
/** The table as the database gives it back, made whole (it keeps no empty objects, and lists may come back with holes). */
export function tidy(g) {
  const list = xs => (Array.isArray(xs) ? xs : Object.values(xs || {})).filter(x => x != null);
  const p = g.puzzle;
  p.words = list(p.words).map(w => ({ ...w, circles: list(w.circles) }));
  p.finals = list(p.finals).map(f => ({ ...f, parts: list(f.parts), halves: list(f.halves) }));
  p.tray = list(p.tray).map(t => list(t));
  const owners = list(g.owners);
  g.owners = owners.length === p.words.length ? owners : ownersOf(p);
  g.solved ||= {}; g.hints ||= {}; g.fh ||= {};
  g.start ??= null; g.done ??= null;
  return g;
}
const items = p => p.words.length + p.finals.length;
/** Whether everything is solved. */
export const allSolved = g => Array.from({ length: items(g.puzzle) }, (_, i) => itemKey(g.puzzle, i)).every(k => g.solved[k]);
/** The team's hinted letters: each phone's on its own jumbles, and the finals' shown to both. */
export const teamHints = g => Object.values(g.hints || {}).reduce((a, b) => a + (Number(b) || 0), 0) + Object.values(g.fh || {}).reduce((a, b) => a + (Number(b) || 0), 0);
/** The team's score at ms on the clock: the seconds and PER_HINT a hinted letter. */
export const teamScore = (g, ms) => Math.round(ms / 1000) + PER_HINT * teamHints(g);

// Every change is made only on game n, the one the player's screen showed: a tap the table has moved on from does nothing.
/** The clock starts once both are here (whoever sees it first). */
export function beginAt(g, { n, now }) {
  if (g.n !== n || g.start) return false;
  g.start = now;
  return true;
}
/**
 * Item i solved by the player in seat `slot`: a jumble only by its holder, a final by either. The last one done ends the
 * game: the team's time from the start and its score.
 */
export function solveAt(g, { n, i, slot, now }) {
  const p = g.puzzle, k = itemKey(p, i);
  if (g.n !== n || g.done || g.solved[k] || i >= items(p)) return false;
  if (i < p.words.length && g.owners[i] !== slot) return false;
  g.solved[k] = { by: slot, at: now };
  if (allSolved(g)) { const ms = Math.max(0, now - (g.start ?? g.created)); g.done = { at: now, ms, score: teamScore(g, ms) }; }
  return true;
}
/** A hinted letter: on one of your jumbles (counted to your seat), or a final's next letter, first to last, for both. */
export function hintAt(g, { n, i, slot }) {
  const p = g.puzzle;
  if (g.n !== n || g.done || g.solved[itemKey(p, i)]) return false;
  if (i < p.words.length) {
    if (g.owners[i] !== slot) return false;
    g.hints[`s${slot}`] = (g.hints[`s${slot}`] || 0) + 1;
    return true;
  }
  const f = `f${i - p.words.length}`, shown = g.fh[f] || 0;
  if (shown >= p.finals[i - p.words.length].answer.length - 1) return false;   // the last letter is the answer: solve it
  g.fh[f] = shown + 1;
  return true;
}
/** A new game at the table, unless one was dealt since game n. */
export function newGameAt(g, { n, puzzle }) {
  if (g.n !== n) return false;
  Object.assign(g, { n: n + 1, puzzle, owners: ownersOf(puzzle), start: null, solved: {}, hints: {}, fh: {}, done: null });
  return true;
}
/** A finished game as the pair's record keeps it: a team result, the score (lower is better). */
export function resultOf(g) {
  if (!isPair(g) || !g.done) return null;
  return { match: `${g.created}-${g.n}`, score: g.done.score, won: true, coop: true, lower: true };
}
/** What one seat sees of a final's clue: its own half, and that the other holds the rest. */
export const halfFor = (f, slot) => f.halves?.[slot % 2] || f.clue;
