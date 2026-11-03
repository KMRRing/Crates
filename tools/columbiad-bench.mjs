// Columbiad's bench: the design doc's solution measures on a fine grid, level by level. Not run by CI (a level's grid is some
// ninety thousand shots; the tests use small samples and the stored winning shots in columbiad-proofs.js).
//   node tools/columbiad-bench.mjs                 every level, grid 1 degree x 0.1 barrel
//   node tools/columbiad-bench.mjs fine            grid 0.5 degree x 0.05 barrel
//   node tools/columbiad-bench.mjs 1-3 1-4         only these levels
//   node tools/columbiad-bench.mjs write           also rewrite columbiad-proofs.js with each level's best robust shot (and the best of another family)
// Measures (the design doc): the share of moves that win (aim for 0.2% to 5%), the families they fall in (at least 2 where the
// level allows it), and the robustness of the best solutions (50 scattered runs each; 70% to 90% is fair, nearer 100% is easy).
// The blind bot fires random shots, the careful bot the most robust solution it finds: the gap is what thinking is worth.
import { writeFileSync } from "node:fs";
import { LEVELS } from "../columbiad-levels.js";
import { sweep, survey, blindRate, robustness, families } from "../columbiad-bots.js";
import { validate, shoot } from "../columbiad-engine.js";

const args = process.argv.slice(2), fine = args.includes("fine"), write = args.includes("write");
const only = args.filter(a => /^\d+-\d+$/.test(a));
const da = fine ? 0.5 : 1, dc = fine ? 0.05 : 0.1;
const proofs = {};
const rows = [];
for (const lvl of LEVELS) {
  if (only.length && !only.includes(lvl.id)) continue;
  const t0 = performance.now(), bad = validate(lvl);
  const sw = sweep(lvl, da, dc), sv = survey(lvl, { sw, runs: 50, per: 12 });
  const fams = families(sw).filter(f => f.size >= 3);
  // the best of each family, judged on 200 runs; among equals the one passing deepest in the ring
  const top = [];
  for (const fi of [...new Set(sv.picks.map(p => p.family))].slice(0, 3)) {
    let best = null;
    for (const c of sv.picks.filter(p => p.family === fi).slice(0, 8)) {
      const rob = robustness(lvl, c, 200, 31), core = shoot(lvl, c, [0, 0]).core;
      if (!best || rob > best.rob + 0.01 || (rob >= best.rob - 0.01 && core < best.core)) best = { angle: c.angle, charge: c.charge, t: 0, rob, core };
    }
    if (best) top.push(best);
  }
  top.sort((a, b) => b.rob - a.rob);
  const best = top[0];
  const blind = blindRate(lvl, 2000);
  const w = shoot(lvl, best, [0, 0], { watch: true });
  const margin = Math.round((1 - w.core) * 100) / 100;
  proofs[lvl.id] = top.slice(0, 2).map((p, k) => ({ angle: p.angle, charge: p.charge, t: 0, rob: Math.round(p.rob * 100) / 100, margin: k === 0 ? margin : Math.round((1 - shoot(lvl, p, [0, 0]).core) * 100) / 100 }));
  const row = { id: lvl.id, name: lvl.name, fraction: sv.fraction, families: fams.length, sizes: fams.slice(0, 4).map(f => f.size).join("/"), best: best.rob, blind, careful: best.rob > 0 ? 1 / best.rob : Infinity, ms: performance.now() - t0, bad };
  rows.push(row);
  console.log(`${lvl.id} ${lvl.name.padEnd(20)} wins ${(row.fraction * 100).toFixed(2).padStart(5)}%  families ${row.families} (${row.sizes})  best ${best.angle}/${best.charge} robust ${(best.rob * 100).toFixed(0)}%  blind ${(blind * 100).toFixed(1)}% a shot (${(1 / Math.max(blind, 1e-4)).toFixed(0)} shots)  careful ${(1 / best.rob).toFixed(2)} shots  margin ${margin}  ${row.bad.join("; ")} [${(row.ms / 1000).toFixed(1)} s]`);
}
if (write) {
  const body = Object.entries(proofs).map(([id, list]) => `  "${id}": [${list.map(p => `{ angle: ${p.angle}, charge: ${p.charge}, t: 0, rob: ${p.rob}, margin: ${p.margin} }`).join(", ")}],`).join("\n");
  writeFileSync(new URL("../columbiad-proofs.js", import.meta.url), `// The shots each level was proved solvable by (tools/columbiad-bench.mjs write): the most robust the bench found, with the share
// of 200 scattered runs that won ("rob") and how far inside the ring it passes at no scatter ("margin": 1 is the middle, 0 the edge).
// tests/columbiad.mjs fires every one and it must still win: a change to the rules or a level that breaks one is caught there.
export const PROOFS = {\n${body}\n};\n`);
  console.log("wrote columbiad-proofs.js");
}
