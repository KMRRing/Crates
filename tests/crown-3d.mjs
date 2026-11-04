// Draughts's 3D board: the pure parts (crown-cam.js: where squares stand, the camera's fit and limits, the picking of a tap) are tested
// here without three.js, and how the page wires it (the flat board's tap, the choice kept only when made, the fallbacks) by reading
// the files. The WebGL view itself (crown-3d.js) is looked at in a browser.
import { readFileSync } from "node:fs";
import { geo, SETS, SET_IDS } from "../crown-board.js";
import { centreOf } from "../crown-draw.js";
import { DEG, MIN_ELEV, MAX_ELEV, MAX_YAW, TOP, MAX_ZOOM, FITTED, clampElev, clampYaw, clampZoom, posOf, squareAtXZ, onBoard, outlineOf, extent, fitted, viewIn, isFitted, isTop, rayAt, onPlane, pickAt, boardPoint, screenOf } from "../crown-cam.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

// ---------- where the squares are ----------
for (const id of SET_IDS) {
  const g = geo(id), S = g.S;
  let round = true, seen = new Set(), same = true, flipped = true;
  for (let sq = 0; sq < g.N; sq++) {
    for (const bottom of [0, 1]) {
      const [x, z] = posOf(id, sq, bottom);
      if (squareAtXZ(id, x, z, bottom) !== sq) round = false;
      if (bottom === 0) seen.add(`${x},${z}`);
      // the flat board's drawing: the same layout (x across, z down) as centreOf says for its viewBox
      const c = centreOf(id, sq, bottom);
      if (Math.abs((c.x - 3.5) / 10 - (x + S / 2)) > 1e-9 || Math.abs((c.y - 3.5) / 10 - (z + S / 2)) > 1e-9) same = false;
    }
    const a = posOf(id, sq, 0), b = posOf(id, sq, 1);
    if (Math.abs(a[0] + b[0]) > 1e-9 || Math.abs(a[1] + b[1]) > 1e-9) flipped = false;
  }
  check(round && seen.size === g.N, `${SETS[id].name}: every dark square is found again from its own middle, in both orientations`);
  check(same, `${SETS[id].name}: the squares stand where the flat board draws them`);
  check(flipped, `${SETS[id].name}: seen from the other side the board is turned half round`);
  let light = true;
  for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) if (g.at[r][c] < 0 && squareAtXZ(id, c - S / 2 + 0.5, r - S / 2 + 0.5, 0) !== -1) light = false;
  check(light, `${SETS[id].name}: a light square is no square`);
  check(squareAtXZ(id, -S / 2 - 0.1, 0, 0) === -1 && squareAtXZ(id, 0, S / 2 + 0.1, 0) === -1 && onBoard(S, S / 2 + 0.3, 0) && !onBoard(S, S / 2 + 1, 0), `${SETS[id].name}: the rim is over the board and no square, beyond it is off`);
}
{
  const [x, z] = posOf("english", 28, 0), [x2, z2] = posOf("english", 3, 0);
  check(z > 0 && z2 < 0, "Ink stands at the near side (+z), Ivory's end is at the far side");
}

// ---------- the camera ----------
const BOXES = [[390, 340], [390, 400], [358, 350], [820, 760], [760, 420], [1100, 700], [300, 700]];
const ids = ["english", "international"];
let fits = true, centred = true, topOk = true;
for (const id of ids) {
  const S = geo(id).S, outline = outlineOf(S);
  for (const [w, h] of BOXES) {
    for (const turn of [null, { yaw: 0, elev: TOP }, { yaw: MAX_YAW, elev: MIN_ELEV }, { yaw: -MAX_YAW, elev: 50 * DEG }]) {
      const v = viewIn({ turn, zoom: 1, px: 0, py: 0 }, outline, w, h);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of outline) { const [sx, sy] = screenOf(v, p, w, h); x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      if (x0 < -0.5 || y0 < -0.5 || x1 > w + 0.5 || y1 > h + 0.5) fits = false;
      if (Math.abs((x0 + x1) / 2 - w / 2) > 1 || Math.abs((y0 + y1) / 2 - h / 2) > 1) centred = false;
    }
  }
}
check(fits, "the whole board, rim and pieces, is in the box at any pose and any box shape");
check(centred, "and it is centred in the free area, not hugging a side");
check(clampElev(0) === MIN_ELEV && clampElev(9) === MAX_ELEV && clampYaw(9) === MAX_YAW && clampYaw(-9) === -MAX_YAW && clampZoom(0.2) === 1 && clampZoom(40) === MAX_ZOOM, "the orbit is limited: never below the rim, never over the top, a little to each side");
check(Number.isFinite(clampElev(NaN)) && Number.isFinite(clampYaw(NaN)) && clampZoom(NaN) === 1, "a damaged number is a sensible one");
{
  const o = outlineOf(8);
  check(BOXES.every(([w, h]) => { const f = fitted(o, w, h); return f.yaw === 0 && f.elev >= 32 * DEG && f.elev <= 80 * DEG; }), "the board opens square to you, tilted between 32 and 80 degrees, in any box");
  check(isFitted(FITTED) && !isFitted({ turn: { yaw: 0, elev: 1 }, zoom: 1, px: 0, py: 0 }) && isTop({ turn: { yaw: 0, elev: TOP }, zoom: 1, px: 0, py: 0 }) && !isTop(FITTED), "fitted and top are told apart");
}

