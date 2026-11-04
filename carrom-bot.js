// Carrom's computer player. It does not reason about angles to the end: it picks shots that could work (a man, a pocket, the
// striker aimed at the spot behind the man that sends it towards the pocket) and plays each of them out in the engine, the
// very simulation the game uses, then takes the best by what the shot would pocket. The level is how many it tries and how
// precisely it aims: Easy tries four with a wide scatter and plays one of them at random, Medium the best of twenty-four with a
// small scatter, Hard the best of a hundred and ten, refined by a second, tighter round round its three best. However it
// chose, the hand slips a little (`slip`, `weak`): that, not the search, is what separates the levels for a person.
import { simulate, shotError, freeXs, colourIds, baseY, R, RS, PC, MEN, XR } from "./carrom-engine.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
const PLAN = {
  easy: { n: 4, scatter: 0.07, best: false, refine: 0, slip: 0.05, weak: 0.1 },
  medium: { n: 24, scatter: 0.03, best: true, refine: 0, slip: 0.016, weak: 0.05 },
  hard: { n: 110, scatter: 0.012, best: true, refine: 24, slip: 0.007, weak: 0.02 },
};
const CORNERS = [[-PC, -PC], [PC, -PC], [-PC, PC], [PC, PC]];

/** How a shot would go for `seat`: pocketing your men is good, theirs bad, the striker down worse; ties by how near the pockets your men are left. */
function score(sim, s, seat) {
  const mine = new Set(colourIds(seat));
  let own = 0, opp = 0, queen = false;
  for (const e of sim.events) {
    if (e.id === 19) continue;
    if (e.id === 0) queen = true; else if (mine.has(e.id)) own++; else opp++;
  }
  let sc = own * 10 - opp * 7;
  if (queen) sc += own ? 14 : s.queen === 1 ? 0 : 4;
  if (s.queen === 1 && s.qs === seat && !own) sc -= 6;            // the queen waits for its cover
  if (sim.strikerDown) sc = sc - 22 - own * 10;
  else if (own) sc += 3;                                           // the turn goes on
  // the last man cannot go down before the queen is settled
  const left = colourIds(seat).filter(i => s.st[i] === 0).length;
  if (own >= left && s.queen !== 2 && !queen) sc -= 9;
  // where they are left: your men nearer a pocket, theirs further
  let pos = 0;
  for (let i = 0; i < MEN; i++) {
    if (!sim.on[i] || i === 0) continue;
    let d = 1e9;
    for (const [cx, cy] of CORNERS) { const dx = sim.x[i] - cx, dy = sim.y[i] - cy, d2 = dx * dx + dy * dy; if (d2 < d) d = d2; }
    const w = 1 - Math.sqrt(d) / 800;
    pos += mine.has(i) ? w : -w;
  }
  return sc + pos * 0.5;
}

/** A shot from striker place `sx` along aim (dx, dy) at `power`, as the integers a shot carries. */
function shotOf(sx, dx, dy, p) {
  const len = Math.sqrt(dx * dx + dy * dy);
  return { x: sx, ax: Math.round((dx / len) * 1000), ay: Math.round((dy / len) * 1000), p: Math.max(1, Math.min(1000, Math.round(p))) };
}

/** A shot that sends man `t` towards pocket `c` from place `sx`, scattered by `scatter` (a fraction of the aim's length). */
function aimed(s, seat, t, c, sx, scatter, rng) {
  const by = baseY(seat), tx = s.px[t], ty = s.py[t];
  const ux = CORNERS[c][0] - tx, uy = CORNERS[c][1] - ty, ul = Math.sqrt(ux * ux + uy * uy) || 1;
  const gx = tx - (ux / ul) * (R + RS), gy = ty - (uy / ul) * (R + RS);            // where the striker's centre is when it strikes
  let dx = gx - sx, dy = gy - by;
  const len = Math.sqrt(dx * dx + dy * dy) || 1, off = (rng() * 2 - 1) * scatter * len;
  const nx = -dy / len, ny = dx / len;
  dx += nx * off; dy += ny * off;
  const reach = len + ul;
  const power = (60 + reach * 0.45) * (0.8 + rng() * 0.6);
  return shotOf(sx, dx, dy, power);
}

