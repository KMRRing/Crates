// Factor's camera (factor-camera.js, which has no three.js and no page in it): where the island sits in the box at any turn
// and height, the clamps on what a player can do, the opening view (steeper than the 46° it began with), what a resize
// keeps of an arranged view, and the text kept for this device. The island's own points come from factor-3d.js (OUTLINE).
import { DEG, MIN_ELEV, MAX_ELEV, PREFER, MAX_ZOOM, FLICK, FITTED, flick, coasted, clampElev, clampZoom, wrapYaw, extent, frame, sizeAt, fitted, viewIn, isFitted, encode, decode } from "../factor-camera.js";
import { OUTLINE } from "../factor-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
// the boards' sizes as the page lays them out: 390 by 600, 664 and 844, an iPad upright and sideways
const BOXES = [[358, 282], [358, 346], [358, 466], [750, 627], [721, 683]];

// ---------- the clamps ----------
check(near(MIN_ELEV, 30 * DEG) && near(MAX_ELEV, 88 * DEG), "the camera goes from 30° to 88° up");
check(clampElev(0) === MIN_ELEV && clampElev(-5) === MIN_ELEV && clampElev(Math.PI / 2) === MAX_ELEV && clampElev(9) === MAX_ELEV, "a height outside the limits is brought to the nearest");
check(clampElev(1) === 1, "a height inside the limits is left alone");
let turnsOk = true;
for (let i = 0; i < 400; i++) {
  const y = (rnd() - 0.5) * 200, w = wrapYaw(y);
  if (!(w >= -Math.PI && w < Math.PI) || !near(Math.sin(w), Math.sin(y), 1e-9) || !near(Math.cos(w), Math.cos(y), 1e-9)) turnsOk = false;
}
check(turnsOk, "a turn of any size (round and round) wraps to the same direction within -π..π");
check(clampZoom(0) === 1 && clampZoom(-3) === 1 && clampZoom(99) === MAX_ZOOM && clampZoom(NaN) === 1 && clampZoom(2) === 2, `the zoom stays between 1 and ${MAX_ZOOM}`);

// ---------- the island in the box at any pose ----------
// the same projection written another way: from the camera's own axes
function reference(points, yaw, elev) {
  const c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev);
  const eye = [0, s * 30 + 0, k * 30 + 0.15], fwd = [0, -s, -k], right = [1, 0, 0], up = [0, k, -s];
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const [x, y, z] of points) {
    const p = [x * c + z * n, y, -x * n + z * c], d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], depth = dot(d, fwd);
    u0 = Math.min(u0, dot(d, right) / depth); u1 = Math.max(u1, dot(d, right) / depth);
    v0 = Math.min(v0, dot(d, up) / depth); v1 = Math.max(v1, dot(d, up) / depth);
  }
  return { u0, u1, v0, v1 };
}
{
  let agree = true, fits = true, fills = true, aspect = true;
  for (let i = 0; i < 60; i++) {
    const yaw = (rnd() - 0.5) * 8, elev = MIN_ELEV + rnd() * (MAX_ELEV - MIN_ELEV), [w, h] = BOXES[i % BOXES.length];
    const a = extent(OUTLINE, yaw, elev), b = reference(OUTLINE, yaw, elev);
    if (!["u0", "u1", "v0", "v1"].every(k => near(a[k], b[k], 1e-9))) agree = false;
    const f = frame(OUTLINE, yaw, elev, w, h);
    if (!OUTLINE.every(([x, y, z]) => {
      const c = Math.cos(yaw), n = Math.sin(yaw), s = Math.sin(elev), k = Math.cos(elev);
      const rx = x * c + z * n, rz = -x * n + z * c - (k * 30 + 0.15), ry = y - s * 30, depth = -s * ry - k * rz;
      return Math.abs(rx / depth - f.cu) <= f.hu + 1e-9 && Math.abs((k * ry - s * rz) / depth - f.cv) <= f.hv + 1e-9;
    })) fits = false;
    if (!near(f.hu / f.hv, w / h, 1e-9)) aspect = false;
    const wide = (a.u1 - a.u0) / 2 * 1.015, tall = (a.v1 - a.v0) / 2 * 1.015;
    if (!near(f.hu, wide, 1e-9) && !near(f.hv, tall, 1e-9)) fills = false;       // touches the box's width or its height
  }
  check(agree, "the extent agrees with a projection from the camera's own axes at 60 random turns and heights");
  check(fits, "every point of the island is inside the frame at every turn and height, in every box");
  check(fills, "the frame is as tight as the box allows: it fills the width or the height");
  check(aspect, "the frame has the box's shape");
}
{
  // the island's size varies little as it turns, so turning it doesn't make it breathe
  for (const [w, h] of [BOXES[1], BOXES[4]]) {
    const sizes = Array.from({ length: 36 }, (_, i) => sizeAt(OUTLINE, i * 10 * DEG, 63 * DEG, w, h));
    check(Math.max(...sizes) / Math.min(...sizes) < 1.08, `${w}×${h}: turned all the way round at 63°, the island's size changes by under 8% (${(100 * (Math.max(...sizes) / Math.min(...sizes) - 1)).toFixed(1)}%)`);
  }
}

