// Solitaire's 3D table and its sounds (solitaire-3d.js, solitaire-sound.js, and the board's touch on a tilted table): the
// camera's maths (the straight-down view is the flat table's scale, a point projected and unprojected comes back, the far
// side of the table is the top of the screen at every tilt), the page's rules for the choice (written only on an explicit
// pick, lazy, a way back to 2D), and the sound module on a stand-in for Web Audio (silent until a gesture, silent when off,
// the riffle a burst of many ticks).
import fs from "node:fs";
import { poseOf, project, groundAt, fitDistance, FOV, TILT_MAX, YAW_MAX, ANGLED } from "../solitaire-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const read = f => fs.readFileSync(root + f, "utf8");
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ---------- the camera ----------
{
  const W = 350, H = 476, aspect = W / H, d0 = H / 2 / Math.tan(FOV / 2);
  check(near(fitDistance(W, H, 0, 0, aspect), d0, d0 * 2e-4), "straight above, a board pixel is a screen pixel (the 2D table's scale)");
  const P0 = poseOf(0, 0, d0), a = project(P0, [-W / 2, 0, -H / 2], aspect), c = project(P0, [W / 2, 0, H / 2], aspect);
  check(near(a[0], -1, 1e-3) && near(a[1], 1, 1e-3) && near(c[0], 1, 1e-3) && near(c[1], -1, 1e-3), "straight above, the table's far left is the screen's top left and its near right the bottom right");
  let grows = true, ok = true, up = true, round = true;
  let last = d0 - 1;
  for (const tilt of [0, 15, 30, 45, TILT_MAX]) for (const yaw of [-YAW_MAX, 0, 9]) {
    const d = fitDistance(W, H, tilt, yaw, aspect), P = poseOf(tilt, yaw, d);
    for (const [x, z] of [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]]) {
      const s = project(P, [x, 0, z], aspect);
      if (!(s[2] > 0 && Math.abs(s[0]) <= 1.0005 && Math.abs(s[1]) <= 1.0005)) ok = false;
    }
    // the far edge is above the near edge on the screen at every tilt and yaw
    if (!(project(P, [0, 0, -H / 2], aspect)[1] > project(P, [0, 0, H / 2], aspect)[1])) up = false;
    for (const h of [0, 7, 30]) for (const [x, z] of [[0, 0], [60, -90], [-120, 150]]) {
      const s = project(P, [x, h, z], aspect), g = groundAt(P, s[0], s[1], aspect, h);
      if (!g || !near(g.x, x, 1e-3) || !near(g.z, z, 1e-3)) round = false;
    }
    if (yaw === 0) { if (d < last - 1e-6) grows = false; last = d; }
  }
  check(ok, "at every tilt and yaw the whole table fits the screen");
  check(up, "the far side of the table is the top of the screen at every tilt and yaw");
  check(round, "a point unprojected from the screen onto the plane it lies in comes back, at any tilt, yaw and height");
  check(grows, "tilting never makes the table larger (the camera backs off to keep its corners in)");
  check(fitDistance(W, H, 36, 0, aspect, 40) > fitDistance(W, H, 36, 0, aspect, 0), "room for a tall pile pulls the camera back a little");
  check(ANGLED > 0 && ANGLED < TILT_MAX && TILT_MAX <= 55 && YAW_MAX <= 15, "the camera is limited: from straight above to 55 degrees, a little yaw");
}

