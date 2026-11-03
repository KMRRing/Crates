// The chart's zoom (bridges-zoom.js): a view never leaves the board, the point under a finger stays under it through a pinch, a
// drag and a wheel, the viewBox fills the element's own shape, and the unzoomed board is drawn exactly as it always was.
import { MIN_ZOOM, MAX_ZOOM, clampZoom, scaleOf, region, clampView, toBoard, place, zoomAbout, viewBoxOf, pinchZoom, wheelFactor } from "../bridges-zoom.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// a board with the margin a strait's badge takes on two sides (bridges.js: 11 cells and 0.3 of padding, the margin on top and left)
const box = { x: -1.23, y: -1.23, w: 12.53, h: 12.53 };
const phone = { w: 342, h: 360 }, wide = { w: 700, h: 640 }, tall = { w: 300, h: 700 };

check(clampZoom(0.2) === MIN_ZOOM && clampZoom(99) === MAX_ZOOM && clampZoom(2) === 2 && clampZoom(NaN) === MIN_ZOOM && clampZoom(Infinity) === MIN_ZOOM, "the zoom is held between 1 and 3 (NaN and infinity are 1)");

// ---------- the whole board ----------
for (const px of [phone, wide, tall]) {
  const v = clampView(box, px, { z: 1, cx: 0, cy: 0 }), r = region(box, px, v);
  check(near(v.cx, box.x + box.w / 2) && near(v.cy, box.y + box.h / 2), `${px.w}x${px.h}: at 1 the board is centred, wherever the view was put`);
  check(r.w >= box.w - 1e-9 && r.h >= box.h - 1e-9 && near(r.w / r.h, px.w / px.h), `${px.w}x${px.h}: the region holds the whole board and is the element's own shape`);
}
check(viewBoxOf(box, phone, { z: 1, cx: 3, cy: 3 }) === `${box.x} ${box.y} ${box.w} ${box.h}`, "at 1 the viewBox is the board's own, as it was drawn before there was a zoom");

// ---------- a view stays on the board ----------
let worst = 0, shapes = 0;
for (const px of [phone, wide, tall]) for (let z = 1; z <= 3; z += 0.25) for (const [cx, cy] of [[-50, -50], [-1.23, 0], [5, 5], [11.3, 11.3], [90, 4], [4, 90]]) {
  const v = clampView(box, px, { z, cx, cy }), r = region(box, px, v);
  // where the region is smaller than the board it is inside it; where it is larger it is centred, which also shows the whole board
  const fits = (r.w < box.w ? r.x >= box.x - 1e-9 && r.x + r.w <= box.x + box.w + 1e-9 : near(r.x + r.w / 2, box.x + box.w / 2)) && (r.h < box.h ? r.y >= box.y - 1e-9 && r.y + r.h <= box.y + box.h + 1e-9 : near(r.y + r.h / 2, box.y + box.h / 2));
  if (!fits) worst++;
  if (near(r.w / r.h, px.w / px.h)) shapes++;
}
check(worst === 0, "from any zoom and any middle, a clamped view keeps the board in view (inside it, or centred where it is smaller than the screen)");
check(shapes === 3 * 9 * 6, "every view's region is the shape of the element, so nothing of the board shows beside it");
check(near(region(box, phone, { z: 3, cx: 5, cy: 5 }).w * 3, region(box, phone, { z: 1, cx: 5, cy: 5 }).w), "three times the zoom shows a third of the width");
check(near(scaleOf(box, phone, 2), 2 * scaleOf(box, phone, 1)), "the pixels to a cell double with the zoom");

// ---------- the point under a finger stays under it ----------
// wherever the edge did not stop the view the point stays exactly where the finger is; where it did, the view is the nearest one
// that stays on the board (never a jump to the middle)
let exact = 0, stopped = 0, off = 0;
for (const px of [phone, wide, tall]) for (const at of [[px.w / 2, px.h / 2], [40, 40], [px.w - 40, px.h - 60], [px.w / 2, 30]]) for (const [z0, z1] of [[1, 2], [1.5, 3], [3, 1.4], [2, 2.5], [2.8, 3]]) {
  const v0 = clampView(box, px, { z: z0, cx: 5.2, cy: 5.2 }), p = toBoard(box, px, v0, at[0], at[1]), s1 = scaleOf(box, px, z1);
  const ideal = { z: z1, cx: p.x - at[0] / s1 + px.w / s1 / 2, cy: p.y - at[1] / s1 + px.h / s1 / 2 };
  const got = zoomAbout(box, px, v0, z1, at[0], at[1]), q = toBoard(box, px, got, at[0], at[1]);
  if (near(got.cx, ideal.cx, 1e-9) && near(got.cy, ideal.cy, 1e-9)) { exact++; if (Math.hypot(p.x - q.x, p.y - q.y) > 1e-6) off++; }
  else { stopped++; const c = clampView(box, px, ideal); if (!near(c.cx, got.cx, 1e-9) || !near(c.cy, got.cy, 1e-9)) off++; }
}
check(off === 0 && exact > 20, `zooming about a finger keeps the board under it (${exact} exact, ${stopped} held at the board's edge, ${off} wrong)`);
const mid = zoomAbout(box, phone, clampView(box, phone, { z: 1, cx: 5.2, cy: 5.2 }), 2, phone.w / 2, phone.h / 2);
check(near(mid.cx, box.x + box.w / 2) && near(mid.cy, box.y + box.h / 2), "zooming about the middle of the screen on the whole board stays centred");

// a drag: grab the board point under the finger, move the finger, the same point is under it
{
  const v0 = clampView(box, phone, { z: 2.5, cx: 5.2, cy: 5.2 }), grab = toBoard(box, phone, v0, 200, 220), v1 = place(box, phone, v0.z, grab, 150, 190), back = toBoard(box, phone, v1, 150, 190);
  check(near(back.x, grab.x, 1e-6) && near(back.y, grab.y, 1e-6), "a drag keeps the grabbed point under the finger");
  const far = place(box, phone, v0.z, grab, 1e5, 1e5), r = region(box, phone, far);
  check(r.x >= box.x - 1e-9 && r.y >= box.y - 1e-9, "dragging a long way stops at the board's edge");
}

// ---------- a pinch ----------
check(near(pinchZoom(1, 100, 200), 2) && pinchZoom(1, 100, 900) === MAX_ZOOM && pinchZoom(2, 100, 10) === MIN_ZOOM && pinchZoom(1.5, 0, 50) === MAX_ZOOM, "a pinch scales the zoom by how the fingers spread, held between 1 and 3");
check(wheelFactor(-100) > 1 && wheelFactor(100) < 1 && near(wheelFactor(100) * wheelFactor(-100), 1) && wheelFactor(0) === 1, "a wheel zooms in forward and out back, by the same amount each way");
check(wheelFactor(-3, 1) > wheelFactor(-100) - 0.0001 || wheelFactor(-3, 1) > 1.05, "a wheel counting lines (Firefox) is as strong as one counting pixels");

// ---------- a view that did not fit the screen it was made for ----------
{
  const v = { z: 3, cx: 11, cy: 11 }, rot = clampView(box, { w: 700, h: 300 }, v), r = region(box, { w: 700, h: 300 }, rot);
  check(r.x >= box.x - 1e-9 && r.x + r.w <= box.x + box.w + 1e-9 && r.y >= box.y - 1e-9 && r.y + r.h <= box.y + box.h + 1e-9, "turning the phone sideways re-clamps the same view onto the board");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges zoom: the chart's view maths");
process.exit(bad ? 1 : 0);
