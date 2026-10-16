// Polder's rules (polder-engine.js): the deal from a seed, the pieces (wall-like, none solid), where a piece fits, what
// a polder is (water the open sea can't reach, the coast holding it, corners holding it, silt not), what goes with it
// and its points, a piece laid and a new hand dealt, the silt (from the coast, more and more often), the end when no
// piece fits, a game saved and opened again, and whole games played out to their end.
import { N, HAND, WATER, DYKE, SILT, PIECES, PACE, siltEvery, siltCount, newGame, cover, fitsAnywhere, polders, worth, lay, moves, dykes } from "../polder-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const i = (x, y) => y * N + x;
/** A sea drawn by hand: rows of characters from the top, "." water, "#" a dyke, "s" silt; the rows not given water. */
function sea(rows) {
  const cells = new Array(N * N).fill(WATER);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { cells[i(x, y)] = ch === "#" ? DYKE : ch === "s" ? SILT : WATER; }));
  return cells;
}
const game = (rows, hand = ["0.0", "0.0", "0.0"], extra = {}) => Object.assign(newGame(1), { cells: sea(rows), hand, untilSilt: 99 }, extra);
const foot = rows => [...Array(N - rows.length).fill("........"), ...rows];   // rows at the foot, by the coast

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), hands = new Set([...Array(10).keys()].map(k => newGame(k).hand.join()));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.cells.every(c => c === WATER) && a.hand.length === HAND && a.hand.every(h => PIECES[h]) && a.sets === 1 && a.untilSilt === siltEvery(0) && !a.over, "open water, three pieces in hand, the silt counting down");
}