// ---------- the page ----------
{
  const page = read("solitaire.js"), board = read("solitaire-board.js"), view = read("solitaire-3d.js"), css = read("solitaire.css"), html = read("solitaire.html"), mode = read("mode3d.js");
  check(/import\("\.\/solitaire-3d\.js"\)/.test(page) && !/^import .*solitaire-3d/m.test(page), "the 3D code loads only when 3D is wanted");
  check(/defaultIs3D/.test(page) && /import \{ defaultIs3D \} from "\.\/mode3d\.js"/.test(page) && /export const defaultIs3D/.test(mode), "the default follows the suite's 2D / 3D setting");
  const writes = page.match(/prefs\.view\s*=[^=]/g) || [];
  check(writes.length === 1 && /choice\("Table"[^\n]*prefs\.view = v/.test(page), "the view is written to the saved prefs only by an explicit pick in the menu");
  check(/prefs\.tilt = Math\.round\(tilt\)/.test(page) && /onCamera/.test(page) && /preset\(\)/.test(page), "the camera is saved when the player sets it, by a drag or the button");
  check(Number(page.match(/const ANGLED = (\d+)/)[1]) === ANGLED, "the page's ANGLED is the 3D module's");
  check(/onLost:[^\n]*failed3d = true[^\n]*applyView/.test(page) && /catch \(err\) \{[^}]*failed3d = true/.test(page), "a lost GL context, or no WebGL, goes back to the flat table");
  check(/!IN_FRAME && !failed3d/.test(page), "a watching frame is always flat");
  check(/hold\(true\)/.test(page) && /onPause/.test(page), "the 3D view stands still while a menu is open");
  check(/toggle\("Sound"/.test(page) && /sound\.setOn/.test(page) && /sound\.unlock\(\)/.test(page), "the menu has a Sound switch and the audio unlocks on the first gesture");
  check(/sound\.shuffle\(\)/.test(page) && /sound\.thunk\(\)/.test(page) && /sound\.snap\(\)/.test(page) && /sound\.flick\(/.test(page), "a deal shuffles, a foundation thunks, the stock snaps and a move flicks");
  check(/import \* as THREE from "\.\/vendor\/three\.js"/.test(view) && /from "\.\/vendor\/three-tex\.js"/.test(view), "the 3D table is drawn with the bundled three.js");
  check(!/\b(alert|confirm|prompt)\(/.test(view + board + page), "no browser pop-ups");
  check(/\.so-board\.is3d > :not\(\.so-gl\)/.test(css) && /id="tiltBtn"/.test(html), "the flat cards stay under the canvas as the record of where things are, and the camera has a button");
  check(/view \? spotAt\(ev\.clientX, ev\.clientY\) : \{ spot: spotOf\(ev\.target\) \}/.test(board) && /view\.pick\(/.test(board) && /view\.toTable\(/.test(board), "the board asks the view which card is under a finger and where a pointer is, and keeps its own rules of touch");
  check(/ptrs\.size >= 2/.test(board) && /bare/.test(board), "two fingers, or one from bare baize, turn the camera; a finger on a card or a pile never does");
  check(!/webkit-filter|filter:/.test(css.slice(css.indexOf(".so-gl"), css.indexOf(".so-gl") + 400)), "no filters on the canvas");
  check(/setPixelRatio\(Math\.min\(devicePixelRatio \|\| 1, 2\)\)/.test(view), "the pixel ratio is capped at 2");
}

// ---------- the sounds, on a stand-in for Web Audio ----------
{
  const made = { sources: 0, oscillators: 0, contexts: 0 };
  const node = () => { const n = { connect: x => x, start() {}, stop() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 }, Q: { value: 0 }, threshold: {}, ratio: {}, attack: {}, release: {}, pan: {} }; return n; };
  class Ctx {
    constructor() { made.contexts++; this.state = "running"; this.currentTime = 1; this.sampleRate = 44100; this.destination = node(); }
    createGain() { return node(); } createBiquadFilter() { return node(); } createDynamicsCompressor() { return node(); } createStereoPanner() { return node(); }
    createBuffer(c, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    createBufferSource() { made.sources++; return node(); }
    createOscillator() { made.oscillators++; return node(); }
    resume() { return Promise.resolve(); }
  }
  const handlers = {};
  globalThis.window = globalThis;
  globalThis.AudioContext = Ctx;
  globalThis.addEventListener = (e, f) => { (handlers[e] ||= []).push(f); };
  globalThis.removeEventListener = (e, f) => { handlers[e] = (handlers[e] || []).filter(x => x !== f); };
  const S = await import("../solitaire-sound.js");
  S.flick(); S.snap(); S.shuffle(); S.thunk();
  check(made.contexts === 0, "nothing is made before a gesture (a browser would refuse, and warn)");
  S.unlock();
  check(["pointerdown", "touchend", "keydown", "click"].every(e => handlers[e]?.length), "the first tap, touch, key or click is listened for");
  handlers.pointerdown.forEach(f => f());
  check(made.contexts === 1, "the audio context is made inside the first gesture");
  const before = made.sources;
  S.shuffle();
  check(made.sources - before >= 25, "a riffle shuffle is a burst of many small ticks");
  const b2 = made.sources + made.oscillators;
  S.thunk();
  check(made.oscillators >= 2 && made.sources + made.oscillators > b2, "a thunk is a falling tone and a low noise");
  S.setOn(false);
  const b3 = made.sources + made.oscillators;
  S.flick(); S.snap(); S.shuffle(); S.thunk(); S.dealing(5, 0, 0);
  check(made.sources + made.oscillators === b3, "with Sound off nothing is made");
  S.setOn(true);
  const b4 = made.sources;
  S.flick(); S.flick();
  check(made.sources - b4 === 2 || made.sources - b4 === 3, "one card is one flick: a second call in the same instant is ignored");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("solitaire 3D: the camera, the choice and the sounds hold");