// ---------- the opening view ----------
check(near(PREFER, 63 * DEG), "the island opens at 63° where the box allows (it opened at 46°; Korbi found that too shallow, 3 November 2026)");
{
  const picks = BOXES.map(([w, h]) => ({ w, h, ...fitted(OUTLINE, w, h) }));
  for (const p of picks) check(p.elev > 46 * DEG + 1e-9, `${p.w}×${p.h}: opens at ${(p.elev / DEG).toFixed(0)}°, above the old 46°`);
  for (const [w, h] of [BOXES[1], BOXES[2], BOXES[4]]) check(near(fitted(OUTLINE, w, h).elev, PREFER), `${w}×${h}: a box with room opens at the preferred height`);
  check(picks.every(p => p.yaw === 0 || near(p.yaw, Math.PI / 2)), "it opens flat side to you or turned a quarter, as the fit has always chosen");
  check(picks.every(p => p.elev >= MIN_ELEV && p.elev <= MAX_ELEV), "the opening height is within what a player can reach");
  let big = true;
  for (const { w, h, yaw, elev } of picks) {
    let top = 0;
    for (const y of [0, Math.PI / 2]) for (let d = 30; d <= 80; d++) top = Math.max(top, sizeAt(OUTLINE, y, d * DEG, w, h) * (y ? 0.97 : 1));
    if (sizeAt(OUTLINE, yaw, elev, w, h) * (yaw ? 0.97 : 1) < top * 0.95) big = false;
  }
  check(big, "the opening island is within 5% of the largest the box allows, so it still fills the width");
  const flip = fitted(OUTLINE, 358, 282), roomy = fitted(OUTLINE, 358, 466);
  check(flip.elev < roomy.elev, "a short box opens lower than a tall one (a steeper view would make the island small)");
  let always = true;
  for (let w = 300; w <= 1400; w += 100) for (let h = 280; h <= 900; h += 60) {
    const f = fitted(OUTLINE, w, h);
    if (w / h <= 1.3 && f.elev < 46 * DEG) always = false;                       // any box as tall as 390×600's is steeper than before
  }
  check(always, "no box as tall as a phone's smallest opens lower than the old 46°");
}

// ---------- what a resize keeps ----------
{
  const mine = { turn: { yaw: 2.1, elev: 0.7 }, zoom: 2, px: 0.5, py: -0.25 };
  const a = viewIn(mine, OUTLINE, 358, 346), b = viewIn(mine, OUTLINE, 720, 683), c = viewIn(mine, OUTLINE, 358, 282);
  check(a.yaw === 2.1 && b.yaw === 2.1 && c.yaw === 2.1 && a.elev === 0.7 && b.elev === 0.7 && c.elev === 0.7, "an arranged view keeps its turn and height when the box changes shape");
  check(a.base.hv !== b.base.hv && near(b.base.hu / b.base.hv, 720 / 683) && near(a.base.hu / a.base.hv, 358 / 346), "…and the scale is refitted to the box");
  check(a.zoom === 2 && b.zoom === 2, "…and the zoom is kept");
  check(near(a.panU / (a.base.hu - a.base.hu / 2), 0.5) && near(b.panU / (b.base.hu - b.base.hu / 2), 0.5) && near(b.panV / (b.base.hv - b.base.hv / 2), -0.25), "…and the move, as a share of what the zoom allows");
  const f1 = viewIn(FITTED, OUTLINE, 358, 466), f2 = viewIn(FITTED, OUTLINE, 358, 282);
  check(f1.elev !== f2.elev, "the fitted view, though, follows the box: a phone turned or a box resized refits the angle");
  const low = viewIn({ turn: { yaw: 0, elev: 0.01 }, zoom: 1, px: 0, py: 0 }, OUTLINE, 358, 346), high = viewIn({ turn: { yaw: 0, elev: 3 }, zoom: 1, px: 0, py: 0 }, OUTLINE, 358, 346);
  check(low.elev === MIN_ELEV && high.elev === MAX_ELEV, "a kept height outside the limits is brought inside rather than shown broken");
  const z = viewIn({ turn: null, zoom: 9, px: 5, py: -5 }, OUTLINE, 358, 346);
  check(z.zoom === MAX_ZOOM && near(z.panU, z.base.hu - z.base.hu / MAX_ZOOM) && near(z.panV, -(z.base.hv - z.base.hv / MAX_ZOOM)), "a zoom or move beyond what the picture allows is held to its edge");
  const still = viewIn({ turn: null, zoom: 1, px: 0.7, py: 0.7 }, OUTLINE, 358, 346);
  check(still.panU === 0 && still.panV === 0, "an unzoomed view can't be moved");
}

