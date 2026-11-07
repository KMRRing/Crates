// Shunt's watch movement in 3D (shunt-3d-model.js, shunt-3d-geo.js, shunt-3d-tex.js, shunt-sound.js; the picture itself, shunt-view-3d.js, needs WebGL and is looked at
// in a browser): the world matches the 2D board (cells, tooth phases), the levers are tabs against the board's outline, each worked out from its entry, the layers
// keep gears of different pitches apart, a touch finds the lever it means (at least as forgiving as the 2D view's), the case's tilt is small and springs back,
// the camera always holds the case and the tray, every theme has its colours by day and by night, the geometries and the engraving build, and the page keeps
// the player's view choice only when it is picked. Run: node tests/shunt-3d.mjs
import fs from "node:fs";
import { CELLS, N, ENTRIES } from "../shunt-engine.js";
import { LEVERS, D, HIT, FAMILY, teethOf, offTab } from "../shunt-view-2d.js";
import {
  cellW, SHAPES, LAYER_Y, THICK, IDLER_THICK, PARTS, topOf, baseOf, gearDeg, RATE, toothOutline, RO, LEVER_W, HIT3, nearestLever, holdAt, onPlate, HOLD, RAIL, QUEUE,
  homeEl, homeCam, camFrame, screenOf, planeAt, orbit, zoomed, clampCam, isHome, wrapAz, EL_MIN, EL_MAX, ZOOM_MIN, ZOOM_MAX, WINDOWS,
  basis, fit, KEEP, skinFor, METALS, PLATE_R, CASE_R, TRACK_R, HIT_R, TAB, SEAT_R, CELL_R, TILT_MAX, tiltOfPhone, springStep,
} from "../shunt-3d-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
const root = new URL("../", import.meta.url).pathname;

