// Carrom's physics, the same on every device. A shot is replayed, not sent as a result: the board, the striker's place, an aim
// and a power go in, and the same men come to rest in the same places on every phone, in Node and in the tests. So this file
// does + - * / and sqrt only (Math.sin, cos, pow and atan2 are not bit-identical between V8 and JavaScriptCore; sqrt is exact
// by the IEEE standard), the step is fixed and a function of the state alone (never of the frame time), bodies are visited in
// index order, and every number a shot carries is an integer. Nothing here knows the rules of the game (carrom-rules.js).
//
// The board is a square from -L to L both ways, y up the board. Men are 0 (the queen), 1..9 (white), 10..18 (black); the striker
// is body 19 while a shot runs. A man is on the table (st 0) or down in a pocket (st > 0, the order it went down in).

export const L = 500;                              // half the board
export const R = 22, RS = 28;                      // a man's radius, the striker's
export const PC = 486, PR = 46;                    // the pockets' centres (±PC, ±PC) and how near a body's centre goes down
export const BASE = 380;                           // a baseline's distance from the middle (seat 0's at -BASE, seat 1's at +BASE)
export const XR = 290;                             // how far along a baseline the striker's centre may be put
export const VMAX = 22;                            // the striker's speed at full power, units a step
export const MEN = 19, STRIKER = 19;
export const MAX_STEPS = 2600;                     // a shot that has not settled by then is stopped where it is

const SUB = 3;                                     // movement in thirds of a step, so nothing passes through anything
const DAMP = 0.9915, FRICTION = 0.017, STOP = 0.03;    // the cloth: a little drag, a constant slide, and below STOP a body is still
const WALL = 0.82, BUMP = 0.9;                     // how much of its speed a cushion and another body give back
const M_MAN = 1, M_STRIKER = 2.4;

export const isWhite = i => i >= 1 && i <= 9;
export const isBlack = i => i >= 10 && i <= 18;
/** The men of a seat: seat 0 plays white, seat 1 black. */
export const colourIds = seat => (seat === 0 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [10, 11, 12, 13, 14, 15, 16, 17, 18]);
export const colourOf = i => (i === 0 ? -1 : i <= 9 ? 0 : 1);
export const baseY = seat => (seat === 0 ? -BASE : BASE);

// unit directions of a hexagon's six points, as literals (no trigonometry)
const HX = [1, 0.5, -0.5, -1, -0.5, 0.5], HY = [0, 0.8660254037844386, 0.8660254037844386, 0, -0.8660254037844386, -0.8660254037844386];

/** The men set out for a game: the queen in the middle, six round her, twelve round those, white and black alternating. */
export function layout() {
  const x = new Array(MEN).fill(0), y = new Array(MEN).fill(0), step = 2 * R + 0.6;
  let w = 1, b = 10;
  const put = (px, py, white) => { const i = white ? w++ : b++; x[i] = px; y[i] = py; };
  for (let k = 0; k < 6; k++) put(HX[k] * step, HY[k] * step, k % 2 === 0);                         // the six round the queen
  for (let k = 0; k < 6; k++) {
    put(HX[k] * step * 2, HY[k] * step * 2, k % 2 === 0);                                          // the six in line with them
    const k2 = (k + 1) % 6;                                                                         // and the six between
    put((HX[k] + HX[k2]) * step, (HY[k] + HY[k2]) * step, k % 2 === 1);
  }
  return { x, y };
}

/** Where a returned man goes: the middle if it is free, else the nearest free spot of a fixed ring pattern. */
export function freeSpot(x, y, st, skip = -1) {
  const clear = (px, py) => {
    for (let i = 0; i < MEN; i++) {
      if (i === skip || st[i] > 0) continue;
      const dx = x[i] - px, dy = y[i] - py;
      if (dx * dx + dy * dy < (2 * R + 0.5) * (2 * R + 0.5)) return false;
    }
    return true;
  };
  if (clear(0, 0)) return [0, 0];
  for (let ring = 1; ring <= 8; ring++) {
    const rad = ring * (2 * R + 3);
    for (let k = 0; k < 6; k++) {
      for (let j = 0; j < ring; j++) {      // along the hexagon's side from corner k to corner k+1
        const k2 = (k + 1) % 6, t = j / ring;
        const px = (HX[k] * (1 - t) + HX[k2] * t) * rad, py = (HY[k] * (1 - t) + HY[k2] * t) * rad;
        if (clear(px, py)) return [px, py];
      }
    }
  }
  return [0, 0];
}

