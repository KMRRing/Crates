// Bots for SHUNT-PACK: random, greedy (two flavours) and an exact memoised search.
import { start, place, legalMoves, judge, rng, WEIGHT, analyse, occupancy, reachable } from "./engine.js";

const finish = s => { const an = judge(s); return { won: an.won, score: an.score, placed: s.placed.length, an }; };
/** Value of a finished board: a win counts for everything, otherwise nothing is worth keeping (a lost board scores its gears, ranked far below any win). */
export const value = r => (r.won ? 1000 + r.score : r.score);

export function randomBot(level, seed) {
  const R = rng(seed); let s = start(level);
  for (;;) { const m = legalMoves(s); if (!m.length) break; s = place(s, m[Math.floor(R() * m.length)]).state; }
  return { ...finish(s), s };
}

/** Greedy by immediate score: the move adding the most driven weight, ties to the spot deepest from the door, then the biggest piece. */
export function greedyBot(level, seed = 1) {
  const R = rng(seed); let s = start(level); const P = s.P;
  const [dx, dy] = P.door, depth = pc => -(dx * (pc.x + pc.sh.w / 2) + dy * (pc.y + pc.sh.h / 2)) * 100 + (pc.sh.cells.length) + R() * 0.01;
  for (;;) {
    let best = null, bestV = -1e9, base = judge(s).score;
    for (const pc of P.places) {
      const r = place(s, pc.id); if (!r.ok) continue;
      const v = (r.an.score - base) * 10000 + depth(pc);
      if (v > bestV) { bestV = v; best = r.state; }
    }
    if (!best) break; s = best;
  }
  return { ...finish(s), s };
}

/** Greedy that also looks at the goal: counts an output driven the right way as worth a lot. Still one move deep. */
export function greedyGoalBot(level, seed = 1) {
  const R = rng(seed); let s = start(level); const P = s.P;
  const [dx, dy] = P.door, depth = pc => -(dx * (pc.x + pc.sh.w / 2) + dy * (pc.y + pc.sh.h / 2)) * 100 + R() * 0.01;
  const val = an => an.score + 50 * an.outs.filter(o => o.ok).length;
  for (;;) {
    let best = null, bestV = -1e9, base = val(judge(s));
    for (const pc of P.places) {
      const r = place(s, pc.id); if (!r.ok) continue;
      const v = (val(r.an) - base) * 10000 + depth(pc);
      if (v > bestV) { bestV = v; best = r.state; }
    }
    if (!best) break; s = best;
  }
  return { ...finish(s), s };
}

/** Can the pieces be put in one at a time through the door? Peel from the end: a piece that can leave while all others
 *  stand can be the last one placed; removing pieces only opens the way (monotone), so greedy peeling is exact. */
export function peelable(P, ids) {
  let rest = ids.slice();
  while (rest.length) {
    const occ = occupancy(P, rest); let found = -1;
    for (let k = 0; k < rest.length && found < 0; k++) {
      const pc = P.places[rest[k]]; for (const c of pc.sh.cells) occ[(pc.y + c.dy) * P.w + pc.x + c.dx] = -1;
      if (reachable(P, pc.sh, pc.x, pc.y, occ)) found = k;
      rest.forEach((id, i) => { if (i === k) { const q = P.places[id]; for (const c of q.sh.cells) occ[(q.y + c.dy) * P.w + q.x + c.dx] = i; } });
    }
    if (found < 0) return false; rest.splice(found, 1);
  }
  return true;
}
/** Order the pieces can be placed in (reverse of the peel). */
export function order(P, ids) {
  let rest = ids.slice(); const out = [];
  while (rest.length) {
    const occ = occupancy(P, rest); let found = -1;
    for (let k = 0; k < rest.length && found < 0; k++) {
      const pc = P.places[rest[k]]; for (const c of pc.sh.cells) occ[(pc.y + c.dy) * P.w + pc.x + c.dx] = -1;
      if (reachable(P, pc.sh, pc.x, pc.y, occ)) found = k;
      rest.forEach((id, i) => { if (i === k) { const q = P.places[id]; for (const c of q.sh.cells) occ[(q.y + c.dy) * P.w + q.x + c.dx] = i; } });
    }
    out.push(rest[found]); rest.splice(found, 1);
  }
  return out.reverse();
}

/** Exact: branch and bound over every final set of placements (canonical order of place ids), pruned by the peel test and a
 *  score bound (remaining supply, and free cells); seeded with the greedy value. `cap` bounds the nodes. */
export function solve(level, cap = 400000) {
  const s0 = start(level), P = s0.P; let nodes = 0, capped = false, optimal = 0;
  const seed = Math.max(value(greedyBot(level)), value(greedyGoalBot(level)));
  let best = { v: seed - 1, ids: [], r: null }; // strictly below the seed so that a tie with greedy is still recorded
  const cellsFree = P.w * P.h - P.wall.reduce((a, b) => a + b, 0) - P.post.reduce((a, b) => a + b, 0) - P.fixedCells.reduce((a, b) => a + (b >= 0 ? 1 : 0), 0);
  const left = P.kinds.map(k => k.count), wOf = pc => WEIGHT[P.kinds[pc.kind].p.k];
  const remW = () => P.kinds.reduce((a, k, i) => a + left[i] * WEIGHT[k.p.k], 0);
  const dfs = (ids, from, usedCells, placedW) => {
    if (++nodes > cap) { capped = true; return; }
    const an = analyse(P, ids), r = { won: an.won, score: an.score }, v = value(r);
    if (v > best.v) { best = { v, ids: ids.slice(), r }; optimal = 1; } else if (v === best.v && ids.length) optimal++;
    for (let j = from; j < P.places.length; j++) {
      const pc = P.places[j]; if (left[pc.kind] <= 0) continue;
      const nc = usedCells + pc.sh.cells.length, nw = placedW + wOf(pc);
      // bound: nothing beyond this can score more than what is placed plus what can still fit and is left to place
      const ub = Math.min(nw + remW() - wOf(pc), cellsFree); if (1000 + ub < best.v) continue;
      const occ = occupancy(P, ids); if (pc.sh.cells.some(c => occ[(pc.y + c.dy) * P.w + pc.x + c.dx] >= 0)) continue;
      const next = ids.concat(j), a2 = analyse(P, next); if (!a2.ok) continue;
      left[pc.kind]--; if (peelable(P, next)) dfs(next, j, nc, nw); left[pc.kind]++;
      if (capped) return;
    }
  };
  dfs([], 0, 0, 0);
  const ids = order(P, best.ids); let s = s0; for (const id of ids) s = place(s, id).state;
  return { best: best.v, score: best.r ? best.r.score : 0, won: best.r ? best.r.won : false, s, boards: nodes, optimal, capped, seededOnly: !best.ids.length };
}
