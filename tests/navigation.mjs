// The Navigation course (navigation-lessons.js on course.js): its arithmetic (navigation-math.js), the facts its words state about the sky
// (worked from Landfall's catalogue and sky), every lesson's shape, every quiz's right answer, and every instrument taken to the answer
// by the same moves a finger makes. The course's progress is the sheet's own (`navigation:course`).
import { COURSE, NOON, ROUTE, FACTS } from "../navigation-lessons.js";
import { INSTRUMENTS } from "../navigation-stage.js";
import { lessonsOf, progressOf } from "../course.js";
import * as M from "../navigation-math.js";
import { star, seen, sky, camera, ray, sep, SHAPES } from "../navigation-sky.js";
import { chartMap, plotView, moonPath } from "../navigation-sea.js";
import { STARS } from "../landfall-stars.js";
import { julianDate, placeOfDate, dip, refraction, observedAltitude, sunPlace } from "../landfall-sky.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---------- the sea's arithmetic ----------
check(M.knotSpacingFt(28) > 47.2 && M.knotSpacingFt(28) < 47.3, `a log line's knots are 47 ft 3 in apart for a 28-second glass (${M.knotSpacingFt(28).toFixed(2)} ft)`);
check(near(M.knotSpacingFt(28) / M.FT_PER_NM, 28 / 3600, 1e-9), "the knots are the same fraction of a mile as the glass is of an hour");
check(M.POINTS.length === 32 && M.pointName(236.25) === "SW by W" && M.pointDeg("N by E") === 11.25 && M.pointName(359) === "N", "the compass has 32 points of 11.25 degrees");
check(M.magneticOf(90, -10) === 100 && M.magneticOf(90, 10) === 80 && M.trueOf(100, -10) === 90, "variation west adds to a true course, variation east subtracts");
const dr = M.deadReckon([0, 0], [{ c: 90, k: 6, h: 3 }]);
check(near(dr[0], 18, 1e-9) && near(dr[1], 0, 1e-9), "6 knots due east for 3 hours is 18 nm east");
const two = M.deadReckon([0, 0], [{ c: 60, k: 6, h: 2 }, { c: 150, k: 5, h: 3 }]);
check(near(two[0], 12 * Math.sin(Math.PI / 3) + 7.5, 1e-9) && near(two[1], 6 - 15 * Math.cos(Math.PI / 6), 1e-9), "two legs add: 060 at 6 kn for 2 h, then 150 at 5 kn for 3 h");
const cur = M.deadReckon([0, 0], [{ c: 90, k: 5, h: 4 }], { set: 0, k: 2 });
check(near(cur[0], 20, 1e-9) && near(cur[1], 8, 1e-9), "a 2-knot current setting north for 4 hours adds 8 nm north");
const mg = M.madeGood(90, 5, { set: 0, k: 2 });
check(near(mg.knots, Math.hypot(5, 2), 1e-9) && near(mg.course, Math.atan2(5, 2) * 180 / Math.PI, 1e-9), "course and speed made good are the sum of the two vectors");
check(near(M.milesPerDegLon(0), 60, 1e-9) && near(M.milesPerDegLon(60), 30, 1e-9), "a degree of longitude is 60 nm at the equator and 30 at 60 degrees");
check(near(M.mercatorY(60 + 0.01) - M.mercatorY(60), 2 * (0.01 * Math.PI / 180), 1e-6), "the Mercator scale at 60 degrees is 2 (secant 60)");
check(near(M.greatCircle(0, 0, 0, 90).nm, 5400, 1), "a quarter of the equator is 5,400 nm");
check(near(M.rhumb(0, 0, 0, 90).nm, 5400, 1) && M.rhumb(50, -1, 40, -74).nm > M.greatCircle(50, -1, 40, -74).nm, "the rhumb line is never shorter than the great circle");
check(ROUTE.rh.nm > ROUTE.gc.nm + 50 && ROUTE.gc.nm > 2900 && ROUTE.gc.nm < 3050, `Southampton to New York: great circle ${Math.round(ROUTE.gc.nm)} nm, rhumb ${Math.round(ROUTE.rh.nm)} nm`);
const gcp = M.greatCirclePoints(50.9, -1.4, 40.5, -74);
check(near(gcp[0].lat, 50.9, 1e-6) && near(gcp.at(-1).lon, -74, 1e-6) && Math.max(...gcp.map(p => p.lat)) > 50.9, "the great circle bows toward the pole and ends where it should");
check(near(M.longitudeAtNoon(14 + 20 / 60), -35, 1e-9) && near(M.longitudeAtNoon(9 + 40 / 60), 35, 1e-9) && near(M.greenwichAtNoon(-35), 14 + 20 / 60, 1e-9), "noon with Greenwich at 14:20 is 35 W; at 09:40, 35 E");
check(near(M.clockErrorMiles(4, 0), 1, 1e-9) && near(M.clockErrorMiles(120, 0), 30, 1e-9) && near(M.clockErrorMiles(120, 60), 15, 1e-9) && near(M.clockErrorMiles(5, 0), 1.25, 1e-9), "4 s of time is a mile at the equator; 2 min is 30 nm there and 15 nm at 60 N");
check(near(M.secondsFor(0.5), 120, 1e-9) && near(M.secondsToDeg(120), 0.5, 1e-9) && M.errorAfter(3, 20) === 60, "the Longitude Act's half degree is two minutes; 3 s a day for 20 days is a minute");
check(M.hhmm(14 + 20 / 60) === "14:20" && M.hhmm(6 + M.TIDE_HOURS) === "18:25", "clock times print as hh:mm; the tide after 06:00 high water is at 18:25");
check(near(M.moonAge(julianDate(2024, 4, 8, 18, 21)), 0, 0.8) || near(M.moonAge(julianDate(2024, 4, 8, 18, 21)), M.SYNODIC, 0.8), "the moon is new at the eclipse of 8 April 2024");
check(near(M.moonAge(julianDate(2024, 1, 25, 17, 54)), M.SYNODIC / 2, 0.8), "and full on 25 January 2024");
check(M.litFraction(0) === 0 && near(M.litFraction(M.SYNODIC / 2), 1, 1e-9) && near(M.litFraction(M.SYNODIC / 4), 0.5, 1e-9) && M.phaseName(M.SYNODIC / 2) === "Full" && M.phaseName(1) === "Waxing crescent", "the moon's lit part and its phases' names");
check(M.rangeFactor(0) > M.rangeFactor(M.SYNODIC / 4) && near(M.rangeFactor(0), M.rangeFactor(M.SYNODIC / 2), 1e-9) && M.nearSprings(0.5) && M.nearSprings(M.SYNODIC - 0.5) && !M.nearSprings(M.SYNODIC / 4), "springs at new and full moon, neaps at the quarters");
check(near(M.tideHeight(0, 4), 2, 1e-9) && near(M.tideHeight(M.TIDE_HOURS / 2, 4), -2, 1e-9) && near(M.tideLaterMin, 50.47, 0.01), "the tide is high at 0 and low half a period on; each day's tide is 50 minutes later");
check(M.latText(53.55) === "53° 33′ N" && M.lonText(-35) === "35° 00′ W" && M.altText(41.2833) === "41° 17.0′", "latitude, longitude and altitude read as degrees and minutes");
check(moonPath(1, 50, 50, 30) !== "" && moonPath(0, 50, 50, 30) === "" && moonPath(10, 50, 50, 30).startsWith("M50 20"), "the moon's lit path is empty at new moon");