/** Why a shot cannot be made from this board, or "" if it can. */
export function shotError(shot, seat, x, y, st) {
  if (!shot || !Number.isInteger(shot.x) || !Number.isInteger(shot.ax) || !Number.isInteger(shot.ay) || !Number.isInteger(shot.p)) return "That is not a shot";
  if (shot.x < -XR || shot.x > XR) return "Keep the striker on the baseline";
  if (shot.p < 1 || shot.p > 1000) return "That is not a power";
  const len = Math.sqrt(shot.ax * shot.ax + shot.ay * shot.ay);
  if (!(len > 0)) return "Aim somewhere";
  const fwd = (seat === 0 ? shot.ay : -shot.ay) / len;
  if (fwd < 0.05) return "Shoot forwards, away from your baseline";
  if (!strikerFree(shot.x, seat, x, y, st)) return "A man is in the way of the striker";
  return "";
}
/** Whether the striker can stand at this place on the baseline without touching a man. */
export function strikerFree(sx, seat, x, y, st) {
  const sy = baseY(seat);
  for (let i = 0; i < MEN; i++) {
    if (st[i] > 0) continue;
    const dx = x[i] - sx, dy = y[i] - sy, rr = R + RS;
    if (dx * dx + dy * dy < rr * rr) return false;
  }
  return true;
}
/** The places along a baseline the striker may stand, every `gap` units (the bots' and the nudge buttons' choices). */
export function freeXs(seat, x, y, st, gap = 10) {
  const out = [];
  for (let sx = -XR; sx <= XR; sx += gap) if (strikerFree(sx, seat, x, y, st)) out.push(sx);
  return out;
}

/**
 * A shot being played. Make one with startSim; call step() until done. Positions are in sim.x / sim.y (men 0..18 and the
 * striker, 19), `down` says which have gone down a pocket, and `events` lists each fall as { id, step, pocket }.
 */
export function startSim(px, py, st, shot, seat) {
  const n = MEN + 1;
  const sim = {
    x: new Float64Array(n), y: new Float64Array(n), vx: new Float64Array(n), vy: new Float64Array(n),
    r: new Float64Array(n), im: new Float64Array(n), on: new Uint8Array(n), down: new Uint8Array(n),
    steps: 0, done: false, events: [], strikerDown: false, touched: -1, seat, moving: 0,
  };
  for (let i = 0; i < MEN; i++) {
    sim.r[i] = R; sim.im[i] = 1 / M_MAN;
    if (st[i] > 0) { sim.down[i] = 1; continue; }
    sim.on[i] = 1; sim.x[i] = px[i]; sim.y[i] = py[i];
  }
  const len = Math.sqrt(shot.ax * shot.ax + shot.ay * shot.ay), speed = (VMAX * shot.p) / 1000;
  sim.on[STRIKER] = 1; sim.r[STRIKER] = RS; sim.im[STRIKER] = 1 / M_STRIKER;
  sim.x[STRIKER] = shot.x; sim.y[STRIKER] = baseY(seat);
  sim.vx[STRIKER] = (shot.ax / len) * speed; sim.vy[STRIKER] = (shot.ay / len) * speed;
  sim.moving = 1;
  return sim;
}

