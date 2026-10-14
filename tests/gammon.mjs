// Gammon (gammon-board.js, gammon-rules.js, gammon-bot.js) on seats.js: the board (the start, pips, moves blocked by a
// made point, a blot hit, entering from the bar first, bearing off exactly, from the highest point with a bigger die,
// not with a checker outside); the plays of a roll (both dice when they can be, the larger when only one, four of a
// double, each position once); a game won single, gammon or backgammon; the match (the opening roll, a play made, an
// illegal one refused, a turn with no move passed, the next game, the match's end); the cube (doubling, taking,
// dropping, the Crawford game); the state through the database; the computer's plays always legal, Hard beating Easy.
import { start, pips, singles, apply, plays, kindOf, allHome } from "../gammon-board.js";
import { rules, mayDouble, SHOW_MS, OVER_MS } from "../gammon-rules.js";
import { judge, botTurn, contact } from "../gammon-bot.js";
import { newRecord, applyMove, applyWake, botMove } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const empty = () => Array(26).fill(0);
const with_ = pairs => { const p = empty(); for (const [i, n] of pairs) p[i] = n; return p; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- the board ----------
check(start().reduce((a, b) => a + b, 0) === 15 && pips(start()) === 167, "the start: fifteen checkers, 167 pips");
{
  const me = with_([[13, 1], [8, 1], [6, 13]]), op = with_([[25 - 10, 2], [25 - 5, 1]]);  // their made point on my 10, a blot on my 5
  const s3 = singles(me, op, 3).map(m => m.join(">"));
  check(!s3.includes("13>10") && s3.includes("8>5"), "a made point blocks; a blot doesn't");
  const [m2, o2] = apply(me, op, [8, 5]);
  check(m2[5] === 1 && o2[20] === 0 && o2[25] === 1, "landing on a blot hits it: to the bar");
}
{
  const me = with_([[25, 1], [6, 14]]), op = with_([[25 - 22, 2]]);  // on the bar; their point on my 22 (25 − 3 = 22)
  check(same(singles(me, op, 3), []) && same(singles(me, op, 4), [[25, 21]]), "from the bar first: blocked on a made point, else in");
  check(plays(me, op, [3, 3])[0].moves.length === 0, "a double that can't enter: no move at all");
}
{
  const me = with_([[6, 1], [3, 2], [0, 12]]), op = with_([[24, 2]]);
  check(singles(me, op, 3).some(m => m[0] === 3 && m[1] === 0) && !singles(me, op, 5).some(m => m[0] === 3 && m[1] === 0), "bearing off exactly; not from a lower point while a higher one is held");
  const me2 = with_([[4, 1], [2, 1], [0, 13]]);
  check(singles(me2, op, 6).some(m => m[0] === 4 && m[1] === 0) && !singles(me2, op, 6).some(m => m[0] === 2 && m[1] === 0), "a bigger die bears off from the highest point");
  check(!allHome(with_([[7, 1], [6, 14]])) && !singles(with_([[7, 1], [3, 14]]), op, 3).some(m => m[1] === 0), "no bearing off with a checker outside home");
}

// ---------- the plays of a roll ----------
{
  const legal = plays(start(), start(), [3, 1]);
  check(legal.every(p => p.moves.length === 2) && legal.some(p => same(p.me, with_([[24, 2], [13, 5], [8, 2], [6, 4], [5, 2]]))), "3-1 at the start: both dice, making the 5 point among the plays");
  const ids = legal.filter(p => p.unique).map(p => p.me.join(",") + "|" + p.op.join(","));
  check(new Set(ids).size === ids.length, "each position once among the unique plays");
  check(plays(start(), start(), [4, 4]).every(p => p.moves.length === 4), "a double: four moves");
  // only one die can be played: the larger where it can be
  const me = with_([[24, 1], [6, 14]]), op = with_([[25 - 18, 2], [25 - 19, 2], [25 - 20, 2], [25 - 21, 2], [25 - 22, 2], [25 - 23, 2]]);
  const one = plays(me, op, [5, 6]);
  check(one.every(p => p.moves.length === 1), "only one die can be used when the other is blocked after it");
}
check(kindOf(with_([[0, 15]]), with_([[0, 3], [6, 12]])) === 1 && kindOf(with_([[0, 15]]), with_([[6, 15]])) === 2 && kindOf(with_([[0, 15]]), with_([[20, 1], [6, 14]])) === 3,
  "a single game, a gammon (none off), a backgammon (one still in the winner's home)");

// ---------- a match ----------
const T = 1_000_000;
const move = (G, seat, m, now = T) => { const r = applyMove(rules, G, seat, m, now); if (r.error) throw new Error(r.error); return r.G; };
const wake = (G, now) => applyWake(rules, G, now) || G;
{
  let G = newRecord(rules, { seats: 2, options: { match: 3, cube: true }, seed: 5, now: T });
  const s = G.state;
  check(s.step === "move" && s.turn === (s.opening[0] > s.opening[1] ? 0 : 1) && same([...s.dice].sort(), [...s.opening].sort()), "the opening roll: the higher die moves first, with both");
  check(applyMove(rules, G, s.turn, { t: "play", moves: [[13, 2]] }).error, "an illegal play is refused");
  const legal = plays(s.pos[s.turn], s.pos[1 - s.turn], s.dice);
  G = move(G, s.turn, { t: "play", moves: legal[0].moves.map(m => [m[0], m[1]]) });
  check(G.state.turn === 1 - s.turn && G.state.last.moves.length === 2 && (G.state.step === "roll" || G.state.step === "move"), "a play made: the other side's turn");
  check(G.state.step === "roll" && mayDouble(G.state, G.state.turn), "with the cube on, the side to roll may double first");
  const t = G.state.turn;
  G = move(G, t, { t: "double" });
  check(G.state.step === "take" && rules.toMove(G.state) === 1 - t, "doubled: the other side takes or drops");
  G = move(G, 1 - t, { t: "take" });
  check(G.state.cube === 2 && G.state.owner === 1 - t && G.state.step === "move" && G.state.turn === t, "taken: the cube on 2, theirs, and the doubler rolls");
  const st = rules.restore(roundTrip(structuredClone(G.state)));
  check(st.pos[0].length === 26 && st.dice.length === 2 && st.last.moves.length === 2, "the state comes back whole from the database");
}
{
  // a drop ends the game at the cube's value; the Crawford game has no cube
  let G = newRecord(rules, { seats: 2, options: { match: 3, cube: true }, seed: 9, now: T });
  G = { ...G, state: { ...G.state, step: "roll", dice: [], score: [1, 0] } };
  const t = G.state.turn;
  G = move(G, t, { t: "double" });
  G = move(G, 1 - t, { t: "drop" });
  check(G.state.result.points === 1 && G.state.score[t] === (t === 0 ? 2 : 1) && G.state.step === "gameover", "dropped: the doubler wins the cube's value");
  if (t === 0) {
    G = wake(G, T + OVER_MS);
    check(G.state.crawford && !mayDouble(G.state, 0) && !mayDouble(G.state, 1), "the Crawford game, after someone comes within a point: no cube");
  }
}
{
  // a turn with no move: shown, then passed
  let G = newRecord(rules, { seats: 2, options: { match: 1 }, seed: 1, now: T });
  const me = with_([[25, 2], [6, 13]]), op = with_([[1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [0, 3]]);
  const t = G.state.turn;
  G = { ...G, state: { ...G.state, step: "move", pos: t === 0 ? [me, op] : [op, me], dice: [3, 5] } };
  G = { ...G, state: { ...rules.restore(roundTrip(G.state)), step: "roll", dice: [] } };
  G = move(G, t, { t: "roll" });
  check(G.state.step === "blocked" && rules.toMove(G.state) === null, "a closed board: whatever the roll, no move from the bar");
  G = wake(G, T + SHOW_MS);
  check(G.state.turn === 1 - t && G.state.last.moves.length === 0 && /can't move/.test(G.say.text), "shown, then the turn passes");
}
{
  // whole games, the computer on both sides: always legal, always ending; Hard against Easy
  let wins = 0, games = 0, ok = true;
  for (let seed = 1; seed <= 10; seed++) {
    let G = newRecord(rules, { seats: 2, options: { match: 1 }, seed, now: T });
    const hardSeat = seed % 2;
    let i = 0;
    for (; i < 2000 && G.state.step !== "over"; i++) {
      const at = rules.wakeAt(G.state);
      if (at != null) { G = wake(G, at); continue; }
      const seat = rules.toMove(G.state);
      const r = applyMove(rules, G, seat, botMove(rules, G, seat, seat === hardSeat ? "hard" : "easy"), T + i);
      if (r.error) { ok = false; console.log(r.error); break; }
      G = r.G;
    }
    if (G.state.step !== "over") { ok = false; break; }
    games++;
    if (G.state.winners[0] === hardSeat) wins++;
  }
  check(ok, "the computer's plays are always legal, and its games end");
  check(wins >= 7, `Hard beats Easy (${wins} of ${games})`);
}
check(judge(with_([[0, 15]]), start()) === 1 && judge(start(), with_([[0, 15]])) === 0 && !contact(with_([[3, 15]]), with_([[3, 15]])) && contact(start(), start()), "the judgement's ends, and contact");

console.log(bad ? `gammon: ${bad} failed` : "gammon: every check passed");
process.exit(bad ? 1 : 0);
