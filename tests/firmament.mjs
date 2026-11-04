// The Firmament course (firmament-*.js on course.js): its shape, every question's single right answer and fair wrong ones (CLAUDE.md, "Writing
// questions"), every numeric answer RECOMPUTED here from formulas of this file's own (not firmament-calc.js's), a diagram for every step, no
// picture fetched, nothing that Landfall's notes already teach copied, and the saved progress. Run: node tests/firmament.mjs
import fs from "fs";
import { COURSE, LESSONS, LESSON_IDS, STEPS, SOURCE } from "../firmament-lessons.js";
import { lessonsOf, progressOf } from "../course.js";
import { draw, FIGS } from "../firmament-figs.js";
import { plate } from "../firmament-plate.js";
import { num } from "../firmament-ask.js";
import { NOTES } from "../landfall-notes.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const RAD = Math.PI / 180;

// ---------- the shape ----------
check(COURSE.chapters.map(c => c.id).join() === "naked,greeks,asia,revolution,telescope,gravity,distance,light,relativity,galaxies,bigbang,worlds", "the chapters are in the order of the brief");
check(new Set(LESSON_IDS).size === LESSON_IDS.length && lessonsOf(COURSE).length === LESSONS.length, `${LESSONS.length} lessons, each id once`);
check(COURSE.chapters.every(c => c.lessons.length >= 3), "every chapter has at least three lessons");
check(LESSONS.every(l => l.steps.some(s => s.kind === "text") && l.steps.filter(s => s.kind === "quiz").length >= 2 || l.steps.filter(s => s.kind === "quiz").length >= 1), "every lesson has words and a question");
check(LESSONS.every(l => l.steps[0].kind === "text"), "every lesson begins with words");
check(new Set(STEPS.map(s => s.id)).size === STEPS.length, `${STEPS.length} steps, each with its own id`);
check(STEPS.filter(s => s.kind === "text").every(s => s.say.length <= 640), "no step of words is longer than 640 characters (a phone shows it with its question)");
check(STEPS.filter(s => s.kind === "quiz").every(s => s.say.length <= 260), "no question is longer than 260 characters");
check(SOURCE.every(c => c.reading.length >= 4 && c.reading.every(r => r.length === 2 && r[0] && r[1])), "every chapter has a reading list of at least four");
check(COURSE.chapters.every(c => /^Read on\./.test(c.lessons.at(-1).steps.at(-1).say)), "every chapter ends with its reading list");

// ---------- the questions ----------
const quiz = STEPS.filter(s => s.kind === "quiz");
check(quiz.every(s => s.quiz.length === 4 && new Set(s.quiz).size === 4 && s.quiz[s.answer] != null && s.why), `${quiz.length} questions, each with four distinct options, one answer and a reason`);
const seats = [0, 1, 2, 3].map(i => quiz.filter(s => s.answer === i).length);
check(seats.every(n => n > quiz.length * 0.12), `the right answers sit in every place (${seats.join(", ")})`);
check(quiz.every(s => s.why.length > 40), "every reason says something");

