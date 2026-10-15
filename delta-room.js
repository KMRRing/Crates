// Delta's paths and its table (October 2026), pure, so tests/delta.mjs can seat a party and send its state through the
// database's round trip. At a table (together.js, the room's delta branch, a pair's or a party's of up to six) everyone
// draws on the one board: each path keeps who drew it, and each player's path under the finger is shared as it's drawn,
// so the others see it grow in that player's colour (--p0…--p5).
//
//   { v: 1, app, created, startedAt, level, seed, board, paths: { id: { c, k: "q,r;q,r;…", by? } }, clues: [pair index],
//     done, people, asked?, players: { uid: { name, pid, slot, online, draw?: "q,r;q,r;…" } } }
import { seatsOf } from "./rooms.js";

export const MOST = 6;                                   // the most at one board (a party's)
const COLOURS = 6;                                       // a solo path's own colours (--d-p0…)
/** The seats a table keeps for people: a party's request says how many (two to six), a pair's is two. */
export const peopleOf = ask => Math.min(MOST, Math.max(2, Number(ask?.people) || 2));

export const cellsOf = rec => (rec?.k ? rec.k.split(";") : []);
/** The paths as a list: [{ id, c, by, cells }] (by: who drew it, at a table). */
export const pathList = paths => Object.entries(paths || {}).map(([id, rec]) => ({ id, c: rec.c, by: rec.by || null, cells: cellsOf(rec) })).filter(p => p.cells.length);

/**
 * The paths with one path set to these cells (or removed, with fewer than two), drawn by `by` (at a table). Any other
 * path it crosses is cut where they meet, keeping the part before, and stays its drawer's; a number belongs to one path
 * only. Colours stay put; a new path takes the first free one.
 */
export function withPath(paths, id, colour, cells, by = null) {
  const out = {};
  const mine = new Set(cells);
  for (const [pid, rec] of Object.entries(paths || {})) {
    if (pid === id) continue;
    const theirs = cellsOf(rec);
    const cut = cells.length >= 2 ? theirs.findIndex(k => mine.has(k)) : -1;
    const kept = cut < 0 ? theirs : theirs.slice(0, cut);
    if (kept.length >= 2) out[pid] = { c: rec.c, k: kept.join(";"), ...(rec.by ? { by: rec.by } : {}) };
  }
  if (cells.length >= 2) {
    const used = new Set(Object.values(out).map(r => r.c));
    let c = colour;
    if (c == null || used.has(c)) for (c = 0; used.has(c); c++);
    out[id] = { c: c % COLOURS, k: cells.join(";"), ...(by ? { by } : {}) };
  }
  return out;
}

/** A new table: this board, these players seated, room for as many people as the request asked for. */
export function freshTable(players, { app, level, seed, board, ask = null, now = Date.now() }) {
  return { v: 1, app, created: now, startedAt: now, level, seed, board, paths: {}, clues: [], done: null, players, people: peopleOf(ask) };
}

/**
 * The seats at the table now, lowest first: this device's, and every other seated player with Delta open on a device
 * that's online, by the room's here and by the seat's own mark (a phone that sleeps is marked offline at its seat; the
 * room's here alone can't tell, since the database keeps no empty list of sessions).
 */
export function presentSlots(g, here, me, game = "delta") {
  return seatsOf(g).filter(([id, p]) => id === me || (here?.[id]?.game === game && here[id].online !== false && p.online !== false))
    .map(([, p]) => p.slot).sort((a, b) => a - b);
}

/** The paths the others here are drawing now, under their fingers: [{ id, slot, name, cells }]. */
export function drawingsOf(g, here, me, pid = null) {
  const now = new Set(presentSlots(g, here, me));
  return seatsOf(g).filter(([id, p]) => id !== me && !(pid && p.pid === pid) && typeof p.draw === "string" && now.has(p.slot))
    .map(([id, p]) => ({ id, slot: p.slot, name: p.name || "Player", cells: p.draw.split(";").filter(Boolean) }))
    .filter(d => d.cells.length >= 2).sort((a, b) => a.slot - b.slot);
}

/** Paths drawn, by player, on a board as it stands: { uid: n }. */
export function drawnBy(paths) {
  const n = {};
  for (const p of pathList(paths)) if (p.by && p.cells.length >= 2) n[p.by] = (n[p.by] || 0) + 1;
  return n;
}
