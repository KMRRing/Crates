// Carrack's globe: the world seen from space, an orthographic projection of true longitude and latitude, drawn on a canvas
// under the ports and lanes. The camera, the horizon-following land shapes and the drawing approach are Chart's
// (chart-globe.js, chart.js: copied, the camera made to fit a box that is not square), the land is Chart's shared world
// (world.js, chart-islands.js: Natural Earth, public domain). No page here: carrack-board.js owns the canvas and the touches.
// A view is { lon, lat, a }: the point at the middle, and a, the half-angle in degrees the picture's width spans.
import { LAND, BORDERS } from "./world.js";
import { ISLANDS, ISLAND_DOTS } from "./chart-islands.js";
import { PORTS, GVIA } from "./carrack-map.js";

const RAD = Math.PI / 180, TAU = 2 * Math.PI;
export const A_MIN = 7, A_MAX = 90, LAT_MIN = -62, LAT_MAX = 78;
/** What the opening view shows: the whole trade, Lisbon to Nagasaki, from over the Arabian Sea. */
export const HOME = { lon: 64, lat: 24, a: 76 };
const FILL = 0.94;                                  // the share of the box the whole near side fills: room round it for the air
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180;
const unit = (lon, lat) => { const c = Math.cos(lat * RAD); return [c * Math.sin(lon * RAD), Math.sin(lat * RAD), c * Math.cos(lon * RAD)]; };
const angleBetween = (u, v) => Math.acos(clamp(u[0] * v[0] + u[1] * v[1] + u[2] * v[2], -1, 1));

/** The globe's picture size: the width spans `a` degrees, so a short, wide box shows a band of the globe, not a small ball. */
export const radiusFor = (a, w, h) => FILL * Math.min(w, 1.3 * h) / 2 / Math.sin(Math.min(a, A_MAX) * RAD);

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
// whether a ring runs counter-clockwise seen from outside the sphere (its inside on the left)
const turning = new WeakMap();
function counterClockwise(ring) {
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

/**
 * A camera on a w × h box: toXY(lon, lat) is the box point, or null round the back; toLonLat(x, y) the place under a
 * point, or null off the globe; shape(path, ring) adds a filled outline (the part of a ring that turns out of sight follows
 * the horizon, so land fills right to the edge); edge(path, pts, closed) a line, broken where it goes out of sight.
 */
export function camera({ lon, lat, a }, w, h) {
  const R = radiusFor(a, w, h), cx = w / 2, cy = h / 2;
  const cl = Math.cos(lon * RAD), sl = Math.sin(lon * RAD), cp = Math.cos(lat * RAD), sp = Math.sin(lat * RAD);
  const rot = (X, Y, Z, out) => { const x = X * cl - Z * sl, z1 = X * sl + Z * cl; out[0] = x; out[1] = Y * cp - z1 * sp; out[2] = Y * sp + z1 * cp; return out; };
  const toXY = (plon, plat) => {
    const [X, Y, Z] = unit(plon, plat), p = rot(X, Y, Z, [0, 0, 0]);
    return p[2] < 0 ? null : [cx + p[0] * R, cy - p[1] * R];
  };
  const cams = pts => {
    const v = vecsOf(pts), n = pts.length, x = new Float64Array(n), y = new Float64Array(n), z = new Float64Array(n), o = [0, 0, 0];
    for (let i = 0; i < n; i++) { rot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2], o); x[i] = o[0]; y[i] = o[1]; z[i] = o[2]; }
    return { x, y, z, n };
  };
  const sx = x => cx + x * R, sy = y => cy - y * R;
  const cross = (c, i, j) => {
    const t = c.z[i] / (c.z[i] - c.z[j]), x = c.x[i] + t * (c.x[j] - c.x[i]), y = c.y[i] + t * (c.y[j] - c.y[i]), hy = Math.hypot(x, y) || 1;
    return [x / hy, y / hy];
  };
  function shape(path, ring) {
    const c = cams(ring), n = c.n;
    let seen = 0, hidden = 0;
    for (let i = 0; i < n; i++) { if (c.z[i] >= 0) seen++; else hidden++; }
    if (!seen) return false;
    if (!hidden) {
      for (let i = 0; i < n; i++) { if (i === 0) path.moveTo(sx(c.x[i]), sy(c.y[i])); else path.lineTo(sx(c.x[i]), sy(c.y[i])); }
      path.closePath();
      return true;
    }
    // the visible stretches joined by arcs of the horizon, in the direction that keeps the ring's inside on the same hand
    const dir = counterClockwise(ring) ? 1 : -1, chains = [];
    let at = -1;
    for (let i = 0; i < n && at < 0; i++) if (c.z[i] < 0 && c.z[(i + 1) % n] >= 0) at = i;
    for (let k = 0, i = at; k < n; k++, i = (i + 1) % n) {
      const j = (i + 1) % n;
      if (c.z[i] < 0 && c.z[j] >= 0) chains.push({ pts: [cross(c, j, i)] });
      if (c.z[j] >= 0) chains.at(-1).pts.push([c.x[j], c.y[j]]);
      if (c.z[i] >= 0 && c.z[j] < 0) chains.at(-1).pts.push(cross(c, i, j));
    }
    for (const ch of chains) { const e = ch.pts[0], x = ch.pts.at(-1); ch.in = Math.atan2(e[1], e[0]); ch.out = Math.atan2(x[1], x[0]); }
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
  /** The place's distance from the middle, in degrees (past 90 it is out of sight). */
  const away = (plon, plat) => angleBetween(unit(plon, plat), unit(lon, lat)) / RAD;
  return { R, cx, cy, w, h, toXY, shape, edge, away };
}