// the answer must not give itself away: not clearly the longest, not the only one with a figure (tests/banks.mjs's rule)
const formula = s => /\d/.test(s);
const nameLike = s => /^(the )?[A-ZÀ-Þ]/.test(s) && !/[:;]/.test(s) && s.split(/\s+/).length <= 6 && !/\d/.test(s);
function givesAway(s) {
  const right = s.quiz[s.answer], wrong = s.quiz.filter((_, i) => i !== s.answer);
  if (s.quiz.every(nameLike)) return wrong.every(w => !formula(w)) && formula(right);
  const rl = right.length, wl = wrong.map(w => w.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  return (rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8) || (wrong.every(w => !formula(w)) && formula(right));
}
const away = quiz.filter(givesAway);
check(!away.length, `no question gives its answer away${away.length ? `: ${away.map(s => s.id).join(", ")}` : ""}`);

// ---------- the numbers, recomputed from formulas of this file's own ----------
const SYN = 29.530588861, TROP = 365.2422;
const CHECKS = {
  lunarShort: () => TROP - 12 * SYN,
  leapMonths: () => 235 - 19 * 12,
  saros: () => 223 * SYN,
  babMonth: () => (29 + 31 / 60 + 50 / 3600 + 8 / 216000 + 20 / 12960000 - SYN) * 86400,
  sothic: () => 365 / 0.25,
  mayaRound: () => { const g = (a, b) => (b ? g(b, a % b) : a); return 260 * 365 / g(260, 365); },
  venusGap: () => Math.abs(5 * 583.92 - 8 * 365),
  mayaEclipse: () => 405 * SYN,
  eudoxus: () => 1 + 3 + 3 + 5 * 4,
  eratStadia: () => 5000 * 50,
  eratKm: () => 250000 * 0.1575,
  aristarchus: () => 1 / Math.cos(87 * RAD),
  sunMoon: () => 149597870.7 / 384400,
  hipSlow: () => 360 * 100,
  precession: () => 1296000 / 50.29,
  pogson: () => Math.pow(10, 2 / 5) ** 5,
  antikythera: () => 235 / 5,
  aryabhata: () => 62832 / 20000,
  dip: () => { const t = 34 / 60 * RAD; return 0.3 * Math.cos(t) / (2 * Math.sin(t / 2) ** 2); },
  tusi: () => 2 * Math.cos(60 * RAD),
  ulugh: () => Math.abs((6 * 3600 + 10 * 60 + 8) - (0.256363 * 86400)),
  gregorian: () => 365 + (400 / 4 - 3) / 400,       // a leap day every fourth year, three dropped every 400
  julian: () => (1582 - 325) * (365.25 - TROP),
  // chapters 4 to 6
  elong: () => Math.sqrt(1 - Math.cos(46 * RAD) ** 2),
  marsSyn: () => (365.256363 * 686.98) / (686.98 - 365.256363),
  kepMars: () => Math.sqrt(1.524 ** 3),
  kepJup: () => Math.sqrt(5.203 ** 3),
  transit: () => 8 * TROP - 13 * 224.701,
  ioMass: () => { const a = 4.217e8, T = 1.769138 * 86400; return 4 * Math.PI ** 2 * a ** 3 / (6.6743e-11 * T * T) / 1e27; },
  romer: () => (2 * 149597870.7 / 1320) / 1000,
  moonTest: () => { const v = 2 * Math.PI * 384400e3 / (27.321661 * 86400); return v * v / 384400e3 * 1000; },
  orbitV: () => Math.sqrt(3.986004418e14 / 6.371e6) / 1000,
  halley: () => Math.sqrt(17.8 ** 3),
  earthMass: () => 9.80665 * 6.371e6 ** 2 / 6.6743e-11 / 1e24,
  // chapters 7 to 9
  titius: () => (0.4 + 0.3 * 128) / 30.07 * 100 - 100,
  lalande: () => 6378 / Math.tan(8.6 / 3600 * RAD) / 1e6,
  aberr: () => Math.atan(29.78 / 299792.458) / RAD * 3600,
  bessel: () => 1 / 0.314 * 3.2615638,
  wien: () => 2.897771955e6 / 5772,
  doppler: () => 299792.458 * 0.1 / 656.28,
  sb: () => 2 ** 4,
  kelvin: () => 6.6743e-11 * (1.98841e30) ** 2 / (6.957e8 * 3.828e26) / (365.25 * 86400) / 1e6,
  massloss: () => 3.828e26 / 299792458 ** 2 / 1e9,
  mercury: () => { const GM = 1.32712440018e20, c = 299792458, a = 5.7909e10, e = 0.20563, per = 6 * Math.PI * GM / (c * c * a * (1 - e * e)); return per * (36525 / 87.969) * 180 / Math.PI * 3600; },
  bend: () => 4 * 1.32712440018e20 / (299792458 ** 2 * 6.957e8) / RAD * 3600,
  rs: () => 2 * 1.32712440018e20 / 299792458 ** 2 / 1000,
  gw: () => 36 + 29 - 62,
  // chapters 10 to 12
  leavitt: () => Math.sqrt(10),
  hubble500: () => 977.792 / 500,
  hubble70: () => 977.792 / 70,
  cmb: () => 2.897771955 / 2.725,
  helium: () => 100 * (2 + 2) / (2 + 14),
  keplerian: () => Math.pow(4, -0.5),
  tension: () => (73.0 - 67.4) / Math.sqrt(0.5 ** 2 + 1.0 ** 2),
  jupWobble: () => 1.26686534e17 / 1.32712440e20 * 13069.7,
  earthWobble: () => 3.986004418e14 / 1.32712440018e20 * 29784.7,
  transitDepth: () => (6371 / 695700) ** 2 * 100,
  dark: () => 68.3 + 26.8,
};
const calcSteps = quiz.filter(s => s.calc);
check(calcSteps.length >= 20, `${calcSteps.length} numeric questions`);
check(calcSteps.every(s => CHECKS[s.calc.id]), "every numeric question has a recomputation in this test");
check(Object.keys(CHECKS).every(id => calcSteps.some(s => s.calc.id === id)), "every recomputation here belongs to a question");
const parsed = t => parseFloat(String(t).replace(/,/g, "").replace(/[^\d.\-−]/g, "").replace("−", "-"));
const decimals = t => (String(t).match(/\.(\d+)/) || ["", ""])[1].length;
const wrongCalc = [];
for (const s of calcSteps) {
  const want = CHECKS[s.calc.id](), shown = s.quiz[s.answer];
  const tol = 0.5 * 10 ** -decimals(shown) + 1e-9;
  if (Math.abs(parsed(shown) - want) > tol || Math.abs(s.calc.value - want) > tol) wrongCalc.push(`${s.id}: shows ${shown}, recomputed ${want}`);
  // every wrong option is a different number (the same format), never the right one again
  if (s.quiz.some((o, i) => i !== s.answer && Math.abs(parsed(o) - want) <= tol)) wrongCalc.push(`${s.id}: a wrong option equals the right number`);
}
check(!wrongCalc.length, `every numeric answer matches its own recomputation${wrongCalc.length ? `: ${wrongCalc.join("; ")}` : ""}`);
check(num(12345.678, 1) === "12,345.7" && num(-5) === "−5" && num(999) === "999", "num() groups thousands and keeps the sign");

// the facts the words state, checked against each other
const words = STEPS.filter(s => s.kind === "text").map(s => s.say).join("\n");
check(Math.abs(250000 * 0.1575 / 40008 - 1) < 0.02 && Math.abs(250000 * 0.185 / 40008 - 1) > 0.15 && Math.abs(250000 * 0.185 / 40008 - 1) < 0.16 && /39,375 km/.test(words) && /46,250 km/.test(words), "Eratosthenes: 39,375 km is within 2% and 46,250 km is 16% over, as stated");
check(Math.abs(235 * SYN - 6939.7) < .05 && Math.abs(19 * TROP - 6939.6) < .05 && Math.abs(235 * SYN - 19 * TROP) * 24 < 2.5, "the Metonic cycle: 6,939.7 against 6,939.6 days, within about two hours");
check(Math.abs(13 * SYN - TROP - 18.7) < .05 && Math.abs(12 * SYN - 354.4) < .05, "twelve months are 354.4 days and thirteen overshoot by 18.7, as stated");
check(36 * 10 + 5 === 365 && 5 * 584 === 2920 && 8 * 365 === 2920 && 46 * 260 === 11960 && 18980 === 52 * 365 && 18980 === 73 * 260, "the decans, the Venus table and the Calendar Round add up as stated");
check(Math.abs(652 - 61) > 580 && /nearly six centuries/.test(words), "the Diaries run 652 to 61 BCE, 'nearly six centuries'");
check(Math.abs(Math.abs(((89 + 51 / 60) - 90)) - 0.15) < .01 && Math.abs(1 / Math.cos((89 + 51 / 60) * RAD) - 382) < 15, "Aristarchus's true angle of 89°51′ gives about 380 to 390 times");
check(Math.abs(Math.round(1 / Math.cos(87 * RAD)) - 19) === 0 && Math.abs(389 / 19 - 20) < 1, "19 against 389 is about twenty times too small");
check(Math.abs(1296000 / 50.29 - 25770) < 1 && 360 * 100 === 36000, "precession: a circle in 25,770 years against Hipparchus's 36,000 at least");
check(Math.abs(Math.pow(100, 0.2) - 2.512) < .001, "Pogson's ratio is 2.512");
check(Math.abs(6340 / 6371 - 1) < 0.005, "al-Biruni's 6,340 km is within 0.5% of 6,371");
check(1644 - 1281 === 363, "Shoushi ran 1281 to 1644, 363 years");
check(Math.abs(0.0078 * 128 - 1) < .01, "the Julian year gains a day in 128 years");
check(Math.abs((22208 - 22149.8) - 58.2) < .1, "Ulugh Beg's year differs by 58 seconds");
const rise = (365.2425 - TROP) * 3300;
check(rise > 0.9 && rise < 1.1, "the Gregorian year gains a day in about 3,300 years");

// ---------- every step has a diagram, drawn in the app ----------
check(STEPS.every(s => s.fig && FIGS[s.fig.t]), "every step names a figure that exists");
const empty = STEPS.filter(s => draw(s.fig).length < 80);
check(!empty.length, `every figure draws something${empty.length ? `: ${empty.map(s => s.id).join(", ")}` : ""}`);
const timelines = STEPS.filter(s => s.fig.t === "timeline");
check(timelines.every(s => s.fig.marks.every(([y]) => y >= s.fig.from && y <= s.fig.to)), "every dated mark of a timeline lies within its span");
check([...new Set(STEPS.map(s => s.fig.t))].length >= 8, `${[...new Set(STEPS.map(s => s.fig.t))].length} kinds of diagram are used`);
check(/<svg/.test("<svg>") && plate().length > 400, "the plate draws");

// ---------- no picture is fetched; Landfall's notes are linked, not copied ----------
const sources = fs.readdirSync(new URL("..", import.meta.url).pathname).filter(f => /^firmament.*\.(js|html)$/.test(f)).map(f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
check(!/pics\.js|wikipedia|wikimedia|<img|fetch\(/i.test(sources), "no picture is fetched: every diagram is drawn");
check(fs.readFileSync(new URL("../firmament.html", import.meta.url), "utf8").includes('class="firmament full titled fit-screen wide"'), "the page is full titled");
const grams = t => { const w = String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean), out = new Set(); for (let i = 0; i + 8 <= w.length; i++) out.add(w.slice(i, i + 8).join(" ")); return out; };
const mine = grams(words + " " + quiz.map(s => s.say + " " + s.why).join(" "));
const copied = NOTES.filter(n => typeof n.text === "string" && [...grams(n.text)].some(g => mine.has(g))).map(n => n.id);
check(!copied.length, `no sentence of a Landfall note is repeated here${copied.length ? `: ${copied.join(", ")}` : ""}`);
check(/Landfall/.test(words) && fs.readFileSync(new URL("../firmament.js", import.meta.url), "utf8").includes("./landfall.html") && fs.readFileSync(new URL("../firmament.js", import.meta.url), "utf8").includes("./orrery.html"), "Landfall and Orrery are linked, not duplicated");

// ---------- who disputes what is said, not smoothed over ----------
check(/stadion/.test(words) && /157\.5 m/.test(words) && /185 m/.test(words) && /historians disagree on which/.test(words), "Eratosthenes's stadion is stated as a range, with the dispute");
check(/van der Waerden/.test(words) && /most historians of Indian astronomy/.test(words), "the dispute over Āryabhaṭa's model is named");
check(/Saliba/.test(words) && /separately/.test(words), "both sides of the Tusi couple's road to Copernicus are stated");
check(/van Beek/.test(words) && /Temple/.test(words) && /Griaule/.test(words), "the Dogon-Sirius claim is told with its critic");
check(/Heyerdahl/.test(words) && /DNA/.test(words), "Heyerdahl's drift theory is told with the evidence against it");
check(/Robert Newton/.test(quiz.map(s => s.quiz.join(" ")).join(" ")), "the dispute over Ptolemy's catalogue is a question");

// ---------- the progress ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
check(progressOf("firmament", COURSE).done === 0 && progressOf("firmament", COURSE).next.lesson.id === LESSON_IDS[0], "a new reader starts at the first lesson");
store.set("firmament:course", JSON.stringify({ done: { [LESSON_IDS[0]]: 1, [LESSON_IDS[1]]: 1 }, at: null }));
check(progressOf("firmament", COURSE).done === 2 && progressOf("firmament", COURSE).next.lesson.id === LESSON_IDS[2], "the course remembers the lessons done under firmament:course");

if (bad) process.exitCode = 1;
