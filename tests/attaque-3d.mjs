// L'Attaque's 3D board (attaque-3d.js, its camera's maths attaque-cam.js): the squares and their places on the board agree both ways
// round, the fitted camera keeps the board and its standing cards inside the box at every pose, a tap at a card's face picks the
// card's square and a tap on bare board the square under it, and the page loads the 3D board only when it is wanted and falls back
// to the flat board without it. The 3D module may only use what the bundled three.js has (it has no PlaneGeometry: that broke it).
import { readFileSync } from "node:fs";
import { DEG, S, CARD_H, LEAN, MAX_YAW, MIN_ELEV, MAX_ELEV, FITTED, posOf, squareAtXZ, outlineOf, viewIn, screenOf, pickAt, rayAt, onPlane } from "../attaque-cam.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

{
  let ok = true;
  for (const bottom of [0, 1]) for (let sq = 0; sq < S * S; sq++) { const [x, z] = posOf(sq, bottom); if (squareAtXZ(x, z, bottom) !== sq || squareAtXZ(x + 0.45, z - 0.45, bottom) !== sq) ok = false; }
  const red = posOf(95, 0), blue = posOf(95, 1);
  check(ok && red[1] > 4 && blue[1] < -4 && red[0] === -blue[0], "every square's place on the board leads back to it, from either side; your back row is nearest you, turned round for Blue");
}
{
  const outline = outlineOf();
  let inside = true;
  for (const [w, h] of [[342, 342], [342, 300], [772, 772], [900, 640], [1100, 520]]) {
    for (const turn of [null, { yaw: MAX_YAW, elev: MIN_ELEV }, { yaw: -MAX_YAW, elev: MAX_ELEV }, { yaw: 0, elev: 60 * DEG }]) {
      const v = viewIn({ ...FITTED, turn }, outline, w, h);
      for (const p of outline) { const [x, y] = screenOf(v, p, w, h); if (x < -0.5 || x > w + 0.5 || y < -0.5 || y > h + 0.5) inside = false; }
    }
  }
  check(inside, "the board, its rim and a card standing in every corner stay inside the box, fitted or turned as far as it goes");
}
{
  const outline = outlineOf(), w = 400, h = 400, v = viewIn(FITTED, outline, w, h);
  let cards = true, bare = true;
  for (const sq of [60, 64, 69, 30, 35]) {
    const y = CARD_H * 0.9 * Math.cos(LEAN), [x, z0] = posOf(sq, 0), z = z0 - y * Math.tan(LEAN), [px, py] = screenOf(v, [x, y, z], w, h);   // near the top of the leaning card
    if (pickAt(v, px, py, w, h, 0, [sq]) !== sq) cards = false;
    // with no card there, the same pixel is on the board behind the square
    const g = onPlane(rayAt(v, px, py, w, h), 0);
    if (pickAt(v, px, py, w, h, 0, []) !== squareAtXZ(g[0], g[1], 0) || pickAt(v, px, py, w, h, 0, []) === sq) cards = false;
  }
  for (const sq of [44, 47, 55, 0, 99]) { const [x, z] = posOf(sq, 0), [px, py] = screenOf(v, [x, 0, z], w, h); if (pickAt(v, px, py, w, h, 0, []) !== sq) bare = false; }
  check(cards, "a tap on a card's face is the card's square, though the board behind it is a square further on");
  check(bare, "a tap on bare board is the square under the finger");
}
{
  const js = read("attaque.js"), html = read("attaque.html"), css = read("attaque-3d.css"), three = read("vendor/three.js"), mod = read("attaque-3d.js");
  check(/load3d\(import\("\.\/attaque-3d\.js"\)\)/.test(js) && !/^import .*attaque-3d/m.test(js), "the 3D code loads only when 3D is wanted");
  check(/catch \(err\) \{[^}]*view\.fail\(\)/.test(js) && /onLost: \(\) => \{ view\.fail\(\)/.test(js), "no WebGL, or a lost context, and the flat board takes over");
  check(/tableView\("attaque"/.test(js) && /view\.choice\(/.test(js) && html.includes('id="board3"') && /#app\.at3 \.at-stage > \.at-board \{ visibility: hidden; \}/.test(css), "Menu, View chooses it; the flat board stays under it, unseen");
  const have = new Set([...three.slice(-6000).matchAll(/ as (\w+)/g)].map(m => m[1])), used = [...new Set([...mod.matchAll(/THREE\.(\w+)/g)].map(m => m[1]))];
  const missing = used.filter(n => !have.has(n));
  check(have.size > 20 && !missing.length, `everything the 3D board takes from three.js is in the bundle${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
