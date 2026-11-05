// Landfall in 3D, its arithmetic (landfall-look.js): where a bearing and a height are in the scene, the look from the sky down to the table
// and back without losing the bearing, a drag's direction, the ship's roll (gentle, none when motion is reduced), a star's brightness
// (the same rule as the flat sky) and the pixel ratio that keeps a phone at its frame rate. The picture itself needs WebGL and is looked at in a browser.
import fs from "node:fs";
import { dirOf, azAltOf, tableBlend, poseOf, dragLook, ease, wrapDiff, shipMotion, windOf, starLook, adapt, vfovOf, dayLight, PITCH_MIN, PITCH_MAX, HFOV } from "../landfall-look.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const root = new URL("../", import.meta.url).pathname;

{
  const n = dirOf(0, 0), e = dirOf(90, 0), z = dirOf(0, 90);
  check(near(n[2], -1) && near(n[0], 0) && near(e[0], 1) && near(z[1], 1), "north is -z, east is +x, the zenith is up");
  let worst = 0;
  for (let az = 0; az < 360; az += 23) for (let alt = -40; alt <= 85; alt += 11) { const r = azAltOf(dirOf(az, alt)); worst = Math.max(worst, Math.abs(wrapDiff(az, r.az)), Math.abs(alt - r.alt)); }
  check(worst < 1e-9, "a bearing and a height come back from the direction they gave");
}
{
  check(tableBlend(30) === 0 && tableBlend(-14) === 0 && tableBlend(-60) === 1 && tableBlend(-90) === 1, "looking at the sky or the horizon, the table has no hold; far down, the chart has all of it");
  let mono = true, last = -1;
  for (let p = 40; p >= -90; p -= 2) { const b = tableBlend(p); if (b < last - 1e-12) mono = false; last = b; }
  check(mono, "the further down, the more the table holds (never less)");
  const table = { az: 80, pitch: -62, eye: [0, 1.9, 5.8] }, stand = { eye: [0, 1.62, 6.55] };
  const up = poseOf({ az: 200, pitch: 35 }, table, stand), down = poseOf({ az: 200, pitch: -75 }, table, stand);
  check(near(up.az, 200) && near(up.pitch, 35) && near(up.eye[1], 1.62), "looking up is the player's own look, from where the navigator stands");
  check(near(down.az, 80) && near(down.pitch, -62) && near(down.eye[1], 1.9), "looking down is the table's: its bearing, its pitch, the eye leaning over it");
  const there = poseOf({ az: 200, pitch: -75 }, table, stand), back = poseOf({ az: 200, pitch: 35 }, table, stand);
  check(near(back.az, 200) && near(there.az, 80), "the bearing looked at is kept while the table is looked at, and is the one that comes back");
  const mid = poseOf({ az: 200, pitch: -30 }, table, stand);
  check(mid.az < 200 && mid.az > 80 && mid.pitch < -30 && mid.pitch > -62, "half way down, the head is half way to the table");
}
{
  const d = dragLook({ az: 100, pitch: 10 }, 0, 40, 8);
  check(d.pitch < 10 && near(d.az, 100), "dragging down looks down (to the table)");
  check(dragLook({ az: 100, pitch: 10 }, 0, -40, 8).pitch > 10, "dragging up looks up (to the sky)");
  check(dragLook({ az: 100, pitch: 10 }, 40, 0, 8).az < 100 && dragLook({ az: 5, pitch: 0 }, 400, 0, 8).az > 300, "dragging sideways turns the head the way the sky is pulled, and wraps through north");
  check(dragLook({ az: 0, pitch: 80 }, 0, -5000, 8).pitch === PITCH_MAX && dragLook({ az: 0, pitch: -80 }, 0, 5000, 8).pitch === PITCH_MIN, "the head stops at straight up and straight down");
  let a = 350;
  for (let i = 0; i < 80; i++) a = ease(a, 10, 0.05, 3, true);
  check(near(a, 10, 0.05), "a bearing eases the short way round, across north");
  check(Math.abs(ease(0, 100, 0.02, 3) - 5.8) < 0.1, "a pitch eases toward its goal at a steady rate");
}
{
  const ts = Array.from({ length: 4000 }, (_, i) => i * 0.1);
  const gentle = ts.map(t => shipMotion(t, 0.6, 0, false)), maxRoll = Math.max(...gentle.map(m => Math.abs(m.roll))), maxPitch = Math.max(...gentle.map(m => Math.abs(m.pitch)));
  check(maxRoll > 0.8 && maxRoll < 3.2 && maxPitch < 1.8, `the roll is slow and gentle: up to ${maxRoll.toFixed(1)}° in an ordinary swell, the pitch up to ${maxPitch.toFixed(1)}°`);
  const storm = Math.max(...ts.map(t => Math.abs(shipMotion(t, 0.6, 1, false).roll))), calm = Math.max(...ts.map(t => Math.abs(shipMotion(t, 0.2, 0, false).roll)));
  check(storm > maxRoll * 1.6 && calm < maxRoll, "a storm rolls the ship much harder, a calm sea less");
  check(ts.every(t => { const m = shipMotion(t, 1.4, 1, true); return m.roll === 0 && m.pitch === 0 && m.heave === 0; }), "with reduced motion the ship does not move at all");
  const peaks = gentle.filter((m, i) => i && i < gentle.length - 1 && m.roll > gentle[i - 1].roll && m.roll > gentle[i + 1].roll).length;
  check(peaks > 4000 * 0.1 / 9 && peaks < 4000 * 0.1 / 4, "a roll takes between four and nine seconds");
  check(windOf(0.5, "clear") < windOf(0.5, "swell") && windOf(0.9, "storm") === 1 && windOf(0.2, "clear") > 0.1, "the wind rises with the swell and the weather, and never quite stops");
}
{
  const a = starLook(0, 60, 5, false).a, b = starLook(4.5, 60, 5, false).a, c = starLook(6, 60, 5, false).a;
  check(a === 1 || a > 0.95, "a bright star under a dark sky is at full strength");
  check(b > 0 && b < a && c === 0, "a faint one is dim and one below the limit is not drawn");
  check(starLook(3, 60, 4, true).a < starLook(3, 60, 4, false).a, "the lamp costs the eye its dark: the same star is dimmer");
  check(starLook(2, 4, 5, false).a < starLook(2, 70, 5, false).a, "a star near the horizon is dimmed by the air");
  check(starLook(-1, 60, 5, false).size > starLook(3, 60, 5, false).size, "a bright star is drawn larger than a faint one");
}
{
  const st = { ratio: 2, slow: 0, fast: 0 };
  let changed = 0;
  for (let i = 0; i < 100; i++) if (adapt(st, 40, 2)) changed++;
  check(changed >= 3 && st.ratio < 1.5 && st.ratio >= 0.55, `a slow phone gives up resolution (to ${st.ratio.toFixed(2)})`);
  for (let i = 0; i < 4000; i++) adapt(st, 40, 2);
  check(st.ratio === 0.55, "...but never below a floor");
  for (let i = 0; i < 4000; i++) adapt(st, 8, 2);
  check(st.ratio === 2, "...and takes it back when frames are quick, never above the screen's own");
  const s2 = { ratio: 1, slow: 0, fast: 0 };
  for (let i = 0; i < 4000; i++) adapt(s2, 16, 2);
  check(s2.ratio === 1, "frames at a steady sixty a second leave it alone");
}
{
  check(near(vfovOf(1, 90), 90) && vfovOf(0.5, 60) > 60 && vfovOf(2, 60) < 60, "the vertical field follows the window's shape from the horizontal one");
  check(dayLight(-20) === 0 && dayLight(10) === 1 && dayLight(-3) > 0 && dayLight(-3) < 1, "the deck is lit by the day only once the sun is up");
  check(HFOV.min < HFOV.stand && HFOV.stand < HFOV.max, "the view can be drawn closer and wider than it starts");
}
{
  // the page: no pop-ups, motion respects the setting, the view choice is written only when picked, and the 3D parts are cached by name
  const page = fs.readFileSync(root + "landfall.js", "utf8"), scene = fs.readFileSync(root + "landfall-scene.js", "utf8"), stage = fs.readFileSync(root + "landfall-stage.js", "utf8");
  check(/wants3D\(read\(KEY\.view, null\), "3d"\)/.test(page) && /setView\("3d", false\)/.test(page), "the view is the suite's default (mode3d.js) until the player picks one");
  check(/if \(remember\) write\(KEY\.view, v\)/.test(page) && /read\(KEY\.view, null\) == null/.test(page), "the choice is written only when the player makes it, and the setting still moves a game with none");
  check(/prefers-reduced-motion/.test(page) && /reduced\(\)/.test(scene), "the roll, the spray and the flag stand still under reduced motion");
  check(/vendor\/three-run\.js/.test(scene) && /InstancedMesh\(quad, starMat, NSTAR\)/.test(scene), "the stars are one instanced mesh");
  check(/import\("\.\/landfall-stage\.js"\)/.test(page) && !/from "\.\/landfall-stage\.js"/.test(page), "the 3D parts load only when the page goes 3D");
  check(/adapt\(quality/.test(stage), "the resolution adapts to the frame rate");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-look: the deck and the sky are one scene, and the head moves between them without losing its place");
