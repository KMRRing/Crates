// Slate at a table (October 2026): the room's glyph branch as the players share it, pure, so tests/slate-room.mjs can seat
// a party and send its state through the database's round trip. Everyone fills the one board: every placement goes in
// the log with who made it, and each player's letters and cursor show in their seat's colour (--p0…--p5). slate.js
// joins the room and draws; this is the state.
//
//   { v: 1, app, created, startedAt, level, seed, board, log: [{ word | draft | clear | check | reveal | hint, by }],
//     done, people, asked?, players: { uid: { name, pid, slot, online, at?: { k, d } } } }
import { gridOf, rowsOf } from "./slate-gen.js";
import { seatsOf } from "./rooms.js";

export const MOST = 6;               // the most at one board (a party's)
/** The seats a table keeps for people: a party's request says how many (two to six), a pair's is two. */
export const peopleOf = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));
/** How many people a table seats (sitDown's slots): as many as it was dealt for; a table from before, two. */
export const seatsFor = g => g?.people || 2;

/**
 * The request a page was opened for (`at`, its ?new=), while it's the room's latest and was said yes to; else null. A
 * party writes the game's branch (glyph), the pair's partner sheet the game's name (slate): either is Slate's.
 */
export const askedFor = (ask, at) => (at && ask?.at === at && (ask.game === "glyph" || ask.game === "slate") && ask.answer === "yes" ? at : null);

/** A new table: this board, these players seated, room for as many people as the request asked for. */
export function freshTable(players, { app, seed, level, board, ask = null, asked = null, now = Date.now() }) {
  return { v: 1, app, created: now, startedAt: now, level, seed, board, log: [], done: null, players, people: peopleOf(ask), ...(asked ? { asked } : {}) };
}

/**
 * A state as the database takes it: it refuses a whole write for one undefined or NaN anywhere in it (together.js
 * does the same for its games), so any left are dropped here, with a warning in the console, rather than the move lost.
 */
export function storable(state) {
  let odd = null;
  const json = JSON.stringify(state, function (k, v) {
    if (v === undefined && Array.isArray(this) && !Object.hasOwn(this, k)) return null;   // a gap the database left in a list
    if (v === undefined || (typeof v === "number" && !Number.isFinite(v))) { odd ||= k; return v === undefined ? undefined : null; }
    return v;
  });
  if (odd) console.warn(`slate: dropped ${odd} (undefined or not a number) from the state before saving it`);
  return JSON.parse(json);
}

/** The log as a list (the database may hand one back as an object). */
export const logOf = g => Object.values(g?.log || {}).filter(Boolean);

/**
 * Who put each letter on the board, { cell: uid }, replayed from the log as lettersFrom replays the letters: a cell is
 * its placer's while its letter stays the same, so a word laid through another's letter leaves that letter theirs.
 */
export function ownersFrom(board, log) {
  const grid = gridOf(rowsOf(board)), letters = {}, owner = {};
  const set = (k, ch, by) => {
    if (letters[k] === ch) return;
    letters[k] = ch;
    if (by) owner[k] = by; else delete owner[k];
  };
  for (const e of log) {
    if (e.clear) Object.values(e.clear).forEach(k => { delete letters[k]; delete owner[k]; });
    else if (e.draft) for (const [k, ch] of Object.entries(e.draft)) set(k, ch, e.by);
    else if (e.word) grid.slots[e.slot].cells.forEach((k, i) => set(k, e.word[i], e.by));
  }
  return owner;
}

/** Words placed, by player: { uid: n } (only real words count, as Placements does). */
export function placedBy(log) {
  const n = {};
  for (const e of log) if (e.word && e.by) n[e.by] = (n[e.by] || 0) + 1;
  return n;
}

/**
 * The seats at the table now, lowest first: this device's, and every other seated player with Slate open on a device
 * that's online, by the room's here and by the seat's own mark (a phone that sleeps is marked offline at its seat; the
 * room's here alone can't tell, since the database keeps no empty list of sessions).
 */
export function presentSlots(g, here, me, game = "glyph") {
  return seatsOf(g).filter(([id, p]) => id === me || (here?.[id]?.game === game && here[id].online !== false && p.online !== false))
    .map(([, p]) => p.slot).sort((a, b) => a - b);
}

/** Where everyone else at the table is typing: [{ id, slot, name, k, d }], those here with a cursor on the board. */
export function cursorsOf(g, here, me, pid = null) {
  const now = new Set(presentSlots(g, here, me));
  return seatsOf(g).filter(([id, p]) => id !== me && !(pid && p.pid === pid) && p.at?.k && now.has(p.slot))
    .map(([id, p]) => ({ id, slot: p.slot, name: p.name || "Player", k: p.at.k, d: p.at.d === "Down" ? "Down" : "Across" }))
    .sort((a, b) => a.slot - b.slot);
}
