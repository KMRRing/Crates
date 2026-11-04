// Columbiad's solution measures and bots (pure, Node and page alike): how many shots win a level, in how many families,
// and how robustly under the level's scatter. tests/columbiad-bots.mjs runs them on small samples; tools/columbiad-bench.mjs
// runs them on the fine grid the design asks for (it is not run by CI).
//
// A "move" is { angle, charge, t }: the aim in degrees, the powder in barrels, the firing time. A level whose world stands
// still has only angle and charge to try; where a moon moves the sweep has a third axis, the time, one layer for each of
// `nt` moments of the world's period, and a solution is a place in all three.
import { shoot, normal, uniform, clampAim, apply, newGame, worldOf, BARRELS, DRAWS } from "./columbiad-engine.js";

/** The seconds after which the world repeats: its own `period`, else the longest rail's (40 s with the Moon), 0 where nothing moves. */
export const periodOf = lvl => (worldOf(lvl).moving ? lvl.period ?? Math.max(...worldOf(lvl).bodies.filter(b => b.rail).map(b => Math.abs(b.T))) : 0);

/**
 * The angles and charges the sweep tries: the legal half turn about the site's up and 0 to the level's barrels, or, for a level
 * with a `band` ({ lean (degrees either side of up), charge: [from, to] }), the part of the dial where its solutions lie: the
 * Moon is reached only in the top tenth of the power, so the share of the whole dial that wins would say nothing of the level.
 */
export function axes(lvl, da = 1, dc = 0.1) {
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS, band = lvl.band || {}, lean = band.lean ?? 90, [lo, hi] = band.charge || [0, cap], angles = [], charges = [];
  for (let a = site - lean; a <= site + lean + 1e-9; a += da) angles.push(Math.round(a * 100) / 100);
  for (let c = Math.max(dc, lo); c <= Math.min(cap, hi) + 1e-9; c += dc) charges.push(Math.round(c * 1000) / 1000);
  return { angles, charges };
}

/**
 * Every move of the grid flown once with no scatter: { angles, charges, nc, win (1 where it wins, angle-major; with a time axis,
 * where it wins at any of the times), near, core, layers (a time axis: nt layers of win), times }. `nt` layers of the period
 * for a world that moves, else one flight at time 0.
 */
export function sweep(lvl, da = 1, dc = 0.1, nt = 0) {
  const { angles, charges } = axes(lvl, da, dc), nc = charges.length, P = periodOf(lvl), n = P && nt ? nt : 1;
  const size = angles.length * nc, win = new Uint8Array(size), near = new Float32Array(size).fill(1e9), core = new Float32Array(size).fill(Infinity);
  const layers = P && nt ? new Uint8Array(n * size) : null, times = Array.from({ length: n }, (_, k) => (P && nt ? Math.round(k * P / n * 100) / 100 : 0));
  for (let k = 0; k < n; k++) angles.forEach((a, i) => charges.forEach((c, j) => {
    const r = shoot(lvl, { angle: a, charge: c, t: times[k] }, [0, 0], { watch: false });
    const q = i * nc + j;
    if (r.won) { win[q] = 1; if (layers) layers[k * size + q] = 1; }
    if (r.near < near[q]) near[q] = r.near;
    if (r.core < core[q]) core[q] = r.core;
  }));
  return { angles, charges, nc, win, near, core, layers, times, size };
}

/** The share of the sweep that wins (over the time axis too, where there is one). */
export const fraction = sw => { let n = 0; const a = sw.layers || sw.win; for (const w of a) n += w; return n / a.length; };

/** The firing time at the middle of the longest run of times a move (a cell of the sweep) wins at, and how long that run is in seconds: [t, width]. */
export function bestTime(sw, q) {
  if (!sw.layers) return [0, 0];
  const n = sw.times.length, dt = n > 1 ? sw.times[1] - sw.times[0] : 0, P = dt * n;
  let best = [0, 0], run = 0, start = 0;
  for (let k = 0; k < 2 * n; k++) {                           // twice round, so a run across the period's end is one run
    if (sw.layers[(k % n) * sw.size + q]) { if (!run) start = k; run++; if (run > n) break; if (run * dt > best[1]) best = [((start + (run - 1) / 2) * dt) % P, run * dt]; }
    else run = 0;
  }
  return best;
}