const forward = (shot, seat) => (seat === 0 ? shot.ay > 60 : shot.ay < -60);

/** The shot as the hand makes it: the aim and the power a little off, by what the level can manage. */
function slipped(shot, plan, rng) {
  const len = Math.sqrt(shot.ax * shot.ax + shot.ay * shot.ay), off = (rng() * 2 - 1) * plan.slip * len;
  const dx = shot.ax - (shot.ay / len) * off, dy = shot.ay + (shot.ax / len) * off;
  const out = shotOf(shot.x, dx, dy, shot.p * (1 + (rng() * 2 - 1) * plan.weak));
  return Math.abs(out.ay) > 60 && Math.sign(out.ay) === Math.sign(shot.ay) ? out : shot;     // never aimed so far off that it is no longer forwards
}

/** The computer's shot for `seat`. */
export function chooseShot(s, seat, level, rng) {
  const plan = PLAN[level] || PLAN.medium;
  const xs = freeXs(seat, s.px, s.py, s.st, 20);
  if (!xs.length) return { pass: 1 };
  const mine = colourIds(seat).filter(i => s.st[i] === 0);
  const covering = s.queen === 1 && s.qs === seat;
  const targets = covering ? mine.slice() : (s.queen === 0 ? [0, ...mine] : mine.slice());
  if (!targets.length) targets.push(...mine);
  const pick = list => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  const tried = [];
  const play = shot => {
    if (!forward(shot, seat) || shotError(shot, seat, s.px, s.py, s.st)) return;
    const sim = simulate(s.px, s.py, s.st, shot, seat);
    tried.push({ shot, sc: score(sim, s, seat) });
  };
  for (let k = 0; k < plan.n; k++) {
    const wild = k % 6 === 5;                                       // now and then a shot at nothing in particular
    const sx = pick(xs);
    if (wild || !targets.length) {
      const dx = (rng() * 2 - 1) * 0.8, dy = seat === 0 ? 1 : -1;
      play(shotOf(sx, dx, dy, 300 + rng() * 700));
    } else {
      const t = pick(targets);
      // the two pockets the man is nearest to, and now and then the others
      const order = CORNERS.map((_, c) => c).sort((a, b) => {
        const da = (CORNERS[a][0] - s.px[t]) ** 2 + (CORNERS[a][1] - s.py[t]) ** 2, db = (CORNERS[b][0] - s.px[t]) ** 2 + (CORNERS[b][1] - s.py[t]) ** 2;
        return da - db;
      });
      play(aimed(s, seat, t, rng() < 0.8 ? order[Math.floor(rng() * 2)] : order[2 + Math.floor(rng() * 2)], sx, plan.scatter, rng));
    }
  }
  if (!tried.length) {                                              // nothing could be tried: a gentle shot straight ahead
    return shotOf(pick(xs), 0, seat === 0 ? 1 : -1, 400);
  }
  if (!plan.best) return slipped(pick(tried).shot, plan, rng);
  tried.sort((a, b) => b.sc - a.sc);
  if (plan.refine) {
    for (const base of tried.slice(0, 3)) {
      for (let k = 0; k < plan.refine / 3; k++) {
        const b = base.shot, sx = Math.max(-XR, Math.min(XR, b.x + Math.round((rng() * 2 - 1) * 20)));
        const dx = b.ax + (rng() * 2 - 1) * 14, dy = b.ay;
        play(shotOf(sx, dx, dy, b.p * (0.94 + rng() * 0.12)));
      }
    }
    tried.sort((a, b) => b.sc - a.sc);
  }
  // among shots as good as the best, any: so the same position isn't always played the same
  const top = tried.filter(t => t.sc >= tried[0].sc - 0.05);
  return slipped(pick(top).shot, plan, rng);
}

