// Rack's 3D board (rack-3d.js, three.js; the page's side in rack.js; 23 November 2026, Korbi: "add 3d mode to rack"): what is pure is
// tested here (which square a spot of the board's plane lies on, where each letter's picture sits in the atlas), and what the page
// promises is read from the source: 3D is the choice only when the player picked it or the suite's default says so and is written under
// rack:view only when they pick one, a tap on either board is the same move, a drag never lays a tile, WebGL missing or lost falls back
// to the flat board, reduced motion and the pause are listened to, a frame is asked for only when something moved. The picture itself
// needs a browser with WebGL and is looked at.
import fs from "node:fs";
import { cellAt, atlasCell } from "../rack-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname, read = f => fs.readFileSync(root + f, "utf8");

// the plane's spot to a square: the board is fifteen squares a side, centred
check(cellAt(0, 0) === 112, "the middle of the board is the star's square, 112");
check(cellAt(-7.4, -7.4) === 0 && cellAt(7.4, 7.4) === 224, "the corners are squares 0 and 224");
check(cellAt(-7.6, 0) === -1 && cellAt(0, 7.6) === -1 && cellAt(1e6, 1e6) === -1, "past the edge, or above the horizon, is off the board");
check(cellAt(0.49, 0) === 112 && cellAt(0.51, 0) === 113, "a square's edge is half a square from its middle");
check(atlasCell("A") === 0 && atlasCell("Z") === 25 && atlasCell("a") === 26 && atlasCell("z") === 51 && atlasCell("?") === 52, "a capital, a blank's letter and the bare blank each have their own picture");

const page = read("rack.js"), three = read("rack-3d.js"), css = read("rack.css"), html = read("rack.html");
check(/import \{ wants3D \} from "\.\/mode3d\.js"/.test(page) && /wants3D\(read\(VIEW, null\), "3d"\)/.test(page), "the suite's default decides while the player has not chosen");
check(/const setView = v => \{ write\(VIEW, v\)/.test(page) && (page.match(/write\(VIEW/g) || []).length === 1, "rack:view is written in one place only, when the player picks");
check(/!IN_FRAME && !lost3d/.test(page), "a watching frame, and a visit that lost 3D, draw the flat board");
check(/import\("\.\/rack-3d\.js"\)/.test(page) && !/^import .*rack-3d\.js/m.test(page), "three.js comes only when 3D is first wanted");
check(/catch \(e\) \{[^}]*lost3d = true/.test(page) && /onLost: \(\) => \{ lost3d = true/.test(page), "no WebGL, or a lost context, falls back to the flat board for the visit");
check(/onTap: tapCell/.test(page) && /if \(c\) tapCell\(/.test(page), "a tap on a square of either board is the same move");
check(/choice\("View", \[\["3d", "3D"\], \["flat", "2D"\]\]/.test(page), "the menu's Settings offer the view");
check(/board3d\?\.hold\(true\)/.test(page) && /board3d\?\.hold\(false\)/.test(page) && /onPause\(/.test(page), "the menu's pause stills the 3D board");
check(/settings:flat/.test(page), "the main menu's battery saver setting reaches an open game");
check(/marks: \(\) => false/.test(three), "no drag begins a stroke: a drag only turns the view");
check(/opts\.onTap\?\.\(cell\)/.test(three) && /createGesture/.test(three), "a tap on a square is the page's tap");
check(/prefers-reduced-motion/.test(three) && /webglcontextlost/.test(three) && /document\.hidden/.test(three), "reduced motion, a lost context and a hidden tab are listened to");
check(/devicePixelRatio \|\| 1, 2/.test(three), "WebGL's pixel ratio is capped at 2");
check(/paletteNow/.test(three) && /var\(--rk-word\)/.test(three) && /data-theme", "data-mode"/.test(three), "the board's colours are the flat board's own, read again when the theme changes");
check(!/(alert|confirm|prompt)\s*\(/.test(three), "no native pop-ups");
// no per-frame allocation: the frame, step and layout functions make no new vectors, matrices, colours or arrays
const body = f => { const i = three.indexOf(f); return three.slice(i, three.indexOf("\n  }\n", i)); };
for (const f of ["function frame(", "function step(", "function layout("]) check(!/new THREE\.|\[\.\.\.|\.map\(|\.filter\(|\bof \[|=> \{|\.forEach/.test(body(f)), `${f.slice(9, -1)} allocates nothing`);
check(/id="board3d"/.test(html) && /\.rk-box\.is3d \.rk-board \{ display: none; \}/.test(css), "the page has a place for the 3D board, in the board's own box");
process.exit(bad ? 1 : 0);
