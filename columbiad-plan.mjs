// Columbiad's level planner: finds new layouts for the first three chapters and judges any level by the finder's measures, so a new level
// can be put where its chapter's ramp needs it (13 November 2026, Korbi: "the whole chapter -> level thing has to be redesigned, it's not
// long enough": twelve chapters of eight or nine levels, the new ones filling the ramps). Not run by CI; the levels it finds are written
// into columbiad-levels.js by hand, with a name and a note, and proved with `node tools/columbiad-find.mjs write <ids>`.
//   node columbiad-plan.mjs core 1 0.5 0.62 150 280 [tries] [seed]   chapter 1's kind (beside the Moon), a ring of 0.5 to 0.62, window size 150 to 280
//   node columbiad-plan.mjs core 2 …                                   behind the Moon;  core 3 …: round the Moon and home
//   node columbiad-plan.mjs judge /path/levels.mjs [part of parts]     every level the module exports as `default`, judged
// A level's size is the finder's: the window a thumb has to find, degrees x power units (x seconds of countdown, at most 6, where the
// world moves; 6 where it does not). Bigger is easier. A level is kept only where, as the finder asks, a straight shot at the ring never
// wins, the Moon's pull is needed, and the best shot wins nine runs in ten of scatter.
import { periodOf, descend, cost, robustness, windowOf, timeWindow, hasMoon, withoutPull, FUN, swingOf, apart } from "./columbiad-bots.js";
export { FUN, swingOf, apart };
import { validate, shoot, uniform, padAt, ringAt, isMoving, worldOf, bodyAt, DELAY_MAX, BARRELS } from "./columbiad-engine.js";

const r2 = v => Math.round(v * 100) / 100;

/** How many shots aimed straight at the first ring (a few degrees either way, every power, a spread of launch times where it moves) win. */
function straightWins(lvl, powerStep = 0.25, angStep = 0.5, nt = 6) {
  if (lvl.goal?.type === "orbit") return 0;
  const first = (lvl.gates || [lvl.target])[0], cap = lvl.barrels ?? BARRELS, moving = isMoving(lvl), tm = Math.min(lvl.delayMax ?? DELAY_MAX, 10);
  const times = moving ? Array.from({ length: nt }, (_, k) => r2(k * tm / nt)) : [0];
  let wins = 0, tried = 0;
  for (const t of times) {
    const pad = padAt(lvl, t), p = ringAt(lvl, first, t), b = Math.atan2(p[1] - pad[1], p[0] - pad[0]) * 180 / Math.PI;
    for (let c = 0.5; c <= cap + 1e-9; c += powerStep) for (let o = -2.5; o <= 2.5 + 1e-9; o += angStep) { tried++; if (shoot(lvl, { angle: b + o, charge: c, t }, [0, 0], { watch: false }).won) wins++; }
  }
  return wins / tried;
}

/** The finder's judgement of a level (tools/columbiad-find.mjs, the same steps): null if no robust shot is found, else its size, the best
 *  shot, the share of random shots that win (luck) and of straight ones. */
