// Order's cards and rules, pure (order.js draws them; tests/order.mjs runs them): the cards of each kind, a run's deal,
// where a card fits, a placement. And the table, when several play one run together (October 2026): one deck and one
// line for everyone at it, the team's lives, each card marked with who placed it, a tap made on a screen the table has
// moved on from turned down. The table's changes are made inside a transaction (together.js), on the state as the
// database gives it back (tidy).
import { QUOTES } from "./quote-bank.js";
import { SEQUENCES } from "./kb/items/sequences.js";

export const LIVES = 3, DATES_PER_RUN = 16, MOST = 6;     // MOST: the most at one table (a party's)
export const MODES = { dates: "Dates", quantities: "Quantities", stories: "History" };   // History: the stories, once called Stories
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the cards ----------
export const BY_ID = new Map(QUOTES.map(q => [q.id, q]));
export const DATES = QUOTES.filter(q => q.unit === "year").map(q => q.id);
// quantities: one family a run, a unit with enough cards to make a line
export const FAMILIES = Object.entries(QUOTES.filter(q => q.unit !== "year").reduce((f, q) => ((f[q.unit] ||= []).push(q.id), f), {}))
  .filter(([, ids]) => ids.length >= 6).map(([unit, ids]) => ({ unit, ids }));
// stories: each event a card whose truth is its place in the story
export const STORIES = new Map(SEQUENCES.map(s => [s.id, s]));
for (const s of SEQUENCES) s.steps.forEach((text, i) => BY_ID.set(`st:${s.id}:${i + 1}`, { id: `st:${s.id}:${i + 1}`, q: text, truth: i + 1, unit: s.unit, story: s.id }));

// ---------- a run ----------
/** The cards of a seed in a mode, the line starting with one face up. */
export function dealRun(mode, seed) {
  const r = rng(seed);
  let ids, unit = "year", story = null;
  if (mode === "dates") ids = shuffle(r, DATES).slice(0, DATES_PER_RUN);
  else if (mode === "stories") { const s = SEQUENCES[Math.floor(r() * SEQUENCES.length)]; story = s.id; unit = s.unit; ids = shuffle(r, s.steps.map((_, i) => `st:${s.id}:${i + 1}`)); }
  else { const fam = FAMILIES[Math.floor(r() * FAMILIES.length)]; unit = fam.unit; ids = shuffle(r, fam.ids); }
  return { seed, mode, unit, story, deck: ids.slice(1), line: [{ id: ids[0], ok: true }], lives: LIVES, placed: 0, over: false };
}
export const truth = id => BY_ID.get(id).truth;
/** Whether a card belongs in a slot of the line: its neighbours hold it (ties go either side). */
export const fits = (line, id, slot) => (slot === 0 || truth(line[slot - 1].id) <= truth(id)) && (slot === line.length || truth(id) <= truth(line[slot].id));
/**
 * Places the card in hand in a slot of the line (the run changes): a wrong place costs a life and the card goes where
 * it belongs, so the line is always right; the run is over when the lives or the deck run out. `mark` goes on the card
 * (who placed it). Returns { id, ok, at }: the card, whether it was right, and where it went.
 */
export function placeCard(run, slot, mark = {}) {
  const id = run.deck[0], ok = fits(run.line, id, slot);
  let at = slot;
  if (!ok) { at = run.line.findIndex(c => truth(c.id) > truth(id)); if (at < 0) at = run.line.length; run.lives--; }
  else run.placed++;
  run.line.splice(at, 0, { id, ok, ...mark });
  run.deck.shift();
  if (run.lives <= 0 || !run.deck.length) run.over = true;
  return { id, ok, at };
}

// ---------- the table: one run for everyone at it ----------
// The room's branch: { v: 2, app, created, people (the seats kept for people), players, n (the game's number at this
// table), run: a run as above, each card in its line marked by: the seat of whoever placed it (the first, dealt face
// up, by nobody) }.
const list = xs => Object.values(xs || {}).filter(x => x != null);   // a list as the database may give it back
export const isTable = g => g?.v === 2 && !!g.run?.line;
/** A new table with its first game. */
export function freshTable(players, { mode = "dates", seed, people = 2, app = 1, now = Date.now() } = {}) {
  return { v: 2, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, n: 1, run: dealRun(MODES[mode] ? mode : "dates", seed) };
}
/** The table as the database gives it back, made whole (it keeps no empty lists and no nulls); changes it, and returns it. */
export function tidy(g) {
  const run = g.run;
  run.deck = list(run.deck);
  run.line = list(run.line);
  run.story ??= null;
  run.placed ||= 0;
  run.lives ??= LIVES;
  run.over = !!run.over;
  return g;
}
/**
 * The card in hand placed by the player in seat `slot`, if the table is as their screen showed it: game n, card `id` in
 * hand, a line of `len` cards (the slot `at` is a gap in that line). The first tap counts: a tap from a screen the
 * table has moved on from (someone else's card went in first) is null, and changes nothing.
 */
export function placeAt(g, { n, id, len, at, slot }) {
  const run = g.run;
  if (g.n !== n || run.over || run.deck[0] !== id || run.line.length !== len || !(at >= 0 && at <= len)) return null;
  return placeCard(run, at, { by: slot });
}
/** A new game at the table, in a mode, unless one was dealt since game n (someone else's tap got there first). */
export function newGameAt(g, { n, mode, seed }) {
  if (g.n !== n) return false;
  g.n = n + 1;
  g.run = dealRun(MODES[mode] ? mode : "dates", seed);
  return true;
}
/** Each player's part in the run, by seat: { [slot]: { right, wrong } }. */
export function tallies(run) {
  const out = {};
  for (const c of run.line) if (c.by != null) { const t = out[c.by] ||= { right: 0, wrong: 0 }; if (c.ok) t.right++; else t.wrong++; }
  return out;
}
/** A finished game as the pair's record keeps it: a team result, the count placed (won: the whole deck, lives to spare). */
export const resultOf = g => (g?.run?.over ? { match: `${g.created}-${g.n}`, score: g.run.placed || 0, won: (g.run.lives || 0) > 0, coop: true } : null);
