// Slipway's rules: what each tool may do to the block, and what solves a level. No page here (the tests play every level
// through these same functions, so the page and the proof can't disagree).
//
// The saw cuts the plane through your eye and your line, so what you cut depends on where you look from; it follows the
// faces of the part (a plane within a few degrees of one is that face, and one near the part's edge is laid on it), and a
// cut that would go into the part is refused. The plane takes the top three layers of the waste under its sole, never past
// the line, and stops on a knot. The drill goes straight along your line of sight, starting on a face square to the bit,
// and the block rests on the bench: only its top and sides are open. A knot left in the part, any wood cut from it or
// too much waste left on it, and the level is not done.
import { SOLID, newBlock, place, idx, hit, normalAt, cut, drill, plane, shave, chop, gouge, thin, STROKE, grade, centre, eyeFor, sample, targetAt, VIEWS } from "./slipway-carve.js";

const DEG = Math.PI / 180;
export const TURN = Math.cos(6 * DEG);          // a cut plane within 6° of a face of the part is that face
export const PLANE_TURN = Math.cos(10 * DEG);   // the plane's sole, within 10° of a face, lies on it
export const SQUARE = Math.cos(12 * DEG);       // the bit starts on a face within 12° of square to it
export const AXIS = Math.cos(5 * DEG);          // a line of sight within 5° of an axis is along it
export const PULL_IN = 1.5, PULL_OUT = 2.5;     // the saw is laid on the part's edge if your line is this close inside it, or this close outside
export const HOLE_PULL = 2.2;                   // the drill finds a hole's axis within this many cells
export const LIMIT = { left: 8, into: 0.006 };  // the waste left on the part (in cells), and the share of the part cut away, that still count as done

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
/** The faces a cut or a sole may lie on: the part's own, and the block's three axes. */
const faces = b => [...b.planes.map(p => p.slice(0, 3)), ...AXES];

// ---------- the saw ----------
/** The highest point of the part in direction u: { h (u·q), q } over the part's cells. */
export function support(b, u) {
  let h = -Infinity, at = 0;
  for (let q = 0, ip = b.ip; q < ip.length; q += 3) { const v = u[0] * ip[q] + u[1] * ip[q + 1] + u[2] * ip[q + 2]; if (v > h) { h = v; at = q; } }
  return { h, q: [b.ip[at], b.ip[at + 1], b.ip[at + 2]] };
}
/**
 * Where a saw drawn on the plane n·p = d0 (n a unit normal, either way round) would cut: { u (at the waste), s (the cut is
 * u·p = s), ok, reason, gain (wood it would take, in cells), into (the part's cells it would cut), snapped }. The normal
 * is laid on a face of the part when it is within 6° of one; the plane is laid on the part's edge in that direction
 * when your line is within PULL_IN inside it or PULL_OUT outside it; and the waste is the side with less of the part.
 */
