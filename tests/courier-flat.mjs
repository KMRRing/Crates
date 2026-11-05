// Courier's flat view (reckoning-2d.js): where things are on the screen, and that it draws every section and biome without a fault
// (against a canvas that records nothing: what it draws is for eyes, tests/courier-flat.mjs checks that it can and where).
import { scalesOf, pointOf, placeOf, laneOf, createFlatRunner } from "../reckoning-2d.js";
import { SECTIONS, byId } from "../reckoning-sections.js";
import { BIOME_IDS } from "../reckoning-biomes.js";
import { newGame, step, swipe, LANE_W } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the map ----------
for (const [W, H] of [[390, 500], [358, 430], [1000, 700]]) {
  const sc = scalesOf(W, H), hz = 120;
  const [ax] = pointOf(sc, H, -LANE_W * 1.5 - 0.5, hz, hz), [bx] = pointOf(sc, H, LANE_W * 1.5 + 0.5, hz, hz);
  check(ax >= 0 && bx <= W, `${W}x${H}: the quay and the walls beside it are inside the frame`);
  const [, y0] = pointOf(sc, H, 0, hz, hz), [, y1] = pointOf(sc, H, 0, hz + 30, hz), [, y2] = pointOf(sc, H, 0, hz - 5, hz);
  check(y0 > H * 0.7 && y0 < H && y1 >= 0 && y1 < H * 0.1 && y2 <= H + 1e-6, `${W}x${H}: the hero stands low in the frame, 30 m ahead is at the top, 5 m behind at the bottom`);
  const p = pointOf(sc, H, 1.3, hz + 7, hz), q = placeOf(sc, H, ...p, hz);
  check(Math.abs(q[0] - 1.3) < 1e-9 && Math.abs(q[1] - (hz + 7)) < 1e-9, `${W}x${H}: a place on the quay and its point on the screen are one another's inverse`);
  check(pointOf(sc, H, 0, hz, hz, 2)[1] < pointOf(sc, H, 0, hz, hz, 0)[1], `${W}x${H}: height lifts a body up the screen`);
  const [l0] = pointOf(sc, H, -LANE_W, hz, hz), [l1] = pointOf(sc, H, 0, hz, hz), [l2] = pointOf(sc, H, LANE_W, hz, hz);
  check(l0 < l1 && l1 < l2 && Math.abs(l1 - W / 2) < 1e-9, `${W}x${H}: lane +1 is on the right of the hero, as the swipe right is`);
}
check([-3, -1.2, -0.4, 0.4, 0.9, 1.2, 2.6].map(laneOf).join() === "-1,-1,0,0,1,1,1", "the lane of a place across the quay");

// ---------- it draws ----------
// A canvas that takes every call and keeps nothing, and the little of the page the runner asks for.
const noop = () => {};
const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === "createLinearGradient" ? () => ({ addColorStop: noop }) : noop), set: (t, k, v) => { t[k] = v; return true; } });
const canvas = { getContext: () => ctx, getBoundingClientRect: () => ({ width: 358, height: 430, left: 0, top: 0 }), remove: noop, className: "" };
globalThis.document = { createElement: () => canvas, documentElement: { dataset: { mode: "day" } } };
globalThis.getComputedStyle = () => ({ getPropertyValue: () => "" });
globalThis.matchMedia = () => ({ matches: false });
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.MutationObserver = class { observe() {} disconnect() {} };
globalThis.devicePixelRatio = 2;
const host = { prepend: noop, getBoundingClientRect: () => ({ width: 358, height: 430 }) };

const view = createFlatRunner(host);
check(typeof view.frame === "function" && typeof view.ping === "function" && typeof view.dispose === "function" && view.flat, "the runner answers to the page's calls: frame, ping, dispose");
let frames = 0, fault = null;
const play = (S, secs, swipes = []) => {
  try {
    for (let t = 0; t < secs && !S.over; t += 1 / 60) {
      if (swipes.length && Math.floor(t * 60) % 40 === 0) swipe(S, swipes[Math.floor(t * 60 / 40) % swipes.length]);
      step(S, 1 / 60);
      for (const e of S.ev.splice(0)) view.ping(e, S);
      view.frame(S, 1 / 60, { lead: 0.004 }); frames++;
    }
  } catch (err) { fault = fault || err; }
};
const q = n => ({ id: `Q${n}`, bank: "test", q: "?", o: ["a", "b", "c"], a: n % 3, x: "", about: [] });
for (const sec of SECTIONS) { let n = 0; play(newGame({ seed: 3, section: byId(sec.id), deal: () => q(n++), launch: false }), 12, ["left", "up", "right", "down", "up", "left"]); }
check(!fault, `every section is drawn as it runs${fault ? `: ${fault.stack}` : ""}`);
for (const b of BIOME_IDS) { let n = 0; play(newGame({ seed: 5, biome: b, deal: () => q(n++), launch: false }), 12, ["right", "up", "left", "up"]); }
check(!fault, `every biome of the endless run is drawn${fault ? `: ${fault.stack}` : ""}`);
check(frames > 3000, `${frames} frames drawn`);
view.dispose();

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall ok");
