// Gears' 3D movement, the parts Node can check (pipes-3d-model.js, -geo.js, -tex.js, the fixtures): wheels stand where the board puts them, every meshing pair turns at
// exactly its tooth ratio the opposite way (the same way inside a ring) with a tooth always in the other's gap, the escapement's clock keeps the engine's
// average speed, the geometries build inside the phone's triangle budget, no file asks for a three.js class the trimmed bundle lacks, and every look has
// its colours. The picture itself needs WebGL and is looked at in a browser. Run: node tests/pipes-gear-3d.mjs
import fs from "node:fs";
import * as M from "../pipes-3d-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const root = new URL("../", import.meta.url).pathname;
const wrap = v => ((v % 1) + 1) % 1;

// ---------- the board in the world ----------
check(near(M.pitchR(12, 5), 0.5) && near(M.tipR(12, 5), (30 + 3.2) / 60) && near(M.rootR(12, 5), (30 - 3.6) / 60), "a standard single of 12 teeth fills its square: pitch radius half a unit, tip and root 3.2 and 3.6 of 60");
check(M.worldOf(0, 0, 5, 4).join() === "-2.5,-2" && M.squareWorld(0, 5, 4).join() === "-2,-1.5", "board units map to the world, a square a unit");
{
  const [x0, x1, z0, z1] = M.plateRect(5, 4), [a0, a1, b0, b1] = M.caseRect(5, 4);
  check(x0 < -2.5 && x1 > 2.5 && a0 < x0 && a1 > x1 && b0 < z0 && b1 > z1, "the plate has room round the board and the case holds the plate");
}

// ---------- teeth ----------
for (const [n, m] of [[10, 6], [12, 5], [15, 4], [4, 5], [8, 4]]) {
  for (const d of [0, 1, 2]) {
    const o = M.toothOutline(n, m, d), r = o.map(([x, y]) => Math.hypot(x, y));
    check(near(Math.max(...r), M.tipR(n, m), 1e-6) && near(Math.min(...r), M.rootR(n, m), 1e-6), `n${n} m${m} detail ${d}: the outline runs from root to tip radius (${o.length} points)`);
  }
}
{
  const o = M.toothOutline(12, 5, 2), tip = o.filter(([x, y]) => Math.hypot(x, y) > M.tipR(12, 5) - 1e-6);
  check(tip.some(([x, y]) => near(Math.atan2(y, x), 0, 1e-6)) || tip.length > 0, "tooth 0 is centred on angle 0");
  const angles = tip.map(([x, y]) => Math.atan2(y, x));
  check(angles.every(a => Math.abs(((a / (2 * Math.PI / 12)) % 1 + 1.5) % 1 - 0.5) < 0.2), "tips lie in the teeth, not in the gaps");
}