export function planSaw(b, n, d0) {
  let n1 = n, best = TURN, turned = false;
  for (const f of faces(b)) { const c = dot(n, f); if (Math.abs(c) > best) { best = Math.abs(c); n1 = c < 0 ? f.map(v => -v) : f; turned = true; } }
  const g = b.g, here = dot(n, g) - d0, pg = [g[0] - here * n[0], g[1] - here * n[1], g[2] - here * n[2]], d1 = dot(n1, pg);
  let plus = 0, minus = 0;
  for (let q = 0, ip = b.ip; q < ip.length; q += 3) { if (n1[0] * ip[q] + n1[1] * ip[q + 1] + n1[2] * ip[q + 2] > d1) plus++; else minus++; }
  const u = plus <= minus ? n1 : n1.map(v => -v);
  const { h, q } = support(b, u);
  // the part's edge in this direction: its own flat face if the cut lies on one, else half a cell past its highest wood
  const face = b.planes.find(p => dot(u, p) > 0.9999), edge = face ? face[3] : h + 0.5;
  const off = dot(n, q) - d0;                                          // how far the drawn plane is from the part's edge, along n
  const qd = [q[0] - off * n[0], q[1] - off * n[1], q[2] - off * n[2]];
  const gap = dot(u, qd) - edge;                                       // + your line is outside the part's edge, - inside it
  const laid = gap >= -PULL_IN && gap <= PULL_OUT;
  const s = laid ? edge : dot(u, qd);
  let into = 0, gain = 0;
  for (let k = 0, m = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++, m++) {
    const v = u[0] * (i + 0.5) + u[1] * (j + 0.5) + u[2] * (k + 0.5) - s;
    if (v <= -0.5 || !b.d[m]) continue;
    gain += Math.min(1, v + 0.5) * b.d[m] / 255;
    if (b.target[m] < -0.7 && b.d[m] >= SOLID) into++;
  }
  const ok = into === 0 && gain >= 0.5;
  return { u, s, ok, reason: into ? "into" : gain < 0.5 ? "nothing" : "", gain, into, snapped: { face: turned, edge: laid } };
}
/** The saw's plane from where the eye is and two points on the line drawn across the bench (the line's two ends, as points in the block): the plane through all three. */
export function planeThrough(eye, p1, p2) {
  const a = p1.map((v, i) => v - eye[i]), c = p2.map((v, i) => v - eye[i]);
  const n = [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], l = Math.hypot(...n);
  const u = n.map(v => v / l);
  return { n: u, d0: dot(u, eye) };
}
/** The saw along a plan: takes the wood beyond it. Returns what it took, in cells. */
export const doSaw = (b, plan) => cut(b, plan.u, plan.s);
/** The plane the saw would cut, as the corners of its outline in the block (for drawing the guide). */
export function outline(b, u, s) {
  const hi = [b.nx, b.ny, b.nz], pts = [];
  for (let a = 0; a < 3; a++) for (const x of [0, hi[a]]) for (const y of [0, hi[(a + 1) % 3]]) {
    // an edge of the box along axis (a + 2) % 3, at the corner (x, y) of the other two
    const c = (a + 2) % 3, o = [0, 0, 0];
    o[a] = x; o[(a + 1) % 3] = y;
    if (Math.abs(u[c]) < 1e-9) continue;
    const t = (s - dot(u, o)) / u[c];
    if (t < -1e-9 || t > hi[c] + 1e-9) continue;
    const p = o.slice(); p[c] = t;
    if (!pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) < 1e-6)) pts.push(p);
  }
  if (pts.length < 3) return [];
  const mid = pts.reduce((m, p) => m.map((v, i) => v + p[i] / pts.length), [0, 0, 0]);
  const e1 = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let x = [e1[1] * u[2] - e1[2] * u[1], e1[2] * u[0] - e1[0] * u[2], e1[0] * u[1] - e1[1] * u[0]];
  const lx = Math.hypot(...x); x = x.map(v => v / lx);
  const y = [u[1] * x[2] - u[2] * x[1], u[2] * x[0] - u[0] * x[2], u[0] * x[1] - u[1] * x[0]];
  return pts.sort((p, q) => Math.atan2(dot(p.map((v, i) => v - mid[i]), y), dot(p.map((v, i) => v - mid[i]), x)) - Math.atan2(dot(q.map((v, i) => v - mid[i]), y), dot(q.map((v, i) => v - mid[i]), x)));
}

// ---------- the plane ----------
/** The facing of the sole where a stroke begins: the surface's normal, laid on a face of the part (or an axis) within 10°. */
export function soleFacing(b, n) {
  let best = PLANE_TURN, out = n;
  for (const f of faces(b)) for (const sgn of [1, -1]) { const c = dot(n, f) * sgn; if (c > best) { best = c; out = f.map(v => v * sgn); } }
  return out;
}
/**
 * The sole's facing for a whole stroke, from the surface normals under it: the one most of them agree with (within 10°),
 * laid on a face as above. A stroke that starts or ends on the wall of a pocket must not tip the sole with it.
 */
