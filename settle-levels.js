// Settle's levels: thirty, six to each of the five chapters (settle-alloys.js's CHAPTERS), each a fixed puzzle (crucibles part filled
// and a fixed deal) made by settle-plan.mjs and kept in settle-book.js, with the plan of the search that knows the deal (its par, which
// tests/settle-levels.mjs replays) and the turns it gives (its limit). Three stars for par, two for a third more, one for any win in the
// turns given. A level opens when the one before it has a star; a chapter's first level when the chapter before is done.
// Random and Daily melts are levels of the book, picked by a seed.
import { CHAPTERS, RECIPES } from "./settle-alloys.js";
import { draw } from "./settle-engine.js";
import { BOOK } from "./settle-book.js";

export const LEVELS = BOOK;
export const levelOf = id => LEVELS.find(L => L.id === id);
export const chapterOf = L => CHAPTERS.find(c => c.id === L.ch);
/** A level's melt, as newGame takes it. */
export const specOf = L => ({ ch: L.ch, cols: L.cols, height: L.height, orders: L.orders, goal: L.goal, fuel: L.fuel, feats: L.feats, solid: L.solid, burn: L.burn,
  ...(L.burnAt ? { burnAt: L.burnAt } : {}), start: L.start, deal: L.deal, limit: L.limit, lv: L.id });
export const starsFor = (L, turns) => (turns <= L.par ? 3 : turns <= Math.ceil(L.par * 4 / 3) ? 2 : 1);
/** Whether a level is open, given what is done ({ id: { stars, turns } }): the first, and any after one with a star. */
export const isOpen = (id, done) => { const k = LEVELS.findIndex(L => L.id === id); return k === 0 || (k > 0 && (done[LEVELS[k - 1].id]?.stars || 0) > 0); };
/** The level after one, or null. */
export const nextOf = L => LEVELS[LEVELS.indexOf(L) + 1] ?? null;

const pick = (list, seed, n) => list[Math.floor(draw(seed, n) * list.length)];
// Random and Daily play the book's levels, so every melt is one the search has won (13 November 2026: an endless deal could not be
// proved winnable fast enough on a phone, and the chapters' puzzles need their fixed deals).
/** A random melt at a level of the hidden ramp (a level's id): a level of a chapter up to that level's, at random. */
export function randomSpec(levelId, seed) {
  const L = levelOf(levelId) ?? LEVELS[0], R = pick(LEVELS.filter(x => x.ch <= L.ch), seed, 0);
  return { ...specOf(R), lv: 0, from: R.id };
}
/** Today's melt: the same on every device (the day is the seed), one of the book's levels after the first two. */
export function dailySpec(day) {
  const seed = Number(day) * 7 + 13, R = pick(LEVELS.filter(L => +L.id.split("-")[1] > 2), seed, 99);
  return { spec: { ...specOf(R), lv: 0, from: R.id }, seed };
}
