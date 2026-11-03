// The pure part of Dominoes' 3D table (bones-3d.js, drawn with three.js): where the line's tiles stand on the table, how big
// the table is and how the camera fits it, where a finger on the picture lands on the cloth, and the arc a tile is carried
// along when it is laid. No three.js and no page in it, so tests/bones-3d.mjs runs it in Node.
//
// The table is the xz plane, y up, +z toward you. A tile is 1 across and 2 along (the layout's units, bones-layout.js), so the
// layout's x is the table's x and the layout's y its z. The camera looks at the table's middle from DIST away at a height
// `elev` (0 level, 90 straight down); the table turns `yaw` under it, so the light stays on the same side of the screen.
// A view is a frustum in tangents (centre cu, cv and half sizes hu, hv), as three.js's makePerspective takes it.

export const DEG = Math.PI / 180;
export const DIST = 44;
export const TILE_T = 0.4;                         // a domino is 1 across, 2 along and this thick (the real ones are 1:2:0.36)
export const RIM = 0.72, RAIL = 0.36;              // the frame's width beyond the cloth, and how far it stands above it
export const MIN_ELEV = 36 * DEG, MAX_ELEV = 78 * DEG, START_ELEV = 54 * DEG, OPEN_MAX = 70 * DEG;
export const MAX_YAW = 24 * DEG, MAX_ZOOM = 2.6;
const TAU = Math.PI * 2;

export const clampElev = e => Math.max(MIN_ELEV, Math.min(MAX_ELEV, Number.isFinite(e) ? e : START_ELEV));
export const clampYaw = y => Math.max(-MAX_YAW, Math.min(MAX_YAW, Number.isFinite(y) ? y : 0));
export const clampZoom = z => Math.max(1, Math.min(MAX_ZOOM, Number.isFinite(z) ? z : 1));
export const wrap = a => { const r = (a + Math.PI) % TAU; return (r < 0 ? r + TAU : r) - Math.PI; };

/** A layout tile ({ x, y, v }) as the table stands it: its middle and its turn about the vertical. z0 is the field's centre. */
export const worldOf = (p, z0 = 0) => ({ x: p.x, z: p.y + z0, yaw: p.v ? -Math.PI / 2 : 0 });

// ---------- the table's size ----------
/** How many rows back a line needs for `units` along each arm in rows `len` long (as rowLenFor in bones-layout.js counts). */
export function rowsFor(len, units) {
  let r = 0;
  while (len / 2 + r * (len - 1) < units && r < 20) r++;
  return r;
}
/** The half depth of the cloth where the line is laid, for r rows back (the layout's own measure, bones.js drawBoard). */
export const fieldDepth = r => 2 * r + 2;

/** The corners of a table (frame and all) that the camera must keep in view: [[x, y, z]…]. */
export function outlineOf(hw, depth) {
  const out = [];
  for (const x of [-hw - RIM, hw + RIM]) for (const y of [0, RAIL]) for (const z of [-depth / 2 - RIM, depth / 2 + RIM]) out.push([x, y, z]);
  return out;
}

// ---------- the camera ----------
/** Where a point of the table (turned `yaw`) falls in the camera's tangents: u across, v up. */
export function project(p, yaw, elev) {
  const c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev);
  const rx = p[0] * c + p[2] * n, rz = -p[0] * n + p[2] * c, ry = p[1];
  const cy = s * DIST, cz = k * DIST, dy = ry - cy, dz = rz - cz;
  const depth = -s * dy - k * dz;
  return { u: rx / depth, v: (k * dy - s * dz) / depth, depth };
}
/** The tangents' box round the outline at this pose: { u0, u1, v0, v1 }. */
export function extent(outline, yaw, elev) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of outline) {
    const { u, v } = project(p, yaw, elev);
    if (u < u0) u0 = u;
    if (u > u1) u1 = u;
    if (v < v0) v0 = v;
    if (v > v1) v1 = v;
  }
  return { u0, u1, v0, v1 };
}
/** The frustum that shows the whole outline in a box of w by h, centred, with a small margin. */
export function frame(outline, yaw, elev, w, h, pad = 0.01) {
  const x = extent(outline, yaw, elev), aspect = w / h;
  let hu = ((x.u1 - x.u0) / 2) * (1 + pad), hv = ((x.v1 - x.v0) / 2) * (1 + pad);
  if (hu / hv < aspect) hu = hv * aspect; else hv = hu / aspect;
  return { cu: (x.u0 + x.u1) / 2, cv: (x.v0 + x.v1) / 2, hu, hv };
}
/** The pixel row of a table point in a box of h pixels, in the frustum f. */
export const rowOf = (p, yaw, elev, f, h) => ((f.cv + f.hv - project(p, yaw, elev).v) / (2 * f.hv)) * h;

