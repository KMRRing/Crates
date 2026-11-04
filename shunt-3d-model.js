// Shunt's workshop in three dimensions, the parts that need no WebGL (so Node tests them): where things stand on the bench, which gear
// is at which height, how a gear turns, which lever a touch means, the camera's limits and its fit, and the colours of each theme by
// day and by night. shunt-view-3d.js draws it; shunt-3d-geo.js makes the shapes.
// One world unit is one cell (the distance between the centres of neighbours; the 2D view's D). x runs right, z towards the viewer
// (the 2D view's y), y up: seen from straight above it is the 2D picture, so a gear's angle, the levers' places and the tooth
// phases of shunt-view-2d.js hold as they are. The plate's top is y = 0.
import { CELLS } from "./shunt-engine.js";
import { LEVERS, D, PITCH, IDLER, FAMILY } from "./shunt-view-2d.js";

const DEG = Math.PI / 180;
export const SQ = 0.8660254;
export const cellW = i => [SQ * CELLS[i].q, CELLS[i].r + CELLS[i].q / 2];
export const CELL_R = 0.577;                      // a cell's corner radius (the hexagon's corners point left and right)
export const RO = 0.52;                           // a gear's outer radius: two neighbours' teeth overlap by 0.04 and interleave
export const BAIZE_R = 2.66, FRAME_R = 3.0;       // corner radii of the cloth and of the walnut frame (points up)
export const FLOOR = -0.09;                       // a recess's floor, below the plate's top

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
export const RAIL = { z: 3.75, x0: -1.4, x1: 2.68, w: 0.98 };
export const HOLD = { x: -2.0, z: 3.75, r: 0.64 };
export const QUEUE = [{ x: -0.86, s: 0.86 }, { x: 0.04, s: 0.64 }, { x: 0.76, s: 0.64 }, { x: 1.48, s: 0.64 }, { x: 2.2, s: 0.64 }];
/** The thirty levers, in world units: where each stands and the way it points. */
export const LEVER_W = LEVERS.map(l => ({ e: l.e, x: l.x / D, z: l.y / D, ux: l.ux, uz: l.uy, ang: Math.atan2(l.uy, l.ux) }));
/** How far from a lever's centre a touch still means it. The 2D view takes 0.62 of a cell and the nearest decides; a finger over a tilted
 *  plate is less sure, so this is wider (the levers are about 0.5 apart on a side, so the nearest still decides). */
export const HIT3 = 0.8;
export const nearestLever = (x, z, r = HIT3) => {
  let best = null, bd = r;
  for (const l of LEVER_W) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } }
  return best;
};
/** Whether a point of the plate's plane is on the cradle (generously), on the plate, or neither. */
export const holdAt = (x, z) => Math.hypot(x - HOLD.x, z - HOLD.z) < HOLD.r + 0.22;
export const onPlate = (x, z) => {
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3 + Math.PI / 6; if (x * Math.cos(a) + z * Math.sin(a) > FRAME_R * SQ + 0.05) return false; }
  return true;
};

