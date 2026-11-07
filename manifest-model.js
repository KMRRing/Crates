// Manifest's picture, as numbers: where each piece stands in the 3D scene, how the picture is framed, and where a tap
// lands. Pure (no page, no three.js), so tests/manifest.mjs can check it against the engine's own isometric geometry:
// the 3D drawing and the flat one are the same picture, package for package, pixel for pixel in the silhouette.
//
// The scene's axes are three.js's: x along the quay's near-right edge, y up, z along its near-left edge. The engine's
// cell (x, y, z) is the box at world (x·b.X, z·b.H, y·b.Y), b.X by b.H by b.Y big (boxFor: a cube), a piece inside its cell.
// The camera looks along (-1, -1, -1), orthographic: a true isometric view, and the engine's isoPoint is exactly that
// view stretched by √1.5 (its sx = .866(x − z), its sy = .5(x + z) − y, against 1/√2 and 1/√6 for a unit camera), so a
// box seen by the camera has the outline of the polygons cubeFaces gives.
import { isoPoint, cubeFaces, drawOrder, boxFor } from "./manifest-engine.js";
import { axisOf, isTimber, typeOf } from "./manifest-rules.js";
import { yawAlongY } from "./manifest-shapes.js";

export const QUAY_DEPTH = 0.42;                    // how far the quay's edge goes down below the floor, in cell heights
export const PX = 46;                              // the flat drawing's units per engine screen unit
export const ISO_K = Math.sqrt(1.5);               // engine screen units per camera-plane unit

/** What a box in the stack is: world centre and size, for the engine's cell (x, y, z) in the layout b. */
export function boxOf(x, y, z, b) {
  return { cx: (x + 0.5) * b.X, cy: (z + 0.5) * b.H, cz: (y + 0.5) * b.Y, sx: b.X, sy: b.H, sz: b.Y };
}
/** How a piece is turned about the vertical in the scene: timber (oak and birch) lies along x or along y by its tier (and the stack's
 *  turns), the rest stands as modelled. A tarpaulin (grey) hides what is under it, so it is never turned. */
export const yawOf = (c, turns, grey = false) => (!grey && isTimber(c.c) && axisOf(c.z, turns) === "y" ? yawAlongY : 0);
/** The box of a long log: the middle of its two cells' boxes (its mesh is two cells long, centred on both). */
export const joinBox = (a, b) => ({ ...a, cx: (a.cx + b.cx) / 2, cz: (a.cz + b.cz) / 2 });
/** The key a cell's piece goes by: a long log's low cell as the stack lies (both its cells), else the cell's own. */
export const pieceKey = c => c.piece ?? c.key;
/** The set of piece keys that a list of cell or piece keys name (a tap or a mark may name either half of a long log), given the
 *  layout's items: so a marked log is marked whole. */
export function piecesNamed(items, keys) {
  const named = new Set(keys), out = new Set();
  for (const it of items) if (named.has(it.key) || named.has(pieceKey(it))) out.add(pieceKey(it));
  return out;
}
/** A world point's place on the engine's screen. */
export const screenOf = ([wx, wy, wz]) => [0.866 * (wx - wz), 0.5 * (wx + wz) - wy];
/** The same, as the unit camera plane sees it (right, up), before the engine's stretch. */
export const planeOf = ([wx, wy, wz]) => [(wx - wz) / Math.SQRT2, (-wx + 2 * wy - wz) / Math.sqrt(6)];

/**
 * How the picture is framed (the flat drawing's way, which the 3D one follows): the engine screen rectangle that holds
 * the stack on its quay, as a view box in units of PX per engine unit, 10 of margin round it and `room` above for
 * packages coming down. `to` takes an engine screen point to a view box point.
 */