export function judge(lvl, N = 1500, seed = 1) {
  if (validate(lvl).length) return null;
  const moving = isMoving(lvl), P = periodOf(lvl), cap = lvl.barrels ?? BARRELS, site = lvl.site ?? 90;
  const tm = moving ? Math.min(lvl.delayMax ?? DELAY_MAX, P || 10) : 0, band = lvl.band || {}, lean = band.lean ?? 90, [lo, hi] = band.charge || [0.5, cap];
  const rnd = k => uniform(seed * 7919 + 13, k), moony = hasMoon(lvl), dry = moony ? withoutPull(lvl) : lvl, cells = [];
  let wins = 0;
  for (let k = 0; k < N; k++) {
    const mv = { angle: r2(site - lean + 2 * lean * rnd(3 * k)), charge: r2(lo + (hi - lo) * rnd(3 * k + 1)), t: moving ? r2(tm * rnd(3 * k + 2) * 10) / 10 : 0 };
    const c = cost(lvl, mv);
    if (c < 0) wins++;
    cells.push({ ...mv, c });
  }
  cells.sort((a, b) => a.c - b.c);
  const starts = [];
  for (const c of cells) {
    if (starts.length >= 12) break;
    if (starts.every(s => Math.abs(s.angle - c.angle) > 4 || Math.abs(s.charge - c.charge) > 0.5 || (moving && Math.abs(s.t - c.t) > 1))) starts.push(c);
  }
  const found = [];
  for (const s of starts) {
    const d0 = descend(lvl, s, { steps: [1, 0.1, 0.4], floor: [0.05, 0.01, 0.1] });
    if (d0.cost >= 0) continue;
    const d = { ...d0, t: moving ? r2(Math.round(d0.t * 10) / 10) : d0.t };
    if (moving && !shoot(lvl, d, [0, 0], { watch: false }).won) continue;
    if (moony && shoot(dry, { angle: d.angle, charge: d.charge, t: d.t }, [0, 0], { watch: false }).won) continue;
    const rob = robustness(lvl, d, 60, 31);
    if (rob < 0.9) continue;
    const w = windowOf(lvl, d), tw = moving ? timeWindow(lvl, d, 0.1, 6).width : 6;
    found.push({ angle: d.angle, charge: d.charge, t: d.t, rob, win: w, size: r2(w.da * w.dc * Math.min(tw, 6)) });
  }
  if (!found.length) return null;
  found.sort((a, b) => b.size - a.size);
  return { size: found[0].size, best: found[0], luck: r2(wins / N * 100), straight: straightWins(lvl) };
}

/**
 * A level's winning windows over the whole legal dial (da degrees, dc power units, dt seconds of countdown where the world moves), biggest
 * first: { share (of the dial that wins), windows: [{ cells, mid (the move at its middle), power: [lo, hi], elev: [lo, hi] }] }.
 */
export function windows(lvl, { da = 2, dc = 0.2, dt = 1 } = {}) {
  const site = lvl.site ?? 90, cap = lvl.barrels ?? BARRELS, moving = isMoving(lvl), P = periodOf(lvl), tm = moving ? Math.min(lvl.delayMax ?? DELAY_MAX, P || 10) : 0;
  const A = [], C = [], T = [];
  for (let a = -90; a <= 90; a += da) A.push(r2(site + a));
  for (let c = dc; c <= cap + 1e-9; c += dc) C.push(r2(c));
  for (let t = 0; t <= (moving ? tm - 1e-9 : 0); t += dt) T.push(r2(t));
  const na = A.length, nc = C.length, nt = T.length, win = new Uint8Array(na * nc * nt);
  let wins = 0;
  for (let k = 0; k < nt; k++) for (let i = 0; i < na; i++) for (let j = 0; j < nc; j++) if (shoot(lvl, { angle: A[i], charge: C[j], t: T[k] }, [0, 0], { watch: false }).won) { win[(k * na + i) * nc + j] = 1; wins++; }
  const label = new Int32Array(win.length).fill(-1), out = [];
  for (let q = 0; q < win.length; q++) {
    if (!win[q] || label[q] >= 0) continue;
    const cells = [q];
    label[q] = out.length;
    for (let s = 0; s < cells.length; s++) {
      const c = cells[s], j = c % nc, i = Math.floor(c / nc) % na, k = Math.floor(c / (nc * na));
      for (const [dk, di, dj] of [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]]) {
        const K = k + dk, I = i + di, J = j + dj;
        if (K < 0 || K >= nt || I < 0 || I >= na || J < 0 || J >= nc) continue;
        const r = (K * na + I) * nc + J;
        if (win[r] && label[r] < 0) { label[r] = out.length; cells.push(r); }
      }
    }
    const ii = cells.map(c => Math.floor(c / nc) % na), jj = cells.map(c => c % nc), kk = cells.map(c => Math.floor(c / (nc * na)));
    const mi = ii.reduce((s, v) => s + v, 0) / ii.length, mj = jj.reduce((s, v) => s + v, 0) / jj.length, mk = kk.reduce((s, v) => s + v, 0) / kk.length;
    let mid = 0, bd = Infinity;
    cells.forEach((c, x) => { const d = ((ii[x] - mi) * da / 3) ** 2 + ((jj[x] - mj) * dc / 0.3) ** 2 + ((kk[x] - mk) * dt) ** 2; if (d < bd) { bd = d; mid = x; } });
    const off = ii.map(i => Math.abs(A[i] - site));
    out.push({ cells: cells.length, mid: { angle: A[ii[mid]], charge: C[jj[mid]], t: T[kk[mid]] }, power: [Math.min(...jj.map(j => C[j])), Math.max(...jj.map(j => C[j]))], elev: [r2(90 - Math.max(...off)), r2(90 - Math.min(...off))] });
  }
  out.sort((a, b) => b.cells - a.cells);
  return { share: wins / win.length, windows: out };
}

