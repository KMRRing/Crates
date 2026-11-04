// The Earth's turn is smooth (Korbi, 3 November 2026: "the earth is jittery during its turn"). The sphere's maths
// (columbiad-sphere.js, no page in it) is checked the way the eye would: a picture drawn at a turn and another a hair's breadth on
// differ by the same small amount wherever the turn is, so nothing hops; a whole turn is the same picture; and where a coast is
// squeezed into a pixel at the limb, the map is averaged, not sampled at a point that flickers as the globe goes round.
import { buildSphere, renderSphere, sunOf, turnForPixels, paintEarth, withMips, TAU } from "../columbiad-sphere.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const W = 1024, H = 512, S = 160;
/** A map of soft blobs (every texel its own value, so any hop of a point sample shows), RGBA. */
function blobs() {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = i / W * TAU, y = j / H * Math.PI, v = 128 + 70 * Math.sin(5 * x + 1) * Math.sin(3 * y) + 40 * Math.sin(11 * x + 2 * y) + 14 * Math.sin(37 * x) * Math.sin(23 * y);
    const k = (j * W + i) * 4; data[k] = data[k + 1] = data[k + 2] = v; data[k + 3] = 255;
  }
  return { w: W, h: H, data };
}
const stripes = { w: W, h: H, data: new Uint8ClampedArray(W * H * 4) };
for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const k = (j * W + i) * 4, v = i % 2 ? 255 : 0; stripes.data[k] = stripes.data[k + 1] = stripes.data[k + 2] = v; stripes.data[k + 3] = 255; }
withMips(stripes);
const moon = { pad: 1, tilt: 24, roll: -12, sun: sunOf(135, 0.5), earth: false, texW: W, texH: H };

// ---------- no hops ----------
{
  const tex = blobs(), px = new Uint8ClampedArray(S * S * 4), g = buildSphere(S, moon, null);
  const frame = turn => { renderSphere(g, px, tex, null, turn); return Uint8ClampedArray.from(px); };
  const dTurn = turnForPixels(S, 1, 0.1);                                      // 0.1 px at the rim, as the page asks for
  let prev = frame(0.3), steps = [];
  for (let i = 1; i <= 120; i++) {
    const cur = frame(0.3 + i * dTurn);
    let sum = 0, n = 0;
    for (let p = 0; p < g.n; p++) { const k = g.pix[p]; sum += Math.abs(cur[k] - prev[k]); n++; }
    steps.push(sum / n); prev = cur;
  }
  const sorted = [...steps].sort((a, b) => a - b), med = sorted[60];
  check(Math.max(...steps) < med * 1.6 && Math.min(...steps) > med * 0.5, `120 pictures, each 0.1 px of turn on from the last, each change from the one before is about the same size (median ${med.toFixed(3)}, from ${Math.min(...steps).toFixed(3)} to ${Math.max(...steps).toFixed(3)} levels a pixel): nothing hops`);
  // the same pictures if the turn were quantised to a whole 0.4 degree, as the page once did: the changes are all or nothing
  const q = 1 / 900;
  let hops = 0, still = 0, p2 = frame(Math.round(0.3 / q) * q);
  for (let i = 1; i <= 120; i++) {
    const cur = frame(Math.round((0.3 + i * dTurn) / q) * q);
    let sum = 0; for (let p = 0; p < g.n; p += 7) { const k = g.pix[p]; sum += Math.abs(cur[k] - p2[k]); }
    if (sum > 0) hops++; else still++;
    p2 = cur;
  }
  check(still > 3 * hops && hops > 5, `(the old way, a turn rounded to 0.4 degree, would have stood still for ${still} of those 120 steps and jumped in ${hops}: the test sees the difference)`);
}

