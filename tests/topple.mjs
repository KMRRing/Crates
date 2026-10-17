// Topple's rules (topple-engine.js): the deal from a seed, the pieces, where a piece fits, how dominoes fall (straight
// on, turning only where a line ends, both ways at a fork; a blob's middle left standing; each from the one before it),
// a knock's clearing and its points (the dominoes times the steps they take: a snake from its end beats a blob), the
// bell doubling a fall that passes it and moving on, the knock on the table's time (due when a hand's last piece is
// down, every hand and then every second, nothing laid until it's made), the end (no room and no knock due), a game
// saved before the knock was the table's, a game saved and opened again, and whole games played out to their end.
import { N, HAND, PIECES, PACE, knockEvery, newGame, upgrade, cover, fitsAnywhere, chain, group, chains, stepsOf, longest, knockOn, worth, lay, knock, moves } from "../topple-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const i = (x, y) => y * N + x;
/** A table drawn by hand: rows of characters from the top, "." empty, "0"–"2" a domino of that colour. */
function table(rows) {
  const cells = new Array(N * N).fill(-1);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== ".") cells[i(x, y)] = Number(ch); }));
  return cells;
}
const piece = (p, colour = 0) => ({ piece: p, colour });
const game = (rows, hand = [piece("0.0"), piece("0.0"), piece("0.0")], extra = {}) => Object.assign(newGame(1), { cells: table(rows), hand, due: true, untilKnock: 0, bell: i(7, 7) }, extra);
const fallen = (rows, x, y) => chain(table(rows), i(x, y)).map(f => f[0]).sort((a, b) => a - b).join();

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), hands = new Set([...Array(10).keys()].map(k => JSON.stringify(newGame(k).hand)));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.v === 2 && a.cells.every(c => c === -1) && a.hand.length === HAND && a.hand.every(h => PIECES[h.piece] && h.colour >= 0 && h.colour < 3) && !a.due && a.untilKnock === 1 && a.sets === 1 && !a.over,
    "an empty table, three pieces in three colours, a knock after the first hand");
  check(new Set([...Array(30).keys()].map(k => newGame(k).bell)).size > 10 && newGame(3).bell >= 0, "the bell on a square of the table, a different one game to game");
  const names = Object.keys(PIECES);
  check(names.length > 30 && names.every(k => PIECES[k].cells.length <= 5 && Math.min(...PIECES[k].cells.map(c => c[0])) === 0 && Math.min(...PIECES[k].cells.map(c => c[1])) === 0), `${names.length} pieces of up to five dominoes, each measured from its top left`);
}

// ---------- where a piece fits ----------
{
  const cells = table(["0......."]);
  check(cover(cells, "0.0", 1, 0)?.join() === "1" && cover(cells, "0.0", 0, 0) === null && cover(cells, "4.0", 5, 2) === null && cover(cells, "4.0", 4, 2)?.length === 4, "a piece goes on empty squares, not on a domino or off the table");
  check(fitsAnywhere(cells, "9.0") && !fitsAnywhere(table(Array(N).fill("0.1.0.1.")), "1.0"), "a piece fits somewhere, or nowhere");
}

// ---------- how dominoes fall ----------
{
  const run = chain(table(["0000...."]), 0);
  check(run.length === 4 && stepsOf(run) === 4 && run.map(f => f[1]).join() === "0,1,2,3" && run[0][2] === -1, "a line knocked at its end falls end to end, a step a domino, the one knocked first");
  check(stepsOf(chain(table(["0000...."]), i(1, 0))) === 3 && chain(table(["0000...."]), i(1, 0)).length === 4, "knocked in the middle it falls both ways at once");
  const ell = chain(table(["000.....", "..0.....", "..0....."]), 0);
  check(ell.length === 5 && stepsOf(ell) === 5, "it turns where its line ends: round a corner, the whole L in five steps");
  check(fallen(["000.....", ".0......"], 1, 1) === `${i(0, 0)},${i(1, 0)},${i(2, 0)},${i(1, 1)}` && fallen(["000.....", ".0......"], 0, 0) === `${i(0, 0)},${i(1, 0)},${i(2, 0)}`,
    "a T knocked from its stem falls both ways along its bar; knocked from an end of the bar, the stem stays standing");
  check(fallen(["00......", "00......"], 0, 0).split(",").length === 4 && stepsOf(chain(table(["00......", "00......"]), 0)) === 3, "a square of four falls whole from a corner, in three steps");
  const block = table(["000.....", "000.....", "000....."]), b = chain(block, 0).map(f => f[0]);
  check(b.length === 8 && !b.includes(i(1, 1)) && group(block, 0).length === 9, "a block of nine falls round its edge and leaves its middle standing");
  const fork = chain(table(["0.......", "0.......", "000.....", "0.......", "0......."]), 0), steps = Object.fromEntries(fork.map(([sq, st]) => [sq, st]));
  const across = chain(table(["0.......", "0.......", "000.....", "0.......", "0......."]), i(2, 2));
  check(fork.length === 5 && steps[i(0, 4)] === 4 && !(i(1, 2) in steps) && across.length === 7 && stepsOf(across) === 5,
    "at a fork: run into along the line it goes straight on and the branch stays standing; run into end-on from the branch, it splits both ways and all of it falls");
  const c = chain(table(["0.......", "0..0....", "0000....", "...0....", "1......."]), 0), st = Object.fromEntries(c.map(([sq, k]) => [sq, k]));
  check(c.every(([sq, k, by]) => by < 0 || (st[by] === k - 1 && Math.abs((sq % N) - (by % N)) + Math.abs(Math.floor(sq / N) - Math.floor(by / N)) === 1)), "each falls from a neighbour a step before it");
  check(!c.some(([sq]) => sq === i(0, 4)) && chain(table(["0.", ".0"]), 0).length === 1 && chain(table(["0......."]), i(5, 5)).length === 0, "another colour stops it, so does a corner, and an empty square sets nothing off");
  check(chains(table(["0000....", "1......."])).map(k => k.length).join() === "4,1", "the dominoes standing, joined by colour, most first");
}