/**
 * A level held to FUN's rules: { ok, why (the rules it breaks), best (its most fun window, measured: the swing, the window a thumb has at
 * its middle, the countdown's window, the shape), share }. `others`: the shapes of the other levels, for "its own".
 */
export function funOf(lvl, others = [], grid, given = null) {
  const cap = lvl.barrels ?? BARRELS, moving = isMoving(lvl), wd = given || windows(lvl, grid), why = [];
  const cands = wd.windows.filter(w => w.cells >= 3).slice(0, 6).map(w => {
    // the window is measured where a thumb would aim: the window's middle walked to the shot through the ring's middle
    const d = descend(lvl, w.mid, { steps: [0.5, 0.05, 0.2], floor: [0.05, 0.01, 0.1] }), at = d.cost < 0 ? { angle: d.angle, charge: d.charge, t: d.t } : w.mid;
    const sw = swingOf(lvl, at), win = windowOf(lvl, at, { da: 0.25, dc: 0.05 }), tw = moving ? timeWindow(lvl, at, 0.1, 6).width : Infinity;
    const mid = w.mid.charge / cap, swingOk = moving || Math.abs(sw.pulled) >= FUN.swing, gaugeOk = mid >= FUN.gauge[0] && mid <= FUN.gauge[1];
    const findOk = win.da >= FUN.angle && win.dc >= FUN.power && win.da * win.dc >= FUN.area && tw >= FUN.time;
    const score = (swingOk ? 2 : 0) + (gaugeOk ? 2 : 0) + (findOk ? 2 : 0) + Math.min(Math.abs(sw.pulled), 270) / 270 - Math.abs(mid - 0.55);
    return { ...w, mid: at, ...sw, win, tw: r2(tw), swingOk, gaugeOk, findOk, score };
  }).sort((a, b) => b.score - a.score);
  const best = cands[0] || null;
  if (!best) why.push("never wins");
  else {
    if (!best.swingOk) why.push(`no swing (${best.pulled} degrees)`);
    if (!best.gaugeOk) why.push(`off mid-gauge (power ${best.mid.charge} of ${cap})`);
    if (!best.findOk) why.push(`hard to find (${best.win.da} degrees by ${best.win.dc} power${moving ? `, ${best.tw} s` : ""})`);
    const near = others.map(o => ({ id: o.id, d: apart(best.shape, o.shape) })).filter(o => o.d < FUN.apart);
    if (near.length) why.push(`the same path as ${near.map(o => o.id).join(", ")}`);
  }
  if (wd.share > FUN.share[1]) why.push(`given away (${r2(wd.share * 100)}% of the dial wins)`);
  if (wd.share < FUN.share[0]) why.push(`a needle (${r2(wd.share * 100)}% of the dial wins)`);
  return { ok: !why.length, why, best, share: wd.share, windows: wd.windows.slice(0, 4) };
}