// ---------- a whole turn is the same picture, in either direction ----------
{
  const tex = blobs(), g = buildSphere(S, moon, null), a = new Uint8ClampedArray(S * S * 4), b = new Uint8ClampedArray(S * S * 4), c = new Uint8ClampedArray(S * S * 4);
  renderSphere(g, a, tex, null, 0.2137); renderSphere(g, b, tex, null, 1.2137); renderSphere(g, c, tex, null, -2.7863);
  let worst = 0;
  for (let p = 0; p < g.n; p++) { const k = g.pix[p]; worst = Math.max(worst, Math.abs(a[k] - b[k]), Math.abs(a[k] - c[k])); }
  check(worst <= 1, `a turn of 1 or of -3 further is the same picture to ${worst} level (the seam of the map is not seen)`);
}

// ---------- the limb: squeezed coasts are averaged ----------
{
  const px = new Uint8ClampedArray(S * S * 4), g = buildSphere(S, { ...moon, mips: stripes.mips.length }, null);
  const limb = [];
  for (let p = 0; p < g.n; p++) if ((g.nt[p] << g.lod[p]) >= 12) limb.push(p);          // where a pixel covers a dozen texels or more of the map
  // the moon's light darkens its limb, so compare each pixel's value to the same pixel on a flat grey map
  const grey = { w: 2, h: 1, data: new Uint8ClampedArray([127.5, 127.5, 127.5, 255, 127.5, 127.5, 127.5, 255]) }, ref = new Uint8ClampedArray(S * S * 4);
  renderSphere(g, ref, grey, null, 0);
  let worst = 0;
  for (let i = 0; i < 24; i++) {
    renderSphere(g, px, stripes, null, i * 0.0173);
    for (const p of limb) { const k = g.pix[p]; if (ref[k] > 12) worst = Math.max(worst, Math.abs(px[k] - ref[k]) / ref[k]); }
  }
  check(limb.length > 100 && worst < 0.3, `at the limb (${limb.length} pixels, each a dozen texels or more of map) a map of stripes three texels wide stays within ${(worst * 100).toFixed(0)}% of its grey mean as the globe turns, instead of flickering black and white`);
}

// ---------- the painted Earth ----------
{
  const o = { r: 0, g: 0, b: 0, sea: 0 };
  paintEarth(10, 20, 60, o);
  check(o.sea > 0.95, "a blue texel is sea");
  paintEarth(3, 5, 8, o);
  check(o.sea > 0.95, "…and so is the near-black of the deep (once taken for land, it came out as dark blotches)");
  paintEarth(110, 120, 60, o);
  check(o.sea < 0.05 && o.g > 80, "a green texel is land");
  paintEarth(245, 245, 250, o);
  check(o.sea < 0.05 && o.r > 200, "an ice texel is bright");
  paintEarth(8, 24, 58, o); const deep = o.b;
  paintEarth(30, 80, 150, o); const shallow = o.b;
  check(shallow > deep + 20, "the sea's colour goes from navy to a clear blue with the depth the map shows");
}

// ---------- every pixel of the disc is kept (the Earth's bottom rows were once dropped by a table too small) ----------
{
  for (const [size, pad, earth] of [[160, 1.12, true], [390, 1.12, true], [1000, 1.12, true], [333, 1, false]]) {
    const g = buildSphere(size, { ...moon, pad, earth, sun: sunOf() }, earth ? new Uint8ClampedArray(size * size * 4) : null);
    const lastRow = Math.floor(g.pix[g.n - 1] / 4 / size);
    check(g.n <= g.pix.length && lastRow >= Math.floor(size / 2 + size / (2 * pad)) - 2, `${size} px (pad ${pad}): ${g.n} disc pixels fit their table of ${g.pix.length}, and the last drawn row is ${lastRow}, down to the disc's bottom`);
  }
}

// ---------- the cadence the page asks for ----------
{
  const rate = 0.0035, step = turnForPixels(384, 1.12, 0.12) / rate;
  check(step > 0.01 && step < 0.045, `at the Earth's turn (${(rate * 360).toFixed(2)} degrees a second) a new picture is due every ${(step * 1000).toFixed(0)} ms at 384 px: about 30 a second, the cadence the page keeps`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("columbiad globe: a turn is a pure function of time, resampled at the exact angle; no hops, no seam, no limb flicker");
