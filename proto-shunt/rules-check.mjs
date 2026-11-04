// Proves each rule on a tiny board. Run: node proto-shunt/rules-check.mjs
import { start, place, judge, show } from "./engine.js";
import assert from "node:assert/strict";

const box = (w, h) => Array.from({ length: h }, () => ".".repeat(w));
const find = (s, kind, x, y, o = 0) => s.P.places.find(p => s.P.kinds[p.kind].key === kind && p.x === x && p.y === y && p.o === o).id;
const put = (s, kind, x, y, o = 0) => { const r = place(s, find(s, kind, x, y, o)); return r; };
const seq = (s, steps) => steps.reduce((st, [k, x, y, o]) => { const r = put(st, k, x, y, o); assert.ok(r.ok, `${k}@${x},${y}: ${r.why}`); return r.state; }, s);
let n = 0; const ok = (name, f) => { f(); n++; console.log("ok", name); };

ok("different pitches touching clash", () => {
  const s = start({ w: 3, h: 1, box: box(3, 1), door: "N", fixed: [{ t: "motor", x: 0, y: 0, f: 0, id: 0 }], supply: [{ k: "g1", f: 1 }] });
  assert.match(put(s, "g11", 1, 0).why, /clash/);
});
ok("same pitch meshes, opposite spin, output direction checked", () => {
  const L = (dir) => ({ w: 3, h: 1, box: box(3, 1), door: "N", fixed: [{ t: "motor", x: 0, y: 0, f: 0, id: 0 }, { t: "out", x: 2, y: 0, f: 0, id: 0, dir }], supply: [{ k: "g1", f: 0 }] });
  assert.equal(judge(seq(start(L(1)), [["g10", 1, 0]])).won, true);   // motor +1, middle -1, output +1
  assert.equal(judge(seq(start(L(-1)), [["g10", 1, 0]])).won, false);
});
ok("a ring with three shafts has five meshes and jams", () => {
  // 3x3 ring round an empty middle: AB bridge, B gear, BC bridge, C gear, CA bridge. The last bridge closes the loop.
  const L = { w: 3, h: 3, box: box(3, 3), door: "N", fixed: [],
    supply: [{ k: "br", f: 0, g: 1 }, { k: "br", f: 1, g: 2 }, { k: "br", f: 2, g: 0 }, { k: "g1", f: 1 }, { k: "g1", f: 2 }] };
  let st = seq(start(L), [["g12", 1, 2], ["br20", 0, 1, 3], ["br12", 2, 1, 1], ["g11", 2, 0]]);
  assert.equal(judge(st).ok, true);
  assert.match(put(st, "br01", 0, 0, 0).why, /jam/);
});
ok("a triangle of two 1x1 and one 2x2 jams", () => {
  const s = start({ w: 4, h: 2, box: box(4, 2), door: "N", fixed: [{ t: "motor", x: 3, y: 1, f: 0, id: 0 }], supply: [{ k: "g2", f: 0 }, { k: "g1", f: 0 }] });
  // M(3,0); big at (1,0)-(2,1) touches M and ... place g1 at (3,1): touches M (3,0) and big (2,1): triangle M-g1-big
  const r1 = put(s, "g20", 1, 0); assert.ok(r1.ok, r1.why);
  const r2 = put(r1.state, "g10", 3, 0); assert.match(r2.why, /jam/);
});
ok("two motors in one train fuse", () => {
  const s = start({ w: 3, h: 1, box: box(3, 1), door: "N", fixed: [{ t: "motor", x: 0, y: 0, f: 0, id: 0 }, { t: "motor", x: 2, y: 0, f: 0, id: 1 }], supply: [{ k: "g1", f: 0 }] });
  assert.match(put(s, "g10", 1, 0).why, /fuse/);
});
ok("order: a gear placed first shuts the door on the cells behind it", () => {
  const L = { w: 1, h: 3, box: box(1, 3), door: "N", fixed: [{ t: "motor", x: 0, y: 2, f: 0, id: 0 }], supply: [{ k: "g1", f: 0 }, { k: "g1", f: 0 }] };
  const s = start(L);
  assert.match(put(s, "g10", 0, 0).state && put(put(s, "g10", 0, 0).state, "g10", 0, 1).why, /blocked/); // top first, then the one under it cannot get in
  assert.ok(put(put(s, "g10", 0, 1).state, "g10", 0, 0).ok);   // bottom first works
});
ok("orientation: a horizontal bridge cannot pass down a one-wide corridor", () => {
  const L = { w: 3, h: 3, box: ["#.#", "#.#", "..."], door: "N", fixed: [], supply: [{ k: "br", f: 0, g: 1 }] };
  const s = start(L);
  assert.equal(s.P.places.some(p => p.o === 0 && p.y === 2), true);   // it fits the bottom row...
  assert.match(put(s, "br01", 0, 2, 0).why, /blocked/);              // ...but cannot get there lying down
  assert.ok(put(s, "br01", 1, 1, 1).ok);                             // standing up it can
});
console.log(n, "rules ok");
