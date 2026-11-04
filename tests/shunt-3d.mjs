// Shunt's watch movement in 3D (shunt-3d-model.js, shunt-3d-geo.js, shunt-3d-tex.js, shunt-sound.js; the picture itself, shunt-view-3d.js, needs WebGL and is looked at
// in a browser): the world matches the 2D board (cells, tooth phases), the levers stand on a round rim in the rules' own order and keep their lines, the layers
// keep gears of different pitches apart, a touch finds the lever it means (at least as forgiving as the 2D view's), the case's tilt is small and springs back,
// the camera always holds the case and the tray, every theme has its colours by day and by night, the geometries and the engraving build, and the page keeps
// the player's view choice only when it is picked. Run: node tests/shunt-3d.mjs
import fs from "node:fs";
import { CELLS, N, ENTRIES } from "../shunt-engine.js";
import { LEVERS, D, HIT, FAMILY, teethOf } from "../shunt-view-2d.js";
import {
  cellW, SHAPES, LAYER_Y, THICK, IDLER_THICK, PARTS, topOf, baseOf, gearDeg, RATE, toothOutline, RO, LEVER_W, HIT3, nearestLever, holdAt, onPlate, HOLD, RAIL, QUEUE,
  homeEl, basis, fit, KEEP, skinFor, METALS, PLATE_R, CASE_R, RIM_R, SEAT_R, CELL_R, TILT_MAX, tiltOfDrag, tiltOfPhone, springStep,
} from "../shunt-3d-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const root = new URL("../", import.meta.url).pathname;

