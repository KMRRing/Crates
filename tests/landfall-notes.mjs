// Landfall's notebook (landfall-notes.js): what Navigation taught, now met in play. Pure: events earn notes, a blank is filled by a
// second event, the numbers in the words are worked out by the sky's own functions, and a finished Navigation lesson is carried over.
import { NOTES, GROUPS, noteById, earn, fillable, textOf, capOf, filledOf, tally, fromCourse, FROM_COURSE } from "../landfall-notes.js";
import { dip, refraction } from "../landfall-sky.js";
import { EYE } from "../landfall-engine.js";
import { LORE } from "../landfall-lore.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ctx = { lat: 56 };
const words = n => `${capOf(n, ctx)} ${textOf(n, { [n.id]: 2 }, ctx)}`;

check(new Set(NOTES.map(n => n.id)).size === NOTES.length && NOTES.every(n => GROUPS.some(([g]) => g === n.g)), "every note has its own id and a group");
check(NOTES.every(n => n.term && capOf(n, ctx).length >= 20 && capOf(n, ctx).length <= 130), "a caption is one short line (20 to 130 characters)");
check(NOTES.every(n => textOf(n, {}, ctx).length <= 420), "a note is never a wall of text (at most 420 characters)");
check(NOTES.every(n => !!n.fill === textOf(n, {}, ctx).includes("{gap}") || !!n.fill === textOf(n, {}, ctx).includes("___")), "a note has a blank exactly when it has a fill");
check(NOTES.every(n => !n.fill || (textOf(n, { [n.id]: 1 }, ctx).includes("___") && !textOf(n, { [n.id]: 2 }, ctx).includes("___") && textOf(n, { [n.id]: 2 }, ctx).includes(n.fill.answer))), "a blank is a blank until filled, then it says the answer");
check(NOTES.filter(n => n.fill).length >= 5, "several notes carry a gap the player fills by playing");

// earning, and pace: one note per event, in order, never twice
{
  const have = {};
  const a = earn(have, "ritual"); have[a.id] = 2;
  const b = earn(have, "ritual"); have[b.id] = 2;
  check(a.id === "latlon" && b.id === "minute" && a !== b, "the same event earns the next note each time, not all at once");
  check(earn(have, "no such event") === null && earn({ ...have, hanse: 2 }, "start") === null, "an event with nothing left to teach earns nothing");
  check(fillable({ minute: 1 }, "plot")?.id === "minute" && fillable({ minute: 2 }, "plot") === null && fillable({}, "plot") === null, "a blank is filled only once, and only after it was heard");
  check(earn({ orion: 1 }, "pick:Rigel") === null && fillable({ orion: 1 }, "pick:Betelgeuse")?.id === "orion", "Orion is heard from its belt and filled by tapping its red shoulder");
  check(filledOf(noteById("minute")).includes("60"), "the caption for a filled blank says the answer");
}

// the facts the words state
{
  const dipText = textOf(noteById("dip"), {}, ctx);
  check(dipText.includes(`${(Math.round(dip(EYE) * 10) / 10)}′ at your ${EYE} m`) && dipText.includes(`${(Math.round(dip(16) * 10) / 10)}′ from a masthead`), "dip: 1.76′ × √(eye height), the numbers computed");
  const ref = textOf(noteById("refraction"), {}, ctx);
  check(ref.includes(`${(Math.round(refraction(45) * 10) / 10)}′ at 45°`) && ref.includes(`${Math.round(refraction(5))}′ at 5°`), "refraction: about 1′ at 45° and 10′ at 5°, computed");
  check(Math.abs(refraction(45) - 1) < 0.1 && Math.abs(refraction(5) - 10) < 0.5, "...and those are what the sky's refraction gives");
  const lon = textOf(noteById("lonshrink"), {}, { lat: 60 });
  check(lon.includes("it is 30 miles.") && lon.includes("at 60° N"), "a degree of longitude at 60° N is 30 miles (the cosine)");
  const cm = textOf(noteById("clockmile"), {}, { lat: 60 });
  check(cm.includes("0.13") && cm.includes("15 here"), "a second of time is a quarter-mile at the equator, 0.13 at 60° N; two minutes wrong is 15 there");
  check(1852 * 28 / 3600 / 0.3048 > 47.2 && 1852 * 28 / 3600 / 0.3048 < 47.3 && noteById("knot").text.includes("47 ft 3 in"), "the knots are 47 ft 3 in apart for a 28-second glass");
  check(360 / (23 + 56 / 60) > 15.0 && 360 / 24 === 15, "15° an hour (the sky 360° in 23 h 56 min is the stars' day)");
  check(0.25 * 5 === 1.25 && 120 * 0.25 === 30 && 20 * 3 * 0.25 === 15, "clock arithmetic: H4's 5 s is 1¼ nm; two minutes is 30 nm; 3 s a day for 20 days is 15 nm");
  check(2 * 60 === 120 && 1 / Math.cos(60 * Math.PI / 180) > 1.999 && 1 / Math.cos(60 * Math.PI / 180) < 2.001, "the Mercator scale is the secant: twice at 60°");
  check(words(noteById("act")).includes("1714") && words(noteById("h4")).includes("81 days") && words(noteById("sextant")).includes("1757") && words(noteById("rhumb")).includes("1569"), "the dates: 1714, 81 days, 1757, 1569");
}

// each concept of the old Navigation course has a home, and a finished lesson there is carried over without lowering anything
{
  const ids = new Set(NOTES.map(n => n.id));
  check(Object.values(FROM_COURSE).flat().every(id => ids.has(id)), "every note a finished Navigation lesson stands for exists");
  const got = fromCourse({ dip: 1, drift: 2 }, { latlon: 1, corrections: 1 });
  check(got.latlon === 2 && got.minute === 2 && got.dip === 2 && got.drift === 2 && !got.sextant, "a finished lesson writes its notes whole; an unfinished one writes none; none is lowered");
  check(tally(got).got === Object.keys(got).length && tally({}).got === 0 && tally({}).of === NOTES.length, "the tally counts what is heard");
}

// the sky notes sit with the codex, not against it
check(Object.keys(LORE).every(k => LORE[k].rule) && !NOTES.some(n => /Plough|Cassiopeia/.test(n.text)), "the Plough and Cassiopeia stay in the Codex, not twice");

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nlandfall-notes: events earn notes one at a time, gaps are filled by a second event, the numbers are computed, the old course is carried over");
