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
import { draw, gaussAt, rng, vec, dist, fogOf, copyP, addP, legNoise, fold, firstEvent, enters, nearest, norm180 } from "./landfall-model.js";
import { julianDate, starAltAz, sunAltAz, dip, refraction, sextantReading, toLatLon, polarisAlmanac } from "./landfall-sky.js";

export const POLARIS_HR = 424;
export const BY_HR = new Map(STARS.map(s => [s[0], s]));
export const POLARIS = BY_HR.get(POLARIS_HR);
export const EYE = 3.5;                       // metres: the navigator's eye above the sea, for dip
export const DUSK_ALT = -4.5, DAWN_ALT = -11;  // the sun's altitude at which a watch begins
export const CLOCK = 12;                       // game seconds per real second while the navigator looks about
export const MAX_WAIT = 75;                    // game minutes into a watch after which the twilight is over
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
  S.T = [0, 0];
  S.E = [e.start * r.g() * 0.6, e.start * r.g() * 0.6];
  S.P = fogOf(Math.max(0.3, e.start));
  S.w = 0; S.watches = L.watches;
  S.trail = [{ k: "start", p: [...S.E], w: 0 }];
  S.truth = [[0, 0]];
  S.fixes = [];
  S.end = null;
  // departs so that the first dusk comes `leg0` hours later, by local mean time at the origin
  const noon = julianDate(S.date[0], S.date[1], S.date[2], 12) - L.origin.lon / 360;
  const dusk0 = nextCrossing(noon, "dusk", L.origin.lat, L.origin.lon);
  S.jd = dusk0 - L.leg0 / 24;
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
    const p = toLatLon(L.origin, T1), c = nextCrossing(jd0, kind, p.lat, p.lon, 4 / 24);
    if (c === null) { t1 = jd0 + 0.5; T1 = tAt(12); break; }
    t1 = c; T1 = tAt((t1 - jd0) * 24);
  }
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
  const noise = legNoise({ logSigma: L.errors.log, compassSigma: S.compass.known === null ? S.compass.sd : Math.min(S.compass.sd, 0.5), current: [L.errors.current * hours, L.errors.current * hours * 0.7] }, course, run);
  S.pre = { E: dr, P: addP(S.P, noise) };
  if (S.w >= S.watches) return finish(S, "missed", { miss: through });
  S.w += 1; S.jd = S.t0 = t1;
  const wx = S.weathers[S.w - 1];
  S.watch = {
    min: 0, picked: null, marks: [], retakes: 0, bearing: null, book: null, plot: null, ritual: null, weather: wx,
    hUnit: r.g(), swell: [r.u() * 6.28, r.u() * 6.28], clouds: wx === "cloud" ? makeClouds(r) : [],
  };
  S.phase = "ritual";
  return { ok: true };
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

// ---------- what the sky is like now ----------

