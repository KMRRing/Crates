// The hex board in a saved run, a race and a co-op (5 November 2026): the board a run, a match and a shared board carry, and that
// the dealing phone's puzzle (the grid, the answer, the board's shape) is what every phone draws, through the database and back.
import { LEVELS as LADDER, kindOf, levelPuzzle, seedOf } from "../bridges-levels.js";
import { generate, layoutOf, count, moreOf } from "../bridges-engine.js";
import { playable, fixedOf, fromPuzzle, blankRun } from "../bridges-run.js";
import { matchOf, matchValid, nameOf, raceLevel } from "../bridges-race.js";
import coopOf, { shareRun, halves } from "../bridges-coop.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const hexLevels = LADDER.map((L, i) => (L.shape === "hex" ? i : -1)).filter(i => i >= 0);
const lv = LADDER.findIndex(L => L.shape === "hex" && L.twist === "straits" && L.size === 9);
const pz = levelPuzzle(lv, seedOf(lv)), k = kindOf(lv);

{
  const run = blankRun(fromPuzzle("level", seedOf(lv), k, pz, { lv }));
  check(run.shape === "hex" && playable(run) && run.straits.length === 3 * (run.size - 1), "a hex level's run says it is hex and is a puzzle in play (its straits are three families long)");
  check(!playable({ ...run, straits: run.straits.slice(0, 2 * (run.size - 1)) }) && !playable({ ...run, shape: "tri" }), "…a straits string of the square board's length, or an unknown board, is not");
  const plain = generate(3, 9, "easy");
  const sq = fromPuzzle("random", 3, { size: 9, level: "easy", twist: "none" }, plain);
  check(playable(blankRun(sq)) && !("shape" in sq), "a square run carries no shape, as before");
  check(fixedOf(run).shape === "hex" && blankRun(fixedOf(run)).shape === "hex", "the fixed part of a run and a blank run keep the board");
}
{
  // a race
  const m = roundTrip(JSON.parse(JSON.stringify(matchOf(seedOf(lv), lv, pz))));
  check(matchValid(m) && m.shape === "hex" && nameOf(m).includes("hex 9") && count(layoutOf(m.size, m.grid, m.kinds || "", m.realms || "", m.hills || "", m.roads || "", moreOf(m)), 2) === 1, "a hex match survives the database and is checked, with its board, before it is played");
  check(!matchValid({ ...m, shape: undefined }), "…and the same match with its board taken away is refused (its answer no longer fits the links)");
  const seen = new Set();
  for (let s = 1; s <= 900; s++) for (const d of ["easy", "medium", "hard"]) seen.add(LADDER[raceLevel(d, s)].shape === "hex");
  check(seen.has(true) && seen.has(false), "a race is dealt hex levels as well as square ones");
  let okAll = true;
  for (const i of hexLevels.filter((_, n) => n % 9 === 0)) { const kk = kindOf(i), p = generate(seedOf(i), kk.size, kk.level, kk.twist, kk.shape); if (!p || !matchValid(roundTrip(JSON.parse(JSON.stringify(matchOf(seedOf(i), i, p)))))) okAll = false; }
  check(okAll, "a sample of the hex levels each make a match a phone accepts");
}
{
  // a co-op: the host's run becomes the shared board and back
  const run = { ...blankRun(fixedOf(fromPuzzle("level", seedOf(lv), k, pz, { lv }))), ms: 5000, hints: 0 };
  const board = shareRun(run), back = coopOf.run(roundTrip(JSON.parse(JSON.stringify(board))));
  check(board && board.fixed.shape === "hex" && coopOf.valid(roundTrip(board)) && back.shape === "hex" && back.grid === run.grid && back.sol === run.sol, "a hex run becomes a shared board that carries its board, and comes back as the same run");
  const mask = halves(back);
  const cells = [...back.grid].map((ch, i) => (ch === "." ? null : mask[i]));
  const h = cells.filter(c => c === "h").length, g = cells.filter(c => c === "g").length;
  check(Math.abs(h - g) <= 1 && h + g === [...back.grid].filter(ch => ch !== ".").length && same(halves(back), mask), "the split numbers are dealt half and half on a hex board, the same every time");
}

console.log(bad ? `\n${bad} FAILED` : "\nbridges hex together: runs, races and co-op carry the hex board");
process.exit(bad ? 1 : 0);
