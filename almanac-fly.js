// The star chart's scenic camera move, as pure arithmetic: no screen, no WebGL, no page (so it is tested in Node, and any other star
// field can fly the same way). From one star to a linked one the camera makes three moves, with a pause for the eye between the first
// two:
//   1. TURN    it swings round until the link runs across the view, both stars in what the popups leave of the screen;
//   2. TRAVEL  it follows the link, the look-at point sliding from the middle to the target while the camera swings a little way
//              round to look along the way it goes (a long link stays wide until the end, so the path reads), and a light runs
//              down the line;
//   3. SETTLE  it comes to rest with the target in the middle of the free part of the screen, near enough to read its neighbours,
//              the earlier star still in view if it is close, the horizon level, with a small elastic give at the end.
// A flight with no link (a search, a tap, a constellation) is the second and third moves alone, from wherever the camera was.
//
// A camera here is { yaw, pitch, dist, at } as in almanac-sky-camera.js, which has no roll: a level horizon is not something to
// keep but something that cannot be lost. `planFly` works the whole move out once; `poseAt(plan, ms, out)` reads the camera at a
// moment into `out` and makes nothing, so a frame is cheap, a touch can stop the move where it stands (the pose is always a good
// camera) and a second flight can start from that pose.
import { FOV, MIN_DIST, MAX_DIST, NEAR, viewMatrixInto, viewProjectionInto, projectInto, cleanCamera } from "./almanac-sky-camera.js";

/** How near the camera comes to a star it flies to, unless it was nearer. */
export const SETTLE_DIST = 22;
/** Never nearer than this when flying to a star: the neighbours should be in sight. */
export const FLOOR_DIST = 14;
/** The camera may be held in the earlier star's frame by standing back this far, no further (else the earlier star is left out of the picture). */
export const KEEP_BEHIND = 44;
/** The pitches a flight rests at: not looking straight down or up, where the first drag after arriving would jump about. */
export const REST_PITCH = [-0.7, 1.1];
/** The whole move takes no longer than this (ms). */
export const MAX_MS = 3000;
/** With the person asking for less motion the move is a cut, and the aspect is named for this long (ms). */
export const NAMED_MS = 1500;

const TAU = 2 * Math.PI, HALF = Math.tan(FOV / 2);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;              // an angle as the short way round, in (-π, π]

/** Smoother than smoothstep: still at both ends, no jolt where it starts or stops. */
export const smooth = t => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
/** Gets there and runs a little past, then settles back (c = 0.9: three per cent past): the elastic give of the last move. */
export const spring = (t, c = 0.9) => { t = clamp(t, 0, 1) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };

const copy = p => ({ yaw: p.yaw, pitch: p.pitch, dist: p.dist, at: [p.at[0], p.at[1], p.at[2]] });
const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// ---------- what the screen leaves free ----------
/** The room kept round what is framed, in pixels, from the free part of the screen: room for a star's name beside it. */
export function marginOf(free) {
  return { x: Math.min(clamp(free.w * 0.12, 28, 90), free.w * 0.3), y: Math.min(clamp(free.h * 0.12, 26, 80), free.h * 0.3) };
}
const VP = new Float32Array(16), SCRATCH = [new Float32Array(16), new Float32Array(16)], MAT = new Float32Array(16), XY = [0, 0, 0];

/** The camera shifted (along its own right and up) so that sky point p lies at pixel (x, y) of the screen. */
function aimedAt(cam, p, x, y, view) {
  viewMatrixInto(MAT, cam);
  const k = 2 * HALF * cam.dist / view.h, dx = x - view.w / 2, dy = y - view.h / 2;
  for (let i = 0; i < 3; i++) cam.at[i] = p[i] - MAT[i * 4] * dx * k + MAT[i * 4 + 1] * dy * k;
  return cam;
}
/** A camera looking from `dist` away at `p`, which lies in the middle of the free part of the screen. */
export function aim(p, yaw, pitch, dist, view) {
  const f = view.free;
  return aimedAt({ yaw, pitch, dist, at: [0, 0, 0] }, p, f.x + f.w / 2, f.y + f.h / 2, view);
}

