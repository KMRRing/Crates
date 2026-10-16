// Topple's rules (topple-engine.js): the deal from a seed, the pieces, where a piece fits, the chain a knock sets off
// (along sides in its colour, round corners, down forks, in steps, each from the one that knocked it), a knock's
// clearing and its points, a piece laid and a new hand with its knock, the knocks coming more rarely, the end (no room
// and no knock), a game saved and opened again, and whole games played out to their end.
import { N, HAND, MAX_KNOCKS, PIECES, PACE, knockEvery, newGame, cover, fitsAnywhere, chain, chains, worth, lay, knock, moves, filled } from "../topple-engine.js";

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
const game = (rows, hand = [piece("0.0"), piece("0.0"), piece("0.0")], extra = {}) => Object.assign(newGame(1), { cells: table(rows), hand, knocks: 1, untilKnock: 9 }, extra);

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), hands = new Set([...Array(10).keys()].map(k => JSON.stringify(newGame(k).hand)));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.cells.every(c => c === -1) && a.hand.length === HAND && a.hand.every(h => PIECES[h.piece] && h.colour >= 0 && h.colour < 3) && a.knocks === 1 && a.sets === 1 && !a.over, "an empty table, three pieces in three colours, a knock");
  const names = Object.keys(PIECES);
  check(names.length > 30 && names.every(k => PIECES[k].cells.length <= 5 && Math.min(...PIECES[k].cells.map(c => c[0])) === 0 && Math.min(...PIECES[k].cells.map(c => c[1])) === 0), `${names.length} pieces of up to five dominoes, each measured from its top left`);
}

// ---------- where a piece fits ----------
{
  const cells = table(["0......."]);
  check(cover(cells, "0.0", 1, 0)?.join() === "1" && cover(cells, "0.0", 0, 0) === null && cover(cells, "4.0", 5, 2) === null && cover(cells, "4.0", 4, 2)?.length === 4, "a piece goes on empty squares, not on a domino or off the table");
  check(fitsAnywhere(cells, "9.0") && !fitsAnywhere(table(Array(N).fill("0.1.0.1.")), "1.0"), "a piece fits somewhere, or nowhere");
}

// ---------- a chain ----------
{
  // a run of four turning a corner and forking: 0 at the top left, down, then right with a branch up
  const cells = table(["0.......", "0..0....", "0000....", "...0....", "1......."]);
  const c = chain(cells, i(0, 0));
  check(c.length === 8 && c[0][0] === i(0, 0) && c[0][1] === 0 && c[0][2] === -1, "a knock fells every domino of its colour joined along a side, the one knocked first");
  const steps = Object.fromEntries(c.map(([sq, step]) => [sq, step]));
  check(steps[i(0, 2)] === 2 && steps[i(3, 2)] === 5 && steps[i(3, 1)] === 6 && steps[i(3, 3)] === 6, "it falls in steps along the run, round the corner, and down both ways at the fork at once");
  check(c.every(([sq, step, by]) => by < 0 || (steps[by] === step - 1 && Math.abs((sq % N) - (by % N)) + Math.abs(Math.floor(sq / N) - Math.floor(by / N)) === 1)), "each falls from a neighbour a step before it");
  check(!c.some(([sq]) => sq === i(0, 4)) && chain(table(["0.", ".0"]), 0).length === 1, "another colour stops it, and so does a corner");
  check(chain(cells, i(5, 5)).length === 0, "an empty square sets nothing off");
  check(chains(cells).map(k => k.length).join() === "8,1", "the chains standing, longest first");
}

// ---------- a knock ----------
{
  const s = game(["000.....", "1......."]), r = knock(s, i(1, 0));
  check(r.fell.length === 3 && r.gain === worth(3) && r.state.score === 90 && r.state.cells.slice(0, 3).every(c => c === -1) && r.state.cells[i(0, 1)] === 1, "the chain falls and clears, ten times the square of how many fell: 90");
  check(r.state.knocks === 0 && r.state.felled === 3 && s.knocks === 1 && s.cells[0] === 0, "a knock used; the game knocked from is left as it was");
  let threw = 0;
  try { knock(r.state, i(0, 1)); } catch { threw++; }
  try { knock(s, i(5, 5)); } catch { threw++; }
  check(threw === 2, "no knock without one in store, nor on an empty square");
  check(worth(1) === 10 && worth(10) === 1000 && worth(20) === 4000, "one big chain beats several small ones");
}

