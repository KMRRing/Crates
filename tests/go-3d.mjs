// Go's 3D board (go-3d.js, three.js; the page's side in go.js): what is pure is tested here (which point a spot of the board's plane
// lies on), and what the page promises is read from the source: the 3D board is the choice only when the player picked it or the
// suite's default says so and is written under go:view only when they pick one, a drag never plays a stone, WebGL missing or lost
// falls back to the flat board, reduced motion and the pause are listened to, a frame is asked for only when something moved.
// The picture itself needs a browser with WebGL and is looked at.
import fs from "node:fs";
import { hitPoint } from "../go-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname, read = f => fs.readFileSync(root + f, "utf8");

// the plane's spot to a point: the nearest crossing, none beyond half a line spacing past the edge
check(hitPoint(0, 0, 9) === 4 * 9 + 4, "the middle of a 9x9 is its centre point");
check(hitPoint(-4, -4, 9) === 0 && hitPoint(4, 4, 9) === 80, "the corners are points 0 and 80");
check(hitPoint(-4.4, 0, 9) === 36, "a spot just outside the edge line still taps the edge point");
check(hitPoint(-4.6, 0, 9) === -1 && hitPoint(0, 4.6, 9) === -1, "past half a spacing beyond the edge is off the board");
check(hitPoint(0.49, 0.49, 9) === 4 * 9 + 4 && hitPoint(0.51, 0.49, 9) === 4 * 9 + 5, "the nearest crossing wins");
check(hitPoint(1e6, 1e6, 19) === -1, "a pixel above the horizon (far off) is off the board");
check(hitPoint(9, 9, 19) === 18 * 19 + 18, "19x19: the far corner");

const page = read("go.js"), three = read("go-3d.js"), css = read("go.css"), html = read("go.html");
check(/import \{ defaultIs3D \} from "\.\/mode3d\.js"/.test(page) && /chosenView\(\) \?\? \(defaultIs3D\(\)/.test(page), "the suite's default decides while the player has not chosen");
check(/const setView = v => \{ write\(VIEW, v\)/.test(page) && (page.match(/write\(VIEW/g) || []).length === 1, "go:view is written in one place only, when the player picks");
check(/!IN_FRAME && !lost3d/.test(page), "a watching frame, and a visit that lost 3D, draw the flat board");
check(/import\("\.\/go-3d\.js"\)/.test(page) && !/^import .*go-3d\.js/m.test(page), "three.js comes only when 3D is first wanted");
check(/catch \(e\) \{[^}]*lost3d = true/.test(page) && /onLost: \(\) => \{ lost3d = true/.test(page), "no WebGL, or a lost context, falls back to the flat board for the visit");
check(/Play in 2D/.test(page) && /Play in 3D/.test(page), "the menu offers the other view by name");
check(/board3d\?\.hold\(true\)/.test(page) && /board3d\?\.hold\(false\)/.test(page), "the menu's pause stills the 3D board");
check(/settings:flat/.test(page), "the main menu's battery saver setting reaches an open game");
check(/marks: \(\) => false/.test(three), "no drag begins a stroke: a drag only turns the view");
check(/opts\.onTap\?\.\(pt\)/.test(three) && /createGesture/.test(three), "a tap on a point is the page's tap");
check(/prefers-reduced-motion/.test(three) && /webglcontextlost/.test(three) && /document\.hidden/.test(three), "reduced motion, a lost context and a hidden tab are listened to");
check(/devicePixelRatio \|\| 1, 2/.test(three), "WebGL's pixel ratio is capped at 2");
check(!/\bfilter\s*:/.test(css.split("/* 3D:")[1] || ""), "no CSS filter on the 3D picture");
check(!/(alert|confirm|prompt)\s*\(/.test(three), "no native pop-ups");
// no per-frame allocation: the frame, step and layout functions make no new vectors, matrices, colours or arrays
const body = f => { const i = three.indexOf(f); return three.slice(i, three.indexOf("\n  }\n", i)); };
for (const f of ["function frame(", "function step(", "function layout("]) check(!/new THREE\.|\[\.\.\.|\.map\(|\.filter\(|\bof \[|=> \{|\.forEach/.test(body(f)), `${f.slice(9, -1)} allocates nothing`);
check(/id="board3d"/.test(html), "the page has a place for the 3D board");
process.exit(bad ? 1 : 0);
