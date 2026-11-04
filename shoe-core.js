// Shoe: a real deck on a real table, with no rules. The state of the cards, as pure functions on one object `G` (the
// table's `game`), so a table.js transaction can run them and Node can test them (tests/shoe.mjs).
//
//   G = { decks, jokers, piles: { stock: [c…], discard: [c…], p1: […] }, spread: { p1: 1 }, hands: { uid: [id…] },
//         open: { uid: 1 }, tv: { uid: 1 }, n, log: [text…] }
//
// A card is a number: its id (deck × 54 + 0–51 for ♦ A–K, ♣, ♥, ♠ in blocks of 13, 52/53 the small and big joker, so
// two decks have two of each). On a pile a card face down is stored as -id-1, so one list says what is where and which
// way up; a hand's cards are all plain ids. A pile's last card is its top. The database keeps no empty lists or
// objects, so an empty pile, a hand with no cards, a switch off: all are simply absent, and every reader says `|| []`.
// `tv` is the devices that are the table rather than a player (they hold no hand and aren't dealt to).
import { SUIT_MARKS } from "./cards.js";

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUIT_WORDS = ["diamonds", "clubs", "hearts", "spades"];
export const MAX_DECKS = 4;
const PER_DECK = 54, LOG_KEPT = 8;

// ---------- cards ----------
export const downC = c => c < 0;
export const idOf = c => (c < 0 ? -c - 1 : c);
export const signed = (id, up) => (up ? id : -id - 1);
export const faceOf = id => {
  const k = id % PER_DECK;
  return k >= 52 ? { joker: k === 53 ? "big" : "small" } : { rank: RANKS[k % 13], suit: Math.floor(k / 13) };
};
export const nameOf = id => { const f = faceOf(id); return f.joker ? "joker" : `${f.rank}${SUIT_MARKS[f.suit]}`; };
const listOf = ids => { const w = ids.map(nameOf); return w.length > 3 ? `${w.length} cards` : w.length === 1 ? w[0] : `${w.slice(0, -1).join(", ")} and ${w.at(-1)}`; };
const cardsWord = n => (n === 1 ? "a card" : `${n} cards`);