/** Both points on screen at once: where they land for a camera, and whether both are in front of it. */
function land(cam, pts, view, out) {
  viewProjectionInto(VP, SCRATCH, cam, view.w / view.h);
  let ok = true, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (projectInto(XY, VP, p[0], p[1], p[2], view.w, view.h) <= NEAR) { ok = false; continue; }
    x0 = Math.min(x0, XY[0]); x1 = Math.max(x1, XY[0]); y0 = Math.min(y0, XY[1]); y1 = Math.max(y1, XY[1]);
  }
  out[0] = x0; out[1] = y0; out[2] = x1; out[3] = y1;
  return ok;
}
const BOX = [0, 0, 0, 0];
const search = (lo, hi, fits) => {                       // the smallest distance in [lo, hi] for which fits() holds, found in log steps
  if (fits(lo)) return lo;
  if (!fits(hi)) return hi;
  let a = Math.log(lo), b = Math.log(hi);
  for (let i = 0; i < 26; i++) { const m = (a + b) / 2; if (fits(Math.exp(m))) b = m; else a = m; }
  return Math.exp(b);
};

/**
 * The camera, turned `yaw`/`pitch`, that holds points a and b both inside the free part of the screen (less its margin), as near
 * as it may stand but not nearer than `floor`: their middle is moved to the middle of the free part. Returns the camera and
 * whether they fit (they do not if it would have to stand beyond the furthest the camera goes).
 */
export function frameTwo(a, b, yaw, pitch, view, floor = FLOOR_DIST) {
  const f = view.free, m = marginOf(f), cx = f.x + f.w / 2, cy = f.y + f.h / 2, pts = [a, b];
  const cam = { yaw, pitch, dist: floor, at: [0, 0, 0] };
  const stand = dist => {                               // the camera at this distance with the pair centred: how big they land
    cam.dist = dist; for (let i = 0; i < 3; i++) cam.at[i] = (a[i] + b[i]) / 2;
    for (let pass = 0; pass < 4; pass++) {
      if (!land(cam, pts, view, BOX)) return false;
      viewMatrixInto(MAT, cam);
      const k = 2 * HALF * dist / view.h, dx = (BOX[0] + BOX[2]) / 2 - cx, dy = (BOX[1] + BOX[3]) / 2 - cy;
      for (let i = 0; i < 3; i++) cam.at[i] += MAT[i * 4] * dx * k - MAT[i * 4 + 1] * dy * k;
    }
    return land(cam, pts, view, BOX) && BOX[2] - BOX[0] <= f.w - 2 * m.x && BOX[3] - BOX[1] <= f.h - 2 * m.y;
  };
  const dist = search(Math.max(MIN_DIST, floor), MAX_DIST, stand);
  const fits = stand(dist);
  return { cam: copy(cam), fits };
}
/** The least distance at which, with b in the middle of the free part, a is still inside it (less the margin); `limit` if it is never. */
function holdsBehind(b, a, yaw, pitch, floor, limit, view) {
  const f = view.free, m = marginOf(f), cam = { yaw, pitch, dist: floor, at: [0, 0, 0] };
  const inside = dist => {
    cam.dist = dist; aimedAt(cam, b, f.x + f.w / 2, f.y + f.h / 2, view);
    if (!land(cam, [a], view, BOX)) return false;
    return BOX[0] >= f.x + m.x && BOX[2] <= f.x + f.w - m.x && BOX[1] >= f.y + m.y && BOX[3] <= f.y + f.h - m.y;
  };
  const d = search(floor, limit, inside);
  return inside(d) ? d : Infinity;
}

// ---------- the plan ----------
/**
 * The whole move, worked out once.
 *   from     the camera now (a flight begun mid-flight starts from the pose it is in)
 *   a        the star the camera comes from, as a point [x, y, z], or null: a flight with no link
 *   b        where it goes
 *   view     { w, h, free: { x, y, w, h } }: the screen's pixels, and the part of it no popup or control covers
 *   near     how near to b it ends, at the most (the camera does not come nearer than FLOOR_DIST, nor further than it was)
 *   reduced  the person asked for less motion: the plan is a cut to the last pose
 * Returns { rest, frame, end, from, a, b, linked, ms: { turn, hold, travel, settle }, total, named, bump, lead }.
 */
