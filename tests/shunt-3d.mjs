// Shunt's 3D workshop (shunt-3d-model.js, shunt-3d-geo.js, shunt-sound.js; the picture itself, shunt-view-3d.js, needs WebGL and is looked at in a browser):
// the world matches the 2D board (cells, levers, tooth phases), the layers keep gears of different pitches apart, a touch finds the lever it
// means (at least as forgiving as the 2D view's), the camera is limited and always holds the plate, every theme has its colours by day and
// by night, the geometries build, and the page keeps the player's view choice only when it is picked. Run: node tests/shunt-3d.mjs
import fs from "node:fs";
import { CELLS, N, ENTRIES } from "../shunt-engine.js";
import { LEVERS, D, HIT, FAMILY, teethOf } from "../shunt-view-2d.js";
import {
  cellW, SHAPES, LAYER_Y, THICK, IDLER_THICK, PARTS, topOf, baseOf, gearDeg, RATE, toothOutline, RO, LEVER_W, HIT3, nearestLever, holdAt, onPlate, HOLD, RAIL, QUEUE,
  clampView, EL_MIN, EL_MAX, AZ_MAX, homeEl, basis, fit, KEEP, skinFor, METALS, FRAME_R,
} from "../shunt-3d-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const root = new URL("../", import.meta.url).pathname;

// ---------- the world is the 2D board, one unit a cell ----------
check(CELLS.every((_, i) => { const [x, z] = cellW(i), [px, py] = [x * D, z * D]; return near(px, 0.8660254 * CELLS[i].q * D) && near(py, (CELLS[i].r + CELLS[i].q / 2) * D); }), "a cell stands where the 2D view draws it (a unit is its D)");
check(CELLS.every((_, i) => CELLS.every((__, j) => i === j || Math.hypot(...cellW(i).map((v, k) => v - cellW(j)[k])) > 0.99)), "neighbouring cells are a unit apart, no two closer");
check(LEVER_W.length === 30 && LEVER_W.every((l, e) => l.e === e && near(l.x * D, LEVERS[e].x) && near(l.z * D, LEVERS[e].y)), "thirty levers, each where the 2D view has it");
check(LEVER_W.every(l => near(Math.hypot(l.ux, l.uz), 1)), "each lever points a unit way");
check(LEVER_W.every((l, e) => { const en = ENTRIES[e], [cx, cz] = cellW(en.line[0]); return Math.hypot(cx - l.x, cz - l.z) < 1 && (cx - l.x) * l.ux + (cz - l.z) * l.uz > 0.4; }), "each lever stands outside its entry cell and points into it");

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
check(onPlate(0, 0) && onPlate(2.5, 0) && onPlate(0, 2.9) && !onPlate(0, 3.6) && !onPlate(3.0, 0) && !onPlate(HOLD.x, RAIL.z), "the plate's outline is the frame's hexagon");
check(CELLS.every((_, i) => onPlate(...cellW(i))) && LEVER_W.every(l => onPlate(l.x, l.z)), "every cell and every lever is on the plate");

// ---------- the camera ----------
check(near(clampView(1, 0)[0], AZ_MAX) && near(clampView(-1, 3)[0], -AZ_MAX) && near(clampView(0, 3)[1], EL_MAX) && near(clampView(0, 0)[1], EL_MIN), "the view turns within its limits");
check(EL_MIN >= 49 * Math.PI / 180 && EL_MAX <= 88 * Math.PI / 180, "from about 50 degrees to nearly straight down");
for (const a of [0.55, 0.9, 1.5, 2.2]) check(homeEl(a) >= EL_MIN && homeEl(a) <= EL_MAX, `the first elevation at aspect ${a} is within the limits`);
{
  const b = basis(0.2, 1.0), dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  check(near(dot(b.r, b.r), 1) && near(dot(b.u, b.u), 1) && near(dot(b.c, b.c), 1) && near(dot(b.r, b.u), 0) && near(dot(b.r, b.c), 0) && near(dot(b.u, b.c), 0), "the camera's right, up and back are a frame");
  const top = basis(0, Math.PI / 2 - 1e-6);
  check(near(top.u[2], -1, 1e-4) && near(top.r[0], 1), "from straight above, up on the screen is away from the viewer: the 2D picture");
}
for (const [az, el, asp] of [[0, homeEl(0.9), 0.9], [AZ_MAX, EL_MIN, 0.6], [-AZ_MAX, EL_MAX, 1.7], [0.1, 1, 1.2]]) {
  const f = fit(KEEP, az, el, asp), b = basis(az, el);
  let inside = true;
  for (const p of KEEP) {
    const rel = [p[0] - f.look[0], p[1] - f.look[1], p[2] - f.look[2]], sx = rel[0] * b.r[0] + rel[1] * b.r[1] + rel[2] * b.r[2], sy = rel[0] * b.u[0] + rel[1] * b.u[1] + rel[2] * b.u[2];
    if (Math.abs(sx) > f.H * asp + 1e-9 || Math.abs(sy) > f.H + 1e-9) inside = false;
  }
  check(inside && f.H > 3, `the fit at yaw ${az.toFixed(2)}, elevation ${el.toFixed(2)}, aspect ${asp} holds the plate and the rack`);
}
{
  const wide = fit(KEEP, 0, homeEl(1.5), 1.5).H, tall = fit(KEEP, 0, homeEl(0.6), 0.6).H;
  check(wide < tall * 1.2 && wide > 3, "a wide screen needs no more height than a tall one");
}
check(KEEP.every(p => Math.hypot(p[0], p[2]) >= 0) && KEEP.some(p => p[2] > RAIL.z) && KEEP.some(p => Math.hypot(p[0], p[2]) > FRAME_R), "what is kept in view includes the frame's corners and the rack");

