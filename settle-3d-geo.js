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
export const limited = (v, lim = LIMITS) => ({ az: clamp(v.az, -lim.az, lim.az), el: clamp(v.el, lim.elMin, lim.elMax), zoom: clamp(v.zoom, 1, lim.zoomMax) });

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

// ---------- the layouts: the Row of six (the constants above) and the Farm, nine tanks in a 3x3 ----------
// A layout says where tank t stands (x, z, the height of the terrace it stands on), how tall it is, where its header pipe and
// valve are, where the quay, the berth and the road are, the camera's home and limits, and which tank a finger is over.

/** The row: six tanks along x, the header over all of them. */
export const rowLayout = {
  kind: "row", n: TANKS, cols: TANKS, pitch: PITCH, radius: RADIUS, inner: INNER, lv: LV, plinth: PLINTH,
  x: tankX, z: () => 0, pipeZ: () => 0, base: () => 0, levelY: (t, level) => levelY(level), top: () => TOP, headerY: () => HEADER_Y, valveY: () => VALVE_Y,
  quayZ: QUAY_Z, berthZ: BERTH_Z, berthX: BERTH_X, truckZ: 1.35, riserX: tankX(0) - 0.95, home: HOME, limits: LIMITS, look: LOOK,
  box: farmBox, under: tankUnder,
};

// the Farm: rows of three step up towards the back so the tanks behind show over the ones in front
export const SIDE = 3, F_PITCH = 1.45, F_RADIUS = 0.5, F_INNER = 0.47, F_LV = 0.38, F_RISE = 0.8;
export const F_HOME = { az: 0, el: 58 * DEG, zoom: 1 };
export const F_LIMITS = { az: 40 * DEG, elMin: 26 * DEG, elMax: 76 * DEG, zoomMax: 2.2 };
const fCol = t => t % SIDE, fRow = t => Math.floor(t / SIDE);
const fBase = t => (SIDE - 1 - fRow(t)) * F_RISE;                       // the back row (0) stands highest
const fTop = t => fBase(t) + PLINTH + LEVELS * F_LV;
const fX = t => (fCol(t) - 1) * F_PITCH, fZ = t => (fRow(t) - 1) * F_PITCH;
const F_QUAY = F_PITCH + F_RADIUS + 1.0, F_BERTH = F_QUAY + 0.95;
function farmBoxOf() {
  const x = F_PITCH + F_RADIUS + 0.75, out = [];
  for (const sx of [-x, x]) for (const [y, z] of [[0, -F_PITCH - F_RADIUS - 0.2], [fTop(0) + 1.0, -F_PITCH - F_RADIUS - 0.2], [0, F_BERTH + 1.0], [fTop(8) + 0.6, F_BERTH + 1.0]]) out.push([sx, y, z]);
  return out;
}
/**
 * The tank under a point on the screen, for a layout whose tanks overlap in the picture: those whose upright (foot to a little
 * over the top) passes within a half pitch of the point at its height; of those the nearest to the viewer that the point is
 * really over (not just near), then the closest to the point.
 */
function farmUnder(cam, aspect, x, y) {
  const found = [];
  for (let t = 0; t < SIDE * SIDE; t++) {
    const a = project(cam, [fX(t), fBase(t), fZ(t)], aspect), b = project(cam, [fX(t), fTop(t) + 0.5, fZ(t)], aspect);
    if (!a || !b) continue;
    const side = project(cam, [fX(t) + F_PITCH / 2, fBase(t), fZ(t)], aspect), reach = side ? Math.abs(side[0] - a[0]) : 0;
    const k = Math.abs(b[1] - a[1]) < 1e-9 ? 0 : (y - a[1]) / (b[1] - a[1]), dx = Math.abs(x - (a[0] + (b[0] - a[0]) * k));
    if (k < -0.12 || k > 1.04 || dx > reach * 1.12) continue;
    found.push({ t, depth: Math.hypot(fX(t) - cam.eye[0], fZ(t) - cam.eye[2]), dx, over: k >= 0 && k <= 1 && dx <= reach });   // how far along the ground, not the sight line: the terraces even that out
  }
  const cover = found.filter(f => f.over);
  const free = found.filter(f => !cover.some(c => c.depth < f.depth - F_PITCH * 0.5 && c !== f));
  const pool = free.length ? free : found;
  return pool.length ? pool.reduce((a, f) => (f.dx < a.dx ? f : a)).t : -1;
}
/** The farm: nine tanks in a 3x3, the header over each row fed by a riser at the left, the quay and berth in front. */
export const farmLayout = {
  kind: "farm", n: SIDE * SIDE, cols: SIDE, pitch: F_PITCH, radius: F_RADIUS, inner: F_INNER, lv: F_LV, plinth: PLINTH,
  x: fX, z: fZ, pipeZ: t => fZ(t) - F_RADIUS - 0.1, base: fBase, levelY: (t, level) => fBase(t) + PLINTH + level * F_LV, top: fTop, headerY: t => fTop(t) + 0.55, valveY: t => fTop(t) + 0.3,
  quayZ: F_QUAY, berthZ: F_BERTH, berthX: -0.55, truckZ: F_PITCH + F_RADIUS + 0.45, riserX: -F_PITCH - F_RADIUS - 0.55, home: F_HOME, limits: F_LIMITS, look: [0, 2.1, 0.3],
  box: farmBoxOf, under: farmUnder,
};
export const LAYOUTS = { row: rowLayout, farm: farmLayout };
