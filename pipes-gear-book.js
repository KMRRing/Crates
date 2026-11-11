// Gears: all the levels in order and the saved state around them. Pure.
// (12 Nov 2026, Korbi, on the campaign of 11 November: "the levels are... really bad". Its 64 made levels missed the plan, so Book I's 36 kept
// levels play, as they always did, and the campaign's chapters come in one at a time as they are rebuilt to the plan, for him to judge before
// the next: Mainspring first, after Trios. The rest of the campaign waits in pipes-gear-levels.js; stars are kept by id, so none is lost.)
import { LEGACY, LEGACY_CHAPTERS } from "./pipes-gear-legacy.js";
import { CHAPTERS as PLAN_CHAPTERS, LEVELS as PLAN_LEVELS } from "./pipes-gear-levels.js";

const quartz = PLAN_CHAPTERS.find(c => c.key === "a").rule;          // the first plates are driven by a quartz motor, not a spring
const after = LEGACY_CHAPTERS.findIndex(c => c.key === "d"), at = LEGACY.findIndex(l => l.chapter === "d");
const mainspring = { ...PLAN_CHAPTERS.find(c => c.key === "w"), book: "I" };

export const BOOKS = [{ key: "I", name: "The bench", rule: "Whole gears, parity and jams." }];
export const CHAPTERS = [...LEGACY_CHAPTERS.slice(0, after), mainspring, ...LEGACY_CHAPTERS.slice(after)].map(c => (c.key === "a" ? { ...c, rule: quartz } : c));
export const LEVELS = [...LEGACY.slice(0, at), ...PLAN_LEVELS.filter(l => l.chapter === "w"), ...LEGACY.slice(at)];
export const indexOf = id => LEVELS.findIndex(l => l.id === id);

/** What a run was kept for: a level whose plate, hand or goals changed starts over. */
export function sigOf(spec) {
  if (spec.sig) return spec.sig;
  const s = JSON.stringify([spec.map, spec.hand, spec.trains, spec.pins, spec.clicks]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return `${spec.cols}x${spec.rows}:${h.toString(36)}`;
}