export function frameOf(X, Y, Z, b, { blank = false, drop = false, pad = 0, fit = 0 } = {}) {
  const pts = [], top = blank ? 0 : Z;                              // the quay alone is framed to its own size
  for (let x = 0; x <= X; x++) for (let y = 0; y <= Y; y++) for (let z = 0; z <= top; z++) pts.push(isoPoint(x, y, z, b));
  for (const [x, y] of [[0, Y], [X, Y], [X, 0]]) pts.push(isoPoint(x, y, -QUAY_DEPTH, b));
  const minX = Math.min(...pts.map(p => p.sx)), maxX = Math.max(...pts.map(p => p.sx)), minY = Math.min(...pts.map(p => p.sy)), maxY = Math.max(...pts.map(p => p.sy));
  const s = PX, margin = 10 + pad, room = drop ? s * 1.6 : s * 0.25;
  let W = (maxX - minX) * s + margin * 2, H = (maxY - minY) * s + margin * 2, marginX = margin, marginY = margin;
  // `fit`: the width over the height of the box the picture will fill. The frame grows to that shape round the stack (more of the harbour
  // at the sides, or above and below), so the picture covers its whole box (Korbi, 8 November 2026) and every drawing and tap still
  // runs on the one frame.
  if (fit > 0) {
    const have = W / (H + room);
    if (fit > have) { const extra = (fit * (H + room) - W) / 2; marginX += extra; W += 2 * extra; }
    else { const extra = (W / fit - (H + room)) / 2; marginY += extra; H += 2 * extra; }
  }
  return { W, H, room, s, minX, minY, margin, marginX, marginY, aspect: W / (H + room), to: ([sx, sy]) => [(sx - minX) * s + marginX, (sy - minY) * s + marginY] };
}
/** A square frame round one package alone, for the small picture beside an answer (the view box is 44 units, the package 40). */
export function iconFrame(b, long = false) {
  const poly = (long ? [0, 1] : [0]).flatMap(x => Object.values(cubeFaces(x, 0, 0, b)).flat()), xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys), size = Math.max(w, h), s = 40 / size, margin = 2;
  const minX = Math.min(...xs) - (size - w) / 2, minY = Math.min(...ys) - (size - h) / 2;
  return { W: 44, H: 44, room: 0, s, minX, minY, margin, aspect: 1, to: ([sx, sy]) => [(sx - minX) * s + margin, (sy - minY) * s + margin] };
}

/**
 * The orthographic camera that draws the frame: it looks at `at` (the stack's centre) from along (1, 1, 1), its
 * frustum the view box in camera-plane units (so a pixel of the canvas is a pixel of the flat drawing's view box).
 */
export function cameraOf(frame, X, Y, Z, b) {
  const at = [X * b.X / 2, Z * b.H / 2, Y * b.Y / 2], k = ISO_K;
  const [ax, ay] = screenOf(at);                                      // where the centre falls on the engine screen
  const viewX = vx => (vx - (frame.marginX ?? frame.margin)) / frame.s + frame.minX, viewY = vy => (vy - (frame.marginY ?? frame.margin)) / frame.s + frame.minY;
  return { at, dir: [1, 1, 1],
    left: (viewX(0) - ax) / k, right: (viewX(frame.W) - ax) / k,
    top: -(viewY(-frame.room) - ay) / k, bottom: -(viewY(frame.H) - ay) / k };
}

/** The stack's packages in drawing order (far to near, low to high), each with its box and its faces as view box polygons. */
export function layout(cells, turns, frame, facesOf = null) {
  const b = boxFor(turns);
  return drawOrder(cells, turns).map(c => {
    // `facesOf(x, y, z, b)`: the faces as another camera sees them (the long lens, manifest-lens.js); none, the engine's isometric ones
    const faces = facesOf ? facesOf(c.x, c.y, c.z, b) : Object.fromEntries(Object.entries(cubeFaces(c.x, c.y, c.z, b)).map(([k, poly]) => [k, poly.map(frame.to)]));
    return { ...c, key: `${c.x},${c.y},${c.z}`, box: boxOf(c.x, c.y, c.z, b), faces };
  });
}

const inside = (poly, px, py) => {
  let on = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) on = !on;
  }
  return on;
};
/** The package under a point of the view box: the nearest drawn (a later one covers an earlier), or null. */
export function packageAt(items, px, py) {
  for (let i = items.length - 1; i >= 0; i--) if (Object.values(items[i].faces).some(poly => inside(poly, px, py))) return items[i].key;
  return null;
}

/**
 * How a package falls: the height above its place (in cell heights) and its squash (the height scale; the width
 * and length swell to keep the volume) `u` of the way through its landing, 0 to 1. It drops for the first .6, strikes,
 * squashes, rebounds a little and settles; every package is still at u = 1, and LANDING (engine) is its whole time.
 */
export function fall(u, from = 1.5) {
  if (u <= 0) return { lift: from, squash: 1, fade: 0 };
  if (u >= 1) return { lift: 0, squash: 1, fade: 1 };
  const hit = 0.58;
  if (u < hit) { const k = u / hit; return { lift: from * (1 - k * k), squash: 1 + 0.03 * k, fade: Math.min(1, u / 0.2) }; }
  const v = (u - hit) / (1 - hit);                                    // after the strike
  const bounce = 4 * v * (1 - v) * 0.1 * (1 - v * 0.5);               // one small rebound
  const hitSquash = 1 - 0.09 * Math.exp(-((v / 0.22) ** 2));          // flattened for a moment on striking
  return { lift: bounce, squash: hitSquash, fade: 1 };
}

/** The shading the 3D drawing's lights give a plain surface on the left, right and top faces, as the flat one's .72, .86, 1.05,
 *  and the least a face keeps where another package's shadow falls on it (a top keeps .72 of what the sun gives it, a side
 *  face or a crevice less): measured on renders. tests/manifest.mjs weighs the wares' colours by them, so a ware in
 *  shadow is still told from one in the sun. */
export const FACE_SHADE = { left: 0.72, right: 0.83, top: 0.99 };
export const SHADOWED = 0.6;
