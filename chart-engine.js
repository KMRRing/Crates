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
/** Points for a pin d km off: 1000 at the spot, about 600 at 1,000 km, 135 at 4,000 km; +100 within 100 km. */
export const score = d => Math.round(1000 * Math.exp(-d / 2000)) + (d < 100 ? 100 : 0);

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
const merc = lat => Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
const unmerc = y => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
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
/** A zoom window of ±span degrees of longitude around a point, with the latitude span matched to the map's scale there. */
export function windowAround(lon, lat, span = 8) {
  const latSpan = span * 0.95;
  return { lon0: lon - span, lon1: lon + span, lat0: Math.max(-LAT_MAX, lat - latSpan), lat1: Math.min(LAT_MAX, lat + latSpan) };
}
