// What fingers do on Carrom's board (carrom-gesture.js): a finger that lands on the striker or its baseline is an aim from touch to
// lift, so zoom never fights the shot; every other finger is the view (tap, double tap, turn, pinch); and no order of lifting two
// fingers leaves the board deaf (Moor once kept a pinch's first finger as "the" finger: lift it first and every later touch was ignored).
import fs from "node:fs";
import { createTouch } from "../carrom-gesture.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the striker is a disc at (200, 500); the baseline a band across y 480..520
let aimOn = true;
const aimAt = (x, y) => (!aimOn ? null : Math.hypot(x - 200, y - 500) < 30 ? "pull" : Math.abs(y - 500) < 20 ? "slide" : null);
function rig() {
  const log = { taps: [], doubles: 0, turns: [], pinch: [], ends: 0, starts: 0, aims: [], aimMoves: [], aimEnds: [] };
  const g = createTouch({ slip: 9, aimAt }, {
    tap: (x, y, d) => { log.taps.push([x, y]); if (d) log.doubles++; },
    turn: (dx, dy) => log.turns.push([dx, dy]),
    pinchStart: () => log.starts++,
    pinchMove: s => log.pinch.push(s),
    pinchEnd: () => log.ends++,
    aimStart: (id, kind) => log.aims.push([id, kind]),
    aimMove: (x, y) => log.aimMoves.push([x, y]),
    aimEnd: c => log.aimEnds.push(c),
  });
  return { g, log };
}
const P = { primary: true };
const tapAt = (g, id, x, y, t = 0) => { g.down(id, x, y, { primary: true, t }); g.up(id, x, y, { t }); };

{
  const { g, log } = rig();
  tapAt(g, 1, 100, 100);
  check(log.taps.length === 1 && !log.turns.length && !log.aims.length, "a finger that stays put on the table taps");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, P); g.move(1, 104, 103); g.up(1, 104, 103);
  check(log.taps.length === 1 && !log.turns.length, "a shake inside the slip is still a tap");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, P); g.move(1, 112, 100); g.move(1, 130, 110); g.up(1, 130, 110);
  check(!log.taps.length && log.turns.length === 1 && log.turns[0][0] === 18, "a drag on empty table turns the view");
}

// the aim
{
  const { g, log } = rig();
  g.down(1, 205, 505, P); g.move(1, 210, 560); g.move(1, 20, 900); g.up(1, 20, 900);
  check(log.aims.length === 1 && log.aims[0][1] === "pull" && log.aimMoves.length === 2 && log.aimEnds[0] === false && !log.turns.length && !log.taps.length,
    "a drag that starts on the striker is an aim wherever it goes: no turn, no tap");
}
{
  const { g, log } = rig();
  g.down(1, 60, 505, P); g.move(1, 100, 505); g.up(1, 100, 505);
  check(log.aims[0]?.[1] === "slide" && log.aimMoves.length === 1, "a finger on the baseline slides the striker");
}
{
  const { g, log } = rig();
  g.down(1, 205, 505, P); g.down(2, 300, 300); g.move(2, 340, 300); g.move(1, 210, 560);
  check(!log.starts && !log.pinch.length && !log.turns.length && log.aimMoves.length === 1, "a second finger during an aim is no pinch and turns nothing");
  g.up(1, 210, 560);
  g.move(2, 380, 320); g.up(2, 380, 320);
  check(log.aimEnds.length === 1 && !log.taps.length && !log.turns.length, "...and left over after the aim, it neither taps nor turns");
  tapAt(g, 3, 50, 50);
  check(log.taps.length === 1, "...and the next touch taps");
}
{
  const { g, log } = rig();
  g.down(1, 205, 505, P); g.down(2, 300, 300); g.up(2, 300, 300); g.move(1, 210, 560); g.up(1, 210, 560);
  check(log.aimMoves.length === 1 && log.aimEnds[0] === false, "the extra finger lifting first leaves the aim whole");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, P); g.down(2, 205, 505);
  check(log.starts === 1 && !log.aims.length, "a second finger on the striker joins a pinch and never starts an aim");
}
{
  aimOn = false;
  const { g, log } = rig();
  g.down(1, 205, 505, P); g.move(1, 260, 505); g.move(1, 300, 505); g.up(1, 300, 505);
  check(!log.aims.length && log.turns.length === 1, "when it is not your shot the striker is just table: the drag turns the view");
  aimOn = true;
}
{
  const { g, log } = rig();
  g.down(1, 205, 505, P);
  g.down(1, 60, 60, P);      // a first touch after a pointerup that never came
  g.up(1, 60, 60);
  check(log.aimEnds.length === 1 && log.aimEnds[0] === true && log.taps.length === 1, "a new first touch cancels an aim whose pointerup was lost");
}

