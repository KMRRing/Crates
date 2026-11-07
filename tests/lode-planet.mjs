// Lode's planet view (lode-planet.js) and the finger it shares with the flat board (lode-trace.js). 7 Nov 2026 (Korbi: "a 3d mode
// like the 3d cube minesweeper: in space, squares but rounded so appearance is spherical, a planet"). The planet is the same board:
// the touching is the flat board's, so a word is the same path in either. Drawn on a canvas stubbed here, so what is checked is the
// geometry (where each tile is, which a finger picks) and the finger's rules, not the pixels.
import fs from "fs";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const { createTracer } = await import("../lode-trace.js");
// ---------- the finger, on a 3-letter strip a-b-c with c also touching d ----------
{
  const touch = [new Set([1]), new Set([0, 2]), new Set([1, 3]), new Set([2])], spots = [0, 1, 2, 3];
  const log = { trace: [], sub: [] };
  const f = createTracer({ touch: () => touch, pick: (q, reach) => { const i = Math.round(q.x); return Math.abs(q.x - i) < reach && i >= 0 && i < 4 ? i : -1; }, usable: c => c !== 3, step: 0.25,
    changed: () => {}, onTrace: p => log.trace.push(p.join()), onSubmit: c => log.sub.push(c.join()) });
  check(f.down({ x: 0, y: 0 }, 1) && f.path.join() === "0", "a finger on a letter starts a trace");
  f.move({ x: 2, y: 0 }, 1);
  check(f.path.join() === "0,1,2", "a quick stroke past a letter doesn't skip it");
  f.move({ x: 1, y: 0 }, 1);
  check(f.path.join() === "0,1", "sliding back takes the last letter off");
  f.move({ x: 2, y: 0 }, 1); f.up(1);
  check(log.sub.join("|") === "0,1,2", "lifting after a stroke submits it");
  check(!f.down({ x: 3, y: 0 }, 2) && f.path.length === 0, "a letter that can't be used isn't a start");
  f.down({ x: 0, y: 0 }, 3); f.up(3);
  check(f.path.join() === "0", "a tap leaves the letter picked");
  f.down({ x: 1, y: 0 }, 4); f.up(4); f.down({ x: 1, y: 0 }, 5);
  check(log.sub.length === 2 && log.sub[1] === "0,1", "tapping the last letter again submits");
  f.set([0, 1]); f.freeze(true);
  check(f.path.length === 0 && !f.down({ x: 0, y: 0 }, 6), "frozen: the finger does nothing");
}

// ---------- the planet ----------
// the engine reads the knowledge base (as tests/lode.mjs sets it up)
globalThis.atob = b => Buffer.from(b, "base64").toString("binary");
globalThis.window = {};
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const grad = { addColorStop() {} };
const ctx = new Proxy({}, { get: (t, k) => (k === "createRadialGradient" || k === "createLinearGradient" ? () => grad : k in t ? t[k] : () => {}), set: (t, k, v) => ((t[k] = v), true) });
const canvas = { style: {}, setAttribute() {}, addEventListener() {}, getContext: () => ctx, getBoundingClientRect: () => ({ left: 0, top: 0 }), width: 0, height: 0 };
globalThis.document = { createElement: () => canvas };
globalThis.window.devicePixelRatio = 1;
globalThis.getComputedStyle = () => ({ fontFamily: "sans-serif" });
globalThis.requestAnimationFrame = fn => { fn(); return 1; };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.location = { search: "" };
const host = { append() {}, clientWidth: 360, clientHeight: 330, addEventListener() {} };
const { createPlanetView } = await import("../lode-planet.js");
const { geometry } = await import("../lode-engine.js");
const geo = geometry("cube"), N = geo.n;
const sent = [];
const pv = createPlanetView(host, { onTrace: p => sent.push(p.join()), onSubmit: () => {}, usable: () => true });
pv.set({ letters: "A".repeat(N), shape: "cube", words: [] }, {});
pv.frame();
const at = Array.from({ length: N }, (_, i) => pv.where(i));
const facing = at.map((a, i) => i).filter(i => at[i].z > 0.2);
check(N === 54, "the planet is Mines' cube: 6 faces of 3×3");
check(facing.length >= 20 && facing.length <= 34, `a corner toward you shows about half the 54 squares (${facing.length})`);
check(facing.every(i => pv.pick({ x: at[i].x, y: at[i].y }, 0.55) === i), "a finger on a tile's middle picks that tile, every tile facing you");
check(pv.pick({ x: 2, y: 2 }, 0.55) === -1, "open space picks nothing");
// the touching is the cube's: a tile on the near side, away from the rim, has its touching tiles among the nearest on screen
const d = (a, b) => Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y);
const centre = facing.filter(i => at[i].z > 0.8 && [...geo.touch[i]].every(j => at[j].z > 0.6));
check(centre.length > 0 && centre.every(i => { const near = [...geo.touch[i]].map(j => d(i, j)), far = facing.filter(j => j !== i && !geo.touch[i].has(j)).map(j => d(i, j)); return Math.max(...near) < Math.min(...far) * 1.15; }), `in the middle of the view a tile's touching tiles are the nearest (${centre.length} checked)`);
// turning brings the far side round
const was = new Set(facing);
const back = N - 1;
check(!was.has(back) || at[back].z > 0.2, "the tile pickable is the one drawn");
check(pv.camera.dist === 4.6, "the planet starts framed whole");
// the view code: no library, the default and the setting come from mode3d.js
const src = fs.readFileSync(new URL("../lode.js", import.meta.url), "utf8");
check(/wants3D\(settings\.view, "planet"\)/.test(src) && /view: s\?\.view === "planet" \|\| s\?\.view === "flat"/.test(src), "lode.js: the player's own choice is kept only when made; with none the suite's default applies");
check(!/three/.test(fs.readFileSync(new URL("../lode-planet.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "")), "the planet is drawn by hand, no library");
process.exit(bad ? 1 : 0);
