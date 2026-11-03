// The sky as data, from kb/: every star's place, size and subjects, the chart's lines, and each star's neighbours. Pure (no page,
// no WebGL), so the page and the tests build exactly the same sky, and another star field can lean on the same shapes:
// a "sky" is { n, xyz, size, weight, subjects, ... } and nothing here knows what drew it.
import { subjectsOf } from "./almanac-sky-subjects.js";
import { place } from "./almanac-sky-place.js";

/** How many segments the chart draws at most (the page keeps them in one buffer; a phone draws a few thousand easily). */
export const MAX_LINES = 4500;
/** Each star keeps this many of its shortest links as chart lines, at most: enough to see shapes, too few to be a hairball. */
const PER_STAR = 2;
/** The chart joins neighbours: a link longer than this (sky units; a region is about 30 across, the sky 200) joins far-off regions, and only its star's own focus lines show it. */
export const MAX_LENGTH = 38;

/**
 * The sky of a knowledge base.
 *   entities, links   kb/'s
 *   layout            LAYOUT (almanac-sky-layout.js)
 * Returns
 *   n         the number of stars
 *   stars     the entity index of each star (a thing that is a copy of another isn't one)
 *   rowOf     Map: entity id → star row (a copy's id gives its original's row)
 *   xyz       Float32Array(3n), the places
 *   subjects  per star, its subjects (indexes into SUBJECT_IDS), the first its main one
 *   degree    per star, how many links it has
 *   size      per star, its size in pixels at the reference distance, 2.6 to 8: the better connected, the bigger
 *   weight    per star, 0..1, the same size as a share of the largest (what a tap favours)
 *   lines     Int32Array(2m) of star rows: the chart's segments
 *   around    per star, the rows it links to (all of them, for the focus lines)
 *   kept      how many stars had their place in the layout file (the rest were put near their neighbours)
 */
export function buildSky(entities, links, layout) {
  const subj = subjectsOf(entities, links);
  const { stars, xyz, kept } = place(entities, links, subj.map(s => s[0]), layout);
  const n = stars.length, rowOf = new Map();
  stars.forEach((i, r) => rowOf.set(entities[i].id, r));
  entities.forEach(e => { if (e.same && rowOf.has(e.same)) rowOf.set(e.id, rowOf.get(e.same)); });
  const degree = new Uint16Array(n), around = Array.from({ length: n }, () => []);
  const pairs = new Set(), list = [];
  for (const l of links) {
    const a = rowOf.get(l.from), b = rowOf.get(l.to);
    if (a == null || b == null || a === b) continue;
    degree[a]++; degree[b]++;
    const key = a < b ? a * n + b : b * n + a;
    if (pairs.has(key)) continue;
    pairs.add(key);
    around[a].push(b); around[b].push(a);
    list.push(a, b);
  }
  // the chart: the shortest links first, each star keeping PER_STAR of them (a line stands if either end still has room), so lines join near neighbours
  const m = list.length / 2, length = new Float32Array(m), order = Array.from({ length: m }, (_, k) => k);
  for (let k = 0; k < m; k++) {
    const a = list[2 * k], b = list[2 * k + 1];
    length[k] = Math.hypot(xyz[3 * a] - xyz[3 * b], xyz[3 * a + 1] - xyz[3 * b + 1], xyz[3 * a + 2] - xyz[3 * b + 2]);
  }
  order.sort((p, q) => length[p] - length[q] || p - q);
  const kept2 = new Uint8Array(n), keep = [];
  for (const k of order) {
    const a = list[2 * k], b = list[2 * k + 1];
    if (length[k] > MAX_LENGTH) break;                         // sorted by length: the rest are across regions, which the chart leaves out
    if (kept2[a] >= PER_STAR && kept2[b] >= PER_STAR) continue;               // a hub keeps all its short spokes: it is the star the others are drawn to
    kept2[a]++; kept2[b]++; keep.push(a, b);
    if (keep.length >= 2 * MAX_LINES) break;
  }
  let top = 1;
  for (let r = 0; r < n; r++) top = Math.max(top, degree[r]);
  const size = new Float32Array(n), weight = new Float32Array(n);
  for (let r = 0; r < n; r++) {
    const s = Math.pow(Math.log1p(degree[r]) / Math.log1p(top), 1.4);
    size[r] = 2.6 + 5.4 * s; weight[r] = s;
  }
  return { n, stars, rowOf, xyz, subjects: stars.map(i => subj[i]), degree, size, weight, lines: Int32Array.from(keep), around, kept };
}

/** The middle of each subject's stars (by their main subject): [x, y, z] or null for a subject with none; for naming regions. */
export function regionMiddles(sky, subjectCount) {
  const sum = Array.from({ length: subjectCount }, () => [0, 0, 0, 0]);
  for (let r = 0; r < sky.n; r++) {
    const s = sum[sky.subjects[r][0]];
    s[0] += sky.xyz[3 * r]; s[1] += sky.xyz[3 * r + 1]; s[2] += sky.xyz[3 * r + 2]; s[3]++;
  }
  return sum.map(s => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3], s[3]] : null));
}
