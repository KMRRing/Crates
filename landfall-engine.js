// Landfall's voyage: a pure, seeded state machine with no page, clock or storage in it, so the same code runs in the page and in
// the bots' tests (the Game Bench pattern). The whole voyage is plain JSON (`S`) and one seed with a draw counter (`S.n`), so it
// can be saved at any point and goes on exactly where it was.
//
// A voyage is 3 to 5 WATCHES. A watch is one twilight at sea: the ship sails to it (one leg of 8 to 15 hours, set by the sun's
// altitude at the ship's true place), the navigator reads the log, steps the dividers off, finds the pole star, takes its altitude
// with the sextant, reduces it with the almanac, plots the latitude and steers on. The phases, in order:
//     ritual  the DR is penciled (dividers, or skip)       find   the sky: pick the star, check its bearing, wait
//     sight   the sextant                                    book   the reduction; plot it, retake it or throw it away
//     steer   a heading, then the next leg                   end    arrived, grounded or missed
//
// Hidden from the player: the true position T, the compass's true error, the log's, the set and drift, the horizon's error.
// Shown: the estimate E and its fog P (model.js). Every sight is a noisy measurement of one direction, folded in by a Kalman filter.
import { STARS } from "./landfall-stars.js";
import { levelById } from "./landfall-levels.js";
import { FIND } from "./landfall-finds.js";
import { draw, gaussAt, rng, vec, rad, bearing, dist, fogOf, copyP, addP, legNoise, fold, firstEvent, enters, nearest, norm180 } from "./landfall-model.js";
import {
  julianDate, starAltAz, sunAltAz, dip, refraction, sextantReading, toLatLon, fromLatLon, polarisAlmanac, sunPlace, sunReading, sunObservedAltitude,
  sunSemidiameter, sunParallax, sunAtHourAngle, noonJd, sunHourAngle, equalAltitudeLongitude, latitudeFromMeridian,
} from "./landfall-sky.js";

export const POLARIS_HR = 424;
export const BY_HR = new Map(STARS.map(s => [s[0], s]));
export const POLARIS = BY_HR.get(POLARIS_HR);
export const EYE = 3.5;                       // metres: the navigator's eye above the sea, for dip
export const DUSK_ALT = -4.5, DAWN_ALT = -11;  // the sun's altitude at which a watch begins
export const CLOCK = 12;                       // game seconds per real second while the navigator looks about
export const MAX_WAIT = 75;                    // game minutes into a watch after which the twilight is over
export const SUN = -1;                         // what a noon watch picks: the sun is not in the catalogue
export const NOON_LEAD = -10;                  // a noon watch begins at this hour angle of the sun, degrees: 40 minutes before apparent noon
export const MORNING_END = -1.5;               // a morning sight needs the sun still climbing: at the latest six minutes before noon
export const NOON_MAX = 200;                   // game minutes into a noon watch after which the day is spent
export const maxWait = S => (S.watch.kind === "noon" ? NOON_MAX : MAX_WAIT + 30);
const SIGMA_PLAYER = 0.35;                     // arcminutes: what a decent observer centres a star to, which the filter assumes
const MARKS = 3;

// ---------- time ----------

/**
 * The jd at which the sun next crosses the watch's altitude (falling for dusk, rising for dawn) after `jd`, at a place. The search
 * starts `skip` days on (a leg is never shorter than four hours), which keeps it to a few steps.
 */