// ---------- what is kept for this device ----------
{
  check(isFitted(FITTED) && encode(FITTED) === null, "the fitted view has nothing to keep");
  check(encode({ turn: null, zoom: 1.00001, px: 0, py: 0 }) === null, "…nor does a zoom of a hair");
  const mine = { turn: { yaw: -2.4, elev: 0.9 }, zoom: 1.7, px: 0.3, py: -0.6 }, back = decode(encode(mine));
  check(near(back.turn.yaw, -2.4, 1e-3) && near(back.turn.elev, 0.9, 1e-3) && near(back.zoom, 1.7, 1e-3) && near(back.px, 0.3, 1e-3) && near(back.py, -0.6, 1e-3), "an arranged view comes back from its text, to a thousandth");
  const zoomed = decode(encode({ turn: null, zoom: 2.5, px: 1, py: 0 }));
  check(zoomed.turn === null && zoomed.zoom === 2.5 && zoomed.px === 1, "a zoom alone is kept without a turn, so the fitted angle still follows the box");
  check(typeof encode(mine) === "string" && encode(mine).length < 80, "the text is short");
  for (const junk of [null, undefined, "", "nonsense", "{", "[]", "42", "null", '"x"', { yaw: "a", elev: "b" }]) check(isFitted(decode(junk)), `${JSON.stringify(junk)} is the fitted view`);
  const wild = decode(JSON.stringify({ yaw: 100, elev: 5, z: 99, px: 7, py: -7 }));
  check(wild.turn.elev === MAX_ELEV && wild.turn.yaw >= -Math.PI && wild.turn.yaw < Math.PI && wild.zoom === MAX_ZOOM && wild.px === 1 && wild.py === -1, "a kept view out of range is brought within it");
  check(decode(JSON.stringify({ yaw: 1 })).turn === null, "a turn without a height isn't one");
  check(decode(JSON.stringify({ yaw: NaN, elev: 1 })).turn === null && decode('{"yaw":1e999,"elev":1}').turn === null, "a turn that isn't a number is dropped");
}

// ---------- a flick's coast ----------
{
  check(flick(0, 0) === null && flick(0.1, 0.1) === null && flick(NaN, 1) === null, "a drag that ends slowly leaves no coast");
  const hard = flick(30, -40), soft = flick(0.3, 0);
  check(near(Math.hypot(hard.vx, hard.vy), FLICK.most) && near(hard.vx / hard.vy, -0.75), "a hard flick is held to the greatest speed, in its own direction");
  check(soft.vx === 0.3 && soft.vy === 0, "a gentle one keeps its speed");
  let c = { ...hard }, t = 0, dist = 0, done = false;
  while (!done && t < 5000) { const k = coasted(c, 16); dist += Math.hypot(k.dx, k.dy); c = k; done = k.done; t += 16; }
  check(done && t < 2500, `a coast comes to rest (after ${t} ms)`);
  check(dist < FLICK.most * FLICK.tau * 1.1 && dist > FLICK.most * FLICK.tau * 0.5, `…having gone about ${Math.round(dist)} px at the most (a little inertia, not a spin)`);
  const slow = coasted({ vx: 1, vy: 0 }, 5000);
  check(near(slow.dx, 50), "a frame that took seconds moves it only 50 ms' worth");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