/**
 * A level's dial moved and narrowed so a winning shot sits mid-gauge (`at` of the gauge) with a power window of at least `power` units: the
 * same layout and the same paths, only which power gives which speed (the dial is a straight line from its slowest to its fastest). The span
 * narrows at most to a third. { lvl, mv } with the shot's new power, or null where it no longer wins, a straight shot now does, or the pull
 * is no longer needed.
 */
export function retune(lvl, mv, { at = 0.55, power = 0.8 } = {}) {
  const cap = lvl.barrels ?? BARRELS, [d0, d1] = lvl.dial, S = d1 - d0, v = d0 + S * mv.charge / cap;
  const w = windowOf(lvl, mv, { da: 0.25, dc: 0.02 }), dv = S * w.dc / cap, S2 = Math.max(S / 3, Math.min(S, dv * cap / power));
  const n0 = Math.max(0, r2(v - S2 * at)), n1 = r2(n0 + S2), out = { ...lvl, dial: [n0, n1] }, shot = { ...mv, charge: r2((v - n0) / (n1 - n0) * cap) };
  if (!shoot(out, shot, [0, 0], { watch: false }).won || straightWins(out) > 0) return null;
  if (hasMoon(out) && shoot(withoutPull(out), shot, [0, 0], { watch: false }).won) return null;
  return { lvl: out, mv: shot, win: windowOf(out, shot, { da: 0.25, dc: 0.05 }) };
}

/**
 * The winning shots a level has, found the finder's way (random aims, the best walked downhill), each measured as FUN measures one:
 * [{ angle, charge, t, pulled, win, tw, rob, shape }], most fun first. Cheaper than the whole dial, for trying many layouts.
 */
export function shotsOf(lvl, N = 700, seed = 1, known = []) {
  const moving = isMoving(lvl), P = periodOf(lvl), cap = lvl.barrels ?? BARRELS, site = lvl.site ?? 90, tm = moving ? Math.min(lvl.delayMax ?? DELAY_MAX, P || 10) : 0;
  const rnd = k => uniform(seed * 7919 + 13, k), moony = hasMoon(lvl), dry = moony ? withoutPull(lvl) : lvl, cells = [];
  for (let k = 0; k < N; k++) {
    const mv = { angle: r2(site - 85 + 170 * rnd(3 * k)), charge: r2(0.5 + (cap - 0.5) * rnd(3 * k + 1)), t: moving ? Math.round(tm * rnd(3 * k + 2) * 10) / 10 : 0 };
    cells.push({ ...mv, c: cost(lvl, mv) });
  }
  cells.sort((a, b) => a.c - b.c);
  const starts = known.map(k => ({ angle: k.angle, charge: k.charge, t: k.t || 0 }));
  for (const c of cells) {
    if (starts.length >= 8 + known.length) break;
    if (starts.every(s => Math.abs(s.angle - c.angle) > 6 || Math.abs(s.charge - c.charge) > 1 || (moving && Math.abs(s.t - c.t) > 1.5))) starts.push(c);
  }
  const out = [];
  for (const s of starts) {
    const d = descend(lvl, s, { steps: [1, 0.2, 0.5], floor: [0.05, 0.01, 0.1] });
    if (d.cost >= 0) continue;
    const mv = { angle: d.angle, charge: d.charge, t: moving ? Math.round(d.t * 10) / 10 : 0 };
    if (!shoot(lvl, mv, [0, 0], { watch: false }).won) continue;
    if (moony && shoot(dry, mv, [0, 0], { watch: false }).won) continue;
    if (out.some(o => Math.abs(o.angle - mv.angle) < 1 && Math.abs(o.charge - mv.charge) < 0.3 && Math.abs(o.t - mv.t) < 0.5)) continue;
    const sw = swingOf(lvl, mv), win = windowOf(lvl, mv, { da: 0.25, dc: 0.05 }), tw = moving ? timeWindow(lvl, mv, 0.1, 6).width : Infinity;
    out.push({ ...mv, ...sw, win, tw: r2(tw), rob: robustness(lvl, mv, 40, 31) });
  }
  return out;
}
/** How fun a measured shot is, by FUN (6 for one that meets every rule, more for a bigger swing and a roomier window), and the rules it breaks. */
export function rate(lvl, s) {
  const cap = lvl.barrels ?? BARRELS, moving = isMoving(lvl), why = [];
  if (!moving && Math.abs(s.pulled) < FUN.swing) why.push(`no swing (${s.pulled})`);
  const g = s.charge / cap;
  if (g < FUN.gauge[0] || g > FUN.gauge[1]) why.push(`off mid-gauge (${s.charge})`);
  if (s.win.da < FUN.angle || s.win.dc < FUN.power || s.win.da * s.win.dc < FUN.area || s.tw < FUN.time) why.push(`hard to find (${s.win.da}x${s.win.dc}${moving ? ` ${s.tw} s` : ""})`);
  if (s.rob < 0.9) why.push(`scatter decides it (${s.rob})`);
  const score = 6 - 2 * why.length + Math.min(Math.abs(s.pulled), 270) / 270 + Math.min(s.win.da * s.win.dc, 20) / 20 + (moving ? Math.min(s.tw, 3) / 3 : 0);
  return { score, why };
}

