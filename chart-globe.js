// Chart's globe: the world seen from space, drawn by an orthographic projection of the same coordinates the flat map uses
// (so a pin tapped here scores exactly as it would there). Pure maths, no page: chart.js owns the canvas and the colours.
// A globe's view is { lon, lat, a }: the point at the middle, and a, the half-angle in degrees the picture's width
// spans (90 shows the whole near side); the flat map's opening window converts with `fromWindow`.
const RAD = Math.PI / 180, TAU = 2 * Math.PI;
export const A_MIN = 0.8, A_MAX = 90;
/** The share of the canvas the whole near side fills: room left round it for the atmosphere. */
const FILL = 0.94;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180;

// a ring's points as unit vectors (x east, y north, z towards lon 0), kept: the land is drawn on every move
const vectors = new WeakMap();
function vecsOf(pts) {
  let v = vectors.get(pts);
  if (!v) {
    v = new Float64Array(pts.length * 3);
    pts.forEach(([lon, lat], i) => { const c = Math.cos(lat * RAD); v[i * 3] = c * Math.sin(lon * RAD); v[i * 3 + 1] = Math.sin(lat * RAD); v[i * 3 + 2] = c * Math.cos(lon * RAD); });
    vectors.set(pts, v);
  }
  return v;
}
// whether a ring runs counter-clockwise seen from outside the sphere (its inside on the left): the area it encloses
// on the left, measured from the north pole, is below half the sphere's. Longitudes may wrap, so each step is the short way round.
const turning = new WeakMap();
export function counterClockwise(ring) {
  let t = turning.get(ring);
  if (t === undefined) {
    let area = 0;
    for (let i = 0; i < ring.length; i++) {
      const [l0, p0] = ring[i], [l1, p1] = ring[(i + 1) % ring.length];
      area += wrapLon(l1 - l0) * RAD * (1 - Math.sin((p0 + p1) / 2 * RAD));
    }
    t = ((area % (2 * TAU)) + 2 * TAU) % (2 * TAU) < TAU;
    turning.set(ring, t);
  }
  return t;
}
const unit = (lon, lat) => { const c = Math.cos(lat * RAD); return [c * Math.sin(lon * RAD), Math.sin(lat * RAD), c * Math.cos(lon * RAD)]; };
const angleBetween = (u, v) => Math.acos(clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1));

/** The globe's picture size: it fills the shorter side. */
export const radiusFor = (a, size) => FILL * size / 2 / Math.sin(Math.min(a, A_MAX) * RAD);

/**
 * A camera on a size × size canvas: toXY(lon, lat) gives the canvas point, or null when it is round the back; toLonLat(x, y)
 * the place under a point, or null off the globe; shape(path, ring) adds a filled outline (the part of a ring that turns
 * out of sight follows the horizon, so the land fills right to the edge); edge(path, pts, closed) adds a line, broken
 * where it goes out of sight.
 */