// ---------- the world is the 2D board, one unit a cell ----------
check(CELLS.every((_, i) => { const [x, z] = cellW(i), [px, py] = [x * D, z * D]; return near(px, 0.8660254 * CELLS[i].q * D) && near(py, (CELLS[i].r + CELLS[i].q / 2) * D); }), "a cell stands where the 2D view draws it (a unit is its D)");
check(CELLS.every((_, i) => CELLS.every((__, j) => i === j || Math.hypot(...cellW(i).map((v, k) => v - cellW(j)[k])) > 0.99)), "neighbouring cells are a unit apart, no two closer");
check(LEVER_W.length === 30 && LEVER_W.every((l, e) => l.e === e && near(l.ux, LEVERS[e].ux) && near(l.uz, LEVERS[e].uy)), "thirty levers, each keeping its number and the way its line runs");
check(LEVER_W.every(l => near(Math.hypot(l.x, l.z), RIM_R)), "the levers stand on one circle");
{
  // the same order round the plate as the hexagon's, an equal angle apart
  const hexOrder = LEVERS.map(l => ({ e: l.e, a: Math.atan2(l.y, l.x) })).sort((p, q) => p.a - q.a).map(o => o.e);
  const ang = e => Math.atan2(LEVER_W[e].z, LEVER_W[e].x), gaps = hexOrder.map((e, i) => (((ang(hexOrder[(i + 1) % 30]) - ang(e)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
  check(gaps.every(g => near(g, 2 * Math.PI / 30, 1e-9)), "in the hexagon's order round the plate, an equal angle apart");
  let mn = 9;
  for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) mn = Math.min(mn, Math.hypot(LEVER_W[i].x - LEVER_W[j].x, LEVER_W[i].z - LEVER_W[j].z));
  check(mn > 0.55 && mn > 0.47 * 1.15, "no two levers closer than 0.55 of a cell (the hexagon's were 0.47): a finger has more room");
}
check(LEVER_W.every((l, e) => { const en = ENTRIES[e], [cx, cz] = cellW(en.line[0]); return (cx - l.x) * l.ux + (cz - l.z) * l.uz > 0 && Math.hypot(cx - l.x, cz - l.z) < 1.9; }), "each lever stands outside its entry cell, nearer than two cells, and points into it");

// ---------- gears: tooth phases, layers ----------
check(SHAPES.length === 4 && SHAPES.map(s => s.n).join() === "12,18,24,12", "the shapes: pitches A, B, C and the idler, 12, 18, 24 and 12 teeth");
check(SHAPES.every(s => s.n % 6 === 0), "tooth counts are multiples of six, so every hex direction meets a tooth or a gap alike");
check(PARTS.length === 7 && PARTS[3].length === 1 && PARTS[3][0][0] === 3, "seven gear codes; the idler is one part");
check(FAMILY.every((fam, c) => c === 3 || (PARTS[c].length === fam.length && PARTS[c].every(([k], i) => k === fam[i]))), "a bridge is a gear of each of its two pitches, a plain gear one");
// no two parts of different pitches share a layer, so a gear passing over a neighbour of another pitch never meets it
check(new Set(LAYER_Y).size === 3 && LAYER_Y[1] - LAYER_Y[0] > THICK && LAYER_Y[2] - LAYER_Y[1] > THICK, "each pitch has its own layer, with a gap between layers");
check(LAYER_Y[0] > 0, "the lowest gear is above the plate's top (the recesses' brass walls end at 0)");
check(near(topOf(3), LAYER_Y[0] + IDLER_THICK) && topOf(4) === Math.max(topOf(0), topOf(1)) && baseOf(5) === LAYER_Y[0], "heights: a bridge's top is its higher part's, the idler stands through all layers");
check(topOf(3) >= LAYER_Y[2] + THICK - 1e-9, "the idler is as tall as the highest layer, so it meshes every pitch");
// two meshed gears: the angles of the same-pitch pair keep their teeth in step at every time
{
  let ok = true;
  for (const k of [0, 1, 2, 3]) {
    const n = SHAPES[k].n, step = 360 / n;
    for (const t of [0, 0.37, 1, 2.9, 11]) {
      const a = gearDeg(n, 1, t, "turn"), b = gearDeg(n, -1, t, "turn");
      // a gear's teeth sit at a + j*step; the facing directions of two neighbours (along a hex axis) are alpha and alpha + 180
      for (let dir = 0; dir < 6; dir++) {
        const alpha = 30 + 60 * dir, fa = (((alpha - a) % step) + step) % step, fb = (((alpha + 180 - b) % step) + step) % step;
        if (!near((fa + fb) % step, step / 2, 1e-6)) ok = false;
      }
    }
  }
  check(ok, "meshed gears keep their teeth in each other's gaps, in every direction and at every time");
}
check(near(gearDeg(12, 1, 1, "turn") - gearDeg(12, 1, 0, "turn"), RATE * 30) && near(gearDeg(18, -1, 1, "turn") - gearDeg(18, -1, 0, "turn"), -RATE * 20), "every gear turns the same teeth a second, the other way for the other direction");
check(gearDeg(12, 1, 5, "still") === 0 && gearDeg(12, -1, 5, "still") === 15, "a still gear keeps its phase (a half tooth on when it would turn the other way)");
check(Math.abs(gearDeg(12, 1, 0.3, "jam")) < 3 && Math.abs(gearDeg(24, 1, 7.1, "jam")) < 3, "a jammed gear only shudders");
for (const k of [0, 1, 2, 3]) {
  const pts = toothOutline(SHAPES[k].n, RO, SHAPES[k].depth), rs = pts.map(p => Math.hypot(...p));
  check(pts.length === SHAPES[k].n * 10 && near(Math.max(...rs), RO, 1e-9) && near(Math.min(...rs), RO * (1 - SHAPES[k].depth), 1e-9), `the outline of shape ${k}: ${SHAPES[k].n} teeth between the root and the tip radius`);
  const tip = pts.filter(p => near(Math.hypot(...p), RO, 1e-9)).map(p => Math.atan2(p[1], p[0]));
  check(tip.some(a => near(a, 0, 1e-9)), `the first tooth of shape ${k} is centred on angle 0`);
}
// neighbouring gears of one pitch overlap by the teeth's depth and no more (they interleave; they do not cut each other)
check(RO * 2 > 1 && RO * 2 - 1 < SHAPES[0].depth * RO * 2, "two neighbours' tips reach into each other's gaps, no deeper than the teeth are");

// ---------- the lever a touch means ----------
check(HIT3 >= HIT / D, "a touch finds a lever at least as far off as the 2D view does");
check(LEVER_W.every(l => nearestLever(l.x, l.z)?.e === l.e), "a touch on a lever's own place finds it");
check(LEVER_W.every(l => nearestLever(l.x + l.ux * 0.2, l.z + l.uz * 0.2)?.e === l.e), "and a little along its way");
{
  // the nearest decides: no point within HIT3 of two levers is given to the farther
  let wrong = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 6, z = (Math.sin(i * 78.233) * 12543.1357 % 1) * 6, l = nearestLever(x, z);
    let best = null, bd = HIT3;
    for (const m of LEVER_W) { const d = Math.hypot(m.x - x, m.z - z); if (d < bd) { bd = d; best = m; } }
    if ((l?.e ?? -1) !== (best?.e ?? -1)) wrong++;
  }
  check(wrong === 0, "the nearest lever within the radius is the one found");
}
check(nearestLever(0, 0) === null && nearestLever(0.5, 0.3) === null, "the middle of the plate is no lever");
check(holdAt(HOLD.x, HOLD.z) && holdAt(HOLD.x + HOLD.r, HOLD.z) && !holdAt(QUEUE[1].x, RAIL.z), "the cradle takes a touch on it and a little beyond, and not the queue");
check(onPlate(0, 0) && onPlate(2.5, 0) && onPlate(0, 3.2) && onPlate(-3.2, 0) && !onPlate(0, 3.6) && !onPlate(3.5, 0) && !onPlate(HOLD.x, RAIL.z), "the plate's outline is the case's circle");
check(CELLS.every((_, i) => onPlate(...cellW(i))) && LEVER_W.every(l => onPlate(l.x, l.z)), "every cell and every lever is on the plate");

// ---------- the tilt: small, soft at its end, springing back ----------
check(TILT_MAX >= 10 * Math.PI / 180 && TILT_MAX <= 15 * Math.PI / 180, "the tilt is about 10 to 15 degrees at most");
{
  const [ax, az] = tiltOfDrag(5000, -5000), [bx, bz] = tiltOfDrag(30, 0), [cx, cz] = tiltOfDrag(0, 60);
  check(Math.abs(ax) <= TILT_MAX && Math.abs(az) <= TILT_MAX && near(Math.abs(ax), TILT_MAX, 1e-6), "a long drag reaches the limit and never passes it");
  check(bz < 0 && Math.abs(bz) < TILT_MAX * 0.5 && cx > 0 && near(bx, 0) && near(cz, 0), "dragging right tips the right edge down, dragging down the near edge, a short drag only a little");
  const q = tiltOfPhone(70, 5, 60, 0, 0), r = tiltOfPhone(70, 5, 60, 0, 90);
  check(q.every(v => Math.abs(v) <= TILT_MAX) && tiltOfPhone(60, 0, 60, 0).every(v => near(v, 0)) && tiltOfPhone(200, 90, 0, 0).every(v => Math.abs(v) <= TILT_MAX + 1e-9), "the phone's tilt is clamped, and none at the posture it started from");
  check(!near(q[0], r[0]) || !near(q[1], r[1]), "turning the screen swaps the phone's axes");
  // the spring: from a lean it returns to rest, overshooting a little and no more
  let x = TILT_MAX, v = 0, minX = 0, steps = 0;
  for (; steps < 600 && (Math.abs(x) > 4e-4 || Math.abs(v) > 2e-3); steps++) { [x, v] = springStep(x, v, 0, 1 / 60); minX = Math.min(minX, x); }
  check(steps < 240 && minX < 0 && minX > -TILT_MAX * 0.3, "released, the case swings back past level a little and rests within four seconds");
  let held = TILT_MAX, hv = 0;
  for (let i = 0; i < 120; i++) [held, hv] = springStep(held, hv, TILT_MAX, 1 / 60);
  check(near(held, TILT_MAX, 1e-6), "held at its target, it stays");
}

// ---------- the camera: fixed; it always holds the case, the tilt's reach and the tray ----------
for (const a of [0.55, 0.9, 1.5, 2.2]) check(homeEl(a) >= 60 * Math.PI / 180 && homeEl(a) <= 80 * Math.PI / 180, `the elevation at aspect ${a} is steep enough to read the plate`);
{
  const b = basis(0.2, 1.0), dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  check(near(dot(b.r, b.r), 1) && near(dot(b.u, b.u), 1) && near(dot(b.c, b.c), 1) && near(dot(b.r, b.u), 0) && near(dot(b.r, b.c), 0) && near(dot(b.u, b.c), 0), "the camera's right, up and back are a frame");
  const top = basis(0, Math.PI / 2 - 1e-6);
  check(near(top.u[2], -1, 1e-4) && near(top.r[0], 1), "from straight above, up on the screen is away from the viewer: the 2D picture");
}
for (const [az, el, asp] of [[0, homeEl(0.9), 0.9], [0.26, 0.87, 0.6], [-0.26, 1.5, 1.7], [0.1, 1, 1.2]]) {
  const f = fit(KEEP, az, el, asp), b = basis(az, el);
  let inside = true;
  for (const p of KEEP) {
    const rel = [p[0] - f.look[0], p[1] - f.look[1], p[2] - f.look[2]], sx = rel[0] * b.r[0] + rel[1] * b.r[1] + rel[2] * b.r[2], sy = rel[0] * b.u[0] + rel[1] * b.u[1] + rel[2] * b.u[2];
    if (Math.abs(sx) > f.H * asp + 1e-9 || Math.abs(sy) > f.H + 1e-9) inside = false;
  }
  check(inside && f.H > 3, `the fit at yaw ${az.toFixed(2)}, elevation ${el.toFixed(2)}, aspect ${asp} holds the case and the rack`);
}
{
  const wide = fit(KEEP, 0, homeEl(1.5), 1.5).H, tall = fit(KEEP, 0, homeEl(0.6), 0.6).H;
  check(wide < tall * 1.2 && wide > 3, "a wide screen needs no more height than a tall one");
}
check(KEEP.every(p => Math.hypot(p[0], p[2]) >= 0) && KEEP.some(p => p[2] > RAIL.z) && KEEP.some(p => Math.hypot(p[0], p[2]) > CASE_R), "what is kept in view includes the case all round and the rack");

// ---------- the look ----------
for (const th of ["codex", "modern", "kontor", "office"]) for (const night of [false, true]) {
  const s = skinFor(th, night), need = ["key", "keyI", "fill", "fillI", "sky", "ground", "hemiI", "exposure", "gold", "plate", "floor", "velvet", "shadow", "envSky", "envGround", "envWin"];
  check(need.every(k => s[k] !== undefined && Number.isFinite(s[k])), `${th} by ${night ? "night" : "day"} has every colour and light`);
}
check(skinFor("codex", true).keyI < skinFor("codex", false).keyI && skinFor("codex", true).exposure > skinFor("codex", false).exposure, "night is a weaker sun and a longer exposure, as in Topple");
check(skinFor("nothing", false).gold === skinFor("codex", false).gold, "an unknown theme is Codex's look");
check(METALS.length === 4 && METALS.every(m => m.metalness > 0 && m.roughness > 0), "four metals: brass, blued steel, violet, iron");

// ---------- the shapes build (three.js runs in Node; WebGL is not needed to make geometry) ----------
{
  const G = await import("../shunt-3d-geo.js");
  const gears = [0, 1, 2, 3].map(G.gearGeometry);
  check(gears.every(g => g.attributes.position.count > 400 && g.attributes.color && g.attributes.normal), "each gear is a solid with normals and its shading");
  gears.forEach((g, k) => {
    g.computeBoundingBox();
    const bb = g.boundingBox, H = (k === 3 ? IDLER_THICK : THICK);
    check(bb.min.y >= -1e-6 && bb.max.y > H && bb.max.y < H + 0.1 && Math.max(bb.max.x, bb.max.z) <= RO + 1e-3, `gear ${k} stands on y = 0, a little over its thickness with its relief, within its radius`);
  });
  const plate = G.plateGeometry(), cse = G.caseGeometry();
  plate.computeBoundingBox(); cse.computeBoundingBox();
  check(near(plate.boundingBox.max.y, 0, 1e-6) && plate.boundingBox.min.y < -0.1 && near(plate.boundingBox.max.x, PLATE_R, 0.02) && plate.attributes.uv && plate.groups.length === 2, "the plate's top is y = 0, a disc of its radius with a seat cut through at each cell, its UVs and two materials");
  check(cse.boundingBox.max.y > 0.2 && cse.boundingBox.max.y < 0.25 && near(cse.boundingBox.max.x, CASE_R, 0.02) && cse.attributes.normal.count === cse.attributes.position.count, "the case's bezel stands just over the plate, as wide as the case");
  check(CELLS.every((_, i) => cellW(i).every(v => Math.abs(v) < PLATE_R - SEAT_R)) && SEAT_R < CELL_R, "every seat lies inside the plate, narrower than its cell, so engraving is left between seats");
  const stone = G.cabochonGeometry(), chaton = G.chatonGeometry();
  stone.computeBoundingBox(); chaton.computeBoundingBox();
  let nearest = 9;
  for (let i = 0; i < stone.attributes.position.count; i++) nearest = Math.min(nearest, Math.hypot(stone.attributes.position.getX(i), stone.attributes.position.getZ(i)));
  check(stone.boundingBox.min.y >= -1e-9 && stone.boundingBox.max.y > 0.08 && chaton.boundingBox.max.x > stone.boundingBox.max.x && chaton.boundingBox.max.y < 0.08, "a ruby is a low dome inside a gold ring that is taller at its lip than the stone's foot");
  check(near(nearest, 0.036, 1e-6), "the ruby has its hole: nothing nearer the axis than its radius");
  check(G.arrowGeometry().attributes.position.count > 20 && G.chevronGeometry().attributes.position.count > 12 && G.ringGeometry(1, 0.9, 0.02).attributes.position.count > 100 && G.quadGeometry(1).attributes.uv.count === 4, "the lever's arrow, the chevron, the ring and the quad build");
  check(gears.every(g => g.attributes.uv && g.attributes.uv.count === g.attributes.position.count), "each gear has the UVs its circular grain is laid by");

  // the engraving: made with Guilloche's machine, a normal map with every groove a V
  const T = await import("../shunt-3d-tex.js");
  const dial = T.dialNormals(256), per = T.perlageNormals(64), grn = T.grainNormals(64);
  let tilted = 0;
  for (let i = 0; i < 256 * 256; i++) if (Math.abs(dial.data[i * 4] - 128) > 8 || Math.abs(dial.data[i * 4 + 1] - 128) > 8) tilted++;
  check(dial.data.length === 256 * 256 * 4 && tilted > 256 * 256 * 0.35 && tilted < 256 * 256 * 0.98, "the dial is engraved (most of it leans one way or another) with some left flat");
  check(per.data.length === 64 * 64 * 4 && grn.data.length === 64 * 64 * 4 && [dial, per, grn].every(d => { for (let i = 2; i < d.data.length; i += 4) if (d.data[i] < 128) return false; return true; }), "the perlage and the grain build, every normal pointing out of the surface");
  check(T.DIAL.length >= 3 && T.DIAL.some(c => c.kind === "lines" && c.cross === 90) && T.DIAL.some(c => c.kind === "rays"), "the dial is clous de Paris (two sets of grooves at a right angle) and a sunburst, both cut by guilloche-engine.js");
}

// ---------- the sounds: nothing is made until a touch unlocks audio, and off is off ----------
{
  const { sound } = await import("../shunt-sound.js");
  sound.on = true;
  let threw = false;
  try { sound.play("clack"); sound.play("nothing"); sound.unlock(); sound.on = false; sound.play("tick"); } catch { threw = true; }
  check(!threw && sound.on === false, "sounds are harmless where there is no audio, and the switch holds");
  sound.on = true;
}

// ---------- the page: the 3D view is loaded when wanted, the choice kept only when picked ----------
{
  const js = fs.readFileSync(root + "shunt.js", "utf8");
  check(/import\("\.\/shunt-view-3d\.js"\)/.test(js) && !/^import .*shunt-view-3d/m.test(js), "three.js loads only when the watch is wanted (a dynamic import)");
  check(/mode3d\.js/.test(js) && /defaultIs3D\(\)/.test(js), "the default view is the suite's setting (mode3d.js)");
  check(/if \(remember\) write\(VIEW/.test(js) && !/write\(VIEW, defaultIs3D/.test(js), "the view is written down only when the player picks it, never the default");
  check(/Play in 3D/.test(js) && /Play in 2D/.test(js), "the menu offers Play in 3D / Play in 2D");
  check(/IN_FRAME \? false/.test(js), "a watching frame keeps the flat plate");
  const v3 = fs.readFileSync(root + "shunt-view-3d.js", "utf8");
  check(/webglcontextlost/.test(v3) && /onLost/.test(v3) && /prefers-reduced-motion/.test(v3) && /Math\.min\(devicePixelRatio \|\| 1, 2\)/.test(v3), "it falls back when the context is lost, respects reduced motion and caps the pixel ratio at 2");
  check(/shadow\.mapSize\.set\(1024, 1024\)/.test(v3), "a shadow map of 1024");
  const css = fs.readFileSync(root + "shunt.css", "utf8");
  check(/#app\.view3d \.sh-tray/.test(css), "the flat tray gives way to the movement's own tray");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
