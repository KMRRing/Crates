// Shunt's rules (shunt-engine.js): the deal from a seed, a track's squares from the end shoved in at, a shove rolling
// the wagons up to the first gap, a full track shoving its far wagon off the rails for a life, runs across and down
// departing (a square in two counted once) and their points, the goods train's wagons (in no run, more and more often),
// scrap flats (never departing, shoved off a full track for no life), the end at the third derailment, a game saved and
// opened again, and whole games played out to their end.
import { N, CARGOES, LIVES, START, PACE, SCRAP, SCRAP_ODDS, dropEvery, dropCount, newGame, track, runs, roll, shove, shoves, worth, filled } from "../shunt-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const i = (x, y) => y * N + x;
/** A game with a yard drawn by hand: rows of characters, "." empty, "0"–"3" a wagon, "4" a scrap flat, from the top. */
function yard(rows, next = [0, 0], extra = {}) {
  const s = newGame(1);
  s.cells = new Array(N * N).fill(-1);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") s.cells[i(x, y)] = Number(ch); }));
  s.next = next;
  s.untilDrop = 99;
  return Object.assign(s, extra);
}
const row = (s, y) => [...Array(N).keys()].map(x => (s.cells[i(x, y)] < 0 ? "." : s.cells[i(x, y)])).join("");

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.cells) !== JSON.stringify(c.cells), "the same seed deals the same yard, another seed another");
  check(filled(a) === START && runs(a.cells).length === 0, `${START} wagons standing, none in a run`);
  check(a.next.length === 2 && a.lives === LIVES && a.score === 0 && a.untilDrop === dropEvery(0) && !a.over, "two wagons coming, three lives, the goods train counting down");
  check([...Array(40).keys()].every(k => runs(newGame(k).cells).length === 0), "no deal starts with a run");
}

// ---------- the tracks ----------
{
  check(track("left", 2).join() === [12, 13, 14, 15, 16, 17].join() && track("right", 2).join() === [17, 16, 15, 14, 13, 12].join(), "a row from its left end and from its right");
  check(track("top", 1).join() === [1, 7, 13, 19, 25, 31].join() && track("bottom", 1).join() === [31, 25, 19, 13, 7, 1].join(), "a column from its top and from its foot");
}

// ---------- a shove ----------
{
  const s = yard(["01.3.."], [2, 1]);
  const r = roll(s, { side: "left", line: 0 });
  const after = shove(s, { side: "left", line: 0 });
  check(row(after.state, 0) === "2013.." && r.moved.map(m => m.join(">")).join() === "1>2,0>1,-1>0" && r.derailed < 0, "the wagons from the end shoved in roll on up to the first gap; the rest stand");
  check(row(shove(s, { side: "right", line: 0 }).state, 0) === "01.3.2", "from the other end: the gap is at the end, so the wagon just stands there");
  check(after.state.next[0] === 1 && after.state.next.length === 2 && after.state.shoves === 1, "the next wagon comes up, another after it");
  check(row(s, 0) === "01.3.." && s.shoves === 0, "the game a shove was made from is left as it was");
  const full = yard(["012301"], [2, 0]), f = shove(full, { side: "left", line: 0 });
  check(row(f.state, 0) === "201230" && f.derailed === 5 && f.state.lives === LIVES - 1, "a full track: the far wagon is shoved off the rails, a life lost");
  check(roll(full, { side: "left", line: 0 }).derailed === 5 && full.lives === LIVES, "roll shows a shove beforehand without making it");
}

// ---------- runs ----------
{
  const s = yard(["00.1.."], [0, 2]), r = shove(s, { side: "left", line: 0 });
  check(r.departed.join() === "0,1,2" && row(r.state, 0) === "...1.." && r.gain === worth(3) && r.state.score === 90, "three alike in a line depart: ten times the square of three");
  check(r.cells.slice(0, 4).join() === "0,0,0,1", "what a shove did keeps the yard as it stood before they departed, to be played out");
  const down = yard(["......", "2.....", "2.....", "1....."], [2, 0]), d = shove(down, { side: "top", line: 0 });
  check(d.departed.join() === [i(0, 0), i(0, 1), i(0, 2)].join() && d.state.cells[i(0, 3)] === 1, "and down");
  const cross = yard([".00...", "0.....", "0....."], [0, 1]), x = shove(cross, { side: "top", line: 0 });
  check(x.departed.length === 5 && x.gain === worth(5), "a wagon in two runs at once sends both off, itself counted once: 250");
  const pair = yard(["330..."], [3, 0]);
  check(roll(pair, { side: "left", line: 0 }).departed.length === 3 && roll(pair, { side: "right", line: 0 }).departed.length === 0, "the wagon shoved in joins the pair it pushes along; from the far end it stands alone");
  check(runs(yard(["1111.."]).cells).length === 4 && runs(yard(["11.11."]).cells).length === 0, "a run is three or more in a row, with no gap");
  check(worth(3) === 90 && worth(4) === 160 && worth(6) === 360, "ten times the square of the wagons departing");
}

