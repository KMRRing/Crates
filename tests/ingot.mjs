// Ingot's rules (ingot-engine.js): a swipe slides and merges (a bar merges once a swipe, the pair nearest the wall first),
// a move that moves nothing is refused, the new bar comes from the seed and the draw's number (a 2 nine times in ten),
// the day's seed is one for a date, the score is the merged values, undo (a few, one swipe, the draw taken back), the end
// when no swipe moves anything, the 2048 bar noted with play going on, a game saved and opened again, and the search
// (a hint that takes the merge in front of it, a whole game played by it, the same twice).
import { N, SIZE, WIN, UNDOS, HINTS, swipe, alive, legal, bar, daySeed, newGame, move, undo, end, valid, hint, play, value } from "../ingot-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** A grid from four rows of values (0 empty, else 2, 4, 8...). */
const grid = (...rows) => rows.flat().map(v => (v ? Math.log2(v) : 0));
const show = g => g.map(e => value(e));

// ---------- sliding and merging ----------
{
  const g = grid([2, 0, 0, 2], [0, 4, 0, 0], [2, 2, 2, 0], [2, 2, 4, 4]);
  const r = swipe(g, "left");
  check(show(r.grid).join() === "4,0,0,0,4,0,0,0,4,2,0,0,4,8,0,0" && r.gain === 4 + 4 + 8 + 0 + 4 - 4 + 4 - 4 + 4, "left: slides to the wall, merges equal neighbours, a bar merges once (2 2 2 slides to 4 2; 2 2 4 4 to 4 8)");
  check(r.gain === 4 + 4 + 8 + 4, "the score gained is the values merged: 4 + 4 (the 2s) + 8 + 4 (the 2 2)");
  const l = swipe(grid([2, 2, 2, 2], [4, 4, 4, 0], [0, 0, 0, 0], [0, 0, 0, 0]), "left");
  check(show(l.grid).slice(0, 8).join() === "4,4,0,0,8,4,0,0", "2 2 2 2 makes 4 4; 4 4 4 makes 8 4: the pair nearest the wall merges first");
  const rt = swipe(grid([2, 2, 2, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), "right");
  check(show(rt.grid).slice(0, 4).join() === "0,0,2,4", "right: the pair nearest the right wall merges (0 2 4)");
  const u = swipe(grid([2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [8, 0, 0, 0]), "up"), d = swipe(grid([2, 0, 0, 0], [2, 0, 0, 0], [4, 0, 0, 0], [8, 0, 0, 0]), "down");
  check(show(u.grid).filter((_, i) => i % N === 0).join() === "4,4,8,0" && show(d.grid).filter((_, i) => i % N === 0).join() === "0,4,4,8", "up and down slide the columns the same way");
  check(!swipe(grid([2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), "left").moved, "a row already at the wall with nothing to merge does not move");
  check(r.slides.length === 2 + 1 + 3 + 4, "every bar has a slide");
  const only = swipe(grid([2, 0, 0, 2], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), "left");
  check(only.slides.length === 2 && only.slides[0].to === 0 && only.slides[1].to === 0 && only.slides[1].into, "the slides say where each bar went and which merged into the one before");
}

// ---------- the draw ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), "the same seed deals the same game, another seed another");
  check(a.grid.filter(Boolean).length === 2 && a.n === 2 && a.score === 0 && a.undos === UNDOS && a.hints === HINTS && !a.over, "two bars to start, three undos and three hints");
  let twos = 0, fours = 0, total = 4000, where = new Set();
  const empty = new Array(SIZE).fill(0);
  for (let n = 0; n < total; n++) { const x = bar(empty, 99, n); x.e === 1 ? twos++ : fours++; where.add(x.at); }
  check(Math.abs(twos / total - 0.9) < 0.02 && where.size === SIZE, `a 2 nine times in ten (${(100 * twos / total).toFixed(1)}%), on any empty square`);
  const full = grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 0]);
  check(bar(full, 3, 5).at === 15 && bar(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]), 3, 5) === null, "a bar lands only on an empty square, and nowhere on a full board");
  check(daySeed(20261104) === daySeed(20261104) && daySeed(20261104) !== daySeed(20261105), "the day's seed is one number for a date");
}