/**
 * The table for a box of w by h pixels whose top `covered` pixels the other players' plates take: the length of the rows
 * (the largest tiles that hold `units` along each arm), the cloth, and a margin at the far end so the plates sit on the
 * frame and not on the line. Every length is tried; the one whose tiles are largest on the screen wins.
 */
export function planTable({ w, h, covered = 0, units = 22, minLen = 8 }) {
  const planAt = (len, elev, pad = 0) => {
    const r = rowsFor(len, units), hw = (len + 1) / 2, fd = fieldDepth(r) + pad / 2;
    const make = m => {
      const depth = 2 * fd + m, outline = outlineOf(hw, depth), f = frame(outline, 0, elev, w, h);
      return { depth, outline, f, top: rowOf([0, 0, -depth / 2 + m], 0, elev, f, h) };   // the cloth's far edge: where the line may begin
    };
    let lo = 0, hi = 16, cur = make(0);
    if (cur.top < covered) {
      for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; cur = make(mid); if (cur.top < covered) lo = mid; else hi = mid; }
      cur = make(hi);
    }
    const m = cur.depth - 2 * fd, size = Math.min(w / (2 * cur.f.hu), h / (2 * cur.f.hv)) / DIST;
    return { len, rows: r, hw, fd, m, z0: m / 2, depth: cur.depth, outline: cur.outline, size, elev };
  };
  let best = null;
  for (let len = Math.max(8, minLen + (minLen % 2)); len <= 60; len += 2) {
    const c = planAt(len, START_ELEV);
    if (!best || c.size > best.size * 1.0005) best = c;
  }
  // The table opens at the steepest angle that costs no tile size: while the box is the limit across, raising the camera
  // only fills the height it has spare (the tiles' long sides are less foreshortened), and past that it would shrink them.
  let pick = best;
  for (let e = START_ELEV; e <= OPEN_MAX; e += DEG) {
    const c = planAt(best.len, e);
    if (c.size >= best.size * 0.997) pick = c; else break;
  }
  // A box with height to spare (held sideways) gets a deeper table, more cloth round the line, so the table fills it.
  const base = pick;
  for (let pad = 0.5; pad < 40; pad += 0.5) {
    const c = planAt(base.len, base.elev, pad);
    if (c.size >= base.size * 0.955) pick = c; else break;
  }
  return pick;
}

/** The pose the player has asked for, kept inside what the table allows, and the frustum it gives in a box of w by h. */
export function viewIn(plan, want, w, h) {
  const yaw = clampYaw(want.yaw), elev = clampElev(want.elev), zoom = clampZoom(want.zoom);
  const base = frame(plan.outline, yaw, elev, w, h);
  const mu = base.hu - base.hu / zoom, mv = base.hv - base.hv / zoom;
  const panU = Math.max(-mu, Math.min(mu, want.panU || 0)), panV = Math.max(-mv, Math.min(mv, want.panV || 0));
  const f = { cu: base.cu + panU, cv: base.cv + panV, hu: base.hu / zoom, hv: base.hv / zoom };
  return { yaw, elev, zoom, panU, panV, base, f };
}