export function nextCrossing(jd, kind, lat, lon, skip = 0) {
  const target = kind === "dusk" ? DUSK_ALT : DAWN_ALT, falling = kind === "dusk", f = t => sunAltAz(t, lat, lon).alt - target;
  const step = 15 / 1440;
  let a = jd + skip, fa = f(a);
  for (let i = 0; i < 2 * 24 * 4; i++) {
    const b = a + step, fb = f(b);
    if (falling ? fa > 0 && fb <= 0 : fa < 0 && fb >= 0) {
      let lo = a, hi = b;
      for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; ((falling ? f(mid) > 0 : f(mid) < 0) ? lo = mid : hi = mid); }
      return (lo + hi) / 2;
    }
    a = b; fa = fb;
  }
  return null;
}
/** The next watch of a kind: a twilight (the sun's altitude) or, for "noon", the sun forty minutes short of its transit. `skip` days on, as for nextCrossing. */
export function nextEvent(kind, jd, lat, lon, skip = 0) {
  return kind === "noon" ? sunAtHourAngle(jd + skip, lon, NOON_LEAD) : nextCrossing(jd, kind, lat, lon, skip);
}
/** The ship's bell at a ship's-time minute of the day (a multiple of 30): the strokes, by the watch system with its two dog watches. */
export function bellsAt(minuteOfDay) {
  const m = ((Math.round(minuteOfDay / 30) * 30) % 1440 + 1440) % 1440;
  if (m >= 960 && m < 1200) { const k = (m - 960) / 30; return k === 0 ? 8 : k === 4 ? 4 : k < 4 ? k : k - 4; }
  const k = (m % 240) / 30;
  return k === 0 ? 8 : k;
}
/** Local mean time in minutes since the epoch for a jd at an east longitude (the ship keeps the time of its meridian). */
export const shipMinutes = (jd, lon) => (jd - 2440587.5) * 1440 + lon * 4;
/** The bells struck between two jds at a longitude: [{ jd, bells }]. */
export function bellsBetween(jdA, jdB, lon) {
  const out = [];
  for (let h = Math.floor(shipMinutes(jdA, lon) / 30) + 1; h <= Math.floor(shipMinutes(jdB, lon) / 30); h++)
    out.push({ jd: jdA + (h * 30 - shipMinutes(jdA, lon)) / 1440, bells: bellsAt((h * 30) % 1440) });
  return out;
}
/** Ship's time as "HH:MM" for a jd at an east longitude. */
export function shipClock(jd, lon) { const m = ((Math.floor(shipMinutes(jd, lon)) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }

// ---------- the voyage ----------

export const levelOf = S => levelById(S.level);
export const sceneJd = S => S.t0 + S.watch.min / 1440;
export const truePlace = S => toLatLon(levelOf(S).origin, S.T);
export const estPlace = S => toLatLon(levelOf(S).origin, S.E);
const pickWeighted = (w, u) => { const e = Object.entries(w), tot = e.reduce((t, [, x]) => t + x, 0); let a = u * tot; for (const [k, x] of e) { a -= x; if (a < 0) return k; } return e[0][0]; };

/** A new voyage of a level from a seed. The date, the errors and the weather come from the seed; the level fixes the sea. */
export function newVoyage(levelId, seed) {
  const L = levelById(levelId);
  if (!L) throw new Error("no such level: " + levelId);
  const S = { v: 1, level: L.id, seed: seed >>> 0, n: 0 };
  const r = rng(S);
  const [[m0, d0], [m1, d1]] = L.window, a = Date.UTC(L.year, m0 - 1, d0), b = Date.UTC(L.year, m1 - 1, d1);
  const day = new Date(a + Math.floor(r.u() * ((b - a) / 86400000 + 1)) * 86400000);
  S.date = [day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate()];
  const e = L.errors, sign = () => (r.u() < 0.5 ? -1 : 1);
  S.compass = { err: sign() * (e.compass[0] + r.u() * (e.compass[1] - e.compass[0])), known: null, checks: [], sd: e.sd };
  S.logErr = e.log * 0.9 * r.g();
  S.cur = [0.8 * e.current * r.g(), 0.8 * e.current * r.g()];
  S.kinds = L.kinds.split(",");
  S.weathers = S.kinds.map(() => pickWeighted(L.weather, r.u()));
  for (const g of L.gale?.legs ?? []) if (g < S.weathers.length) S.weathers[g] = "storm";      // the watch a blow ends in is stormy (no draws: old voyages are unchanged)
  // the chronometer: it is wrong by a hidden number of seconds the reckoning only half knows (P's third row); `epsE` is what has been learned of it
  if (L.clock) { const c = L.clock; S.clock = { err: sign() * (c.err[0] + r.u() * (c.err[1] - c.err[0])) }; S.epsE = 0; }
  S.T = [0, 0];
  S.E = [e.start * r.g() * 0.6, e.start * r.g() * 0.6];
  S.P = fogOf(Math.max(0.3, e.start), L.clock ? L.clock.sd : 0);
  S.w = 0; S.watches = L.watches;
  S.trail = [{ k: "start", p: [...S.E], w: 0 }];
  S.truth = [[0, 0]];
  S.fixes = [];
  S.end = null;
  // departs so that the first dusk comes `leg0` hours later, by local mean time at the origin
  const k0 = S.kinds[0], base = julianDate(S.date[0], S.date[1], S.date[2], k0 === "dusk" ? 12 : 0) - L.origin.lon / 360;
  S.jd = nextEvent(k0, base, L.origin.lat, L.origin.lon) - L.leg0 / 24;
  S.t0 = S.jd;
  S.watch = { min: 0 };
  runLeg(S, L.course0, 1);
  return S;
}

/** Sails the true ship and the DR to the next twilight (or to what is in the way). Ends the voyage on arrival, grounding or the last watch. */
function runLeg(S, course, speedFactor) {
  const L = levelOf(S), r = rng(S), kind = S.kinds[S.w] ?? (S.kinds[S.w - 1] === "dusk" ? "dawn" : "dusk");
  const jd0 = S.w === 0 ? S.jd : sceneJd(S), T0 = S.T;
  // the set and drift: a steady part for the voyage, and a push each leg, larger along the track than across it
  const al = vec(course), ac = [al[1], -al[0]], pa = 0.85 * L.errors.current * r.g(), pc = 0.5 * L.errors.current * r.g();
  const cur = [S.cur[0] + pa * al[0] + pc * ac[0], S.cur[1] + pa * al[1] + pc * ac[1]];
  const vt = L.speed * (1 + S.logErr) * speedFactor, hdg = course + (S.compass.known ?? 0) - S.compass.err, h = vec(hdg);
  const tAt = hours => [T0[0] + hours * (vt * h[0] + cur[0]), T0[1] + hours * (vt * h[1] + cur[1])];
  let t1 = null, T1 = T0;
  for (let i = 0; i < 3; i++) {
    const p = toLatLon(L.origin, T1), c = nextEvent(kind, jd0, p.lat, p.lon, 4 / 24);
    if (c === null) { t1 = jd0 + 0.5; T1 = tAt(12); break; }
    t1 = c; T1 = tAt((t1 - jd0) * 24);
  }
  if (L.gale?.legs.includes(S.w)) { const g = L.gale.push; T1 = [T1[0] + g * r.g(), T1[1] + g * r.g()]; }          // a blow sets the ship by what the log cannot show
  if (S.clock) S.clock.err += L.clock.rate * r.g() * (t1 - jd0);                                                  // and the clock drifts a little each day
  const hours = (t1 - jd0) * 24, ev = firstEvent(L, T0, T1);
  const through = dist(T0, T1) < 1e-9 ? null : lineMiss(T0, T1, L.harbour);
  S.leg = { from: jd0, to: t1, hours, course, speed: L.speed * speedFactor, run: hours * L.speed * speedFactor };
  if (ev) {
    const t = Math.min(1, ev.t), Tend = [T0[0] + (T1[0] - T0[0]) * t, T0[1] + (T1[1] - T0[1]) * t];
    S.T = Tend; S.jd = S.t0 = jd0 + t * (t1 - jd0); S.truth.push([...Tend]);
    return finish(S, ev.kind === "harbour" ? "arrived" : "grounded", { miss: through, why: ev.kind === "shoal" ? ev.name : ev.kind === "land" ? "the coast" : null });
  }
  S.T = T1; S.truth.push([...T1]);
  // the DR: the logged speed on the course steered, for the hours run; the fog grows by what the log, the compass and the current can do
  const run = S.leg.run, dr = [S.E[0] + run * vec(course)[0], S.E[1] + run * vec(course)[1]];
  S.pre = { E: dr, P: addP(S.P, processNoise(S, course, hours, run)) };
  if (S.w >= S.watches) return finish(S, "missed", { miss: through });
  S.w += 1; S.jd = S.t0 = t1;
  const wx = S.weathers[S.w - 1];
  const day = kind === "noon";
  S.watch = {
    min: 0, picked: day ? SUN : null, marks: [], retakes: 0, bearing: null, book: null, plot: null, ritual: null, weather: wx, kind,
    hUnit: r.g(), swell: [r.u() * 6.28, r.u() * 6.28], clouds: wx === "cloud" || wx === "storm" ? (day ? makeSunClouds(r) : makeClouds(r)) : [],
    ...(day ? { sun: { m1: null, noon: null, aft: null }, stage: null } : {}),
    ...(L.lop && !day ? { lops: [], lines: [], targets: [] } : {}),
  };
  if (L.lop && !day) S.watch.targets = chooseTargets(S);
  if (L.light && !day) S.watch.light = { seen: dist(S.T, [L.light.x, L.light.y]) <= L.light.range * (wx === "haze" ? 0.7 : wx === "storm" ? 0.6 : 1), done: false };
  S.phase = "ritual";
  return { ok: true };
}
/** What a leg of `run` nm in `hours` on `course` does to the fog: the log, the compass (as far as it is known) and the current. */
function processNoise(S, course, hours, run) {
  const L = levelOf(S), e = L.errors, gale = L.gale?.legs.includes(S.w) ? L.gale.push : 0;
  const N = legNoise({ logSigma: e.log, compassSigma: S.compass.known === null ? S.compass.sd : Math.min(S.compass.sd, 0.5), current: [Math.hypot(e.current * hours, gale), Math.hypot(e.current * hours * 0.7, gale)] }, course, run);
  if (L.clock) N[2][2] = (L.clock.rate * hours / 24) ** 2;                    // the clock's drift while the leg is sailed
  return N;
}
/**
 * What steering `course` from here would promise, by the reckoning alone (not the truth): the hours to the next twilight, where the DR
 * would put the ship and the fog it would have grown. Drawn on the chart while the course is chosen.
 */
export function forecast(S, course) {
  const L = levelOf(S), kind = S.kinds[S.w] ?? (S.kinds[S.w - 1] === "dusk" ? "dawn" : "dusk");
  const jd0 = sceneJd(S), v = vec(course);
  let E1 = S.E, t1 = jd0 + 0.4;
  for (let i = 0; i < 3; i++) {
    const p = toLatLon(L.origin, E1), c = nextEvent(kind, jd0, p.lat, p.lon, 4 / 24);
    if (c === null) break;
    t1 = c; const run = (t1 - jd0) * 24 * L.speed; E1 = [S.E[0] + v[0] * run, S.E[1] + v[1] * run];
  }
  const hours = (t1 - jd0) * 24, run = hours * L.speed;
  return { hours, run, E: E1, P: addP(S.P, processNoise(S, course, hours, run)), at: t1 };
}
/** Perpendicular distance from the harbour to the line of a track: how well it was aimed. */
function lineMiss(p, q, h) {
  const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
  return Math.abs((h.x - p[0]) * dy - (h.y - p[1]) * dx) / len;
}
function finish(S, kind, info) {
  const L = levelOf(S), R = L.harbour.r;
  const stars = kind !== "arrived" ? 0 : info.miss <= 0.4 * R ? 3 : info.miss <= 0.7 * R ? 2 : 1;
  S.phase = "end";
  S.end = { kind, stars, miss: info.miss ?? null, why: info.why ?? null, errorNm: dist(S.E, S.T), watches: Math.min(S.w, S.watches) };
  return { ok: true, ended: kind };
}
/** Clouds are discs in the sky plane about Polaris: the first covers it for a while, then goes; the second comes later. */
function makeClouds(r) {
  const v = 2.2, r0 = 15 + r.u() * 4, r1 = 13 + r.u() * 4, m0 = 5 + r.u() * 6, m1 = m0 + 9 + r.u() * 6;
  return [{ x0: r0 - v * m0, y: 0, r: r0, v }, { x0: -r1 - v * m1, y: 0, r: r1, v }, { x0: -40, y: 22, r: 12, v: 1.4 }, { x0: 30 + r.u() * 20, y: -26, r: 15, v: -1.1 }];
}

/** Clouds that cross the sun: discs that pass over it at a time of their own, so that a gap is there and then is not (the hazard of the day). */
function makeSunClouds(r) {
  const out = [];
  for (let i = 0; i < 3; i++) { const v = 0.3 + r.u() * 0.25, m = 6 + r.u() * 150, rr = 4 + r.u() * 3.5; out.push({ x0: -v * m, y: (r.u() - 0.5) * 3, r: rr, v }); }
  out.push({ x0: -50 + r.u() * 20, y: 14, r: 9, v: 0.4 });          // and one that never reaches it, for the picture
  return out;
}

// ---------- what the sky is like now ----------

/** The sun, the horizon and the stars at this moment of the watch, and the noise they give a sight. */
export function conditions(S) {
  const jd = sceneJd(S), p = truePlace(S), sun = sunAltAz(jd, p.lat, p.lon).alt, wx = S.watch.weather, day = S.watch.kind === "noon";
  const haze = wx === "haze" ? 1 : wx === "storm" ? 0.8 : 0;
  const hf = sun >= -9 ? 1 : sun >= -12 ? 1 + (-9 - sun) / 3 : sun >= -16 ? 2 + (-12 - sun) : 6;
  const limMag = day ? -2 : Math.max(-2, Math.min(6.2, 2.0 + (-5.5 - sun) * 0.45)) - 0.7 * haze;
  return { jd, sun, limMag, horizon: sun >= -16 && (day || sun <= 6), horizonFactor: hf * (1 + 0.8 * haze), swell: levelOf(S).swell * (wx === "swell" ? 2 : wx === "storm" ? 2.4 : 1) * (1 + 0.25 * haze), weather: wx };
}
/** The clouds now, as discs on the sky: [{ az, alt, r }] (degrees), placed about where Polaris stands, or by day about the sun. */
export function cloudsNow(S) {
  if (!S.watch.clouds.length) return [];
  const p = truePlace(S), jd = sceneJd(S), anchor = S.watch.kind === "noon" ? sunAltAz(jd, p.lat, p.lon) : starAltAz(POLARIS, jd, p.lat, p.lon);
  const c = Math.max(0.3, Math.cos(anchor.alt * Math.PI / 180));
  return S.watch.clouds.map(d => ({ az: (anchor.az + (d.x0 + d.v * S.watch.min) / c + 360) % 360, alt: Math.max(2, anchor.alt + d.y), r: d.r }));
}
const angle = (az1, alt1, az2, alt2) => {
  const a = Math.PI / 180, x = Math.sin(alt1 * a) * Math.sin(alt2 * a) + Math.cos(alt1 * a) * Math.cos(alt2 * a) * Math.cos((az1 - az2) * a);
  return Math.acos(Math.max(-1, Math.min(1, x))) / a;
};
export const hiddenByCloud = (S, az, alt) => cloudsNow(S).some(c => angle(az, alt, c.az, c.alt) < c.r);
/** A star of the catalogue seen from the true ship now: its place, whether it can be seen, and whether a sight of it can be taken. */
export function look(S, star) {
  const p = truePlace(S), a = starAltAz(star, sceneJd(S), p.lat, p.lon), c = conditions(S);
  const bright = star[5] <= c.limMag, cloud = a.alt > 0 && hiddenByCloud(S, a.az, a.alt);
  return { ...a, visible: a.alt > 0.5 && bright && !cloud, cloud, faint: !bright };
}

// ---------- the sextant ----------

/** A sun's look from the true ship now: where it stands, and whether it can be seen (not under cloud, above the horizon). */
export function lookSun(S) {
  const p = truePlace(S), a = sunAltAz(sceneJd(S), p.lat, p.lon), cloud = a.alt > 0 && hiddenByCloud(S, a.az, a.alt);
  return { ...a, visible: a.alt > 0.5 && !cloud, cloud, faint: false };
}
/** The sd (arcminutes) of the horizon's own error at this moment, and the swell's amplitude in the eyepiece. The sun's horizon is crisp by day. */
export function sightNoise(S, star = POLARIS) {
  const c = conditions(S);
  if (star === SUN) { const l = lookSun(S); return { horizon: 0.3 * c.horizonFactor, swell: c.swell * (1 + 3 / Math.max(5, l.alt)), ok: c.horizon }; }
  const l = look(S, star), low = 1 + 3 / Math.max(5, l.alt);
  const faint = 1 + Math.max(0, 1 - (c.limMag - star[5])) * 0.8;
  return { horizon: 0.45 * c.horizonFactor * faint, swell: c.swell * low, ok: c.horizon };
}
/** The body the navigator has picked: a catalogue row, or SUN. */
export const bodyOf = S => (S.watch.picked === SUN ? SUN : BY_HR.get(S.watch.picked));
/**
 * What the sextant would read exactly (arcminutes) for the body the navigator has picked, `min` minutes into the watch (now by default):
 * the instrument's truth, and the horizon's error. For the sun it is the lower limb that is brought to the horizon.
 */
export function sextantTruth(S, min = S.watch.min) {
  const body = bodyOf(S);
  if (!body) return null;
  const p = truePlace(S), jd = S.t0 + min / 1440;
  if (body === SUN) {
    const a = sunAltAz(jd, p.lat, p.lon);
    return a.alt <= 0 ? null : sunReading(a.alt, jd, EYE) * 60 + S.watch.hUnit * sightNoise(S, SUN).horizon;
  }
  const a = starAltAz(body, jd, p.lat, p.lon);
  if (a.alt <= 0) return null;
  return sextantReading(a.alt, EYE) * 60 + S.watch.hUnit * sightNoise(S, body).horizon;
}
/** The swell's motion of the star's image in the eyepiece (arcminutes) at `sec` seconds: two slow waves, never beyond the amplitude. */
export function swellAt(S, sec) {
  const A = sightNoise(S, bodyOf(S) || POLARIS).swell, [f1, f2] = S.watch.swell;
  return A * (0.58 * Math.sin(sec * 2 * Math.PI / 5.3 + f1) + 0.42 * Math.sin(sec * 2 * Math.PI / 3.1 + f2));
}
/** The sd the filter is told for a sight of n marks (arcminutes = nautical miles of latitude). */
export function filterSigma(S, n, star = POLARIS) {
  const k = sightNoise(S, star), A = k.swell;
  return Math.sqrt(k.horizon ** 2 + (SIGMA_PLAYER ** 2 + (A / 2) ** 2) / Math.max(1, n) + 0.1 ** 2);
}
/** The almanac's reduction of a set of marks into the pole star's latitude: every line the sight book shows. */
export function reduce(S, marks) {
  const hs = marks.reduce((t, x) => t + x, 0) / marks.length, dp = dip(EYE), app = hs - dp;
  const appDeg = app / 60, rf = refraction(appDeg), ho = appDeg - rf / 60, lon = estPlace(S).lon, al = polarisAlmanac(POLARIS, sceneJd(S), lon, ho);
  return { hs, dip: dp, app, refr: rf, ho: ho * 60, lha: al.lha, pd: al.pd, corr: al.corr, lat: ho + al.corr / 60, n: marks.length };
}

// ---------- the sun: a morning altitude, the noon altitude, and the catch ----------
//
// A noon watch has three sights, in this order, each of which may be skipped or lost to cloud:
//   morning    the sun's lower limb brought to the horizon while it is still climbing; the altitude and the chronometer's time are kept
//   noon       the greatest altitude, while the sun hangs: its declination from the almanac gives the LATITUDE
//   afternoon  the drum is left where the morning sight set it; the navigator calls the moment the falling sun comes back to it. The
//              middle of the two times is apparent noon, and the chronometer's time of noon gives the LONGITUDE (equal altitudes)
// The ship is taken to lie still through the watch: the legs are sailed between watches.
const SIGMA_PLAYER_SUN = 0.35, SIGMA_REACT = 0.07;      // arcminutes of centring; game minutes of thumb (a fifth of a second at the clock's pace)

/** Which sight of the sun the watch is waiting for: "morning", "noon", "afternoon" or "done". A skipped or lost one is false. */
export function sunStage(S) {
  const s = S.watch.sun;
  return s.m1 === null ? "morning" : s.noon === null ? "noon" : s.aft === null ? "afternoon" : "done";
}
/** What the sun's place has made impossible: a morning sight once the sun has all but stopped climbing, and a catch with no morning sight to catch against. */
function settleSun(S) {
  const s = S.watch.sun;
  if (s.m1 === null && sunHourAngle(sceneJd(S), truePlace(S).lon) > MORNING_END) s.m1 = false;
  if (s.aft === null && s.m1 === false) s.aft = false;
}
/** When the navigator's reckoning puts apparent noon: the transit at the estimate's longitude (the almanac's equation of time is in it). */
export const reckonedNoonJd = S => noonJd(S.t0 + 40 / 1440, estPlace(S).lon);
/** When, by the reckoning, the falling sun comes back to the morning's altitude: as long after noon as the morning sight was before it. */
export const expectedCatchJd = S => (S.watch.sun.m1 ? 2 * reckonedNoonJd(S) - S.watch.sun.m1.jd : null);

function readSun(S, marks) {
  const W = S.watch, stage = W.stage, jd = sceneJd(S);
  if (lookSun(S).cloud) return no("the sun is behind cloud");
  if (stage === "afternoon") {
    W.sun.aft = { min: W.min, jd };
  } else {
    if (!marks.length) return no("no marks");
    const rec = { hs: marks.reduce((t, x) => t + x, 0) / marks.length, n: marks.length, min: W.min, jd };
    if (stage === "morning") W.sun.m1 = rec; else if (stage === "noon") W.sun.noon = rec; else return no("no sight is taken now");
  }
  W.marks = marks; settleSun(S);
  if (sunStage(S) === "done") { finishSun(S); return { ok: true, book: W.book, stage }; }
  S.phase = "find";
  return { ok: true, stage };
}
/** All the sights are in (or given up): the almanac reduces them, or the watch goes on to steering with nothing. */
function finishSun(S) {
  const W = S.watch, B = reduceSun(S);
  if (!B.noon && !B.lon) { W.book = null; S.phase = "steer"; W.plot = null; return; }
  W.book = B; S.phase = "book";
}
/** The almanac's reduction of the sun's sights: the latitude from the noon altitude, the longitude from the equal altitudes. Null parts were not taken. */
export function reduceSun(S) {
  const W = S.watch, s = W.sun, est = estPlace(S), out = { kind: "sun", noon: null, lon: null, sigmaLat: null, sigmaLon: null };
  if (s.noon) {
    const N = s.noon, dp = dip(EYE), app = N.hs - dp, appDeg = app / 60, rf = refraction(appDeg), sd = sunSemidiameter(N.jd);
    const topo = appDeg - rf / 60 + sd / 60, par = sunParallax(topo), ho = topo + par / 60;
    const sun = sunPlace(N.jd), south = est.lat > sun.dec, lat = latitudeFromMeridian(ho, sun.dec, south);
    out.noon = { hs: N.hs, n: N.n, dip: dp, app, refr: rf, sd, par, ho: ho * 60, dec: sun.dec, south, lat, jd: N.jd };
    const k = sightNoise(S, SUN), A = k.swell;
    out.sigmaLat = Math.sqrt(k.horizon ** 2 + (SIGMA_PLAYER_SUN ** 2 + (A / 2) ** 2) / N.n + 0.1 ** 2 + 0.35 ** 2);        // 0.35: the noon is judged by the clock, not seen
  }
  if (s.m1 && s.aft) {
    const lat0 = out.noon ? out.noon.lat : est.lat, lon = equalAltitudeLongitude(s.m1.jd, s.aft.jd, lat0, est.lon);
    if (lon !== null) {
      const mid = (s.m1.jd + s.aft.jd) / 2, tn = noonJd(mid, lon), sunN = sunPlace(tn);
      out.lon = { t1: s.m1.jd, t2: s.aft.jd, mid, tn, corr: (tn - mid) * 86400, eot: sunN.eot * 3600, lon, lat: lat0 };
      // the error of a time: the centring of the star and the swell, over how fast the image moves, at each of the two sights
      const A = sightNoise(S, SUN).swell, slope = m => Math.max(0.15, Math.abs((sextantTruth(S, m + 0.5) ?? 0) - (sextantTruth(S, m - 0.5) ?? 0)));
      const t1 = Math.sqrt(SIGMA_PLAYER_SUN ** 2 + (A / 2) ** 2 / s.m1.n) / slope(s.m1.min), t2 = Math.sqrt(SIGMA_PLAYER_SUN ** 2 + (A / 2) ** 2) / slope(s.aft.min);
      const tmid = 0.5 * Math.sqrt(t1 ** 2 + t2 ** 2 + SIGMA_REACT ** 2);         // minutes of time in the middle of the two
      out.sigmaLon = Math.max(0.3, 15 * tmid * Math.cos(lat0 * Math.PI / 180));    // a minute of time is 15′ of longitude, and a minute of longitude is cos(latitude) of a mile
    }
  }
  return out;
}
/** Folds the sun's latitude and longitude into the estimate, each through its own gate. Either may be refused and the other taken. */
function plotSun(S) {
  const W = S.watch, B = W.book, L = levelOf(S), before = { E: [...S.E], P: copyP(S.P) };
  let E = S.E, P = S.P;
  const res = { accepted: false, sun: true, latOk: false, lonOk: false };
  if (B.noon) {
    const z = (B.noon.lat - L.origin.lat) * 60 - E[1], gate = 3.5 * Math.sqrt(P[1][1] + B.sigmaLat ** 2) + 1.5;
    res.zLat = z; res.gateLat = gate;
    if (Math.abs(z) <= gate) { const f = fold(E, 0, P, [0, 1], 0, B.sigmaLat, z); E = f.E; P = f.P; res.latOk = true; res.lat = B.noon.lat; }
  }
  if (B.lon) {
    const ep = toLatLon(L.origin, E), z = fromLatLon(L.origin, ep.lat, B.lon.lon)[0] - E[0], gate = 3.5 * Math.sqrt(P[0][0] + B.sigmaLon ** 2) + 1.5;
    res.zLon = z; res.gateLon = gate;
    if (Math.abs(z) <= gate) { const f = fold(E, 0, P, [1, 0], 0, B.sigmaLon, z); E = f.E; P = f.P; res.lonOk = true; res.lon = B.lon.lon; }
  }
  res.accepted = res.latOk || res.lonOk;
  res.z = res.zLat ?? res.zLon; res.gate = res.gateLat ?? res.gateLon;
  if (!res.accepted) { res.off = true; W.plot = res; return { ok: true, accepted: false, z: res.z, gate: res.gate }; }
  S.E = E; S.P = P;
  res.before = before; res.after = { E: [...E], P: copyP(P) }; res.errorNm = dist(E, S.T);
  S.fixes.push({ w: S.w, E: [...E], lat: res.latOk ? res.lat : null, z: res.latOk ? res.zLat : 0, zLon: res.lonOk ? res.zLon : 0, hours: S.leg.hours, sun: true });
  S.trail.push({ k: "fix", p: [...E], w: S.w });
  W.plot = res;
  S.phase = "steer";
  return { ok: true, accepted: true, z: res.z };
}

// ---------- any star: the intercept ----------
// A sight of a star at a known place gives a LINE of position: the almanac says what the star's altitude should be for the reckoned place
// (Hc) and the sextant what it is (Ho); a minute of altitude is a nautical mile toward the star (the intercept, Ho - Hc) when Ho is larger.
// The line runs at right angles to the star's bearing. The chronometer's error moves Hc by the star's rate of climb, so an east or west
// star (which climbs fastest) is moved by a wrong clock and a star on the meridian is not: that is how two lines read the clock.
/** The stars worth taking this watch, brightest first and standing well apart: the first, then the one that crosses it best. */
export function chooseTargets(S) {
  const L = levelOf(S), W = S.watch, p = truePlace(S), jd = S.t0 + (W.kind === "dusk" ? 18 : 3) / 1440;
  const sun = sunAltAz(jd, p.lat, p.lon).alt, lim = Math.max(-2, Math.min(6.2, 2.0 + (-5.5 - sun) * 0.45)) - 0.7 * (W.weather === "haze" ? 1 : 0);
  const pool = L.pool ? new Set(L.pool) : null, c = [];
  for (const s of STARS) {
    if (!s[8] || s[5] > 1.8 || s[5] > lim - 0.2 || (pool && !pool.has(s[0]))) continue;
    const a = starAltAz(s, jd, p.lat, p.lon);
    if (a.alt < 22 || a.alt > 66) continue;
    c.push({ hr: s[0], az: a.az, mag: s[5], cost: s[5] + (a.alt < 28 || a.alt > 60 ? 0.6 : 0) });
  }
  c.sort((x, y) => x.cost - y.cost);
  if (!c.length) return [];
  const out = [c[0]];
  while (out.length < (L.lop || 1) && out.length < c.length) {
    const rest = c.filter(x => !out.includes(x)), sep = x => Math.abs(norm180(x.az - out[0].az));
    const score = x => x.cost + (sep(x) < 45 ? 3 : sep(x) < 60 ? 1 : sep(x) > 135 ? 0.6 : 0);
    rest.sort((x, y) => score(x) - score(y));
    out.push(rest[0]);
  }
  return out.map(x => x.hr);
}
/** How fast the star climbs (arcminutes of altitude a second, which is nautical miles a second of clock error) at a place and time. */
const climb = (star, jd, lat, lon) => starAltAz(star, jd + 30 / 86400, lat, lon).alt - starAltAz(star, jd - 30 / 86400, lat, lon).alt;
/** The almanac's reduction of the picked star's marks into an intercept: every line the sight book shows. */
export function reduceLop(S, marks) {
  const W = S.watch, star = BY_HR.get(W.picked), est = estPlace(S), jd = sceneJd(S);
  const hs = marks.reduce((t, x) => t + x, 0) / marks.length, dp = dip(EYE), app = hs - dp, appDeg = app / 60, rf = refraction(appDeg), ho = appDeg - rf / 60;
  const eps = S.clock ? S.clock.err - S.epsE : 0, jdc = jd + eps / 86400;               // the time the chronometer gives, corrected by what is known of its error
  const hc = starAltAz(star, jdc, est.lat, est.lon), z = (ho - hc.alt) * 60;
  const rate = S.clock ? climb(star, jd, est.lat, est.lon) : 0;
  return { kind: "lop", hr: star[0], hs, dip: dp, app, refr: rf, ho: ho * 60, hc: hc.alt * 60, az: hc.az, z, a: vec(hc.az), k: -rate, sigma: filterSigma(S, marks.length, star), n: marks.length, clockOff: S.clock ? S.epsE : null };
}
function plotLop(S) {
  const W = S.watch, B = W.book, L = levelOf(S), before = { E: [...S.E], P: copyP(S.P) };
  const f = fold(S.E, S.epsE ?? 0, S.P, B.a, B.k, B.sigma, B.z), gate = 3.5 * Math.sqrt(f.S) + 1.5;
  if (Math.abs(B.z) > gate) { W.plot = { accepted: false, lop: true, z: B.z, gate, off: true, hr: B.hr, az: B.az }; return { ok: true, accepted: false, z: B.z, gate }; }
  S.E = f.E; S.P = f.P; if (S.clock) S.epsE = f.epsE;
  const line = { p: [before.E[0] + B.a[0] * B.z, before.E[1] + B.a[1] * B.z], dir: [B.a[1], -B.a[0]], kind: "star", hr: B.hr };
  W.lops.push(B.hr); W.lines.push(line);
  W.plot = { accepted: true, lop: true, z: B.z, gate, before, after: { E: [...S.E], P: copyP(S.P) }, line, hr: B.hr, az: B.az, errorNm: dist(S.E, S.T), more: W.lops.length < L.lop };
  S.fixes.push({ w: S.w, E: [...S.E], lat: null, z: 0, zLon: 0, hours: S.leg.hours, lop: true });
  if (S.trail.at(-1)?.k === "fix" && S.trail.at(-1).w === S.w) S.trail.pop();         // a second line of the same watch moves the fix, it is not another
  S.trail.push({ k: "fix", p: [...S.E], w: S.w });
  W.book = null; W.marks = []; W.bearing = null;
  if (W.plot.more) { W.picked = null; W.retakes = 0; S.phase = "find"; } else S.phase = "steer";
  return { ok: true, accepted: true, z: B.z, more: W.plot.more };
}
/** A bearing of the lighthouse, corrected by what is known of the compass: a line through the light that the ship is on. */
function plotLight(S) {
  const L = levelOf(S), W = S.watch, Lg = L.light, r = rng(S), before = { E: [...S.E], P: copyP(S.P) };
  const trueB = bearing([Lg.x - S.T[0], Lg.y - S.T[1]]), sdB = 1.2, observed = (trueB + S.compass.err + sdB * r.g() + 360) % 360, b = observed - (S.compass.known ?? 0);
  const n = [Math.cos(rad(b)), -Math.sin(rad(b))], z = n[0] * (Lg.x - S.E[0]) + n[1] * (Lg.y - S.E[1]);
  const d = Math.max(2, dist(S.E, [Lg.x, Lg.y])), sigB = Math.hypot(sdB, S.compass.known === null ? S.compass.sd : Math.min(S.compass.sd, 0.5)), sigma = Math.max(0.3, d * rad(sigB));
  const f = fold(S.E, S.epsE ?? 0, S.P, n, 0, sigma, z), gate = 3.5 * Math.sqrt(f.S) + 1.5;
  W.light.done = true; W.light.bearing = observed;
  if (Math.abs(z) > gate) { W.light.off = true; W.plot = { accepted: false, light: true, z, gate, off: true }; return { ok: true, accepted: false, z, gate, observed }; }
  S.E = f.E; S.P = f.P; if (S.clock) S.epsE = f.epsE;
  const line = { p: [Lg.x, Lg.y], dir: vec(b), kind: "light" };
  W.lines = W.lines || []; W.lines.push(line);
  W.plot = { accepted: true, light: true, z, gate, before, after: { E: [...S.E], P: copyP(S.P) }, line, errorNm: dist(S.E, S.T), observed, more: true };
  S.fixes.push({ w: S.w, E: [...S.E], lat: null, z: 0, zLon: 0, hours: S.leg.hours, lop: true });
  if (S.trail.at(-1)?.k === "fix" && S.trail.at(-1).w === S.w) S.trail.pop();
  S.trail.push({ k: "fix", p: [...S.E], w: S.w });
  return { ok: true, accepted: true, z, observed };
}

// ---------- the moves ----------

/** What a phase allows. */
export function moves(S) {
  const day = S.watch.kind === "noon";
  switch (S.phase) {
    case "ritual": return ["step", "skip"];
    case "find":
      if (day) return ["wait", "raise", "skipstage", "skipsight"];
      return ["wait", "pick", ...(S.watch.picked !== null && !S.watch.bearing ? ["bearing"] : []), ...(S.watch.picked !== null ? ["raise"] : []), ...(S.watch.light?.seen && !S.watch.light.done ? ["light"] : []), "skipsight"];
    case "sight": return ["read", "lower", ...(day ? ["wait"] : [])];       // the sun moves while it is watched: the clock runs in the eyepiece
    case "book": return ["plot", "retake", "discard"];
    case "steer": return ["sail", "heave"];
    default: return [];
  }
}
const no = why => ({ ok: false, why });

/** Plays one move on S (in place). Returns { ok, ... } or { ok: false, why }. */
export function apply(S, m) {
  if (!moves(S).includes(m.t)) return no(`${m.t} is not a move in ${S.phase}`);
  const L = levelOf(S), W = S.watch;
  switch (m.t) {
    case "step": case "skip": {
      const run = S.leg.run, tol = 0.012 * run + 0.25, err = m.t === "skip" ? 0 : m.d - run;
      const off = Math.abs(err) <= tol ? 0 : err - Math.sign(err) * tol;
      const along = vec(S.leg.course), sd = m.t === "skip" ? tol : Math.abs(err) <= tol ? tol / 3 : Math.abs(err);
      S.E = [S.pre.E[0] + off * along[0], S.pre.E[1] + off * along[1]];
      const ax = along[0], ay = along[1], v = sd * sd;
      S.P = addP(S.pre.P, [[v * ax * ax, v * ax * ay, 0], [v * ax * ay, v * ay * ay, 0], [0, 0, 0]]);
      W.ritual = { err, off, skipped: m.t === "skip", tol };
      S.trail.push({ k: "dr", p: [...S.E], w: S.w });
      S.phase = "find";
      return { ok: true, err, tol };
    }
    case "wait": W.min = Math.min(maxWait(S), W.min + Math.max(0, m.min)); if (W.kind === "noon") settleSun(S); return { ok: true };
    case "skipstage": {
      settleSun(S);
      const st = sunStage(S);
      if (st === "done") return no("there is no sight of the sun left to skip");
      W.sun[{ morning: "m1", noon: "noon", afternoon: "aft" }[st]] = false;
      settleSun(S);
      if (sunStage(S) === "done") finishSun(S);
      return { ok: true, stage: st };
    }
    case "pick":
      if (!BY_HR.has(m.hr)) return no("no such star");
      if (W.lops?.includes(m.hr)) return no("that star is already in the book");
      W.picked = m.hr; return { ok: true };
    case "light": return plotLight(S);
    case "bearing": {
      const star = BY_HR.get(W.picked), l = look(S, star);
      if (!l.visible) return no("the star cannot be seen");
      // what the navigator compares the compass bearing with is where POLARIS should stand, whatever star was picked
      const r = rng(S), ep = estPlace(S), ez = starAltAz(L.lop ? star : POLARIS, sceneJd(S), ep.lat, ep.lon).az;
      const observed = (l.az + S.compass.err + 0.35 * r.g() + 360) % 360, diff = norm180(observed - ez);
      const wrong = Math.abs(diff) > 12;
      W.bearing = { observed, expected: ez, diff, wrong };
      if (!wrong) { S.compass.checks.push(diff); const n = S.compass.checks.length; S.compass.known = S.compass.checks.reduce((t, x) => t + x, 0) / n; S.compass.sd = Math.min(S.compass.sd, 0.5 / Math.sqrt(n)); }
      return { ok: true, ...W.bearing };
    }
    case "raise": {
      if (!conditions(S).horizon) return no("there is no horizon to take a sight from");
      if (W.kind === "noon") {
        settleSun(S);
        const st = sunStage(S);
        if (st === "done") return no("there is no sight of the sun left to take");
        const ls = lookSun(S);
        if (!ls.visible) return no(ls.cloud ? "the sun is behind cloud" : "the sun cannot be seen");
        W.stage = st; S.phase = "sight"; W.marks = []; return { ok: true, stage: st };
      }
      const l = look(S, BY_HR.get(W.picked));
      if (!l.visible) return no(l.cloud ? "the star is behind cloud" : "the star cannot be seen yet");
      S.phase = "sight"; W.marks = []; return { ok: true };
    }
    case "lower": S.phase = "find"; return { ok: true };
    case "skipsight": S.phase = "steer"; if (!(L.lop && W.lops?.length)) W.plot = null; return { ok: true };
    case "read": {
      const marks = (m.marks || []).filter(Number.isFinite).slice(0, MARKS);
      if (W.kind === "noon") return readSun(S, marks);
      if (!marks.length) return no("no marks");
      W.marks = marks;
      if (L.lop) W.book = reduceLop(S, marks); else { W.book = reduce(S, marks); W.book.sigma = filterSigma(S, marks.length); }
      S.phase = "book"; return { ok: true, book: W.book };
    }
    case "retake":
      if (W.kind === "noon") {                          // only the noon altitude can be taken again: the morning and the catch have passed
        if (!W.sun.noon) return no("only the noon altitude can be taken again");
        W.sun.noon = null; W.book = null; W.marks = []; W.plot = null; W.retakes += 1; S.phase = "find"; return { ok: true };
      }
      W.min += 4; W.retakes += 1; W.book = null; W.marks = []; W.plot = null; S.phase = "find"; return { ok: true };
    case "discard":
      if (L.lop) { W.book = null; W.marks = []; W.picked = null; W.retakes = 0; S.phase = "find"; return { ok: true }; }      // another star may still be taken; skipping the sight ends the watch's sights
      W.plot = { accepted: false, discarded: true }; S.phase = "steer"; return { ok: true };
    case "plot": {
      if (W.book.kind === "sun") return plotSun(S);
      if (W.book.kind === "lop") return plotLop(S);
      const B = W.book, z = (B.lat - estPlace(S).lat) * 60, gate = 3.5 * Math.sqrt(S.P[1][1] + B.sigma ** 2) + 1.5;
      if (Math.abs(z) > gate) { W.plot = { accepted: false, z, gate, off: true }; return { ok: true, accepted: false, z, gate }; }
      const before = { E: [...S.E], P: copyP(S.P) }, f = fold(S.E, 0, S.P, [0, 1], 0, B.sigma, z);
      S.E = f.E; S.P = f.P;
      W.plot = { accepted: true, z, gate, before, after: { E: [...S.E], P: copyP(S.P) }, lat: B.lat, errorNm: dist(S.E, S.T) };
      S.fixes.push({ w: S.w, E: [...S.E], lat: B.lat, z, hours: S.leg.hours });
      S.trail.push({ k: "fix", p: [...S.E], w: S.w });
      S.phase = "steer"; return { ok: true, accepted: true, z };
    }
    case "sail": case "heave": {
      const course = m.t === "heave" ? (m.course ?? 0) : ((m.course % 360) + 360) % 360;
      if (!Number.isFinite(course)) return no("no course");
      return runLeg(S, course, m.t === "heave" ? 0 : 1);
    }
  }
  return no("unknown move");
}

// ---------- helps ----------

const OCT = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
/** "low in the north-east": where to look, in words. */
export function regionWords(az, alt) {
  const o = OCT[Math.round(((az % 360) + 360) % 360 / 45) % 8];
  return `${alt < 22 ? "low" : alt > 55 ? "high" : "halfway up"} in the ${o}`;
}
/** Which way to the pole star the sky favours now: the higher of the Plough and Cassiopeia (a level may fix it). */
export function routeOf(S) {
  if (levelOf(S).route) return levelOf(S).route;
  const p = truePlace(S), jd = sceneJd(S), alt = des => starAltAz(STARS.find(s => s[2] === des), jd, p.lat, p.lon);
  return alt("α UMa").alt >= alt("α Cas").alt - 8 ? "plough" : "cassiopeia";
}
/**
 * The help at a tier (0 the most, 4 none): { tier, text, ring, figure } where `ring` is the catalogue number to ring in the sky
 * and `figure` the constellation to draw. Tier 3 gives only the bearing and the height from the DR.
 */
export function hintFor(S, tier) {
  if (levelOf(S).lop) return lopHint(S, tier);
  const route = routeOf(S), fig = route === "plough" ? "UMa" : "Cas", p = estPlace(S), jd = sceneJd(S);
  const pol = starAltAz(POLARIS, jd, p.lat, p.lon);
  const rule = route === "plough" ? "The two stars at the end of the Plough's bowl point to Polaris, five times the gap between them." : "Cassiopeia's W points to Polaris, which lies across the pole from the Plough.";
  const where = starAltAz(STARS.find(s => s[2] === (route === "plough" ? "α UMa" : "α Cas")), jd, p.lat, p.lon);
  const t = Math.max(0, Math.min(4, tier));
  if (t === 0) return { tier: 0, text: "Polaris, the pole star", ring: POLARIS_HR, figure: null, route };
  if (t === 1) return { tier: 1, text: `Polaris. ${rule}`, ring: null, figure: fig, route };
  if (t === 2) return { tier: 2, text: `Find ${route === "plough" ? "the Plough (Ursa Major)" : "Cassiopeia"}, ${regionWords(where.az, where.alt)}; it leads to the pole star.`, ring: null, figure: null, route };
  if (t === 3) return { tier: 3, text: `The pole star: ${Math.abs(norm180(pol.az)) < 4 ? "due north" : "north"}, about ${Math.round(pol.alt)}° up.`, ring: null, figure: null, route };
  return { tier: 4, text: "Find the pole star.", ring: null, figure: null, route };
}
/** The help for a level of any-star sights: the star to take next, from the almanac's own table, by tier. */
function lopHint(S, tier) {
  const W = S.watch, hr = (W.targets || []).find(h => !W.lops.includes(h)), t = Math.max(0, Math.min(4, tier));
  if (hr === undefined || t === 4) return { tier: t, text: "Take any bright star that shows: tap it.", ring: null, figure: null, route: "any" };
  const star = BY_HR.get(hr), est = estPlace(S), a = starAltAz(star, sceneJd(S), est.lat, est.lon), name = star[1] || star[2];
  if (t <= 1) return { tier: t, text: `${name}: ${FIND[hr] || "a bright star"}.`, ring: t === 0 ? hr : null, figure: null, route: "any" };
  if (t === 2) return { tier: 2, text: `Look for ${name}, ${regionWords(a.az, a.alt)}.`, ring: null, figure: null, route: "any" };
  return { tier: 3, text: `${name}: bearing ${String(Math.round(a.az)).padStart(3, "0")}°, about ${Math.round(a.alt)}° up.`, ring: null, figure: null, route: "any" };
}
/** What mastery a find earns: 0 unseen, 1 seen, 2 named with a hint, 3 found without one. Never goes down. */
export const masteryAfter = (was, tier, correct) => Math.max(was || 0, correct ? (tier <= 1 ? 2 : 3) : 1);

// ---------- saving ----------

export const save = S => JSON.stringify(S);
export function restore(text) {
  try {
    const S = JSON.parse(text);
    return S && S.v === 1 && levelById(S.level) && Array.isArray(S.T) && S.watch && S.P ? S : null;
  } catch { return null; }
}
/** Checks the invariants a played voyage keeps. Returns a list of problems (empty when sound). */
export function validate(S) {
  const bad = [], fin = a => a.every(Number.isFinite);
  if (!fin(S.T) || !fin(S.E)) bad.push("a position is not a number");
  if (!S.P.every(r => fin(r))) bad.push("the fog is not a number");
  if (S.P[0][0] < -1e-9 || S.P[1][1] < -1e-9) bad.push("the fog has a negative variance");
  if (S.P[0][0] * S.P[1][1] - S.P[0][1] ** 2 < -1e-6) bad.push("the fog is not a covariance");
  if (S.w < 0 || S.w > S.watches) bad.push("watch out of range");
  if (S.phase === "end" && !S.end) bad.push("ended without a result");
  return bad;
}
export { draw, gaussAt, enters, nearest };
