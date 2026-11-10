// Order's cards and rules, pure (order.js draws them; tests/order.mjs runs them): the cards of each kind, a run's deal,
// where a card fits, a placement; higher or lower (November 2026), its chain of cards and the tap on one. And the table,
// when several play one run together (October 2026): one deck and one line for everyone at it, the team's lives, each
// card marked with who placed it, a tap made on a screen the table has moved on from turned down. The table's changes
// are made inside a transaction (together.js), on the state as the database gives it back (tidy).
import { QUOTES } from "./quote-bank.js";
import { TOPICS } from "./quote-engine.js";
import { drawWeighted } from "./topics.js";
import { SEQUENCES } from "./order-bank.js";
import { DIMENSIONS, dimensionOf, sizeOf } from "./kb/units.js";

export const LIVES = 3, DATES_PER_RUN = 16, MOST = 6;     // MOST: the most at one table (a party's)
export const FEWEST = 8;          // a mix of topics with fewer dated cards than this deals from every topic instead
export const MODES = { dates: "Dates", quantities: "Quantities", stories: "History" };   // History: the stories, once called Stories
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the cards ----------
export const BY_ID = new Map(QUOTES.map(q => [q.id, q]));
export const DATES = QUOTES.filter(q => q.unit === "year").map(q => q.id);
// quantities: one family a run, the cards of one dimension with enough of them to make a line (kb/units.js: a hectare and a
// square kilometre are areas, so they share a line, each card in its own unit; a unit nothing else shares is its own family).
// `unit` is the family's name as a run keeps it: the dimension, or the unit when it stands alone.
export const FAMILIES = Object.values(QUOTES.filter(q => q.unit !== "year").reduce((f, q) => {
  const unit = dimensionOf(q.unit), fam = (f[unit] ||= { unit, ids: [], units: [] });
  fam.ids.push(q.id);
  if (!fam.units.includes(q.unit)) fam.units.push(q.unit);
  return f;
}, {})).filter(f => f.ids.length >= 6).map(f => ({ ...f, mixed: f.units.length > 1, label: f.units.length > 1 ? DIMENSIONS[f.unit]?.label || f.unit : f.unit }));
/** A run's family by the name it keeps; a run saved before the dimensions (one unit, say metres) still reads. */
export const familyOf = unit => FAMILIES.find(f => f.unit === unit || f.units.includes(unit)) || { unit, ids: [], units: [unit], mixed: false, label: unit };
/** Your best in a family: the keys it was kept under before the units were put together count too. */
export const bestIn = (best, fam) => Math.max(0, best[`q:${fam.unit}`] ?? 0, ...fam.units.map(u => best[`q:${u}`] ?? 0));
// stories: each event a card whose truth is its place in the story
export const STORIES = new Map(SEQUENCES.map(s => [s.id, s]));
for (const s of SEQUENCES) s.steps.forEach((text, i) => BY_ID.set(`st:${s.id}:${i + 1}`, { id: `st:${s.id}:${i + 1}`, q: text, truth: i + 1, unit: s.unit, story: s.id, facts: [`story-${s.id}~${i + 1}`] }));

// ---------- topics ----------
// A card's topic is its question's category in Quote's bank (a painting's year is Art, OPEC's founding Trade), and a run
// of dates or quantities deals from a mix of them, each out, in or more (twice as likely as in), as Quote's sets do.
// The stories have no topics: History deals one of them.
const topicOf = id => BY_ID.get(id).cat;
/** The topics a mode's cards are in, in the bank's order (none for the stories). */
export const topicsIn = mode => {
  const ids = mode === "dates" ? DATES : mode === "quantities" ? FAMILIES.flatMap(f => f.ids) : [];
  const cats = new Set(ids.map(topicOf));
  return TOPICS.filter(([id]) => cats.has(id));
};
/** Whether a mix weighs a mode's topics alike (every one in): the run is dealt as it always was. */
const even = (mode, weights) => !weights || topicsIn(mode).every(([id]) => (weights[id] ?? 1) === 1);

// ---------- a run ----------
/**
 * The cards of a seed in a mode, the line starting with one face up. Dates: sixteen cards, each drawn by its topic's
 * weight; quantities: one family, drawn by its cards' mean weight, its cards in the topics in (a family needs six). A mix
 * that leaves too few cards deals from every topic instead, and says so (wide).
 *
 * `seen` (a Set of card ids, for a run played alone; a daily or a table's deal passes none, so everyone gets the same
 * cards from the seed) is what you've already been dealt: a deal takes cards you haven't seen before any you have, so the
 * same few don't come round while hundreds wait. A deal that has to reach back into the seen ones says `recycled`, and the
 * page lets them go (cards are forgotten when too few are left to deal from, not on a clock).
 */
