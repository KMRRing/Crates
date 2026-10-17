// Drift's rules (drift-engine.js): the deal from a seed, the wind (every tile slid downwind to the edge or the next
// tile, in order, each way), lines across and down, the turn (lines checked after the wind, the wind blowing again
// after a clear), the points, the forecast moving on, the squalls (forecast a turn ahead, their strays on empty squares
// where nothing can be laid, landing there, making no line, more often and more of them), stakes (a staked tile staying
// put, the wind piling tiles against it, its stake going with it when it clears), the end with no room, a game saved
// and opened again, and whole games played out to their end.
import { N, COLOURS, START, WINDS, PACE, STAKE_EVERY, squallEvery, squallCount, newGame, upgrade, forecast, blow, lines, gale, worth, lay, moves, filled } from "../drift-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const i = (x, y) => y * N + x;
/** A field drawn by hand: rows of characters from the top, "." empty, "0"–"3" a tile; rows not given empty. */
const field = rows => { const c = new Array(N * N).fill(-1); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") c[i(x, y)] = Number(ch); })); return c; };
const row = (c, y) => [...Array(N).keys()].map(x => (c[i(x, y)] < 0 ? "." : c[i(x, y)])).join("");
const game = (rows, next = [0, 0], winds = [1, 1, 1], extra = {}) => Object.assign(newGame(1), { cells: field(rows), next, winds, untilSquall: 99 }, extra);

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.cells) !== JSON.stringify(c.cells), "the same seed deals the same field, another seed another");
  check(filled(a) === START && lines(a.cells).length === 0 && a.next.length === 2 && a.winds.length === 3 && a.winds.every(w => w >= 0 && w < 4) && WINDS.length === 4, `${START} tiles, none in a line, two tiles coming and three winds forecast`);
}

// ---------- the wind ----------
{
  const c = field([".0.1..2"]);
  check(row(blow(c, 1).cells, 0) === "....012" && row(blow(c, 3).cells, 0) === "012....", "east or west, every tile slides to the edge or the next tile, keeping its order");
  const down = field(["3", ".", "2"]), s = blow(down, 2).cells, u = blow(down, 0).cells;
  check(s[i(0, 6)] === 2 && s[i(0, 5)] === 3 && u[i(0, 0)] === 3 && u[i(0, 1)] === 2, "and south or north, down the columns");
  check(blow(c, 1).moved.map(m => m.join(">")).join() === "3>5,1>4" && blow(field(["......0"]), 1).moved.length === 0, "what moved and where is told (what was already against the edge didn't), for the page to play out");
}

// ---------- lines ----------
{
  check(lines(field(["000...."])).join() === "0,1,2" && lines(field(["0000..."])).length === 4 && lines(field(["00.0..."])).length === 0, "three or more alike in a row; a gap breaks it");
  check(lines(field(["1", "1", "1"])).length === 3 && lines(field(["111", "1.."])).length === 3, "down too, and a square in two lines counts once");
}

