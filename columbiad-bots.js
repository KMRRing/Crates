// Columbiad's solution measures and bots (pure, Node and page alike): how many shots win a level, in how many families,
// and how robustly under the level's scatter. tests/columbiad-bots.mjs runs them on small samples; tools/columbiad-bench.mjs
// runs them on the fine grid the design asks for (it is not run by CI).
//
// A "move" is { angle, charge, t }: the aim in degrees, the powder in barrels, the firing time. A level whose world stands
// still (the Earth alone) has only angle and charge to try; when the Moon moves (M2) the sweep gains a third axis.
import { shoot, normal, uniform, clampAim, apply, newGame, BARRELS, DRAWS } from "./columbiad-engine.js";

/** The angles and charges the sweep tries: the legal half turn about the site's up, and 0 to the level's barrels. */
export function axes(lvl, da = 1, dc = 0.1) {
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS, angles = [], charges = [];
  for (let a = site - 90; a <= site + 90 + 1e-9; a += da) angles.push(Math.round(a * 100) / 100);
  for (let c = dc; c <= cap + 1e-9; c += dc) charges.push(Math.round(c * 1000) / 1000);
  return { angles, charges };
}

/** Every move of the grid flown once with no scatter: { angles, charges, win (1 where it wins, angle-major), near, core }. */
export function sweep(lvl, da = 1, dc = 0.1, t = 0) {
  const { angles, charges } = axes(lvl, da, dc), nc = charges.length;
  const win = new Uint8Array(angles.length * nc), near = new Float32Array(angles.length * nc), core = new Float32Array(angles.length * nc);
  angles.forEach((a, i) => charges.forEach((c, j) => {
    const r = shoot(lvl, { angle: a, charge: c, t }, [0, 0], { watch: false });
    win[i * nc + j] = r.won ? 1 : 0; near[i * nc + j] = r.near; core[i * nc + j] = r.core;
  }));
  return { angles, charges, nc, win, near, core };
}

/** The share of the sweep that wins. */
export const fraction = sw => { let n = 0; for (const w of sw.win) n += w; return n / sw.win.length; };

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
export function survey(lvl, { da = 1, dc = 0.1, runs = 50, per = 8, sw = null } = {}) {
  sw = sw || sweep(lvl, da, dc);
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
      const mv = { angle: sw.angles[c.a], charge: sw.charges[c.b], t: 0 };
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
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS;
  return { angle: site - 90 + 180 * Math.min(0.9999, Math.max(0, r())), charge: cap * Math.min(1, Math.max(0, r())), t: 0 };
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
export { clampAim };
