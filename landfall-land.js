// The land seen from the sea: the summits of a coast as they rise over the horizon, and the views of them in the Sailing Directions.
// Pure: the engine says which summits can be seen and takes their bearings, the scene and the page draw the skyline.
//
// A level's `hills`: [{ name, x, y, h, w, shape, side? }]: a summit at chart point (x, y) nm, `h` metres high and `w` nm across, of one
// of the SHAPES (a bluff's sheer end is to the right as seen from seaward, or to the left with side -1). From the ship a summit stands above the horizon by its height less what the earth's curve hides (the drop, d²/2R with the
// light's bending allowed for), so the land rises out of the sea as she closes it; its geographic range is about 2.08 (√h + √e) miles
// with both heights in metres. Old coastal views were drawn with the heights stretched so that the shapes could be told: the
// skyline here is stretched the same way (EXAGGERATE), in the game's views and on its horizon alike.
import { bearing, dist } from "./landfall-model.js";

export const EYE_M = 3.5, EXAGGERATE = 3;
const R_EFF = 6371000 * 7 / 6;                      // the earth's radius, made larger by refraction bending the line of sight
/** A shape's height, 0 to 1, at `u` (-1 to 1 across the summit's width); `side` turns an asymmetric one about (1 or -1). */
export const SHAPES = {
  dome: u => Math.max(0, Math.cos(u * Math.PI / 2)) ** 1.5,
  peak: u => Math.max(0, 1 - Math.abs(u)) ** 1.6,
  flat: u => (Math.abs(u) < 0.55 ? 1 : Math.max(0, 1 - (Math.abs(u) - 0.55) / 0.45) ** 0.6),
  twin: u => Math.max(0, Math.cos(u * Math.PI / 2)) * (0.78 + 0.22 * Math.cos(u * Math.PI * 2.4)),
  notch: u => (Math.abs(u) < 0.12 ? 0.62 + 3 * Math.abs(u) : Math.abs(u) < 0.6 ? 1 : Math.max(0, 1 - (Math.abs(u) - 0.6) / 0.4) ** 0.7),
  bluff: (u, side = 1) => { const v = u * side; return v > 0.5 ? Math.max(0, 1 - (v - 0.5) / 0.08) : Math.max(0, (v + 1) / 1.5) ** 1.3; },
};
/** What the shape looks like, in the Sailing Directions' words. */
export const SHAPE_WORDS = {
  dome: "a round hill, like a loaf", peak: "a sharp peak", flat: "flat-topped, with steep ends", twin: "two summits with a saddle between",
  notch: "a long top with a notch in it", bluff: "a bluff, sheer at one end and sloping away at the other",
};
/** Metres the earth's curve hides at `nm` miles. */
export const dropAt = nm => (nm * 1852) ** 2 / (2 * R_EFF);
/** Whether a summit `h` metres high can be seen at `nm` miles from an eye `EYE_M` up. */
export const inRange = (h, nm) => nm <= 2.08 * (Math.sqrt(h) + Math.sqrt(EYE_M));
/** A summit from the ship at T: its bearing, distance, and how high it stands above the horizontal (degrees, stretched as the views are). */
export function hillLook(hill, T) {
  const d = Math.max(0.3, dist(T, [hill.x, hill.y])), up = (hill.h - dropAt(d) - EYE_M) * EXAGGERATE;
  return { az: bearing([hill.x - T[0], hill.y - T[1]]), d, alt: Math.atan2(up, d * 1852) * 180 / Math.PI, visible: inRange(hill.h, d) && up > 0 };
}
/**
 * The skyline: for each azimuth (degrees) the height of the land above the horizontal there (degrees, stretched; 0 where there is none)
 * and which summit makes it. A summit's shape spreads over its width as seen from the ship: its half-width subtends atan(w/2 / d).
 */
export function skyline(L, T, azs) {
  const looks = (L.hills || []).map((h, i) => ({ h, i, ...hillLook(h, T) })).filter(l => l.visible);
  return azs.map(az => {
    let best = 0, who = -1;
    for (const l of looks) {
      const half = Math.atan2(l.h.w / 2, l.d) * 180 / Math.PI, off = ((az - l.az + 540) % 360) - 180, u = off / half;
      if (Math.abs(u) >= 1) continue;
      const v = l.alt * SHAPES[l.h.shape](u, l.h.side ?? 1);
      if (v > best) { best = v; who = l.i; }
    }
    return { az, alt: best, who };
  });
}

/** The azimuths the skyline is sampled at, every half degree. */
export const AZS = Array.from({ length: 720 }, (_, i) => i / 2);
/**
 * Draws a stretch of skyline on a canvas: `heights` across the width (degrees above the horizontal), the sea below the horizon at
 * `horizon` px from the top, heights scaled by `scale` px a degree. Colours: { sky: [top, bottom], land, sea } as CSS colours.
 */
export function drawSkyline(ctx, w, h, heights, { scale, horizon = h * 0.72, sky = ["#3a4660", "#c99a7a"], land = "#22262e", sea = "#1a2430", marks = [] } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = sea; ctx.fillRect(0, horizon, w, h - horizon);
  ctx.beginPath(); ctx.moveTo(0, horizon);
  heights.forEach((v, i) => ctx.lineTo(i / (heights.length - 1) * w, horizon - v * scale));
  ctx.lineTo(w, horizon); ctx.closePath(); ctx.fillStyle = land; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, horizon + 0.5); ctx.lineTo(w, horizon + 0.5); ctx.stroke();
  for (const x of marks) { ctx.strokeStyle = "rgba(255,226,160,.9)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, horizon + 6); ctx.lineTo(x, horizon + 16); ctx.stroke(); }
}
/** A summit as the Sailing Directions draw it, seen from seaward twelve miles off: its heights across `n` samples, in degrees. */
export function viewOf(hill, n = 120, span = null) {
  const d = 12, l = hillLook({ ...hill, x: d, y: 0 }, [0, 0]), half = Math.atan2(hill.w / 2, d) * 180 / Math.PI, s = span ?? half * 2.6;
  return Array.from({ length: n }, (_, i) => { const u = ((i / (n - 1)) - 0.5) * s / half; return Math.abs(u) < 1 ? l.alt * SHAPES[hill.shape](u, hill.side ?? 1) : 0; });
}
