// The arithmetic of the Navigation course: pure functions (no page, no clock), so the lessons, the instruments and the tests
// all use the same numbers. The sky's own maths (stars, the sun, dip, refraction) is Landfall's (landfall-sky.js), imported
// and never copied; what is here is the sea's: the log, dead reckoning, the clock, charts, the moon and the tide.
// Angles are degrees, distances nautical miles (one minute of latitude, 1852 m), speeds knots (miles an hour).
import { RAD, norm180, norm360 } from "./landfall-sky.js";

const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD);
export const M_PER_NM = 1852;
export const FT_PER_NM = M_PER_NM / 0.3048;                 // 6076.12 feet
export const EARTH_NM = 180 * 60 / Math.PI;                 // the sphere on which a minute of arc is a mile (3437.7 nm, 6366.7 km): a degree is 60 nm

// ---------- the log ----------

/** The distance between the knots of a log line, in feet, for a sand glass of `glassS` seconds: a knot is a mile an hour, so a line
 *  run out for the glass pays out as many knots as the ship makes miles an hour. 28 seconds gives 47 ft 3 in. */
export const knotSpacingFt = (glassS = 28) => FT_PER_NM * glassS / 3600;
/** The knots a ship pays out in the glass at a speed in knots (the same number, to the nearest whole knot as the log reads). */
export const knotsRunOut = speed => Math.round(speed);
/** The distance run in `hours` at `knots`. */
export const runMiles = (knots, hours) => knots * hours;

// ---------- courses and bearings ----------

export const POINTS = ["N", "N by E", "NNE", "NE by N", "NE", "NE by E", "ENE", "E by N", "E", "E by S", "ESE", "SE by E", "SE", "SE by S", "SSE", "S by E",
  "S", "S by W", "SSW", "SW by S", "SW", "SW by W", "WSW", "W by S", "W", "W by N", "WNW", "NW by W", "NW", "NW by N", "NNW", "N by W"];
/** The compass has 32 points, each 11.25 degrees. */
export const POINT_DEG = 360 / 32;
export const pointName = deg => POINTS[Math.round(norm360(deg) / POINT_DEG) % 32];
export const pointDeg = name => POINTS.indexOf(name) * POINT_DEG;
/** A true course as the compass shows it: magnetic north lies `variation` degrees east (positive) or west (negative) of true north. */
export const magneticOf = (trueDeg, variation) => norm360(trueDeg - variation);
export const trueOf = (magDeg, variation) => norm360(magDeg + variation);
/** The angle between two bearings, 0 to 180. */
export const angleBetween = (a, b) => Math.abs(norm180(a - b));

// ---------- dead reckoning ----------

/** A position (nm east x, nm north y) after steering `course` at `knots` for `hours`. */
export function step([x, y], course, knots, hours) {
  const d = knots * hours;
  return [x + d * sin(course), y + d * cos(course)];
}
/** Where a run of legs [{ c, k, h }] ends, from `from`, with a current (set: the direction it flows TOWARD, drift in knots) acting the whole time. */
export function deadReckon(from, legs, current = null) {
  let p = from, hours = 0;
  for (const l of legs) { p = step(p, l.c, l.k, l.h); hours += l.h; }
  return current ? step(p, current.set, current.k, hours) : p;
}
/** The bearing and distance from one position to another: { course, nm }. */
export function bearingTo([x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  return { course: norm360(Math.atan2(dx, dy) / RAD), nm: Math.hypot(dx, dy) };
}
/** The course made good and the speed made good over the ground, from the steered vector and a current: { course, knots }. */
export function madeGood(course, knots, current) {
  const [x, y] = step(step([0, 0], course, knots, 1), current.set, current.k, 1);
  const b = bearingTo([0, 0], [x, y]);
  return { course: b.course, knots: b.nm };
}

// ---------- charts ----------

/** The Mercator chart's northing for a latitude (the isometric latitude, in radians of chart): the scale grows as sec(latitude). */
export const mercatorY = lat => Math.log(Math.tan(Math.PI / 4 + lat * RAD / 2));
/** The great-circle distance and its starting course between two places: { nm, course }. */
export function greatCircle(lat1, lon1, lat2, lon2) {
  const dl = (lon2 - lon1) * RAD, p1 = lat1 * RAD, p2 = lat2 * RAD;
  const a = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const course = norm360(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / RAD);
  return { nm: c * EARTH_NM, course };
}
/** The points of the great circle between two places, `n` steps: [{ lat, lon }]. */
export function greatCirclePoints(lat1, lon1, lat2, lon2, n = 48) {
  const p1 = lat1 * RAD, l1 = lon1 * RAD, p2 = lat2 * RAD, l2 = lon2 * RAD;
  const d = greatCircle(lat1, lon1, lat2, lon2).nm / EARTH_NM, out = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2), y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2), z = A * Math.sin(p1) + B * Math.sin(p2);
    out.push({ lat: Math.atan2(z, Math.hypot(x, y)) / RAD, lon: Math.atan2(y, x) / RAD });
  }
  return out;
}
/** The rhumb line (a constant course, a straight line on a Mercator chart) between two places: { nm, course }. */
export function rhumb(lat1, lon1, lat2, lon2) {
  const dphi = (lat2 - lat1) * RAD, dpsi = mercatorY(lat2) - mercatorY(lat1), dl = norm180(lon2 - lon1) * RAD;
  const q = Math.abs(dpsi) > 1e-12 ? dphi / dpsi : Math.cos(lat1 * RAD);
  return { nm: Math.hypot(dphi, q * dl) * EARTH_NM, course: norm360(Math.atan2(dl, dpsi) / RAD) };
}
/** Nautical miles in one degree of longitude at a latitude (60 at the equator, none at the pole). */
export const milesPerDegLon = lat => 60 * cos(lat);

