// Shunt's watch movement in three dimensions, the parts that need no WebGL (so Node tests them): where things stand on the plate, which gear
// is at which height, how a gear turns, where the thirty lever tabs stand against the board's outline, which lever a touch means, the case's tilt (its
// limit, its spring, the finger's and the phone's part in it), the camera's fit, and the colours of each theme by day and by night.
// shunt-view-3d.js draws it; shunt-3d-geo.js makes the shapes and shunt-3d-tex.js the engraving.
// One world unit is one cell (the distance between the centres of neighbours; the 2D view's D). x runs right, z towards the viewer
// (the 2D view's y), y up: seen from straight above it is the 2D picture, so a gear's angle and the tooth phases of shunt-view-2d.js
// hold as they are. The plate's top is y = 0.
import { CELLS, ENTRIES } from "./shunt-engine.js";
import { LEVERS, D, PITCH, IDLER, FAMILY, spreadAround, leverAtPoint } from "./shunt-view-2d.js";

const DEG = Math.PI / 180;
export const SQ = 0.8660254;
export const cellW = i => [SQ * CELLS[i].q, CELLS[i].r + CELLS[i].q / 2];
export const CELL_R = 0.577;                      // a cell's corner radius (the hexagon's corners point left and right)
export const RO = 0.52;                           // a gear's outer radius: two neighbours' teeth overlap by 0.04 and interleave
export const PLATE_R = 3.18, CASE_R = 3.4;         // the engraved plate's radius, and the case's (bezel and band)
export const TRACK_R = 2.64;                      // the gold line round the board's tabs, where the outer sunburst ring begins
export const HIT_R = 2.6;                         // the circle the levers' touch points stand on

export const SEAT_R = 0.5;                        // a seat's corner radius: smaller than the cell's, so a rib of engraving is left between seats
export const FLOOR = -0.09;                       // a seat's floor, below the plate's top

// ---------- the gears: which pitch makes which part, at which height ----------
/** The shape a gear part has: 0, 1, 2 the pitches A, B, C (12, 18, 24 teeth), 3 the idler (12, thick). */
export const SHAPES = [{ n: PITCH[0].n, depth: PITCH[0].depth }, { n: PITCH[1].n, depth: PITCH[1].depth }, { n: PITCH[2].n, depth: PITCH[2].depth }, { n: IDLER.n, depth: IDLER.depth }];
/** Each pitch runs in its own layer, so a gear that touches one of another pitch (and does not mesh with it) passes over or under it. */
export const LAYER_Y = [0.05, 0.2, 0.35], THICK = 0.12, IDLER_THICK = 0.42;
/** What a gear code is made of: [shape, layer]; a bridge is two gears of its two pitches on one shaft, the idler one thick gear through all layers. */
export const PARTS = FAMILY.map((fam, c) => (c === 3 ? [[3, 0]] : fam.map(p => [p, p])));
export const shapeTeeth = k => SHAPES[k].n;
/** The height of a gear code's highest face (where its axle cap sits). */
export const topOf = c => PARTS[c].reduce((m, [k, l]) => Math.max(m, LAYER_Y[l] + (k === 3 ? IDLER_THICK : THICK)), 0);
export const baseOf = c => Math.min(...PARTS[c].map(([, l]) => LAYER_Y[l]));

/** How fast gears turn: teeth a second, the same for every gear, so meshed gears of one pitch keep step. */
export const RATE = 1.4;
/** A gear part's angle in degrees as the 2D view turns it (clockwise): n teeth, direction sg (1 or -1), time t, mode "turn" | "jam" | "still".
 *  A gear turning the other way starts half a tooth on, which is what makes its teeth fall in its neighbour's gaps. */
export function gearDeg(n, sg, t, mode) {
  const step = 360 / n, base = sg < 0 ? step / 2 : 0;
  return mode === "turn" ? base + sg * RATE * step * t : mode === "jam" ? base + Math.sin(t * 52) * 2.4 : base;
}

/** The outline of a toothed wheel as points (the first tooth centred on angle 0): the 2D view's trapezoid teeth, rounded at the tip and
 *  the root, with the root's arcs cut into short chords. */
