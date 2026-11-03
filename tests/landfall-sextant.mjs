// The sextant's controls as pure maths (landfall-sextant.js): the star follows the finger pixel for pixel, the lens closes in
// without chattering, the drum is finer than the eyepiece, a reading is to a tenth of an arcminute, and three marks are the most.
import { LENSES, FINE, quantise, formatReading, formatOffset, lensFor, pxPerArcmin, dragReading, offsetOf, newSextant, mark, clearMarks, MAX_MARKS, layout, inDrum } from "../landfall-sextant.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(formatReading(3314.2) === "55° 14.2′" && formatReading(3300) === "55° 00.0′", "a reading is degrees and tenths of an arcminute");
check(formatOffset(72) === "+1° 12′" && formatOffset(-0.8) === "-0.8′" && formatOffset(23.4) === "+23′", "an offset in the unit that reads best");
check(quantise(55.04) === 55 && quantise(55.06) === 55.1, "the drum reads to a tenth");

// the star follows the finger 1:1 at every lens
{
  const half = 150;
  const followed = LENSES.map((_, lens) => {
    const r0 = 3300 - 0.3 * LENSES[lens], r1 = dragReading(r0, 40, lens, half);
    return (offsetOf(3300, r0, 0) - offsetOf(3300, r1, 0)) * pxPerArcmin(lens, half);       // pixels the star's image moved
  });
  check(followed.every((px, lens) => Math.abs(px - 40) <= 0.05 * pxPerArcmin(lens, half) + 1e-9), `a finger moving the image moves it by as much, pixel for pixel, at every lens (${followed.map(x => x.toFixed(1)).join(", ")} px for 40; the rest is the drum's tenth)`);
  check(dragReading(3300, 30, 3, half) > 3300 && dragReading(3300, -30, 3, half) < 3300, "the finger moving down moves the star down, which is the reading going up");
  check(Math.abs((dragReading(3300, 50, 3, half, true) - 3300) / (dragReading(3300, 50, 3, half) - 3300) - FINE) < 0.03, `the drum is ${1 / FINE} times finer than the eyepiece`);
  check(1 / pxPerArcmin(3, 130) < 0.1, `at the closest lens a pixel is ${(1 / pxPerArcmin(3, 130)).toFixed(3)}′, finer than the drum's tenth: the control never limits the sight`);
  check(1 / pxPerArcmin(0, 130) > 1, "...and at the widest it is over an arcminute a pixel, for the long way in");
}
// the lens: in as the star comes down, out when it is lost, never chattering at a boundary
{
  let lens = 0, trail = [];
  for (let off = 200; off >= 0; off -= 1) { const n = lensFor(off, lens); if (n !== lens) trail.push([off, n]); lens = n; }
  check(lens === 3 && trail.length === 3 && trail.every(([, n], i) => n === i + 1), `bringing the star in from 200′ steps the lens in three times: ${trail.map(([o, n]) => `${o}′→${n}`).join(", ")}`);
  let flips = 0; lens = 3;
  for (let i = 0; i < 400; i++) { const off = 1.5 + 2.9 * Math.sin(i * 0.9); const n = lensFor(off, lens); if (n !== lens) flips++; lens = n; }   // a swell of ±1′ and the drum 2′ out, as far as it can be and stay close
  check(flips === 0, `the swell bobbing the star about the horizon does not make the lens chatter (${flips} changes in 400 frames)`);
  check(lensFor(500, 3) === 0 && lensFor(30, 3) === 2 || lensFor(30, 3) === 1, "a star lost far off sends the lens back out");
  check(lensFor(0, 0) === 3, "a star on the horizon is at the closest lens");
}
// marks
{
  const st = newSextant(3314.23);
  check(st.reading === 3314.2 && st.marks.length === 0, "a sextant starts at a reading to a tenth");
  st.reading = 3314.6; check(mark(st) && st.marks.join() === "3314.6" && st.flash === 1, "a mark records the drum's reading");
  mark(st); mark(st);
  check(!mark(st) && st.marks.length === MAX_MARKS && MAX_MARKS === 3, "three marks are the most");
  clearMarks(st); check(st.marks.length === 0, "marks can be cleared");
}
// layout
{
  for (const [w, h] of [[390, 560], [390, 700], [820, 900], [1000, 700]]) {
    const L = layout(w, h);
    check(L.cx - L.rho > 0 && L.cx + L.rho < L.drum.x && L.cy + L.rho < h && L.cy - L.rho > 0 && L.drum.x + L.drum.w < w, `${w}×${h}: the eyepiece and the drum fit side by side`);
  }
  const L = layout(390, 560);
  check(inDrum(L, L.drum.x + 5, L.cy) && !inDrum(L, L.cx, L.cy), "the drum is where the finger finds it");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-sextant: following the finger, the lens, the drum, the marks and the layout");
