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
import { periodOf, descend, cost, robustness, windowOf, timeWindow, hasMoon, withoutPull } from "./columbiad-bots.js";
import { validate, shoot, uniform, padAt, ringAt, isMoving, DELAY_MAX, BARRELS } from "./columbiad-engine.js";

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
