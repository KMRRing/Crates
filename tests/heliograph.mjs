// Heliograph's rules (heliograph-engine.js): the deal from a seed, the beam (straight up, turned by each kind of
// mirror, through the gems of its colour, stopped by another, out at the edge, back at the heliograph, round a loop of
// mirrors for ever), what a shot shatters and what then falls, the points, a mirror's three shots, where a mirror may
// go, the field coming down (on a mirror, onto the heliograph's row), a cleared field, the queue's colours, a game
// saved and opened again, and whole games played out to their end.
import { COLS, ROWS, SOURCE, LIFE, START_ROWS, CLEAR_BONUS, dropEvery, newGame, trace, fire, canPlace, nextAim, loose, worth, lowest, turns, reflect } from "../heliograph-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const i = (x, y) => y * COLS + x;
/** A game with a field drawn by hand: rows of characters, "." empty, "0"–"3" a gem, from the top. */
function board(rows, colour = 0, extra = {}) {
  const s = newGame(1);
  s.gems = new Array(COLS * ROWS).fill(-1);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") s.gems[i(x, y)] = Number(ch); }));
  s.mirrors = [];
  s.queue = [colour, colour];
  s.untilDrop = 99;
  return Object.assign(s, extra);
}

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.gems) !== JSON.stringify(c.gems), "the same seed deals the same field, another seed another");
  const full = y => [...Array(COLS).keys()].every(x => a.gems[i(x, y)] >= 0 && a.gems[i(x, y)] < 4), empty = y => [...Array(COLS).keys()].every(x => a.gems[i(x, y)] === -1);
  check([...Array(START_ROWS).keys()].every(full) && [...Array(ROWS - START_ROWS).keys()].every(k => empty(START_ROWS + k)), `${START_ROWS} rows of gems from the top, the rest empty`);
  check(a.aim === "up" && a.queue.length === 2 && a.queue.every(q => a.gems.includes(q)) && a.untilDrop === dropEvery(0), "the heliograph facing up, two colours coming, both on the field");
}

