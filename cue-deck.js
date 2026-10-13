// Cue's deck: the words of the kinds chosen, shuffled, dealt one a tap; a step back if a tap came too soon; once every
// word has come, shuffled again, never starting with the word just seen. Pure: the page and tests/cue.mjs use it.
import { KINDS } from "./cue-words.js";

/** Every word of the kinds chosen, as "kind:word" (so a deck kept on the device survives the list changing). */
export const wordsOf = kinds => KINDS.filter(k => kinds.includes(k.id)).flatMap(k => k.words.map(w => `${k.id}:${w}`));
/** Fisher–Yates, with the random numbers given. */
export function shuffle(list, rnd = Math.random) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** A deck of the kinds chosen: { kinds, order, at, round }, at the words shown so far (the one up is order[at - 1]);
 *  `after`, the word just seen, isn't dealt first. */
export function deal(kinds, rnd = Math.random, after = null, round = 1) {
  const order = shuffle(wordsOf(kinds), rnd);
  if (after && order.length > 1 && order[0] === after) [order[0], order[order.length - 1]] = [order[order.length - 1], order[0]];
  return { kinds: kinds.slice(), order, at: 0, round };
}
/** The next word: a step on, or, every word having come, the first of the deck shuffled again. */
export function next(deck, rnd = Math.random) {
  if (!deck.order.length) return deck;
  if (deck.at < deck.order.length) return { ...deck, at: deck.at + 1 };
  return { ...deal(deck.kinds, rnd, deck.order[deck.at - 1], (deck.round || 1) + 1), at: 1 };
}
/** A step back, to the word before (there's none before the first). */
export const back = deck => (deck.at > 1 ? { ...deck, at: deck.at - 1 } : deck);
/** The word up: { kind, word }, or null before the first tap. */
export function current(deck) {
  const s = deck.order[deck.at - 1];
  if (!s) return null;
  const i = s.indexOf(":");
  return { kind: s.slice(0, i), word: s.slice(i + 1) };
}
/** A deck as kept on the device, if it's still one: its words known, its place in them. */
export function valid(deck) {
  if (!deck || !Array.isArray(deck.order) || !Array.isArray(deck.kinds) || !Number.isInteger(deck.at)) return false;
  const known = new Set(wordsOf(deck.kinds));
  return deck.at >= 0 && deck.at <= deck.order.length && deck.order.length === known.size && deck.order.every(w => known.has(w));
}