export function toothOutline(n, ro, depth) {
  const step = 2 * Math.PI / n, root = ro * (1 - depth);
  const prof = [[-0.5, root], [-0.4, root], [-0.3, root], [-0.19, ro * 0.985], [-0.11, ro], [0, ro], [0.11, ro], [0.19, ro * 0.985], [0.3, root], [0.4, root]];
  const pts = [];
  for (let k = 0; k < n; k++) for (const [fr, r] of prof) pts.push([Math.cos((k + fr) * step) * r, Math.sin((k + fr) * step) * r]);
  return pts;
}

// ---------- the bench ----------
/** The rail the queue stands on, the hold's cradle, and the places the five gears coming take (x, size as a share of a full gear). */
export const RAIL = { z: 4.05, x0: -1.4, x1: 2.68, w: 0.98 };
export const HOLD = { x: -2.0, z: 4.05, r: 0.64 };
export const QUEUE = [{ x: -0.86, s: 0.86 }, { x: 0.04, s: 0.64 }, { x: 0.76, s: 0.64 }, { x: 1.48, s: 0.64 }, { x: 2.2, s: 0.64 }];
/** A lever's tab: a flat bar `len` long and `thick` deep, `h` tall, `gap` clear of its seat's polished edge. */
export const TAB = { len: 0.42, thick: 0.1, h: 0.07, gap: 0.025 };
/** The thirty levers, in world units, each worked out from the rules' entry (the cell it feeds and the way it shoves): every entry's first cell has no
 *  neighbour behind it, so the entry is one outer face of the board's outline, and the tab stands against that face, a bar parallel to it. The way it
 *  shoves is the face's inward normal (ux, uz; `ang` its angle), so it is drawn with no arrow. No entry is at a corner: a corner has no cell line.
 *  (x, z) is the tab; (hx, hz) is where a touch means it: the outline zigzags, so tabs crowd to under half a cell apart where two faces meet, and a
 *  finger chooses among touch points spread equally round a circle instead (spreadAround), each within a third of a cell of its tab. */
export const LEVER_W = (() => {
  const raw = ENTRIES.map((en, e) => {
    const [cx, cz] = cellW(en.line[0]), { ux, uy } = LEVERS[e], back = (SEAT_R + 0.04) * SQ + TAB.gap + TAB.thick / 2;     // out past the seat's gold edge
    return { e, x: cx - ux * back, z: cz - uy * back, ux, uz: uy, ang: Math.atan2(uy, ux) };
  });
  const hit = spreadAround(raw.map(l => [l.x, l.z]), HIT_R);
  return raw.map((l, e) => ({ ...l, hx: hit[e][0], hz: hit[e][1] }));
})();
/** How far from a lever's touch point a touch still means it, off its tab. The 2D view takes 0.8 of a cell and the nearest decides; a finger over a tilted
 *  plate is less sure, so this is wider (the levers are about 0.5 apart on a side, so the nearest still decides). */
export const HIT3 = 1.0;
export const nearestLever = (x, z, r = HIT3) => leverAtPoint(LEVER_W, x, z, { reach: r, pad: 0.08, len: TAB.len, thick: TAB.thick, k: "z" });
/** Whether a point of the plate's plane is on the cradle (generously), on the plate, or neither. */
export const holdAt = (x, z) => Math.hypot(x - HOLD.x, z - HOLD.z) < HOLD.r + 0.22;
export const onPlate = (x, z) => Math.hypot(x, z) < CASE_R - 0.05;

// ---------- the tilt: the case leans a little under a finger or the phone, on a spring, and comes back ----------
export const TILT_MAX = 12 * DEG;
/** A drag of (dx, dy) pixels as a tilt [about x, about z] in radians: soft at the end, so the limit is reached slowly. `reach` is the drag that
 *  gives about three quarters of it. Dragging down tips the near edge down, dragging right the right edge. */
