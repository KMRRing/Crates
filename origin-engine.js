// Origin's countries, clues and scoring, pure (origin.js draws them and the map; tests/origin.mjs runs them): which
// countries can be the answer, each one's clues for a deal, a run of five, a guess, another clue, giving up, the next
// country. And the table, when several play one run together (October 2026): the same five countries for everyone at
// it, the clues, the guesses and the score shared, each guess marked with who made it, and a tap made on a screen the
// table has moved on from turned down. The table's changes are made inside a transaction (together.js), on the state
// as the database gives it back (tidy).
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { COUNTRIES } from "./chart-countries.js";

export const PER_RUN = 5, FULL = 100, PER_CLUE = 10, PER_GUESS = 5, LEAST = 5, MAX_CLUES = 12, MOST = 6;   // MOST: the most at one table
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the countries and their clues ----------
const NAME = new Map(ENTITIES.map(e => [e.id, e.name]));
export const PLACE = new Map(COUNTRIES.map(c => [c.about || c.id, c]));
export const ALIASES = new Map(ENTITIES.map(e => [e.id, [e.name, ...(e.aliases || [])].map(s => s.toLowerCase())]));
// trade and commodities first, as in the guessing game: the aspects of a clue that are about what a country makes,
// sells and moves
const TRADE = new Set(["nrg", "met", "agr", "mkt", "mkts", "trade", "co", "firm", "fin", "prod", "logi", "uses", "spec", "orig"]);
// a clue gives the country away if it names the country or a place in it ("a Ponzi scheme in Gdańsk")
const INSIDE = new Map();
for (const l of LINKS) if (l.rel === "in" && PLACE.has(l.to) && NAME.has(l.from)) {
  if (!INSIDE.has(l.to)) INSIDE.set(l.to, []);
  INSIDE.get(l.to).push(NAME.get(l.from).toLowerCase());
}
const CLUES = new Map();
for (const l of LINKS) {
  if (!["clue", "link"].includes(l.rel) || !l.hint || !PLACE.has(l.to) || !NAME.has(l.from)) continue;   // a clue, or a plain link with a reason
  const names = [...ALIASES.get(l.to), ...(INSIDE.get(l.to) || [])], said = `${NAME.get(l.from)} ${l.hint || ""}`.toLowerCase();
  if (names.some(n => n.length > 3 && said.includes(n))) continue;
  if (!CLUES.has(l.to)) CLUES.set(l.to, []);
  CLUES.get(l.to).push({ name: NAME.get(l.from), hint: l.hint || "", d: l.d || 2, trade: (l.aspects || []).some(a => TRADE.has(a)) });
}
export const ANSWERS = [...CLUES.keys()].filter(id => CLUES.get(id).length >= 6).sort();
/** A country's clues for this deal: the most obscure first (difficulty 3 before 2 before 1), trade ahead within each. */
function cluesFor(id, r) {
  const all = shuffle(r, CLUES.get(id));
  return all.sort((a, b) => b.d - a.d || Number(b.trade) - Number(a.trade)).slice(0, MAX_CLUES);
}
// any country on the map can be guessed, by its name or another of its names
export const GUESSABLE = new Map();
for (const c of COUNTRIES) for (const n of [c.name, ...(ALIASES.get(c.about || c.id) || [])]) GUESSABLE.set(n.toLowerCase(), c.about || c.id);

// ---------- a run ----------
/** The five countries of a seed, each with its clues for this deal. */
export function dealRun(seed) {
  const r = rng(seed), picks = shuffle(r, ANSWERS).slice(0, PER_RUN);
  return { seed, index: 0, total: 0, rounds: picks.map(id => ({ id, clues: cluesFor(id, r), shown: 1, guesses: [], done: null, points: 0 })) };
}
/** What the country scores if found now: 100, less 10 a clue after the first and 5 a wrong guess, at least 5. */
export const pointsNow = R => Math.max(LEAST, FULL - PER_CLUE * (R.shown - 1) - PER_GUESS * R.guesses.length);
/**
 * A guess at the run's country (the run changes): "found", "wrong" (which turns up the next clue), "again" (guessed
 * already), or "decided" (found or given up already). `by`, a seat at a table, is kept with the guess.
 */