// ---------- the clock ----------

/** The east longitude from the Greenwich time (hours) on the chronometer at the moment of local apparent noon: the sun is on your meridian
 *  at 12 hours local, and the earth turns 15 degrees an hour. (Allow for the equation of time, `eot` hours, as the Landfall course does.) */
export const longitudeAtNoon = (greenwichHours, eot = 0) => norm180(15 * (12 - eot - greenwichHours));
/** The Greenwich time (hours, 0 to 24) a chronometer shows at local noon on an east longitude. */
export const greenwichAtNoon = (lon, eot = 0) => (((12 - eot - lon / 15) % 24) + 24) % 24;
/** Seconds of time to degrees of longitude. */
export const secondsToDeg = s => s * 15 / 3600;
/** The miles a clock error of `errSeconds` puts a ship out in longitude, at a latitude: 15 arcseconds a second, and a degree of longitude is 60 cos(lat) miles. */
export const clockErrorMiles = (errSeconds, lat) => Math.abs(errSeconds) * 15 / 60 * cos(lat);
/** The error, in seconds, a given longitude tolerance allows: the Longitude Act's half degree is two minutes of time. */
export const secondsFor = deg => deg * 3600 / 15;
/** What a chronometer's rate (seconds gained a day; negative: lost) has built up to after `days` unmended. */
export const errorAfter = (ratePerDay, days) => ratePerDay * days;

// ---------- the moon and the tide ----------

export const SYNODIC = 29.530588861;                  // days from new moon to new moon
const NEW_MOON_JD = 2451550.09766;                    // the mean new moon of 6 January 2000, 14:21 UT (Meeus, Astronomical Algorithms, ch. 49); the true one fell at 18:14
/** The moon's age in days (0 at new moon) at a Julian date: the mean cycle, good to about half a day, which is plenty for a phase. */
export const moonAge = jd => (((jd - NEW_MOON_JD) % SYNODIC) + SYNODIC) % SYNODIC;
/** The lit fraction of the moon's disc for an age in days. */
export const litFraction = age => (1 - Math.cos(2 * Math.PI * age / SYNODIC)) / 2;
export const phaseName = age => {
  const f = age / SYNODIC;
  return f < 0.03 || f > 0.97 ? "New" : f < 0.22 ? "Waxing crescent" : f < 0.28 ? "First quarter" : f < 0.47 ? "Waxing gibbous" : f < 0.53 ? "Full"
    : f < 0.72 ? "Waning gibbous" : f < 0.78 ? "Last quarter" : "Waning crescent";
};
/** The size of the tide's range against its average for a moon of this age: the sun's tide (a little under half the moon's; here 0.4 of it) adds when
 *  the two pull along one line (new and full moon: springs) and subtracts when they pull across (the quarters: neaps). Twice a cycle. */
export const SUN_SHARE = 0.4;
export const rangeFactor = age => 1 + SUN_SHARE * Math.cos(4 * Math.PI * age / SYNODIC);
/** Whether the moon of this age is within `days` of a spring-tide moon (new or full). */
export const nearSprings = (age, days = 1.5) => Math.min(age, Math.abs(age - SYNODIC / 2), SYNODIC - age) <= days;
/** The main lunar tide comes every 12 h 25.2 min: 12.4206 hours. */
export const TIDE_HOURS = 12.4206;
/** The height of the water (metres above its mean) at `hours` after a high water, for a mean range `range` metres. */
export const tideHeight = (hours, range) => range / 2 * Math.cos(2 * Math.PI * hours / TIDE_HOURS);
/** Minutes later each day's tides come: a lunar day is 24 h 50.5 min (the moon rises that much later each day). */
export const LUNAR_DAY_MIN = 24 * 60 + 50.47;
export const tideLaterMin = LUNAR_DAY_MIN - 24 * 60;

// ---------- formats ----------

/** 53.55 -> "53° 33′ N". */
export function dms(deg, pos, neg) {
  const a = Math.abs(deg);
  let d = Math.floor(a), m = Math.round((a - d) * 60);
  if (m === 60) { d++; m = 0; }
  return `${d}° ${String(m).padStart(2, "0")}′ ${deg < 0 ? neg : pos}`;
}
export const latText = lat => dms(lat, "N", "S");
export const lonText = lon => dms(lon, "E", "W");
/** Degrees and arcminutes of an altitude: 37.4 -> "37° 24.0′". */
export function altText(deg) {
  const d = Math.floor(deg + 1e-9), m = (deg - d) * 60;
  return `${d}° ${m.toFixed(1).padStart(4, "0")}′`;
}
export const hhmm = h => {
  const t = Math.round(((h % 24) + 24) % 24 * 60);
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};
