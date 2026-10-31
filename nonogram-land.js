// Which of a country's pieces of land a Nonogram picture shows, and where (pure; used by nonogram-pictures.js and by
// tools/nonogram-regions.mjs, which keeps only what a picture can show).
const RAD = Math.PI / 180;
/** Mercator's y, in degrees like the longitude, so the shapes look as they do on Chart's map (and every map). */
export const mercator = lat => Math.log(Math.tan(Math.PI / 4 + (Math.max(-82, Math.min(82, lat)) * RAD) / 2)) / RAD;

/** A ring's area on the ground (in square degrees at the equator), its centre, and its box on the map. */
function ringInfo(ring) {
  let a = 0, cx = 0, cy = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[i + 1], cr = ax * by - bx * ay;
    a += cr; cx += (ax + bx) * cr; cy += (ay + by) * cr;
  }
  for (const [x, y] of ring) { const m = mercator(y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, m); y1 = Math.max(y1, m); }
  const lat = a ? cy / (3 * a) : ring[0][1];
  return { area: Math.abs(a / 2) * Math.cos(lat * RAD), cx: a ? cx / (3 * a) : ring[0][0], cy: mercator(lat), x0, x1, y0, y1 };
}

/**
 * The part of a country its picture shows, projected: its largest piece of land and whatever lies near it, so France
 * is drawn without French Guiana and the United States without Alaska and Hawaii (each would shrink the rest to a few
 * cells), while Indonesia keeps its islands, which lie near one another. A ring joins when its centre is within a
 * quarter of the picture's diagonal of the picture so far (`country.reach` says another fraction: an island chain
 * like Hawaii or the Canaries needs a wider one to hang together). Rings cut at the antimeridian (Russia's Chukotka, a piece
 * of Fiji) are moved round to the side they belong to.
 * landPieces gives the rings as they are in longitude and latitude (moved round if cut at the antimeridian), `take` the
 * indexes of those the picture shows, and the box of its frame in projected degrees.
 */
export function landPieces(country) {
  const east = country.rings.some(r => r.some(([x]) => x > 150));
  const rings = country.rings.map(r => (east && r.every(([x]) => x < -150) ? r.map(([x, y]) => [x + 360, y]) : r));
  const infos = rings.map(ringInfo), order = infos.map((_, i) => i).sort((a, b) => infos[b].area - infos[a].area);
  const take = new Set([order[0]]);
  const near = { ...infos[order[0]] };                            // the box of what has joined, for who joins next
  for (let grew = true; grew;) {
    grew = false;
    const reach = (country.reach ?? 0.25) * Math.hypot(near.x1 - near.x0, near.y1 - near.y0);
    for (const i of order) {
      if (take.has(i)) continue;
      const r = infos[i], dx = Math.max(near.x0 - r.cx, 0, r.cx - near.x1), dy = Math.max(near.y0 - r.cy, 0, r.cy - near.y1);
      if (Math.hypot(dx, dy) > reach) continue;
      take.add(i); grew = true;
      near.x0 = Math.min(near.x0, r.x0); near.x1 = Math.max(near.x1, r.x1); near.y0 = Math.min(near.y0, r.y0); near.y1 = Math.max(near.y1, r.y1);
    }
  }
  // the frame holds the pieces big enough to show: an islet or a pond beside a lake would only add empty rows
  const all = [...take].reduce((a, i) => a + infos[i].area, 0), box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  for (const i of take) {
    const r = infos[i];
    if (r.area < 0.01 * all) continue;
    box.x0 = Math.min(box.x0, r.x0); box.x1 = Math.max(box.x1, r.x1); box.y0 = Math.min(box.y0, r.y0); box.y1 = Math.max(box.y1, r.y1);
  }
  return { rings, take: [...take].sort((a, b) => a - b), box };
}
/** The same, projected: { rings (the pieces taken, longitude and projected latitude), box }. */
export function landOf(country) {
  const { rings, take, box } = landPieces(country);
  return { rings: take.map(i => rings[i].map(([x, y]) => [x, mercator(y)])), box };
}

