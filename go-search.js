// The computer's search: Monte Carlo tree search guided by the network (PUCT: each step takes the move whose value so far
// plus its prior's share of the visits still to come is greatest). The network gives, for a position, a prior over the
// moves and who is winning; a level is a number of such looks (never a time, so a slow phone plays as strongly as a fast
// one) and how loosely the final move is drawn from the visits.
// `net.evaluate(spatial, globals, h, w)` is go-net.js's; the tests give a fake one.

import { PASS, BLACK, WHITE, opp } from "./go-rules.js";
import { featuresOf } from "./go-features.js";

export function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const CPUCT = 1.1, FPU_REDUCTION = 0.2, SCORE_WEIGHT = 0.25;

/** One look at a position: the priors over its moves (a softmax over the legal ones) and the value for the side to move. */
export function look(net, pos, made, komi) {
  const n = pos.n, { spatial, globals } = featuresOf(pos, made, komi);
  const ev = net.evaluate(spatial, globals, n, n);
  const legal = pos.legalPoints();
  let top = ev.logits[n * n];
  for (const p of legal) if (ev.logits[p] > top) top = ev.logits[p];
  const moves = [], pri = [];
  let z = 0;
  for (const p of legal) { const e = Math.exp(ev.logits[p] - top); moves.push(p); pri.push(e); z += e; }
  const ep = Math.exp(ev.logits[n * n] - top);
  moves.push(PASS); pri.push(ep); z += ep;
  // the tail of hopeless moves is dropped, so a 19x19 position keeps a few dozen edges
  const order = moves.map((m, i) => i).sort((a, b) => pri[b] - pri[a]);
  const keep = [];
  let mass = 0;
  for (const i of order) { if (keep.length >= 48 || (mass > 0.995 && keep.length >= 6)) break; keep.push(i); mass += pri[i] / z; }
  let kz = 0;
  for (const i of keep) kz += pri[i];
  const winrate = ev.win + 0.5 * ev.noResult;
  return {
    moves: Int16Array.from(keep.map(i => moves[i])), prior: Float32Array.from(keep.map(i => pri[i] / kz)),
    // utility for the side to move: win minus loss, and a share for the points ahead (so a won game is won by more)
    u: (ev.win - ev.loss) + SCORE_WEIGHT * (2 / Math.PI) * Math.atan(ev.scoreMean / Math.max(5, pos.n / 2)),
    winrate, score: ev.scoreMean, own: ev.own,
  };
}

function node(pos, made) {
  return { pos, made, n: 0, u: 0, wr: 0, ev: null, kids: null, dead: null, terminal: pos.passes >= 2 };
}

/**
 * Searches `visits` looks from a position. root: { pos, made, seen (the keys of the game's earlier positions) }.
 * Returns { move, winrate (for the side to move), score (its lead, in points), own (the net's ownership, +1 = the side
 * to move), visits: [[move, visits, prior]...] }.
 */
export function search(net, root, { visits = 1, komi = 7.5, temperature = 0, rng = Math.random, cache = new Map(), noPass = false } = {}) {
  const lookAt = (nd) => {
    const key = `${nd.pos.key}|${nd.pos.toMove}|${nd.pos.passes}|${nd.pos.ko}`;
    let ev = cache.get(key);
    if (!ev) { ev = look(net, nd.pos, nd.made, komi); if (cache.size > 4000) cache.clear(); cache.set(key, ev); }
    nd.ev = ev;
    return ev;
  };
  const top = node(root.pos, root.made);
  const rootEv = lookAt(top);
  top.kids = new Array(rootEv.moves.length).fill(null);
  top.dead = new Uint8Array(rootEv.moves.length);
  top.n = 1; top.u = rootEv.u; top.wr = rootEv.winrate;

  for (let v = 1; v < visits; v++) {
    const path = [], keys = [];
    let nd = top;
    while (nd.ev && !nd.terminal) {
      const ev = nd.ev, m = ev.moves.length;
      let seenP = 0;
      for (let i = 0; i < m; i++) if (nd.kids[i]?.n > 0) seenP += ev.prior[i];
      const parentQ = nd.u / nd.n, fpu = parentQ - FPU_REDUCTION * Math.sqrt(seenP);
      const sq = Math.sqrt(nd.n);
      let best = -1, bestScore = -Infinity;
      for (let i = 0; i < m; i++) {
        if (nd.dead[i]) continue;
        const k = nd.kids[i], kn = k ? k.n : 0;
        const q = kn > 0 ? -k.u / kn : fpu;
        const s = q + CPUCT * ev.prior[i] * sq / (1 + kn);
        if (s > bestScore) { bestScore = s; best = i; }
      }
      if (best < 0) break;
      if (!nd.kids[best]) {
        const child = nd.pos.copy();
        const pt = ev.moves[best];
        const ok = child.play(pt, root.seen) >= 0 && !keys.includes(child.key);
        if (!ok) { nd.dead[best] = 1; continue; }
        nd.kids[best] = node(child, [...nd.made.slice(-4), { c: nd.pos.toMove, pt }]);
      }
      path.push(nd);
      keys.push(nd.pos.key);
      nd = nd.kids[best];
      if (nd.n === 0) break;
    }
    let value, wr;
    if (nd.n === 0 || !nd.ev) {
      const ev = lookAt(nd);
      value = ev.u; wr = ev.winrate;
      if (!nd.terminal) { nd.kids = new Array(ev.moves.length).fill(null); nd.dead = new Uint8Array(ev.moves.length); }
    } else { value = nd.u / nd.n; wr = nd.wr / nd.n; }
    // back up: the value flips with each ply, since what is good for one side is bad for the other
    nd.n++; nd.u += value; nd.wr += wr;
    for (let i = path.length - 1; i >= 0; i--) {
      value = -value; wr = 1 - wr;
      path[i].n++; path[i].u += value; path[i].wr += wr;
    }
  }

  const stats = Array.from(rootEv.moves, (mv, i) => [mv, top.kids[i]?.n || 0, rootEv.prior[i]]);
  return { move: choose(stats, visits, temperature, rng, noPass), winrate: top.wr / top.n, score: rootEv.score, own: rootEv.own, visits: stats };
}

/** The move to play: the most visited, or drawn from the visits (the prior, when there is one look) raised to 1/temperature. */
function choose(stats, visits, temperature, rng, noPass = false) {
  const weight = s => (visits <= 1 ? s[2] : s[1]);
  let best = stats[0];
  for (const s of stats) if (weight(s) > weight(best) || (weight(s) === weight(best) && s[2] > best[2])) best = s;
  if (temperature <= 0) return best[0];
  // a loose draw may not end the game on a whim: a pass is played only if it is the best move, or the other side passed
  if (noPass && best[0] !== PASS) stats = stats.filter(s => s[0] !== PASS);
  const ws = stats.map(s => Math.pow(Math.max(weight(s), 1e-9), 1 / temperature));
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return stats[i][0]; }
  return stats[0][0];
}

export { BLACK, WHITE, opp };
