// What you know of the Atlas (Korbi, 27 Nov 2026: "I want to be able to master the alps"). Pure, so the page and the tests share it.
//
// A summit is known once you have named it right from three sides: from each third of the compass round it that some start looks
// at it from (fewer, where the starts only see it from one or two). Each naming spaces it out the way flash cards are spaced: right,
// and it is due again after twice as many days as last time; wrong, and it is due today, from one day again. A new play leans toward
// starts that show what is due or unknown, so the summits you miss come back while the ones you know rest.
//
// An area is mastered when every summit in it (not the far ones seen from it) is known, with ten fixes of two stars or more there;
// a region, when every area is mastered and you then pass its master test: five fixes in a row on Hard, two stars or more each.
//
// `know` is one object, kept under landfall:atlas-know:
//   { peaks: { "<region>/<area>/<landmark id>": { s: sides known (bits 0-2), gap: days, due: day number } },
//     fixes: { "<region>/<area>": fixes of two stars or more }, tests: { "<region>": { streak, passed } },
//     areas: { "<region>/<area>": areaState's last answer, for the menu, which has not every pack to hand } }
import { distanceBearing } from "./landfall-terrain.js";
import { seesNow } from "./landfall-atlas-engine.js";

export const FIXES = 10, TEST = 5;
/** A day of suite.js's today() (20261127) as a count of days, so gaps can be added. */
export const dayNumber = ymd => Math.round(Date.UTC(Math.floor(ymd / 10000), Math.floor(ymd / 100) % 100 - 1, ymd % 100) / 864e5);
const bits = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1);
const peakKey = (pack, l) => `${pack.region}/${pack.area}/${l.id}`;
export const blank = () => ({ peaks: {}, fixes: {}, tests: {} });

/** The third of the compass, seen from the summit, that a start stands in: 0 for north-east, 1 south, 2 north-west. */
export const sideOf = (l, s) => Math.floor(((distanceBearing(l.lat, l.lon, s.lat, s.lon).b % 360) + 360) % 360 / 120) % 3;

const opens = new WeakMap();
/** For each landmark of a pack, the sides some start sees it from (bits), worked out once a pack. */
function sidesOpen(pack) {
  if (!opens.has(pack)) {
    const m = new Array(pack.landmarks.length).fill(0);
    for (const s of pack.starts) for (const i of s.sees) m[i] |= 1 << sideOf(pack.landmarks[i], s);
    opens.set(pack, m);
  }
  return opens.get(pack);
}

/** How well a summit is known: { has, needs } sides, `due` whether it is due (or never named right), and `known`. */
export function peakState(know, pack, i, day) {
  const l = pack.landmarks[i], k = know.peaks[peakKey(pack, l)], needs = Math.min(3, bits(sidesOpen(pack)[i]));
  const has = k ? bits(k.s & sidesOpen(pack)[i]) : 0;
  return { has, needs, known: needs > 0 && has >= needs, due: !k || k.due <= day };
}

/** What a finished play teaches: each summit named right gains the side you saw it from and rests longer; one named wrong, and the
 *  one that was really on the line, come back today. Also counts the fix toward the area. Returns a new `know`. */
export function learn(know, pack, play, day) {
  const out = { ...know, peaks: { ...know.peaks }, fixes: { ...know.fixes }, tests: { ...know.tests } }, s = pack.starts[play.start];
  const sees = seesNow(pack, play), bear = i => distanceBearing(s.lat, s.lon, pack.landmarks[i].lat, pack.landmarks[i].lon).b;
  const off = (r, i) => Math.abs(((r - bear(i) + 540) % 360) - 180);
  const miss = i => { const key = peakKey(pack, pack.landmarks[i]), k = out.peaks[key] || { s: 0, gap: 0, due: day }; out.peaks[key] = { ...k, gap: 1, due: day }; };
  (play.named || []).forEach((n, k) => {
    if (n.right) {
      const l = pack.landmarks[n.named], key = peakKey(pack, l), was = out.peaks[key] || { s: 0, gap: 0, due: day };
      const gap = Math.max(1, was.gap * 2);
      out.peaks[key] = { s: was.s | (1 << sideOf(l, s)), gap, due: day + gap };
    } else {
      if (pack.landmarks[n.named]) miss(n.named);
      const reading = play.bearings[k].reading + (play.deviation || 0);
      const truly = sees.reduce((a, i) => (off(reading, i) < off(reading, a) ? i : a), sees[0]);
      if (truly != null && off(reading, truly) < 2) miss(truly);
    }
  });
  if (play.stars >= 2) { const a = `${pack.region}/${pack.area}`; out.fixes[a] = (out.fixes[a] || 0) + 1; }
  return out;
}

/** An area's summits (the ones in it, not the far ones seen from it) and how many are known; its fixes; whether it is mastered. */
export function areaState(know, pack, day) {
  const mine = pack.landmarks.map((l, i) => i).filter(i => pack.landmarks[i].near && bits(sidesOpen(pack)[i]));
  const known = mine.filter(i => peakState(know, pack, i, day).known).length, fixes = know.fixes[`${pack.region}/${pack.area}`] || 0;
  return { known, of: mine.length, fixes, mastered: known === mine.length && fixes >= FIXES };
}

/** A start's pull on a new play: one, and two more for each summit it shows that is due or unknown. */
export const weightFor = (know, pack, day) => s => 1 + 2 * s.sees.filter(i => !peakState(know, pack, i, day).known || peakState(know, pack, i, day).due).length / Math.max(1, s.sees.length) * 4;

/** A master test's fix: two stars or more add to the streak, less ends it; five in a row pass the region for good. */
export function tested(know, region, stars) {
  const t = know.tests[region] || { streak: 0, passed: false };
  const streak = stars >= 2 ? t.streak + 1 : 0;
  return { ...know, tests: { ...know.tests, [region]: { streak: t.passed ? 0 : streak, passed: t.passed || streak >= TEST } } };
}