export function strokeFacing(b, normals) {
  let best = normals[0], most = 0;
  for (const n of normals) {
    let c = 0;
    for (const m of normals) if (dot(n, m) > PLANE_TURN) c++;
    if (c > most) { most = c; best = n; }
  }
  return soleFacing(b, best);
}
export const WITH = Math.cos(35 * DEG), ACROSS = Math.cos(55 * DEG);   // a stroke with the grain is within 35° of it; one across it, at least 55°
export const FLAT = 0.6;                         // the share of a plane's stroke that must lie flat on its sole
/**
 * A stroke tool (plane, spokeshave or adze) drawn along the surface points `pts`, its sole facing n: { ok, took, reason }.
 * The plane and the spokeshave go with the grain and the adze across it; the plane needs a flat face, the spokeshave not
 * too much stock, and a knot stops the plane and the spokeshave.
 */
export function doStroke(b, tool, n, pts) {
  const g = AXES[b.grain], first = pts[0], last = pts[pts.length - 1];
  const len = Math.hypot(last[0] - first[0], last[1] - first[1], last[2] - first[2]);
  if (len < 4) return { ok: false, took: 0, reason: "short" };
  const along = Math.abs(dot([last[0] - first[0], last[1] - first[1], last[2] - first[2]], g)) / len;
  if (tool === "adze") { if (along > ACROSS) return { ok: false, took: 0, reason: "digs" }; }
  else {
    if (Math.abs(dot(n, g)) > 0.9) return { ok: false, took: 0, reason: "end" };
    if (along < WITH) return { ok: false, took: 0, reason: "tearout" };
  }
  if (tool === "plane") {
    const mid = pts.length >= 4 ? pts.slice(1, -1) : pts;              // the ends of a stroke in a pocket sit on its walls
    let flat = 0;
    for (const q of mid) if (dot(normalAt(b, ...q), n) > PLANE_TURN) flat++;
    if (flat < mid.length * FLAT) return { ok: false, took: 0, reason: "rocks" };
  }
  if (tool === "shave") {
    const r = shave(b, pts);
    return { ok: r.took >= 0.5, took: r.took, reason: r.knot ? "knot" : r.jam ? "jam" : r.took < 0.5 ? "nothing" : "" };
  }
  const r = plane(b, n, pts, STROKE[tool]);
  return { ok: r.took >= 0.5, took: r.took, reason: r.knot ? "knot" : r.took < 0.5 ? "nothing" : "" };
}
export const doPlane = (b, n, pts) => doStroke(b, "plane", n, pts);
/** Surface points along a stroke through `aim` points: each aim is cast at the block along -n, and the stroke goes through where it lands, every two cells. */
export function strokeOn(b, n, aim) {
  const out = [];
  const at = p => { const h = hit(b, [p[0] + n[0] * 60, p[1] + n[1] * 60, p[2] + n[2] * 60], n.map(v => -v)); return h ? h.p : null; };
  for (let i = 0; i < aim.length; i++) {
    const a = aim[i], z = aim[i + 1];
    const steps = z ? Math.max(1, Math.ceil(Math.hypot(z[0] - a[0], z[1] - a[1], z[2] - a[2]) / 2)) : 1;
    for (let s = 0; s < steps || (!z && s === 0); s++) {
      const p = z ? a.map((v, k) => v + (z[k] - v) * s / steps) : a, q = at(p);
      if (q) out.push(q);
    }
  }
  return out;
}

// ---------- the drill ----------
export const EXIT = Math.cos(15 * DEG), DISH = Math.cos(25 * DEG);   // the bit's far face within 15° of square; the gouge starts within 25°
/** The axis a line of sight is along (within 5°), or -1. */
const axisOf = sight => AXES.findIndex((_, a) => Math.abs(sight[a]) > AXIS);
/**
 * Where a bit set on the wood at p (the surface there facing n) would bore, looking along `sight`: { ok, reason, p, d }.
 * A line of sight within 5° of an axis is along it; the bit needs a face within 12° of square to it, and the face it comes
 * out of within 15° (else it blows out); a hole of the part's whose axis it is near (within HOLE_PULL) is bored on its axis.
 * A knot on the line grabs the bit, and a wall thinner than 1.8 cells round it splits.
 */