// ---------- the pieces ----------
{
  const names = Object.keys(PIECES);
  const connected = p => {
    const key = ([x, y]) => `${x},${y}`, have = new Set(p.cells.map(key)), seen = new Set([key(p.cells[0])]), stack = [p.cells[0]];
    while (stack.length) { const [x, y] = stack.pop(); for (const n of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (have.has(key(n)) && !seen.has(key(n))) { seen.add(key(n)); stack.push(n); } }
    return seen.size === p.cells.length;
  };
  const solid = p => p.cells.some(([x, y]) => [[x + 1, y], [x, y + 1], [x + 1, y + 1]].every(([a, b]) => p.cells.some(c => c[0] === a && c[1] === b)));
  check(names.length > 30 && names.every(k => connected(PIECES[k]) && PIECES[k].cells.length <= 5 && PIECES[k].weight > 0), `${names.length} pieces, each of up to five squares joined along their sides`);
  check(names.every(k => !solid(PIECES[k])), "every piece is wall-like: no two by two of dyke in any of them");
  check(names.every(k => { const p = PIECES[k]; return Math.min(...p.cells.map(c => c[0])) === 0 && Math.min(...p.cells.map(c => c[1])) === 0 && p.cells.every(([x, y]) => x < p.w && y < p.h); }), "each piece measured from its top left");
}

// ---------- where a piece fits ----------
{
  const cells = sea(["#.......", "s......."]);
  check(cover(cells, "0.0", 1, 0)?.join() === "1" && cover(cells, "0.0", 0, 0) === null && cover(cells, "0.0", 0, 1) === null, "a piece goes on water, not on a dyke or silt");
  check(cover(cells, "4.0", 4, 3)?.length === 4 && cover(cells, "4.0", 5, 3) === null && cover(cells, "4.1", 0, 5) === null, "nor off the sea");
  check(fitsAnywhere(cells, "10.0") && !fitsAnywhere(sea(Array(N).fill("s.s.s.s.")), "1.0"), "a piece fits somewhere, or nowhere");
}

// ---------- polders ----------
{
  const plus = polders(sea(["........", "........", "...#....", "..#.#...", "...#...."]));
  check(plus.water.join() === `${i(3, 3)}` && plus.banks.length === 4, "four dykes round a square, touching only at their corners: water flows across sides, not corners, so it's held");
  const coast = polders(sea(foot(["...#....", "..#.#..."])));
  check(coast.water.join() === `${i(3, 7)}` && coast.banks.length === 3, "the coast at the foot holds water: three dykes enclose a square against it");
  check(polders(sea(foot(["#.......", ".#......"]))).water.length === 0 && polders(sea(foot([".......#", "......#."]))).water.length === 0, "beyond the sides is open sea: a corner by the coast isn't closed by the coast alone");
  check(polders(sea([".#......", "#.#....."])).water.length === 0, "nor is the top: water along it reaches the open sea");
  const big = polders(sea(foot(["########", "#......#", "#..ss..#"])));
  check(big.water.length === 12 && big.water.includes(i(3, 7)) && big.banks.length === 12, "a dyke from side to side and down both sides to the coast: twelve squares, the silt in them too, and the twelve dykes round them");
  check(polders(sea(["........", "........", "...#....", "..s.#...", "...#...."])).water.length === 0, "silt holds no water: water flows over it");
  const corners = polders(sea(["........", "........", "..###...", "..#.#...", "..###..."]));
  check(corners.water.length === 1 && corners.banks.length === 8, "the dykes touching a polder at its corners go with it too");
  check(worth(1) === 10 && worth(4) === 160 && worth(12) === 1440, "ten times the square of what drains in one go");
}

// ---------- a piece laid ----------
{
  const s = game(foot(["...#....", "..#....."]), ["0.0", "4.0", "1.1"]);
  const r = lay(s, 0, 4, 7);
  check(r.laid.join() === `${i(4, 7)}` && r.water.join() === `${i(3, 7)}` && r.gain === 10 && r.state.score === 10, "the dyke that closes a polder: it drains, ten points");
  check([i(2, 7), i(3, 6), i(4, 7), i(3, 7)].every(k => r.state.cells[k] === WATER) && dykes(r.state) === 0, "and clears, its dykes with it, the new one too");
  check(r.state.hand[0] === null && r.state.hand[1] === "4.0" && r.state.laid === 1 && !r.dealt, "the piece is gone from the hand, the others wait");
  check(s.cells[i(3, 6)] === DYKE && s.hand[0] === "0.0", "the game a piece was laid from is left as it was");
  const two = lay(lay(r.state, 1, 0, 0).state, 2, 0, 3);
  check(two.dealt && two.state.hand.every(h => PIECES[h]) && two.state.sets === 2, "the third laid, three more are dealt");
  let threw = 0;
  try { lay(s, 0, 3, 6); } catch { threw++; }
  try { lay(r.state, 0, 0, 0); } catch { threw++; }
  check(threw === 2, "a piece isn't laid where it doesn't fit, nor from an empty place in the hand");
  check(moves(s).length === moves(s).filter(m => cover(s.cells, s.hand[m.slot], m.x, m.y)).length && moves(s).some(m => m.slot === 1), "the moves are every place each piece fits");
}

// ---------- the silt ----------
{
  const s = game([], ["0.0", "0.0", "0.0"], { untilSilt: 1, laid: 10 }), r = lay(s, 0, 0, 0);
  check(r.silted.length === siltCount(10) && r.silted.every(k => k >= N * (N - 1) && r.state.cells[k] === SILT), "every few pieces the sea leaves silt, on the water along the coast first");
  check(r.state.untilSilt === siltEvery(11), "then counts down afresh");
  const beside = game(foot(["...s....", "########"]), ["0.0", "0.0", "0.0"], { untilSilt: 1 }), b = lay(beside, 0, 0, 0);
  check(b.silted.length === 1 && [i(2, 6), i(4, 6), i(3, 5)].includes(b.silted[0]), "and beside silt already there: a sandbank grows from the coast");
  check(PACE.every(([, every, count]) => every >= 1 && count >= 1) && siltEvery(0) > siltEvery(200) && siltEvery(1000) >= 1, "it comes more often as the game goes on");
}

// ---------- the end ----------
{
  const s = game(["s.ssssss", ...Array(N - 1).fill("ssssssss")], ["0.0", "4.0", "4.1"]);
  const r = lay(s, 0, 1, 0);
  check(r.over && r.state.over && r.water.length === 0, "a hand none of which fits anywhere ends the game");
  let threw = false;
  try { lay(r.state, 1, 0, 0); } catch { threw = true; }
  check(threw, "nothing is laid once it's over");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 7; k++) { const m = moves(s)[k * 3 % moves(s).length]; s = lay(s, m.slot, m.x, m.y).state; }
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[0];
  check(JSON.stringify(lay(s, m.slot, m.x, m.y)) === JSON.stringify(lay(again, m.slot, m.x, m.y)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const silt = c => c.filter(v => v === SILT).length;
  const random = [], greedy = [];
  for (let g = 0; g < 8; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.laid < 1000) { const all = moves(s), m = all[Math.floor(rnd() * all.length)]; s = lay(s, m.slot, m.x, m.y).state; }
    random.push(s.laid);
    // the piece that drains most and leaves the least built and silted
    let t = newGame(100 + g);
    while (!t.over && t.laid < 1000) {
      let best = null, bv = -Infinity;
      for (const m of moves(t)) { const o = lay(t, m.slot, m.x, m.y), v = 3 * o.gain - 4 * dykes(o.state) - 8 * silt(o.state.cells) - (o.over ? 1e6 : 0); if (v > bv) { bv = v; best = o; } }
      t = best.state;
    }
    greedy.push(t.laid);
  }
  check(median(random) < 60, `laying anywhere: no room left after about ${median(random)} pieces`);
  check(median(greedy) > 1.5 * median(random) && Math.max(...greedy) < 1000, `laying with thought: about ${median(greedy)} pieces, and the silt still ends it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("polder: the deal, the pieces, where they fit, polders, laying, the silt, the end, saving, whole games");