// ---------- redrawing a level: its own kind, moved about until it is fun ----------
const gauss = R => { let s = 0; for (let i = 0; i < 6; i++) s += R(); return (s - 3) / Math.sqrt(0.5); };
/** A copy of a level with its free things moved a little: the bodies it does not start from, the rings (not one on the ground at home),
 *  a riding ring's place on its body, rails' phases, the pad's site. `spread` in Earth radii over three. */
export function nudge(lvl, R, spread = 0.8) {
  const l = JSON.parse(JSON.stringify(lvl)), w = worldOf(lvl), pad = padAt(lvl, 0);
  l.bodies.forEach((b, i) => {
    if (i === w.fi) return;
    if (b.at) b.at = [r2(b.at[0] + gauss(R) * spread), r2(b.at[1] + gauss(R) * spread)];
    if (b.rail) b.rail.phase = r2(b.rail.phase + (R() - 0.5) * 0.3);
  });
  const rings = l.gates || [l.target];
  for (const g of rings) {
    if (g.at && !(Math.hypot(g.at[0] - pad[0], g.at[1] - pad[1]) < 0.3)) { g.at = [r2(g.at[0] + gauss(R) * spread), r2(g.at[1] + gauss(R) * spread)]; g.r = r2(g.r * (0.95 + 0.25 * R())); }
    if (g.off && g.body) { const a = (R() - 0.5) * 1.6, c = Math.cos(a), s = Math.sin(a); g.off = [r2(g.off[0] * c - g.off[1] * s), r2(g.off[0] * s + g.off[1] * c)]; }
    if (g.rail) g.rail.phase = r2(g.rail.phase + (R() - 0.5) * 0.3);
  }
  if (l.gates) l.target = l.gates[l.gates.length - 1];
  if (!isMoving(lvl) && R() < 0.5) l.site = (lvl.site ?? 90) + (R() < 0.5 ? -15 : 15);
  // a world that moves is eased in time: the body the shot leaves from turns more slowly (so a second of countdown moves it less), and a ring
  // that rides grows a little (its guard's rocks stand well clear of it up to a quarter bigger)
  if (isMoving(lvl)) {
    const from = l.bodies[w.fi];
    if (from.rail) from.rail.T = r2(from.rail.T * (1 + 0.6 * R()));
    for (const g of rings) if (g.body || g.rail) g.r = r2(g.r * (1 + 0.22 * R()));
  }
  return l;
}
/** Whether a layout is drawable: rings clear of every body and of each other. */
function clear(l) {
  const w = worldOf(l), rings = l.gates || [l.target];
  // a level with its own aim view (the first chapters' frame) keeps its rings and Moon inside it
  if (l.frame) {
    const [x0, y0, x1, y1] = l.frame, inside = (x, y, r) => x - r > x0 && x + r < x1 && y - r > y0 && y + r < y1;
    if (rings.some(g => g.at && !inside(g.at[0], g.at[1], g.r))) return false;
    if (l.bodies.some((b, i) => i !== w.fi && b.at && !inside(b.at[0], b.at[1], b.r))) return false;
  }
  for (const g of rings) {
    if (!g.at || g.body || g.rail) continue;
    for (let i = 0; i < w.n; i++) { const [bx, by] = bodyAt(l, i, 0); if (Math.hypot(g.at[0] - bx, g.at[1] - by) < w.bodies[i].r + g.r + 0.25 && !(i === w.fi && Math.abs(Math.hypot(g.at[0] - bx, g.at[1] - by) - w.bodies[i].r) < 0.05)) return false; }
  }
  return true;
}
/**
 * Redraws a level: `tries` layouts nudged from it, each with its most fun shot found and the dial retuned round that shot, the best kept.
 * `others`: the shapes of the other levels of its chapter (its own: a path at least FUN.apart from each). { lvl, shot, score, why } or null.
 */
