// Gears: all the levels in order (Book I, the old levels read through the legacy table; Books II onwards, the generated file) and the saved
// state around them. Pure.
import { LEGACY, LEGACY_CHAPTERS } from "./pipes-gear-legacy.js";
import { BOOKS as NEW_BOOKS, CHAPTERS as NEW_CHAPTERS, LEVELS as NEW_LEVELS } from "./pipes-gear-levels.js";

export const BOOKS = [{ key: "I", name: "The bench", rule: "Whole gears, parity and jams." }, ...NEW_BOOKS];
export const CHAPTERS = [...LEGACY_CHAPTERS, ...NEW_CHAPTERS];
export const LEVELS = [...LEGACY, ...NEW_LEVELS];
export const indexOf = id => LEVELS.findIndex(l => l.id === id);

/** What a run was kept for: a level whose plate, hand or goals changed starts over. */
export function sigOf(spec) {
  if (spec.sig) return spec.sig;
  const s = JSON.stringify([spec.map, spec.hand, spec.trains, spec.pins, spec.clicks]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${spec.cols}x${spec.rows}:${h.toString(36)}`;
}
