// Backgammon's 3D view (Menu, View): a WebGL board (gammon-3d.js) as a second drawing of the flat board's own view. The pure parts are
// tested here without three.js: where things stand (gammon-geom.js), the camera's fit and limits and the picking of a tap (gammon-cam.js);
// and how the page wires it: the flat board the default, the choice and the camera the device's own, never written by a watching frame.
import { readFileSync } from "node:fs";
import { spot, colAt, slotOf, countsOf, reconcile, diceSpots, cubeSpot, OUTLINE, FIELD, BAR, TRAY, R, TH } from "../gammon-geom.js";
import { DEG, MIN_ELEV, MAX_ELEV, MAX_ZOOM, FITTED, clampElev, clampZoom, wrapYaw, extent, fitted, viewIn, isFitted, encode, decode, rayAt, onPlane, pickAt, screenOf } from "../gammon-cam.js";
import { start } from "../gammon-board.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------- where things stand ----------
const xs = [];
for (let i = 1; i <= 24; i++) xs.push(`${spot(i).x}:${spot(i).top}`);
check(new Set(xs).size === 24, "the 24 points are 24 different places");
check(spot(6).x < spot(1).x && spot(19).x < spot(24).x && spot(7).x > spot(12).x && spot(18).x > spot(13).x, "numbered as the flat board: 6 by the bar and 1 at the right edge, 7 by the bar and 12 at the left, 13 at the left and 19 by the bar");
check(!spot(1).top && !spot(12).top && spot(13).top && spot(24).top, "points 1 to 12 are on your row, 13 to 24 on theirs");
check(near(spot(6).x, spot(19).x) && near(spot(1).x, spot(24).x) && near(spot(12).x, spot(13).x) && near(spot(7).x, spot(18).x), "a point faces the one across the board");
let colsOk = true;
for (let i = 1; i <= 24; i++) { const { x, top } = spot(i); if (colAt(x, top ? -3 : 3) !== i || colAt(x + 0.4, top ? -0.8 : 5) !== i || colAt(x - 0.4, top ? -5 : 0.6) !== i) colsOk = false; }
check(colsOk, "a tap anywhere in a point's column, from its tip to its base and across its width, is that point");
check(colAt(BAR.x, 2) === 25 && colAt(BAR.x, -2) === null, "the bar is yours below the middle, and nothing above it");
check(colAt(TRAY.x, 2) === 0 && colAt(TRAY.x, -2) === null, "the tray is yours below the middle, and nothing above it");
check(colAt(-9, 0) === null && colAt(0, 8) === null && colAt(20, 2) === null && colAt(FIELD.x0 - 0.1, 3) === null, "the frame and what is beyond it is no tap");
const cnt = Array(26).fill(0), pos = start();
for (let i = 1; i <= 24; i++) cnt[i] = pos[i];
let clear = true, inside = true;
for (let i = 1; i <= 24; i++) {
  const { top } = spot(i), ps = [];
  for (let k = 0; k < 15; k++) ps.push(slotOf(0, i, k));
  for (let a = 0; a < 15; a++) for (let b = a + 1; b < 15; b++) if (Math.hypot(ps[a].x - ps[b].x, ps[a].z - ps[b].z, (ps[a].y - ps[b].y) * 1) < 2 * R - 1e-9 && Math.abs(ps[a].y - ps[b].y) < TH - 1e-9) clear = false;
  for (const p of ps) if (Math.abs(p.z) > FIELD.z || (top ? p.z >= 0 : p.z <= 0)) inside = false;
}
check(clear, "no two checkers of a point share room (five lie along it, the next five on those)");
check(inside, "a point's checkers stay on its half of the board");
const s5 = [0, 1, 2, 3, 4].map(k => slotOf(0, 6, k)), s6 = slotOf(0, 6, 5);
check(near(s5[1].z - s5[0].z, -2 * R) && near(s6.z, s5[0].z) && near(s6.y - s5[0].y, TH), "five lie along a point, a base-first, and the sixth lies on the first");
check(slotOf(0, 25, 0).z > 0 && slotOf(1, 25, 0).z < 0 && slotOf(0, 0, 0).z > 0 && slotOf(1, 0, 0).z < 0, "yours are below the middle on the bar and in the tray, theirs above");
check(slotOf(0, 0, 3).edge && !slotOf(0, 6, 3).edge && near(slotOf(0, 0, 0).z - slotOf(0, 0, 1).z, 0.25), "the borne-off stand on their rims in the tray, slim as slabs");
const [mine, theirs] = countsOf(start(), start());
check(mine[6] === 5 && mine[24] === 2 && theirs[19] === 5 && theirs[1] === 2 && theirs[17] === 3 && theirs[12] === 5, "their checkers are counted on your numbering: their 6 point is your 19, their 24 your 1");
check(mine.reduce((a, b) => a + b) === 15 && theirs.reduce((a, b) => a + b) === 15, "fifteen a side");
// moving
{
  const recs = [];
  let r = reconcile(recs, mine);
  check(r.snap && recs.length === 15 && recs.every(x => x.k < mine[x.loc]), "the first sight of a position puts every checker in place, with nothing to animate");
  const next = mine.slice(); next[13]--; next[11]++;
  r = reconcile(recs, next);
  const mv = r.moved.map(i => recs[i]);
  check(!r.snap && mv.length === 1 && mv[0].loc === 11 && mv[0].k === 0, "a move is the top checker of 13 going to the first place at 11");
  const next2 = next.slice(); next2[6]--; next2[25]++;
  r = reconcile(recs, next2);
  check(r.moved.length === 1 && recs[r.moved[0]].loc === 25, "a checker sent to the bar arrives at the bar");
  r = reconcile(recs, next2);
  check(r.moved.length === 0, "the same position again moves nothing");
  const dbl = next2.slice(); dbl[24] = 0; dbl[18] = 2;
  r = reconcile(recs, dbl);
  check(r.moved.length === 2 && r.moved.every(i => recs[i].loc === 18), "two checkers moving together both go");
  const off = dbl.slice(); off[6]--; off[0]++;
  r = reconcile(recs, off);
  check(recs[r.moved[0]].loc === 0 && recs[r.moved[0]].k === 0, "a checker borne off goes to the tray");
  const fresh = Array(26).fill(0); fresh[12] = 15;
  r = reconcile(recs, fresh);
  check(r.snap && recs.length === 15, "a different number of checkers (a new game) snaps, with nothing to pair");
}
check(diceSpots(2, true).every(d => d.x > BAR.x + 1) && diceSpots(2, false).every(d => d.x < BAR.x - 1), "your dice lie in the right half, theirs in the left");
check(diceSpots(4, true).every(d => Math.abs(d.z) < 0.6), "four dice for a double stay in the middle band, between the points' tips");
check(cubeSpot(-1, 0).z === 0 && cubeSpot(0, 0).z > 3 && cubeSpot(1, 0).z < -3, "the cube is mid-bar until doubled, then at its owner's end");

