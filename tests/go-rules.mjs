// Go's rules (go-rules.js): captures, no suicide, simple ko and positional superko, handicap points, Chinese area scoring
// with dead stones, a game replayed from its moves, and the point names.
import { Position, BLACK, WHITE, EMPTY, PASS, newGame, replay, isLegal, isOver, handicapPoints, areaScore, result, ptName, groupAt } from "../go-rules.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** A position from rows of text: x black, o white, . empty; `toMove` is "x" or "o". */
function board(rows, toMove = "x") {
  const n = rows.length, p = new Position(n);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "x") p.b[y * n + x] = BLACK; if (ch === "o") p.b[y * n + x] = WHITE; }));
  p.toMove = toMove === "x" ? BLACK : WHITE;
  return p;
}
const at = (n, x, y) => y * n + x;

{ // liberties, a capture
  const p = board(["x.o..", "o.x..", ".....", ".....", "....."]);
  check(p.liberties(at(5, 0, 0)) === 1 && p.liberties(at(5, 2, 0)) === 2 && p.liberties(at(5, 0, 1)) === 2, "liberties count the empty points a group touches");
  const c = board(["xo...", ".....", ".....", ".....", "....."], "o");
  check(c.play(at(5, 0, 1)) === 1 && c.b[0] === EMPTY && c.caps[WHITE] === 1 && c.toMove === BLACK, "a stone with no liberty is taken off and counted");
}
{ // suicide is refused, unless it takes
  const p = board([".x...", "x.x..", ".x...", ".....", "....."], "o");
  check(!p.playable(at(5, 1, 1)), "a move into a point with no liberty and no capture is refused");
  check(p.playable(at(5, 4, 4)), "a point with an empty neighbour is playable");
  const r = board(["ox...", "x.o..", "..o..", ".....", "....."], "x");
  check(r.playable(at(5, 1, 1)), "the last liberty may be filled when it takes");
  const s = board(["oxo..", ".....", ".....", ".....", "....."], "x");
  check(s.playable(at(5, 1, 1)) === true && s.play(at(5, 1, 1)) === 0, "a move beside enemy stones that is not suicide is allowed");
}
{ // a whole group taken at once
  const p = board([".xx..", "xoo..", ".xx..", ".....", "....."], "x");
  check(p.playable(at(5, 3, 1)) && p.play(at(5, 3, 1)) === 2, "a group of two is taken together");
}
{ // simple ko: the recapture is forbidden for one move
  const n = 5;
  const p = board([".xo..", "xo.o.", ".xo..", ".....", "....."], "x");
  check(p.play(at(n, 2, 1)) === 1, "black takes the ko");
  check(p.ko === at(n, 1, 1) && !p.playable(at(n, 1, 1)), "white may not retake at once");
  p.play(at(n, 4, 4));
  check(p.ko === -1, "the ban lasts one move");
}
{ // positional superko: a move making a position in `seen` is refused and leaves the board as it was
  const n = 5;
  const p = board([".....", ".....", ".....", ".....", "....."], "x");
  const would = p.copy(); would.play(at(n, 2, 2));
  const seen = new Set([would.key]);
  const before = p.key;
  check(p.play(at(n, 2, 2), seen) === -1 && p.key === before && p.b[at(n, 2, 2)] === EMPTY && p.toMove === BLACK, "a move bringing back an earlier position is refused, the board unchanged");
  check(p.play(at(n, 1, 1), seen) === 0 && p.b[at(n, 1, 1)] === BLACK, "any other move goes through");
  const x = board([".....", ".....", "..x..", ".....", "....."], "x"), y = board([".....", ".....", "..x..", ".....", "....."], "o");
  check(x.key === y.key, "a position's key is its stones, not whose turn it is");
}
{ // handicap: points, komi, white moves first
  check(handicapPoints(19, 4).length === 4 && handicapPoints(19, 9).length === 9 && handicapPoints(19, 1).length === 0, "handicap stones: 2 to 9 on the star points");
  check(new Set(handicapPoints(13, 9)).size === 9 && new Set(handicapPoints(9, 5)).size === 5, "no two handicap stones on one point");
  const g = newGame({ size: 19, handicap: 2 });
  const r = replay(g);
  check(r.pos.toMove === WHITE && r.pos.b.filter(v => v === BLACK).length === 2 && g.komi === 0.5, "with a handicap White moves first, komi is a half");
  check(newGame({ size: 9 }).komi === 7.5 && replay(newGame({ size: 9 })).pos.toMove === BLACK, "an even game: Black first, komi 7.5");
}
{ // a game replayed, passes, the end
  const g = newGame({ size: 9 });
  g.moves.push(at(9, 4, 4), at(9, 2, 2), PASS, PASS);
  const r = replay(g);
  check(r.made.length === 4 && r.made[0].c === BLACK && r.made[1].c === WHITE && r.pos.passes === 2 && isOver(g, r), "two passes in a row end the game");
  g.moves.pop();
  check(!isOver(g) && isLegal(replay(g), at(9, 5, 5)) && !isLegal(replay(g), at(9, 4, 4)), "a point already played is not legal");
}
{ // area scoring with dead stones
  const rows = ["xxxxo....", "xxxxo....", "xxxxo....", "xxxxo....", "xxxxo....", "xxxxo....", "xxxxo....", "xxxxo....", "xxxxo...."];
  const p = board(rows);
  const s = areaScore(p);
  check(s.black === 36 && s.white === 9 * 5, "stones and the empty points only one side touches are each side's");
  const dead = new Set([at(9, 4, 4)]);
  const s2 = areaScore(p, dead);
  check(s2.white === 8 && s2.black === 36, "a dead stone comes off, and its point, touching both sides, is a gap that counts for neither (the white side loses the region joined to it)");
  const game = newGame({ size: 9 });
  check(result(game, p).text === "White wins by 16.5", "komi goes to White (36 against 45 + 7.5)");
  const close = result(game, board(["xxxx.oooo", "xxxx.oooo", "xxxx.oooo", "xxxx.oooo", "xxxx.oooo", "xxxx.oooo", "xxxx.oooo", "xxxx.oooo", "xxxx.oooo"]));
  check(close.winner === "w" && close.margin === 7.5, "an even split goes to White by the komi");
  const res = result({ ...game, resigned: "w" }, p);
  check(res.winner === "b" && /resignation/.test(res.text), "a resignation is a win for the other side");
  const contested = board([".x.o.", ".....", ".....", ".....", "....."]);
  check(areaScore(contested).owner[at(5, 0, 1)] === EMPTY, "an empty region touching both colours counts for neither");
}
{ // names and groups
  check(ptName(19, at(19, 3, 3)) === "D16" && ptName(19, at(19, 8, 10)) === "J9" && ptName(9, PASS) === "Pass", "points are named column then row from the bottom, with no I");
  const p = board(["xx...", ".x...", "o....", ".....", "....."]);
  check(groupAt(p, at(5, 1, 1)).length === 3 && groupAt(p, at(5, 3, 3)).length === 0, "a group of stones, or none on an empty point");
}

console.log(bad ? `go-rules: ${bad} failed` : "go-rules: every check passed");
process.exit(bad ? 1 : 0);