// ---------- a swipe played ----------
{
  const g = newGame(daySeed(20261104)), dir = legal(g.grid)[0], r = move(g, dir);
  const again = move(newGame(daySeed(20261104)), dir);
  check(JSON.stringify(r.state) === JSON.stringify(again.state), "the same swipes on the day's board bring the same bars for everyone");
  check(r.state.moves === 1 && r.state.n === g.n + 1 && g.moves === 0 && g.n === 2, "a swipe makes a new game and leaves the old one as it was");
  check(r.state.grid.filter(Boolean).length === g.grid.filter(Boolean).length + 1 - (r.slides.filter(s => s.into).length) && r.state.grid[r.bar.at] === r.bar.e, "one new bar lands, in the square it says");
  const stuck = Object.assign(newGame(1), { grid: grid([2, 4, 8, 16], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]) });
  check(move(stuck, "left") === null && move(stuck, "up") === null && move(stuck, "down") !== null, "a swipe that moves nothing is refused, one that moves something is not");
  check(move({ ...stuck, over: true }, "up") === null, "nothing moves in a game that's over");
  const m = move(Object.assign(newGame(5), { grid: grid([2, 2, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]), score: 10 }), "left");
  check(m.state.score === 14 && m.gain === 4, "the score goes up by what merged");
}

// ---------- undo ----------
{
  let s = newGame(21);
  const before = JSON.stringify(s);
  const dirs = [];
  for (let k = 0; k < 6; k++) { const d = legal(s.grid)[0]; dirs.push(d); s = move(s, d).state; }
  const last = s;
  const u = undo(s);
  check(u && u.moves === 5 && u.undos === UNDOS - 1 && u.prev === null && u.n === last.n - 1, "undo takes the last swipe back, the draw with it, and costs one of three");
  check(undo(u) === null, "only the last swipe can be taken back: not twice in a row");
  const redo = move(u, dirs[5]);
  check(JSON.stringify(redo.state.grid) === JSON.stringify(last.grid) && redo.state.score === last.score, "the same swipe again brings the same bar");
  let t = s;
  for (let k = 0; k < 4; k++) { t = undo(t) || t; const d = legal(t.grid)[0]; t = move(t, d).state; }
  check(t.undos === 0 && undo(t) === null, "no undo left after three");
  check(undo(newGame(1)) === null && JSON.stringify(newGame(21)) === before, "nothing to undo at the start");
}

// ---------- the end, and 2048 ----------
{
  const dead = Object.assign(newGame(3), { grid: grid([8, 16, 8, 16], [16, 8, 16, 8], [8, 16, 8, 16], [16, 8, 0, 32]), score: 50 });
  check(alive(dead.grid) && !alive(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2])), "a board is alive while a swipe moves something");
  const r = move(dead, "left");
  check(r.over && r.state.over && !r.state.ended, "the swipe that leaves no swipe ends the game");
  const e = end(newGame(2));
  check(e.over && e.ended && end(e) === e, "a game can be ended by hand, once");
  const near = Object.assign(newGame(4), { grid: grid([1024, 1024, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]) });
  const w = move(near, "left");
  check(w.made && w.state.reached && !w.over && w.state.top === WIN && w.gain === 2048, "the 2048 bar is noted when made and play goes on");
  const w2 = move(Object.assign(w.state, {}), legal(w.state.grid)[0]);
  check(!w2.made && w2.state.reached, "…and it is noted once");
  check(value(WIN) === 2048, "WIN is the 2048 bar");
}

// ---------- saved ----------
{
  let s = newGame(9);
  for (let k = 0; k < 20; k++) s = move(s, legal(s.grid)[0]).state;
  const back = JSON.parse(JSON.stringify(s));
  check(valid(back) && JSON.stringify(move(back, legal(back.grid)[0]).state) === JSON.stringify(move(s, legal(s.grid)[0]).state), "a saved game opens again and goes on as it would have");
  check(!valid(null) && !valid({}) && !valid({ ...back, grid: back.grid.slice(1) }) && !valid({ ...back, v: 2 }), "a bad save is refused");
}

// ---------- the search ----------
{
  const take = hint(grid([0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [1024, 512, 256, 256]), 3);
  check(take.dir === "left" || take.dir === "right", `a hint takes the merge in front of it, along the row (${take.dir})`);
  check(hint(grid([2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]), 2).dir === null, "no hint on a board with no swipe");
  const t = performance.now();
  const h = hint(newGame(12).grid, 3);
  check(legal(newGame(12).grid).includes(h.dir) && performance.now() - t < 1000, "a hint is one of the legal swipes, in well under a second");
  const a = play(newGame(5), 60, 2), b = play(newGame(5), 60, 2);
  check(JSON.stringify(a) === JSON.stringify(b) && a.moves === 60 && a.score > 100, `the search plays the same game twice (60 swipes: ${a.score})`);
  const g = play(newGame(daySeed(20261104)), Infinity, 1);
  check(g.over && g.score > 3000 && g.moves > 300, `a whole game by the quick search ends with no swipe left (${g.score} in ${g.moves} swipes, top ${value(g.top)})`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("ingot: sliding, merging, the draw, a swipe, undo, the end, 2048, saving, the search");