/** The ids of a full shoe: `decks` decks, each with its two jokers if wanted. */
export function allCards(decks, jokers) {
  const out = [];
  for (let d = 0; d < decks; d++) for (let k = 0; k < (jokers ? 54 : 52); k++) out.push(d * PER_DECK + k);
  return out;
}
export function shuffled(list, rnd = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- reading and writing the lists (empty ones are absent) ----------
export const pile = (G, k) => G.piles?.[k] || [];
export const hand = (G, uid) => G.hands?.[uid] || [];
function setPile(G, k, list) {
  if (list.length) (G.piles ||= {})[k] = list;
  else { if (G.piles) delete G.piles[k]; if (G.spread) delete G.spread[k]; }
}
function setHand(G, uid, list) {
  if (list.length) (G.hands ||= {})[uid] = list;
  else if (G.hands) delete G.hands[uid];
}
/** The free piles on the table, oldest first. */
export const freePiles = G => Object.keys(G.piles || {}).filter(k => /^p\d+$/.test(k)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
/** Players are the people at the table who aren't the table itself: [{ uid, name, … }] in seat order. */
export const playersOf = (G, seated) => seated.filter(p => !G.tv?.[p.uid]);
export const total = G => Object.values(G.piles || {}).reduce((n, l) => n + l.length, 0) + Object.values(G.hands || {}).reduce((n, l) => n + l.length, 0);

function say(G, text) { G.log = [...(G.log || []), text].slice(-LOG_KEPT); return text; }

// ---------- a new shoe ----------
/** A fresh shoe, shuffled into the draw pile and nothing else dealt; who is the table (tv) carries over. */
export function fresh({ decks = 1, jokers = false } = {}, tv = null, rnd = Math.random) {
  decks = Math.max(1, Math.min(MAX_DECKS, Math.round(decks) || 1));
  const G = { decks, jokers: !!jokers, piles: { stock: shuffled(allCards(decks, jokers).map(id => signed(id, false)), rnd) }, n: 0, log: [`A new shoe: ${decks === 1 ? "one deck" : `${decks} decks`}${jokers ? " with jokers" : ""}, shuffled`] };
  if (tv && Object.keys(tv).length) G.tv = { ...tv };
  return G;
}

// ---------- the table's own moves (any phone may make them) ----------
export function shuffle(G, k = "stock", rnd = Math.random) {
  const l = pile(G, k);
  if (l.length < 2) return false;
  setPile(G, k, shuffled(l, rnd));
  return say(G, `${k === "stock" ? "The draw pile" : k === "discard" ? "The discard pile" : "A pile"} is shuffled`);
}
/** Deals `n` cards to each of the players (uids, in order, one at a time round); how many each got, in total. */
export function deal(G, n, uids) {
  const stock = pile(G, "stock");
  let dealt = 0;
  for (let i = 0; i < n && stock.length; i++) for (const uid of uids) {
    if (!stock.length) break;
    const h = hand(G, uid);
    setHand(G, uid, [...h, idOf(stock.pop())]);
    dealt++;
  }
  if (!dealt) return false;
  setPile(G, "stock", stock);
  return say(G, stock.length || dealt === n * uids.length ? `${n} dealt to each` : `The pile ran out: ${dealt} cards dealt`);
}
/** Moves the top `n` cards of one pile to another ("new" starts a pile), face up or down (null: as they lie). */
export function move(G, from, n, to, up = null) {
  const src = [...pile(G, from)];
  n = Math.min(n, src.length);
  if (!n || from === to) return false;
  const moving = src.splice(src.length - n, n).reverse();   // the top comes off first, so it lands first
  const key = to === "new" ? `p${(G.n = (G.n || 0) + 1)}` : to;
  const faces = to === "discard" ? true : up;
  setPile(G, from, src);
  setPile(G, key, [...pile(G, key), ...moving.map(c => (faces === null ? c : signed(idOf(c), faces)))]);
  const where = to === "discard" ? "the discard" : to === "stock" ? "the draw pile" : "the table";
  return say(G, `${n === 1 ? "A card" : `${n} cards`} from ${from === "stock" ? "the draw pile" : from === "discard" ? "the discard" : "a pile"} to ${where}${faces === null ? "" : faces ? " face up" : " face down"}`);
}
/** Turns a pile over, as a hand would: the order reverses and every card flips. */
export function flipPile(G, k) {
  const l = pile(G, k);
  if (!l.length) return false;
  setPile(G, k, [...l].reverse().map(c => signed(idOf(c), downC(c))));
  return say(G, `${k === "stock" ? "The draw pile" : k === "discard" ? "The discard pile" : "A pile"} is turned over`);
}
/** Turns one card (the top, or index i) over where it lies. */
export function flipCard(G, k, i = null) {
  const l = [...pile(G, k)];
  if (!l.length) return false;
  const at = i == null ? l.length - 1 : i;
  if (!(at >= 0 && at < l.length)) return false;
  l[at] = signed(idOf(l[at]), downC(l[at]));
  setPile(G, k, l);
  return say(G, downC(l[at]) ? "A card is turned face down" : `The ${nameOf(idOf(l[at]))} is turned face up`);
}
/** Fans a pile out so every card shows, or closes it. */
export function toggleSpread(G, k) {
  if (pile(G, k).length < 2) return false;
  if (G.spread?.[k]) delete G.spread[k]; else (G.spread ||= {})[k] = 1;
  return true;
}
/** A pile laid on another (faces and order kept). */
export function merge(G, from, to) {
  const src = pile(G, from);
  if (!src.length || from === to) return false;
  setPile(G, to, [...pile(G, to), ...src]);
  setPile(G, from, []);
  return say(G, "A pile is put on another");
}
/** Everything back into the draw pile, face down and shuffled; hands, revealed hands and the table's piles cleared. */
export function collect(G, rnd = Math.random) {
  const next = fresh({ decks: G.decks, jokers: G.jokers }, G.tv, rnd);
  next.log = [...(G.log || []), "Every card is collected and shuffled"].slice(-LOG_KEPT);
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, next);
  return true;
}
/** Starts again with another size of shoe. */
export function reshoe(G, decks, jokers, rnd = Math.random) {
  const next = fresh({ decks, jokers }, G.tv, rnd);
  for (const k of Object.keys(G)) delete G[k];
  Object.assign(G, next);
  return true;
}

// ---------- a player's moves; p = { uid, name } ----------
/** Draws the top `n` cards of the draw pile, the discard or a pile into the hand. */
export function draw(G, p, from, n = 1) {
  const src = [...pile(G, from)];
  n = Math.min(n, src.length);
  if (!n) return false;
  const taken = src.splice(src.length - n, n).reverse(), got = taken.map(idOf);
  setPile(G, from, src);
  setHand(G, p.uid, [...hand(G, p.uid), ...got]);
  // a card taken face down is not named on the table
  if (from === "stock" || taken.some(downC)) return say(G, `${p.name} draws ${cardsWord(n)}${from === "stock" ? "" : " from a pile"}`);
  return say(G, `${p.name} takes ${listOf(got)} from ${from === "discard" ? "the discard" : "a pile"}`);
}
/** Takes a whole pile (or the card at index i of it) into the hand. */
export function take(G, p, k, i = null) {
  const src = [...pile(G, k)];
  if (!src.length) return false;
  if (i == null) {
    setPile(G, k, []);
    setHand(G, p.uid, [...hand(G, p.uid), ...src.map(idOf)]);
    return say(G, `${p.name} takes ${k === "discard" ? "the discard pile" : k === "stock" ? "the draw pile" : "a pile"} (${cardsWord(src.length)})`);
  }
  if (!(i >= 0 && i < src.length)) return false;
  const [c] = src.splice(i, 1);
  setPile(G, k, src);
  setHand(G, p.uid, [...hand(G, p.uid), idOf(c)]);
  return say(G, downC(c) ? `${p.name} takes a face-down card` : `${p.name} takes the ${nameOf(idOf(c))}`);
}
/** Plays cards from the hand to the table: "discard" (always face up), "new" (a pile of their own) or a pile's key. */
export function play(G, p, ids, { to = "discard", up = true } = {}) {
  const h = [...hand(G, p.uid)];
  if (!ids.length || new Set(ids).size !== ids.length || !ids.every(id => h.includes(id))) return false;
  if (to !== "discard" && to !== "new" && !pile(G, to).length) return false;
  setHand(G, p.uid, h.filter(id => !ids.includes(id)));
  const faces = to === "discard" ? true : up;
  const key = to === "new" ? `p${(G.n = (G.n || 0) + 1)}` : to;
  setPile(G, key, [...pile(G, key), ...ids.map(id => signed(id, faces))]);
  return say(G, `${p.name} plays ${faces ? listOf(ids) : cardsWord(ids.length)} face ${faces ? "up" : "down"}${to === "discard" ? " on the discard" : to === "new" ? "" : " onto a pile"}`);
}
/** Passes cards to another player (they land at the end of that hand). */
export function pass(G, p, toUid, ids) {
  const h = [...hand(G, p.uid)];
  if (!toUid || toUid === p.uid || !ids.length || new Set(ids).size !== ids.length || !ids.every(id => h.includes(id))) return false;
  setHand(G, p.uid, h.filter(id => !ids.includes(id)));
  setHand(G, toUid, [...hand(G, toUid), ...ids]);
  return ids.length;   // the page words the line: it knows the other's name
}
export function logPass(G, p, other, n) { return say(G, `${p.name} passes ${cardsWord(n)} to ${other}`); }
/** Shows a hand to the table, or hides it again. */
export function reveal(G, p, on) {
  if (!!G.open?.[p.uid] === !!on || !hand(G, p.uid).length && on) return false;
  if (on) (G.open ||= {})[p.uid] = 1; else delete G.open[p.uid];
  if (G.open && !Object.keys(G.open).length) delete G.open;
  return say(G, on ? `${p.name} shows their hand` : `${p.name} hides their hand again`);
}
/** Whether this device is the table (no hand) or a player. */
export function setTable(G, uid, on) {
  if (!!G.tv?.[uid] === !!on) return false;
  if (on) {
    (G.tv ||= {})[uid] = 1;
    // a table has no hand: whatever it held goes back under the draw pile
    const h = hand(G, uid);
    if (h.length) { setPile(G, "stock", [...h.map(id => signed(id, false)), ...pile(G, "stock")]); setHand(G, uid, []); }
    if (G.open) delete G.open[uid];
  } else { delete G.tv[uid]; if (!Object.keys(G.tv).length) delete G.tv; }
  return true;
}

// ---------- ordering one's own hand (nothing said on the table) ----------
const lowAce = r => (r + 12) % 13;   // ace high when sorting
const key = (id, by) => {
  const f = faceOf(id);
  if (f.joker) return [9, f.joker === "big" ? 1 : 0, 0];
  const suit = [3, 2, 1, 0].indexOf(f.suit);   // ♠ ♥ ♣ ♦: the colours alternate
  return by === "suit" ? [suit, lowAce(RANKS.indexOf(f.rank)), 0] : [lowAce(RANKS.indexOf(f.rank)), suit, 0];
};
export function sortHand(G, uid, by) {
  const h = hand(G, uid);
  if (h.length < 2) return false;
  const order = [...h].sort((a, b) => { const x = key(a, by), y = key(b, by); return x[0] - y[0] || x[1] - y[1] || a - b; });
  if (order.every((id, i) => id === h[i])) return false;
  setHand(G, uid, order);
  return true;
}
/** Moves the chosen cards one place left (dir -1) or right (1), or to the very start/end (dir ±2), keeping their order. */
export function shift(G, uid, ids, dir) {
  const h = [...hand(G, uid)], on = new Set(ids);
  if (!ids.length) return false;
  if (Math.abs(dir) === 2) {
    const mine = h.filter(id => on.has(id)), rest = h.filter(id => !on.has(id));
    if (!mine.length) return false;
    setHand(G, uid, dir < 0 ? [...mine, ...rest] : [...rest, ...mine]);
    return true;
  }
  let moved = false;
  const idx = h.map((id, i) => i);
  for (const i of dir < 0 ? idx : idx.reverse()) {
    const j = i + dir;
    if (on.has(h[i]) && j >= 0 && j < h.length && !on.has(h[j])) { [h[i], h[j]] = [h[j], h[i]]; moved = true; }
  }
  if (moved) setHand(G, uid, h);
  return moved;
}