export function redraw(lvl, { tries = 30, seed = 1, spread = 0.8, others = [], known = [] } = {}) {
  let rs = seed * 104729 + 11, n = 0;
  const R = () => uniform(rs, n++);
  let best = null;
  for (let k = 0; k < tries; k++) {
    const l = k === 0 ? JSON.parse(JSON.stringify(lvl)) : nudge(lvl, R, spread);
    if (l.gates) l.target = l.gates[l.gates.length - 1];            // a copy's last gate must be its target itself
    if (!clear(l) || validate(l).length) continue;
    const shots = shotsOf(l, 600, seed + k, k === 0 ? known : []);
    for (const s of shots.slice(0, 4)) {
      let L = l, S = s;
      const g = s.charge / (l.barrels ?? BARRELS);
      if (g < FUN.gauge[0] || g > FUN.gauge[1] || s.win.dc < 0.8) {
        let t = null;
        for (const at of [Math.min(0.65, Math.max(0.45, g)), 0.55, 0.5, 0.6, 0.45, 0.4]) if ((t = retune(l, s, { at }))) break;
        if (!t) continue;
        L = t.lvl; S = { ...s, charge: t.mv.charge, win: t.win, rob: robustness(t.lvl, t.mv, 40, 31) };
      } else if (straightWins(l) > 0) continue;
      const near = others.filter(o => apart(S.shape, o.shape) < FUN.apart * 1.6).length;
      const r = rate(L, S), score = r.score - 3 * near;
      if (!best || score > best.score) best = { lvl: L, shot: S, score, why: near ? [...r.why, "like another"] : r.why, k };
    }
    if (process.env.LOG) console.error(`try ${k}: ${shots.length} shots, best ${best ? r2(best.score) + " " + best.why.join("; ") : "-"}`);
  }
  return best;
}

// ---------- the first three chapters' layouts ----------
// the world of the first chapters (columbiad-levels.js): a large Earth, a Moon of any size and place, the ring past it, behind it, or a gate
// beside it and a ring at home
const EARTH = { id: "earth", mu: 34, r: 4.2 };
const CORE = { barrels: 16, dial: [2.0, 4.4], dt: 1 / 60, tMax: 30, bounds: 40, site: 90, goal: { type: "hit" }, scatter: { v: 0.002, deg: 0.15 }, cone: { len: 12 }, par: 1,
  frame: [-3.9, 2.9, 3.9, 12.8], band: { lean: 60, charge: [0.5, 16] } };