export function guessIn(run, id, by = null) {
  const R = run.rounds[run.index];
  if (R.done) return "decided";
  if (R.guesses.includes(id)) return "again";
  if (id === R.id) { R.done = "found"; R.points = pointsNow(R); run.total += R.points; if (by != null) R.doneBy = by; return "found"; }
  R.guesses.push(id);
  if (by != null) (R.guessedBy ||= []).push(by);
  if (R.shown < R.clues.length) R.shown++;
  return "wrong";
}
/** Another clue for the run's country, while there's one to turn up: whether it did. */
export function clueIn(run) {
  const R = run.rounds[run.index];
  if (R.done || R.shown >= R.clues.length) return false;
  R.shown++;
  return true;
}
/** Giving up on the run's country: it scores nothing. */
export function giveUpIn(run, by = null) {
  const R = run.rounds[run.index];
  if (R.done) return false;
  R.done = "gave up"; R.points = 0;
  if (by != null) R.doneBy = by;
  return true;
}
/** On to the next country; after the last, the run is over. */
export function nextIn(run) {
  if (run.index + 1 < run.rounds.length) run.index++;
  else run.over = true;
}
/** Whether every country is decided: the run's total is final. */
export const decided = run => run.rounds.every(R => R.done);

// ---------- the table: one run for everyone at it ----------
// The room's branch: { v: 2, app, created, people (the seats kept for people), players, n (the game's number at this
// table), run: a run as above, each round's wrong guesses with guessedBy beside them (the seat of whoever made each)
// and doneBy (who found it, or gave up) }.
const list = xs => Object.values(xs || {}).filter(x => x != null);   // a list as the database may give it back
export const isTable = g => g?.v === 2 && !!g.run?.rounds;
/** A new table with its first game. */
export function freshTable(players, { seed, people = 2, app = 1, now = Date.now() } = {}) {
  return { v: 2, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, n: 1, run: dealRun(seed) };
}
/** The table as the database gives it back, made whole (it keeps no empty lists and no nulls); changes it, and returns it. */
export function tidy(g) {
  const run = g.run;
  run.index ||= 0;
  run.total ||= 0;
  run.over = !!run.over;
  run.rounds = list(run.rounds).map(R => ({ ...R, clues: list(R.clues), shown: R.shown || 1, guesses: list(R.guesses), guessedBy: list(R.guessedBy), done: R.done || null, points: R.points || 0 }));
  return g;
}
// Each change is made only if the table is as the player's screen showed it: game n, country `index` (and for another
// clue, the clues showing): two phones tapping at once change it once, and a tap the table has moved on from does nothing.
const on = (g, n, index) => g.n === n && !g.run.over && g.run.index === index;
/** A guess by the player in seat `slot`: its outcome (guessIn), or "moved" when the table had moved on to another country or game. */
export function guessAt(g, { n, index, id, slot }) {
  return on(g, n, index) ? guessIn(g.run, id, slot) : "moved";
}
/** Another clue, if the country still shows the `shown` clues the player saw (two at once turn up one, not two). */
export function clueAt(g, { n, index, shown }) {
  return on(g, n, index) && g.run.rounds[index].shown === shown && clueIn(g.run);
}
/** Giving up on the country, by the player in seat `slot`. */
export function giveUpAt(g, { n, index, slot }) {
  return on(g, n, index) && giveUpIn(g.run, slot);
}
/** On to the next country (or the end), once this one is decided. */
export function nextAt(g, { n, index }) {
  if (!on(g, n, index) || !g.run.rounds[index].done) return false;
  nextIn(g.run);
  return true;
}
/** A new game at the table, unless one was dealt since game n. */
export function newGameAt(g, { n, seed }) {
  if (g.n !== n) return false;
  g.n = n + 1;
  g.run = dealRun(seed);
  return true;
}
/** A finished game as the pair's record keeps it, the moment the last country is decided: a team result, the total
 *  (won: all five found). */
export function resultOf(g) {
  const run = g?.run;
  if (!run?.rounds || !list(run.rounds).every(R => R?.done)) return null;
  return { match: `${g.created}-${g.n}`, score: run.total || 0, won: list(run.rounds).every(R => R.done === "found"), coop: true };
}