/** One fixed step of the shot. Returns false once everything has come to rest (or the step limit is reached). */
export function stepSim(s) {
  if (s.done) return false;
  const n = MEN + 1, x = s.x, y = s.y, vx = s.vx, vy = s.vy, r = s.r, im = s.im, on = s.on;
  for (let sub = 0; sub < SUB; sub++) {
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      x[i] += vx[i] / SUB; y[i] += vy[i] / SUB;
      const lim = L - r[i];
      if (x[i] > lim) { x[i] = lim; if (vx[i] > 0) vx[i] = -vx[i] * WALL; }
      else if (x[i] < -lim) { x[i] = -lim; if (vx[i] < 0) vx[i] = -vx[i] * WALL; }
      if (y[i] > lim) { y[i] = lim; if (vy[i] > 0) vy[i] = -vy[i] * WALL; }
      else if (y[i] < -lim) { y[i] = -lim; if (vy[i] < 0) vy[i] = -vy[i] * WALL; }
    }
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!on[j]) continue;
        const dx = x[j] - x[i], dy = y[j] - y[i], rr = r[i] + r[j], d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        // nothing moving can touch something at rest unless one of them moves
        const d = Math.sqrt(d2), nx = d > 0 ? dx / d : 1, ny = d > 0 ? dy / d : 0, sum = im[i] + im[j];
        const push = rr - d;
        x[i] -= (nx * push * im[i]) / sum; y[i] -= (ny * push * im[i]) / sum;
        x[j] += (nx * push * im[j]) / sum; y[j] += (ny * push * im[j]) / sum;
        const vn = (vx[j] - vx[i]) * nx + (vy[j] - vy[i]) * ny;
        if (vn < 0) {
          const jn = (-(1 + BUMP) * vn) / sum;
          vx[i] -= jn * im[i] * nx; vy[i] -= jn * im[i] * ny;
          vx[j] += jn * im[j] * nx; vy[j] += jn * im[j] * ny;
          if (s.touched < 0 && (i === STRIKER || j === STRIKER)) s.touched = i === STRIKER ? j : i;
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      for (let c = 0; c < 4; c++) {
        const dx = x[i] - (c & 1 ? PC : -PC), dy = y[i] - (c & 2 ? PC : -PC);
        if (dx * dx + dy * dy < PR * PR) {
          on[i] = 0; s.down[i] = 1; vx[i] = vy[i] = 0;
          s.events.push({ id: i, step: s.steps, pocket: c });
          if (i === STRIKER) s.strikerDown = true;
          break;
        }
      }
    }
  }
  let moving = 0;
  for (let i = 0; i < n; i++) {
    if (!on[i]) continue;
    const sp2 = vx[i] * vx[i] + vy[i] * vy[i];
    if (sp2 === 0) continue;
    const sp = Math.sqrt(sp2), next = sp * DAMP - FRICTION;
    if (next < STOP) { vx[i] = 0; vy[i] = 0; } else { const k = next / sp; vx[i] *= k; vy[i] *= k; moving = 1; }
  }
  s.steps++;
  s.moving = moving;
  if (!moving || s.steps >= MAX_STEPS) {
    for (let i = 0; i < n; i++) { vx[i] = 0; vy[i] = 0; }
    s.moving = 0;
    s.done = true;
    return false;
  }
  return true;
}

/** A whole shot at once: where the men came to rest, and which went down in what order. */
export function simulate(px, py, st, shot, seat) {
  const s = startSim(px, py, st, shot, seat);
  while (stepSim(s));
  return s;
}

/** The first thing a straight line from the striker meets: { t (distance the striker's centre travels), id (a man, or -1 for a cushion), x, y }. */
export function firstContact(px, py, st, sx, sy, ux, uy) {
  let best = Infinity, who = -1;
  for (let i = 0; i < MEN; i++) {
    if (st[i] > 0) continue;
    const mx = px[i] - sx, my = py[i] - sy, along = mx * ux + my * uy;
    if (along <= 0) continue;
    const perp2 = mx * mx + my * my - along * along, rr = R + RS;
    if (perp2 >= rr * rr) continue;
    const t = along - Math.sqrt(rr * rr - perp2);
    if (t < best) { best = t; who = i; }
  }
  const lim = L - RS;
  let wall = Infinity;
  if (ux > 0) wall = Math.min(wall, (lim - sx) / ux); else if (ux < 0) wall = Math.min(wall, (-lim - sx) / ux);
  if (uy > 0) wall = Math.min(wall, (lim - sy) / uy); else if (uy < 0) wall = Math.min(wall, (-lim - sy) / uy);
  if (who >= 0 && best <= wall) return { t: best, id: who, x: sx + ux * best, y: sy + uy * best };
  return { t: wall, id: -1, x: sx + ux * wall, y: sy + uy * wall };
}
