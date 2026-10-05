// Blend: every level has a passing blend and a par; the blending maths behaves (index blending punishes a little
// of the wrong thing); hints lead a bad blend to a passing one.
const B = await import("../blend-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const pars = [];
for (const L of B.LEVELS) {
  const s = B.solve(L);
  if (!s) { bad++; console.log("no passing blend on level", L.id); continue; }
  pars.push(`${L.id}: €${s.margin.toFixed(0)}`);
  for (const c of L.components) if (!B.COMPONENTS[c]) { bad++; console.log("unknown component", c); }
  const props = B.blendProps(L.components, s.pct);
  for (const p of B.PRODUCTS[L.product].order) if (props[p] == null) { bad++; console.log("level", L.id, "has no value for", p); }
}
check(bad === 0, `every level has a passing blend (par ${pars.join(", ")} €/m³)`);
// index blending: 5% of slops takes a diesel's flash point from 66 to the low 50s; 5% kerosene barely moves cetane
const d = B.blendProps(["ulsd", "slops"], [95, 5]);
check(d.flash < 55 && d.flash > 40, `5% slops at a flash point of 24 takes straight-run diesel from 66 to ${d.flash.toFixed(0)} °C`);
const w = B.blendProps(["ulsd", "kero"], [80, 20]);
check(w.cfpp < -9 && w.cfpp > -25 && w.flash < 56, `20% kerosene takes CFPP from −6 to ${w.cfpp.toFixed(0)} and flash point to ${w.flash.toFixed(0)}`);
const e = B.blendProps(["eurobob", "ethanol"], [90, 10]);
check(e.rvp > 58 && e.oxy > 3.4 && e.oxy <= 3.7, `10% ethanol: vapour pressure ${e.rvp.toFixed(0)} kPa, oxygen ${e.oxy.toFixed(2)}%`);
const lub = B.blendProps(["ulsd", "rme"], [98, 2]);
check(lub.lub <= 460, `2% RME brings lubricity to ${lub.lub.toFixed(0)} µm`);
// hints: from all base, following hints reaches a passing blend on every level within forty moves
let stuck = 0;
for (const L of B.LEVELS) {
  const pct = L.components.map((c, i) => (i === 0 ? 100 : 0));
  let passed = B.judge(L.product, B.blendProps(L.components, pct)).every(x => x.ok);
  for (let k = 0; k < 40 && !passed; k++) {
    const h = B.hint(L, pct);
    if (!h) break;
    pct[L.components.indexOf(h.up)] += B.STEP; pct[L.components.indexOf(h.down)] -= B.STEP;
    passed = B.judge(L.product, B.blendProps(L.components, pct)).every(x => x.ok);
  }
  if (!passed) { stuck++; console.log("  hints don't reach a passing blend on level", L.id, pct); }
}
check(stuck === 0, "following hints from a single-component blend reaches a passing blend on every level");
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
