// Delta: the shape of a solution. A board is built from a set of paths, one per pair. This lays them out first, before any
// number or operation exists: it cuts the field into LONG chains that cover almost all of it and run side by side, so
// the chains weave between each other and have to be fitted together across the map (see delta-metrics.js for how that is
// measured). Simulated annealing (accepting a worse layout now and then, less and less often) over moves that keep every
// chain a simple path: grow, shrink, turn a stretch of a chain round (2-opt), swap tails between two chains, hand an end
// hex over, slip an end hex in beside a neighbour, move a corner hex to an end, and absorb leftover hexes.
import { neighbours, unkey, pick, shuffle } from "./delta-base.js";

// What a layout is worth, in points: a wall between two chains and a covered hex are worth the same; a hex short of the
// floor on length costs more than six covered hexes win, a hex short of the distance more than five. The temperature
// (how much worse a layout may be and still be taken) falls from HOT to COLD in points.
const WALL = 3, COVERED = 3, SHORT_LEN = 20, SHORT_DIST = 15, HOT = 5, COLD = 0.4;

/** e to the power x (x at most 0) from plain arithmetic, (1 + x/16)^16: exp and pow may differ in the last bit between
 *  browsers, and the same seed must give the same board on every phone (today's board, shared links). */
function likely(x) {
  if (x <= -16) return 0;
  let y = 1 + x / 16;
  y *= y; y *= y; y *= y; y *= y;
  return y;
}

/**
 * Lays `count` chains over `cells` (hex keys). want: { minLen, minDist (apart, in hexes, between a chain's two ends),
 * steps (annealing moves per start), starts (how many starts, the best is kept; default 1) }. Returns
 * { paths: [[key…]…], cross, covered } (cross: borders between cells of different chains), or null if the best start
 * fell short of minLen or minDist. The same rnd gives the same layout.
 */
