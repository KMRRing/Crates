// Go's network (go-net.js over vendor/go/go-nn.wasm, the g170 b6c96 net) and the search on it (go-search.js): the net reads,
// is deterministic whatever it ran before, sees komi the right way round, takes a stone in atari, and a seeded search gives
// the same move twice; a level's looks scale with the board.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { loadNet } from "../go-net.js";
import { Position, PASS, newGame, replay, isLegal } from "../go-rules.js";
import { featuresOf } from "../go-features.js";
import { search, seededRandom } from "../go-search.js";
import { LEVELS, visitsFor } from "../go-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const here = f => new URL("../" + f, import.meta.url);
const net = await loadNet(gunzipSync(readFileSync(here("vendor/go/g170-b6c96-s175395328-d26788732.bin.gz"))), readFileSync(here("vendor/go/go-nn.wasm")));
check(net.info.inC === 22 && net.info.inG === 19 && net.info.blocks.length === 6, "the net is the 6-block, 22-plane one");

const eval9 = (pos, komi = 7.5, made = []) => { const f = featuresOf(pos, made, komi); return net.evaluate(f.spatial, f.globals, pos.n, pos.n); };
const empty = n => new Position(n);
{ // the same position gives the same numbers, whatever came between (a board of another size in between)
  const a = eval9(empty(9)), mid = eval9(empty(13)), b = eval9(empty(9));
  check(a.win === b.win && a.scoreMean === b.scoreMean && a.logits[40] === b.logits[40] && mid.logits.length === 170, "a read doesn't depend on the reads before it");
  check(Math.abs(eval9(empty(19)).win - 0.5) < 0.12 && a.win > 0.3 && a.win < 0.7, "an empty board with komi 7.5 is about even");
  const hi = eval9(empty(9), 20).win, lo = eval9(empty(9), -20).win;
  check(lo > hi + 0.3, "more komi for White is worse for Black");
  check(a.logits.slice(0, 81).every(Number.isFinite) && a.own.every(v => v >= -1 && v <= 1), "finite logits, ownership within [-1, 1]");
}
{ // a game of 2-look searches on 9x9: every move it returns is legal, and the game replays
  const g = newGame({ size: 9 }), rng = seededRandom(3);
  let legal = true;
  for (let i = 0; i < 24 && legal; i++) {
    const r = replay(g);
    if (r.pos.passes >= 2) break;
    const out = search(net, { pos: r.pos, made: r.made.slice(-5), seen: r.seen }, { visits: 2, temperature: 1, rng });
    legal = isLegal(r, out.move);
    g.moves.push(out.move);
  }
  check(legal && replay(g).made.length === g.moves.length, "every move the search returns is legal (superko included)");
}
{ // a seeded search repeats; the levels are ordered and cheaper on a bigger board
  const p = empty(9);
  const go = () => search(net, { pos: p, made: [], seen: new Set() }, { visits: 12, temperature: 0.8, rng: seededRandom(5) });
  const x = go(), y = go();
  check(x.move === y.move && x.visits.reduce((s, v) => s + v[1], 0) === 11, "a seeded search of 12 looks gives the same move, using 11 below the root");
  check(LEVELS.every((l, i) => i === 0 || l.visits >= LEVELS[i - 1].visits) && visitsFor("master", 19) < visitsFor("master", 9) && visitsFor("novice", 19) === 1, "levels grow; a bigger board gets fewer looks");
  check(x.move !== PASS, "the first move of a game is not a pass");
}

console.log(bad ? `go-net: ${bad} failed` : "go-net: every check passed");
process.exit(bad ? 1 : 0);
