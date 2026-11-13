// The sea floor of a level with soundings, and the leadsman's words for it. Pure: the engine casts the lead on it, the chart prints it.
//
// A level's `bed`: { shore, deep, width, line, banks? }. The bottom shelves away from the land, from `shore` fathoms at the coast
// toward `deep` with distance off (half way in about 0.7 `width` miles); every shoal stands up out of it as a rock with a little bank
// round it, and `banks` are humps (top < the shelf) or pits (top > it), each { name?, x, y, r, top }. `line` is how many fathoms of
// line the deep-sea lead carries: deeper than that the lead finds no bottom. A fathom is six feet, 1.83 metres.

/** Each polygon of a level's land as flat edge arrays, made once: the depth is asked for thousands of times when a line is laid down. */
const EDGES = new WeakMap();
function edgesOf(L) {
  let e = EDGES.get(L);
  if (!e) {
    e = (L.land || []).map(poly => { const f = new Float64Array(poly.length * 4); poly.forEach(([bx, by], i) => { const [ax, ay] = poly[(i + poly.length - 1) % poly.length]; f.set([ax, ay, bx - ax, by - ay], i * 4); }); return f; });
    EDGES.set(L, e);
  }
  return e;
}
/** The distance from a point to the nearest edge of the level's land, nm: negative on the land itself (how far inland). One pass over
 *  the edges finds both the distance and, by counting crossings, whether the point is inside. */
export function offshore(L, p) {
  let best = Infinity, land = false;
  const [px, py] = p;
  for (const f of edgesOf(L)) {
    let inside = false;
    for (let i = 0; i < f.length; i += 4) {
      const ax = f[i], ay = f[i + 1], dx = f[i + 2], dy = f[i + 3], A = dx * dx + dy * dy || 1e-12;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / A)), ex = ax + t * dx - px, ey = ay + t * dy - py, d2 = ex * ex + ey * ey;
      if (d2 < best) best = d2;
      const by = ay + dy;
      if ((by > py) !== (ay > py) && px < (ax - (ax + dx)) * (py - by) / (ay - by) + ax + dx) inside = !inside;
    }
    if (inside) land = true;
  }
  best = Math.sqrt(best);
  return land ? -best : best;
}
/** Depth in fathoms at a chart point. `raw` lets the shelf run on under the land as a negative depth, smoothly, for a reckoning that has
 *  put the ship ashore: its slope still says which way the sea is. */
export function depthAt(L, p, raw = false) {
  const B = L.bed, d = offshore(L, p), k = (B.deep - B.shore) / B.width;
  let z = d >= 0 ? B.shore + (B.deep - B.shore) * (1 - Math.exp(-d / B.width)) : B.shore + k * d;
  const hump = (x, y, r, top) => { const q = ((p[0] - x) ** 2 + (p[1] - y) ** 2) / (r * r); if (q < 9) z -= (z - top) * Math.exp(-q); };
  for (const b of B.banks || []) hump(b.x, b.y, b.r, b.top);
  for (const s of L.shoals || []) hump(s.x, s.y, s.r * 1.15, 1);                  // a ledge stands up steeply out of the shelf
  return raw ? z : Math.max(0.5, z);
}
/** The bottom's slope: fathoms per mile east and north. */
export function slopeAt(L, p, h = 0.1) {
  return [(depthAt(L, [p[0] + h, p[1]]) - depthAt(L, [p[0] - h, p[1]])) / (2 * h), (depthAt(L, [p[0], p[1] + h]) - depthAt(L, [p[0], p[1] - h])) / (2 * h)];
}
/** What the tallow in the lead's foot brings up: rock on a shoal, sand and shell on a bank, gravel close in, sand on the shelf, ooze out deep. */
export function bottomAt(L, p) {
  for (const s of L.shoals || []) if (Math.hypot(p[0] - s.x, p[1] - s.y) < s.r * 1.3) return "rock";
  for (const b of [...(L.bed.banks || [])].sort((x, y) => x.r - y.r)) if (Math.hypot(p[0] - b.x, p[1] - b.y) < b.r) return b.top < 30 ? "sand and broken shell" : "soft mud";   // a hump, or a pit in it
  const z = depthAt(L, p);
  return offshore(L, p) < 6 ? "gravel" : z > 55 ? "grey ooze" : "fine sand";
}
/** The bottom's word as a chart prints it beside a sounding. */
export const BOTTOM_ABBR = { rock: "r", "sand and broken shell": "s.sh", "soft mud": "m", gravel: "g", "grey ooze": "oz", "fine sand": "f.s" };

// The hand lead's line is marked at 2, 3, 5, 7, 10, 13, 15, 17 and 20 fathoms (leather, calico, serge, bunting): a depth on a mark is
// called "by the mark", one between marks "by the deep". Deeper, the deep-sea lead's depth is called as it is.
const MARKS = new Set([2, 3, 5, 7, 10, 13, 15, 17, 20]);
const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
/** The leadsman's call for a depth in fathoms (to the nearest quarter on the hand lead's line). */
export function leadsmanCall(fm) {
  if (fm > 20) return `${Math.round(fm)} fathoms`;
  const q = Math.round(fm * 4) / 4, whole = Math.floor(q), part = q - whole;
  if (part === 0) return `${MARKS.has(whole) ? "By the mark" : "By the deep"}, ${WORDS[whole]}`;
  if (part === 0.5) return `And a half, ${WORDS[whole]}`;
  if (part === 0.25) return `And a quarter, ${WORDS[whole]}`;
  return `A quarter less ${WORDS[whole + 1]}`;
}