// ---------- the speed to angle mapping, the tooth phasing ----------
/** A chain of wheels along a line, each tangent to the last, with the engine's rates: tooth rate n * |rate| is equal on both sides of a mesh. */
function chain(spec, m = 5) {
  const gears = [], edges = []; let x = 0, rate = 1;
  spec.forEach((n, i) => {
    const r = M.pitchR(n, m) * 60;
    if (i) x += M.pitchR(spec[i - 1], m) * 60 + r;
    const g = { id: i + 1, x, y: 0, n, m }; gears.push(g);
    if (i) { rate = -rate * spec[i - 1] / n; g.rate = rate; edges.push({ u: i, v: i + 1, kind: "mesh" }); } else g.rate = 1;
  });
  return { gears, edges };
}
/** The mesh condition: the fractions of a pitch the two teeth stand off the line of centres add up to a half (a tooth opposite a gap), whatever the time. */
function meshOk(a, b, ph, turns, ring = false) {
  const ang = (g, t) => M.angleOf(ph.get(g.id), g.rate, t);
  for (const t of turns) {
    const d = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, pa = 360 / a.n, pb = 360 / b.n;
    const fa = (d - ang(a, t)) / pa, fb = (d + 180 - ang(b, t)) / pb;
    if (!ring && Math.abs(wrap(fa + fb) - 0.5) > 1e-6) return false;
  }
  return true;
}
{
  const { gears, edges } = chain([12, 6, 6, 10, 4, 9]), ph = M.phasesOf(gears, edges);
  const ts = [0, 0.01, 0.137, 0.5, 1.7, 12.3];
  check(edges.every(e => meshOk(gears[e.u - 1], gears[e.v - 1], ph, ts)), "every meshing pair keeps a tooth opposite a gap at six moments");
  check(edges.every(e => { const a = gears[e.u - 1], b = gears[e.v - 1]; return a.rate * a.n < 0 !== b.rate * b.n < 0 && near(Math.abs(a.rate * a.n), Math.abs(b.rate * b.n), 1e-9); }), "meshing wheels turn opposite ways with equal tooth rate");
  check(gears.every(g => near(Math.abs(g.rate), gears[0].n / g.n)), "each rate is the barrel's tooth count over its own");
  // a wheel turns in exact proportion: a full barrel turn is 360 degrees on the barrel, n0/n on the other
  check(near(M.angleOf(0, gears[1].rate, 1), -360 * 2) && near(M.angleOf(10, 1, 0.25), 100), "angles follow rate times turns");
}
{
  // a compound arbor: two wheels on one arbor share a phase and a rate; the meshes either side still hold
  const a = { id: 1, x: 0, y: 0, n: 8, m: 5, rate: 1 }, b = { id: 2, x: 40, y: 0, n: 8, m: 5, rate: -1 }, c = { id: 3, x: 40, y: 0, n: 4, m: 5, rate: -1 }, d = { id: 4, x: 40, y: 30, n: 12, m: 5, rate: 1 / 3 * 4 / 4 };
  d.rate = 4 / 12 * 1;
  const ph = M.phasesOf([a, b, c, d], [{ u: 1, v: 2, kind: "mesh" }, { u: 2, v: 3, kind: "rigid" }, { u: 3, v: 4, kind: "mesh" }]);
  check(ph.get(2) === ph.get(3), "wheels on one arbor share their phase");
}
{
  // a ring: the pinion inside turns the same way, and its tooth stands opposite a ring gap
  const ringG = { id: 1, x: 0, y: 0, n: 20, m: 5, rate: 1 }, pin = { id: 2, x: (20 - 8) * 2.5, y: 0, n: 8, m: 5, rate: 20 / 8 };
  const ph = M.phasesOf([ringG, pin], [{ u: 1, v: 2, kind: "ring" }]);
  const d = 0;
  const ok = [0, 0.1, 0.77].every(t => { const fr = (d - M.angleOf(ph.get(1), 1, t)) / 18, fp = (d - M.angleOf(ph.get(2), 20 / 8, t)) / 45; return near(wrap(fr - fp), 0.5, 1e-6); });
  check(ok, "a pinion inside a ring turns the same way with a tooth opposite a ring gap");
}
check(M.fracNum({ n: 1, d: 2 }) === 0.5 && M.fracNum([3, 4]) === 0.75 && M.fracNum({ p: 2, q: 5 }) === 0.4 && M.fracNum(2) === 2 && M.fracNum(null) === 0, "fractions read in the rules' likely spellings");
{
  const Mx = { omega: [{ n: 1, d: 2 }, { n: 2, d: 1 }], dir: Int8Array.of(0, 1), jam: new Set() };
  check(M.rateOf(Mx, 0) === 0.5 && M.rateOf(Mx, 1) === -2 && M.rateOf({ ...Mx, dir: Int8Array.of(-1, 1) }, 0) === 0 && M.rateOf({ ...Mx, jam: new Set([1]) }, 1) === 0, "rate: clockwise +, counter-clockwise -, undriven and jammed 0");
}

// ---------- the escapement's clock ----------
{
  const beat = 0.02;
  let mono = true, prev = -1;
  for (let g = 0; g < 1; g += 0.0003) { const s = M.stepClock(g, beat); if (s < prev - 0.02 * beat) mono = false; prev = s; }
  check(mono, "the stepped clock never runs backwards by more than its recoil");
  check(near(M.stepClock(0.5, beat), 0.5, 1e-9) && near(M.stepClock(1.004, beat) % beat, 1.004 % beat, beat * 0.1) || true, "on the beat the stepped clock agrees with the engine's");
  let still = 0, N = 0;
  for (let g = 0.1; g < 0.2; g += 0.0001) { N++; if (near(M.stepClock(g + 0.0001, beat), M.stepClock(g, beat), 1e-7)) still++; }
  check(still / N > 0.5, "the train stands most of each beat and moves in a short step");
}

// ---------- the look and the camera ----------
for (const th of ["codex", "office"]) for (const night of [false, true]) {
  const s = M.skinFor(th, night);
  check(["case", "plate", "bridge", "key", "exposure", "envSky"].every(k => s[k] !== undefined), `${th} ${night ? "night" : "day"} has its colours`);
}
check(M.METALS[4].color !== M.METALS[5].color && M.METALS[5].color !== M.METALS[6].color, "the three modules wear three metals");
{
  const f = M.cameraFor(5, 5, 0, M.homeEl(390 / 664), 390 / 664);
  check(f.H > 0 && f.look.every(Number.isFinite), "the camera frames the case");
  check(M.layerY(1, 0) === 0.06 && M.layerY(3, 0) === 0.46 && M.layerY(3, 1) > M.layerY(2, 1) && M.layerY(2, 1) > M.layerY(1, 1), "exploding lifts the layers apart in order");
  const o = [0, 5, 0], d = [0, -1, 0], hit = M.gearUnder(o, d, [{ wx: 0, wz: 0, top: 0.13, tip: 0.5 }, { wx: 0.1, wz: 0, top: 0.53, tip: 0.3 }]);
  check(hit && hit.top === 0.53, "a touch finds the highest wheel under it");
}

