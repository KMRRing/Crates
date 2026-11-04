// The History of trade course's maps: Natural Earth's land (world.js, public domain) cut to a window of the world, with the lesson's places
// as named dots and its routes as dashed lines. Equirectangular, scaled by the cosine of the window's middle latitude so a shape is not
// stretched. A window that runs past 180 degrees east (the Pacific) draws the land twice and puts western-hemisphere places on the far side.
// Nothing here is drawn in a picture file: it works with no connection.
import { LAND } from "./world.js";
import { OWN_BY_ID } from "./trade-places.js";
import { KB_PLACES } from "./trade-kb.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const KB_BY_ID = new Map(KB_PLACES.map(([id, name, lat, lon, note, country]) => [id, { id, name, lat, lon, note, country }]));
/** A place by id: { id, name, lat, lon, note?, country? }, or null. */
export const placeOf = id => OWN_BY_ID.get(id) || KB_BY_ID.get(id) || null;
/** The name as written on a map: kb/'s "Samarkand, Timur's capital" is "Samarkand" there. */
export const shortName = p => p.name.replace(/, .*$/, "");

const f = n => Math.round(n * 100) / 100;
/** The window's longitude of a place: past 180 east, the western hemisphere is on the far side. */
export const lonIn = (lon, [w, , e]) => (lon < w && lon + 360 <= e ? lon + 360 : lon);
/** Whether a place lies inside a window (the test uses it to keep every dot on its map). */
export const inView = (p, view) => { const [, s, , n] = view, x = lonIn(p.lon, view); return x >= view[0] && x <= view[2] && p.lat >= s && p.lat <= n; };

const landCache = new Map();
let mapCount = 0;                       // a clip path needs an id that is its own on the page
function landPath(view, kx) {
  const key = `${view.join()}|${kx}`;
  if (landCache.has(key)) return landCache.get(key);
  const [w, s, e, n] = view, out = [];
  const shifts = e > 180 ? [0, 360] : [0];
  for (const shift of shifts) {
    for (const poly of LAND) {
      const ring = poly[0];
      let lo = 1e9, hi = -1e9, la = 1e9, lb = -1e9;
      for (const [x, y] of ring) { if (x < lo) lo = x; if (x > hi) hi = x; if (y < la) la = y; if (y > lb) lb = y; }
      if (hi + shift < w || lo + shift > e || lb < s || la > n) continue;
      for (const r of poly) out.push("M" + r.map(([x, y]) => `${f((x + shift) * kx)} ${f(-y)}`).join("L") + "Z");
    }
  }
  const d = out.join("");
  landCache.set(key, d);
  if (landCache.size > 40) landCache.delete(landCache.keys().next().value);
  return d;
}

/**
 * Where each place's dot and name go: the name to the right of its dot, else the left, above or below, the first spot that overlaps no other
 * name and no dot and stays on the map; a place that has none gets a dot only (tapping it says its name). Used by mapSvg and by the test.
 */
export function layout(view, pts, labels = true) {
  const [w, s, e, n] = view, kx = Math.max(0.45, Math.cos(((s + n) / 2) * Math.PI / 180)), box0 = w * kx, bw = (e - w) * kx, bh = n - s, unit = bw / 100;
  const r = unit * 0.95, fs = unit * 2.9, dots = [], out = [], placed = [];
  const list = pts.map(placeOf).filter(Boolean);
  for (const p of list) dots.push({ x: lonIn(p.lon, view) * kx, y: -p.lat });
  const hit = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  list.forEach((p, i) => {
    const { x, y } = dots[i], tw = shortName(p).length * fs * 0.56 + fs * 0.4, gap = r * 1.9;
    const cands = [
      { anchor: "start", lx: x + gap, ly: y + fs * 0.34, b: { x0: x + gap, x1: x + gap + tw, y0: y - fs * 0.62, y1: y + fs * 0.62 } },
      { anchor: "end", lx: x - gap, ly: y + fs * 0.34, b: { x0: x - gap - tw, x1: x - gap, y0: y - fs * 0.62, y1: y + fs * 0.62 } },
      { anchor: "middle", lx: x, ly: y - gap - fs * 0.15, b: { x0: x - tw / 2, x1: x + tw / 2, y0: y - gap - fs * 1.1, y1: y - gap + fs * 0.2 } },
      { anchor: "middle", lx: x, ly: y + gap + fs * 0.85, b: { x0: x - tw / 2, x1: x + tw / 2, y0: y + gap - fs * 0.1, y1: y + gap + fs * 1.1 } },
    ];
    let label = null;
    if (labels) for (const c of cands) {
      const b = c.b;
      if (b.x0 < box0 || b.x1 > box0 + bw || b.y0 < -n || b.y1 > -n + bh) continue;
      if (placed.some(q => hit(b, q))) continue;
      if (dots.some((d, j) => j !== i && hit(b, { x0: d.x - r, x1: d.x + r, y0: d.y - r, y1: d.y + r }))) continue;
      label = c; placed.push(b); break;
    }
    out.push({ id: p.id, x, y, label });
  });
  return { items: out, r, fs, box: [box0, -n, bw, bh], unit };
}
/** The places on a map that cannot be given a name without overlap (the test keeps every lesson's map readable). */
export const unnamed = (view, pts) => layout(view, pts).items.filter(i => !i.label).map(i => i.id);

/**
 * The map as an SVG string. opts: view [west, south, east, north]; pts: place ids (named dots); routes: [[id, id, ...]] dashed lines;
 * labels: false for dots without names; extra(unit, box): more drawing in the map's own units (the plate's compass rose).
 */
export function mapSvg({ view, pts = [], routes = [], labels = true, extra = null, cls = "" }) {
  const { items, r, fs, box, unit } = layout(view, pts, labels), kx = Math.max(0.45, Math.cos(((view[1] + view[3]) / 2) * Math.PI / 180));
  const X = lon => lonIn(lon, view) * kx;
  const clip = `tdc${++mapCount}`;
  const parts = [`<defs><clipPath id="${clip}"><rect x="${f(box[0])}" y="${f(box[1])}" width="${f(box[2])}" height="${f(box[3])}"/></clipPath></defs>`,
    `<rect class="td-sea" x="${f(box[0])}" y="${f(box[1])}" width="${f(box[2])}" height="${f(box[3])}"/>`, `<path class="td-land" clip-path="url(#${clip})" d="${landPath(view, kx)}"/>`];
  for (const line of routes) {
    const pl = line.map(placeOf).filter(Boolean);
    if (pl.length > 1) parts.push(`<polyline class="td-route" points="${pl.map(p => `${f(X(p.lon))},${f(-p.lat)}`).join(" ")}"/>`);
  }
  for (const it of items) {
    const p = placeOf(it.id), l = it.label;
    parts.push(`<g class="td-pt" data-id="${esc(it.id)}"><circle class="td-hit" cx="${f(it.x)}" cy="${f(it.y)}" r="${f(r * 2.6)}"/><circle class="td-dot" cx="${f(it.x)}" cy="${f(it.y)}" r="${f(r)}"/>`
      + (l ? `<text class="td-name" text-anchor="${l.anchor}" x="${f(l.lx)}" y="${f(l.ly)}" font-size="${f(fs)}">${esc(shortName(p))}</text>` : "") + `</g>`);
  }
  if (extra) parts.push(extra(unit, box));
  return `<svg class="td-map ${cls}" viewBox="${f(box[0])} ${f(box[1])} ${f(box[2])} ${f(box[3])}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map">${parts.join("")}</svg>`;
}