// ---------- the beam ----------
{
  // column 3 from the foot: two 2s, a gap, a 2, then a 1
  const rows = [".......", "...1...", "...2...", ".......", "...2...", "...2..."];
  const s = board(rows, 2), t = trace(s);
  check(t.end === "gem" && t.stop === i(3, 1) && t.shattered.join() === [i(3, 5), i(3, 4), i(3, 2)].join(), "straight up: through every gem of its colour, across a gap, stopped by the first of another");
  check(t.points[0].join() === `${SOURCE.x},${SOURCE.y}` && t.points.at(-1).join() === "3,1.5", "its path from the heliograph to the stopping gem's near face");
  const other = trace(board(rows, 1));
  check(other.shattered.length === 0 && other.stop === i(3, 5), "another colour: stopped by the first gem, nothing shattered");
  check(trace(board(["......."], 0)).end === "edge", "nothing in its way: out at the top");
}
{
  check(reflect([0, -1], "/").join() === "1,0" && reflect([1, 0], "/").join() === "0,-1" && reflect([0, -1], "\\").join() === "-1,0" && reflect([-1, 0], "\\").join() === "0,-1",
    "a / turns a beam going up to the right and one going right up; a \\ turns up to the left and left up");
  // a / at the foot of column 3 sends it right along row 9, another / at column 5 sends it up column 5 into a 0
  const s = board(["....0.0"], 0);
  s.gems[i(5, 3)] = 0;
  s.mirrors = [{ x: 3, y: 9, t: "/", life: 3 }, { x: 5, y: 9, t: "/", life: 3 }];
  const t = trace(s);
  check(t.shattered.includes(i(5, 3)) && t.points.map(p => p.join()).slice(0, 3).join(" ") === "3,11 3,9 5,9", "two mirrors: up, right along a row, up another column");
  const ghost = trace(board(["...0..."], 0), { x: 3, y: 6, t: "\\" });
  check(ghost.end === "edge" && ghost.points[1].join() === "3,6", "a mirror being laid is in the beam's way as if it were there");
  const side = trace({ ...board(["......."], 0), aim: "right" });
  check(side.end === "edge" && side.points.at(-1).join() === `${COLS - 0.5},${SOURCE.y}`, "the heliograph turned right: along its own row to the edge");
  // a beam's way back is its way out (each turn undone by the same mirror), so it can't be caught in a ring of mirrors:
  // it always ends, at a gem, the edge or the heliograph
  let ends = true;
  for (let k = 0; k < 300; k++) {
    const g = board(["0123012"], k % 4);
    for (let y = 1; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (!(x === SOURCE.x && y === SOURCE.y) && (x * 7 + y * 13 + k * 5) % 3 === 0) g.mirrors.push({ x, y, t: (x + y + k) % 2 ? "/" : "\\", life: 3 });
    for (const aim of ["up", "right", "left"]) { const t = trace({ ...g, aim }); if (!["gem", "edge", "source"].includes(t.end)) ends = false; }
  }
  check(ends, "a field full of mirrors: the beam always ends, at a gem, the edge or back at the heliograph");
  const back = board(["......."], 0);
  back.mirrors = [{ x: 3, y: 9, t: "/", life: 3 }, { x: 5, y: 9, t: "\\", life: 3 }, { x: 5, y: 11, t: "/", life: 3 }];
  check(trace(back).end === "source", "a beam turned back onto the heliograph ends there");
}

// ---------- a shot ----------
{
  // a column of 1s hangs from a 2 that is all that holds it; a beam of 2s from the side shatters it and the 1s fall
  const s = board(["2222222", "...2...", "...1...", "...1...", "..11..."], 2);
  s.gems[i(3, 0)] = 2;
  const r = fire(s, { x: 3, y: 6, t: "/" });
  check(r.shattered.length === 0, "a mirror below the column turns the beam away, into nothing");
  const cut = board(["0000000", "...0...", "...1...", "...1...", "..11..."], 0, { aim: "right" });
  cut.mirrors = [{ x: 4, y: 11, t: "/", life: 3 }, { x: 4, y: 1, t: "\\", life: 3 }];
  const r2 = fire(cut);
  check(r2.shattered.includes(i(3, 1)) && r2.fallen.length === 4 && r2.fallen.every(k => cut.gems[k] === 1), "a gem holding others up shattered: what hung from it falls");
  check(r2.gain === worth(r2.shattered.length + r2.fallen.length) && worth(1) === 10 && worth(5) === 250 && r2.state.score === r2.gain, "ten times the square of all a shot brings down");
  check(loose(cut.gems).length === 0 && r2.state.gems.every((c, k) => c === -1 || !r2.fallen.includes(k)), "nothing loose before, nothing left hanging after");
  check(JSON.stringify(cut.gems) === JSON.stringify(board(["0000000", "...0...", "...1...", "...1...", "..11..."], 0).gems), "the game a shot was fired from is left as it was");
}
{
  // a mirror lasts its three shots, the one it was laid for included
  let s = board(["0000000"], 1);
  s = fire(s, { x: 1, y: 8, t: "/" }).state;
  const lives = [s.mirrors[0]?.life];
  s = fire(s).state; lives.push(s.mirrors[0]?.life);
  const r = fire(s); lives.push(r.state.mirrors.length);
  check(LIFE === 3 && lives.join() === "2,1,0" && r.faded.length === 1, "a mirror takes part in three shots, then it's gone");
  const replace = fire({ ...board(["0000000"], 1), mirrors: [{ x: 1, y: 8, t: "/", life: 1 }] }, { x: 1, y: 8, t: "\\" });
  check(replace.state.mirrors.length === 1 && replace.state.mirrors[0].t === "\\" && replace.state.mirrors[0].life === LIFE - 1, "a mirror laid on another replaces it, fresh");
  const g = board(["0000000"], 1);
  check(canPlace(g, 0, 5) && !canPlace(g, 0, 0) && !canPlace(g, SOURCE.x, SOURCE.y) && !canPlace(g, -1, 3) && !canPlace(g, COLS, 3), "a mirror goes on an empty square, not on a gem, the heliograph or off the field");
  let threw = false;
  try { fire(g, { x: 0, y: 0, t: "/" }); } catch { threw = true; }
  check(threw, "a mirror on a gem isn't fired");
  check(nextAim("up") === "right" && nextAim("right") === "left" && nextAim("left") === "up", "the heliograph turns up, right, left");
}

// ---------- the field coming down ----------
{
  const s = board(["1111111", "1111111"], 3, { untilDrop: 1 });
  s.mirrors = [{ x: 0, y: 2, t: "/", life: 3 }, { x: 6, y: 5, t: "/", life: 3 }];
  const r = fire(s);
  check(r.dropped && r.state.gems.slice(COLS, 3 * COLS).every(c => c === 1) && r.state.gems.slice(0, COLS).every(c => c >= 0), "the field comes down a row, a new row above it");
  check(r.crushed.length === 1 && r.crushed[0].y === 2 && r.state.mirrors.length === 1, "a mirror the field comes down on is crushed");
  check(r.state.untilDrop === dropEvery(r.state.shots) && dropEvery(0) > dropEvery(100) && dropEvery(1000) >= 2, "the next drop counted afresh, the gap shorter as the game goes on");
  const low = board(["1111111", ...Array(ROWS - 2).fill("...1...")], 3, { untilDrop: 1 });
  check(lowest(low) === ROWS - 2 && fire(low).over && fire(low).state.over, "a gem reaching the heliograph's row ends the game");
  check(fire(fire(low).state).path === null, "nothing fires once it's over");
}
{
  const s = board(["...0..."], 0);
  const r = fire(s);
  check(r.cleared && r.state.score === worth(1) + CLEAR_BONUS && lowest(r.state) === START_ROWS - 1, `a field cleared: ${CLEAR_BONUS} more, and a new field`);
  const q = board(["...0...", "...1..."], 2);
  check(fire(q).state.queue.every(c => c === 0 || c === 1), "the colours coming are colours on the field");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 6; k++) s = fire(s, k % 2 ? { x: k, y: 9, t: "/" } : null).state;
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(fire(s, { x: 2, y: 8, t: "\\" })) === JSON.stringify(fire(again, { x: 2, y: 8, t: "\\" })), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  // without mirrors the beam only ever reaches one column: the field soon wins
  let s = newGame(5);
  while (!s.over && s.shots < 400) s = fire({ ...s, aim: ["up", "right", "left"].map(aim => ({ aim, r: fire({ ...s, aim }) })).sort((a, b) => b.r.gain - a.r.gain)[0].aim }).state;
  check(s.over && s.shots < 60, `no mirrors: the field reaches the heliograph in ${s.shots} shots`);
  // laying mirrors, the best shot each turn: a long game, ended by the pace
  let g = newGame(9), most = 0;
  while (!g.over && g.shots < 400) {
    const best = turns(g).sort((a, b) => b.gain - a.gain)[0];
    most = Math.max(most, best.gain);
    g = fire({ ...g, aim: best.aim }, best.extra).state;
  }
  check(g.over && g.shots > 100 && g.shots < 400 && g.score > 2000, `the best shot each turn: ${g.shots} shots, ${g.score} points, the best shot ${most}`);
  // the first shot: with a mirror the beam reaches every column's lowest gem; without, only the heliograph's own column
  const reach = list => new Set(list.flatMap(t => [t.result.path.stop, ...t.result.shattered].filter(k => k != null).map(k => k % COLS)));
  const all = turns(newGame(9));
  check(reach(all).size === COLS && reach(all.filter(t => !t.extra)).size === 1, "from the first shot, a mirror lets the beam reach every column; without one, only the heliograph's own");
}

console.log(bad ? `heliograph: ${bad} failed` : "heliograph: every check passed");
process.exit(bad ? 1 : 0);