// ---------- the look ----------
for (const th of ["codex", "modern", "kontor", "office"]) for (const night of [false, true]) {
  const s = skinFor(th, night), need = ["room", "benchA", "benchB", "frame", "frameB", "baize", "floor", "rim", "rail", "velvet", "paper", "key", "keyI", "sky", "ground", "hemiI", "fill", "fillI", "exposure", "lamp", "shade", "grain", "envSky", "envGround", "envWin"];
  check(need.every(k => s[k] !== undefined && Number.isFinite(s[k])), `${th} by ${night ? "night" : "day"} has every colour and light`);
}
check(skinFor("codex", true).lamp > skinFor("codex", false).lamp && skinFor("codex", true).keyI < skinFor("codex", false).keyI + 0.01, "night is a lamp in a dim room: the lamp glows more and the key is no stronger");
check(skinFor("nothing", false).baize === skinFor("codex", false).baize, "an unknown theme is Codex's look");
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
  const baize = G.baizeGeometry(), frame = G.frameGeometry(0x6a4228, 0x4e2f1b), bench = G.benchGeometry(skinFor("codex", false), [0, 0]);
  baize.computeBoundingBox(); frame.computeBoundingBox(); bench.computeBoundingBox();
  check(near(baize.boundingBox.max.y, 0, 1e-6) && baize.boundingBox.min.y < -0.05, "the cloth's top is the plate's top, with its recesses going down");
  check(frame.attributes.color.count === frame.attributes.position.count && frame.boundingBox.max.y < 0.1 && frame.boundingBox.max.y > 0.05, "the frame's grain is in its vertex colours, its top just over the cloth");
  check(Math.max(frame.boundingBox.max.x, -frame.boundingBox.min.x) > FRAME_R * 0.86 && Math.max(frame.boundingBox.max.z, -frame.boundingBox.min.z) > FRAME_R, "the frame reaches the corners radius");
  check(bench.attributes.position.count > 5000 && bench.boundingBox.min.x < -10 && bench.boundingBox.max.z > 8, "the bench is wide enough for any screen");
  check(G.gemGeometry().attributes.position.count > 20 && G.arrowGeometry().attributes.position.count > 20 && G.chevronGeometry().attributes.position.count > 12 && G.ringGeometry(1, 0.9, 0.02).attributes.position.count > 100, "the gem, the lever's arrow, the chevron and the ring build");
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
  check(/import\("\.\/shunt-view-3d\.js"\)/.test(js) && !/^import .*shunt-view-3d/m.test(js), "three.js loads only when the workshop is wanted (a dynamic import)");
  check(/mode3d\.js/.test(js) && /defaultIs3D\(\)/.test(js), "the default view is the suite's setting (mode3d.js)");
  check(/if \(remember\) write\(VIEW/.test(js) && !/write\(VIEW, defaultIs3D/.test(js), "the view is written down only when the player picks it, never the default");
  check(/Play in 3D/.test(js) && /Play in 2D/.test(js), "the menu offers Play in 3D / Play in 2D");
  check(/IN_FRAME \? false/.test(js), "a watching frame keeps the flat plate");
  const v3 = fs.readFileSync(root + "shunt-view-3d.js", "utf8");
  check(/webglcontextlost/.test(v3) && /onLost/.test(v3) && /prefers-reduced-motion/.test(v3) && /Math\.min\(devicePixelRatio \|\| 1, 2\)/.test(v3), "it falls back when the context is lost, respects reduced motion and caps the pixel ratio at 2");
  check(/shadow\.mapSize\.set\(1024, 1024\)/.test(v3), "a shadow map of 1024");
  const css = fs.readFileSync(root + "shunt.css", "utf8");
  check(/#app\.view3d \.sh-tray/.test(css), "the flat tray gives way to the bench's rack");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