export function dealRun(mode, seed, weights = null, seen = null, daily = false, prefer = []) {
  const DATES_ = DATES, FAMILIES_ = FAMILIES.filter(f => f.ids.length >= 6);
  const r = rng(seed), w = id => weights?.[topicOf(id)] ?? 1;
  const isNew = id => !seen?.has(id), newFirst = xs => (seen ? [...xs.filter(isNew), ...xs.filter(id => !isNew(id))] : xs);
  let ids, unit = "year", story = null, wide = false, recycled = false;
  if (mode === "dates") {
    const pool = even(mode, weights) ? [] : DATES_.filter(id => w(id) > 0), want = Math.min(DATES_PER_RUN, pool.length);
    if (pool.length >= FEWEST) {
      ids = drawWeighted(r, pool.filter(isNew), w, DATES_PER_RUN);
      if (seen && ids.length < want) { recycled = true; ids.push(...drawWeighted(r, pool.filter(id => !isNew(id)), w, DATES_PER_RUN - ids.length)); }
    } else { wide = !even(mode, weights); ids = newFirst(shuffle(r, DATES_)).slice(0, DATES_PER_RUN); recycled = ids.some(id => !isNew(id)); }
  } else if (mode === "stories") { const s = SEQUENCES[Math.floor(r() * SEQUENCES.length)]; story = s.id; unit = s.unit; ids = shuffle(r, s.steps.map((_, i) => `st:${s.id}:${i + 1}`)); }
  else {
    const mixed = even(mode, weights) ? [] : FAMILIES_.map(f => ({ ...f, ids: f.ids.filter(id => w(id) > 0) })).filter(f => f.ids.length >= 6);
    // a family is as likely as the share of its cards you haven't seen (times its topics' weight); with none unseen anywhere
    // the share doesn't count
    const fresh = f => f.ids.filter(isNew).length;
    const share = (f, among) => (seen && among.some(g => fresh(g) > 0) ? fresh(f) / f.ids.length : 1);
    const mean = f => f.ids.reduce((a, id) => a + w(id), 0) / f.ids.length * share(f, mixed);
    const fam = mixed.length ? drawWeighted(r, mixed, mean, 1)[0]
      : seen ? drawWeighted(r, FAMILIES_, f => share(f, FAMILIES_), 1)[0] : FAMILIES_[Math.floor(r() * FAMILIES_.length)];
    wide = !mixed.length && !even(mode, weights);
    unit = fam.unit; ids = newFirst(shuffle(r, fam.ids));
    recycled = fresh(fam) < Math.min(fam.ids.length, DATES_PER_RUN);      // a run is rarely longer than that
  }
  // the cards the learning mode has due (`prefer`; none in a daily or a story) lead, up to a quarter of a run
  if (prefer.length && !daily && mode !== "stories") { const lead = prefer.filter(id => ids.includes(id) || (mode === "dates" ? DATES_.includes(id) : familyOf(unit)?.ids.includes(id))).slice(0, Math.ceil(DATES_PER_RUN / 4)); ids = [...lead, ...ids.filter(id => !lead.includes(id))]; if (mode === "dates") ids = ids.slice(0, DATES_PER_RUN); }
  return { seed, mode, unit, story, deck: ids.slice(1), line: [{ id: ids[0], ok: true }], lives: LIVES, placed: 0, over: false, ...(wide ? { wide } : {}), ...(recycled && seen ? { recycled } : {}) };
}
export const truth = id => BY_ID.get(id).truth;
/** What a card is worth in the line: its truth, in its dimension's base where the unit is one of several (a story's place
 *  and a year are their truth). A line is in order of this. */
export const size = id => { const q = BY_ID.get(id); return q.story ? q.truth : sizeOf(q.truth, q.unit); };
// Two quantities within a hundredth of each other are the same size to anyone (the sources round differently: Egypt's 116.5
// million and the Philippines' 115.8), so a card goes either side of its neighbour then. Years and stories are exact.
const NEAR = 1.01;
const notAbove = (a, b) => size(a) <= size(b) || (!BY_ID.get(a).story && BY_ID.get(a).unit !== "year" && size(a) <= size(b) * NEAR);
/** Whether a card belongs in a slot of the line: its neighbours hold it (ties go either side). */
export const fits = (line, id, slot) => (slot === 0 || notAbove(line[slot - 1].id, id)) && (slot === line.length || notAbove(id, line[slot].id));
/**
 * Places the card in hand in a slot of the line (the run changes): a wrong place costs a life and the card goes where
 * it belongs, so the line is always right; the run is over when the lives or the deck run out. `mark` goes on the card
 * (who placed it). Returns { id, ok, at }: the card, whether it was right, and where it went.
 */
export function placeCard(run, slot, mark = {}) {
  const id = run.deck[0], ok = fits(run.line, id, slot);
  let at = slot;
  if (!ok) { at = run.line.findIndex(c => size(c.id) > size(id)); if (at < 0) at = run.line.length; run.lives--; }
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
export function freshTable(players, { mode = "dates", seed, people = 2, app = 1, now = Date.now(), weights = null } = {}) {
  return { v: 2, app, created: now, people: Math.min(MOST, Math.max(2, Number(people) || 2)), players, n: 1, run: dealRun(MODES[mode] ? mode : "dates", seed, weights) };
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
/** A new game at the table, in a mode and a mix of topics (the dealer's), unless one was dealt since game n (someone
 *  else's tap got there first). */
export function newGameAt(g, { n, mode, seed, weights = null }) {
  if (g.n !== n) return false;
  g.n = n + 1;
  g.run = dealRun(MODES[mode] ? mode : "dates", seed, weights);
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
