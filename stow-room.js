// Stow at a table (October 2026): the room's stow branch, pure, so tests/stow.mjs can seat a party, play its turns and
// send every move through the database's round trip. Everyone at the table takes turns in seat order, each from a hand
// of their own the others can't see; the hold and the score are the team's. A player who's away (their phone asleep, or
// gone back to solo) is passed over, so nobody's sleeping phone holds up the table, and plays again once back.
//
//   { v: 1, app, created, id (the level), board, tint, hands: { s<slot>: { tray, slots: [bool, bool, bool] } }, turn,
//     used, done: false | { won, at, by? }, last: { idx, colour }, people, asked?, players }
//
// Hands are kept by seat as s0, s1… (a list by seat would come back from the database with holes); a hand not dealt yet
// is the level's first tray for that seat.
import { makeField, options, put, marksLeft, anyFits, tray, startBoard } from "./stow-engine.js";
import { LEVELS } from "./stow-levels.js";
import { seatsOf } from "./rooms.js";

export const MOST = 6;                                   // the most at one hold (a party's)
/** The seats a table keeps for people: a party's request says how many (two to six), a pair's is two. */
export const peopleOf = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
const byId = new Map(LEVELS.map(l => [l.id, l]));
/** The level a table is playing (a campaign level: today's hold is solo). */
export const levelOf = g => byId.get(g?.id) || LEVELS[0];
/** Each shape keeps one of the four enamels. */
export const colourOf = p => (p.n % 4) + 1;
/** The same cells (a placement may be a list or a typed array). */
export function sameCells(a, b) {
  if (a.length !== b.length) return false;
  for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) return false;
  return true;
}

/** A new table at this level: these players seated, room for as many people as the request asked for. */
export function freshTable(level, players, { app, ask = null, now = Date.now() } = {}) {
  const f = makeField(level.field);
  return { v: 1, app, created: now, id: level.id, board: [...startBoard(level, f)], tint: new Array(f.n).fill(0), hands: {}, turn: 0, used: 0, done: false,
    players, people: peopleOf(ask) };
}
/** The table starts a level afresh (the same level again, or another), its people still seated. */
export function restart(g, level, now = Date.now()) {
  const f = makeField(level.field);
  Object.assign(g, { id: level.id, board: [...startBoard(level, f)], tint: new Array(f.n).fill(0), hands: {}, turn: 0, used: 0, done: false, created: now });
  delete g.last;
  return g;
}

/** A seat's hand: { tray, slots }. (A table from before parties kept the pair's two hands as a list.) */
export function handOf(g, slot) {
  const h = g?.hands?.[`s${slot}`] ?? (Array.isArray(g?.hands) ? g.hands[slot] : null);
  return { tray: h?.tray || 0, slots: [0, 1, 2].map(k => (h ? !!h.slots?.[k] : true)) };
}
function setHand(g, slot, hand) {
  if (!g.hands || Array.isArray(g.hands)) g.hands = Object.fromEntries(Object.entries(g.hands || {}).filter(([, h]) => h).map(([s, h]) => [`s${s}`, h]));
  g.hands[`s${slot}`] = hand;
}
/** The pieces in a seat's hand now (null where one has been placed). */
export function piecesIn(g, slot) {
  const hand = handOf(g, slot);
  return tray(levelOf(g), hand.tray, slot).map((p, k) => (hand.slots[k] ? p : null));
}
/** Whether a seat has anything in hand that fits the hold now. */
export function canMove(g, slot) {
  const f = makeField(levelOf(g).field);
  return anyFits(f, Uint8Array.from(g.board || []), piecesIn(g, slot).filter(Boolean));
}

// ---------- turns ----------
/** The seats at the table, in order round it. */
export const seatOrder = g => seatsOf(g).map(([, p]) => p.slot).sort((a, b) => a - b);
/** The seat after this one, round the table. */
export function nextSeat(g, slot) {
  const order = seatOrder(g);
  return order.find(s => s > slot) ?? order[0] ?? 0;
}
/**
 * The seats at the table now, lowest first: this device's, and every other seated player with Stow open on a device
 * that's online, by the room's here and by the seat's own mark (a phone that sleeps is marked offline at its seat; the
 * room's here alone can't tell, since the database keeps no empty list of sessions).
 */
export function presentSlots(g, here, me, game = "stow") {
  return seatsOf(g).filter(([id, p]) => id === me || (here?.[id]?.game === game && here[id].online !== false && p.online !== false))
    .map(([, p]) => p.slot).sort((a, b) => a - b);
}
/**
 * Whose turn it is now: the seat the table's turn names, or, while that player is away, the next one round the table
 * who's here. With nobody here, it stays where it is.
 */
export function turnNow(g, present) {
  const order = seatOrder(g), here = new Set(present);
  if (!order.length) return g?.turn ?? 0;
  let at = order.findIndex(s => s >= (g.turn ?? 0));
  if (at < 0) at = 0;
  for (let k = 0; k < order.length; k++) { const s = order[(at + k) % order.length]; if (here.has(s)) return s; }
  return order[at];
}

/**
 * A move at the table, inside its transaction: seat `slot` puts the piece in place `k` of its hand on the cells `idx`.
 * False, changing nothing, unless it's that seat's turn now and the piece fits there. The turn passes round the table;
 * the level is won when the last consignment goes, and lost when whoever's turn it now is has nothing that fits.
 */
export function move(g, slot, k, idx, present, now = Date.now()) {
  if (g.done || turnNow(g, present) !== slot) return false;
  const level = levelOf(g), f = makeField(level.field), hand = handOf(g, slot);
  const p = tray(level, hand.tray, slot)[k], board = Uint8Array.from(g.board || []);
  if (!hand.slots[k] || !p || !options(f, board, p).some(x => sameCells(x, idx))) return false;
  const tint = [...(g.tint || new Array(f.n).fill(0))];
  for (const i of idx) tint[i] = colourOf(p);
  const r = put(f, board, Int16Array.from(idx), tint);
  hand.slots[k] = false;
  if (!hand.slots.some(Boolean)) { hand.tray++; hand.slots = [true, true, true]; }
  setHand(g, slot, hand);
  g.board = [...r.board]; g.tint = [...r.extra]; g.used = (g.used || 0) + 1; g.turn = nextSeat(g, slot);
  g.last = { idx: [...idx], colour: colourOf(p) };                 // so the others' holds can lower it as it went
  if (marksLeft(r.board) === 0) g.done = { won: true, at: now };
  else {
    const next = turnNow(g, present);
    if (!canMove(g, next)) g.done = { won: false, at: now, by: next };
  }
  return true;
}
/** Out of room on your turn (`slot`'s, now): the level is lost, inside a transaction; false if it isn't so. */
export function stuck(g, slot, present, now = Date.now()) {
  if (g.done || turnNow(g, present) !== slot || canMove(g, slot)) return false;
  g.done = { won: false, at: now, by: slot };
  return true;
}
