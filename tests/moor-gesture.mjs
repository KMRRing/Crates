// What fingers do on Moor's 3D harbour (moor-gesture.js): a tap places, a drag turns, two fingers pinch, and no order of lifting
// two fingers ever leaves the harbour deaf (an earlier build kept the pinch's first finger as "the" finger: lift it first and every
// later tap and drag was ignored, which is how a barge could not be placed after zooming).
import fs from "node:fs";
import { createGesture } from "../moor-gesture.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

function rig() {
  const log = { taps: [], turns: [], pinch: [], ends: 0, starts: 0 };
  const g = createGesture(9, {
    tap: (x, y) => log.taps.push([x, y]),
    turn: (dx, dy) => log.turns.push([dx, dy]),
    pinchStart: () => log.starts++,
    pinchMove: s => log.pinch.push(s),
    pinchEnd: () => log.ends++,
  });
  return { g, log };
}
const tapAt = (g, id, x, y) => { g.down(id, x, y, true); g.up(id, x, y); };

{
  const { g, log } = rig();
  tapAt(g, 1, 100, 100);
  check(log.taps.length === 1 && log.taps[0][0] === 100 && !log.turns.length, "a finger that stays put taps where it lifted");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, true); g.move(1, 104, 103); g.up(1, 104, 103);
  check(log.taps.length === 1 && !log.turns.length, "a shake inside the slip is still a tap");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, true); g.move(1, 112, 100); g.move(1, 130, 110); g.up(1, 130, 110);
  check(!log.taps.length && log.turns.length === 1 && log.turns[0][0] === 18, "a short drag past the slip turns the view and does not place");
  tapAt(g, 2, 50, 50);
  check(log.taps.length === 1, "...and the next tap places");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, true); g.move(1, 112, 100); g.move(1, 100, 100); g.up(1, 100, 100);
  check(!log.taps.length, "a finger that strayed and came back is not a tap");
}
for (const order of [[1, 2], [2, 1]]) {
  const { g, log } = rig();
  g.down(1, 100, 300, true); g.down(2, 200, 300, false);
  g.move(1, 80, 300); g.move(2, 220, 300);
  g.up(order[0], 100, 300); g.up(order[1], 100, 300);
  check(log.starts === 1 && log.ends === 1 && log.pinch.length === 2 && log.pinch[1] > 1 && !log.taps.length, `a pinch (lifting finger ${order[0]} first) zooms, ends once and places nothing`);
  tapAt(g, 3, 120, 120);
  check(log.taps.length === 1, `...and a tap right after it places (lifting finger ${order[0]} first)`);
  g.down(4, 10, 10, true); g.move(4, 40, 10); g.move(4, 55, 10);
  check(log.turns.length === 1, `...and a drag after it turns (lifting finger ${order[0]} first)`);
  g.up(4, 40, 10);
}
{
  const { g, log } = rig();
  g.down(1, 100, 300, true); g.down(2, 200, 300, false); g.up(1, 100, 300);
  g.move(2, 230, 330); g.up(2, 230, 330);
  check(log.turns.length === 1 && !log.taps.length, "the finger left from a pinch turns the view on and never taps");
}
{
  const { g, log } = rig();
  g.down(1, 100, 300, true); g.down(2, 200, 300, false);
  g.down(1, 60, 60, true);        // a first touch after a pointerup that never came
  g.up(1, 60, 60);
  check(log.taps.length === 1 && log.ends === 1, "a new first touch clears what a lost pointerup left behind");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, true); g.up(1, 100, 100, true);
  check(!log.taps.length && !g.busy, "a cancelled touch places nothing and leaves nothing behind");
  g.down(1, 100, 100, true); g.down(2, 150, 100, false); g.cancel();
  check(!g.busy && log.ends === 1, "cancel() (the menu opens) lets go of every finger");
}

// marking: a drag that begins on the board paints and never turns; one that begins off it turns
function paintRig(onBoard = () => true) {
  const log = { taps: [], turns: [], paints: [], ends: 0, pinch: [] };
  const g = createGesture(9, {
    marks: (x, y, shift) => !shift && onBoard(x, y),
    tap: (x, y) => log.taps.push([x, y]),
    turn: (dx, dy) => log.turns.push([dx, dy]),
    paint: (x, y, begin) => log.paints.push([x, y, begin]),
    paintEnd: () => log.ends++,
    pinchMove: s => log.pinch.push(s),
  });
  return { g, log };
}
{
  const { g, log } = paintRig();
  tapAt(g, 1, 100, 100);
  check(log.taps.length === 1 && !log.paints.length, "a tap on the board still taps (the page's press)");
}
{
  const { g, log } = paintRig();
  g.down(1, 100, 100, true); g.move(1, 104, 100);
  check(!log.paints.length, "a shake inside the slip paints nothing");
  g.move(1, 130, 100); g.move(1, 160, 100); g.up(1, 160, 100);
  check(log.paints.length === 3 && log.paints[0][2] === true && log.paints[0][0] === 100 && !log.paints[1][2] && log.ends === 1, "a drag from the board starts a stroke at the press, follows the finger and ends once");
  check(!log.turns.length && !log.taps.length, "...and does not turn the view or tap");
}
{
  const { g, log } = paintRig(x => x > 50);
  g.down(1, 10, 100, true); g.move(1, 40, 100); g.move(1, 70, 100); g.up(1, 70, 100);
  check(log.turns.length === 1 && !log.paints.length, "a drag that begins off the board turns the view and paints nothing");
}
{
  const { g, log } = paintRig();
  g.down(1, 100, 100, true, true); g.move(1, 130, 100, true); g.move(1, 150, 100, true); g.up(1, 150, 100);
  check(log.turns.length === 1 && !log.paints.length, "shift-drag with a mouse turns/pans even from the board");
}
{
  const { g, log } = paintRig();
  g.down(1, 100, 100, true); g.move(1, 130, 100);
  g.down(2, 200, 100, false); g.move(2, 230, 100); g.move(1, 90, 100);
  check(log.ends === 1 && log.pinch.length >= 1, "a second finger ends the stroke and starts a pinch (the camera)");
  const painted = log.paints.length;
  g.move(1, 60, 100);
  check(log.paints.length === painted, "...and the first finger paints no more");
  g.up(1, 60, 100); g.up(2, 230, 100);
  check(!log.taps.length && !g.busy, "...and lifting them places nothing");
}
{
  const { g, log } = paintRig();
  g.down(1, 100, 100, true); g.move(1, 130, 100); g.up(1, 130, 100, true);
  check(log.ends === 1 && !log.taps.length, "a cancelled stroke ends cleanly");
}

// the harbour is wired to it, and a tap on a cell is the page's press
{
  const three = fs.readFileSync(new URL("../moor-3d.js", import.meta.url), "utf8");
  check(/createGesture\(/.test(three) && /opts\.press\?\.\(x, "tap"\)/.test(three) && /gesture\.down\(e\.pointerId, e\.clientX, e\.clientY, e\.isPrimary, /.test(three), "the harbour sends every finger through the gesture and a tap on a cell to the page's press");
  check(/marks: \(cx, cy, shift\) =>/.test(three) && /opts\.stroke\?\.\(/.test(three) && /mr3-move/.test(three), "the harbour paints a drag that begins on a cell, and has the Move switch");
  const page = fs.readFileSync(new URL("../moor.js", import.meta.url), "utf8");
  check(/stroke: strokeFrom/.test(page) && /function beginStroke/.test(page), "the page gives the harbour the same stroke the flat board paints");
  check(/reset\(\)/.test(three) && /lastTap/.test(three), "two taps beside the board turn the view back");
}

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nall ok");
