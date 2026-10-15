// Quote at a table of two to six (October 2026), the pure part (tests/quote.mjs); quote.js draws it. Two ways to play:
// - Ranges, the default and the only one for three or more: everyone makes their own market (bid–ask) on the same
//   question on their own phone, scored exactly as a market alone is (settle in quote-engine.js). The reveal comes once
//   everyone at the table has quoted: every market against the truth, each one's points and the standings. The table
//   moves on once everyone at it has pressed Next. People away never hold it up, nor does someone slow: once those who
//   have quoted are at least as many as those still to, and half a minute has passed since the last quote, any of them
//   may reveal without the rest (a missing market scores nothing); Next the same way.
// - Trade, for a pair: one makes a market, the other hits the bid, lifts the offer or passes (trade in
//   quote-engine.js), the maker alternating; either one's Next moves both on.
//
// The table's state, in the room's branch (together.js):
//   { v: 2, app, created, people (seats for people), players, mode: "ranges" | "trade", seed, set: [ids], index, done,
//     ranges: phase "quote" | "reveal", quotes: { s<slot>: { bid, ask, at } }, nexts: { s<slot>: at },
//             log: { q<index>: { id, at, res: { s<slot>: { bid, ask, delta, inside, grade } } } }
//     trade:  phase "make" | "take" | "reveal", market: { bid, ask }, log: { q<index>: { id, bid, ask, take, maker,
//             taker, deltaMaker, deltaTaker, inside, edge } } }
// Everything a player does is kept by their seat (s0, s1…) and the log by the question (q0, q1…), never in a list by
// number: the database reads a list back with holes where a seat or a question had nothing.
import { START, settle, trade } from "./quote-engine.js";
import { seated } from "./duel-core.js";

export const V = 2;
export const MOST = 6;                      // a party's table, at most
export const GRACE = 30000;                 // ms after the last quote (or Next) before the rest may be left out
export const MODES = ["ranges", "trade"];

export const keyOf = slot => `s${slot}`;
/** The seats a table keeps for people: as many as the request said (a party's), two for a pair's. */
export const peopleFor = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
export const isTable = g => g?.v === V && Array.isArray(g.set) && MODES.includes(g.mode);
/** The way a table plays: Trade only for a pair, Ranges otherwise. */
export const modeFor = (people, mode) => (people === 2 && mode === "trade" ? "trade" : "ranges");
/** The phase a question opens on. */
const opening = mode => (mode === "trade" ? "make" : "quote");

/** A new table: its first set, dealt by whoever sits down first. */
export function freshTable(players, { people = 2, mode = "ranges", seed, set, now = Date.now() }) {
  const m = modeFor(people, mode);
  return { v: V, created: now, people, players, mode: m, seed, set, index: 0, phase: opening(m), done: false };
}
/** A fresh set at the same table (Play again, the other way to play): everyone's book starts again. */
export function newSet(g, { seed, set, mode = g.mode }) {
  const m = modeFor(g.people || 2, mode);
  Object.assign(g, { mode: m, seed, set, index: 0, phase: opening(m), done: false });
  for (const k of ["quotes", "nexts", "log", "market", "take", "books"]) delete g[k];
  return true;
}

// ---------- who's done what (ranges) ----------
const marksOf = g => (g.phase === "quote" ? g.quotes : g.nexts) || {};
const timeOf = m => (typeof m === "number" ? m : Number(m?.at) || 0);
/** The seats at the table (present: presentSlots in duel-core.js) still to quote, or to press Next; none once it's over. */
export function waitingFor(g, present) {
  if (g.mode !== "ranges" || (g.done && g.phase === "reveal")) return [];
  const marks = marksOf(g);
  return present.filter(s => !marks[keyOf(s)]);
}
/**
 * When those still to quote (or to press Next) may be left out: half a minute after the last one in, once those in are
 * at least as many as those still to; null while they may not, or while nobody's still to.
 */
export function graceAt(g, present) {
  const marks = marksOf(g), waiting = waitingFor(g, present), acted = present.filter(s => marks[keyOf(s)]);
  if (!waiting.length || !acted.length || acted.length < waiting.length) return null;
  return Math.max(...Object.values(marks).map(timeOf)) + GRACE;
}