export function carve(rnd, cells, count, want) {
  const n = cells.length, index = new Map(cells.map((k, i) => [k, i]));
  const nb = cells.map(k => neighbours(k).filter(x => index.has(x)).map(x => index.get(x)));
  const xy = cells.map(unkey);
  const dist = (a, b) => { const dq = xy[a][0] - xy[b][0], dr = xy[a][1] - xy[b][1]; return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr)); };
  const owner = new Int8Array(n), adj = new Uint8Array(n * n);
  nb.forEach((list, a) => list.forEach(b => { adj[a * n + b] = 1; }));

  /** What a layout is worth: covered cells and walls between chains, less what falls short of the floors (heavily: they are floors). */
  const worth = paths => {
    owner.fill(-1);
    paths.forEach((p, i) => p.forEach(c => { owner[c] = i; }));
    let walls = 0, covered = 0, short = 0;
    for (let c = 0; c < n; c++) {
      if (owner[c] < 0) continue;
      covered++;
      for (const m of nb[c]) if (m > c && owner[m] >= 0 && owner[m] !== owner[c]) walls++;
    }
    for (const p of paths) {
      short += Math.max(0, want.minLen - p.length) * SHORT_LEN;
      short += Math.max(0, want.minDist - dist(p[0], p[p.length - 1])) * SHORT_DIST;
    }
    return { value: walls * WALL + covered * COVERED - short, walls, covered, short };
  };

  let best = null;
  for (let go = 0; go < (want.starts ?? 1); go++) {
    const found = anneal();
    if (!best || found.value > best.value) best = found;
  }
  if (best.short) return null;
  return { paths: best.paths.map(p => p.map(c => cells[c])), cross: best.walls, covered: best.covered };

  /** One annealing run from a fresh start: a cell each, far apart, grown round-robin keeping the cells that have fewest ways on (they'd be stranded otherwise). */
  function anneal() {
    const taken = new Uint8Array(n), starts = [];
    for (let i = 0; i < count; i++) {
      let from = null, far = -1;
      for (const c of shuffle(rnd, [...Array(n).keys()])) {
        if (taken[c]) continue;
        const d = starts.length ? Math.min(...starts.map(s => dist(s, c))) : 1;
        if (d > far) { from = c; far = d; }
      }
      starts.push(from); taken[from] = 1;
    }
    let paths = starts.map(s => [s]);
    const ways = m => nb[m].filter(x => !taken[x]).length;
    for (let moved = true; moved;) {
      moved = false;
      for (const p of paths) {
        for (const atEnd of rnd() < 0.5 ? [true, false] : [false, true]) {
          const open = nb[atEnd ? p[p.length - 1] : p[0]].filter(m => !taken[m]);
          if (!open.length) continue;
          const fewest = Math.min(...open.map(ways)), c = pick(rnd, open.filter(m => ways(m) === fewest));
          if (atEnd) p.push(c); else p.unshift(c);
          taken[c] = 1; moved = true;
          break;
        }
      }
    }
    let now = worth(paths), top = { paths: paths.map(p => p.slice()), ...now };
    for (let step = 0; step < want.steps; step++) {
      const next = propose(paths, n - now.covered);
      if (!next) continue;
      const left = 1 - step / want.steps, t = COLD + (HOT - COLD) * left * left;     // cooling, by plain arithmetic
      const w = worth(next);
      if (w.value >= now.value || rnd() < likely((w.value - now.value) / t)) {
        paths = next; now = w;
        if (now.value > top.value) top = { paths: paths.map(p => p.slice()), ...now };
      }
    }
    return top;
  }

  /** Marks who owns each hex in `owner` (-1: nobody). */
  function owned(paths) {
    owner.fill(-1);
    paths.forEach((p, i) => p.forEach(c => { owner[c] = i; }));
  }

  /** A neighbouring layout (copies the chains it changes), or null if the move it tried doesn't fit. */
  function propose(cur, free) {
    // with every hex covered there's nothing to grow into or absorb: those moves' share goes to the rest
    const next = cur.slice(), r = free ? rnd() : 0.14 + rnd() * 0.8, put = (i, p) => { next[i] = p; };
    const a = Math.floor(rnd() * cur.length), P = cur[a];
    const other = () => (a + 1 + Math.floor(rnd() * (cur.length - 1))) % cur.length;
    const atHead = rnd() < 0.5;
    const grown = (p, c) => (atHead ? [c, ...p] : [...p, c]);                   // a chain with hex c added at the end being worked on
    const endOf = p => (atHead ? p[0] : p[p.length - 1]);
    const trimmed = p => (atHead ? p.slice(1) : p.slice(0, -1));
    if (r < 0.1) {                                           // grow into a free neighbour
      owned(cur);
      const open = nb[endOf(P)].filter(m => owner[m] < 0);
      if (!open.length) return null;
      put(a, grown(P, pick(rnd, open)));
    } else if (r < 0.14) {                                   // shrink
      if (P.length <= 2) return null;
      put(a, trimmed(P));
    } else if (r < 0.34) {                                   // 2-opt: turn a stretch of the chain round, where the hexes either side of it touch again
      const ways = [];
      for (let i = -1; i + 2 < P.length; i++) for (let j = i + 2; j < P.length; j++) {
        if (i < 0 && j === P.length - 1) continue;
        if ((i < 0 || adj[P[i] * n + P[j]]) && (j === P.length - 1 || adj[P[i + 1] * n + P[j + 1]])) ways.push([i, j]);
      }
      if (!ways.length) return null;
      const [i, j] = pick(rnd, ways);
      put(a, [...P.slice(0, i + 1), ...P.slice(i + 1, j + 1).reverse(), ...P.slice(j + 1)]);
    } else if (r < 0.58) {                                   // swap tails with another chain (every way the two can be cut and rejoined)
      if (cur.length < 2) return null;
      const b = other(), B = cur[b], ways = [];
      if (P.length < 2 || B.length < 2) return null;
      for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < B.length; j++) {
        if (adj[P[i] * n + B[j + 1]] && adj[B[j] * n + P[i + 1]]) ways.push([0, i, j]);
        if (adj[P[i] * n + B[j]] && adj[P[i + 1] * n + B[j + 1]]) ways.push([1, i, j]);
      }
      if (!ways.length) return null;
      const [form, i, j] = pick(rnd, ways);
      if (form === 0) {
        put(a, [...P.slice(0, i + 1), ...B.slice(j + 1)]);
        put(b, [...B.slice(0, j + 1), ...P.slice(i + 1)]);
      } else {
        put(a, [...P.slice(0, i + 1), ...B.slice(0, j + 1).reverse()]);
        put(b, [...P.slice(i + 1).reverse(), ...B.slice(j + 1)]);
      }
    } else if (r < 0.66) {                                   // hand the end hex over to another chain's end
      if (cur.length < 2 || P.length <= 2) return null;
      const b = other(), bHead = rnd() < 0.5, B = cur[b], x = endOf(P);
      if (!nb[bHead ? B[0] : B[B.length - 1]].includes(x)) return null;
      put(a, trimmed(P));
      put(b, bHead ? [x, ...B] : [...B, x]);
    } else if (r < 0.8) {                                    // the end hex slips in between two hexes of a chain that it touches both of
      if (P.length <= 2) return null;
      const x = endOf(P), b = rnd() < 0.8 ? other() : a, rest = trimmed(P), B = b === a ? rest : cur[b], ways = [];
      for (let i = 0; i + 1 < B.length; i++) if (adj[x * n + B[i]] && adj[x * n + B[i + 1]]) ways.push(i);
      if (!ways.length) return null;
      const i = pick(rnd, ways);
      put(a, rest);
      put(b, [...B.slice(0, i + 1), x, ...B.slice(i + 1)]);
    } else if (r < 0.94) {                                   // a hex on a corner of a chain (its two neighbours on it touch) comes out and goes on a chain's end
      if (P.length < 4) return null;
      const m = 1 + Math.floor(rnd() * (P.length - 2));
      if (!adj[P[m - 1] * n + P[m + 1]]) return null;
      const y = P[m], rest = [...P.slice(0, m), ...P.slice(m + 1)], b = rnd() < 0.7 ? other() : a, B = b === a ? rest : cur[b];
      if (!nb[endOf(B)].includes(y)) return null;
      put(a, rest);
      put(b, grown(B, y));
    } else {                                                 // absorb a free hex (or two) into the chain's side
      if (P.length < 2) return null;
      owned(cur);
      const i = Math.floor(rnd() * (P.length - 1)), free = m => owner[m] < 0;
      const both = nb[P[i]].filter(m => free(m) && nb[P[i + 1]].includes(m));
      if (both.length && rnd() < 0.6) { put(a, [...P.slice(0, i + 1), pick(rnd, both), ...P.slice(i + 1)]); return next; }
      const f1 = nb[P[i]].filter(free);
      if (!f1.length) return null;
      const c1 = pick(rnd, f1), f2 = nb[c1].filter(m => free(m) && m !== c1 && nb[P[i + 1]].includes(m));
      if (!f2.length) return null;
      put(a, [...P.slice(0, i + 1), c1, pick(rnd, f2), ...P.slice(i + 1)]);
    }
    return next;
  }
}
