// The Music course's review pile: what the reader's ear got wrong comes back, further apart each time it is got right (a Leitner ladder:
// a miss is due at once, then a right answer moves it to one day, three, a week, three weeks). The ear drills draw from it
// (music-ear.js); it is kept under `music:pile`, so the other devices see it. This is the course's own, small version of the idea: the
// suite's Ledger and Punt piles are for knowledge-base items and are not touched.
const DAY = 86400000, BOXES = [0, DAY, 3 * DAY, 7 * DAY, 21 * DAY];
export const KEY = "music:pile";

export function loadPile(store = globalThis.localStorage) {
  try { const p = JSON.parse(store.getItem(KEY) || "{}"); return { items: p.items && typeof p.items === "object" ? p.items : {} }; } catch { return { items: {} }; }
}
export function savePile(pile, store = globalThis.localStorage) { try { store.setItem(KEY, JSON.stringify(pile)); } catch { /* private mode */ } }
/** Records an answer: a miss puts the item in box 0, due now; a right answer to an item that is in the pile moves it up a box (out of the pile after the last). */
export function record(pile, id, ok, now = Date.now()) {
  const it = pile.items[id];
  if (!ok) { pile.items[id] = { box: 0, due: now, miss: (it?.miss || 0) + 1 }; return pile; }
  if (!it) return pile;
  if (it.box + 1 >= BOXES.length) delete pile.items[id];
  else pile.items[id] = { ...it, box: it.box + 1, due: now + BOXES[it.box + 1] };
  return pile;
}
/** The ids in the pile that are due by `now` (most overdue first), among `only` if given. */
export const dueIds = (pile, now = Date.now(), only = null) =>
  Object.entries(pile.items).filter(([id, it]) => it.due <= now && (!only || only.includes(id))).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
/** The next question's id from `pool`: a due item (not the one just asked) one time in two, else any of the pool but the last. rnd: () => 0..1. */
export function pickFrom(pile, pool, { now = Date.now(), rnd = Math.random, last = null } = {}) {
  const due = dueIds(pile, now, pool).filter(id => id !== last);
  if (due.length && rnd() < 0.5) return due[0];
  const rest = pool.filter(id => id !== last), from = rest.length ? rest : pool;
  return from[Math.floor(rnd() * from.length)];
}
