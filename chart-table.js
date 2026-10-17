// Chart at a table of two to six (October 2026), the pure part (tests/chart.mjs); chart.js draws it. Everyone pins the
// same place on their own phone, seeing only their own pin. The reveal comes once everyone at the table has pinned:
// every pin, each one's distance and points, and the standings. The table moves on once everyone at the table has
// pressed Next. People away (another game open, the phone asleep) never hold it up, and nor does someone slow: once
// those who have pinned are at least as many as those still to, and half a minute has passed since the last pin, any
// of them may reveal without the rest (a missing pin scores nothing); Next the same way.
//
// The table's state, in the room's branch (together.js):
//   { v: 2, app, created, people (seats for people), players, seed, region, set: [ids], index, phase: "pin" |
//     "reveal", pins: { s<slot>: { lat, lon, at } }, clues: { s<slot>: n }, nexts: { s<slot>: at },
//     log: { q<index>: { id, at, res: { s<slot>: { lat, lon, km, pts, clues?, near? } } } }, done }
// Everything a player does is kept by their seat (s0, s1…) and the log by the question (q0, q1…), never in a list by
// number: the database reads a list back with holes where a seat or a question had nothing.
import { pointsFor, clueFactor, nearestOnFeature, distance } from "./chart-engine.js";
import { seated } from "./duel-core.js";

export const V = 2;
export const MOST = 6;                      // a party's table, at most
export const GRACE = 30000;                 // ms after the last pin (or Next) before the rest may be left out

export const keyOf = slot => `s${slot}`;
/** The seats a table keeps for people: as many as the request said (a party's), two for a pair's. */
export const peopleFor = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
export const isTable = g => g?.v === V && Array.isArray(g.set);

/** How far a pin is from a place: to the point for a place, to the nearest point of the feature for a river, range or
 *  country's outline (zero inside one). { km, point }. */
export const missOf = (pin, place) => (place.geo ? nearestOnFeature(pin, place.geo) : { km: distance(pin, place), point: { lat: place.lat, lon: place.lon } });

/** A new table: its first set, dealt by whoever sits down first (from their mix of topics: the set is what's shared). */
export function freshTable(players, { people = 2, seed, region = "world", set, now = Date.now() }) {
  return { v: V, created: now, people, players, seed, region, set, index: 0, phase: "pin", done: false };
}
/** A fresh set at the same table (Play again, a new region): everyone's totals start again. A table from before the
 *  mix of topics kept the topic it dealt from too; it goes, with the old set. */
export function newSet(g, { seed, region, set }) {
  Object.assign(g, { seed, region, set, index: 0, phase: "pin", done: false });
  for (const k of ["pins", "clues", "nexts", "log", "topic"]) delete g[k];
  return true;
}

// ---------- who's done what ----------
/** What each seat has done in this phase: its pin while pinning, its Next at the reveal. */
const marksOf = g => (g.phase === "pin" ? g.pins : g.nexts) || {};
const timeOf = m => (typeof m === "number" ? m : Number(m?.at) || 0);
/** The seats at the table (present: presentSlots in duel-core.js) still to pin, or to press Next; none once it's over. */
export function waitingFor(g, present) {
  if (g.done && g.phase === "reveal") return [];
  const marks = marksOf(g);
  return present.filter(s => !marks[keyOf(s)]);
}
/**
 * When those still to pin (or to press Next) may be left out: half a minute after the last one in, once those in are at
 * least as many as those still to; null while they may not, or while nobody's still to.
 */
export function graceAt(g, present) {
  const marks = marksOf(g), waiting = waitingFor(g, present), acted = present.filter(s => marks[keyOf(s)]);
  if (!waiting.length || !acted.length || acted.length < waiting.length) return null;
  return Math.max(...Object.values(marks).map(timeOf)) + GRACE;
}

// ---------- the moves, each inside a transaction: false leaves the table as it is ----------
/** A clue taken (the nth on this place): it discounts only its taker's points. */
export function clueIn(g, slot, n, max) {
  const k = keyOf(slot);
  if (slot == null || g.phase !== "pin" || g.pins?.[k] || n < 1 || n > max || n <= (Number(g.clues?.[k]) || 0)) return false;
  g.clues = { ...(g.clues || {}), [k]: n };
  return true;
}
/**
 * A pin in, for the place the page showed (at: { seed, index }, so a pin sent as the table moved on counts for nothing);
 * the reveal follows once nobody at the table is still to pin. placeOf(id): the place, to settle it.
 */
export function pinIn(g, slot, pin, at, present, now, placeOf) {
  const k = keyOf(slot);
  if (slot == null || g.phase !== "pin" || g.seed !== at.seed || g.index !== at.index || g.pins?.[k]) return false;
  g.pins = { ...(g.pins || {}), [k]: { lat: pin.lat, lon: pin.lon, at: now } };
  if (!waitingFor(g, present).length) reveal(g, placeOf(g.set[g.index]), now);
  return true;
}
/** The reveal without those still to pin, once their grace is up. */
export function revealNow(g, present, now, placeOf) {
  if (g.phase !== "pin" || !Object.keys(g.pins || {}).length) return false;
  const at = graceAt(g, present);
  if (waitingFor(g, present).length && (at == null || now < at)) return false;
  reveal(g, placeOf(g.set[g.index]), now);
  return true;
}
/** Every pin settled: each one's distance and points (their own clues' discount), into the log; the set is done with
 *  its last place. */