// ---------- the camera ----------
const BOXES = [[358, 282], [358, 435], [358, 615], [750, 845], [836, 657], [721, 683]];
check(near(MIN_ELEV, 28 * DEG) && near(MAX_ELEV, 88 * DEG), "the camera goes from 28° to 88°: never under the board");
check(clampElev(-1) === MIN_ELEV && clampElev(0) === MIN_ELEV && clampElev(3) === MAX_ELEV && clampElev(1) === 1 && clampElev(NaN) > MIN_ELEV, "a height outside the limits is brought to the nearest");
check(clampZoom(0) === 1 && clampZoom(99) === MAX_ZOOM && clampZoom(NaN) === 1 && clampZoom(2) === 2, `the zoom stays between 1 and ${MAX_ZOOM}`);
let wrapOk = true;
for (let i = 0; i < 200; i++) { const y = (rnd() - 0.5) * 100, w = wrapYaw(y); if (!(w >= -Math.PI && w < Math.PI) || !near(Math.sin(w), Math.sin(y)) || !near(Math.cos(w), Math.cos(y))) wrapOk = false; }
check(wrapOk, "a turn of any size wraps to the same direction within -π..π");
// the whole board is in the box at every pose, as the flat board always is
let fits = true, tight = true;
for (const [w, h] of BOXES) for (let i = 0; i < 60; i++) {
  const turn = { yaw: (rnd() - 0.5) * 7, elev: MIN_ELEV + rnd() * (MAX_ELEV - MIN_ELEV) }, v = viewIn({ turn, zoom: 1, px: 0, py: 0 }, OUTLINE, w, h);
  const px = OUTLINE.map(p => screenOf(v, p, w, h));
  if (px.some(([x, y]) => x < -0.5 || y < -0.5 || x > w + 0.5 || y > h + 0.5)) fits = false;
  const xs2 = px.map(p => p[0]), ys2 = px.map(p => p[1]);
  if (Math.max(Math.max(...xs2) - Math.min(...xs2) > w * 0.9, Math.max(...ys2) - Math.min(...ys2) > h * 0.9) === false) tight = false;
}
check(fits, "at any turn and height the board is wholly inside the box (it is fitted, never cut off)");
check(tight, "and it fills the box: the wider or the taller of its sides is at least nine tenths of it");
let fillsOk = true;
for (const [w, h] of BOXES) { const f = fitted(OUTLINE, w, h), v = viewIn(FITTED, OUTLINE, w, h), px = OUTLINE.map(p => screenOf(v, p, w, h)); if (Math.max(...px.map(p => p[0])) - Math.min(...px.map(p => p[0])) < 0.8 * w && Math.max(...px.map(p => p[1])) - Math.min(...px.map(p => p[1])) < 0.8 * h) fillsOk = false; if (!(f.elev >= 30 * DEG && f.elev <= 80 * DEG)) fillsOk = false; }
check(fillsOk, "the opening view fills its box and sits between 30° and 80°");
check(fitted(OUTLINE, 836, 657).yaw === 0 && fitted(OUTLINE, 400, 300).yaw === 0, "held sideways the board opens with you at the near side, as the flat board has it");
check(fitted(OUTLINE, 358, 615).yaw === -Math.PI / 2 && fitted(OUTLINE, 750, 845).yaw === -Math.PI / 2, "held upright in a tall box it opens turned a quarter, your home board at the bottom, drawn larger");
check(fitted(OUTLINE, 358, 282).yaw === 0, "but a box too short for that keeps it as the flat board has it");
// the same pose, the pixels the other way: a ray through a pixel meets the board where the pixel's point is
let rayOk = true;
for (let i = 0; i < 200; i++) {
  const [w, h] = BOXES[i % BOXES.length], v = viewIn({ turn: { yaw: (rnd() - 0.5) * 7, elev: MIN_ELEV + rnd() * (MAX_ELEV - MIN_ELEV) }, zoom: 1 + rnd() * 1.6, px: rnd() * 2 - 1, py: rnd() * 2 - 1 }, OUTLINE, w, h);
  const x = (rnd() - 0.5) * 14, z = (rnd() - 0.5) * 10, y = rnd() * 0.5, [sx, sy] = screenOf(v, [x, y, z], w, h), hit = onPlane(rayAt(v, sx, sy, w, h), y);
  if (!hit || !near(hit[0], x, 1e-6) || !near(hit[1], z, 1e-6)) rayOk = false;
}
check(rayOk, "a ray through a point's pixel meets the board's plane at that point, at any pose, zoom and move");
// a tap picks the point whose column it is on, at any turn, height and zoom
let picks = 0, wrong = 0;
for (let i = 0; i < 400; i++) {
  const [w, h] = BOXES[i % BOXES.length], i24 = 1 + (i % 24), sl = slotOf(0, i24, i % 5);
  const v = viewIn({ turn: { yaw: (rnd() - 0.5) * 7, elev: MIN_ELEV + rnd() * (MAX_ELEV - MIN_ELEV) }, zoom: 1 + rnd() * 0.5, px: rnd() * 0.4 - 0.2, py: rnd() * 0.4 - 0.2 }, OUTLINE, w, h);
  const [sx, sy] = screenOf(v, [sl.x, 0.12, sl.z], w, h);
  if (sx < 0 || sy < 0 || sx > w || sy > h) continue;
  picks++;
  if (pickAt(v, sx, sy, w, h) !== i24) wrong++;
}
check(picks > 250 && wrong === 0, `a tap on a point's checkers picks that point (${picks} taps, ${wrong} wrong)`);
{
  const v = viewIn(FITTED, OUTLINE, 358, 435);
  const bar = slotOf(0, 25, 1), tray = { x: TRAY.x, y: 0.1, z: 2.7 };
  check(pickAt(v, ...screenOf(v, [bar.x, bar.y, bar.z], 358, 435), 358, 435) === 25 && pickAt(v, ...screenOf(v, [tray.x, 0.12, tray.z], 358, 435), 358, 435) === 0, "taps on the bar and the tray pick them");
  check(pickAt(v, 1, 1, 358, 435) === null && pickAt(v, 179, 10, 358, 435) === null, "a tap off the board is none");
}
const t = viewIn({ turn: { yaw: 0, elev: 1.5 * DEG * 90 }, zoom: 1, px: 0, py: 0 }, OUTLINE, 358, 435);
check(near(t.elev, MAX_ELEV) || t.elev <= MAX_ELEV, "a camera asked for beyond the limit is held at it");
// what is kept
check(encode(FITTED) === null && isFitted(FITTED), "the fitted view keeps nothing");
const arranged = { turn: { yaw: 5, elev: 0.1 }, zoom: 9, px: 3, py: -3 }, back = decode(encode(arranged));
check(back.zoom === MAX_ZOOM && back.px === 1 && back.py === -1 && near(back.turn.elev, MIN_ELEV, 1e-3) && near(back.turn.yaw, wrapYaw(5), 1e-3), "a kept view comes back inside the limits");
check(isFitted(decode("junk")) && isFitted(decode(null)) && isFitted(decode('{"z":"a"}')), "a damaged key is the fitted view");
const e1 = extent(OUTLINE, 0, 60 * DEG);
check(e1.u1 > e1.u0 && e1.v1 > e1.v0, "the board has a size in the view");