// ---------- the camera: limited, so the board stays readable ----------
export const EL_MIN = 50 * DEG, EL_MAX = 86 * DEG, AZ_MAX = 15 * DEG;
export const clampView = (az, el) => [Math.max(-AZ_MAX, Math.min(AZ_MAX, az)), Math.max(EL_MIN, Math.min(EL_MAX, el))];
/** The elevation the bench is first seen from: a tall card has room to lean back, a wide one is seen from nearer overhead. */
export const homeEl = aspect => (aspect < 0.8 ? 60 : aspect < 1.1 ? 64 : 70) * DEG;
/** The camera's frame for yaw az and elevation el: right, up and the way back to the camera, unit vectors. */
export function basis(az, el) {
  const c = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)], r = [Math.cos(az), 0, -Math.sin(az)];
  const u = [c[1] * r[2], c[2] * r[0] - c[0] * r[2], -c[1] * r[0]];
  return { r, u, c };
}
/** The things that must stay in view: the frame's corners, up to the gears' height, and the rail's. */
export const KEEP = (() => {
  const p = [];
  for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * Math.PI / 3; for (const y of [-0.05, 0.62]) p.push([Math.cos(a) * (FRAME_R + 0.1), y, Math.sin(a) * (FRAME_R + 0.1)]); }
  for (const x of [HOLD.x - HOLD.r - 0.1, RAIL.x1 + 0.1]) for (const z of [RAIL.z - RAIL.w / 2 - 0.05, RAIL.z + RAIL.w / 2 + 0.05]) for (const y of [-0.05, 0.62]) p.push([x, y, z]);
  return p;
})();
/** The orthographic frame that holds `points` at this view: half-height H (the width is H times the aspect) and the point looked at. */
export function fit(points, az, el, aspect, margin = 0.12) {
  const { r, u, c } = basis(az, el);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of points) {
    const sx = p[0] * r[0] + p[1] * r[1] + p[2] * r[2], sy = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
    if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, H = Math.max((y1 - y0) / 2 + margin, ((x1 - x0) / 2 + margin) / aspect);
  return { H, look: [r[0] * cx + u[0] * cy, r[1] * cx + u[1] * cy, r[2] * cx + u[2] * cy] };
}

