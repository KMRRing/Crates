// Columbiad's level finder: for each level (by id, or all), looks for winning shots by random sampling of the aim (angle, power and, where the world
// moves, the launch time) and walking the best downhill, then judges what it finds. Not run by CI (the tests replay the stored shots).
//   node tools/columbiad-find.mjs 5-1 5-2            report only
//   node tools/columbiad-find.mjs write 5-1 5-2      also store the shots in columbiad-proofs.js (the stored ones of a level not run are kept)
//   node tools/columbiad-find.mjs chapter 5          every level of a chapter
//   node tools/columbiad-find.mjs all write          everything (slow)
//   options: n=3000 (random samples), seed=1
// Reports for each level: the share of random samples that win ("luck"), the best shots' windows (angle degrees, power units, and seconds of launch time
// where the world moves: the difficulty is the size of that window), how many straight shots at the first ring win (must be 0 unless the level is `open`). On a level with a Moon only shots that lose with the Moon's pull zeroed are kept.
import { writeFileSync } from "node:fs";
import { LEVELS } from "../columbiad-levels.js";
import { periodOf, descend, cost, robustness, windowOf, timeWindow, hasMoon, withoutPull } from "../columbiad-bots.js";
import { validate, shoot, uniform, padAt, ringAt, isMoving, DELAY_MAX, BARRELS } from "../columbiad-engine.js";

const args = process.argv.slice(2), write = args.includes("write"), all = args.includes("all");
const opt = (k, d) => { const a = args.find(x => x.startsWith(k + "=")); return a ? +a.split("=")[1] : d; };
const N = opt("n", 3000), SEED = opt("seed", 1), chapter = opt("chapter", 0) || (args.includes("chapter") ? +args[args.indexOf("chapter") + 1] : 0);
const ids = args.filter(a => /^\d+-\d+$/.test(a));
const r2 = v => Math.round(v * 100) / 100;
const mine = {}, mineStraight = {};
const rnd = k => uniform(SEED * 7919 + 13, k);

/** How many shots aimed straight at the first ring (a few degrees either way, every power, and a spread of launch times where it moves) win. */
export function straightWins(lvl, powerStep = 0.25, angStep = 0.5, nt = 6) {
  if (lvl.goal?.type === "orbit") return { wins: 0, tried: 1 };                    // an orbit has no ring to aim at
  const first = (lvl.gates || [lvl.target])[0], cap = lvl.barrels ?? BARRELS, moving = isMoving(lvl), tm = Math.min(lvl.delayMax ?? DELAY_MAX, 10);
  const times = moving ? Array.from({ length: nt }, (_, k) => r2(k * tm / nt)) : [0];
  let wins = 0, tried = 0;
  for (const t of times) {
    const pad = padAt(lvl, t), p = ringAt(lvl, first, t), b = Math.atan2(p[1] - pad[1], p[0] - pad[0]) * 180 / Math.PI;
    for (let c = 0.5; c <= cap + 1e-9; c += powerStep) for (let o = -2.5; o <= 2.5 + 1e-9; o += angStep) { tried++; if (shoot(lvl, { angle: b + o, charge: c, t }, [0, 0], { watch: false }).won) wins++; }
  }
  return { wins, tried };
}