// ---------- a turn ----------
{
  const s = game(["00....."], [0, 2], [3, 2, 0]), r = lay(s, i(6, 0));
  check(r.gusts[0].cleared.length === 3 && r.gain === worth(3) && r.state.score === 90 && row(r.state.cells, 0) === ".......", "laid at the far end, the west wind brings it up to the other two: three in a row clear, 90");
  const not = lay(game(["00....."], [0, 0], [1, 1, 1]), i(3, 1));
  check(not.gain === 0 && not.gusts.length === 1, "lines count after the wind: laid where the wind takes it elsewhere, it makes nothing");
  // three noughts clear on the east wind; it blows again, the 3 slides into the corner and lines up with the two below
  const c = lay(game(["3...00.", "......3", "......3"], [0, 1], [1, 1, 1]), i(6, 0));
  check(c.gusts.length === 3 && c.gusts[0].cleared.length === 3 && c.gusts[1].cleared.length === 3 && c.gain === worth(6), "a clear, and the wind blows again, which can line up more: all of a turn's clears count together, 360");
  check(s.cells[i(0, 0)] === 0 && s.turns === 0, "the game laid on is left as it was");
  check(r.state.next[0] === 2 && r.state.winds.join() === "2,0," + r.state.winds[2] && r.state.turns === 1, "the next tile comes up and the forecast moves on a day");
  let threw = 0;
  try { lay(s, i(0, 0)); } catch { threw++; }
  try { lay(Object.assign(structuredClone(s), { over: true }), i(5, 5)); } catch { threw++; }
  check(threw === 2 && moves(s).length === N * N - 2, "a tile goes on an empty square, and not once it's over");
  const g = gale(field(["000"]), 1);
  check(g.cleared === 3 && g.gusts.length === 2 && g.gusts[1].cleared.length === 0, "the wind over a field until it settles, as the page shows a turn beforehand");
  check(worth(3) === 90 && worth(6) === 360 && worth(10) === 1000, "ten times the square of all a turn clears");
}

// ---------- squalls ----------
{
  const s = game([], [3, 3], [1, 1, 1], { untilSquall: 1, turns: 50 });
  s.strays = forecast(s);
  const coming = new Set(s.strays.map(q => q.at));
  check(s.strays.length === squallCount(50) && s.strays.every(q => s.cells[q.at] < 0 && q.colour >= 0 && q.colour < COLOURS) && coming.size === s.strays.length && !moves(s).some(m => coming.has(m)),
    "a squall is forecast the turn before it comes: its strays on empty squares, and no tile can be laid where one is coming");
  let threw = false;
  try { lay(s, s.strays[0].at); } catch { threw = true; }
  const m = moves(s)[0], r = lay(s, m);
  check(threw && r.squall.map(q => `${q.at}:${q.colour}`).join() === s.strays.map(q => `${q.at}:${q.colour}`).join() && r.state.untilSquall === squallEvery(51), "laid there, refused; the strays land where they were forecast, before the wind, and the count starts again");
  const c = s.cells.slice();
  c[m] = s.next[0];
  for (const q of s.strays) c[q.at] = q.colour;
  check(JSON.stringify(gale(c, s.winds[0], s.stakes).cells) === JSON.stringify(r.state.cells), "so the turn shown beforehand, the strays in it, is the turn played");
  check(r.state.strays.length === (r.state.untilSquall === 1 ? squallCount(51) : 0) && lay(game([], [3, 3], [1, 1, 1], { untilSquall: 3 }), 0).state.strays.length === 0, "the next squall is forecast once it's a turn away, and not before");
  const two = Array.from({ length: N }, (_, y) => [...Array(N).keys()].map(x => ((x + 2 * y) % 4)).join(""));
  two[0] = `..${two[0].slice(2)}`;
  const last = game(two, [1, 1], [1, 1, 1], { untilSquall: 1, turns: 500 });
  last.strays = forecast(last);
  check(last.strays.length === 1 && moves(last).length === 1, "never on the last empty square: a tile can always be laid");
  check(squallEvery(0) > squallEvery(60) && squallCount(500) > squallCount(0) && PACE.every(([, e, c]) => e >= 1 && c >= 1), "squalls come more often, and with more, as the game goes on");
}