// ---------- picking ----------
let pickOk = true, tops = true, rays = true;
for (const id of ids) {
  const g = geo(id), S = g.S, outline = outlineOf(S);
  for (const [w, h] of [[390, 400], [1100, 700]]) for (const bottom of [0, 1]) for (const turn of [null, { yaw: 0, elev: TOP }, { yaw: 25 * DEG, elev: 40 * DEG }, { yaw: -MAX_YAW, elev: MIN_ELEV }]) {
    const v = viewIn({ turn, zoom: 1, px: 0, py: 0 }, outline, w, h);
    for (let sq = 0; sq < g.N; sq++) {
      const [x, z] = posOf(id, sq, bottom), [sx, sy] = screenOf(v, [x, 0.03, z], w, h);
      if (pickAt(v, sx, sy, w, h, id, bottom) !== sq) pickOk = false;
      // a piece stands up: its top is what a finger is on, a square further back on the plane
      const king = sq % 3 === 0, [tx, ty] = screenOf(v, [x, king ? 0.46 : 0.27, z], w, h);
      if (pickAt(v, tx, ty, w, h, id, bottom, q => q === sq, q => q === sq && king) !== sq) tops = false;
      const hit = boardPoint(v, sx, sy, w, h);
      if (!hit || Math.abs(hit[0] - x) > 1e-6 || Math.abs(hit[1] - z) > 1e-6) rays = false;
    }
  }
}
check(rays, "a ray through a square's middle meets the board's plane there");
check(pickOk, "a tap on any square's middle is that square, at any pose, either way up");
check(tops, "a tap on the top of a man or a king is its square (the finger is on the top, not on the board behind it)");
{
  const outline = outlineOf(8), v = viewIn(FITTED, outline, 390, 400);
  const [lx, ly] = screenOf(v, [-3.5, 0.03, -3.5], 390, 400);     // (row 0, col 0) is a light square
  check(pickAt(v, lx, ly, 390, 400, "english", 0) === -1, "a tap on a light square is nothing");
  check(pickAt(v, 2, 2, 390, 400, "english", 0) === -1 && boardPoint(v, 2, 2, 390, 400) !== null && !onBoard(8, ...boardPoint(v, 2, 2, 390, 400)), "a tap in the corner of the box is off the board");
  const ray = rayAt(v, 195, 200, 390, 400);
  check(onPlane(ray, 0.03) !== null && onPlane({ o: [0, 5, 0], d: [0, 1, 0] }, 0) === null && onPlane({ o: [0, 5, 0], d: [1, 0, 0] }, 0) === null, "a ray that does not come down to the board meets nothing");
  const e = extent(outline, 0, 60 * DEG);
  check(e.u1 > e.u0 && e.v1 > e.v0, "the board has a size on screen");
}

// ---------- how the page wires it ----------
const page = read("crown.js"), view = read("crown-3d.js"), html = read("crown.html"), css = read("crown-3d.css");
check(/defaultIs3D/.test(page) && /from "\.\/mode3d\.js"/.test(page), "with no choice of the player's the suite's setting decides (mode3d.js)");
check((page.match(/localStorage\.setItem\(VIEW/g) || []).length === 1 && /function setView/.test(page) && !/localStorage\.setItem\(VIEW[^)]*defaultIs3D/.test(page), "the choice is written in one place, only when the player picks (never the default)");
check(/const VIEW = "crown:view"/.test(page), "the key is the game's own (crown:view)");
check(/Play in 2D/.test(page) && /Play in 3D/.test(page), "the menu says Play in 3D / Play in 2D");
check(!/^import .*crown-3d/m.test(page) && /import\("\.\/crown-3d\.js"\)/.test(page), "three.js comes only when the 3D board is wanted");
check(/!IN_FRAME && !lost3d/.test(page), "a partner's watching frame and a device that lost WebGL draw the flat board");
check(/onLost: \(\) => \{ lost3d = true/.test(page) && /webglcontextlost/.test(view), "a lost WebGL context sends the page back to the flat board");
check(/onPause\(\(\) => board3d\?\.hold\(true\)/.test(page) && /hold\(on\)/.test(view), "the menu, the rules and the games screen stand the 3D board still");
check(/prefers-reduced-motion: reduce/.test(view), "reduced motion plays no hops");
check(/tapSquare/.test(page) && /function tap3d/.test(page) && /canAct\(\)/.test(page.slice(page.indexOf("function tap3d"), page.indexOf("function tap3d") + 200)), "a tap on the 3D board goes through the flat board's own tap, and only when it is your move");
check(/import \* as THREE from "\.\/vendor\/three\.js"/.test(view), "the model is three.js from the device's own copy");
check(/crown-3d\.css/.test(html) && /\.cr3 /.test(css), "the page links the 3D stylesheet");
check(/if \(t\.board && !grab\) return/.test(view), "a finger that starts on the board never moves the camera");
check(!/alert\(|confirm\(|prompt\(/.test(view + page), "no browser pop-ups");
check(!/fixed hex|#[0-9a-f]{6}/i.test(css), "the stylesheet takes its colours from the tokens");

console.log(bad ? `\n${bad} failed` : "\nall ok");
process.exit(bad ? 1 : 0);