// ---------- the goods train ----------
{
  const s = yard(["01....", "23...."], [1, 1], { untilDrop: 1, shoves: 10 }), r = shove(s, { side: "left", line: 5 });
  check(r.dropped.length === dropCount(10) && r.dropped.every(k => s.cells[k] < 0 && r.state.cells[k] >= 0), "every few shoves the goods train leaves a wagon on an empty square");
  check(r.state.untilDrop === dropEvery(11), "then counts down afresh");
  check(PACE.every(([, every, count]) => every >= 1 && count >= 1) && dropEvery(0) > dropEvery(120) && dropCount(0) < dropCount(500), "it comes more often, and with more, as the game goes on");
  // played at random for a while: nothing left standing in a run after a shove, the goods train's wagons included
  let z = 11;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let quiet = true, seen = 0;
  for (let g = 0; g < 30; g++) {
    let st = newGame(500 + g);
    while (!st.over && st.shoves < 150) {
      const all = shoves(st).filter(m => m.result.derailed < 0), pick = (all.length ? all : shoves(st))[Math.floor(rnd() * (all.length || 24))];
      seen += pick.result.dropped.length;
      if (runs(pick.result.state.cells).length) quiet = false;
      st = pick.result.state;
    }
  }
  check(quiet && seen > 100, `the goods train's wagons stand in no run (${seen} of them)`);
}

// ---------- scrap flats ----------
{
  check(runs(yard(["444..."]).cells).length === 0 && runs(yard(["004000"]).cells).length === 3, "scrap flats never make a run, and break one");
  const s = yard(["012304"], [2, 0]), r = shove(s, { side: "left", line: 0 });
  check(r.scrapped && r.derailed === 5 && r.state.lives === LIVES && row(r.state, 0) === "201230", "shoved off the end of a full track, a scrap flat costs no life");
  const back = shove(yard(["412301"], [2, 0]), { side: "left", line: 0 });
  check(!back.scrapped && back.state.lives === LIVES - 1 && row(back.state, 0) === "241230", "but whatever's at the far end goes: a cargo wagon there still costs one");
  check(roll(yard(["412301"], [2, 0]), { side: "right", line: 0 }).scrapped, "from the other end, the same track sends the scrap flat off");
  let z = 13, left = 0, scrap = 0, coming = true;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let g = 0; g < 30; g++) {
    let st = newGame(700 + g);
    while (!st.over && st.shoves < 150) {
      const all = shoves(st).filter(m => m.result.derailed < 0), pick = (all.length ? all : shoves(st))[Math.floor(rnd() * (all.length || 24))];
      for (const i of pick.result.dropped) { left++; if (pick.result.state.cells[i] === SCRAP) scrap++; }
      if (pick.result.state.next.some(c => c >= CARGOES)) coming = false;
      st = pick.result.state;
    }
  }
  check(scrap > left / (2 * SCRAP_ODDS) && scrap < (2 * left) / SCRAP_ODDS && coming, `the goods train leaves a scrap flat about one wagon in ${SCRAP_ODDS} (${scrap} of ${left}); the wagons coming never are`);
}

// ---------- the end ----------
{
  const s = yard(["012301"], [2, 0], { lives: 1 }), r = shove(s, { side: "left", line: 0 });
  check(r.over && r.state.over && r.state.lives === 0, "the third derailment ends the game");
  const after = shove(r.state, { side: "left", line: 1 });
  check(after.moved.length === 0 && JSON.stringify(after.state) === JSON.stringify(r.state), "nothing moves once it's over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) s = shove(s, { side: ["left", "top", "right", "bottom"][k % 4], line: k % N }).state;
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(shove(s, { side: "top", line: 3 })) === JSON.stringify(shove(again, { side: "top", line: 3 })), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], greedy = [];
  for (let g = 0; g < 5; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.shoves < 1000) { const all = shoves(s); s = all[Math.floor(rnd() * all.length)].result.state; }
    random.push(s.shoves);
    // the best shove each turn: the most points, no derailment (bar scrap's), the yard kept empty and clear of scrap
    let t = newGame(100 + g);
    const scrap = st => st.cells.filter(c => c === SCRAP).length;
    while (!t.over && t.shoves < 1000) {
      t = shoves(t).map(m => ({ m, v: m.result.gain - (m.result.derailed >= 0 && !m.result.scrapped ? 400 : 0) - 3 * filled(m.result.state) - 12 * scrap(m.result.state) })).sort((a, b) => b.v - a.v)[0].m.result.state;
    }
    greedy.push(t.shoves);
  }
  check(median(random) < 60, `shoving anywhere: off the rails three times in about ${median(random)} shoves`);
  check(median(greedy) > 100 && Math.max(...greedy) < 1000, `shoving with thought: about ${median(greedy)} shoves, and the goods train still ends it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("shunt: the deal, the tracks, a shove, runs, the goods train, scrap flats, the end, saving, whole games");