export function planDrill(b, p, n, sight) {
  let d = sight;
  const axis = axisOf(sight);
  if (axis >= 0) d = AXES[axis].map(v => v * Math.sign(sight[axis]));
  if (-dot(n, d) < SQUARE) return { ok: false, reason: "skates", p, d };
  let at = p, snapped = false;
  if (axis >= 0) {
    const others = [0, 1, 2].filter(a => a !== axis);                  // across the hole: its two other coordinates, in x, y, z order
    for (const h of b.holes) {
      if (h.axis !== axis) continue;
      if (Math.hypot(p[others[0]] - h.at[0], p[others[1]] - h.at[1]) > HOLE_PULL) continue;
      at = p.slice(); at[others[0]] = h.at[0]; at[others[1]] = h.at[1]; snapped = true;
      break;
    }
  }
  const far = hit(b, [at[0] + d[0] * 300, at[1] + d[1] * 300, at[2] + d[2] * 300], d.map(v => -v));
  if (far && dot(far.n, d) < EXIT) return { ok: false, reason: "blowout", p: at, d };
  if (b.knots.some(([kx, ky, kz, kr]) => { const w = [kx - at[0], ky - at[1], kz - at[2]], t = dot(w, d); return t > -kr && Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t) < kr + 1.5; })) return { ok: false, reason: "grabs", p: at, d };
  if (thin(b, at, d, 1.5)) return { ok: false, reason: "splits", p: at, d };
  return { ok: true, reason: "", p: at, d, snapped };
}
export function doDrill(b, plan) {
  const took = drill(b, plan.p, plan.d);
  return { ok: took >= 0.3, took, reason: took < 0.3 ? "nothing" : "" };
}

// ---------- the back saw and the chisel ----------
/**
 * Where a back saw drawn on the plane n·p = d0 would score: a wall of the part the line is laid on (within PULL_IN inside
 * it or PULL_OUT outside), and no other plane. { ok, reason, wall, u, s }. It needs wood on the waste side of the wall to
 * cut into, and a wall is scored once.
 */
export function planKerf(b, n, d0) {
  let best = null;
  b.walls.forEach((w, i) => {
    if (Math.abs(dot(n, w.u)) < TURN) return;
    const off = dot(n, w.at) - d0, qd = [w.at[0] - off * n[0], w.at[1] - off * n[1], w.at[2] - off * n[2]], gap = dot(w.u, qd) - w.s;
    if (gap < -PULL_IN || gap > PULL_OUT) return;
    if (!best || Math.abs(gap) < best.gap) best = { i, gap: Math.abs(gap) };
  });
  if (!best) return { ok: false, reason: "wall" };
  const w = b.walls[best.i];
  if (b.kerfs.some(k => k.w === best.i)) return { ok: false, reason: "scored", wall: best.i, u: w.u, s: w.s };
  let wood = 0;
  for (let k = 0, m = 0; k < b.nz; k++) for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++, m++) {
    const v = w.u[0] * (i + 0.5) + w.u[1] * (j + 0.5) + w.u[2] * (k + 0.5) - w.s;
    if (v > 0 && v <= 1.2 && b.d[m] >= SOLID && b.target[m] > 0) wood++;
  }
  return { ok: wood >= 6, reason: wood >= 6 ? "" : "nothing", wall: best.i, u: w.u, s: w.s };
}
export function doKerf(b, plan) { b.kerfs.push({ u: plan.u, s: plan.s, w: plan.wall }); return { ok: true, took: 0, reason: "" }; }
/** Whether the wood at c (a cell's middle) is free along the grain: on each side the way to the part's wall is scored, or ends in air. */
function released(b, c) {
  const g = AXES[b.grain];
  for (const sgn of [1, -1]) {
    for (let t = 0.5; t < 80; t += 0.5) {
      const q = [c[0] + g[0] * sgn * t, c[1] + g[1] * sgn * t, c[2] + g[2] * sgn * t];
      if (q[0] < 0 || q[1] < 0 || q[2] < 0 || q[0] > b.nx || q[1] > b.ny || q[2] > b.nz) break;
      const wood = sample(b, ...q) >= SOLID;
      if (wood && targetAt(b, ...q) <= 0.5) {                          // the part's own wood: a kerf must score this wall
        if (!b.kerfs.some(k => Math.abs(dot(k.u, q) - k.s) <= 1.2 && dot(k.u, g) * sgn < -0.9)) return false;
        break;
      }
      if (!wood) break;                                                 // open air: the fibres are free this way
    }
  }
  return true;
}
/**
 * Where a chisel set on the wood at p (facing n) would chop, looking along `sight`: it goes square into a face (12°)
 * along an axis, never into end grain. { ok, reason, p, d }.
 */