const picked = LEVELS.filter(l => all || (ids.length ? ids.includes(l.id) : chapter ? l.id.startsWith(chapter + "-") : false));
if (!picked.length) { console.log("no level chosen"); process.exit(0); }
for (const lvl of picked) {
  const t0 = performance.now(), bad = validate(lvl), P = periodOf(lvl), moving = isMoving(lvl), cap = lvl.barrels ?? BARRELS, site = lvl.site ?? 90;
  const tm = moving ? Math.min(lvl.delayMax ?? DELAY_MAX, P || 10) : 0, band = lvl.band || {}, lean = band.lean ?? 90, [lo, hi] = band.charge || [0.5, cap];
  const cells = [], moony = hasMoon(lvl), dry = moony ? withoutPull(lvl) : lvl;
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
    if (starts.length >= 16) break;
    if (starts.every(s => Math.abs(s.angle - c.angle) > 4 || Math.abs(s.charge - c.charge) > 0.5 || (moving && Math.abs(s.t - c.t) > 1))) starts.push(c);
  }
  const found = [];
  for (const s of starts) {
    const d0 = descend(lvl, s, { steps: [1, 0.1, 0.4], floor: [0.05, 0.01, 0.1] });
    if (d0.cost >= 0) continue;
    const d = { ...d0, t: moving ? r2(Math.round(d0.t * 10) / 10) : d0.t };               // the countdown is kept in tenths of a second (clampAim): store a shot the game can fly
    if (moving && !shoot(lvl, d, [0, 0], { watch: false }).won) continue;
    if (moony && shoot(dry, { angle: d.angle, charge: d.charge, t: d.t }, [0, 0], { watch: false }).won) continue;   // a shot that wins with the Moon's pull zeroed does not use the Moon (5 November 2026, Korbi)
    if (found.some(f => Math.abs(f.angle - d.angle) < 0.3 && Math.abs(f.charge - d.charge) < 0.03 && Math.abs(f.t - d.t) < 0.2)) continue;
    const f = { angle: d.angle, charge: d.charge, t: d.t, margin: r2(-d.cost), rob: robustness(lvl, d, 100, 31) };
    const w = windowOf(lvl, f), tw0 = moving ? timeWindow(lvl, f, 0.1, 6).width : 6;
    found.push({ ...f, size: w.da * w.dc * Math.min(tw0, 6) });                         // how big a window a thumb has to find
  }
  found.sort((a, b) => (b.rob >= 0.9) - (a.rob >= 0.9) || b.size - a.size || b.rob - a.rob);   // the roomiest of the robust ones first
  const top = [];
  for (const j of found) { if (top.length >= 2) break; if (top.every(p => Math.abs(p.angle - j.angle) > 3 || Math.abs(p.charge - j.charge) > 0.3 || (moving && Math.abs(p.t - j.t) > 1.5))) top.push(j); }
  if (!top.length) { console.log(`${lvl.id} ${lvl.name.padEnd(22)} NO SOLUTION  luck ${(wins / N * 100).toFixed(2)}%  best cost ${cells[0].c.toFixed(2)} at ${cells[0].angle}/${cells[0].charge}/${cells[0].t}  ${bad.join("; ")}`); continue; }
  const best = top[0], win = windowOf(lvl, best), tw = moving ? timeWindow(lvl, best, 0.1, 6) : null, st = straightWins(lvl);
  mine[lvl.id] = top.map(p => ({ angle: p.angle, charge: p.charge, t: p.t, rob: r2(p.rob), margin: p.margin, win: windowOf(lvl, p), ...(moving ? { tw: r2(timeWindow(lvl, p, 0.1, 6).width) } : {}) }));
  mineStraight[lvl.id] = Math.round(st.wins / st.tried * 1000) / 10;
  console.log(`${lvl.id} ${lvl.name.padEnd(22)} luck ${(wins / N * 100).toFixed(2).padStart(5)}%  best ${best.angle}/${best.charge}/${best.t} rob ${(best.rob * 100).toFixed(0)}%  window ${win.da}° x ${win.dc}${tw ? ` x ${tw.width.toFixed(2)} s` : ""}  families ${top.length}  straight ${(st.wins / st.tried * 100).toFixed(1)}%  ${bad.join("; ")} [${((performance.now() - t0) / 1000).toFixed(1)} s]`);
}
if (write) {
  // merge into what the file holds now (another run may have written since this one began)
  const cur = await import(`../columbiad-proofs.js?x=${Date.now()}`), proofs = { ...cur.PROOFS, ...mine }, straight = { ...cur.STRAIGHT, ...mineStraight };
  const key = id => id.split("-").map(Number);
  const order = Object.keys(proofs).sort((a, b) => { const [x, y] = key(a), [p, q] = key(b); return x - p || y - q; });
  const line = id => `  "${id}": [${proofs[id].map(p => `{ angle: ${p.angle}, charge: ${p.charge}, t: ${p.t}, rob: ${p.rob}, margin: ${p.margin}, win: ${JSON.stringify(p.win || null)}${p.tw !== undefined ? `, tw: ${p.tw}` : ""} }`).join(", ")}],`;
  writeFileSync(new URL("../columbiad-proofs.js", import.meta.url), `// The shots each level was proved solvable by (tools/columbiad-find.mjs write): the most robust the finder found, with the share
// of 100 scattered runs that won ("rob"), how far inside the ring it passes at no scatter ("margin": 1 is the middle, 0 the edge), the window of angles and
// powers it sits in ("win") and, where the world moves, how many seconds of launch time it may drift ("tw"). t is the launch countdown (0 where nothing
// moves). tests/columbiad.mjs fires every one and it must still win: a change to the rules or a level that breaks one is caught there.
export const PROOFS = {\n${order.filter(id => LEVELS.some(l => l.id === id)).map(line).join("\n")}\n};
// The share (per cent) of the straight shots at the first ring (a few degrees either way, every power, a spread of launch times) that won, when the finder last ran: 0 for
// every level except one marked \`open\` (a first meeting with an idea, where the straight way is allowed).
export const STRAIGHT = ${JSON.stringify(Object.fromEntries(order.filter(id => LEVELS.some(l => l.id === id)).map(id => [id, straight[id] ?? 0])))};
`);
  console.log("wrote columbiad-proofs.js");
}
