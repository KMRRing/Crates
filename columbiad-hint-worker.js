// The owner's hint, worked out off the page's thread (columbiad-hint.js says what it is for): one of the level's ways, moved to the
// middle of the seconds it may be launched in (a moving world), then to the middle of its window of angles and of powers there, with
// its whole flight to draw. Should the middle of the window not win (a window is measured along a cross, not over its whole box), the
// stored shot is shown as it is.
import { windowOf, timeWindow } from "./columbiad-bots.js";
import { shoot, isMoving } from "./columbiad-engine.js";
import { LEVELS } from "./columbiad-levels.js";
import { waysOf } from "./columbiad-hint.js";

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const STEP = { da: 0.1, dc: 0.05 };                       // coarser than the finder's: a hint has to come in a second or two
const wins = (lvl, mv) => shoot(lvl, mv, [0, 0], { watch: false }).won;

/** Way k of a level: { aim { angle, charge, t }, win (its window there), times { t0, t1 } (a moving world's), rob, pts (the flight) }. */
export function modelOf(lvl, k) {
  const p = waysOf(lvl)[k];
  if (!p) return null;
  const moving = isMoving(lvl);
  let mv = { angle: p.angle, charge: p.charge, t: moving ? p.t || 0 : 0 }, times = null;
  if (moving) {
    const w = timeWindow(lvl, mv, 0.1);
    times = { t0: r1(mv.t - w.lo), t1: r1(mv.t + w.hi) };
    mv = { ...mv, t: r1((times.t0 + times.t1) / 2) };
    if (!wins(lvl, mv)) mv.t = p.t || 0;
  }
  const along = windowOf(lvl, mv, STEP), mid = { ...mv, angle: r2((along.a0 + along.a1) / 2) };
  const across = windowOf(lvl, mid, STEP), best = { ...mid, charge: r2((across.c0 + across.c1) / 2) };
  const [aim, win] = wins(lvl, best) ? [best, { a0: along.a0, a1: along.a1, c0: across.c0, c1: across.c1 }]
    : [{ angle: p.angle, charge: p.charge, t: p.t || 0 }, p.win];
  const res = shoot(lvl, aim, [0, 0], { record: 0.02 }), path = res.path || [], pts = new Float64Array((path.length / 3) * 2);
  for (let i = 0; i < path.length / 3; i++) { pts[2 * i] = path[3 * i + 1]; pts[2 * i + 1] = path[3 * i + 2]; }
  return { k, aim, win, times, rob: p.rob ?? null, pts };
}

if (typeof WorkerGlobalScope !== "undefined" && globalThis instanceof WorkerGlobalScope) {
  onmessage = ({ data: { n, id, k } }) => {
    const m = modelOf(LEVELS.find(l => l.id === id), k);
    postMessage({ n, model: m }, m ? [m.pts.buffer] : []);
  };
}