// ---------- the look: colours by theme, day and night (hex numbers; the gears' own colours are the game's and stay) ----------
/** What the bench is made of. `lamp` is how much of the room the lamp lights (night: a pool of light in a dim room). */
const CODEX = {
  day: { room: 0xb98e5d, benchA: 0xb5844f, benchB: 0x9a6b3c, frame: 0x6a4228, frameB: 0x4e2f1b, baize: 0x3b6b55, floor: 0x2a4a3c, rim: 0xc9a14a, rail: 0xd3ad56, velvet: 0x4d1824, paper: 0xe8d8b0,
    key: 0xfff0d2, keyI: 3.2, sky: 0xfff3dd, ground: 0x7a5a3c, hemiI: 0.62, fill: 0xbcd2ff, fillI: 0.5, exposure: 1.0, lamp: 0.25, shade: 0x2f6b4f, grain: 1 },
  night: { room: 0x1a120c, benchA: 0x7c5532, benchB: 0x5e3f24, frame: 0x4a2c19, frameB: 0x36200f, baize: 0x2d5646, floor: 0x1d382c, rim: 0xc9a14a, rail: 0xd3ad56, velvet: 0x5a1a25, paper: 0xd9c79a,
    key: 0xffd9a6, keyI: 3.1, sky: 0x8296c4, ground: 0x2d1f14, hemiI: 0.78, fill: 0x7a95d6, fillI: 0.4, exposure: 1.1, lamp: 1, shade: 0x2f6b4f, grain: 1 },
};
const MODERN = {
  day: { room: 0xd6cdbb, benchA: 0xd9c9a8, benchB: 0xc8b48d, frame: 0xc29a66, frameB: 0xa07b49, baize: 0x3f6479, floor: 0x2d4a5a, rim: 0xcfd4d8, rail: 0xd5dade, velvet: 0x2b3f55, paper: 0xf1ead8,
    key: 0xfff6e8, keyI: 2.6, sky: 0xffffff, ground: 0x93896f, hemiI: 1.35, fill: 0xc9dcff, fillI: 0.5, exposure: 1.0, lamp: 0.15, shade: 0x3b5a73, grain: 0.7 },
  night: { room: 0x10161b, benchA: 0x6f6350, benchB: 0x594f3f, frame: 0x7b6040, frameB: 0x5f4a31, baize: 0x35566a, floor: 0x233a48, rim: 0xb8bfc6, rail: 0xc1c8ce, velvet: 0x22364a, paper: 0xd8d0bb,
    key: 0xffe4be, keyI: 2.9, sky: 0x8aa2cc, ground: 0x23282e, hemiI: 0.78, fill: 0x7a9fe0, fillI: 0.4, exposure: 1.1, lamp: 1, shade: 0x3b5a73, grain: 0.7 },
};
const KONTOR = {
  day: { room: 0x6f8a74, benchA: 0x56755f, benchB: 0x486653, frame: 0x8b6a3d, frameB: 0x6d5029, baize: 0x31603f, floor: 0x234632, rim: 0xc9a14a, rail: 0xd3ad56, velvet: 0x4a1f26, paper: 0xe9e0c0,
    key: 0xfff3d6, keyI: 2.6, sky: 0xf2f7ea, ground: 0x4f6a55, hemiI: 1.3, fill: 0xcfe2ff, fillI: 0.45, exposure: 1.0, lamp: 0.2, shade: 0x1f5a3c, grain: 0.5 },
  night: { room: 0x0d150f, benchA: 0x2f4a38, benchB: 0x253d2e, frame: 0x6a4e2a, frameB: 0x4c3720, baize: 0x28503a, floor: 0x1a3526, rim: 0xc9a14a, rail: 0xd3ad56, velvet: 0x45191f, paper: 0xd8cfae,
    key: 0xffd9a0, keyI: 3.0, sky: 0x7aa08a, ground: 0x1a2a1d, hemiI: 0.78, fill: 0x7aa4d0, fillI: 0.36, exposure: 1.1, lamp: 1, shade: 0x1f5a3c, grain: 0.5 },
};
const OFFICE = {
  day: { room: 0xcdd3da, benchA: 0xc5cbd3, benchB: 0xb4bbc5, frame: 0x41464e, frameB: 0x2f3338, baize: 0x3b6694, floor: 0x294a70, rim: 0xc2cad2, rail: 0xcfd6dc, velvet: 0x2c4a73, paper: 0xf4f1e8,
    key: 0xfffaf0, keyI: 2.5, sky: 0xffffff, ground: 0x959ba3, hemiI: 1.4, fill: 0xd8e6ff, fillI: 0.5, exposure: 1.0, lamp: 0.1, shade: 0x3a6ea5, grain: 0.25 },
  night: { room: 0x14171b, benchA: 0x5a606a, benchB: 0x4a4f58, frame: 0x30343a, frameB: 0x222529, baize: 0x35587f, floor: 0x233f5e, rim: 0xb4bcc4, rail: 0xc0c7ce, velvet: 0x25405f, paper: 0xd4d2c8,
    key: 0xffe8c8, keyI: 2.9, sky: 0x8aa6d0, ground: 0x23272c, hemiI: 0.78, fill: 0x86abe6, fillI: 0.4, exposure: 1.1, lamp: 1, shade: 0x3a6ea5, grain: 0.25 },
};
const SKINS = { codex: CODEX, modern: MODERN, kontor: KONTOR, office: OFFICE };
/** What the metal and varnish reflect: a sky, a floor, and a softbox where the lamp is (the shader's studio). */
const ENVS = { day: { envSky: 0x6a6252, envGround: 0x120d08, envWin: 0xe6cf9a }, night: { envSky: 0x1a1f33, envGround: 0x0a0604, envWin: 0xd89a50 } };
const ENV_COOL = { day: { envSky: 0x66707a, envGround: 0x14181c, envWin: 0xdfe6ee }, night: { envSky: 0x1b2438, envGround: 0x07090c, envWin: 0xb4c2e0 } };
export const skinFor = (theme, night) => { const k = night ? "night" : "day"; return { ...((theme === "modern" || theme === "office") ? ENV_COOL : ENVS)[k], ...(SKINS[theme] || CODEX)[k] }; };
/** The gears' metals: colour, metalness, roughness. A gold, B blued steel, C anodised violet, the idler dark iron. */
export const METALS = [
  { color: 0xd9ae45, metalness: 0.7, roughness: 0.3 },
  { color: 0x5f93cf, metalness: 0.62, roughness: 0.32 },
  { color: 0xa878bc, metalness: 0.55, roughness: 0.34 },
  { color: 0x6a7077, metalness: 0.8, roughness: 0.4 },
];