// ---------- the sky's facts that the words state ----------
const when = [2026, 6, 1, 0];
const at26 = star => placeOfDate(star[3], star[4], star[6], star[7], julianDate(2026, 6, 1));
const polar = at26(star("Polaris"));
check(90 - polar.dec > 0.4 && 90 - polar.dec < 1, `Polaris is under a degree from the pole in 2026 (${(90 - polar.dec).toFixed(2)} degrees)`);
const dirAt = (name, step) => seen(step, star(name)).d;
const s56 = { lat: 56, lon: 8, when: [2026, 3, 20, 22] };
const ptr = ray(dirAt("Merak", s56), dirAt("Dubhe", s56), 6);
check(sep(ptr.at(-1), dirAt("Polaris", s56)) < 3, `the Pointers' gap carried five times on reaches Polaris (${sep(ptr.at(-1), dirAt("Polaris", s56)).toFixed(1)} degrees off)`);
const so = { lat: 45, lon: 0, when: [2026, 1, 15, 21] };
const belt = ray(dirAt("Mintaka", so), dirAt("Alnitak", so), 9, 90);
const nearest = (path, name) => Math.min(...path.map(p => sep(p, dirAt(name, so))));
check(nearest(belt, "Sirius") < 3, `the belt's line passes within ${nearest(belt, "Sirius").toFixed(1)} degrees of Sirius`);
const beltOther = ray(dirAt("Alnitak", so), dirAt("Mintaka", so), 9, 90);
check(nearest(beltOther, "Aldebaran") < 12, `the belt's line the other way passes within ${nearest(beltOther, "Aldebaran").toFixed(1)} degrees of Aldebaran ("roughly")`);
const sc = { lat: -30, lon: 0, when: [2026, 5, 20, 21] };
const cross = ray(dirAt("Gacrux", sc), dirAt("Acrux", sc), 5.5);
const southPole = [0, 0, -1];
const poleDir = [0, -Math.cos(30 * Math.PI / 180), Math.sin(30 * Math.PI / 180)];
check(sep(cross.at(-1), poleDir) < 3, `the Cross's long axis, 4.5 lengths past Acrux, ends ${sep(cross.at(-1), poleDir).toFixed(1)} degrees from the south celestial pole`);
check(near(sep(dirAt("Gacrux", sc), dirAt("Acrux", sc)) * 4.5, sep(dirAt("Acrux", sc), poleDir), 6), "4.5 lengths of the Cross is about the distance from Acrux to the pole");
check(STARS.reduce((a, b) => (b[5] < a[5] ? b : a))[1] === "Sirius", "Sirius is the brightest star of the catalogue");
check(near(seen(FACTS.POLARIS_SKY, star("Polaris")).alt, 56, 1), `Polaris stands within a degree of the latitude (${FACTS.POLARIS_ALT.toFixed(2)} at 56 N)`);
// the stars turn counter-clockwise about Polaris, looking north
{
  const cam = camera(0, 45, 62, 180, 134, 122), st = { lat: 56, lon: 8, when: [2026, 11, 15, 19] }, angle = dh => {
    const a = cam.project(seen(st, star("Schedar"), dh).d), p = cam.project(seen(st, star("Polaris"), dh).d);
    return Math.atan2(-(a.y - p.y), a.x - p.x);
  };
  const d = angle(1) - angle(0), turn = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  check(turn > 0 && near(turn * 180 / Math.PI, 15, 3), `looking north the stars turn counter-clockwise about Polaris, 15 degrees an hour (${(turn * 180 / Math.PI).toFixed(1)})`);
}
check(near(dip(4), 3.52, 0.01) && near(dip(16), 7.04, 0.01) && refraction(45) > 0.9 && refraction(45) < 1.1 && refraction(5) > 9 && refraction(5) < 11, "dip is 1.76 times the root of the eye's height; refraction is 1' at 45 and 10' at 5 degrees");
check(near(NOON.dec, sunPlace(julianDate(2026, 10, 26, 12)).dec, 0.06) && NOON.lat === 49 && near(NOON.ho, 28.5, 0.05), `26 October: declination ${NOON.dec}, the noon sun at 49 N is ${NOON.ho} degrees high`);
check(near(-13 + (90 - FACTS.FIX.ho), 44, 1e-9), "the fix: latitude 44 N from Ho 33 and declination 13 S");
check(near(M.longitudeAtNoon(FACTS.FIX.g), -50, 1e-9), "the fix: 15:20 at noon is 50 W");