/** The sun, the horizon and the stars at this moment of the watch, and the noise they give a sight. */
export function conditions(S) {
  const jd = sceneJd(S), p = truePlace(S), sun = sunAltAz(jd, p.lat, p.lon).alt, wx = S.watch.weather;
  const haze = wx === "haze" ? 1 : 0;
  const hf = sun >= -9 ? 1 : sun >= -12 ? 1 + (-9 - sun) / 3 : sun >= -16 ? 2 + (-12 - sun) : 6;
  const limMag = Math.max(-2, Math.min(6.2, 2.0 + (-5.5 - sun) * 0.45)) - 0.7 * haze;
  return { jd, sun, limMag, horizon: sun >= -16 && sun <= 6, horizonFactor: hf * (1 + 0.8 * haze), swell: levelOf(S).swell * (wx === "swell" ? 2 : 1) * (1 + 0.25 * haze), weather: wx };
}
/** The clouds now, as discs on the sky: [{ az, alt, r }] (degrees), placed about where Polaris stands. */
export function cloudsNow(S) {
  if (!S.watch.clouds.length) return [];
  const p = truePlace(S), pol = starAltAz(POLARIS, sceneJd(S), p.lat, p.lon), c = Math.max(0.3, Math.cos(pol.alt * Math.PI / 180));
  return S.watch.clouds.map(d => ({ az: (pol.az + (d.x0 + d.v * S.watch.min) / c + 360) % 360, alt: Math.max(2, pol.alt + d.y), r: d.r }));
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

/** The sd (arcminutes) of the horizon's own error at this moment, and the swell's amplitude in the eyepiece. */
export function sightNoise(S, star = POLARIS) {
  const c = conditions(S), l = look(S, star), low = 1 + 3 / Math.max(5, l.alt);
  const faint = 1 + Math.max(0, 1 - (c.limMag - star[5])) * 0.8;
  return { horizon: 0.45 * c.horizonFactor * faint, swell: c.swell * low, ok: c.horizon };
}
/** What the sextant would read exactly (arcminutes) for the star the navigator has picked: the instrument's truth, and the horizon's error. */
export function sextantTruth(S) {
  const star = BY_HR.get(S.watch.picked);
  if (!star) return null;
  const p = truePlace(S), a = starAltAz(star, sceneJd(S), p.lat, p.lon);
  if (a.alt <= 0) return null;
  return sextantReading(a.alt, EYE) * 60 + S.watch.hUnit * sightNoise(S, star).horizon;
}
/** The swell's motion of the star's image in the eyepiece (arcminutes) at `sec` seconds: two slow waves, never beyond the amplitude. */
export function swellAt(S, sec) {
  const A = sightNoise(S, BY_HR.get(S.watch.picked) || POLARIS).swell, [f1, f2] = S.watch.swell;
  return A * (0.58 * Math.sin(sec * 2 * Math.PI / 5.3 + f1) + 0.42 * Math.sin(sec * 2 * Math.PI / 3.1 + f2));
}
/** The sd the filter is told for a sight of n marks (arcminutes = nautical miles of latitude). */
export function filterSigma(S, n) {
  const k = sightNoise(S, POLARIS), A = k.swell;
  return Math.sqrt(k.horizon ** 2 + (SIGMA_PLAYER ** 2 + (A / 2) ** 2) / Math.max(1, n) + 0.1 ** 2);
}
/** The almanac's reduction of a set of marks into the pole star's latitude: every line the sight book shows. */
export function reduce(S, marks) {
  const hs = marks.reduce((t, x) => t + x, 0) / marks.length, dp = dip(EYE), app = hs - dp;
  const appDeg = app / 60, rf = refraction(appDeg), ho = appDeg - rf / 60, lon = estPlace(S).lon, al = polarisAlmanac(POLARIS, sceneJd(S), lon, ho);
  return { hs, dip: dp, app, refr: rf, ho: ho * 60, lha: al.lha, pd: al.pd, corr: al.corr, lat: ho + al.corr / 60, n: marks.length };
}

// ---------- the moves ----------

/** What a phase allows. */
export function moves(S) {
  switch (S.phase) {
    case "ritual": return ["step", "skip"];
    case "find": return ["wait", "pick", ...(S.watch.picked !== null && !S.watch.bearing ? ["bearing"] : []), ...(S.watch.picked !== null ? ["raise"] : []), "skipsight"];
    case "sight": return ["read", "lower"];
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
    case "wait": W.min = Math.min(MAX_WAIT + 30, W.min + Math.max(0, m.min)); return { ok: true };
    case "pick": if (!BY_HR.has(m.hr)) return no("no such star"); W.picked = m.hr; return { ok: true };
    case "bearing": {
      const star = BY_HR.get(W.picked), l = look(S, star);
      if (!l.visible) return no("the star cannot be seen");
      // what the navigator compares the compass bearing with is where POLARIS should stand, whatever star was picked
      const r = rng(S), ep = estPlace(S), ez = starAltAz(POLARIS, sceneJd(S), ep.lat, ep.lon).az;
      const observed = (l.az + S.compass.err + 0.35 * r.g() + 360) % 360, diff = norm180(observed - ez);
      const wrong = Math.abs(diff) > 12;
      W.bearing = { observed, expected: ez, diff, wrong };
      if (!wrong) { S.compass.checks.push(diff); const n = S.compass.checks.length; S.compass.known = S.compass.checks.reduce((t, x) => t + x, 0) / n; S.compass.sd = Math.min(S.compass.sd, 0.5 / Math.sqrt(n)); }
      return { ok: true, ...W.bearing };
    }
    case "raise": {
      if (!conditions(S).horizon) return no("there is no horizon to take a sight from");
      const l = look(S, BY_HR.get(W.picked));
      if (!l.visible) return no(l.cloud ? "the star is behind cloud" : "the star cannot be seen yet");
      S.phase = "sight"; W.marks = []; return { ok: true };
    }
    case "lower": S.phase = "find"; return { ok: true };
    case "skipsight": S.phase = "steer"; W.plot = null; return { ok: true };
    case "read": {
      const marks = (m.marks || []).filter(Number.isFinite).slice(0, MARKS);
      if (!marks.length) return no("no marks");
      W.marks = marks; W.book = reduce(S, marks); W.book.sigma = filterSigma(S, marks.length);
      S.phase = "book"; return { ok: true, book: W.book };
    }
    case "retake": W.min += 4; W.retakes += 1; W.book = null; W.marks = []; W.plot = null; S.phase = "find"; return { ok: true };
    case "discard": W.plot = { accepted: false, discarded: true }; S.phase = "steer"; return { ok: true };
    case "plot": {
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