/** How long a firing time may drift either way, in seconds, before the move stops winning (no scatter): { lo, hi, width }. */
export function timeWindow(lvl, mv, step = 0.05, reach = 8) {
  if (!periodOf(lvl)) return { lo: 0, hi: 0, width: Infinity };
  const wins = t => shoot(lvl, { ...mv, t }, [0, 0], { watch: false }).won;
  let lo = 0, hi = 0;
  while (lo < reach && wins(mv.t - (lo + step))) lo += step;
  while (hi < reach && wins(mv.t + hi + step)) hi += step;
  return { lo, hi, width: lo + hi + step };
}

/**
 * The window a winning shot sits in, with no scatter: how far the angle can move either way at its power, and the power either way
 * at its angle, before it stops winning (what a thumb has to hit). { a0, a1 (degrees), c0, c1 (power units), da, dc (the widths) }.
 */
export function windowOf(lvl, mv, { da = 0.05, dc = 0.02, reach = 20 } = {}) {
  const cap = lvl.barrels ?? BARRELS, wins = (angle, charge) => shoot(lvl, { angle, charge, t: mv.t || 0 }, [0, 0], { watch: false }).won;
  let a0 = mv.angle, a1 = mv.angle, c0 = mv.charge, c1 = mv.charge;
  while (a1 - mv.angle < reach && wins(a1 + da, mv.charge)) a1 += da;
  while (mv.angle - a0 < reach && wins(a0 - da, mv.charge)) a0 -= da;
  while (c1 < cap - 1e-9 && wins(mv.angle, Math.min(cap, c1 + dc))) c1 = Math.min(cap, c1 + dc);
  while (mv.charge - c0 < reach && c0 > dc && wins(mv.angle, c0 - dc)) c0 -= dc;
  const r = v => Math.round(v * 100) / 100;
  return { a0: r(a0), a1: r(a1), c0: r(c0), c1: r(c1), da: r(a1 - a0 + da), dc: r(c1 - c0 + dc) };
}

/**
 * The winning cells in connected groups (eight neighbours), biggest first: [{ cells, size, deepest }]. The groups are made
 * from the cells with every neighbour winning too (`core`), so two arcs that touch at a thin neck, a low shot and a lob
 * for the same ring, are two families; the cells on the rim join the group they touch.
 */
export function families(sw, core = 1) {
  const na = sw.angles.length, nc = sw.nc, win = (i, j) => i >= 0 && j >= 0 && i < na && j < nc && sw.win[i * nc + j] === 1;
  const deep = new Uint8Array(na * nc);
  for (let i = 0; i < na; i++) for (let j = 0; j < nc; j++) {
    let ok = win(i, j);
    for (let a = -core; a <= core && ok; a++) for (let b = -core; b <= core; b++) if (!win(i + a, j + b)) { ok = false; break; }
    deep[i * nc + j] = ok ? 1 : 0;
  }
  const label = new Int32Array(na * nc).fill(-1), out = [];
  const grow = (i0, j0, mask, id, group) => {
    const todo = [[i0, j0]];
    label[i0 * nc + j0] = id;
    while (todo.length) {
      const [a, b] = todo.pop();
      group.push([a, b]);
      for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) {
        const x = a + da, y = b + db;
        if (x >= 0 && y >= 0 && x < na && y < nc && mask(x, y) && label[x * nc + y] < 0) { label[x * nc + y] = id; todo.push([x, y]); }
      }
    }
  };
  for (let i = 0; i < na; i++) for (let j = 0; j < nc; j++) {
    if (deep[i * nc + j] && label[i * nc + j] < 0) { const cells = []; grow(i, j, (x, y) => deep[x * nc + y] === 1, out.length, cells); out.push({ cells, size: cells.length }); }
  }
  // winners that are not deep belong to the family they touch; a group with no deep cell (a thin level) stands alone
  for (let i = 0; i < na; i++) for (let j = 0; j < nc; j++) {
    if (!win(i, j) || label[i * nc + j] >= 0) continue;
    let id = -1;
    for (let a = -1; a <= 1 && id < 0; a++) for (let b = -1; b <= 1; b++) { const x = i + a, y = j + b; if (x >= 0 && y >= 0 && x < na && y < nc && label[x * nc + y] >= 0) { id = label[x * nc + y]; break; } }
    if (id >= 0) { label[i * nc + j] = id; out[id].cells.push([i, j]); out[id].size++; }
  }
  for (let i = 0; i < na; i++) for (let j = 0; j < nc; j++) {
    if (!win(i, j) || label[i * nc + j] >= 0) continue;
    const cells = [];
    grow(i, j, (x, y) => win(x, y), out.length, cells);
    out.push({ cells, size: cells.length });
  }
  for (const f of out) {
    let best = f.cells[0], bn = -1;
    const inside = new Set(f.cells.map(([a, b]) => a * nc + b));
    for (const [a, b] of f.cells) {
      let n = 0;
      for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (a + x >= 0 && a + x < na && inside.has((a + x) * nc + b + y)) n++;
      if (n > bn) { bn = n; best = [a, b]; }
    }
    f.deepest = best;
  }
  return out.sort((p, q) => q.size - p.size);
}