/** The points of the great circle between two places (the shortest way over the sphere). */
export function greatCircle(p, q, steps = 24) {
  const u = unit(p[0], p[1]), v = unit(q[0], q[1]), w = angleBetween(u, v), s = Math.sin(w), out = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, f = s < 1e-9 ? 1 - t : Math.sin((1 - t) * w) / s, g = s < 1e-9 ? t : Math.sin(t * w) / s;
    const x = f * u[0] + g * v[0], y = f * u[1] + g * v[1], z = f * u[2] + g * v[2];
    out.push([Math.atan2(x, z) / RAD, Math.asin(clamp(y / (Math.hypot(x, y, z) || 1), -1, 1)) / RAD]);
  }
  return out;
}
const degrees = (p, q) => angleBetween(unit(p[0], p[1]), unit(q[0], q[1])) / RAD;

/** A lane's line over the sphere: a great circle from port to port through its `via` points (a lane the shortest way over
 *  the globe would cut across land goes round the headland by those), a point every 2.5 degrees. Cached: it never changes. */
const lanes = [];
export function laneLine(l) {
  if (lanes[l.i]) return lanes[l.i];
  const a = PORTS[l.a], b = PORTS[l.b];
  const via = GVIA[`${a.id}-${b.id}`] || [];
  const stops = [[a.lon, a.lat], ...via, [b.lon, b.lat]], out = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const seg = greatCircle(stops[i], stops[i + 1], Math.max(2, Math.ceil(degrees(stops[i], stops[i + 1]) / 2.5)));
    out.push(...(i ? seg.slice(1) : seg));
  }
  return (lanes[l.i] = out);
}

/** Turned by a drag of dx, dy box units: the surface follows the finger at the middle. */
export function turn(g, dx, dy, w, h) {
  const k = 1 / RAD / radiusFor(g.a, w, h);
  return { ...g, lon: wrapLon(g.lon - dx * k / Math.max(0.3, Math.cos(g.lat * RAD))), lat: clamp(g.lat + dy * k, LAT_MIN, LAT_MAX) };
}
/** Zoomed by a pinch's factor (above 1 closes in). */
export const zoom = (g, factor) => ({ ...g, a: clamp(g.a / factor, A_MIN, A_MAX) });
/** The view that shows all the points ([lon, lat]) with room round them, at least `minSpan` degrees across. */
export function frame(points, minSpan = 26) {
  const us = points.map(p => unit(p[0], p[1])), sum = us.reduce((s, u) => [s[0] + u[0], s[1] + u[1], s[2] + u[2]], [0, 0, 0]), len = Math.hypot(...sum);
  const mid = len < 1e-6 ? us[0] : sum.map(v => v / len);
  const reach = Math.max(0, ...us.map(u => angleBetween(u, mid) / RAD));
  return { lon: Math.atan2(mid[0], mid[2]) / RAD, lat: clamp(Math.asin(clamp(mid[1], -1, 1)) / RAD, LAT_MIN, LAT_MAX), a: clamp(Math.max(minSpan / 2, reach * 1.7), A_MIN, A_MAX) };
}
/** The shortest way from one view to another, a fraction t of it (for a smooth turn). */
export const between = (g, h, t) => ({ lon: wrapLon(g.lon + wrapLon(h.lon - g.lon) * t), lat: g.lat + (h.lat - g.lat) * t, a: g.a * Math.pow(h.a / g.a, t) });