export function camera({ lon, lat, a }, size) {
  const R = radiusFor(a, size), cx = size / 2, cy = size / 2;
  const cl = Math.cos(lon * RAD), sl = Math.sin(lon * RAD), cp = Math.cos(lat * RAD), sp = Math.sin(lat * RAD);
  // a unit vector in the camera's frame: x right, y up, z towards the viewer (visible when z >= 0)
  const rot = (X, Y, Z, out) => { const x = X * cl - Z * sl, z1 = X * sl + Z * cl; out[0] = x; out[1] = Y * cp - z1 * sp; out[2] = Y * sp + z1 * cp; return out; };
  const toXY = (plon, plat) => {
    const [X, Y, Z] = unit(plon, plat), p = rot(X, Y, Z, [0, 0, 0]);
    return p[2] < 0 ? null : [cx + p[0] * R, cy - p[1] * R];
  };
  const toLonLat = (x, y) => {
    const u = (x - cx) / R, v = (cy - y) / R, r2 = u * u + v * v;
    if (r2 > 1) return null;
    const z = Math.sqrt(1 - r2), Y = v * cp + z * sp, z1 = -v * sp + z * cp, X = u * cl + z1 * sl, Z = -u * sl + z1 * cl;
    return [Math.atan2(X, Z) / RAD, Math.asin(clamp(Y, -1, 1)) / RAD];
  };
  /** A path's points for a ring or line, in camera space: arrays of x, y, z (z < 0 is out of sight). */
  const cams = pts => {
    const v = vecsOf(pts), n = pts.length, x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n), o = [0, 0, 0];
    for (let i = 0; i < n; i++) { rot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2], o); x[i] = o[0]; y[i] = o[1]; z[i] = o[2]; }
    return { x, y, z, n };
  };
  const sx = x => cx + x * R, sy = y => cy - y * R;
  // where the straight chord from a visible point to a hidden one crosses the horizon, on the horizon
  const cross = (c, i, j) => {
    const t = c.z[i] / (c.z[i] - c.z[j]), x = c.x[i] + t * (c.x[j] - c.x[i]), y = c.y[i] + t * (c.y[j] - c.y[i]), h = Math.hypot(x, y) || 1;
    return [x / h, y / h];
  };
  function shape(path, ring) {
    const c = cams(ring), n = c.n;
    let seen = 0, hidden = 0;
    for (let i = 0; i < n; i++) { if (c.z[i] >= 0) seen++; else hidden++; }
    if (!seen) return false;                                  // wholly round the back
    if (!hidden) {
      for (let i = 0; i < n; i++) { if (i === 0) path.moveTo(sx(c.x[i]), sy(c.y[i])); else path.lineTo(sx(c.x[i]), sy(c.y[i])); }
      path.closePath();
      return true;
    }
    // The ring's visible stretches, each from where it comes over the horizon to where it goes back. The shape of what is
    // seen is those stretches joined by arcs of the horizon: each stretch's end to the next stretch's start along the
    // horizon, in the one direction that keeps the ring's inside on the same hand (counter-clockwise for a ring running
    // counter-clockwise). Pairing by the horizon's order, not the ring's, is what keeps a ring that dips out of sight
    // and back right.
    const dir = counterClockwise(ring) ? 1 : -1, chains = [];
    let at = -1;
    for (let i = 0; i < n && at < 0; i++) if (c.z[i] < 0 && c.z[(i + 1) % n] >= 0) at = i;
    for (let k = 0, i = at; k < n; k++, i = (i + 1) % n) {
      const j = (i + 1) % n;
      if (c.z[i] < 0 && c.z[j] >= 0) chains.push({ pts: [cross(c, j, i)] });
      if (c.z[j] >= 0) { chains.at(-1).pts.push([c.x[j], c.y[j]]); }
      if (c.z[i] >= 0 && c.z[j] < 0) chains.at(-1).pts.push(cross(c, i, j));
    }
    for (const ch of chains) { const e = ch.pts[0], x = ch.pts.at(-1); ch.in = Math.atan2(e[1], e[0]); ch.out = Math.atan2(x[1], x[0]); }
    // the way round the horizon from one angle to another, in `dir`'s direction (0 up to a full turn)
    const gap = (from, to) => ((dir * (to - from)) % TAU + TAU) % TAU;
    for (const ch of chains) ch.next = chains.reduce((best, o) => (gap(ch.out, o.in) < gap(ch.out, best.in) ? o : best), chains[0]);
    const done = new Set();
    for (const start of chains) {
      if (done.has(start)) continue;
      let ch = start, first = true;
      while (!done.has(ch)) {
        done.add(ch);
        for (const [x, y] of ch.pts) { if (first) { path.moveTo(sx(x), sy(y)); first = false; } else path.lineTo(sx(x), sy(y)); }
        const sweep = dir * gap(ch.out, ch.next.in), steps = Math.ceil(Math.abs(sweep) / (5 * RAD));
        for (let s = 1; s < steps; s++) path.lineTo(sx(Math.cos(ch.out + sweep * s / steps)), sy(Math.sin(ch.out + sweep * s / steps)));
        ch = ch.next;
      }
      path.closePath();
    }
    return true;
  }
  function edge(path, pts, closed = false) {
    const c = cams(pts), n = c.n;
    let pen = false;
    const to = (x, y) => { if (pen) path.lineTo(sx(x), sy(y)); else { path.moveTo(sx(x), sy(y)); pen = true; } };
    const last = closed ? n : n - 1;
    for (let i = 0; i <= last; i++) {
      const a = i % n, vi = c.z[a] >= 0;
      if (vi) to(c.x[a], c.y[a]);
      if (i === last) break;
      const b = (i + 1) % n, vj = c.z[b] >= 0;
      if (vi && !vj) { to(...cross(c, a, b)); pen = false; }
      else if (!vi && vj) { const p = cross(c, b, a); path.moveTo(sx(p[0]), sy(p[1])); pen = true; }
    }
  }
  /** How far a place is from the middle, in degrees (past 90 it is out of sight). */
  const away = (plon, plat) => angleBetween(unit(plon, plat), unit(lon, lat)) / RAD;
  return { R, cx, cy, size, toXY, toLonLat, shape, edge, away, globe: true };
}