// ---------- the world is the 2D board, one unit a cell ----------
check(CELLS.every((_, i) => { const [x, z] = cellW(i), [px, py] = [x * D, z * D]; return near(px, 0.8660254 * CELLS[i].q * D) && near(py, (CELLS[i].r + CELLS[i].q / 2) * D); }), "a cell stands where the 2D view draws it (a unit is its D)");
check(CELLS.every((_, i) => CELLS.every((__, j) => i === j || Math.hypot(...cellW(i).map((v, k) => v - cellW(j)[k])) > 0.99)), "neighbouring cells are a unit apart, no two closer");
check(LEVER_W.length === 30 && LEVER_W.every((l, e) => l.e === e && near(l.ux, LEVERS[e].ux) && near(l.uz, LEVERS[e].uy)), "thirty levers, each keeping its number and the way its line runs");
{
  // each tab is worked out from the rules' entry: it stands against the outer face of the entry's first cell, a bar parallel to that face
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]], has = (q, r) => CELLS.some(c => c.q === q && c.r === r);
  const faces = [];
  CELLS.forEach((c, i) => DIRS.forEach(d => { if (!has(c.q + d[0], c.r + d[1])) faces.push({ i, n: [0.8660254 * d[0], d[1] + d[0] / 2] }); }));
  check(faces.length === 30, "the board's outline is thirty faces, as many as there are ways in");
  check(ENTRIES.every((en, e) => { const c = CELLS[en.line[0]]; return !has(c.q - en.d[0], c.r - en.d[1]); }), "every entry's first cell has nothing behind it: a lever is always at a face, never at a corner");
  check(faces.every(f => LEVER_W.filter(l => ENTRIES[l.e].line[0] === f.i && near(-l.ux, f.n[0] / Math.hypot(...f.n), 1e-6) && near(-l.uz, f.n[1] / Math.hypot(...f.n), 1e-6)).length === 1), "each outer face has exactly one lever, pushing straight in through it");
  const back = (SEAT_R + 0.04) * 0.8660254 + TAB.gap + TAB.thick / 2;
  check(LEVER_W.every(l => { const [cx, cz] = cellW(ENTRIES[l.e].line[0]), dx = l.x - cx, dz = l.z - cz; return near(Math.hypot(dx, dz), back, 1e-9) && near(dx * l.uz - dz * l.ux, 0, 1e-9) && dx * l.ux + dz * l.uz < 0; }), "each tab is centred on the normal through its face's middle, just outside the seat's gold edge, and its bar runs parallel to the face");
  // no tab touches a seat, and all stand inside the gold line round the board
  const inHex = (px, pz, cx, cz, R) => [0, 1, 2].every(k => { const a = Math.PI / 6 + k * Math.PI / 3; return Math.abs((px - cx) * Math.cos(a) + (pz - cz) * Math.sin(a)) < R * 0.8660254; });
  let clear = true, inside = true;
  for (const l of LEVER_W) for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    const px = l.x + l.ux * a * TAB.thick / 2 - l.uz * b * TAB.len / 2, pz = l.z + l.uz * a * TAB.thick / 2 + l.ux * b * TAB.len / 2;
    if (CELLS.some((_, i) => inHex(px, pz, ...cellW(i), SEAT_R + 0.04))) clear = false;
    if (Math.hypot(px, pz) > TRACK_R - 0.03) inside = false;
  }
  check(clear && inside, "no tab's corner is over a seat or its edge, and every tab is inside the gold line");
  let mn = 9;
  for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) mn = Math.min(mn, Math.hypot(LEVER_W[i].x - LEVER_W[j].x, LEVER_W[i].z - LEVER_W[j].z));
  check(mn > TAB.thick * 2.5 && mn > 0.45, `no two tabs closer than 0.45 of a cell (${mn.toFixed(2)}) and the bars do not meet`);
  // the touch points: the tabs' order round the board, an equal angle apart on a circle, each near its own tab
  const order = LEVER_W.map(l => ({ e: l.e, a: Math.atan2(l.z, l.x) })).sort((p, q) => p.a - q.a).map(o => o.e), ang = e => Math.atan2(LEVER_W[e].hz, LEVER_W[e].hx);
  check(LEVER_W.every(l => near(Math.hypot(l.hx, l.hz), HIT_R)) && order.every((e, i) => near((((ang(order[(i + 1) % 30]) - ang(e)) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), 2 * Math.PI / 30, 1e-9)), "touch points stand an equal angle apart on one circle, in the tabs' order");
  check(LEVER_W.every(l => Math.hypot(l.hx - l.x, l.hz - l.z) < 0.45), "each touch point is within half a cell of its tab");
  let hmn = 9;
  for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) hmn = Math.min(hmn, Math.hypot(LEVER_W[i].hx - LEVER_W[j].hx, LEVER_W[i].hz - LEVER_W[j].hz));
  check(hmn > 0.5, `touch points are at least half a cell apart (${hmn.toFixed(2)}): a finger has room`);
}

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
check(LEVER_W.every(l => nearestLever(l.x, l.z)?.e === l.e && nearestLever(l.hx, l.hz)?.e === l.e), "a touch on a lever's own tab, or its touch point, finds it");
check(LEVER_W.every(l => [[-1, -1], [-1, 1], [1, -1], [1, 1]].every(([a, b]) => nearestLever(l.x + l.ux * a * TAB.thick / 2 - l.uz * b * TAB.len / 2, l.z + l.uz * a * TAB.thick / 2 + l.ux * b * TAB.len / 2)?.e === l.e)), "and on any corner of the tab: the whole bar is its own");
check(LEVER_W.every(l => nearestLever(l.x + l.ux * 0.2, l.z + l.uz * 0.2)?.e === l.e), "and a little along its way");
{
  // a point on or within 0.08 of a tab is that tab's (the nearest tab); elsewhere the nearest touch point within HIT3 decides
  let wrong = 0;
  for (let i = 0; i < 4000; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1) * 6, z = (Math.sin(i * 78.233) * 12543.1357 % 1) * 6, l = nearestLever(x, z);
    let best = null, bd = 0.08;
    for (const m of LEVER_W) { const d = offTab(x, z, m.x, m.z, m.ux, m.uz, TAB.len, TAB.thick); if (d < bd) { bd = d; best = m; } }
    if (!best) { bd = HIT3; for (const m of LEVER_W) { const d = Math.hypot(m.hx - x, m.hz - z); if (d < bd) { bd = d; best = m; } } }
    if ((l?.e ?? -1) !== (best?.e ?? -1)) wrong++;
  }
  check(wrong === 0, "a touch on a tab is its lever, else the nearest touch point within the radius");
}
check(nearestLever(0, 0) === null && nearestLever(0.5, 0.3) === null, "the middle of the plate is no lever");
check(holdAt(HOLD.x, HOLD.z) && holdAt(HOLD.x + HOLD.r, HOLD.z) && !holdAt(QUEUE[1].x, RAIL.z), "the cradle takes a touch on it and a little beyond, and not the queue");
check(onPlate(0, 0) && onPlate(2.5, 0) && onPlate(0, 3.2) && onPlate(-3.2, 0) && !onPlate(0, 3.6) && !onPlate(3.5, 0) && !onPlate(HOLD.x, RAIL.z), "the plate's outline is the case's circle");
check(CELLS.every((_, i) => onPlate(...cellW(i))) && LEVER_W.every(l => onPlate(l.x, l.z)), "every cell and every lever is on the plate");

