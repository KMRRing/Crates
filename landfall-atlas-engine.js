// Traverse's Atlas play: pure, so the page and the tests share it. A play is one start in one area: you look round, take bearings
// on landmarks you name, and put your mark on the map. The mark is scored by its distance from where you really stood; a
// landmark named right adds a side to what you know of it (mastery: landfall-atlas-mastery.js).
import { distanceBearing, destination } from "./landfall-terrain.js";

/** Stars for a fix on land, by its error in metres (the plan: three within 100 m, two within 250, one within 500). */
// 27 Nov 2026: a hand compass and a map fix to a couple of hundred metres at best, and a finger on the map is good to a few
// tens of metres only when zoomed in, so 200 m is three stars (100 m asked for a precision the tools don't have)
export const starsFor = m => m <= 200 ? 3 : m <= 500 ? 2 : m <= 1000 ? 1 : 0;

/** A seeded number generator (mulberry32), so a play is the same on every device from its seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * A new play in an area: which start, and the compass's error for it (on Hard only, up to half a degree). `weight(start)` lets mastery steer toward starts that show what you know least (1 when it has no say).
 */
export function newPlay(pack, { seed = 1, level = "medium", weight = () => 1, start = -1, cloud = 0, alti = false, lesson = "", daily = "" } = {}) {
  const r = rng(seed), ws = pack.starts.map(s => Math.max(0.01, weight(s))), total = ws.reduce((a, b) => a + b, 0);
  let x = r() * total, i = 0;
  while (i < ws.length - 1 && (x -= ws[i]) > 0) i++;
  if (start >= 0) i = start;
  // 27 Nov 2026: up to 2 degrees on Hard threw a perfect play 5 km off with far peaks; the levels differ in the air and the labels,
  // and Hard keeps only the half degree a careful hand compass errs by, which teaches what it should: near, well-spread marks
  const deviation = level === "hard" ? Math.round((r() - 0.5) * 10) / 10 : 0;
  const extra = { ...(cloud ? { cloud } : {}), ...(alti ? { alti: true } : {}), ...(lesson ? { lesson } : {}), ...(daily ? { daily } : {}) };
  return { area: pack.area, region: pack.region, start: i, seed, level, deviation, bearings: [], mark: null, done: false, ...extra };
}

/**
 * What the play's start sees: the pack's list, less the summits in cloud (a play's `cloud` is the cloud's base in metres; what
 * stands above it is lost, and chapter 8 teaches fixing without it).
 */
export const seesNow = (pack, play) => { const s = pack.starts[play.start]; return play.cloud ? s.sees.filter(i => pack.landmarks[i].ele < play.cloud - 30) : s.sees; };

/** The bearing the compass shows toward a true bearing, with the play's deviation. */
export const compassOf = (play, trueBearing) => (trueBearing - play.deviation + 360) % 360;

/** Takes a bearing: what the compass read, and which landmark you say it is (an index into the pack's landmarks, or -1). */
export function takeBearing(play, reading, named) {
  return { ...play, bearings: [...play.bearings, { reading: Math.round(reading * 10) / 10, named }] };
}
export const dropBearing = (play, i) => ({ ...play, bearings: play.bearings.filter((_, k) => k !== i) });

/**
 * The line a bearing puts you on: every point from which the landmark bears what you read, from the landmark out to `len` metres,
 * as [lat, lon] points every 2 km. Not simply the reverse bearing from the landmark: meridians close together toward the pole, so
 * the bearing back differs from the one out by up to half a degree across an area (400 m off at 50 km).
 */
export function lineOf(pack, b, len = 60000) {
  const l = pack.landmarks[b.named];
  if (!l) return null;
  const pts = [[l.lat, l.lon]];
  for (let d = 2000; d <= len; d += 2000) {
    let back = (b.reading + 180) % 360, p = destination(l.lat, l.lon, back, d);
    for (let k = 0; k < 3; k++) {                          // turn the way back until the bearing from its end to the landmark is right
      back = (back + ((b.reading - distanceBearing(p[0], p[1], l.lat, l.lon).b + 540) % 360) - 180 + 360) % 360;
      p = destination(l.lat, l.lon, back, d);
    }
    pts.push(p);
  }
  return pts;
}

/**
 * Where the lines cross best, or null with fewer than two lines that are not parallel: least squares on a map drawn round a
 * point (azimuthal equidistant, so a straight line from that point keeps its true bearing), the point moved to the answer and the
 * sum done again until it settles. Starts from the landmarks' middle: it knows nothing of where you really were. The tests' check
 * that true bearings fix a start, and the cocked hat's centre.
 */
export function crossing(pack, bearings) {
  const lines = bearings.map(b => pack.landmarks[b.named] && { l: pack.landmarks[b.named], t: b.reading * Math.PI / 180 }).filter(Boolean);
  if (lines.length < 2) return null;
  let ref = { lat: lines.reduce((a, x) => a + x.l.lat, 0) / lines.length, lon: lines.reduce((a, x) => a + x.l.lon, 0) / lines.length };
  for (let k = 0; k < 4; k++) {
    let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
    for (const { l, t } of lines) {
      const { d, b } = distanceBearing(ref.lat, ref.lon, l.lat, l.lon), px = d * Math.sin(b * Math.PI / 180), py = d * Math.cos(b * Math.PI / 180);
      const nx = Math.cos(t), ny = -Math.sin(t), c = nx * px + ny * py;        // the line's normal, and its distance from the centre
      a11 += nx * nx; a12 += nx * ny; a22 += ny * ny; b1 += nx * c; b2 += ny * c;
    }
    const det = a11 * a22 - a12 * a12;
    if (Math.abs(det) < 1e-6) return null;
    const x = (b1 * a22 - b2 * a12) / det, y = (a11 * b2 - a12 * b1) / det;
    const [lat, lon] = destination(ref.lat, ref.lon, (Math.atan2(x, y) * 180 / Math.PI + 360) % 360, Math.hypot(x, y));
    ref = { lat, lon };
  }
  return ref;
}

/** Puts your mark on the map. */
export const mark = (play, lat, lon) => ({ ...play, mark: { lat, lon } });

/**
 * The play's result once the mark is placed: how far off, the stars, and for each bearing whether its landmark was named right
 * (it is in sight, and it is within 3 degrees of what you read or the landmark in sight nearest the line you read).
 */
export function finish(pack, play) {
  const s = pack.starts[play.start], m = play.mark;
  const err = m ? distanceBearing(s.lat, s.lon, m.lat, m.lon).d : Infinity;
  const off = (b, i) => { const l = pack.landmarks[i]; return Math.abs(((b.reading - compassOf(play, distanceBearing(s.lat, s.lon, l.lat, l.lon).b) + 540) % 360) - 180); };
  const sees = seesNow(pack, play);
  const named = play.bearings.map(b => {
    if (!pack.landmarks[b.named] || !sees.includes(b.named)) return { ...b, right: false };
    const nearest = sees.reduce((a, i) => (off(b, i) < off(b, a) ? i : a), sees[0]);
    return { ...b, right: off(b, b.named) <= 3 || nearest === b.named };
  });
  return { ...play, done: true, error: Math.round(err), stars: starsFor(err), named };
}