export function planFly({ from, a = null, b, view, near = SETTLE_DIST, reduced = false }) {
  const start = cleanCamera(from, from), linked = !!a && gap(a, b) > 0.5;
  const restDist = clamp(Math.min(start.dist, near), Math.min(FLOOR_DIST, near), MAX_DIST);
  let frame = null, carry = 0, swing = 0, restYaw = start.yaw, restPitch = clamp(start.pitch, REST_PITCH[0], REST_PITCH[1]), dist = restDist, turned = 0, linkLength = 0;
  if (linked) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(u[0], u[1], u[2]), flat = Math.hypot(u[0], u[2]) / L;
    linkLength = L;
    // the link runs across the view when the camera's right is the link's own flat direction: B to the right of A, or if that is
    // the long way round, the other way; a link straight up or down has no side to turn to
    const side = flat < 0.05 ? start.yaw : (() => {
      const yb = Math.atan2(-u[2], u[0]), turnTo = wrap(yb - start.yaw), turnAway = wrap(yb + Math.PI - start.yaw);
      return Math.abs(turnTo) <= Math.abs(turnAway) + 0.45 ? start.yaw + turnTo : start.yaw + turnAway;
    })();
    // a short hop is not worth a big swing: the turn is the less of itself the nearer the stars are, compared with how far off the camera stands
    turned = smooth((L / start.dist - 0.08) / 0.37);
    const yaw = start.yaw + wrap(side - start.yaw) * turned;
    const level = clamp(lerp(clamp(start.pitch, 0.1, 1), 0.3, Math.min(1, Math.abs(u[1] / L))), REST_PITCH[0], REST_PITCH[1]);
    const pitch = lerp(clamp(start.pitch, REST_PITCH[0], REST_PITCH[1]), level, turned);
    const fr = frameTwo(a, b, yaw, pitch, view, Math.max(restDist, 18));
    frame = fr.cam;
    // along the link the camera swings round a little towards looking down it (the way it goes is the yaw of -φ - 90°)
    const lookDown = Math.atan2(-u[0], -u[2]);
    swing = flat < 0.05 ? 0 : 0.45 * Math.min(1, L / 40) * (Math.sign(wrap(lookDown - frame.yaw)) || 1);
    restYaw = frame.yaw + swing;
    restPitch = clamp(frame.pitch, REST_PITCH[0], REST_PITCH[1]);
    // the star it came from stays in view if it is near enough that standing back to hold it is no great way
    const behind = holdsBehind(b, a, restYaw, restPitch, restDist, KEEP_BEHIND, view);
    if (Number.isFinite(behind)) dist = Math.max(restDist, behind);
  }
  const rest = aim(b, restYaw, restPitch, dist, view);
  const end = aim(b, restYaw - (swing || 0.4) * 0.1, restPitch, dist * 1.12, view);       // it arrives a little short and wide, and the settle takes up the rest
  const D = gap(start.at, rest.at) + 40 * Math.abs(Math.log(dist / start.dist));
  const ms = { turn: 0, hold: 0, travel: 0, settle: 380 };
  if (linked) {
    // the turn is the work of getting both stars framed: of how much the camera has to swing, back off or slide to do it
    const angle = Math.abs(wrap(frame.yaw - start.yaw)), zoom = Math.min(1, Math.abs(Math.log(frame.dist / start.dist)) / 1.5), slide = Math.min(1, gap(frame.at, start.at) / Math.max(start.dist, 10));
    carry = gap(frame.at, start.at);                                          // and how far the look-at point has to be carried: the further, the longer, so it never rushes
    ms.turn = angle < 0.05 && zoom < 0.05 && slide < 0.1 ? 0 : 260 + 340 * (angle / Math.PI) + 140 * zoom + 600 * (carry / (carry + 100));
    ms.hold = ms.turn ? 180 : 0;
    if (!ms.turn) frame = copy(start);                                      // nothing to frame: the travel begins where the camera is
    ms.travel = 420 + 1400 * (linkLength / (linkLength + 90));
  } else ms.travel = clamp(500 + 1000 * (D / (D + 120)), 500, 1500);
  let total = ms.turn + ms.hold + ms.travel + ms.settle;
  if (total > MAX_MS) { const s = MAX_MS / total; for (const k in ms) ms[k] *= s; total = MAX_MS; }
  const plan = { from: start, frame, end, rest, a: linked ? [a[0], a[1], a[2]] : null, b: [b[0], b[1], b[2]], linked, ms, total, named: 0,
    bump: linked ? 0 : 0.3 * Math.min(1, D / 140), lead: linked ? 0.9 * carry / (carry + 3 * Math.max(start.dist, frame.dist)) : 0 };
  if (reduced) { plan.total = 0; plan.ms = { turn: 0, hold: 0, travel: 0, settle: 0 }; plan.named = linked ? NAMED_MS : 0; }
  return plan;
}
/** A plain glide from one camera to another, `ms` long (the sky's home view): a plan like the others, with no link. */
export function planPose(from, to, ms = 800, reduced = false) {
  const start = cleanCamera(from, from), good = cleanCamera(to, to);
  const rest = { ...good, yaw: start.yaw + wrap(to.yaw - start.yaw) };       // the short way round
  return { from: start, frame: null, end: rest, rest, a: null, b: [rest.at[0], rest.at[1], rest.at[2]], linked: false,
    ms: { turn: 0, hold: 0, travel: reduced ? 0 : ms, settle: 0 }, total: reduced ? 0 : ms, named: 0, bump: 0, plain: true };
}