// ---------- a knock, its points, the bell ----------
{
  const s = game(["000.....", "1......."]), r = knock(s, i(0, 0));
  check(r.fell.length === 3 && r.steps === 3 && r.gain === 90 && r.state.score === 90 && r.state.cells.slice(0, 3).every(c => c === -1) && r.state.cells[i(0, 1)] === 1, "the dominoes fall and clear: ten times how many fell times the steps they took, a line of three from its end 90");
  check(knock(s, i(1, 0)).gain === 60 && worth(1) === 10 && worth(10) === 1000 && worth(20, 10) === 2000, "knocked in the middle, two steps: 60; one long line beats several short ones");
  check(!r.state.due && r.state.untilKnock === knockEvery(s.sets) && r.state.felled === 3 && s.due && s.cells[0] === 0, "the knock made; the next counted from here; the game knocked from left as it was");
  let threw = 0;
  try { knock(r.state, i(0, 1)); } catch { threw++; }
  try { knock(s, i(5, 5)); } catch { threw++; }
  check(threw === 2, "no knock when none is due, nor on an empty square");
  const five = game(["00000..."]), blob = game(["00......", "00......"]), four = game(["0000...."]);
  check(knock(five, i(0, 0)).gain === 250 && knock(five, i(2, 0)).gain === 150 && knock(blob, i(0, 0)).gain === 120 && knock(four, i(0, 0)).gain === 160, "a line of five: 250 from its end, 150 from its middle; a square of four 120 against a line of four's 160");
  const ell = table(["0000....", "...0....", "...0....", "1......."]), best = longest(ell, i(2, 0));
  check(best.steps === 6 && best.gain === 360 && best.size === 6 && [i(0, 0), i(3, 2)].includes(best.at) && longest(table(["000.....", "000.....", "000....."]), 0).fell === 8, "the best knock on what's joined: from a far end, here round the corner in six, 360; on a block, all but its middle");
  const rung = knock(game(["0000...."], undefined, { bell: i(2, 0) }), 0);
  check(rung.rang && rung.gain === 320 && rung.state.rung === 1 && rung.state.bell !== i(2, 0) && rung.state.cells[rung.state.bell] === -1, "a fall past the bell scores double (a line of four 320) and the bell moves to an empty square");
  const missed = knock(game(["0000....", "........", "1......."], undefined, { bell: i(0, 2) }), 0);
  check(!missed.rang && missed.gain === 160 && missed.state.bell === i(0, 2) && knockOn(table(["0000...."]), 0, i(3, 0)).rings, "a fall that doesn't pass it leaves it where it hangs");
}

// ---------- laying, and the knock on the table's time ----------
{
  const s = game([], [piece("1.0", 2), piece("0.0", 1), piece("2.1", 0)], { due: false, untilKnock: 2 });
  const r = lay(s, 0, 3, 3);
  check(r.laid.join() === `${i(3, 3)},${i(4, 3)}` && r.state.cells[i(3, 3)] === 2 && r.state.hand[0] === null && r.state.laid === 1 && !r.dealt && !r.due, "a piece stands its dominoes in its colour; the others wait");
  let threw = false;
  try { lay(r.state, 1, 3, 3); } catch { threw = true; }
  check(threw && s.cells[i(3, 3)] === -1, "not where a domino stands; the game laid from left as it was");
  const all = lay(lay(r.state, 1, 0, 0).state, 2, 7, 0);
  check(all.dealt && all.state.hand.every(Boolean) && all.state.sets === s.sets + 1 && !all.due && all.state.untilKnock === 1, "the third laid, three more are dealt, and the knock a hand nearer");
  const due = lay(lay(lay(all.state, 0, 0, 2).state, 1, 4, 4).state, 2, 0, 6);
  check(due.due && due.state.due && !moves(due.state).length, "a hand's last piece down when the knock is due: the knock first, nothing laid until it's made");
  threw = false;
  try { lay(due.state, 0, 6, 6); } catch { threw = true; }
  check(threw, "a piece can't be laid over it");
  const after = knock(due.state, i(0, 0));
  check(!after.state.due && moves(after.state).length > 0 && after.state.untilKnock === knockEvery(after.state.sets), "made, the next hand is laid");
  check(knockEvery(1) === 1 && knockEvery(PACE[0][0] - 1) === 1 && knockEvery(PACE[0][0]) === 2 && knockEvery(500) === 2, `a knock every hand for the first ${PACE[0][0] - 1}, then every second`);
}

