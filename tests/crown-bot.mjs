// Draughts's computer player (crown-search.js): a position gives the same move for the same randomness (so the page's worker and
// the table's own search agree), a forced win is found at every level but the weaker levels miss it now and then, Hard
// finds a shot and never misses, the search sees a repetition coming, a single legal move costs nothing, and the coach's
// judgement says who is ahead. How strong each level is against the others is measured by tools/crown-bench.mjs (CI doesn't run it).
import { toArray } from "../crown-board.js";
import { think, judge, LEVELS, engineFor } from "../crown-search.js";
import { boardOf, moveName } from "../crown-course.js";
import { rules, ready, readyKey, seenOf } from "../crown-rules.js";
import { seeded, newRecord, botMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const pick = (set, pieces, side, level, seed) => moveName(set, think(set, boardOf(set, pieces), side, level, { rng: seeded(seed) }).move);

check(LEVELS.easy.nodes < LEVELS.medium.nodes && LEVELS.medium.nodes < LEVELS.hard.nodes && LEVELS.easy.blind > LEVELS.medium.blind && LEVELS.hard.blind === 0, "the levels grow in reach and shrink in blindness");
check(pick("english", "o@c3 x@d6", 0, "medium", 5) === pick("english", "o@c3 x@d6", 0, "medium", 5), "the same randomness, the same move");

// a forced win (the opposition): c3-d4 is the one move that wins
{
  const tally = lv => { let n = 0; for (let s = 1; s <= 24; s++) if (pick("english", "o@c3 x@d6", 0, lv, s) === "c3-d4") n++; return n; };
  const [e, m, h] = [tally("easy"), tally("medium"), tally("hard")];
  check(h === 24 && e < h && m >= e - 2, `a forced win: Hard finds it every time (${h}/24), Medium ${m}, Easy ${e}`);
}
// a shot (a sacrifice that wins more than it gives): Hard plays it, from the sampler's own finds
{
  const shots = [["x@f8 x@a7 x@e7 x@a5 o@e5 o@g5 x@d4 o@d2 o@g1", 1, "e7-f6"], ["x@c7 o@a5 x@e5 o@g5 x@f4 o@e3 x@g3 o@a1 o@g1", 0, "g1-h2"]];
  const got = shots.map(([p, side, ans]) => pick("english", p, side, "hard", 1) === ans);
  check(got.every(Boolean), `Hard finds a shot (${got.filter(Boolean).length}/${shots.length})`);
}
// a single legal move is made without a search
{
  const r = think("english", boardOf("english", "o@d4 x@e5 x@b8"), 0, "hard", { rng: seeded(1) });
  check(moveName("english", r.move) === "d4xf6" && r.nodes < 200, "a single legal move is played at once");
}
// a game's own history: the position seen twice is seen again before the third time
{
  const G = newRecord(rules, { seats: 2, options: { set: "english" }, seed: 3, now: 0 });
  const e = engineFor("english"), key = e.hashOf(toArray(G.state.board), 0)[0];
  check(seenOf(G.state).get(key) === 1, "the game's positions are counted for the search");
}
// the page's worker and the runner agree: what the worker keeps is what rules.bot hands back
{
  const G = newRecord(rules, { seats: 2, options: { set: "brazilian" }, seed: 9, now: 0 });
  const s = G.state, direct = botMove(rules, G, 0, "medium");
  ready.set(readyKey(s, "medium"), [1, 2, 3]);
  const kept = botMove(rules, G, 0, "medium");
  check(direct.path.length >= 2 && kept.path.join() === "1,2,3" && !ready.has(readyKey(s, "medium")), "a move the worker has found is used once, then the search takes over again");
}
// the coach: who is ahead, in the men's own terms
{
  const up = judge("english", boardOf("english", "o@c3 o@e3 o@g3 x@d6"), 0, { nodes: 8000 });
  const down = judge("english", boardOf("english", "o@c3 x@d6 x@f6 x@h6"), 0, { nodes: 8000 });
  check(up.score > 150 && down.score < -150, `the coach: Ink three to one is ahead (${up.score}), Ink one to three behind (${down.score})`);
  const even = judge("english", boardOf("english", "start"), 0, { nodes: 8000 });
  check(Math.abs(even.score) < 60, `the opening position is level (${even.score})`);
}
console.log(bad ? `crown-bot: ${bad} failed` : "crown-bot: every check passed");
process.exit(bad ? 1 : 0);