// ---------- the phone's tilt: small, soft at its end, springing back ----------
check(TILT_MAX >= 10 * Math.PI / 180 && TILT_MAX <= 15 * Math.PI / 180, "the tilt is about 10 to 15 degrees at most");
{
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

// ---------- the camera: the player's; it holds the case and the tray at home, and stays where it is put ----------
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

{
  // a drag turns and tilts the view and the result stays (nothing here springs back: there is no target to return to)
  const home = homeCam(0.6), a = orbit(home, 120, 0), b = orbit(home, 0, -2000), c = orbit(home, 0, 2000), d = orbit(a, 0, 0);
  check(a.az < home.az && near(a.el, home.el) && near(d.az, a.az) && near(d.el, a.el), "dragging right turns the case to the right, and the same view comes back unchanged (it does not drift or return)");
  check(near(b.el, EL_MIN) && near(c.el, EL_MAX) && EL_MIN <= 16 * Math.PI / 180 && EL_MAX >= 85 * Math.PI / 180, "the tilt reaches a low angle and nearly overhead, and no further");
  check(near(orbit(home, 100000, 0).az, wrapAz(home.az - 100000 * 0.0085)) && Math.abs(orbit(home, 100000, 0).az) <= Math.PI + 1e-9, "the turn goes all the way round (any number of turns)");
  check(zoomed(home, 100, 200).z < 1 && zoomed(home, 200, 100).z > 1 && near(zoomed(home, 100, 1e9).z, ZOOM_MIN) && near(zoomed(home, 1e9, 1).z, ZOOM_MAX), "spreading two fingers zooms in, pinching out, within a reach");
  check(isHome(home, 0.6) && !isHome(a, 0.6) && !isHome(b, 0.6) && isHome({ ...home, az: 2 * Math.PI }, 0.6), "the home view is told from a turned one");
  check(Math.abs(clampCam({ az: 9, el: -1, z: 5 }).az) <= Math.PI && clampCam({ az: 9, el: -1, z: 5 }).el === EL_MIN, "a kept view is clamped on the way in");
}
{
  // a touch lands where it looks at any angle: every lever, projected to the screen, picks itself again through the camera's plane
  let bad2 = 0, n = 0;
  for (const asp of [0.59, 0.46, 0.7, 1.45]) for (const az of [-3.1, -1.5, -0.4, 0, 0.9, 2, 3.1]) for (const el of [EL_MIN, 0.45, homeEl(asp), 1.4, EL_MAX]) for (const z of [ZOOM_MIN, 0.8, 1, ZOOM_MAX]) {
    const cam = { az, el, z };
    for (const l of LEVER_W) {
      const [nx, ny] = screenOf(cam, asp, [l.x, 0.02, l.z]), [px, pz] = planeAt(cam, asp, nx, ny, 0.02);
      n++;
      if (nearestLever(px, pz)?.e !== l.e) bad2++;
    }
  }
  check(bad2 === 0 && n > 10000, `every lever picks itself through the tilted plane (${n} views)`);
  const cam = { az: 1.2, el: 0.5, z: 0.8 }, [nx, ny] = screenOf(cam, 0.6, [HOLD.x, 0.03, HOLD.z]), [hx, hz] = planeAt(cam, 0.6, nx, ny, 0.03);
  check(holdAt(hx, hz) && onPlate(...planeAt(cam, 0.6, ...screenOf(cam, 0.6, [0, 0, 0]), 0)), "the hold and the plate are found through a turned view too");
  const F = camFrame({ az: 0.7, el: 0.9, z: 0.6 }, 0.6), G0 = camFrame({ az: 0.7, el: 0.9, z: 1 }, 0.6);
  check(near(F.H, G0.H * 0.6), "zoom scales the frame's height");
}

// ---------- the look ----------
const lum = hex => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255; return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const sat = hex => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255; return Math.max(r, g, b) - Math.min(r, g, b); };
for (const th of ["codex", "office"]) for (const night of [false, true]) {
  const s = skinFor(th, night), need = ["key", "keyI", "fill", "fillI", "sky", "ground", "hemiI", "exposure", "steel", "plate", "floor", "pad", "shadow", "envSky", "envGround", "envWin"];
  check(need.every(k => s[k] !== undefined && Number.isFinite(s[k])), `${th} by ${night ? "night" : "day"} has every colour and light`);
  check(sat(s.steel) < 24 && sat(s.plate) < 24 && sat(s.floor) < 24 && sat(s.pad) < 24 && lum(s.floor) < lum(s.plate) - 10, `${th} by ${night ? "night" : "day"}: the case, plate and seat floors are neutral silver, the floor a shade darker than the plate`);
}
check(["codex"].every(th => [false, true].every(n => JSON.stringify(skinFor(th, n)) === JSON.stringify(skinFor("office", n)))), "every theme has the same silver watch (no gold or brass skin)");
check(skinFor("codex", true).keyI < skinFor("codex", false).keyI && skinFor("codex", true).exposure > skinFor("codex", false).exposure, "night is a weaker sun and a longer exposure, as in Topple");
check(METALS.length === 4 && METALS.every(m => m.metalness > 0 && m.roughness > 0), "four finishes: gold, rose gold, steel, black");
{
  // the four types are told apart by hue and lightness, and (not by colour) by their windows and teeth
  const hue = hex => { const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1; return (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60; };
  const cs = METALS.map(m => m.color);
  let apart = true;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const dh = Math.min(Math.abs(hue(cs[i]) - hue(cs[j])), 360 - Math.abs(hue(cs[i]) - hue(cs[j]))), dl = Math.abs(lum(cs[i]) - lum(cs[j]));
    if (!(dl > 45 || dh >= 25 || Math.abs(sat(cs[i]) - sat(cs[j])) > 45)) apart = false;   // the bright metals are alike in lightness, as metals are: they differ in hue or in how much colour they carry
  }
  check(apart, "every two gear finishes differ by 45 in lightness, by 25 degrees of hue or by how much colour they carry (and the pitches by their teeth)");
  check(new Set(WINDOWS).size === 4 && SHAPES.every((sh, k) => k === 3 || new Set(SHAPES.map(x => x.n)).size >= 3), "every gear type has its own number of windows besides its own teeth");
}

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
  check(G.tabGeometry().attributes.position.count > 20 && G.chevronGeometry().attributes.position.count > 12 && G.ringGeometry(1, 0.9, 0.02).attributes.position.count > 100 && G.quadGeometry(1).attributes.uv.count === 4, "the lever's tab, the chevron, the ring and the quad build");
  check(new Set([0, 1, 2].map(k => G.gearGeometry(k).attributes.position.count)).size === 3, "the three pitches have different cutouts, not only different colours");
  check(gears.every(g => g.attributes.uv && g.attributes.uv.count === g.attributes.position.count), "each gear has the UVs its circular grain is laid by");

  // the engraving: made with Guilloche's machine, a normal map with every groove a V
  const T = await import("../shunt-3d-tex.js");
  const dial = T.dialNormals(256), grn = T.grainNormals(64);
  let tilted = 0;
  for (let i = 0; i < 256 * 256; i++) if (Math.abs(dial.data[i * 4] - 128) > 8 || Math.abs(dial.data[i * 4 + 1] - 128) > 8) tilted++;
  check(dial.data.length === 256 * 256 * 4 && tilted > 256 * 256 * 0.2 && tilted < 256 * 256 * 0.98, "the dial is engraved (the ring cut deep, the field brushed lightly) with some left flat");
  const lean = (r0, r1, big) => { let n = 0, k = 0; for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) { const r = Math.hypot(x + 0.5 - 128, y + 0.5 - 128) / 128; if (r < r0 || r >= r1) continue; n++; const i = (y * 256 + x) * 4; if (Math.hypot(dial.data[i] - 128, dial.data[i + 1] - 128) > big) k++; } return k / n; };
  check(lean(0.1, 0.82, 30) < 0.03 && lean(0.1, 0.82, 4) > 0.3 && lean(0.87, 0.99, 30) > 0.4 && lean(0.83, 0.86, 30) > 0.4, "the field is quiet (a light, even brushing, no deep cuts) while the ring and its turned band are cut deep");
  check(!("perlageNormals" in T), "there is no perlage: the seat floors carry no dots");
  check(grn.data.length === 64 * 64 * 4 && [dial, grn].every(d => { for (let i = 2; i < d.data.length; i += 4) if (d.data[i] < 128) return false; return true; }), "the dial and the grain build, every normal pointing out of the surface");
  check(T.DIAL.some(c => c.kind === "rays") && T.DIAL.filter(c => c.kind === "ring").length >= 2 && !T.DIAL.some(c => c.kind === "lines"), "the ring is a sunburst between two fine rings, cut by guilloche-engine.js, and there is no clous de Paris (lines at a right angle)");
  const hh = new Float32Array(64 * 64); T.brush(hh, 64);
  check(hh[32 * 64 + 52] !== 0 && hh[0] === 0 && new Set(Array.from({ length: 24 }, (_, k) => hh[32 * 64 + 40 + k % 8 + 0 * k].toFixed(4))).size > 3, "the brushed field is lines from the middle, none outside it, each its own height");
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
  check(/onCam\?\.\(custom \?/.test(v3) && /: null\);/.test(v3) && /cam: readCam\(kp\), onCam: c => write\(CAM, c\)/.test(js), "the camera is kept under shunt:cam when the player moves it, and the home view is handed over as null, never a default");
  check(!/dragT/.test(v3) && /sh-level/.test(v3) && /lastTap/.test(v3) && /"wheel"/.test(v3), "a drag no longer feeds the spring; there is a Level button, a double tap and a wheel zoom");
  const css = fs.readFileSync(root + "shunt.css", "utf8");
  check(/#app\.view3d \.sh-tray/.test(css), "the flat tray gives way to the movement's own tray");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