/** The share of `runs` scattered shots of a move that win (the draws are a seed's, so it is the same every time). */
export function robustness(lvl, mv, runs = 50, seed = 7) {
  let n = 0;
  for (let k = 0; k < runs; k++) if (shoot(lvl, mv, [normal(seed, DRAWS * k), normal(seed, DRAWS * k + 12)], { watch: false }).won) n++;
  return n / runs;
}

/**
 * The measures of a level on a grid: the share of moves that win, the families they fall in, and the best robustness found
 * (each family's deepest cells, and a sample spread through it, flown `runs` times with scatter).
 * { fraction, families (those of 3 cells or more), all (every group), best { angle, charge, t, rob }, picks (the moves tried, with rob) }.
 */
export function survey(lvl, { da = 1, dc = 0.1, runs = 50, per = 8, nt = 0, sw = null } = {}) {
  sw = sw || sweep(lvl, da, dc, nt);
  const fams = families(sw), real = fams.filter(f => f.size >= 3), picks = [];
  for (const f of real.slice(0, 4)) {
    // the deepest cell first, then others by depth (cheaply: cells whose neighbours all win), spread through the family
    const nc = sw.nc, inside = new Set(f.cells.map(([a, b]) => a * nc + b));
    const ranked = f.cells.map(([a, b]) => {
      let n = 0;
      for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) if (inside.has((a + x) * nc + b + y) && a + x >= 0 && a + x < sw.angles.length) n++;
      return { a, b, n };
    }).sort((p, q) => q.n - p.n);
    const chosen = [];
    for (const c of ranked) {
      if (chosen.length >= per) break;
      if (chosen.every(o => Math.abs(o.a - c.a) + Math.abs(o.b - c.b) > 2)) chosen.push(c);
    }
    for (const c of chosen) {
      const mv = { angle: sw.angles[c.a], charge: sw.charges[c.b], t: Math.round(bestTime(sw, c.a * sw.nc + c.b)[0] * 100) / 100 };
      picks.push({ ...mv, rob: robustness(lvl, mv, runs), family: real.indexOf(f) });
    }
  }
  picks.sort((p, q) => q.rob - p.rob);
  return { fraction: fraction(sw), families: real.length, all: fams.length, sizes: fams.map(f => f.size), best: picks[0] || null, picks, sw };
}

// ---------- the bots ----------
const rng = seed => { let k = 0; return () => uniform(seed ^ 0xB07, k++); };
/** Random shots from the whole legal dial. */
export const blind = (lvl, s, r) => {
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS, P = periodOf(lvl);
  return { angle: site - 90 + 180 * Math.min(0.9999, Math.max(0, r())), charge: cap * Math.min(1, Math.max(0, r())), t: P ? Math.round(P * r() * 100) / 100 : 0 };
};
const found = new WeakMap();
/** The most robust solution the survey can find, fired every time. */
export const careful = (lvl, grid = { da: 1, dc: 0.1 }) => {
  let b = found.get(lvl);
  if (!b) { const sv = survey(lvl, { ...grid, runs: 20, per: 4 }); b = sv.best || { angle: lvl.site ?? 90, charge: 1, t: 0 }; found.set(lvl, b); }
  return { angle: b.angle, charge: b.charge, t: b.t || 0 };
};
export const BOTS = { blind: (lvl, s, r) => blind(lvl, s, r), careful: lvl => careful(lvl) };

/** Plays a level with a bot until it wins or has used `limit` shots: { shots, won, state }. */
export function play(lvl, seed, bot, limit = 30) {
  let s = newGame(lvl, seed);
  const r = rng(seed);
  for (let i = 0; i < limit && s.status === "play"; i++) s = apply(lvl, s, BOTS[bot](lvl, s, r), { record: 0 }).state;
  return { shots: s.shots, won: s.status === "won", state: s };
}