// ---------- how the page wires it ----------
const js = read("gammon.js"), css = read("gammon-3d.css"), html = read("gammon.html"), g3 = read("gammon-3d.js");
check(/tableView\("gammon"/.test(js) && /view\.choice\(/.test(js), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d" && !lost3d/.test(js), "the 3D board is made only when the device's own choice says 3D, so flat is the default");
check(/import\("\.\/gammon-3d\.js"\)/.test(js) && !/^import .*gammon-3d/m.test(js), "the 3D module is loaded when asked for, not at start-up");
check(/catch \(err\)[\s\S]{0,200}lost3d = true/.test(js) && /onLost/.test(js), "no WebGL, or a lost context, falls back to the flat board");
check(/const CAM = "suite:gammon-cam"/.test(js) && /if \(IN_FRAME\) return;/.test(js.slice(js.indexOf("const keepCam"), js.indexOf("const keepCam") + 90)), "the camera is the device's own and a watching frame never writes it");
check(/board3d\.dispose\(\)/.test(js), "going back to the flat board lets go of the GPU");
check(!/alert\(|confirm\(|prompt\(/.test(g3 + js.slice(js.indexOf("const view = tableView"))), "no browser pop-ups");
check(/pixelRatio|setPixelRatio\(Math\.max\(1, Math\.min\(devicePixelRatio \|\| 1, 2/.test(g3), "the pixel ratio is capped at 2");
check(/< 30\) \{/.test(g3) && !/setInterval/.test(g3), "frames are drawn on demand, 30 a second at the most, with no idle loop");
check(html.includes("gammon-3d.css") && /touch-action: none/.test(css), "the page links the 3D stylesheet and the canvas takes every touch");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "")), "sizes in rem, not px");
check(!/gm-svg[^{]*\{[^}]*rotateX/.test(css), "the CSS-tipped plane is gone");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
