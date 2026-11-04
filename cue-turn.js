// Cue at a table: several phones, one stream of cards, and the Turn setting. Each card has a player whose turn it is
// (X), and what X sees is one of three things:
//   same  the cue everyone sees (X is in the hot seat: reads it out, acts it, answers first);
//   odd   a different cue, a twin of the card or another of its category (Spyfall, Undercover): nobody is told who X
//         is, X least of all, until the card is revealed;
//   none  nothing (Heads Up, Charades): X works the card out from what the others say and do.
// And X comes round in turn (seat order), at random (everyone once before anyone twice), or chosen (the player whose
// turn it was has just picked the next; at the start the host does). Pure: party-cue.js draws it, tests/cue-turn.mjs
// plays it.
import { LIB, CATS, catOf, pool, oddFor, kindOf } from "./cue-library.js";
import { clockAt } from "./cue-clock.js";

export const SEES = [["same", "The same cue"], ["odd", "A different cue"], ["none", "No cue"]];
export const WHO = [["turn", "In turn"], ["random", "Random"], ["chosen", "Chosen"]];

/** A list shuffled by rnd (Fisher–Yates: every order equally likely). */
export function shuffle(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** A deck of the cards in `cards`: the categories taken in turn, in a fresh order each time round, so a category with
 *  few cards comes as often as one with hundreds until it runs out; no card twice until the deck has been through. */
export function newDeck(cards, rnd, round = 1) {
  const queues = new Map();
  for (const i of shuffle(cards, rnd)) { const c = LIB[i].cat; if (!queues.has(c)) queues.set(c, []); queues.get(c).push(i); }
  const order = [], lists = [...queues.values()];
  while (lists.some(q => q.length)) for (const q of shuffle(lists, rnd)) if (q.length) order.push(q.shift());
  return { order, at: 0, round };
}

const listOf = x => (x ? Object.values(x).filter(v => v != null) : []);
/** The database keeps no empty lists and may hand a list back as an object: put back what a state needs. */
export function whole(s) {
  s.deck = { ...s.deck, order: listOf(s.deck?.order) };
  s.bag = listOf(s.bag);
  s.order = listOf(s.order);
  s.names ||= {};
  return s;
}

/** The next card's number in LIB (the deck shuffled again once every card has come). Changes s.deck. */
function draw(s, rnd) {
  if (s.deck.at >= s.deck.order.length) s.deck = newDeck(pool(s.cat, s.level, s.sees === "none"), rnd, (s.deck.round || 0) + 1);
  const i = s.deck.order[s.deck.at];
  s.deck = { ...s.deck, at: s.deck.at + 1 };
  return i;
}

/**
 * Who is X for the next card, among `here` (the uids at the table): the next one in seat order after the last X
 * ("turn"), one of those who haven't had a turn yet ("random": a bag filled again when it is empty, never the same
 * player twice running), or null ("chosen": someone picks). Changes s.bag.
 */
export function whoNext(s, here, rnd) {
  if (!here.length || s.who === "chosen") return null;
  if (s.who === "random") {
    s.bag = s.bag.filter(u => here.includes(u));
    if (!s.bag.length) {
      s.bag = shuffle(here, rnd);
      if (s.bag.length > 1 && s.bag[0] === s.x) [s.bag[0], s.bag[1]] = [s.bag[1], s.bag[0]];   // not the same twice running
    }
    return s.bag.shift();
  }
  const at = s.order.indexOf(s.x), n = s.order.length;
  for (let k = 1; k <= n; k++) {
    const u = s.order[(at + k) % n];
    if (here.includes(u)) return u;
  }
  return here[0];
}

/** Turns up a card with x its player. */
function show(s, x, rnd, now) {
  const i = draw(s, rnd);
  s.step = "card";
  s.x = x;
  s.cards = (s.cards || 0) + 1;
  s.card = { i, t: LIB[i].t, o: s.sees === "odd" ? oddFor(i, s.level, rnd) : null };
  s.at = now;
  s.revealed = false;
  return s;
}

/** The table's state at the start. players: [{ uid, name }] in seat order; options as the menu holds them (strings). */
export function begin({ players, options, rnd, now }) {
  const s = whole({
    step: "card", n: 1, x: null, cards: 0, sees: options.sees, who: options.who, cat: options.deck, level: Number(options.level),
    count: Number(options.count), order: players.map(p => p.uid), names: Object.fromEntries(players.map(p => [p.uid, p.name])),
    deck: { order: [], at: 0, round: 0 }, bag: [], at: now, revealed: false,
  });
  if (s.who === "chosen") { s.step = "pick"; return s; }
  return show(s, whoNext(s, s.order, rnd), rnd, now);
}

/**
 * The tap on Next, as a change to the table's state, if the thing the tapper saw (n) is still up: the next card, or
 * (X chosen) the pick of who it is for. False if another tap got there first.
 */
export function nextCard(s, n, here, rnd, now) {
  if (s.n !== n || s.step !== "card") return false;
  whole(s);
  s.n++;
  if (s.who === "chosen") { s.step = "pick"; s.card = null; return true; }
  show(s, whoNext(s, here, rnd), rnd, now);
  return true;
}

/** The pick of the next X (chosen): the card for them turned up. False if it isn't a pick, or they aren't at the table. */
export function pickNext(s, n, uid, here, rnd, now) {
  if (s.n !== n || s.step !== "pick" || !here.includes(uid)) return false;
  whole(s);
  s.n++;
  show(s, uid, rnd, now);
  return true;
}

/** Who may pick the next X: the player whose turn it was, and the host, who runs the table (alone at the start, and
 *  when the last X has gone). */
export const mayPick = (s, uid, isHost) => isHost || s.x === uid;

/** The cooldown one step shorter (dir -1) or longer (1): by 1 second under ten, 5 under a minute, then 15; never under
 *  0 (none) or over 600. */
export function stepped(count, dir) {
  const by = count < 10 || (dir < 0 && count === 10) ? 1 : count < 60 || (dir < 0 && count === 60) ? 5 : 15;
  return Math.max(0, Math.min(600, count + dir * by));
}

/** The cooldown, from the next card on (the host's stepper): whole seconds, 0 for none. */
export function setCount(s, count) {
  if (!Number.isInteger(count) || count < 0 || count > 600) return false;
  s.count = count;
  return true;
}

/**
 * What a player's phone shows for the card, or null before there is one: { role, text, kind, line, odd?, blind? }.
 * role "x" is X where the table knows who it is (same, none); in "odd" nobody is told, X included, so X is "other".
 * "watch": not dealt in (joined after the start); sees the card as everyone else does.
 */
export function viewOf(s, uid) {
  if (s.step !== "card" || !s.card) return null;
  const card = LIB[s.card.i], cat = catOf(card.cat), kind = kindOf(card);
  if (s.names?.[uid] == null) return { role: "watch", cat, kind, text: s.card.t, line: cat.ask };
  if (uid !== s.x) return { role: "other", cat, kind, text: s.card.t, line: s.sees === "none" ? cat.guess : cat.ask };
  if (s.sees === "none") return { role: "x", cat, kind, text: null, blind: true, line: "You see nothing. Work it out from what the others say and do." };
  if (s.sees === "odd") return { role: "other", cat, kind, text: s.card.o, line: cat.ask, odd: true };
  return { role: "x", cat, kind, text: s.card.t, line: cat.x };
}

/** What the reveal says once the card is over, or "" when there is nothing to tell (everyone saw the same). */
export function revealOf(s) {
  if (!s.card) return "";
  const who = s.names?.[s.x] || "Someone";
  if (s.sees === "odd") return `${who} had a different cue: ${s.card.o}. Everyone else had: ${s.card.t}`;
  if (s.sees === "none") return `${who} saw nothing. The cue was: ${s.card.t}`;
  return "";
}

/** Whether the card is over: revealed, or its cooldown has run out (`now`, the table's clock). */
export const isOver = (s, now) => !!s.revealed || (s.count > 0 && clockAt(now - s.at, s.count * 1000).phase === "over");

/** What stops a game from starting with these players and options, in words, or "". */
export function need(players, options, name = "Cue") {
  const n = players.length;
  if (n < 2) return `${name} needs 2 players: ${2 - n} more to join`;
  if (options.sees === "odd" && n < 3) return `A different cue needs 3 players: ${3 - n} more to join`;
  if (!pool(options.deck, Number(options.level), options.sees === "none").length) return "That kind of card can't be guessed: pick another, or let X see the cue";
  return "";
}

export { CATS };
