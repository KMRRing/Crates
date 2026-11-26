// Traverse's campaign: ten chapters, one technique each (Korbi, 27 Nov 2026, on the plan "Traverse — the plan": the campaign teaches
// techniques, the Atlas holds the places, the mixes carry the volume). Chapters 1 to 6 are at sea and hold the built voyages by
// their ids, so the stars won stay with them; a voyage's `section` (landfall-voyages.js) stays the group it was written in. Chapters
// 7 to 10 (land, ice and sand, the open Pacific) are listed with `levels: []` until their levels are made, and the menu leaves an
// empty chapter out. Order matters: every voyage needs only what its own chapter or an earlier one teaches (tests/landfall-chapters.mjs).
import { LEVELS } from "./landfall-levels.js";

const bySection = (...ss) => ss.flatMap(s => LEVELS.filter(l => l.section === s).map(l => l.id));

export const CHAPTERS = [
  { n: 1, name: "The pole star and the log", teaches: "Latitude by Polaris, dead reckoning, the compass's error", levels: bySection(1) },
  { n: 2, name: "The sun", teaches: "The noon sight: latitude by the sun, longitude by the clock", levels: bySection(2) },
  { n: 3, name: "Lines and longitude", teaches: "Any star's line, two lines and the fix, the chronometer, the southern sky", levels: bySection(3, 4, 5) },
  { n: 4, name: "Lights and land", teaches: "Lights by their bearing and character, the land by its shape", levels: bySection(7, 11, 12) },
  { n: 5, name: "Cloud, storm and the Hanse run", teaches: "Stars through cloud and named by their neighbours, the blow and after it, the long passage", levels: bySection(6, 13, 8, 9) },
  { n: 6, name: "Soundings and birds", teaches: "The lead and the bottom, the sounding machine, birds flying home", levels: bySection(10, 14, 15) },
  { n: 7, name: "Peaks and bearings", teaches: "Naming peaks, resection, land transits, what hides what", levels: [] },
  { n: 8, name: "Contours and cloud", teaches: "Contours, slope, pace counting, the altimeter, whiteout", levels: [] },
  { n: 9, name: "Ice and sand", teaches: "The sun compass, the artificial horizon, the moving floor, wells", levels: [] },
  { n: 10, name: "Without instruments", teaches: "The star compass, swells, birds, the expanded target", levels: [] },
];

const CHAPTER_OF = new Map(CHAPTERS.flatMap(c => c.levels.map(id => [id, c.n])));
/** The chapter a voyage is in (its number), or 0 for one in none. */
export const chapterOf = id => CHAPTER_OF.get(id) || 0;
/** The chapters that have voyages to play, in order. */
export const playable = () => CHAPTERS.filter(c => c.levels.length);
/** The campaign's voyages in playing order. */
export const ORDER = CHAPTERS.flatMap(c => c.levels);