export const tiltOfDrag = (dx, dy, reach = 90) => [TILT_MAX * Math.tanh(dy / reach), -TILT_MAX * Math.tanh(dx / reach)];
/** One step (dt seconds) of a spring pulling x to `target`, a little under critically damped, so it overshoots by a tenth or so and rests. */
export function springStep(x, v, target, dt, k = 110, c = 11) {
  const n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n;
  for (let i = 0; i < n; i++) { v += (-k * (x - target) - c * v) * h; x += v * h; }
  return [x, v];
}
/** The phone's attitude (beta: front to back, gamma: left to right, in degrees) against the attitude it was first held at, as a tilt; `turn` is the
 *  screen's rotation in degrees (0, 90, 180, 270), which swaps the phone's axes. The phone's tilt is half again the case's: a wrist moves little. */
export function tiltOfPhone(beta, gamma, beta0, gamma0, turn = 0) {
  let db = beta - beta0, dg = gamma - gamma0;
  const q = (((Math.round(turn / 90) % 4) + 4) % 4);
  if (q === 1) [db, dg] = [-dg, db]; else if (q === 2) [db, dg] = [-db, -dg]; else if (q === 3) [db, dg] = [dg, -db];
  const f = v => Math.max(-TILT_MAX, Math.min(TILT_MAX, v * DEG * 0.6));
  return [f(db), f(-dg)];
}

// ---------- the camera: fixed, a little off straight down, so the case's rim and the rack read ----------
/** The elevation the case is seen from. A wide card is seen from nearer overhead. A tall one has height to spare once the case fills its width, so the
 *  case is raised (seen more from above, so it is taller on the screen) as far as that room allows, up to 78 degrees. */
