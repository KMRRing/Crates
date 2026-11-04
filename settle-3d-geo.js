// Settle's 3D farm, the parts that need no GPU: where things stand, the camera, the fit of the farm to its card and which
// tank a finger is over. settle-3d.js draws them; tests/settle-3d.mjs checks these in Node.
//
// The world: x along the row of tanks, y up, z towards the viewer. A tank stands on a plinth; its parcels are LV high,
// the ninth (a spill) standing above the top. The header pipe runs over the tanks with a drop pipe and valve to each; the
// quay and the tanker's berth lie in front.

export const TANKS = 6, LEVELS = 8;
export const PITCH = 1.16, RADIUS = 0.5, INNER = 0.47, LV = 0.84, PLINTH = 0.12;
export const TOP = PLINTH + LEVELS * LV;                 // the top of a full tank
export const HEADER_Y = TOP + 0.85, VALVE_Y = TOP + 0.5;  // the header pipe over the tanks, a valve on each drop
export const QUAY_Z = 1.9, BERTH_Z = 3.0, BERTH_X = -0.55;   // the quay's edge, the middle of the tanker's berth
export const tankX = t => (t - (TANKS - 1) / 2) * PITCH;
/** The y of the foot of a parcel standing at a level. */
export const levelY = level => PLINTH + level * LV;
/** Where the middle of a parcel at a level stands. */
export const parcelAt = (t, level) => [tankX(t), levelY(level) + LV / 2, 0];

export const DEG = Math.PI / 180;
export const FOV = 20 * DEG;
export const HOME = { az: 0, el: 24 * DEG, zoom: 1 };
export const LIMITS = { az: 38 * DEG, elMin: 8 * DEG, elMax: 52 * DEG, zoomMax: 2.2 };
export const LOOK = [-0.1, 3.2, 0.9];                       // what the camera looks at

/** The corners of the box the whole farm (tanks, header, quay, tanker) fills: the camera fits all of it. */
export function farmBox() {
  const x0 = tankX(0) - RADIUS - 0.7, x1 = tankX(TANKS - 1) + RADIUS + 0.45;
  const out = [];
  for (const x of [x0, x1]) for (const y of [0, HEADER_Y + 0.2]) for (const z of [-RADIUS - 0.2, BERTH_Z + 1.6]) out.push([x, y, z]);
  return out;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** A camera orbiting `look` at azimuth az (0: straight in front, turning round the row), elevation el, `dist` away. */
export function cameraOf(az, el, dist, look = LOOK) {
  const eye = [look[0] + dist * Math.cos(el) * Math.sin(az), look[1] + dist * Math.sin(el), look[2] + dist * Math.cos(el) * Math.cos(az)];
  const fwd = norm(sub(look, eye)), right = norm(cross(fwd, [0, 1, 0]));
  return { eye, fwd, right, up: cross(right, fwd), az, el, dist, look };
}
/** A point on the screen: [x, y] in -1..1 (y up) for a camera, aspect = width / height, and its depth; null behind it. */
export function project(cam, p, aspect) {
  const d = sub(p, cam.eye), z = dot(d, cam.fwd);
  if (z <= 1e-6) return null;
  const f = 1 / Math.tan(FOV / 2);
  return [(dot(d, cam.right) * f) / (z * aspect), (dot(d, cam.up) * f) / z, z];
}
/**
 * The nearest the camera can stand at (az, el) and still see every point inside the card's edges (less `margin` of the
 * half-width), and the point it then looks at, moved up or down until the farm stands in the middle of the card: { dist, look }.
 */
export function fitView(az, el, aspect, points = farmBox(), margin = 0.06, look0 = LOOK) {
  let look = look0, dist = 10;
  for (let pass = 0; pass < 3; pass++) {
    const inside = d => {
      const cam = cameraOf(az, el, d, look);
      return points.every(p => { const q = project(cam, p, aspect); return q && Math.abs(q[0]) <= 1 - margin && Math.abs(q[1]) <= 1 - margin; });
    };
    let lo = 2, hi = 200;
    for (let k = 0; k < 36; k++) { const mid = (lo + hi) / 2; if (inside(mid)) hi = mid; else lo = mid; }
    dist = hi;
    // centre it: move the look point along the camera's up by half the gap between the top and the bottom of the farm
    const cam = cameraOf(az, el, dist, look), ys = points.map(p => project(cam, p, aspect)?.[1] ?? 0);
    const mid = (Math.max(...ys) + Math.min(...ys)) / 2, shift = mid * dist * Math.tan(FOV / 2);
    look = [look[0] + cam.up[0] * shift, look[1] + cam.up[1] * shift, look[2] + cam.up[2] * shift];
  }
  return { dist, look };
}
/** The nearest distance alone (see fitView). */
export const fitDistance = (az, el, aspect, points, margin, look) => fitView(az, el, aspect, points, margin, look).dist;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
/** A view kept within its limits. */
export const limited = v => ({ az: clamp(v.az, -LIMITS.az, LIMITS.az), el: clamp(v.el, LIMITS.elMin, LIMITS.elMax), zoom: clamp(v.zoom, 1, LIMITS.zoomMax) });

/**
 * The tank under a point on the screen (-1..1 coordinates), or -1: the tank whose upright, drawn from its foot to a little
 * over its top, passes nearest the point at the point's height, within half a pitch of it as drawn.
 */
export function tankUnder(cam, aspect, x, y) {
  let best = -1, gap = Infinity;
  for (let t = 0; t < TANKS; t++) {
    const a = project(cam, [tankX(t), 0, 0], aspect), b = project(cam, [tankX(t), HEADER_Y + 0.3, 0], aspect);
    if (!a || !b) continue;
    const side = project(cam, [tankX(t) + PITCH / 2, 0, 0], aspect), reach = side ? Math.abs(side[0] - a[0]) : 0;
    // the point along the upright at the point's height
    const k = Math.abs(b[1] - a[1]) < 1e-9 ? 0 : (y - a[1]) / (b[1] - a[1]);
    if (k < -0.35 || k > 1.12) continue;
    const dx = Math.abs(x - (a[0] + (b[0] - a[0]) * k));
    if (dx <= reach * 1.12 && dx < gap) { gap = dx; best = t; }
  }
  return best;
}