// ---------- the camera at a moment ----------
/** A pose to read into: poseAt fills it (yaw, pitch, dist, at, and which act, how far into it, and the light and the line's fade). */
export const newPose = () => ({ yaw: 0, pitch: 0, dist: 0, at: [0, 0, 0], act: 0, k: 0, line: 0, tag: 0, pulse: -1 });
const between = (out, p, q, k, kd = k, ka = k) => {
  out.yaw = lerp(p.yaw, q.yaw, k); out.pitch = lerp(p.pitch, q.pitch, k);
  out.dist = p.dist * Math.pow(q.dist / p.dist, kd);                         // a distance moves as a ratio, so going in and going out feel alike
  for (let i = 0; i < 3; i++) out.at[i] = lerp(p.at[i], q.at[i], ka);
};
/**
 * The camera `t` ms into the plan, written into `out` (and returned). `out.act`: 0 turning, 1 holding, 2 travelling, 3 settling,
 * 4 done; `out.k` how far through that act (0 to 1); `out.line` how strongly the link is drawn; `out.tag` how strongly its name
 * is shown; `out.pulse` where the light is along the link (0 at the star it came from, 1 at the target), -1 before it starts.
 */
export function poseAt(plan, t, out) {
  const { ms } = plan;
  t = clamp(t, 0, plan.total);
  const linked = plan.linked;
  let k;
  if (t < ms.turn) {                                                          // 1. turn
    k = t / ms.turn; between(out, plan.from, plan.frame, smooth(k));
    if (plan.lead) out.dist *= 1 + plan.lead * Math.sin(Math.PI * smooth(k));  // carried a long way, the camera stands back on the way, so it does not rush
    out.act = 0; out.line = linked ? smooth(k) : 0; out.pulse = -1;
  } else if (t < ms.turn + ms.hold) {                                         // the eye reads the aspect
    k = (t - ms.turn) / ms.hold; between(out, plan.frame, plan.frame, 0);
    out.act = 1; out.line = 1; out.pulse = -1;
  } else if (t < ms.turn + ms.hold + ms.travel) {                             // 2. travel
    k = (t - ms.turn - ms.hold) / ms.travel;
    const e = smooth(k), p = plan.frame || plan.from;
    between(out, p, plan.end, e, Math.pow(e, 1.7), e);
    if (plan.bump) out.dist *= 1 + plan.bump * Math.sin(Math.PI * e);         // a long glide stands back in the middle, then eases in
    out.act = 2; out.line = linked ? 1 : 0; out.pulse = linked ? e : -1;
  } else if (t < plan.total) {                                                // 3. settle
    k = (t - ms.turn - ms.hold - ms.travel) / ms.settle;
    between(out, plan.end, plan.rest, spring(k), spring(k), smooth(k));
    out.act = 3; out.line = linked ? 1 - smooth(k) : 0; out.pulse = linked ? 1 : -1;
  } else {                                                                    // done
    k = 1; between(out, plan.rest, plan.rest, 0);
    out.act = 4; out.line = 0; out.pulse = -1;
  }
  out.k = k;
  // the name comes up as the turn nears its end (before that the stars are not yet in view to name a line between), and goes as it settles
  const arrive = !ms.turn ? Math.min(1, t / 160) : t < ms.turn ? smooth((t / ms.turn - 0.45) / 0.5) : 1;
  out.tag = linked ? arrive * (out.act === 3 ? 1 - smooth(k) : out.act === 4 ? 0 : 1) : 0;
  out.pitch = clamp(out.pitch, -1.4, 1.4);
  out.dist = clamp(out.dist, MIN_DIST, MAX_DIST);
  return out;
}

// ---------- the name on the link ----------
/**
 * Where the link's name (a tag `tw` by `th` pixels) goes: beside the middle of the line from (ax, ay) to (bx, by) on its upper
 * side, clear of it, and kept inside the free part of the screen. Written into `out` as x, y (the tag's centre).
 */
export function tagSpot(out, ax, ay, bx, by, free, tw, th, clearance = 12) {
  const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }                 // above the line, where it is read most easily
  const reach = Math.abs(nx) * tw / 2 + Math.abs(ny) * th / 2 + clearance;
  const x = (ax + bx) / 2 + nx * reach, y = (ay + by) / 2 + ny * reach, pad = 6;
  out.x = free.w < tw + 2 * pad ? free.x + free.w / 2 : clamp(x, free.x + tw / 2 + pad, free.x + free.w - tw / 2 - pad);
  out.y = free.h < th + 2 * pad ? free.y + free.h / 2 : clamp(y, free.y + th / 2 + pad, free.y + free.h - th / 2 - pad);
  return out;
}