export function planChisel(b, p, n, sight) {
  const axis = axisOf(sight);
  if (axis < 0) return { ok: false, reason: "skates", p };
  const d = AXES[axis].map(v => v * Math.sign(sight[axis]));
  if (-dot(n, d) < SQUARE) return { ok: false, reason: "skates", p, d };
  if (Math.abs(dot(d, AXES[b.grain])) > 0.5) return { ok: false, reason: "end", p, d };
  return { ok: true, reason: "", p, d };
}
export function doChisel(b, plan) {
  const r = chop(b, plan.p, plan.d, c => released(b, c));
  return { ok: r.took >= 0.5, took: r.took, reason: r.took >= 0.5 ? "" : r.blocked ? "splits" : "nothing" };
}

// ---------- the gouge ----------
/** Where a gouge set on the wood at p (facing n), looking along `sight`, would scoop: the dish of the part it is near (within HOLE_PULL of its axis). */
export function planGouge(b, p, n, sight) {
  const d = sight;
  if (-dot(n, d) < DISH) return { ok: false, reason: "steep", p, d };
  if (Math.abs(dot(d, AXES[b.grain])) > 0.5) return { ok: false, reason: "end", p, d };
  let dish = null;
  for (const h of b.hollows) {
    const w = [h.at[0] - p[0], h.at[1] - p[1], h.at[2] - p[2]], t = dot(w, d), off = Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t);
    if (off <= HOLE_PULL + h.r * 0.4 && (!dish || off < dish.off)) dish = { h, off };
  }
  if (!dish) return { ok: false, reason: "slips", p, d };
  if (thin(b, dish.h.at, d, dish.h.rim, 0)) return { ok: false, reason: "chips", p, d };
  return { ok: true, reason: "", p, d, dish: dish.h };
}
export function doGouge(b, plan) {
  const took = gouge(b, plan.dish.at, plan.dish.r);
  return { ok: took >= 0.5, took, reason: took < 0.5 ? "nothing" : "" };
}

// ---------- done, and how well ----------
/** How the block stands: the grade, and whether the level is solved. */
export function status(b) {
  const g = grade(b);
  return { ...g, solved: g.left <= LIMIT.left && g.into <= LIMIT.into && g.knots === 0 };
}
/** Stars for solving with `used` tools: three at the par, two a tool over, one more. */
export const starsFor = (level, used) => (used <= level.par ? 3 : used <= level.par + 1 ? 2 : 1);
export const total = level => Object.values(level.budget).reduce((a, v) => a + v, 0);

// ---------- playing a solution through the same rules ----------
/** Whether a tool has any use left. */
export const left = (level, used, tool) => (level.budget[tool] || 0) - (used[tool] || 0);
/** The tools, in the order the palette shows them. */
export const TOOLS = ["saw", "kerf", "chisel", "plane", "shave", "adze", "drill", "gouge"];
export const newUsed = () => Object.fromEntries(TOOLS.map(t => [t, 0]));
export const usesOf = used => TOOLS.reduce((n, t) => n + (used[t] || 0), 0);
/** A block for a level, placed as asked (default: the level's own). */
export const blockFor = (level, at) => newBlock(level, at || level.place);
/**
 * Plays one tool use of a solution on the block with the rules above: { ok, reason }. A saw (or a kerf) is drawn perfectly
 * along its face (the line is on the part's edge) unless `line` is given: [view, p1, p2], the two ends of a line drawn from that view.
 * A use is { tool, ... } in the part's own coordinates: saw { u }, kerf { wall }, plane/shave/adze { n, aim },
 * drill/chisel/gouge { d, at }.
 */