// ---------- land: where a place is, for the tests ----------
const inRing = (ring, lon, lat) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Whether a place is on land (Natural Earth 110 m, with the islands the coarse map leaves out). */
export function onLand(lon, lat) {
  landBoxes ??= { land: LAND.map(p => boxOf(p[0])), isles: ISLANDS.map(p => boxOf(p[0])) };
  const near = (b, x, y) => x >= b[0] && x <= b[1] && y >= b[2] && y <= b[3];
  for (let i = 0; i < LAND.length; i++) { const poly = LAND[i]; if (near(landBoxes.land[i], lon, lat) && inRing(poly[0], lon, lat) && !poly.slice(1).some(h => inRing(h, lon, lat))) return true; }
  for (let i = 0; i < ISLANDS.length; i++) if (near(landBoxes.isles[i], lon, lat) && inRing(ISLANDS[i][0], lon, lat)) return true;
  return false;
}
let landBoxes = null;
function boxOf(ring) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of ring) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return [x0, x1, y0, y1]; }
/** How far the nearest coast is from a place, in degrees (0 on land, and for a lane's sea cell the shortest way to land). */
export function coastDistance(lon, lat) {
  if (onLand(lon, lat)) return 0;
  let best = Infinity;
  const k = Math.cos(lat * RAD);
  const look = ring => {
    for (let i = 0; i < ring.length; i++) {
      const [x, y] = ring[i], dx = wrapLon(x - lon) * k, dy = y - lat, d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
  };
  for (const poly of LAND) { const r = poly[0]; if (r.some(([x, y]) => Math.abs(wrapLon(x - lon)) < 12 && Math.abs(y - lat) < 12)) look(r); }
  for (const poly of ISLANDS) look(poly[0]);
  for (const [x, y] of ISLAND_DOTS) { const dx = wrapLon(x - lon) * k, dy = y - lat; best = Math.min(best, dx * dx + dy * dy); }
  return Math.sqrt(best);
}

// ---------- seas and oceans, named: [name, lon, lat, size] (size 0 an ocean, 1 a sea) ----------
export const WATERS = [
  ["ATLANTIC OCEAN", -26, 24, 0], ["INDIAN OCEAN", 78, -14, 0], ["PACIFIC OCEAN", 150, 18, 0],
  ["NORTH SEA", 3.2, 56.2, 1], ["BALTIC", 19.5, 57.6, 1], ["MEDITERRANEAN", 18, 34.6, 1], ["ARABIAN SEA", 64, 15.5, 1],
  ["BAY OF BENGAL", 88, 13, 1], ["SOUTH CHINA SEA", 113.5, 12.5, 1], ["EAST CHINA SEA", 124.5, 28.2, 1], ["RED SEA", 38.4, 20.2, 1],
  ["GULF OF GUINEA", 3, 2.5, 1], ["MOZAMBIQUE CHANNEL", 41.5, -17, 1],
];

// ---------- drawing ----------
/**
 * The Earth from space on a canvas context already scaled to the box's logical units: a sea disc, its coasts lined in
 * the shallows, the land, a graticule in brass hairlines, a shade towards the edge so it reads as a ball. Gradients and
 * stacked strokes only (no SVG filter: Safari blurs them). `pal` holds the colours: space, sea, shallows, land, coast, grid, rim.
 */
export function drawWorld(ctx, cam, view, pal) {
  const { cx, cy, R, w, h } = cam, a = view.a;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = pal.space;
  ctx.fillRect(0, 0, w, h);
  const disc = () => { ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); };
  if (R < Math.max(w, h) * 0.75) {                              // the whole near side nearly in view: its air
    ctx.strokeStyle = pal.air; ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.34 - i * 0.08; ctx.beginPath(); ctx.arc(cx, cy, R + 1 + i * 2, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  disc(); ctx.fillStyle = pal.sea; ctx.fill();
  ctx.save(); disc(); ctx.clip();
  const land = new Path2D(), isles = new Path2D(), coast = new Path2D(), specks = new Path2D(), SPECK = 1.5;
  for (const poly of LAND) for (const ring of poly) cam.shape(land, ring);
  for (const run of shoreRuns()) cam.edge(coast, run);
  const speck = (lon, lat) => { const p = cam.toXY(lon, lat); if (p) { specks.moveTo(p[0] + SPECK, p[1]); specks.arc(p[0], p[1], SPECK, 0, TAU); } };
  ISLANDS.forEach((poly, k) => {
    const b = islandBox(k), lon = (b[0] + b[1]) / 2, lat = (b[2] + b[3]) / 2;
    if (cam.away(lon, lat) > 100) return;
    if (Math.max((b[1] - b[0]) * Math.cos(lat * RAD), b[3] - b[2]) * RAD * R < 2 * SPECK) { if (poly[1]) speck(lon, lat); return; }
    if (cam.shape(isles, poly[0])) cam.edge(coast, poly[0], true);
  });
  for (const [lon, lat] of ISLAND_DOTS) speck(lon, lat);
  // the shallows: the coast stroked wide and faint, then narrower, under the land, so the sea is lined along every shore
  ctx.lineJoin = "round"; ctx.strokeStyle = pal.shallows;
  for (const [lw, al] of [[9, 0.16], [5.5, 0.2], [2.8, 0.28]]) { ctx.globalAlpha = al; ctx.lineWidth = lw; ctx.stroke(coast); }
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.land;
  ctx.fill(land, "evenodd"); ctx.fill(isles); ctx.fill(specks);
  ctx.strokeStyle = pal.coast; ctx.lineWidth = a > 45 ? 1 : 1.3; ctx.stroke(coast);
  ctx.lineWidth = 1; ctx.stroke(specks);
  // the graticule, only where it is in view
  const step = a > 50 ? 15 : a > 22 ? 10 : a > 10 ? 5 : 2, ds = Math.max(0.5, Math.min(3, a / 8));
  const lonReach = Math.min(180, a * 2 / Math.max(0.1, Math.cos(view.lat * RAD)) + step), latReach = Math.min(90, a * 2 + step);
  const grid = new Path2D();
  for (let lon = Math.ceil((view.lon - lonReach) / step) * step; lon <= view.lon + lonReach; lon += step) {
    const pts = []; for (let lat = Math.max(-90, view.lat - latReach); lat <= Math.min(90, view.lat + latReach); lat += ds) pts.push([lon, lat]);
    cam.edge(grid, pts);
  }
  for (let lat = Math.ceil(Math.max(-90, view.lat - latReach) / step) * step; lat <= Math.min(90, view.lat + latReach); lat += step) {
    const pts = []; for (let lon = view.lon - lonReach; lon <= view.lon + lonReach; lon += ds) pts.push([lon, lat]);
    cam.edge(grid, pts);
  }
  ctx.strokeStyle = pal.grid; ctx.lineWidth = 0.7; ctx.stroke(grid);
  const shade = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  shade.addColorStop(0, "rgba(0,0,0,0)"); shade.addColorStop(0.62, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,12,20,.38)");
  ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (R < Math.max(w, h) * 0.75) { disc(); ctx.strokeStyle = pal.rim; ctx.lineWidth = 1.2; ctx.stroke(); }
}
// each island's box, computed once
let boxes = null;
const islandBox = k => (boxes ??= ISLANDS.map(([ring]) => boxOf(ring)))[k];

// The coast is what is left of a country's outline when the borders are taken away: no modern borders on a map of 1480 to 1650.
// A border is the edge two country polygons share (BORDERS has each as a line), so those edges are left out of the strokes.
let shore = null;
export function shoreRuns() {
  if (shore) return shore;
  const key = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]) ? `${a}|${b}` : `${b}|${a}`), inner = new Set();
  for (const line of BORDERS) for (let i = 0; i + 1 < line.length; i++) inner.add(key(line[i], line[i + 1]));
  shore = [];
  for (const poly of LAND) for (const ring of poly) {
    let run = [ring[0]];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      if (inner.has(key(a, b))) { if (run.length > 1) shore.push(run); run = [b]; } else run.push(b);
    }
    if (run.length > 1) shore.push(run);
  }
  shore = shore.filter(r => r.some(q => q[0] !== r[0][0] || q[1] !== r[0][1]));   // a border's corner leaves a run of one point twice
  return shore;
}