// the pinch, in either order of lifting
for (const order of [[1, 2], [2, 1]]) {
  const { g, log } = rig();
  g.down(1, 100, 300, P); g.down(2, 200, 300);
  g.move(1, 80, 300); g.move(2, 220, 300);
  g.up(order[0], 100, 300); g.up(order[1], 100, 300);
  check(log.starts === 1 && log.ends === 1 && log.pinch.length === 2 && log.pinch[1] > 1 && !log.taps.length, `a pinch (lifting finger ${order[0]} first) zooms, ends once and taps nothing`);
  tapAt(g, 3, 120, 120);
  check(log.taps.length === 1, `...and a tap right after it works (lifting finger ${order[0]} first)`);
  g.down(4, 10, 10, P); g.move(4, 40, 10); g.move(4, 55, 10);
  check(log.turns.length === 1, `...and a drag after it turns (lifting finger ${order[0]} first)`);
  g.up(4, 40, 10);
  g.down(5, 205, 505, P);
  check(log.aims.length === 1, `...and the striker can be aimed (lifting finger ${order[0]} first)`);
  g.up(5, 205, 505);
}
{
  const { g, log } = rig();
  g.down(1, 100, 300, P); g.down(2, 200, 300); g.up(1, 100, 300);
  g.move(2, 230, 330); g.up(2, 230, 330);
  check(log.turns.length === 1 && !log.taps.length, "the finger left from a pinch turns the view on and never taps");
}

// double tap
{
  const { g, log } = rig();
  tapAt(g, 1, 100, 100, 1000); tapAt(g, 2, 104, 102, 1200);
  check(log.taps.length === 2 && log.doubles === 1, "two quick taps in one place are a double tap");
  tapAt(g, 3, 104, 102, 1300);
  check(log.doubles === 1, "...and a third is the start of the next, not another double");
}
{
  const { g, log } = rig();
  tapAt(g, 1, 100, 100, 1000); tapAt(g, 2, 100, 100, 1600);
  check(log.doubles === 0, "two taps too far apart in time are not a double");
  tapAt(g, 3, 300, 100, 1700);
  check(log.doubles === 0, "...nor two in different places");
}
{
  const { g, log } = rig();
  tapAt(g, 1, 100, 100, 1000);
  g.down(2, 100, 100, { primary: true, t: 1100 }); g.move(2, 140, 100); g.up(2, 140, 100, { t: 1150 });
  tapAt(g, 3, 100, 100, 1200);
  check(log.doubles === 0, "a drag between two taps breaks the double");
  tapAt(g, 4, 105, 100, 1300);
  check(log.doubles === 1, "...and the pair after it still counts");
}
{
  const { g, log } = rig();
  g.down(1, 100, 100, P); g.up(1, 100, 100, { cancelled: true });
  check(!log.taps.length && !g.busy, "a cancelled touch taps nothing and leaves nothing behind");
  g.down(1, 205, 505, P); g.down(2, 300, 300); g.cancel();
  check(!g.busy && log.aimEnds.length === 1, "cancel() (the menu opens) lets go of every finger and the aim");
}

// the board is wired to it
{
  const three = fs.readFileSync(new URL("../carrom-3d.js", import.meta.url), "utf8");
  check(/createTouch\(/.test(three) && /touch\.down\(e\.pointerId, e\.clientX, e\.clientY/.test(three), "the board sends every finger through the gesture");
  check(/addEventListener\("wheel"/.test(three) && /resetView/.test(three), "the wheel zooms and a double tap puts the view back");
}

if (bad) { console.log(`\n${bad} FAILED`); process.exit(1); }
console.log("\nall ok");