// ---------- the end ----------
{
  const board = Array.from({ length: N }, (_, y) => [...Array(N).keys()].map(x => ((x + y) % 2 ? "1" : "0")).join(""));
  board[0] = `.${board[0].slice(1)}`;
  const hand = [piece("0.0", 2), piece("4.0", 0), piece("4.1", 1)];
  const stuck = lay(game(board, hand, { due: false, untilKnock: 2 }), 0, 0, 0);
  check(stuck.over && stuck.state.over, "no room for any piece in hand, and no knock due: the game is over");
  const knocks = lay(game(board, [piece("0.0", 2), piece("0.0", 0), piece("0.0", 1)], { due: false, untilKnock: 1 }), 0, 0, 0);
  check(knocks.over && !knocks.state.due, "the knock comes only once a hand is finished: pieces left that fit nowhere end it first");
  const lastDue = game(board, [piece("0.0", 2), null, null], { due: false, untilKnock: 1 });
  const done = lay(lastDue, 0, 0, 0);
  check(done.due && !done.over, "a hand finished with the knock due isn't over, the knock may make room");
}

// ---------- a game saved before the knock was the table's ----------
{
  const old = { v: 1, seed: 5, n: 40, cells: table(["0000....", "1......."]), hand: [piece("0.0"), null, piece("1.0", 2)], knocks: 2, untilKnock: 1, sets: 7, laid: 19, felled: 30, score: 4200, over: false };
  const s = upgrade(old);
  check(s.v === 2 && !("knocks" in s) && !s.due && s.untilKnock === 1 && s.bell >= 0 && s.cells[s.bell] === -1 && s.score === 4200 && s.hand[2].piece === "1.0", "it keeps its table, its hand and its score; its stored knocks go, a knock comes after the hand in play, and the bell is hung");
  check(upgrade(s) === s && upgrade(null) === null, "a game of now is left as it is");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) { if (s.due) { s = knock(s, s.cells.findIndex(c => c >= 0)).state; continue; } const m = moves(s)[(k * 5) % moves(s).length]; s = lay(s, m.slot, m.x, m.y).state; }
  const again = JSON.parse(JSON.stringify(s));
  const step = g => (g.due ? knock(g, g.cells.findIndex(c => c >= 0)) : lay(g, moves(g)[0].slot, moves(g)[0].x, moves(g)[0].y));
  check(JSON.stringify(step(s)) === JSON.stringify(step(again)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  // the knock that fells most
  const most = s => chains(s.cells, s.bell).reduce((a, c) => (!a || c.best.fell > a.fell || (c.best.fell === a.fell && c.best.gain > a.gain) ? c.best : a), null).at;
  // the corner: every piece as near the top left as it goes
  const corner = s => moves(s)[0];
  // keeping what a piece joins falling whole, and room for the rest of the hand
  const careful = s => {
    let best = null, bv = -Infinity;
    for (const m of moves(s)) {
      const h = s.hand[m.slot], sq = cover(s.cells, h.piece, m.x, m.y), cells = s.cells.slice();
      for (const k of sq) cells[k] = h.colour;
      const b = longest(cells, sq[0]);
      let room = 0;
      for (const k of s.hand) if (k && k !== h && fitsAnywhere(cells, k.piece)) room++;
      const v = b.fell * 3 - (b.size - b.fell) * 4 + room * 25;
      if (v > bv) { bv = v; best = m; }
    }
    return best;
  };
  const play = (seed, choose) => {
    let s = newGame(seed);
    while (!s.over && s.laid < 1000) {
      if (s.due) { s = knock(s, most(s)).state; continue; }
      const m = choose(s);
      s = lay(s, m.slot, m.x, m.y).state;
    }
    return s.laid;
  };
  const corners = [], cares = [];
  for (let g = 0; g < 8; g++) { corners.push(play(100 + g, corner)); cares.push(play(100 + g, careful)); }
  check(median(corners) < 70, `laying every piece in the corner: over after about ${median(corners)} pieces`);
  check(median(cares) > 1.5 * median(corners) && Math.max(...cares) < 1000, `keeping lines that fall whole: about ${median(cares)} pieces, and still over in the end`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple: the deal, where pieces fit, how dominoes fall, knocks and the bell, the knock on the table's time, the end, old games, saving, whole games");
