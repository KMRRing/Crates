// Chart: pin a place on the map; score by how close you were. Distances are great-circle; points fall off
// smoothly with distance, so a near miss on a city and a rough fix on a mine are both worth something.

export const PER_SET = 10;
const R = 6371;                                  // km

/** Great-circle distance in km between two points. */
export function distance(a, b) {
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/**
 * A pin against a drawn feature (a river's lines, a range's rings): the distance to the nearest point of it, in km,
 * and that point; zero inside a polygon. Local flat geometry around the pin, which is fine at these scales.
 */
export function nearestOnFeature(pin, feature) {
  const kx = 111.32 * Math.cos(pin.lat * Math.PI / 180), ky = 110.57;
  const parts = feature.lines || feature.rings || [];
  if (feature.rings && feature.rings.some(ring => inside(pin, ring))) return { km: 0, point: { lat: pin.lat, lon: pin.lon } };
  let best = null;
  for (const part of parts) for (let i = 1; i < part.length; i++) {
    const [ax, ay] = [(part[i - 1][0] - pin.lon) * kx, (part[i - 1][1] - pin.lat) * ky], [bx, by] = [(part[i][0] - pin.lon) * kx, (part[i][1] - pin.lat) * ky];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const px = ax + t * dx, py = ay + t * dy, km = Math.hypot(px, py);
    if (!best || km < best.km) best = { km, point: { lon: pin.lon + px / kx, lat: pin.lat + py / ky } };
  }
  return best || { km: Infinity, point: { lat: feature.lat, lon: feature.lon } };
}
function inside(p, ring) {
  let on = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p.lat) !== (yj > p.lat) && p.lon < (xj - xi) * (p.lat - yi) / (yj - yi) + xi) on = !on;
  }
  return on;
}
/** The box around a feature: [lon0, lat0, lon1, lat1]. */
export function featureBox(feature) {
  let lon0 = 180, lat0 = 90, lon1 = -180, lat1 = -90;
  for (const part of feature.lines || feature.rings || []) for (const [lon, lat] of part) { lon0 = Math.min(lon0, lon); lon1 = Math.max(lon1, lon); lat0 = Math.min(lat0, lat); lat1 = Math.max(lat1, lat); }
  return [lon0, lat0, lon1, lat1];
}
/** Points for a pin d km off: 1000 at the spot, about 600 at 1,000 km, 135 at 4,000 km; +100 within 100 km. */
export const score = d => Math.round(1000 * Math.exp(-d / 2000)) + (d < 100 ? 100 : 0);
/** Clues cost: the first (the region) leaves 70% of the points, the second (the country) 45%, the third (the description) 25%. */
export const CLUE_FACTOR = [1, 0.7, 0.45, 0.25];
export const clueFactor = n => CLUE_FACTOR[Math.min(n, CLUE_FACTOR.length - 1)];
/** The text of clue n (1–3) for a place: the region, the country, then its description with its own name hidden. */
export function clueText(p, n) {
  if (n === 1) return `It's in ${p.region}.`;
  if (n === 2) return `It's in ${p.country}.`;
  const words = p.name.replace(/[,(].*$/, "").split(/\s+/).filter(w => w.length > 3 && !/^(the|where|was|born)$/i.test(w));
  let text = p.note;
  for (const w of words) text = text.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "…");
  return text;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The set for a seed: PER_SET places in a seeded order, at most two from any category. */
export function pickSet(seed, bank, perSet = PER_SET) {
  const r = rng(seed), order = [...bank];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const used = {}, out = [];
  for (const p of order) {
    if ((used[p.cat] || 0) >= 2) continue;
    used[p.cat] = (used[p.cat] || 0) + 1;
    out.push(p);
    if (out.length === perSet) break;
  }
  return out;
}

// ---------- the map's projection: Mercator, clipped near the poles ----------
export const LAT_MAX = 78;
const toRad = d => d * Math.PI / 180;
export const merc = lat => Math.log(Math.tan(Math.PI / 4 + toRad(Math.max(-89, Math.min(89, lat))) / 2));
export const unmerc = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
/**
 * A projection for a window: lon0..lon1 across, lat0..lat1 up, onto width w and height h (pixels). Returns
 * { toXY(lon, lat), toLonLat(x, y) }. The whole world is lon −180..180, lat −LAT_MAX..LAT_MAX.
 */
export function projection(lon0, lon1, lat0, lat1, w, h) {
  const y0 = merc(lat0), y1 = merc(lat1);
  return {
    toXY: (lon, lat) => [(lon - lon0) / (lon1 - lon0) * w, (y1 - merc(Math.max(-89, Math.min(89, lat)))) / (y1 - y0) * h],
    toLonLat: (x, y) => [lon0 + x / w * (lon1 - lon0), unmerc(y1 - y / h * (y1 - y0))],
  };
}
/** The world's aspect (width over height) when clipped at ±LAT_MAX. */
export const worldAspect = () => 360 / ((merc(LAT_MAX) - merc(-LAT_MAX)) * 180 / Math.PI);
// ---------- views you can pan and pinch ----------
// A view is { lon (its centre's longitude), my (its centre in Mercator units), span (degrees of longitude across) }.
// The window it shows on a w×h canvas follows from the aspect, so Mercator stays conformal.
const MERC_MAX = merc(LAT_MAX);
export const worldView = () => ({ lon: 0, my: 0, span: 360 });
export const viewAround = (lon, lat, span) => ({ lon, my: merc(lat), span });
/** The view's window: { lon0, lon1, lat0, lat1 }. */
export function viewWindow(view, w, h) {
  const half = view.span / 2, mercHalf = toRad(half) * (h / w);
  return { lon0: view.lon - half, lon1: view.lon + half, lat0: unmerc(view.my - mercHalf), lat1: unmerc(view.my + mercHalf) };
}
/** The view kept inside the world (longitude −180..180, latitude ±LAT_MAX) with a span between min and 360. */
export function clampView(view, w, h, minSpan = 1.5) {
  const span = Math.max(minSpan, Math.min(360, view.span));
  const half = span / 2, mercHalf = toRad(half) * (h / w);
  const lon = Math.max(-180 + half, Math.min(180 - half, view.lon));
  const my = mercHalf >= MERC_MAX ? 0 : Math.max(-MERC_MAX + mercHalf, Math.min(MERC_MAX - mercHalf, view.my));
  return { lon, my, span };
}
/** A view that shows both points with room around them (used for the reveal). */
export function viewCovering(a, b, w, h, minSpan = 6) {
  const lon = (a.lon + b.lon) / 2, my = (merc(a.lat) + merc(b.lat)) / 2;
  const span = Math.max(minSpan, Math.abs(a.lon - b.lon) * 1.6, (Math.abs(merc(a.lat) - merc(b.lat)) / (h / w)) * 180 / Math.PI * 1.6);
  return clampView({ lon, my, span }, w, h);
}
