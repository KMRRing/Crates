// Codex's mark (tools/build-mark.mjs; README, "The mark"). Every file it is in is what the generator writes, so nobody
// edits one by hand and leaves the layers out of step; the wheels clear each other through a whole mesh cycle (and the
// check can fail: a pinion turned half a pitch out of mesh overlaps); the three tiers of the C each end on a stripe (the
// inner one once stopped short at the bottom); the speeds follow from the teeth and close the loop every 6 s; and the
// pages hold what the loader and the menu button need.
import fs from "node:fs";
import { build, meshOverlaps, TIERS, NA, NBF, NBB, NR, T_A, T_B, T_R, PIN, PH_BF, PH_BB } from "../tools/build-mark.mjs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const read = p => fs.readFileSync(root + p, "utf8");

const files = build();
const stale = Object.entries(files).filter(([p, text]) => !fs.existsSync(root + p) || read(p) !== text).map(([p]) => p);
check(stale.length === 0, `every generated file is what tools/build-mark.mjs writes (${Object.keys(files).length} of them)${stale.length ? `; stale: ${stale.join(", ")}` : ""}`);

check(meshOverlaps() === 0, "the teeth clear each other all through a mesh cycle: great wheel with each pinion, each pinion with the ring");
check(meshOverlaps(360 / NBF / 2) > 0, "…and the check can fail: a pinion half a pitch out of mesh overlaps");
check(Object.keys(PIN).every(k => PH_BF[k] >= 0 && PH_BB[k] >= 0), "every pinion has a tooth phase");
check(NR === NA + NBF + NBB, "the ring's pitch circle runs through the pinions' back wheels (so one module meshes them all)");
check(TIERS.every(([r1, r2, end]) => end % 4 === 0 && r2 > r1) && TIERS.every((t, i) => !i || TIERS[i - 1][1] <= t[0] + 1e-9),
  "the tiers of the C are concentric and each ends on a four-degree stripe, inner to outer");
check(Math.abs(T_B - T_A * NBF / NA) < 1e-9 && Math.abs(T_R - T_B * NR / NBB) < 1e-9 && Math.abs(T_R - 2 * T_A) < 1e-9,
  `the speeds follow from the teeth (${T_A} s, ${T_B} s, ${T_R} s) and the loop closes every ${T_R} s`);

// the layers: the loader's order, and one picture each
const layerNames = Object.keys(files).filter(p => p.startsWith("mark/")).map(p => p.slice(5, -4));
const loaderOrder = ["base", "ring", "bar-ring", "pin-b", "pin-d", "great", "fixed", "top", "bar-great"];
check(JSON.stringify(layerNames) === JSON.stringify(loaderOrder), "the mark is nine layers, in the order the loader stacks them");
const theme = read("theme.js"), css = read("style.css");
check(loaderOrder.every(n => theme.includes(`"mark/${n}.svg"`)), "theme.js puts every layer in (by name, so the offline list keeps each file)");
check(/\[\["mark\/base\.svg", ""\], \["mark\/ring\.svg", "r"\], \["mark\/bar-ring\.svg", "r"\], \["mark\/pin-b\.svg", "b"\], \["mark\/pin-d\.svg", "d"\], \["mark\/great\.svg", "a"\], \["mark\/fixed\.svg", ""\], \["mark\/top\.svg", ""\], \["mark\/bar-great\.svg", "a"\]\]/.test(theme),
  "…each turned by the part it belongs to: the ring's bar with the ring, the great wheel's with the great wheel");
const secs = n => +new RegExp(`\\.cx-load \\.${n}\\b[^}]*animation-duration: ([\\d.]+)s`).exec(css)?.[1];
check(secs("a") === T_A && secs("r") === T_R && secs("b") === T_B, "style.css turns the loader's layers at those speeds");
check(/\.cx-load \.b \{ transform-origin: 38\.96% 56\.38%; \}/.test(css) && /\.cx-load \.d \{ transform-origin: 61\.04% 56\.38%; \}/.test(css),
  "…the pinions about their own axes (150 and 30 degrees round the hub)");
const { MARK } = await import("../mark.js");
check(/class="cx-a"/.test(MARK) && /class="cx-r"/.test(MARK) && /class="cx-b"/.test(MARK) && /class="cx-d"/.test(MARK), "the inline mark carries the classes the menu button turns by");
check(css.includes(`.turning .cx .cx-a { animation: cx-turn ${T_A}s`) && css.includes(`.turning .cx .cx-r { animation: cx-turn ${T_R}s`) && css.includes(`.turning .cx .cx-b, .turning .cx .cx-d { animation: cx-turn ${T_B}s`), "…at the same speeds");
check(theme.includes(`a: [${T_A * 1000}, "normal"]`) && theme.includes(`r: [${T_R * 1000}, "reverse"]`) && theme.includes(`b: [${T_B * 1000}, "reverse"]`) && theme.includes(`d: [${T_B * 1000}, "reverse"]`), "theme.js turns a layer that CSS leaves still at the same speeds and directions");
check(["rete.svg", "sextant.svg", "logo-modern.svg"].every(p => !fs.existsSync(root + p)), "the old rete, sextant and Modern logo are gone");
check(!/almanac/i.test(read("manifest.webmanifest")) && /"name": "Codex"/.test(read("manifest.webmanifest")), "the app is called Codex");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("mark: generated files current, teeth clear, tiers on their stripes, loader and menu button turn at the movement's speeds");