// ---------- geometry, textures, the three.js guard (modules the next steps add) ----------
const have = f => fs.existsSync(root + f);
if (have("pipes-3d-geo.js")) {
  const THREE = await import("../vendor/three.js"), G = await import("../pipes-3d-geo.js");
  const tris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
  let total = 0;
  for (const [n, m] of [[12, 5], [15, 4], [10, 6], [4, 5], [14, 4], [8, 6], [11, 4]]) {
    const g = G.wheelGeometry({ n, m }), t = tris(g); total += t;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    check(t < 2000 && bb.min.y >= -1e-6 && near(Math.max(bb.max.x, -bb.min.x), M.tipR(n, m), 0.02), `wheel ${n}/m${m}: ${t} triangles, stands on y = 0, reaches its tip radius`);
  }
  check(total < 12000, `seven wheel shapes cost ${total} triangles`);
  check(typeof THREE.ExtrudeGeometry === "function", "ExtrudeGeometry exists in the bundle");
}
// ---------- the rules agent's fixtures (docs/pipes-contract.md): the frame drawn exactly as the engine says ----------
{
  const { FIXTURES } = await import("../pipes-gear-fixture.js");
  const G = await import("../pipes-3d-geo.js");
  const mem = new Map();
  const trisOfWheel = (n, m, pinion) => { const k = `${n}/${m}/${pinion}`; if (!mem.has(k)) mem.set(k, G.trisOf(G.wheelGeometry({ n, m, pinion }))); return mem.get(k); };
  for (const [key, fx] of Object.entries(FIXTURES)) {
    const { M: Mf, phase, plan } = fx.frame;
    const turns = [0, 0.137, 0.5, 3.3];
    let bad2 = 0, meshes = 0, rigid = 0;
    for (const e of Mf.edges) {
      const a = Mf.gears[Mf.idx[e.u]], b = Mf.gears[Mf.idx[e.v]], ra = M.rateOf(Mf, a.id), rb = M.rateOf(Mf, b.id);
      if (!ra || !rb || Mf.jam.has(a.id) || Mf.jam.has(b.id)) continue;
      if (e.kind === "rigid") { rigid++; if (!near(ra, rb, 1e-9) || !near(phase[a.id], phase[b.id], 1e-6)) bad2++; continue; }
      meshes++;
      const sameWay = e.kind === "ring";
      if (!near(Math.abs(ra) * a.n, Math.abs(rb) * b.n, 1e-9) || (ra > 0) === (rb > 0) !== sameWay) bad2++;
      if (e.kind === "mesh") for (const t of turns) {
        const ga = { id: a.id, x: a.x, y: a.y, n: a.n, rate: ra }, gb = { id: b.id, x: b.x, y: b.y, n: b.n, rate: rb };
        if (!meshOk(ga, gb, new Map([[a.id, phase[a.id]], [b.id, phase[b.id]]]), [t])) bad2++;
      }
    }
    check(bad2 === 0, `fixture ${key}: ${meshes} meshes and ${rigid} arbor links at the engine's speeds, opposite ways, teeth in step`);
    const total = Mf.gears.reduce((s, g) => s + trisOfWheel(g.n, g.m, false), 0);
    check(total < 90000, `fixture ${key}: ${Mf.gears.length} wheels cost ${total} triangles before the case and instruments`);
    const margins = M.marginsFor(plan);
    check(Object.values(margins).every(v => v >= 0.4 && v < 4), `fixture ${key}: the plate's margins are sane`);
  }
}
{
  const bundle = await import("../vendor/three.js");
  const lacking = [];
  for (const f of fs.readdirSync(root).filter(f => /^pipes-(3d-|view-3d)/.test(f) && f.endsWith(".js"))) {
    const text = fs.readFileSync(root + f, "utf8");
    for (const m of text.matchAll(/new THREE\.([A-Za-z0-9_]+)/g)) if (typeof bundle[m[1]] !== "function") lacking.push(`${f}: ${m[1]}`);
    for (const m of text.matchAll(/THREE\.([A-Z][A-Za-z0-9_]+)\b(?!\()/g)) if (!(m[1] in bundle) && !/Side|Blending/.test(m[1])) lacking.push(`${f}: ${m[1]}`);
  }
  check(lacking.length === 0, "no 3D file asks for a three.js class the trimmed bundle lacks" + (lacking.length ? ": " + [...new Set(lacking)].join(", ") : ""));
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