export function apply(b, op, line) {
  const a = b.flip ? -1 : 1;
  if (op.tool === "saw" || op.tool === "kerf") {
    let plan;
    if (line) { const e = eyeFor(b, VIEWS[line[0]] || line[0]), { n, d0 } = planeThrough(e, line[1], line[2]); plan = op.tool === "saw" ? planSaw(b, n, d0) : planKerf(b, n, d0); }
    else if (op.tool === "kerf") { const w = b.walls[op.wall]; plan = planKerf(b, w.u, w.s + 0.25); }
    else { const u = [op.u[0] * a, op.u[1], op.u[2]], { h } = support(b, u); plan = planSaw(b, u, h + 0.25); }
    if (!plan.ok) return { ok: false, reason: plan.reason, plan };
    if (op.tool === "kerf") return { ...doKerf(b, plan), plan };
    doSaw(b, plan);
    return { ok: true, reason: "", plan };
  }
  const part = p => [b.flip ? b.px + b.off - p[0] : p[0] + b.off, p[1], p[2]];
  if (op.tool === "plane" || op.tool === "shave" || op.tool === "adze") {
    const n = [op.n[0] * a, op.n[1], op.n[2]], pts = strokeOn(b, n, op.aim.map(part));
    return pts.length ? doStroke(b, op.tool, n, pts) : { ok: false, reason: "miss" };
  }
  const d = [op.d[0] * a, op.d[1], op.d[2]], p = part(op.at), h = hit(b, [p[0] - d[0] * 60, p[1] - d[1] * 60, p[2] - d[2] * 60], d);
  if (!h) return { ok: false, reason: "miss" };
  if (op.tool === "chisel") { const plan = planChisel(b, h.p, h.n, d); return plan.ok ? doChisel(b, plan) : plan; }
  if (op.tool === "gouge") { const plan = planGouge(b, h.p, h.n, d); return plan.ok ? doGouge(b, plan) : plan; }
  const plan = planDrill(b, h.p, h.n, d);
  return plan.ok ? doDrill(b, plan) : plan;
}
/** The block copied, to try a use on without spoiling it (the search, the ghost of a cut about to be made). */
export const copyOf = b => ({ ...b, d: b.d.slice(), kerfs: b.kerfs.slice() });
/** What a use would take from the block, as a grid of how much of each cell (0..255) it removes, and how it fared: { r, gone }. The block itself is untouched. */
export function trial(b, fn) {
  const c = copyOf(b), r = fn(c), gone = new Uint8Array(b.d.length);
  for (let m = 0; m < gone.length; m++) gone[m] = b.d[m] - c.d[m];
  return { r, gone, block: c };
}
/** Plays a whole solution (or its first `n` uses): { b, used, results }. */
export function play(level, sol = level.solution, n = Infinity) {
  const b = blockFor(level, sol.place), used = newUsed(), results = [];
  for (const op of sol.ops.slice(0, n)) {
    const r = apply(b, op);
    results.push(r);
    if (r.ok) used[op.tool]++;
  }
  return { b, used, results };
}

// ---------- the hint ----------
/**
 * The next use of the level's solution that the block still wants, with where to look from: { place } if the part should
 * be slid or turned first, else { op, index } (the first use whose wood is still on, or a kerf the chisel after it needs), else null.
 */
export function hint(level, b) {
  const sol = level.solution;
  if (sol.place && (b.off !== sol.place.off || b.flip !== sol.place.flip)) return { place: sol.place };
  const play = blockFor(level, sol.place), kerfs = [];
  for (const [index, op] of sol.ops.entries()) {
    const before = play.d.slice();
    apply(play, op);
    if (op.tool === "kerf") { kerfs.push({ op, index }); continue; }
    let gone = 0, still = 0;
    for (let m = 0; m < before.length; m++) if (before[m] >= SOLID && play.d[m] < SOLID) { gone++; if (b.d[m] >= SOLID) still++; }
    if (gone && still / gone > 0.15) return (op.tool === "chisel" && kerfs.find(k => !b.kerfs.some(x => x.w === k.op.wall))) || { op, index };
  }
  return null;
}