export function reveal(g, place, now) {
  const res = {};
  for (const [k, pin] of Object.entries(g.pins || {})) {
    if (!/^s\d$/.test(k) || pin?.lat == null) continue;
    const clues = Number(g.clues?.[k]) || 0, m = missOf(pin, place), km = Number.isFinite(m.km) ? Math.round(m.km * 10) / 10 : 20000;
    res[k] = { lat: pin.lat, lon: pin.lon, km, pts: Math.round(pointsFor(place, m.km) * clueFactor(clues)), ...(clues ? { clues } : {}),
      ...(place.geo && Number.isFinite(m.km) ? { near: { lat: m.point.lat, lon: m.point.lon } } : {}) };
  }
  g.log = { ...(g.log || {}), [`q${g.index}`]: { id: place.id, at: now, res } };
  delete g.pins; delete g.clues; delete g.nexts;
  g.phase = "reveal";
  if (g.index + 1 >= g.set.length) g.done = true;
  return true;
}
/** Next pressed: the table moves on once nobody at the table is still to press it. */
export function nextIn(g, slot, at, present, now) {
  const k = keyOf(slot);
  if (slot == null || g.phase !== "reveal" || g.done || g.seed !== at.seed || g.index !== at.index || g.nexts?.[k]) return false;
  g.nexts = { ...(g.nexts || {}), [k]: now };
  if (!waitingFor(g, present).length) moveOn(g);
  return true;
}
/** On without those still to press Next, once their grace is up. */
export function moveOnNow(g, present, now) {
  if (g.phase !== "reveal" || g.done) return false;
  const at = graceAt(g, present);
  if (waitingFor(g, present).length && (at == null || now < at)) return false;
  moveOn(g);
  return true;
}
function moveOn(g) {
  g.index++;
  g.phase = "pin";
  delete g.pins; delete g.clues; delete g.nexts;
}
/**
 * What the table owes itself as people come and go: the reveal once everyone still at the table has pinned, the next
 * place once everyone still here has pressed Next. False when there's nothing to do.
 */
export function settleUp(g, present, now, placeOf) {
  if (waitingFor(g, present).length) return false;
  if (g.phase === "pin" && Object.keys(g.pins || {}).length) return reveal(g, placeOf(g.set[g.index]), now);
  if (g.phase === "reveal" && !g.done && Object.keys(g.nexts || {}).length) { moveOn(g); return true; }
  return false;
}

// ---------- what the reveal and the standings show ----------
export const entryAt = (g, i) => g?.log?.[`q${i}`] || null;
/** Each seat's total over the set so far: { s<slot>: points }. */
export function totals(g) {
  const t = {};
  for (const e of Object.values(g?.log || {})) for (const [k, r] of Object.entries(e?.res || {})) t[k] = (t[k] || 0) + (Number(r?.pts) || 0);
  return t;
}
/**
 * A place's results, in the reveal's order: the most points first, then the nearer, then by seat; anyone seated
 * without a pin last, with nothing. [{ uid, slot, name, km, pts, clues, pin, near, none }]
 */
export function placeRows(g, i) {
  const e = entryAt(g, i);
  return seated(g).map(([uid, p]) => {
    const r = e?.res?.[keyOf(p.slot)];
    return r ? { uid, slot: p.slot, name: p.name || "Player", km: Number(r.km) || 0, pts: Number(r.pts) || 0, clues: Number(r.clues) || 0, pin: { lat: r.lat, lon: r.lon }, near: r.near || null }
      : { uid, slot: p.slot, name: p.name || "Player", pts: 0, none: true };
  }).sort((a, b) => (b.pts - a.pts) || ((a.none ? Infinity : a.km) - (b.none ? Infinity : b.km)) || (a.slot - b.slot));
}
/** The standings after place i, for standings.js: [{ slot, name, value (the total), delta (place i's points) }]. */
export function standingRows(g, i = null) {
  const t = totals(g), e = i == null ? null : entryAt(g, i);
  return seated(g).map(([uid, p]) => ({ uid, slot: p.slot, name: p.name || "Player", value: t[keyOf(p.slot)] || 0,
    ...(e ? { delta: Number(e.res?.[keyOf(p.slot)]?.pts) || 0 } : {}) }));
}
/** The set as one player saw it, once it's over, for the pair's record: { match, score, won (alone at the top) }. */
export function resultOf(g, slot) {
  if (!isTable(g) || !g.done || slot == null) return null;
  const t = totals(g), mine = t[keyOf(slot)] || 0, all = seated(g).map(([, p]) => t[keyOf(p.slot)] || 0);
  const best = Math.max(mine, ...all);
  return { match: `${g.seed}-${g.created || ""}`, score: mine, won: mine === best && all.filter(v => v === best).length === 1 };
}
/** Short labels for the pins, in seat order: initials, two letters where two share one, then a number. */
export function initials(names) {
  const first = names.map(n => String(n || "?").trim() || "?");
  const one = first.map(n => n[0].toUpperCase());
  const two = first.map((n, i) => (one.filter(x => x === one[i]).length > 1 ? n[0].toUpperCase() + (n[1] || "").toLowerCase() : one[i]));
  return two.map((x, i) => (two.filter(y => y === x).length > 1 ? `${x[0]}${i + 1}` : x));
}
