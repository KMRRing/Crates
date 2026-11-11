// Gears: all the levels in order (the campaign of 11 November 2026, pipes-gear-levels.js, made by pipes-gear-campaign.mjs) and the saved
// state around them. Pure.
import { BOOKS, CHAPTERS, LEVELS } from "./pipes-gear-levels.js";

export { BOOKS, CHAPTERS, LEVELS };
export const indexOf = id => LEVELS.findIndex(l => l.id === id);

/** What a run was kept for: a level whose plate, hand or goals changed starts over. */
export function sigOf(spec) {
  if (spec.sig) return spec.sig;
  const s = JSON.stringify([spec.map, spec.hand, spec.trains, spec.pins, spec.clicks]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${spec.cols}x${spec.rows}:${h.toString(36)}`;
}
