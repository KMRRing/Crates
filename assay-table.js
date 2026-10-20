// Assay played as a team (README, Assay: together), pure: the table in the room's assay branch, every change made
// inside a transaction (together.js), so it's tested through the database's own round trip in tests/assay.mjs.
// One word and one board for the table; the players take turns to guess (whoever's turn it is, or anyone while that
// player is away, so a sleeping phone holds nobody up), and each sees only their part of the marks (assay-engine.js,
// roleOf): neither can finish alone.
// { v, app, created, people, players: { uid: { name, slot, pid, online, draft } }, asked, n (the game's number),
//   len, level, secret (the word, hidden), guesses: [{ w, by (a slot) }], turn (a slot), over: null, "won" or "lost" }
import { deal, hide, unhide, marksOf, guessesFor, HIT, roleOf } from "./assay-engine.js";

export const TEAM = 1;          // the table's version, its v
const players = t => Object.entries(t?.players || {}).filter(([, p]) => p && Number.isInteger(p.slot)).sort((a, b) => a[1].slot - b[1].slot);

/** A new table with its first word. */
export function freshTeam(seated, { app = 1, people = 2, len = 5, level = "medium", seed = 1, now = Date.now() } = {}) {
  const t = { v: TEAM, app, created: now, people: Math.min(6, Math.max(2, Number(people) || 2)), players: seated, n: 0 };
  return dealAt(t, { len, level, seed });
}
export const isTeam = t => t?.v === TEAM && typeof t.secret === "string" && Number.isInteger(t.n);
/** The table made whole again: the database keeps no empty lists. */
export function tidy(t) {
  t.guesses = Object.values(t.guesses || {}).filter(x => x && typeof x.w === "string");
  t.over ??= null;
  return t;
}
/** A new word at the table: the next game, the turn with whoever comes after the last game's first guesser. */
export function dealAt(t, { len = t.len || 5, level = t.level || "medium", seed = 1 } = {}) {
  t.n = (t.n || 0) + 1;
  t.len = len; t.level = level;
  t.secret = hide(deal({ len, level, seed })[0]);
  t.guesses = [];
  t.over = null;
  const slots = players(t).map(([, p]) => p.slot);
  t.turn = slots.length ? slots[(t.n - 1) % slots.length] : 0;
  return t;
}
export const wordOf = t => unhide(t.secret);
export const limitOfTable = t => guessesFor(t.len, 1);
/** The rows: { guess, marks, by }. */
export const rowsOfTable = t => (t.guesses || []).map(({ w, by }) => ({ guess: w, marks: marksOf(w, wordOf(t)), by }));
/** The seat after `slot` among those seated. */
function after(t, slot) {
  const slots = players(t).map(([, p]) => p.slot);
  if (!slots.length) return slot;
  return slots.find(s => s > slot) ?? slots[0];
}
/**
 * A guess, in a transaction: played only if the table is as the guessing phone showed it (game n with k guesses) and
 * it's that player's turn (or `anyone`: the player whose turn it is is away). Returns why not, or "ok".
 */
export function guessAt(t, { n, k, slot, w, anyone = false }) {
  tidy(t);
  if (t.n !== n || t.guesses.length !== k) return "moved";
  if (t.over) return "over";
  if (t.turn !== slot && !anyone) return "turn";
  t.guesses.push({ w, by: slot });
  if (marksOf(w, wordOf(t)).every(m => m === HIT)) t.over = "won";
  else if (t.guesses.length >= limitOfTable(t)) t.over = "lost";
  t.turn = after(t, slot);
  return "ok";
}
/** What a seat sees: HIT, NEAR or GREY (assay-engine.js, roleOf), the roles going round with each new word. */
export const roleAt = (t, slot) => roleOf(slot, t.people || 2, t.n - 1);
/** The game as one player saw it, once it's over, for the pair's record: a team result, the guesses (fewer better). */
export function resultOf(t) {
  if (!t?.over) return null;
  return { match: `${t.created}-${t.n}`, score: t.over === "won" ? t.guesses.length : limitOfTable(t) + 1, won: t.over === "won", coop: true, lower: true };
}
