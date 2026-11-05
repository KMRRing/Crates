// Fathom's chart (README, Yield): the approach to a harbour, soundings printed on it as the line pays out. One fixed
// chart, pure (no page, tested in Node): the coast, the depth of the water everywhere in front of it, the soundings,
// and which of them the line has reached. The sea shoals evenly away from the coast, so a depth's contour is the coast
// moved out by a fixed distance, which is how the bands are drawn. Land is above, a narrow entrance leads to a basin.
import { rng } from "./yield-engine.js";

export const W = 240, H = 84;
const SPAN = 54, REACH = 20.5;          // the distance from the coast at which the water is REACH fathoms deep, and what that is
const MOUTH = 122, MOUTH_W = 9, BASIN = [98, 148], BASIN_Y = [4, 12];
const r1 = n => Math.round(n * 10) / 10;
/** The coast's y at x: the shore of the open sea, below which is water. */
export const coastY = x => 30 + 4 * Math.sin(x / 17) + 2 * Math.sin(x / 6.5 + 1);
/** The depth in fathoms at a distance from the shore (the water shoals evenly toward it). */
const depthAt = dist => REACH * Math.pow(Math.max(0, dist) / SPAN, 0.85);
/** The distance from the coast at which the water is `d` fathoms deep: a contour's offset. */
const offsetOf = d => SPAN * Math.pow(d / REACH, 1 / 0.85);

const line = (f, x0 = 0, x1 = W, step = 4) => { const pts = []; for (let x = x0; x <= x1; x += step) pts.push([x, f(x)]); if (pts.at(-1)[0] !== x1) pts.push([x1, f(x1)]); return pts; };
const poly = pts => pts.map(([x, y], i) => `${i ? "L" : "M"}${r1(x)} ${r1(y)}`).join("");

const WEST = MOUTH - MOUTH_W, EAST = MOUTH + MOUTH_W, CHANNEL_TOP = Math.round(coastY(MOUTH)) - 13;
const goto = pts => poly(pts).replace(/^M/, "L");
/** The land: the whole top of the chart, the shore with a gap for the entrance, a channel up into the basin (water, so a notch in the land). */
export const LAND_PATH = `M0 0H${W}V${r1(coastY(W))}${goto(line(coastY, EAST, W).reverse())}L${EAST} ${CHANNEL_TOP}L${BASIN[1]} ${BASIN_Y[1]}`
  + `V${BASIN_Y[0]}H${BASIN[0]}V${BASIN_Y[1]}L${WEST} ${CHANNEL_TOP}L${WEST} ${r1(coastY(WEST))}${goto(line(coastY, 0, WEST).reverse())}Z`;

/** The bands of deeper water, each a region from a contour down: [{ at: fathoms, d: path }], the depth the line must have reached to show it. */
export const BANDS = [5, 10, 15].map(at => ({ at, d: `${poly(line(x => coastY(x) + offsetOf(at)))}V${H}H0Z`, line: poly(line(x => coastY(x) + offsetOf(at))) }));
/** The shore itself, a line, the entrance and the basin in it. */
export const COAST_LINE = `${poly(line(coastY, 0, WEST))}L${WEST} ${CHANNEL_TOP}L${BASIN[0]} ${BASIN_Y[1]}V${BASIN_Y[0]}H${BASIN[1]}V${BASIN_Y[1]}L${EAST} ${CHANNEL_TOP}L${EAST} ${r1(coastY(EAST))}${goto(line(coastY, EAST, W))}`;

const inSea = (x, y) => y > coastY(x) + 3;
/** The soundings: { x, y, n } (n whole fathoms), shallowest first; a few in the harbour, the rest scattered by dart-throwing from a fixed seed. */
export const SOUNDINGS = (() => {
  const out = [], r = rng(1853), cy = coastY(MOUTH);
  const fixed = [[107, 8, 3], [MOUTH, 8, 4], [139, 8, 3], [MOUTH, cy - 5, 4], [MOUTH, cy + 5, 3]];
  for (const [x, y, n] of fixed) out.push({ x, y, n });
  for (let tries = 0; tries < 4000 && out.length < 46; tries++) {
    const x = 8 + r() * (W - 16), y = 8 + r() * (H - 14);
    if (!inSea(x, y) || out.some(o => Math.hypot(o.x - x, o.y - y) < 13)) continue;
    out.push({ x: r1(x), y: r1(y), n: Math.max(1, Math.round(depthAt(y - coastY(x)))) });
  }
  return out.sort((a, b) => a.n - b.n || a.x - b.x);
})();
/** How many soundings the line has reached at `depth` fathoms out: every one no deeper than it. */
export const reachedBy = depth => SOUNDINGS.filter(s => s.n <= depth).length;
/** The lighthouse on the west headland, drawn as a small ring. */
export const LIGHT = { x: MOUTH - 22, y: Math.round(coastY(MOUTH - 22)) - 6 };
