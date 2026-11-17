// Gears: all the levels in order and the saved state around them. Pure.
// 17 Nov 2026, Korbi: "the first 17 levels are good at the moment ... but all the other stuff is missing ... let's get the next 30 levels".
// The levels drawn to the plan of 12 November (pipes-gear-plan.mjs) are now the whole book. Book I's kept levels and the campaign's
// Mainspring chapter, which the drawn chapters replace, are no longer played; their stars stay where they were kept, by id.
import { BOOKS as DRAWN_BOOKS, CHAPTERS as DRAWN_CHAPTERS, LEVELS as DRAWN } from "./pipes-gear-designs.js";

export const BOOKS = DRAWN_BOOKS;
export const CHAPTERS = DRAWN_CHAPTERS;
export const LEVELS = DRAWN;
export const indexOf = id => LEVELS.findIndex(l => l.id === id);

/** What a run was kept for: a level whose plate, hand or goals changed starts over. */
export function sigOf(spec) {
  if (spec.sig) return spec.sig;
  const s = JSON.stringify([spec.map, spec.hand, spec.trains, spec.pins, spec.clicks]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${spec.cols}x${spec.rows}:${h.toString(36)}`;
}