// ---------- ranges: the moves, each inside a transaction (false leaves the table as it is) ----------
/**
 * A market in, for the question the page showed (at: { seed, index }, so one sent as the table moved on counts for
 * nothing); the reveal follows once nobody at the table is still to quote. questionOf(id): the question, to settle it.
 */
export function quoteIn(g, slot, market, at, present, now, questionOf) {
  const k = keyOf(slot);
  if (slot == null || g.mode !== "ranges" || g.phase !== "quote" || g.seed !== at.seed || g.index !== at.index || g.quotes?.[k]) return false;
  if (!Number.isFinite(market.bid) || !Number.isFinite(market.ask) || market.ask < market.bid) return false;
  g.quotes = { ...(g.quotes || {}), [k]: { bid: market.bid, ask: market.ask, at: now } };
  if (!waitingFor(g, present).length) reveal(g, questionOf(g.set[g.index]), now);
  return true;
}
/** The reveal without those still to quote, once their grace is up. */
export function revealNow(g, present, now, questionOf) {
  if (g.mode !== "ranges" || g.phase !== "quote" || !Object.keys(g.quotes || {}).length) return false;
  const at = graceAt(g, present);
  if (waitingFor(g, present).length && (at == null || now < at)) return false;
  reveal(g, questionOf(g.set[g.index]), now);
  return true;
}
/** Every market settled against the truth as alone, into the log; the set is done with its last question. */
export function reveal(g, q, now) {
  const res = {};
  for (const [k, m] of Object.entries(g.quotes || {})) {
    if (!/^s\d$/.test(k) || !Number.isFinite(m?.bid) || !Number.isFinite(m?.ask)) continue;
    const r = settle(q, m.bid, m.ask);
    res[k] = { bid: m.bid, ask: m.ask, delta: r.delta, inside: r.inside, grade: r.grade };
  }
  g.log = { ...(g.log || {}), [`q${g.index}`]: { id: q.id, at: now, res } };
  delete g.quotes; delete g.nexts;
  g.phase = "reveal";
  if (g.index + 1 >= g.set.length) g.done = true;
  return true;
}
/** Next pressed: the table moves on once nobody at the table is still to press it. */
export function nextIn(g, slot, at, present, now) {
  const k = keyOf(slot);
  if (slot == null || g.mode !== "ranges" || g.phase !== "reveal" || g.done || g.seed !== at.seed || g.index !== at.index || g.nexts?.[k]) return false;
  g.nexts = { ...(g.nexts || {}), [k]: now };
  if (!waitingFor(g, present).length) moveOn(g);
  return true;
}
/** On without those still to press Next, once their grace is up. */
export function moveOnNow(g, present, now) {
  if (g.mode !== "ranges" || g.phase !== "reveal" || g.done) return false;
  const at = graceAt(g, present);
  if (waitingFor(g, present).length && (at == null || now < at)) return false;
  moveOn(g);
  return true;
}
function moveOn(g) {
  g.index++;
  g.phase = opening(g.mode);
  delete g.quotes; delete g.nexts; delete g.market; delete g.take;
}
/**
 * What the table owes itself as people come and go: the reveal once everyone still at the table has quoted, the next
 * question once everyone still here has pressed Next. False when there's nothing to do.
 */
export function settleUp(g, present, now, questionOf) {
  if (g.mode !== "ranges" || waitingFor(g, present).length) return false;
  if (g.phase === "quote" && Object.keys(g.quotes || {}).length) return reveal(g, questionOf(g.set[g.index]), now);
  if (g.phase === "reveal" && !g.done && Object.keys(g.nexts || {}).length) { moveOn(g); return true; }
  return false;
}

