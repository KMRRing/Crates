// Finds positions for Silo's course (not run by CI): plays games between Medium players and, at each position, asks the
// exact search what is there. Prints the candidates of a kind with the diagram and the move string, for a person to
// pick from and write the words for.
//   node tools/silo-puzzles.mjs win3|block|blockwin|under|endgame [--games 300] [--seed 1] [--max 12]
import { seeded, mix } from "../seats.js";
import { drop, outcome, legal, toText, replay, runsThrough, H, W } from "../silo-board.js";
import { chooseMove, newSolver } from "../silo-bot.js";

const kind = process.argv[2] || "win3";
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i < 0 ? d : Number(process.argv[i + 1]); };
const GAMES = arg("games", 300), SEED = arg("seed", 1), MAX = arg("max", 12), MAXN = arg("maxn", 99), MINN = arg("minn", 8);
const S = newSolver({ bits: 20, thinkBits: 16 }), T = newSolver({ bits: 22, thinkBits: 10 });
const seen = new Set();
let found = 0;

function classify(moves) {
  const facts = S.tactics(moves, 6), n = moves.length;
  const wins1 = facts.filter(f => f.win === 1).map(f => f.c);
  if (wins1.length) return null;
  const lose2 = facts.filter(f => f.lose === 2).map(f => f.c);
  const win3 = facts.filter(f => f.win === 3).map(f => f.c);
  const safe = facts.filter(f => !f.lose).map(f => f.c);
  if (kind === "win3" && win3.length >= 1 && win3.length <= 2 && !lose2.length) return { answer: win3 };
  // the opponent threatens to win at once: only a block holds
  if ((kind === "block" || kind === "blockwin") && lose2.length >= 2 && safe.length === 1) {
    const f = facts.find(x => x.c === safe[0]);
    const win = kind === "blockwin" && f.win === 3;
    if (kind === "block" && !f.win) return { answer: safe };
    if (win) return { answer: safe };
  }
  if (kind === "under" && lose2.length >= 1 && lose2.length <= 2 && safe.length >= 3 && n >= 8) return { answer: safe, lose: lose2 };
  if (kind === "endgame" && n >= 28 && n <= 34) {
    const sc = T.scores(moves, 3_000_000);
    if (!sc) return null;
    const best = sc.best, others = sc.scores.filter(x => x !== null).filter(x => x < sc.top);
    if (best.length === 1 && others.length >= 2 && sc.top > 0 && !facts.some(f => f.win)) return { answer: best, scores: sc.scores };
  }
  // a late position the mover wins by a threat on a row of its parity (the first mover's odd rows, the second's even)
  // while the other has none: the zugzwang the course's last lesson teaches
  if (kind === "parity" && n >= 30 && n <= 38) {
    const sc = T.scores(moves, 2_000_000);
    if (!sc || sc.top <= 0) return null;
    const mine = (n & 1) ? 2 : 1, theirs = 3 - mine;
    const cells = (who) => {
      const out = [];
      const { grid, height } = replay(moves);
      for (let c = 0; c < W; c++) for (let r = height[c] + 1; r < H; r++) {
        grid[c * H + r] = who;
        if (runsThrough(grid, c, r).length) out.push([c, r]);
        grid[c * H + r] = 0;
      }
      return out;
    };
    const m = cells(mine), t = cells(theirs);
    const good = (r) => (mine === 1 ? r % 2 === 0 : r % 2 === 1);   // zero-based row: row 3 is r = 2
    if (m.some(([c, r]) => good(r)) && t.length === 0 && sc.best.length <= 2) return { answer: sc.best, scores: sc.scores, cells: m };
  }
  return null;
}

for (let g = 0; g < GAMES && found < MAX; g++) {
  const rngs = [seeded(mix(SEED, g * 2)), seeded(mix(SEED, g * 2 + 1))];
  let moves = "";
  while (!outcome(moves).over && found < MAX) {
    const k = moves.length & 1;
    if (moves.length >= MINN && moves.length <= MAXN && !seen.has(moves)) {
      seen.add(moves);
      const r = classify(moves);
      if (r) {
        found++;
        console.log(`\n${kind} ${moves.length} discs, ${moves.length % 2 ? "second" : "first"} mover (${moves.length % 2 ? "o" : "x"}) to play; answer columns ${r.answer.map(c => c + 1)}${r.lose ? `; losing now: ${r.lose.map(c => c + 1)}` : ""}${r.scores ? `; scores ${r.scores.map(x => x ?? "-")}` : ""}\nmoves: "${moves}"\n${toText(moves)}`);
      }
    }
    moves = drop(moves, chooseMove(moves, "medium", rngs[k], { solver: S }));
  }
}
console.log(`\n${found} found`);
