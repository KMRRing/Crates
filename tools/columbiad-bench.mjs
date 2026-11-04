// Columbiad's bench: the design doc's solution measures on a fine grid, level by level. Not run by CI (a level's grid is some
// ninety thousand shots, a moving world's many more; the tests use small samples and the stored winning shots in columbiad-proofs.js).
//   node tools/columbiad-bench.mjs                 every level, grid 1 degree x 0.1 barrel (2 x 0.1 and 20 times of the period where the world moves)
//   node tools/columbiad-bench.mjs fine            grid 0.5 degree x 0.05 barrel, 40 times
//   node tools/columbiad-bench.mjs 1-3 3-1         only these levels
//   node tools/columbiad-bench.mjs find 3-1        also look for winning shots by walking downhill from the best cells (what finds a narrow window)
//   node tools/columbiad-bench.mjs write           also rewrite columbiad-proofs.js with each level's best robust shots (the stored ones of a level not run are kept)
// Measures (the design doc): the share of moves that win (aim for 0.2% to 5%; for a level with a `band`, of the band's moves), the
// families they fall in (at least 2 where the level allows it), and the robustness of the best solutions (50 scattered runs each;
// 70% to 90% is fair, nearer 100% is easy). For a moving world, how long a firing time may drift before the best shot stops winning
// (`window`, seconds: under half a second is a thumb's luck). The blind bot fires random shots, the careful bot the most robust
// solution it finds: the gap is what thinking is worth.
import { writeFileSync } from "node:fs";
import { LEVELS } from "../columbiad-levels.js";
import { PROOFS } from "../columbiad-proofs.js";
import { sweep, survey, blindRate, robustness, families, findShots, descend, timeWindow, periodOf, windowOf } from "../columbiad-bots.js";
import { validate, shoot } from "../columbiad-engine.js";

const args = process.argv.slice(2), fine = args.includes("fine"), write = args.includes("write"), look = args.includes("find");
const only = args.filter(a => /^\d+-\d+$/.test(a));
const da = fine ? 0.5 : 2, dc = fine ? 0.05 : 0.1, round = (v, n = 100) => Math.round(v * n) / n;
const proofs = { ...PROOFS };
for (const lvl of LEVELS) {
  if (only.length && !only.includes(lvl.id)) continue;
  const t0 = performance.now(), bad = validate(lvl), P = periodOf(lvl), nt = P ? (fine ? 40 : 20) : 0;
  // Earth-only levels are swept at the old grid (1 degree, 0.1 barrel), a Moon's at the coarser one, since its band is narrow and its flights long
  const g = lvl.grid ? lvl.grid : lvl.band ? { da, dc } : { da: fine ? 0.5 : 1, dc: fine ? 0.05 : 0.1 };
  const sw = sweep(lvl, g.da, g.dc, nt), sv = survey(lvl, { ...g, nt, sw, runs: 50, per: 12 });
  const fams = families(sw).filter(f => f.size >= 3);
  let cands = sv.picks.slice(0, 14).map(p => ({ angle: p.angle, charge: p.charge, t: p.t || 0 }));
  if (look || P) cands = cands.concat(findShots(lvl, { da: lvl.grid ? g.da : Math.max(g.da, 2), dc: lvl.grid ? g.dc : Math.max(g.dc, 0.1), dt: 0.5, starts: 8, runs: 20 }).picks.slice(0, 8).map(p => ({ angle: p.angle, charge: p.charge, t: p.t })));
  // each candidate walked to the deepest place of its ring, then judged on 200 runs
  const judged = [];
  for (const c of cands) {
    const d = descend(lvl, c, { steps: [0.5, 0.05, 0.2], floor: [0.05, 0.01, 0.01] });
    if (d.cost >= 0) continue;
    if (judged.some(j => Math.abs(j.angle - d.angle) < 0.3 && Math.abs(j.charge - d.charge) < 0.03 && Math.abs(j.t - d.t) < 0.1)) continue;
    judged.push({ angle: d.angle, charge: d.charge, t: d.t, rob: robustness(lvl, d, 200, 31), margin: round(-d.cost) });
  }
  judged.sort((a, b) => b.rob - a.rob || b.margin - a.margin);
  // the best, and the best of another family (an angle 3 degrees away, or another charge by 0.3 barrel, or another time by a window)
  const top = [];
  for (const j of judged) { if (top.length >= 2) break; if (top.every(p => Math.abs(p.angle - j.angle) > 3 || Math.abs(p.charge - j.charge) > 0.3 || (P && Math.min(Math.abs(p.t - j.t), P - Math.abs(p.t - j.t)) > 4))) top.push(j); }
  const best = top[0];
  if (!best) { console.log(`${lvl.id} ${lvl.name.padEnd(20)} NO SOLUTION FOUND  ${bad.join("; ")}`); continue; }
  const blind = blindRate(lvl, 2000), win = P ? timeWindow(lvl, best) : null;
  proofs[lvl.id] = top.map(p => ({ angle: p.angle, charge: p.charge, t: p.t, rob: round(p.rob), margin: p.margin, win: windowOf(lvl, p) }));
  const wnd = win ? `  window ${win.width.toFixed(2)} s` : "";
  console.log(`${lvl.id} ${lvl.name.padEnd(20)} wins ${(sv.fraction * 100).toFixed(2).padStart(5)}%  families ${fams.length} (${fams.slice(0, 4).map(f => f.size).join("/")})  best ${best.angle}/${best.charge}/${best.t} robust ${(best.rob * 100).toFixed(0)}%  blind ${(blind * 100).toFixed(1)}% a shot (${(1 / Math.max(blind, 1e-4)).toFixed(0)} shots)  careful ${(1 / best.rob).toFixed(2)} shots  margin ${best.margin}${wnd}  ${bad.join("; ")} [${((performance.now() - t0) / 1000).toFixed(1)} s]`);
}
if (write) {
  const body = LEVELS.filter(l => proofs[l.id]).map(l => `  "${l.id}": [${proofs[l.id].map(p => `{ angle: ${p.angle}, charge: ${p.charge}, t: ${p.t}, rob: ${p.rob}, margin: ${p.margin}, win: ${JSON.stringify(p.win || null)} }`).join(", ")}],`).join("\n");
  writeFileSync(new URL("../columbiad-proofs.js", import.meta.url), `// The shots each level was proved solvable by (tools/columbiad-bench.mjs write): the most robust the bench found, with the share
// of 200 scattered runs that won ("rob"), how far inside the ring it passes at no scatter ("margin": 1 is the middle, 0 the edge) and the window of angles and powers it sits in ("win").
// t is the firing time (a moving world's clock; 0 where nothing moves). tests/columbiad.mjs fires every one and it must still win: a
// change to the rules or a level that breaks one is caught there.
export const PROOFS = {\n${body}\n};\n`);
  console.log("wrote columbiad-proofs.js");
}