// ---------- a piece laid ----------
{
  const s = game([], [piece("1.0", 2), piece("0.0", 1), piece("2.1", 0)]);
  const r = lay(s, 0, 3, 3);
  check(r.laid.join() === `${i(3, 3)},${i(4, 3)}` && r.state.cells[i(3, 3)] === 2 && r.state.hand[0] === null && r.state.laid === 1 && !r.dealt, "a piece stands its dominoes in its colour; the others wait");
  let threw = false;
  try { lay(r.state, 1, 3, 3); } catch { threw = true; }
  check(threw && s.cells[i(3, 3)] === -1, "not where a domino stands; the game laid from left as it was");
  const all = lay(lay(r.state, 1, 0, 0).state, 2, 7, 0);
  check(all.dealt && all.state.hand.every(Boolean) && all.state.sets === 2, "the third laid, three more are dealt");
  const due = lay(lay(lay(game([], undefined, { untilKnock: 1 }), 0, 0, 0).state, 1, 2, 0).state, 2, 4, 0);
  check(due.knocked && due.state.knocks === 2 && due.state.untilKnock === knockEvery(due.state.sets), "a knock comes with the hand it's due with");
  const full = lay(lay(lay(game([], undefined, { untilKnock: 1, knocks: MAX_KNOCKS }), 0, 0, 0).state, 1, 2, 0).state, 2, 4, 0);
  check(!full.knocked && full.state.knocks === MAX_KNOCKS, `no more than ${MAX_KNOCKS} are kept`);
  check(knockEvery(1) === 1 && knockEvery(20) === 2 && knockEvery(100) === 3 && PACE.every(([, every]) => every >= 1), "a knock every hand at first, then every second, then every third");
}

// ---------- the end ----------
{
  const board = Array.from({ length: N }, (_, y) => [...Array(N).keys()].map(x => ((x + y) % 2 ? "1" : "0")).join(""));
  board[0] = `.${board[0].slice(1)}`;
  const hand = [piece("0.0", 2), piece("4.0", 0), piece("4.1", 1)];
  const stuck = lay(game(board, hand, { knocks: 0 }), 0, 0, 0);
  check(stuck.over && stuck.state.over, "no room for any piece in hand and no knock left: the game is over");
  const knocks = lay(game(board, hand, { knocks: 1 }), 0, 0, 0);
  check(!knocks.over, "with a knock in store it isn't, the knock may make room");
  check(knock(knocks.state, 0).over, "and when the knock is spent and there's still no room, it is");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 7; k++) { const m = moves(s)[(k * 5) % moves(s).length]; s = lay(s, m.slot, m.x, m.y).state; }
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[0];
  check(JSON.stringify(lay(s, m.slot, m.x, m.y)) === JSON.stringify(lay(again, m.slot, m.x, m.y)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  // the chain a piece would join, less the other colours it would touch
  const join = (cells, laid, colour) => {
    let others = 0;
    for (const sq of laid) { const x = sq % N, y = (sq - x) / N; for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) if (nx >= 0 && ny >= 0 && nx < N && ny < N && cells[ny * N + nx] >= 0 && cells[ny * N + nx] !== colour) others++; }
    return 2 * chain(cells, laid[0]).length - others;
  };
  const random = [], patient = [];
  for (let g = 0; g < 8; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.laid < 1000) {
      const all = moves(s);
      if (s.knocks > 0 && (!all.length || rnd() < 0.3)) { const on = s.cells.flatMap((c, k) => (c >= 0 ? [k] : [])); if (on.length) { s = knock(s, on[Math.floor(rnd() * on.length)]).state; continue; } }
      const m = all[Math.floor(rnd() * all.length)];
      s = lay(s, m.slot, m.x, m.y).state;
    }
    random.push(s.laid);
    // grows chains of one colour, and knocks the longest when the table is filling, the chain is long, or it must
    let t = newGame(100 + g);
    while (!t.over && t.laid < 1000) {
      const top = chains(t.cells)[0], fits = t.hand.some(h => h && fitsAnywhere(t.cells, h.piece));
      if (t.knocks > 0 && top && (!fits || filled(t) > 40 || top.length >= 18 || (t.knocks === MAX_KNOCKS && t.hand.filter(Boolean).length === 1))) { t = knock(t, top.at).state; continue; }
      let best = null, bv = -Infinity;
      for (const m of moves(t)) { const o = lay(t, m.slot, m.x, m.y), v = join(o.state.cells, o.laid, t.hand[m.slot].colour) - (o.over ? 1e6 : 0); if (v > bv) { bv = v; best = o; } }
      t = best.state;
    }
    patient.push(t.laid);
  }
  check(median(random) < 60, `laying and knocking anywhere: over after about ${median(random)} pieces`);
  check(median(patient) > 1.5 * median(random) && Math.max(...patient) < 1000, `building chains and knocking them long: about ${median(patient)} pieces, and the knocks coming more rarely still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple: the deal, where pieces fit, chains, knocks, laying, the knocks' pace, the end, saving, whole games");