/** How often a blind shot wins under the level's scatter: `n` random shots. */
export function blindRate(lvl, n = 400, seed = 11) {
  const r = rng(seed);
  let w = 0;
  for (let k = 0; k < n; k++) {
    const mv = blind(lvl, null, r);
    if (shoot(lvl, mv, [normal(seed, DRAWS * k), normal(seed, DRAWS * k + 12)], { watch: false }).won) w++;
  }
  return w / n;
}
// ---------- finding solutions ----------
/**
 * How near a move is to winning, no scatter: below 0 it wins (-1 through the middle of the ring, 0 on its edge), above it falls short
 * (0 to 1 for a ring touched at the wrong speed, more for a ring missed, a gate not passed, an orbit not swept). Smooth enough to walk down.
 */
export function cost(lvl, mv) {
  const g = lvl.goal || { type: "hit" }, gated = !!lvl.gates && (g.type === "gates" || g.type === "return"), list = gated ? lvl.gates : [lvl.target];
  const r = shoot(lvl, mv, [0, 0], { watch: true });
  if (r.won) return r.core - 1;
  if (g.type === "orbit") return 1 + (1 - Math.min(1, Math.abs(r.sweep) / (g.sweep * 0.017453292519943295))) * 20 + (r.end === "impact" ? 5 : 0);
  const left = gated ? list.length - 1 - r.gates : 0, T = list[Math.min(r.gates, list.length - 1)];
  if (r.hit && !r.hit.ok) {
    const lim = gated ? T : g.type === "soft" ? { soft: g.speed } : { fast: g.speed };
    return 0.5 + (lim.soft !== undefined ? r.hit.speed / lim.soft : lim.fast / Math.max(1e-6, r.hit.speed)) * 0.5 + left * 50;
  }
  return 1 + r.near / T.r + left * 50;
}

/** Walks a move downhill on `cost` (angle, charge, time: steps halved while nothing improves). */
export function descend(lvl, mv, { steps = [1, 0.1, 0.5], floor = [0.05, 0.01, 0.01] } = {}) {
  let best = { angle: mv.angle, charge: mv.charge, t: mv.t || 0 }, bc = cost(lvl, best);
  const timed = periodOf(lvl) > 0;
  let st = steps.slice();
  for (let guard = 0; guard < 400; guard++) {
    let moved = false;
    for (let k = 0; k < 3; k++) {
      if (k === 2 && !timed) continue;
      for (const sg of [1, -1]) {
        const n = { ...best }; n[k === 0 ? "angle" : k === 1 ? "charge" : "t"] += sg * st[k];
        n.angle = Math.round(n.angle * 100) / 100; n.charge = Math.round(n.charge * 100) / 100; n.t = Math.round(n.t * 100) / 100;
        const c = cost(lvl, n);
        if (c < bc - 1e-9) { best = n; bc = c; moved = true; }
      }
    }
    if (!moved) { st = st.map((s, k) => Math.max(floor[k], s / 2)); if (st.every((s, k) => s <= floor[k])) break; }
  }
  return { ...best, cost: bc };
}

/**
 * Looks for winning moves: the band's grid (and the world's period, for a moving world) flown once, the best-scoring distinct cells
 * walked downhill, the winners kept and sorted by how robust they are. { picks: [{ angle, charge, t, cost, rob }], tried }.
 */
export function findShots(lvl, { da = 2, dc = 0.1, dt = 0.5, starts = 14, runs = 30 } = {}) {
  const { angles, charges } = axes(lvl, da, dc), P = periodOf(lvl), times = P ? Array.from({ length: Math.round(P / dt) }, (_, k) => Math.round(k * dt * 100) / 100) : [0];
  const cells = [];
  for (const t of times) for (const a of angles) for (const c of charges) cells.push({ angle: a, charge: c, t, cost: cost(lvl, { angle: a, charge: c, t }) });
  cells.sort((p, q) => p.cost - q.cost);
  const seeds = [];
  for (const c of cells) {
    if (seeds.length >= starts) break;
    if (seeds.every(s => Math.abs(s.angle - c.angle) > da * 2 || Math.abs(s.charge - c.charge) > dc * 4 || (P && Math.min(Math.abs(s.t - c.t), P - Math.abs(s.t - c.t)) > dt * 3))) seeds.push(c);
  }
  const picks = [];
  for (const s of seeds) {
    const d = descend(lvl, s);
    if (d.cost < 0 && picks.every(p => Math.abs(p.angle - d.angle) > 0.3 || Math.abs(p.charge - d.charge) > 0.02 || Math.abs(p.t - d.t) > 0.1)) picks.push({ ...d, rob: robustness(lvl, d, runs) });
  }
  picks.sort((p, q) => q.rob - p.rob || p.cost - q.cost);
  return { picks, tried: cells.length, best: cells[0] };
}

export { clampAim };