// ---------- stakes ----------
{
  const c = field([".0.1..2"]), at3 = [i(3, 0)];
  check(row(blow(c, 1, at3).cells, 0) === "..01..2" && row(blow(c, 3, at3).cells, 0) === "0..12..", "a staked tile stays put, and the wind piles the tiles upwind of it against it, as against an edge");
  const down = blow(field(["3", ".", "0"]), 2, [i(0, 0)]).cells;
  check(blow(c, 1, at3).moved.map(m => m.join(">")).join() === "1>2" && down[i(0, 0)] === 3 && down[i(0, 6)] === 0, "only what moved is told; down a column the same");
  const g = gale(field(["11..1.1"]), 1, [i(1, 0)]);
  check(g.cleared === 0 && row(g.cells, 0) === "11...11" && g.stakes.join() === String(i(1, 0)), "a stake can keep a line apart: the two on the right can't reach the two held against it");
  const clear = gale(field(["1.1..1."]), 3, [i(2, 0)]);
  check(clear.cleared === 0 && row(clear.cells, 0) === "1.11...", "and blown the other way, the third piles against the stake, beside its pair but for the gap the stake holds open");
  const s = game(["......."], [2, 0], [3, 1, 1], { untilStake: 0 }), r = lay(s, i(5, 0));
  check(r.staked && r.state.stakes.join() === String(i(5, 0)) && r.state.cells[i(5, 0)] === 2 && r.state.untilStake === STAKE_EVERY - 1, `the tile laid with a stake stays where it's laid, even with the wind; the next comes ${STAKE_EVERY} tiles on`);
  const t = lay(game(["22....."], [2, 0], [3, 1, 1], { untilStake: 0 }), i(2, 0));
  check(t.gain === 90 && t.state.stakes.length === 0 && row(t.state.cells, 0) === ".......", "a staked tile in a line clears like any other, and its stake goes with it");
  check(lay(game([], [1, 0], [1, 1, 1], { untilStake: 3 }), i(0, 0)).state.untilStake === 2 && !lay(game([], [1, 0], [1, 1, 1], { untilStake: 3 }), i(0, 0)).staked, "the count to the next stake goes down a tile at a time");
  const was = newGame(4);
  delete was.stakes; delete was.untilStake;
  const up = upgrade(was);
  check(up.stakes.length === 0 && up.untilStake === STAKE_EVERY - 1 && !("stakes" in was) && upgrade(up) === up, "a game saved before stakes is given none, and the count to the first");
  const unforecast = Object.assign(newGame(6), { untilSquall: 1 });
  delete unforecast.strays;
  const told = upgrade(unforecast);
  check(told.strays.length === squallCount(told.turns) && !("strays" in unforecast) && upgrade(Object.assign(newGame(6), { strays: undefined, untilSquall: 2 })).strays.length === 0, "one saved before the squall was forecast is given its forecast, when it's a turn away");
}

// ---------- the end ----------
{
  const full = Array.from({ length: N }, (_, y) => [...Array(N).keys()].map(x => ((x + 2 * y) % 4)).join(""));
  full[0] = `.${full[0].slice(1)}`;
  const s = game(full, [1, 1], [1, 1, 1]);
  check(lines(s.cells).length === 0, "(a field full but for one square, no line on it)");
  const r = lay(s, i(0, 0));
  check(r.over && r.state.over && r.gain === 0, "no room left after the wind: the game is over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) s = lay(s, moves(s)[(k * 7) % moves(s).length]).state;
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[3];
  check(JSON.stringify(lay(s, m)) === JSON.stringify(lay(again, m)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], greedy = [];
  for (let g = 0; g < 10; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.turns < 3000) { const all = moves(s); s = lay(s, all[Math.floor(rnd() * all.length)]).state; }
    random.push(s.turns);
    let t = newGame(100 + g);
    while (!t.over && t.turns < 3000) {
      let best = null, bv = -Infinity;
      for (const m of moves(t)) { const o = lay(t, m), v = o.gain - 6 * filled(o.state) - (o.over ? 1e6 : 0); if (v > bv) { bv = v; best = o; } }
      t = best.state;
    }
    greedy.push(t.turns);
  }
  check(median(random) < 100, `laying anywhere: the field full in about ${median(random)} turns`);
  check(median(greedy) > 1.5 * median(random) && Math.max(...greedy) < 3000, `laying for the wind: about ${median(greedy)} turns, and the squalls still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("drift: the deal, the wind, lines, a turn, squalls, stakes, the end, saving, whole games");