// ---------- every way of using a level's tools, for the tests ----------
/**
 * Every use worth trying on a level: the saw along each flat face (both ways), a kerf on each wall, the strokes and chops
 * and dishes the level lists, the drill on each hole from each open end (the bench side is closed).
 */
export function library(level) {
  const ops = [], [L, H, W] = level.size;
  for (const [nx, ny, nz] of level.shape.planes || []) for (const sgn of [1, -1]) ops.push({ tool: "saw", u: [nx * sgn, ny * sgn, nz * sgn] });
  (level.walls || []).forEach((_, wall) => ops.push({ tool: "kerf", wall }));
  for (const s of level.strokes || []) ops.push({ tool: s.tool || "plane", n: s.n, aim: s.aim });
  for (const c of level.chops || []) ops.push({ tool: "chisel", d: c.d, at: c.at });
  for (const h of level.hollows || []) ops.push({ tool: "gouge", d: h.d || [0, -1, 0], at: h.from || [h.at[0], H, h.at[2]] });
  for (const h of level.holes || []) {
    if (h.axis === 1) ops.push({ tool: "drill", d: [0, -1, 0], at: [h.at[0], H, h.at[1]] });
    else if (h.axis === 2) { ops.push({ tool: "drill", d: [0, 0, -1], at: [h.at[0], h.at[1], W] }); ops.push({ tool: "drill", d: [0, 0, 1], at: [h.at[0], h.at[1], 0] }); }
    else { ops.push({ tool: "drill", d: [-1, 0, 0], at: [L, h.at[0], h.at[1]] }); ops.push({ tool: "drill", d: [1, 0, 0], at: [0, h.at[0], h.at[1]] }); }
  }
  return ops;
}
/**
 * Searches the level's uses breadth first (blocks that came out the same are one): the fewest uses that solve it within
 * its budget from this placement (or from a block already worked on, `from` = { b, used }), and how many different orders of that many solve it. Returns { best, orders, path (one solving order) } or null (nothing solves it); { capped: true } if `maxNodes` uses were tried without an answer.
 */
export function search(level, at, cap = 8, from = null, maxNodes = Infinity) {
  let nodes = 0;
  const start = from ? from.b : blockFor(level, at);
  // a saw or a kerf that does nothing now never will (wood only comes off); the rest may wait on a knot or a kerf
  const ops = library(level).filter(op => (op.tool !== "saw" && op.tool !== "kerf") || apply(copyOf(start), op).ok);
  const key = b => { let h = 2166136261; for (let i = 0; i < b.d.length; i++) h = Math.imul(h ^ b.d[i], 16777619); for (const k of b.kerfs) h = Math.imul(h ^ (k.w + 1), 16777619); return h >>> 0; };
  let frontier = [{ b: start, used: from ? { ...from.used } : newUsed(), orders: 1, path: [] }];
  const seen = new Set([key(start)]);
  for (let depth = 1; depth <= cap; depth++) {
    const next = new Map();
    for (const f of frontier) for (const op of ops) {
      if (left(level, f.used, op.tool) <= 0) continue;
      if (op.tool === "kerf" && f.b.kerfs.some(k => k.w === op.wall)) continue;
      if (++nodes > maxNodes) return { capped: true };
      const b = copyOf(f.b), r = apply(b, op);
      if (!r.ok) continue;
      const k = key(b), used = { ...f.used, [op.tool]: f.used[op.tool] + 1 };
      if (next.has(k)) { next.get(k).orders += f.orders; continue; }
      if (seen.has(k)) continue;
      next.set(k, { b, used, orders: f.orders, path: [...f.path, op] });
    }
    for (const k of next.keys()) seen.add(k);
    const win = [...next.values()].filter(f => status(f.b).solved);
    if (win.length) return { best: depth, orders: win.reduce((a, f) => a + f.orders, 0), path: win[0].path };
    frontier = [...next.values()];
    if (!frontier.length) return null;
  }
  return null;
}