// ---------- the course's shape ----------
const LESSONS = lessonsOf(COURSE), steps = LESSONS.flatMap(x => x.lesson.steps.map((s, i) => ({ s, l: x.lesson.id, i })));
check(LESSONS.length >= 14 && LESSONS.length <= 18, `${LESSONS.length} lessons (14 to 18)`);
check(new Set(LESSONS.map(x => x.lesson.id)).size === LESSONS.length && LESSONS.every(x => x.lesson.title && x.lesson.steps.length), "each lesson has its own id, a title and steps");
check(steps.every(({ s }) => typeof s.say === "string" && s.say.length > 20 && s.say.length < 700), "every step has words, none too long for a phone");
check(steps.every(({ s }) => INSTRUMENTS[s.inst]), "every step names an instrument");
const bad1 = steps.filter(({ s }) => s.quiz && (!Array.isArray(s.quiz) || new Set(s.quiz).size !== s.quiz.length || !(s.answer >= 0 && s.answer < s.quiz.length) || !s.why || s.goal));
check(!bad1.length, `every quiz has distinct options, an answer in range and the words for it${bad1.length ? `: ${bad1.map(x => x.l + x.i)}` : ""}`);
const answers = steps.filter(({ s }) => s.quiz).map(({ s }) => s.answer);
check([0, 1, 2].every(k => answers.filter(a => a === k).length >= 4), `the right answers are spread over the places (${[0, 1, 2].map(k => answers.filter(a => a === k).length)})`);
check(steps.filter(({ s }) => s.goal).every(({ s }) => INSTRUMENTS[s.inst].judge || s.inst === "sky"), "every task is judged by its instrument or by the sky's tap");
check(steps.filter(({ s }) => s.goal).every(({ s }) => INSTRUMENTS[s.inst].reveal), "every task has an answer to show after two misses");
check(LESSONS.every(x => x.lesson.steps.some(s => s.quiz || s.goal) || x.lesson.id === "fix"), "every lesson ends in a check or a task");
check(!steps.some(({ s }) => /[�]|\balert\(/.test(s.say)), "no stray characters in the words");
check(["Hanse", "VOC", "East India", "Hadley", "Mercator", "Longitude Act", "Harrison", "Newton", "Brouwer"].every(w => steps.some(({ s }) => (s.say + (s.why || "")).includes(w))), "the history the brief names is in the words");

// ---------- every step's picture draws, and every task can be done and is judged ----------
const fakeSvg = html => typeof html === "string" && html.length > 50 && !/NaN|undefined|Infinity/.test(html);
let drawn = 0;
for (const { s, l, i } of steps) {
  const I = INSTRUMENTS[s.inst], v = I.init(s);
  const html = I.draw(s, v, {});
  if (!fakeSvg(html)) { check(false, `${l} step ${i + 1} draws`); continue; }
  drawn++;
}
check(drawn === steps.length, `all ${steps.length} steps draw, without a NaN`);

// ---------- instruments, driven as a finger drives them ----------
function drive(stepDef, gestures) {
  const I = INSTRUMENTS[stepDef.inst], v = I.init(stepDef);
  for (const g of gestures) {
    const [first, ...rest] = g;
    I.down(stepDef, v, first);
    for (const p of rest) I.move(stepDef, v, p);
    const res = I.up(stepDef, v, rest.at(-1) || first);
    if (res) return { v, res };
  }
  return { v };
}
const task = id => steps.find(x => x.l === id && x.s.goal)?.s;
// the astrolabe: drag the alidade to the star
{
  const s = steps.find(x => x.l === "astrolabe" && x.s.goal).s, I = INSTRUMENTS.alt, v = I.init(s);
  const [px, py] = [128, 178], ang = s.target * Math.PI / 180;
  I.down(s, v, { x: px + 100 * Math.cos(ang), y: py - 100 * Math.sin(ang) }); I.up(s, v);
  check(I.judge(s, v).ok, `the astrolabe: aimed at ${s.target} degrees reads right (${v.a})`);
  const w = I.init(s); w.a = s.target + 6;
  check(!I.judge(s, w).ok && /lower/.test(I.judge(s, w).why), "an alidade 6 degrees high is told to come down");
  I.reveal(s, w);
  check(I.judge(s, w).ok, "the astrolabe's answer, once shown, is right");
}
// the sextant: the arm to the degree, the drum to the tenth
{
  const s = steps.find(x => x.l === "sextant" && x.s.goal).s, I = INSTRUMENTS.sext, v = I.init(s);
  const deg = Math.floor(s.target), a = deg / 2 * Math.PI / 180;
  I.down(s, v, { x: 56 + 150 * Math.cos(a), y: 244 - 150 * Math.sin(a) }); I.up(s, v);
  check(v.deg === deg, `the sextant's arm takes a degree for every two it is turned (${v.deg})`);
  I.down(s, v, { x: 44 + (s.target - deg) / 0.9 * 206, y: 282 }); I.up(s, v);
  check(near(I.reading(v), s.target, 0.051) && I.judge(s, v).ok, `the drum finishes it: ${M.altText(I.reading(v))}`);
  const w = I.init(s); w.deg = deg - 4;
  check(/still above/.test(I.judge(s, w).why || "") || /swing/.test(I.judge(s, w).why || ""), "a star above the horizon asks for more");
  I.reveal(s, w);
  check(I.judge(s, w).ok, "the sextant's answer, once shown, is right");
}
// the chart: tap Luebeck
{
  const s = task("latlon"), I = INSTRUMENTS.chart, m = chartMap(s), [x, y] = m.xy(s.goal.lat, s.goal.lon), v = I.init(s);
  I.down(s, v, { x, y }); I.up(s, v);
  check(I.ready(s, v) && I.judge(s, v).ok, "the chart: a tap on 53 52 N 10 41 E is Luebeck");
  const back = m.ll(x, y);
  check(near(back.lat, s.goal.lat, 1e-6) && near(back.lon, s.goal.lon, 1e-6), "the chart's map is its own inverse");
  I.down(s, v, { x: x + 80, y: y - 40 }); I.up(s, v);
  check(/east/.test(I.judge(s, v).why) && /north/.test(I.judge(s, v).why), "a tap north and east of it is told so");
  const mm = chartMap({ proj: "merc", win: { la0: 34, la1: 58, lo0: -80, lo1: 0 } });
  const a = mm.xy(40, -40), b = mm.xy(50, -40), c = mm.xy(50, -20);
  check(near(mm.ll(...mm.xy(48, -33)).lat, 48, 1e-6), "the Mercator chart's map is its own inverse");
  check((a[1] - b[1]) > 10 * (mm.xy(34, -40)[1] - mm.xy(35, -40)[1]) * 0.9 && (b[0] === a[0]), "on the Mercator chart a meridian is a straight vertical line and a degree grows toward the pole");
  const route = steps.find(x => x.l === "merc" && x.s.route).s, rv = I.init(route);
  I.down(route, rv, { x: 150, y: 290 });
  check(rv.show.gc === true, "the great-circle chip turns the great circle on");
}
// the plot: tap where she is
for (const id of ["dr", "drift"]) {
  const ss = steps.filter(x => x.l === id && x.s.goal).map(x => x.s);
  for (const s of ss) {
    const I = INSTRUMENTS.plot, vw = plotView(s), t = I.truth(s), [x, y] = vw.xy(t), v = I.init(s);
    I.down(s, v, { x, y }); I.up(s, v);
    check(I.ready(s, v) && I.judge(s, v).ok, `the plot (${id}): a tap on her true place is right`);
    check(s.goal.tol * vw.s >= 11, `the plot (${id}): the tolerance is ${Math.round(s.goal.tol * vw.s)} units wide, a fair target for a finger`);
    if (s.cur) {
      const dr0 = M.deadReckon(s.start || [0, 0], s.legs, null), [dx, dy] = vw.xy(dr0), w = I.init(s);
      I.down(s, w, { x: dx, y: dy }); I.up(s, w);
      check(!I.judge(s, w).ok && /current/.test(I.judge(s, w).why), "the plot: forgetting the current is called out");
    }
    const w = I.init(s); I.reveal(s, w);
    check(I.judge(s, w).ok, `the plot (${id}): the answer, once shown, is right`);
  }
}
{
  const s = steps.find(x => x.s.play).s, I = INSTRUMENTS.plot, v = I.init(s), [sx, sy] = plotView(s).xy([0, 0]);
  I.down(s, v, { x: sx + 50, y: sy }); I.up(s, v);
  check(v.course === 90, "the plot's course line follows the finger round the ship, to 5 degrees");
}
// the compass: SW by W
{
  const s = task("compass"), I = INSTRUMENTS.rose, v = I.init(s), a = 236.25 * Math.PI / 180;
  I.down(s, v, { x: 180 + 80 * Math.sin(a), y: 152 - 80 * Math.cos(a) }); I.up(s, v);
  check(near(v.deg, 236.25, 0.01) && I.judge(s, v).ok, `the compass card snaps to the point: ${M.pointName(v.deg)}`);
}
// the clock: 14:20 -> 35 W, tapped on the strip
{
  const s = task("clock"), I = INSTRUMENTS.clock, v = I.init(s), x = I.xOf(s, -35);
  I.down(s, v, { x, y: 90 }); I.up(s, v);
  check(near(I.lonOf(s, x), -35, 1e-9) && I.judge(s, v).ok, "the chronometer strip: a tap on 35 W is right at 14:20");
  const w = I.init(s); w.pin = -20;
  check(/east/.test(I.judge(s, w).why), "a mark east of it is told so");
  const free = steps.find(x => x.l === "clock" && !x.s.goal && !x.s.quiz).s, f = I.init(free);
  check(I.draw(free, f, {}).includes("12:00"), "the free chronometer draws its sum");
}
// the tide: a spring day
{
  const s = task("tides"), I = INSTRUMENTS.tide, v = I.init(s);
  I.down(s, v, { x: 40 + 280 * (M.SYNODIC / 2 / 29.5), y: 278 }); I.up(s, v);
  check(near(v.age, M.SYNODIC / 2, 0.5) && I.judge(s, v).ok, "the tide: the full moon is a spring-tide day");
  v.age = 7.4;
  check(!I.judge(s, v).ok, "the tide: the first quarter is not");
}
// the sky: tap Polaris, tap the pole
{
  const s = steps.find(x => x.l === "polaris" && x.s.goal?.star).s, I = INSTRUMENTS.sky, v = I.init(s), { stars } = sky.view(s, v);
  const pol = stars.find(x => x.s === star("Polaris")), other = stars.find(x => x.s === star("Merak"));
  check(!!pol && !!other, "the sky chart shows Polaris and the Pointers");
  I.down(s, v, { x: pol.x, y: pol.y });
  check(I.up(s, v, { x: pol.x, y: pol.y })?.ok === true, "a tap on Polaris is right");
  I.down(s, v, { x: other.x, y: other.y });
  const miss = I.up(s, v, { x: other.x, y: other.y });
  check(miss?.ok === false && /Merak/.test(miss.why), "a tap on Merak is told it is Merak");
  const c = steps.find(x => x.l === "cross" && x.s.goal?.point).s, cm = sky.view(c, I.init(c)).cam, q = cm.project([0, -Math.cos(30 * Math.PI / 180), Math.sin(30 * Math.PI / 180)]);
  const cv = I.init(c);
  I.down(c, cv, { x: q.x, y: q.y });
  check(I.up(c, cv, { x: q.x, y: q.y })?.ok === true, "a tap on the south celestial pole is right");
  I.down(c, cv, { x: q.x + 60, y: q.y });
  check(I.up(c, cv, { x: q.x + 60, y: q.y })?.ok === false, "a tap well away from it is not");
  const back = cm.unproject(q.x, q.y);
  check(sep(back, [0, -Math.cos(30 * Math.PI / 180), Math.sin(30 * Math.PI / 180)]) < 0.01, "the sky's projection is its own inverse");
}
// every target star can be seen: above the horizon in its step, inside the chart, with room to tap it
{
  let all = true;
  for (const { s, l } of steps.filter(x => x.s.inst === "sky")) {
    const view = sky.view(s, sky.init(s));
    if (s.goal?.star) { const t = view.stars.find(x => x.s === star(s.goal.star)); if (!t || t.p.alt < 8) { all = false; console.log("  not visible:", l, s.goal.star); } }
    for (const n of s.names || []) if (!view.stars.find(x => x.s === star(n))) { all = false; console.log("  name not on the chart:", l, n); }
  }
  check(all, "every star a step asks for or names is up and on its chart");
}
// the corrections table agrees with Landfall's reduction
{
  const I = INSTRUMENTS.corr, s = steps.find(x => x.l === "corrections").s, r = I.rows(s.hs, s.eye);
  check(near(r.ho, observedAltitude(s.hs, s.eye), 1e-9) && near(r.dip, 3.52, 0.01), "the corrections table is Landfall's reduction");
  const q = steps.filter(x => x.l === "corrections" && x.s.quiz);
  check(q[1].s.quiz[q[1].s.answer] === M.altText(FACTS.HO) && q[0].s.quiz[q[0].s.answer] === `${dip(4).toFixed(1)}′`, "the corrections quizzes' right answers are the reduction's");
}
// the other quizzes' right answers are the sum's
{
  const A = (l, k) => { const x = steps.filter(y => y.l === l && y.s.quiz)[k].s; return x.quiz[x.answer]; };
  check(A("noon", 0) === "49° N", "the noon quiz: 49 N");
  check(A("clock", 0) === "35° E", "the clock quiz: 35 E");
  check(A("rate", 0) === "15 nm" && A("rate", 1) === "15 nm", "the rate quizzes: 15 nm at 60 N, and 15 nm for a minute of drift");
  check(A("tides", 0) === "18:25", "the tide quiz: 18:25");
  check(A("compass", 0) === "100°", "the compass quiz: 100 degrees");
  check(A("mile", 0) === "28 nm", "the log quiz: 28 nm");
  check(A("latlon", 1) === `${Math.round(M.milesPerDegLon(53.867))} nm` && Math.round(M.milesPerDegLon(53.867)) === 35, "the longitude quiz: 35 nm");
  check(A("turn", 0) === "60°" && A("cross", 0) === "30°" && A("polaris", 0) === "56° N", "the sky quizzes: 60, 30 and 56");
  check(A("sextant", 0).startsWith("Turning a mirror") && A("merc", 1) === "twice as long as at the equator", "the sextant and Mercator quizzes");
}

// ---------- saved progress ----------
{
  const mem = new Map();
  globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  check(progressOf("navigation", COURSE).done === 0 && progressOf("navigation", COURSE).next.lesson.id === LESSONS[0].lesson.id, "a new reader has done nothing, and the first lesson is next");
  mem.set("navigation:course", JSON.stringify({ done: { latlon: 1, mile: 2 }, at: null }));
  const p = progressOf("navigation", COURSE);
  check(p.done === 2 && p.of === LESSONS.length && p.next.lesson.id === LESSONS[2].lesson.id, "the lessons done are kept under navigation:course");
}

process.exit(bad ? 1 : 0);