/** The points of the great circle between two places (for a line that follows the sphere). */
export function greatCircle(p, q, steps = 24) {
  const u = unit(p.lon, p.lat), v = unit(q.lon, q.lat), w = angleBetween(u, v), s = Math.sin(w), out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, f = s < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / s, g = s < 1e-9 ? t : Math.sin(t * w) / s;
    const x = f * u[0] + g * v[0], y = f * u[1] + g * v[1], z = f * u[2] + g * v[2];
    out.push([Math.atan2(x, z) / RAD, Math.asin(clamp(y / (Math.hypot(x, y, z) || 1), -1, 1)) / RAD]);
  }
  return out;
}

/** The whole world in view, from over Europe and Africa: no place given away. */
export const WORLD = { lon: 10, lat: 20, a: A_MAX };
/** The globe that shows a region's window [lon0, lon1, lat0, lat1] (what the flat map opens on), at least `minSpan` degrees across. */
export function fromWindow([lon0, lon1, lat0, lat1], minSpan = 1.6) {
  const lat = (lat0 + lat1) / 2, across = Math.max((lon1 - lon0) * Math.cos(lat * RAD), lat1 - lat0);
  return { lon: (lon0 + lon1) / 2, lat, a: clamp(Math.max(minSpan / 2, across / 2 * 1.1), A_MIN, A_MAX) };
}
/** The globe that shows all the points (each { lon, lat }) with room round them, at least `minSpan` degrees across. */
export function frame(points, minSpan = 12) {
  const sum = points.map(p => unit(p.lon, p.lat)).reduce((s, u) => [s[0] + u[0], s[1] + u[1], s[2] + u[2]], [0, 0, 0]), len = Math.hypot(...sum);
  const mid = len < 1e-6 ? unit(points[0].lon, points[0].lat) : sum.map(v => v / len);
  const lon = Math.atan2(mid[0], mid[2]) / RAD, lat = Math.asin(clamp(mid[1], -1, 1)) / RAD;
  const reach = Math.max(0, ...points.map(p => angleBetween(unit(p.lon, p.lat), mid) / RAD));
  return { lon, lat: clamp(lat, -85, 85), a: clamp(Math.max(minSpan / 2, reach * 1.45), A_MIN, A_MAX) };
}
/** Turned by a drag of dx, dy canvas units: the surface follows the finger at the middle. */
export function turn(g, dx, dy, size) {
  const R = radiusFor(g.a, size), k = 1 / RAD / R;
  return { ...g, lon: wrapLon(g.lon - dx * k / Math.max(0.2, Math.cos(g.lat * RAD))), lat: clamp(g.lat + dy * k, -85, 85) };
}
/** Zoomed by a pinch's factor (above 1 closes in). */
export const zoom = (g, factor) => ({ ...g, a: clamp(g.a / factor, A_MIN, A_MAX) });
