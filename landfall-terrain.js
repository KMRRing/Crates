// Traverse's real terrain: elevation grids and what can be seen from a point. Pure (no page, no network): the build script
// (landfall-terrain-build.mjs) uses it to work out each start's view, the page to draw the panorama and the map, the tests to
// check both. The data is the Copernicus DEM GLO-90 (ESA, free to use with attribution), cut into packs per region.
//
// A grid covers a box of latitude and longitude [w, s, e, n] with `cols` x `rows` samples, row 0 at the north edge, and holds
// heights in whole metres (Int16Array). An area of a region has a fine grid (90 m); the region has a coarse one round it (about
// 1 km) for what lies beyond the area. Packs store each grid delta-coded along its rows (each sample less the one to its west),
// which gzip shrinks to about a third.

export const EARTH = 6371000;          // metres
export const REFRACTION = 0.13;        // the standard coefficient: light bends round the earth by 0.13 of its curve
export const EYE = 1.7;                // an observer's eye above the ground, metres
const RAD = Math.PI / 180;

/** A grid from its box, size and heights. */
export const grid = (box, cols, rows, data = new Int16Array(cols * rows)) => ({ w: box[0], s: box[1], e: box[2], n: box[3], cols, rows, data });
export const inside = (g, lat, lon, margin = 0) => lon >= g.w + margin && lon <= g.e - margin && lat >= g.s + margin && lat <= g.n - margin;

/** The height at a point by bilinear interpolation (the edge sample beyond the grid). */
export function heightIn(g, lat, lon) {
  const x = Math.min(g.cols - 1, Math.max(0, (lon - g.w) / (g.e - g.w) * (g.cols - 1)));
  const y = Math.min(g.rows - 1, Math.max(0, (g.n - lat) / (g.n - g.s) * (g.rows - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(g.cols - 1, x0 + 1), y1 = Math.min(g.rows - 1, y0 + 1), fx = x - x0, fy = y - y0, d = g.data;
  const a = d[y0 * g.cols + x0], b = d[y0 * g.cols + x1], c = d[y1 * g.cols + x0], e = d[y1 * g.cols + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
}

/** A region's terrain as one lookup: the finest grid that holds the point (areas first, then the region's coarse grid), else sea level. */
export function terrain(grids) {
  const fine = grids.filter(g => g.fine), coarse = grids.filter(g => !g.fine);
  return (lat, lon) => {
    for (const g of fine) if (inside(g, lat, lon)) return Math.max(0, heightIn(g, lat, lon));
    for (const g of coarse) if (inside(g, lat, lon)) return Math.max(0, heightIn(g, lat, lon));
    return 0;
  };
}

// ---------- the sphere ----------
/** Distance in metres and initial bearing in degrees (0 north, clockwise) from one point to another. */
export function distanceBearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * RAD, p2 = lat2 * RAD, dp = p2 - p1, dl = (lon2 - lon1) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const d = 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return { d, b: (Math.atan2(y, x) / RAD + 360) % 360 };
}
/** The point `d` metres from a start on bearing `b` (degrees). */
export function destination(lat, lon, b, d) {
  const p1 = lat * RAD, l1 = lon * RAD, t = b * RAD, a = d / EARTH;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(a) + Math.cos(p1) * Math.sin(a) * Math.cos(t));
  const l2 = l1 + Math.atan2(Math.sin(t) * Math.sin(a) * Math.cos(p1), Math.cos(a) - Math.sin(p1) * Math.sin(p2));
  return [p2 / RAD, ((l2 / RAD + 540) % 360) - 180];
}
/** How far the ground falls away below a level line at distance d, the curve less what refraction gives back. */
export const drop = d => d * d / (2 * EARTH) * (1 - REFRACTION);
/** The angle (degrees) at which a point of height h at distance d stands above the observer's horizontal, eye at `eye` metres. */
export const angleTo = (eye, h, d) => Math.atan2(h - eye - drop(d), d) / RAD;

// ---------- seeing ----------
/** The step of a march outward: fine near the observer, coarser far off (the far grid is about 1 km anyway). */
const stepAt = x => x < 3000 ? 45 : x < 15000 ? 120 : x < 50000 ? 300 : 600;

/**
 * Whether the target (a summit, a hut) can be seen from the observer: nothing between stands higher, as the eye sees it, than
 * the target does. `at` is the terrain lookup; heights are the ground's, the observer's eye EYE above it.
 */
export function visible(at, from, to, { slack = 0.03 } = {}) {
  const { d, b } = distanceBearing(from.lat, from.lon, to.lat, to.lon);
  const eye = (from.h ?? at(from.lat, from.lon)) + EYE, th = to.h ?? at(to.lat, to.lon), target = angleTo(eye, th, d);
  for (let x = 30; x < d - 150; x += stepAt(x)) {
    const [la, lo] = destination(from.lat, from.lon, b, x);
    if (angleTo(eye, at(la, lo), x) > target + slack) return false;
  }
  return true;
}

/**
 * The skyline round a point: for each of `n` azimuths (from north, clockwise), the highest angle the ground reaches out to
 * `far` metres, and how far off that ridge is. Float32Arrays, so the page can draw it and the tests can check it.
 */
export function skyline(at, from, { n = 720, far = 150000 } = {}) {
  const eye = (from.h ?? at(from.lat, from.lon)) + EYE, alt = new Float32Array(n), dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const b = i * 360 / n;
    let best = -90, where = 0;
    for (let x = 30; x < far; x += stepAt(x)) {
      const [la, lo] = destination(from.lat, from.lon, b, x), a = angleTo(eye, at(la, lo), x);
      if (a > best) { best = a; where = x; }
    }
    alt[i] = best; dist[i] = where;
  }
  return { alt, dist };
}

// ---------- packs ----------
/** A grid's heights as bytes: Int16 little-endian, each sample less the one to its west (the first of a row as it is). */
export function encode(g) {
  const out = new Int16Array(g.data.length);
  for (let r = 0; r < g.rows; r++) {
    const o = r * g.cols;
    out[o] = g.data[o];
    for (let c = 1; c < g.cols; c++) out[o + c] = g.data[o + c] - g.data[o + c - 1];
  }
  return new Uint8Array(out.buffer);
}
/** The heights back from encode's bytes (already unzipped). */
export function decode(bytes, cols, rows) {
  const d = new Int16Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + cols * rows * 2));
  for (let r = 0; r < rows; r++) { const o = r * cols; for (let c = 1; c < cols; c++) d[o + c] += d[o + c - 1]; }
  return d;
}