const S2 = { scatter: { v: 0.003, deg: 0.2 } };
const SITES = [60, 75, 90, 105, 120];
/** A random layout of chapter `ch`'s kind, its ring (or home ring) of radius r. */
function layout(ch, r, R) {
  const mr = r2(0.9 + 0.8 * R()), mu = r2(4.3 * mr * mr * (0.85 + 0.3 * R())), site = SITES[Math.floor(R() * SITES.length)];
  const mx = r2(-2.4 + 4.8 * R()), my = r2(6.4 + 2.6 * R()), M = { id: "moon", at: [mx, my], mu, r: mr };
  const base = { ...CORE, ...(ch > 1 ? S2 : {}), id: `${ch}-new`, name: "New", site, bodies: [EARTH, M] };
  if (ch === 1) {
    const a = (20 + 140 * R()) * Math.PI / 180, d = mr + 1 + 2.2 * R();
    return { ...base, target: { at: [r2(mx + d * Math.cos(a)), r2(my + d * Math.sin(a))], r } };
  }
  const pad = padAt({ ...base, target: { at: [0, 12], r } }, 0);
  if (ch === 2) {
    const ux = mx - pad[0], uy = my - pad[1], L = Math.hypot(ux, uy), d = mr + 0.6 + 1.4 * R(), side = (R() - 0.5) * 1.2 * mr;
    return { ...base, target: { at: [r2(mx + ux / L * d - uy / L * side), r2(my + uy / L * d + ux / L * side)], r } };
  }
  const a = R() * 2 * Math.PI, d = mr + 0.5 + 0.8 * R();
  return { ...base, tMax: 40, cone: { len: 7 + Math.floor(3 * R()) }, goal: { type: "return", via: "Moon" },
    gates: [{ at: [r2(mx + d * Math.cos(a)), r2(my + d * Math.sin(a))], r: r2(0.55 + 0.1 * R()) }, { at: [0, 4.2], r }] };
}
/** Whether a layout sits on the aim view (the ring and the Moon inside the frame, the ring clear of the Moon and of the Earth). */
function fits(l) {
  const M = l.bodies[1], rings = l.gates || [l.target];
  return rings.every(g => Math.abs(g.at[0]) < 3.5 && g.at[1] < 12.3 && (g.at[1] === 4.2 && g.at[0] === 0 || Math.hypot(g.at[0] - M.at[0], g.at[1] - M.at[1]) > M.r + g.r + 0.15) && (g.at[1] === 4.2 && g.at[0] === 0 || Math.hypot(...g.at) > 4.2 + g.r + 0.6));
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === "core") {
  const [ch, rLo, rHi, sLo, sHi, tries = 60, seed = 1] = rest.map(Number);
  let fit = 0, judged = 0;
  let rs = seed * 104729 + 7, n = 0;
  const R = () => uniform(rs, n++);
  for (let k = 0; k < tries; k++) {
    const r = r2(rLo + (rHi - rLo) * R()), l = { ...layout(ch, r, R) };
    if (!fits(l)) continue;
    fit++;
    if (l.gates) l.target = l.gates[l.gates.length - 1];
    const j = judge(l);
    if (!j || j.straight > 0 || j.size < sLo || j.size > sHi) continue;
    const { target, ...keep } = l;
    judged++;
    console.log(JSON.stringify({ size: j.size, luck: j.luck, best: { angle: j.best.angle, charge: j.best.charge }, site: l.site, moon: l.bodies[1], ...(l.gates ? { gates: l.gates, cone: l.cone } : { target: l.target }) }));
  }
  console.error(`${fit} of ${tries} layouts fit the view, ${judged} kept`);
} else if (mode === "judge") {
  const [file, part = "0/1"] = rest, [p, of] = part.split("/").map(Number), list = (await import(file)).default;
  for (const l of list) if (l.gates) l.target = l.gates[l.gates.length - 1];
  list.forEach((l, i) => {
    if (i % of !== p) return;
    const t0 = Date.now(), j = judge(l), bad = validate(l);
    console.log(`${l.id} ${l.name}: ${j ? `size ${j.size} (window ${j.best.win.da} x ${j.best.win.dc}${isMoving(l) ? ` x ${r2(j.best.size / j.best.win.da / j.best.win.dc)} s` : ""}), luck ${j.luck}%, straight ${(j.straight * 100).toFixed(1)}%, best ${j.best.angle}/${j.best.charge}/${j.best.t}` : bad.length ? bad.join("; ") : "no robust shot"} [${((Date.now() - t0) / 1000).toFixed(0)} s]`);
  });
}
