// The supply-and-demand diagrams draw what their questions say: a shifted curve (S′, D′) is its original moved, parallel,
// not turned (its slope the same to within 1%); and in a supply-and-demand diagram every equilibrium dot sits on a
// crossing of two of the curves drawn.
import fs from "fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const items = [];
for (const f of fs.readdirSync(new URL("../kb/items/choice", import.meta.url))) items.push(...((await import(`../kb/items/choice/${f}`)).ITEMS || []).filter(i => i.svg));
const curves = svg => { const texts = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)"[^>]*>([^<]+)<\/text>/g)].map(m => ({ x: +m[1], y: +m[2], t: m[3] }));
  return [...svg.matchAll(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"[^>]*stroke-width="2\.2"[^>]*\/>/g)].map(m => { const [x1, y1, x2, y2] = m.slice(1, 5).map(Number);
    const lab = texts.reduce((b, t) => (Math.hypot(t.x - x2, t.y - y2) < Math.hypot(b.x - x2, b.y - y2) ? t : b)).t; return { lab, x1, y1, x2, y2, k: (y2 - y1) / (x2 - x1) }; }); };
const on = (c, x, y) => Math.abs(c.y1 + c.k * (x - c.x1) - y) < 2;
let shifts = 0, dots = 0; const turned = [], adrift = [];
for (const q of items) {
  const cs = curves(q.svg);
  for (const c of cs.filter(c => /′$/.test(c.lab))) { const o = cs.find(d => d.lab === c.lab.slice(0, -1)); if (!o) continue; shifts++; if (Math.abs(c.k - o.k) > 0.01 * Math.abs(o.k)) turned.push(`${q.id} ${c.lab}`); }
  // only in a supply-and-demand diagram is a dot an equilibrium (on a frontier, a dot marks a point on one curve)
  if (cs.some(c => c.lab === "S") && cs.some(c => c.lab === "D")) for (const m of q.svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)) { const [x, y] = [+m[1], +m[2]]; dots++; if (cs.filter(c => on(c, x, y)).length < 2) adrift.push(`${q.id} (${x}, ${y})`); }
}
check(!turned.length, `${shifts} shifted curves move parallel to their originals${turned.length ? `; turned: ${turned.join(", ")}` : ""}`);
check(!adrift.length, `${dots} equilibrium dots sit where two curves cross${adrift.length ? `; off: ${adrift.join(", ")}` : ""}`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