// ---------- trade: a pair, one market at a time ----------
/** Who makes the market: the first seat on even questions, the second on odd ones. */
export const makerOf = g => g.index % 2;
/** The maker's market. */
export function makeIn(g, slot, market, at) {
  if (g.mode !== "trade" || g.phase !== "make" || slot !== makerOf(g) || g.seed !== at.seed || g.index !== at.index) return false;
  if (!Number.isFinite(market.bid) || !Number.isFinite(market.ask) || market.ask < market.bid) return false;
  g.market = { bid: market.bid, ask: market.ask };
  g.phase = "take";
  return true;
}
/** The taker hits the bid, lifts the offer or passes; the trade settles between the two (a pass, the maker alone). */
export function takeIn(g, slot, kind, q, now) {
  if (g.mode !== "trade" || g.phase !== "take" || slot == null || slot === makerOf(g) || !["hit", "lift", "pass"].includes(kind) || !g.market) return false;
  const { bid, ask } = g.market, r = trade(q, bid, ask, kind);
  g.log = { ...(g.log || {}), [`q${g.index}`]: { id: q.id, at: now, bid, ask, take: kind, maker: makerOf(g), taker: slot, deltaMaker: r.maker, deltaTaker: r.taker, inside: q.truth >= bid && q.truth <= ask, edge: r.edge } };
  g.take = kind;
  g.phase = "reveal";
  if (g.index + 1 >= g.set.length) g.done = true;
  return true;
}
/** Either one's Next: on to the next question, the other making the market. */
export function nextTrade(g, at) {
  if (g.mode !== "trade" || g.phase !== "reveal" || g.done || g.seed !== at.seed || g.index !== at.index) return false;
  moveOn(g);
  return true;
}

// ---------- what the reveal and the standings show ----------
export const entryAt = (g, i) => g?.log?.[`q${i}`] || null;
/** What a question did to each seat's book: { s<slot>: delta }. */
export function deltasAt(e) {
  if (!e) return {};
  if (e.res) return Object.fromEntries(Object.entries(e.res).map(([k, r]) => [k, Number(r?.delta) || 0]));
  return { [keyOf(e.maker)]: Number(e.deltaMaker) || 0, ...(e.taker != null ? { [keyOf(e.taker)]: Number(e.deltaTaker) || 0 } : {}) };
}
/** Each seat's book over the set so far, from the 1,000 everyone starts with: { s<slot>: book }. */
export function books(g) {
  const b = Object.fromEntries(seated(g).map(([, p]) => [keyOf(p.slot), START]));
  for (const e of Object.values(g?.log || {})) for (const [k, d] of Object.entries(deltasAt(e))) b[k] = (b[k] ?? START) + d;
  return b;
}
/**
 * A question's markets, in the reveal's order: the most points first, then by seat; anyone seated without a market
 * last, with nothing. [{ uid, slot, name, bid, ask, delta, inside, grade, none }]
 */
export function placeRows(g, i) {
  const e = entryAt(g, i);
  return seated(g).map(([uid, p]) => {
    const r = e?.res?.[keyOf(p.slot)];
    return r ? { uid, slot: p.slot, name: p.name || "Player", bid: r.bid, ask: r.ask, delta: Number(r.delta) || 0, inside: !!r.inside, grade: r.grade || "C" }
      : { uid, slot: p.slot, name: p.name || "Player", delta: 0, none: true };
  }).sort((a, b) => (!!a.none - !!b.none) || (b.delta - a.delta) || (a.slot - b.slot));
}
/** The standings after question i, for standings.js: [{ slot, name, value (the book), delta (question i's change) }]. */
export function standingRows(g, i = null) {
  const b = books(g), d = i == null ? null : deltasAt(entryAt(g, i));
  return seated(g).map(([uid, p]) => ({ uid, slot: p.slot, name: p.name || "Player", value: b[keyOf(p.slot)] ?? START, ...(d ? { delta: d[keyOf(p.slot)] || 0 } : {}) }));
}
/** The set as one player saw it, once it's over, for the pair's record: { match, score (the book), won (alone at the top) }. */
export function resultOf(g, slot) {
  if (!isTable(g) || !g.done || slot == null) return null;
  const b = books(g), mine = b[keyOf(slot)] ?? START, all = seated(g).map(([, p]) => b[keyOf(p.slot)] ?? START);
  const best = Math.max(mine, ...all);
  return { match: `${g.seed}-${g.created || ""}`, score: mine, won: mine === best && all.filter(v => v === best).length === 1 };
}
/** Short labels for each seat, in seat order: initials, two letters where two share one, then a number. */
export function initials(names) {
  const first = names.map(n => String(n || "?").trim() || "?");
  const one = first.map(n => n[0].toUpperCase());
  const two = first.map((n, i) => (one.filter(x => x === one[i]).length > 1 ? n[0].toUpperCase() + (n[1] || "").toLowerCase() : one[i]));
  return two.map((x, i) => (two.filter(y => y === x).length > 1 ? `${x[0]}${i + 1}` : x));
}