export function homeEl(aspect) {
  const base = (aspect < 0.8 ? 62 : aspect < 1.1 ? 66 : 74);
  if (aspect >= 1.1) return base * DEG;
  let best = base;
  for (let d = base; d <= 78; d++) { const e = extent(KEEP, 0, d * DEG); if (e.hy + 0.3 > (e.hx + 0.08) / aspect) break; best = d; }
  return best * DEG;
}
/** The camera's frame for yaw az and elevation el: right, up and the way back to the camera, unit vectors. */
export function basis(az, el) {
  const c = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], r = [Math.cos(az), 0, -Math.sin(az)];
  const u = [c[1] * r[2], c[2] * r[0] - c[0] * r[2], -c[1] * r[0]];
  return { r, u, c };
}
/** The things that must stay in view: the case all round, up to the gears' height, and the rack's. */
export const KEEP = (() => {
  const p = [];
  for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; for (const y of [-0.55, 0.8]) p.push([Math.cos(a) * (CASE_R + 0.05), y, Math.sin(a) * (CASE_R + 0.05)]); }
  for (const x of [HOLD.x - HOLD.r - 0.1, RAIL.x1 + 0.1]) for (const z of [RAIL.z - RAIL.w / 2 - 0.05, RAIL.z + RAIL.w / 2 + 0.05]) for (const y of [-0.05, 0.62]) p.push([x, y, z]);
  return p;
})();
/** The half-extents (on the screen, x then y) of `points` seen from az and el, and where their middle is on the screen. */
function extent(points, az, el) {
  const { r, u } = basis(az, el);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    const sx = p[0] * r[0] + p[1] * r[1] + p[2] * r[2], sy = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  return { hx: (x1 - x0) / 2, hy: (y1 - y0) / 2, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
/** The orthographic frame that holds `points` at this view: half-height H (the width is H times the aspect) and the point looked at; `margin` is the
 *  room left above and below (a tilted case's edge rises and falls), `marginX` at the sides (a lean hardly moves them). */
export function fit(points, az, el, aspect, margin = 0.12, marginX = margin) {
  const { r, u } = basis(az, el), { hx, hy, cx, cy } = extent(points, az, el), H = Math.max(hy + margin, (hx + marginX) / aspect);
  return { H, look: [r[0] * cx + u[0] * cy, r[1] * cx + u[1] * cy, r[2] * cx + u[2] * cy] };
}

// ---------- the look: colours by theme, day and night (hex numbers; the gears' own colours are the game's and stay) ----------
// The light is Topple's (a low sun, a cool fill, a sky and a ground; the same exposures), so the two games sit in one family; the metals are the
// watch's: the case and its settings in `gold`, the engraved plate in `plate`, a seat's floor frosted dark (`floor`), the rack's pad `velvet`.
const SKINS = {
  codex: {
    day: { key: 0xfff0d6, keyI: 2.9, fill: 0xdce6ff, fillI: 0.6, sky: 0xfff4de, ground: 0x7a6650, hemiI: 0.8, exposure: 1.1, gold: 0xe0b24a, plate: 0xdcd2b8, floor: 0x24332d, velvet: 0x5a1c28, shadow: 0.34 },
    night: { key: 0xb9cdee, keyI: 1.7, fill: 0xffc98a, fillI: 0.85, sky: 0x8fa6d4, ground: 0x2a2a30, hemiI: 0.75, exposure: 1.18, gold: 0xd2a43f, plate: 0xbdb49c, floor: 0x18241f, velvet: 0x4a1822, shadow: 0.5 },
  },
  modern: {
    day: { key: 0xffffff, keyI: 2.6, fill: 0xe4ecff, fillI: 0.8, sky: 0xffffff, ground: 0xb9c0c4, hemiI: 0.95, exposure: 1.08, gold: 0xd8dde1, plate: 0xb9c6d4, floor: 0x1e2c3c, velvet: 0x22364a, shadow: 0.28 },
    night: { key: 0xc3d6f0, keyI: 1.6, fill: 0xffd7a0, fillI: 0.7, sky: 0x9db0cc, ground: 0x1c242b, hemiI: 0.85, exposure: 1.2, gold: 0xbfc7ce, plate: 0x8f9fb2, floor: 0x131c28, velvet: 0x1c2e42, shadow: 0.5 },
  },
  kontor: {
    day: { key: 0xffffff, keyI: 2.5, fill: 0xeaf2ee, fillI: 0.8, sky: 0xffffff, ground: 0xc9d2cc, hemiI: 1.0, exposure: 1.05, gold: 0xcaa245, plate: 0xbcbf97, floor: 0x1d3023, velvet: 0x4a1f26, shadow: 0.3 },
    night: { key: 0xc6d8dc, keyI: 1.4, fill: 0xffe2b0, fillI: 0.6, sky: 0x93a5a8, ground: 0x0e1511, hemiI: 0.8, exposure: 1.22, gold: 0xbb9a40, plate: 0x949a76, floor: 0x121f17, velvet: 0x45191f, shadow: 0.5 },
  },
  office: {
    day: { key: 0xffffff, keyI: 2.5, fill: 0xe4ecff, fillI: 0.8, sky: 0xffffff, ground: 0xb4bac0, hemiI: 1.0, exposure: 1.05, gold: 0xd2d8dd, plate: 0xbcc4cc, floor: 0x24303e, velvet: 0x2c4a73, shadow: 0.28 },
    night: { key: 0xc3d6f0, keyI: 1.6, fill: 0xffd7a0, fillI: 0.7, sky: 0x9db0cc, ground: 0x1c242b, hemiI: 0.85, exposure: 1.2, gold: 0xb4bcc4, plate: 0x8a97a6, floor: 0x161e28, velvet: 0x25405f, shadow: 0.5 },
  },
};
/** What the metal reflects: a ceiling, a floor and the softboxes' colour (the shader's studio). A cool theme's boxes are cool. */
const ENVS = { day: { envSky: 0xaaa28e, envGround: 0x2c2418, envWin: 0xffeccb }, night: { envSky: 0x4a5784, envGround: 0x16151c, envWin: 0xffd6a2 } };
const ENV_COOL = { day: { envSky: 0xb4bcc6, envGround: 0x262a30, envWin: 0xeaf1fb }, night: { envSky: 0x46547e, envGround: 0x101318, envWin: 0xc4d3ee } };
export const skinFor = (theme, night) => { const k = night ? "night" : "day"; return { ...((theme === "modern" || theme === "office") ? ENV_COOL : ENVS)[k], ...(SKINS[theme] || SKINS.codex)[k] }; };
/** The gears' metals: colour, metalness, roughness. A gold, B blued steel, C anodised violet, the idler dark iron. */
export const METALS = [
  { color: 0xd9ae45, metalness: 0.7, roughness: 0.3 },
  { color: 0x5f93cf, metalness: 0.62, roughness: 0.32 },
  { color: 0xa878bc, metalness: 0.55, roughness: 0.34 },
  { color: 0x6a7077, metalness: 0.8, roughness: 0.4 },
];