// ---------- a finger on the picture ----------
/** The point of the table's plane (height y) under pixel (px, py), in the table's own frame: [x, z]. */
export function groundAt(f, yaw, elev, w, h, px, py, y = 0) {
  const u = f.cu + ((px / w) * 2 - 1) * f.hu, v = f.cv - ((py / h) * 2 - 1) * f.hv, s = Math.sin(elev), k = Math.cos(elev);
  // the ray from the camera (0, s·DIST, k·DIST): forward, plus u to the right and v up the screen
  const dy = -s + v * k, dz = -k - v * s, t = (y - s * DIST) / dy;
  const wx = u * t, wz = k * DIST + dz * t, c = Math.cos(yaw), n = Math.sin(yaw);
  return [wx * c - wz * n, wx * n + wz * c];
}
/** The pixel [x, y] of a point of the table. */
export function pixelOf(f, yaw, elev, w, h, p) {
  const { u, v } = project(p, yaw, elev);
  return [((u - f.cu) / f.hu + 1) * w / 2, (1 - (v - f.cv) / f.hv) * h / 2];
}
/** The place that a point lands on or near, of those given as { x, z, yaw, … }: inside the tile grown by `reach`, the nearest middle. */
export function nearestPlace(places, pt, reach = 0.45) {
  let best = null, bd = Infinity;
  for (const p of places) {
    const dx = pt[0] - p.x, dz = pt[1] - p.z, c = Math.cos(p.yaw), n = Math.sin(p.yaw);
    const lx = dx * c - dz * n, lz = dx * n + dz * c;               // into the tile's own frame (its length along x)
    if (Math.abs(lx) > 1 + reach || Math.abs(lz) > 0.5 + reach) continue;
    const d = Math.hypot(dx, dz);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

// ---------- a tile laid ----------
const ease = u => u * u * (3 - 2 * u);
/** The carry from the hand to the line, u from 0 to 1: how far along (0..1), how high it is lifted, and how far it still leans over its long edge. */
export function flight(u) {
  const t = Math.max(0, Math.min(1, u)), e = ease(t);
  return { along: e, lift: 1.5 * Math.sin(Math.PI * Math.min(1, t * 1.05)), lean: 1.1 * (1 - e) * (1 - e), twist: 0.5 * (1 - e) };
}

// ---------- the pile of tiles face down ----------
const hash = n => { const x = Math.sin(n * 127.1 + 31.7) * 43758.5453; return x - Math.floor(x); };
/** Where the k-th of a pile's tiles lies, in a stack about (cx, cz): four to a layer, each layer a hair askew, so it reads as a heap. */
export function pileSpot(k, cx, cz) {
  const layer = Math.floor(k / 4), j = k % 4, col = j % 2, row = Math.floor(j / 2), skew = 0.015 + 0.012 * layer;
  return {
    x: cx + (col - 0.5) * 2.2 + (hash(k) - 0.5) * 0.06,
    z: cz + (row - 0.5) * 1.2 + (hash(k + 50) - 0.5) * 0.04,
    y: layer * TILE_T * 0.97,
    yaw: (hash(k + 99) - 0.5) * 2 * skew,
  };
}
/** The tiles of a state that are neither in a hand, in the line nor laid down: out of play (Fives and Threes deals fewer than 28). */
export function outOfPlay(s, count = 28) {
  const seen = new Set();
  for (const h of s.hands || []) for (const t of h) seen.add(t);
  for (const h of s.dead || []) for (const t of h) seen.add(t);
  if (s.first != null) seen.add(s.first);
  for (const l of [...(s.left || []), ...(s.right || [])]) seen.add(l.t);
  return Array.from({ length: count }, (_, t) => t).filter(t => !seen.has(t));
}

/** The seat a tile is carried from, as a point beyond the table's edge: you from below, the others from where they sit. */
export function handOrigin(place, plan) {
  const hw = plan.hw + RIM, hd = plan.depth / 2 + RIM;
  return { me: [0, 2.2, hd + 2.5], top: [0, 2.2, -hd - 2.5], left: [-hw - 2.5, 2.2, 0], right: [hw + 2.5, 2.2, 0] }[place] || [0, 2.2, hd + 2.5];
}
