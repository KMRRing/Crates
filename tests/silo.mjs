// Silo (silo-board.js, silo-rules.js, silo-solver.js, silo-bot.js) on seats.js: the board (replay, a disc resting on the
// one below, four across, up, along both diagonals, five counting, a full board a draw, a position drawn as text); the
// rules (who moves, what is refused, the tally and who starts the next game); the state through the database; the
// solver against a plain negamax on positions near the end, and on the forced wins it is asked to find; the computer's
// moves always legal, Hard taking a win and stopping a loss, Easy missing more than Medium. Strength over whole games
// is measured by tools/silo-bench.mjs, which takes minutes.
import { W, H, N, replay, drop, legal, outcome, toText, fromText, runsThrough } from "../silo-board.js";
import { rules, STARTS } from "../silo-rules.js";
import { createSolver, MAX_SCORE } from "../silo-solver.js";
import { chooseMove, hardMove, newSolver, SIGHT } from "../silo-bot.js";
import { newRecord, applyMove, botMove, seeded, mix } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const T = 1_000_000;

// ---------- the board ----------
{
  const { grid, height, last } = replay("3302");
  check(grid[3 * H + 0] === 1 && grid[3 * H + 1] === 2 && grid[0 * H + 0] === 1 && grid[2 * H + 0] === 2 && grid[1 * H + 0] === 0 && height[3] === 2 && same(last, [2, 0]),
    "a disc rests on the bottom or on the disc below; the first mover's is 1");
  check(drop("", 3) === "3" && drop("333333", 3) === null && drop("", 7) === null && drop("", -1) === null && drop("", 1.5) === null, "a full column or a column that isn't one: no drop");
  check(same(legal("333333"), [2, 4, 1, 5, 0, 6]) && same(legal(""), [3, 2, 4, 1, 5, 0, 6]), "the columns with room, middle out");
  let threw = false;
  try { replay("7"); } catch { threw = true; }
  check(threw, "a move string with a column that isn't one doesn't replay");
}
{
  const o = outcome;
  check(o("0615263").winner === 1 && same(o("0615263").line, [[0, 0], [1, 0], [2, 0], [3, 0]]), "four across");
  check(o("3031323").winner === 1 && same(o("3031323").line, [[3, 0], [3, 1], [3, 2], [3, 3]]), "four up and down");
  check(o("01122633233").winner === 1 && o("01122633233").line.length === 4, "four on a diagonal");
  check(o("65544033433").winner === 1 && o("65544033433").line.length === 4, "four on the other diagonal");
  check(o("0615263").over && !o("061526").over && !o("").over, "the game ends with the four, not before");
  check(o("01020354").winner === 2, "the second mover's four is the second's");
  check(o("061536452").over && o("061536452").line.length === 5, "a line of five counts, and all of it is lit");
}
{
  const draw = "065432106543210654321006543206543211654321";
  check(draw.length === N, "the drawn game is a full board");
  const o = outcome(draw);
  check(o.over && o.draw && o.winner === 0 && o.line.length === 0, "a full board with no four is a draw");
  check(!outcome(draw.slice(0, -1)).over, "and the board one short is still being played");
}
{
  // a board drawn as text and back
  const text = toText("0615263"), rows = text.split("\n");
  check(rows.length === H && rows.every(r => r.length === W) && rows[H - 1] === "xxxx.oo", "a position as rows of text, the bottom row last");
  const back = fromText(text);
  check(back !== null && toText(back) === text, "text read back gives a position of the same board");
  check(fromText("x......\n.......\n.......\n.......\n.......\n.......") === null, "one disc of the first mover alone is a position, ...");
  check(fromText(".......\n.......\n.......\n.......\n.......\nx.x.x.x") === null, "... four of one side and none of the other is not");
  check(fromText("x......\n.......\n.......\n.......\n.......\n.o.....") === null, "a disc in the air is no position");
  check(runsThrough(replay("0615263").grid, 3, 0).length === 4, "the run through a disc");
}

// ---------- the rules ----------
const move = (G, seat, c) => { const r = applyMove(rules, G, seat, { c }, T); if (r.error) throw new Error(r.error); return r.G; };
{
  let G = newRecord(rules, { seats: 2, options: {}, seed: 3, now: T });
  check(G.state.moves === "" && G.state.first === 0 && same(G.state.score, [0, 0, 0]) && G.state.game === 1 && rules.toMove(G.state) === 0, "a new game: the first seat moves, a tally of nothing");
  check(applyMove(rules, G, 1, { c: 3 }, T).error, "the other seat can't move out of turn");
  check(applyMove(rules, G, 0, { c: 9 }, T).error && applyMove(rules, G, 0, {}, T).error, "a column that isn't one is refused");
  G = move(G, 0, 3);
  check(rules.toMove(G.state) === 1 && G.state.moves === "3", "a disc dropped: the other seat's turn");
  for (let i = 0; i < 5; i++) G = move(G, i % 2 ? 0 : 1, 3);
  check(G.state.moves === "333333" && applyMove(rules, G, 0, { c: 3 }, T).error === "That column is full", "a full column is refused");
}
{
  // a win: the tally, the lit four, the game over, then the next game with the other seat first and the tally kept
  let G = newRecord(rules, { seats: 2, options: {}, seed: 4, now: T });
  for (const [i, c] of [...("0615263")].entries()) G = move(G, i % 2, Number(c));
  const s = G.state;
  check(s.winner === 0 && same(s.score, [1, 0, 0]) && s.line.length === 4 && rules.over(s) && rules.toMove(s) === null, "a four: the seat's win counted, the four kept, nobody to move");
  check(applyMove(rules, G, 1, { c: 0 }, T).error, "no move after the game is over");
  const next = newRecord(rules, { seats: 2, options: {}, seed: 5, now: T, seq: 2, prev: G });
  check(next.state.first === 1 && same(next.state.score, [1, 0, 0]) && next.state.game === 2 && rules.toMove(next.state) === 1, "the next game: the other seat first, the tally carried");
  const fresh = newRecord(rules, { seats: 2, options: { fresh: true }, seed: 5, now: T, seq: 2, prev: G });
  check(fresh.state.first === 0 && same(fresh.state.score, [0, 0, 0]) && fresh.state.game === 1, "a fresh tally starts over");
  for (const [k, want] of [["you", 0], ["other", 1], ["alternate", 1]]) {
    const g = newRecord(rules, { seats: 2, options: { start: k }, seed: 5, now: T, seq: 2, prev: G });
    check(g.state.first === want, `who starts: ${k}`);
  }
  check(STARTS.length === 3, "three ways to say who starts");
}
{
  // a draw
  const draw = "065432106543210654321006543206543211654321";
  let G = newRecord(rules, { seats: 2, options: {}, seed: 6, now: T });
  for (const [i, c] of [...draw].entries()) G = move(G, i % 2, Number(c));
  check(G.state.winner === -1 && same(G.state.score, [0, 0, 1]) && rules.over(G.state), "a full board: a draw, counted as one");
}
{
  // through the database: empty lists, nulls and an empty string go missing, a list of lists comes back as objects
  let G = newRecord(rules, { seats: 2, options: {}, seed: 7, now: T });
  const fresh = rules.restore(roundTrip(structuredClone(G.state)));
  check(fresh.moves === "" && fresh.line.length === 0 && rules.toMove(fresh) === 0 && !rules.over(fresh) && same(fresh.score, [0, 0, 0]), "a new game comes back whole from the database");
  for (const [i, c] of [...("0615263")].entries()) G = move(G, i % 2, Number(c));
  const back = rules.restore(roundTrip(structuredClone(G.state)));
  check(back.winner === 0 && same(back.line, G.state.line) && same(back.score, [1, 0, 0]) && rules.over(back), "a won game comes back whole: the four, the tally");
}

// ---------- the solver, against a plain negamax ----------
/** The score for the mover as the solver gives it: 22 less the winner's discs, 0 a draw; no tricks. */
function naive(moves) {
  const { grid, height, n } = replay(moves);
  const g = Array.from(grid), h = Array.from(height);
  const wins = (c, r) => {
    const who = g[c * H + r];
    for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      let k = 1;
      for (const s of [1, -1]) for (let x = c + s * dc, y = r + s * dr; x >= 0 && x < W && y >= 0 && y < H && g[x * H + y] === who; x += s * dc, y += s * dr) k++;
      if (k >= 4) return true;
    }
    return false;
  };
  const nm = (nb, alpha, beta) => {
    if (nb === N) return 0;
    let best = -100;
    for (let c = 0; c < W; c++) {
      if (h[c] >= H) continue;
      const r = h[c];
      g[c * H + r] = 1 + (nb & 1);
      h[c]++;
      const v = wins(c, r) ? 22 - Math.ceil((nb + 1) / 2) : -nm(nb + 1, -beta, -alpha);
      g[c * H + r] = 0;
      h[c]--;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  };
  return nm(n, -100, 100);
}
/** A position `n` discs in, played at random but not into a finished game. */
function playout(n, seed) {
  const rng = seeded(seed);
  for (;;) {
    let m = "";
    while (m.length < n && !outcome(m).over) { const l = legal(m); m = drop(m, l[Math.floor(rng() * l.length)]); }
    if (m.length === n && !outcome(m).over) return m;
    seed = mix(seed, 1);
  }
}
{
  const S = createSolver({ bits: 16, thinkBits: 12 });
  let ok = true, count = 0;
  for (let i = 0; i < 12; i++) {
    const m = playout(30 + (i % 4), 100 + i);
    const want = naive(m), got = S.solve(m);
    count++;
    if (got !== want) { ok = false; console.log(`  ${m}: solver ${got}, plain ${want}`); }
  }
  check(ok, `the solver agrees with a plain negamax on ${count} positions 30 to 33 discs in`);
  // the score of each move: the negation of the score of the position it leads to
  const m = playout(31, 7), sc = S.scores(m);
  const each = legal(m).every(c => sc.scores[c] === (outcome(drop(m, c)).over ? 22 - Math.ceil((m.length + 1) / 2) : -naive(drop(m, c))));
  check(each && sc.best.every(c => sc.scores[c] === sc.top) && sc.top === Math.max(...sc.scores.filter(x => x !== null)), "the score of each column, and the best of them");
  check(MAX_SCORE === 18 && sc.top <= MAX_SCORE && sc.top >= -MAX_SCORE, "a score is within what a game can come to");
}
{
  // forced wins the search finds: a win in one, and a double threat (a win in three plies)
  const S = createSolver({ bits: 16, thinkBits: 14 });
  const t = S.think("061526", { depth: 4, nodeLimit: 50_000 });
  check(t.col === 3 && t.value > 9000, "a win in one: the column, and a forced result");
  const d = S.think("333322", { depth: 6, nodeLimit: 100_000 });
  check((d.col === 1 || d.col === 4) && d.value > 9000, "a double threat on the bottom row is found as a win");
  const facts = S.tactics("061526", 4);
  check(facts.find(f => f.c === 3)?.win === 1, "tactics: the win in one is a fact of column 4");
}

// ---------- the computer ----------
{
  const solver = newSolver({ bits: 16, thinkBits: 12 });
  const hard = (m, pick) => chooseMove(m, "hard", seeded(1), { solver });
  check(hard("061526") === 3, "Hard takes a win in one");
  check(hard("33241") === 0, "Hard stops a three it can't win before");
  check(chooseMove("", "hard", seeded(1), { solver }) === 3, "Hard opens in the middle column");
  const total = (level, m, col, n) => { let k = 0; for (let i = 0; i < n; i++) if (chooseMove(m, level, seeded(1000 + i), { solver }) === col) k++; return k / n; };
  const mediumWin = total("medium", "061526", 3, 80), easyWin = total("easy", "061526", 3, 80);
  check(mediumWin >= 0.9 && easyWin < mediumWin && easyWin > 0.25, `Medium takes a win in one nearly always (${mediumWin}), Easy less often (${easyWin})`);
  const mediumStop = total("medium", "33241", 0, 80), easyStop = total("easy", "33241", 0, 80);
  check(mediumStop >= 0.85 && easyStop < mediumStop, `Medium stops a three (${mediumStop}), Easy less often (${easyStop})`);
  check(SIGHT.hard.every(p => p === 1) && SIGHT.easy.every((p, i) => p <= SIGHT.medium[i]), "the levels' sight is ordered");
}
{
  // whole games: always legal, always ending
  const solver = newSolver({ bits: 16, thinkBits: 12 });
  let ok = true, done = 0;
  const t0 = Date.now();
  for (const [seed, levels] of [[1, ["easy", "medium"]], [2, ["medium", "easy"]], [3, ["easy", "easy"]], [4, ["medium", "medium"]], [5, ["hard", "easy"]]]) {
    let G = newRecord(rules, { seats: 2, options: {}, seed, now: T });
    let i = 0;
    for (; i < 60 && !rules.over(G.state); i++) {
      const seat = rules.toMove(G.state), mv = rules.bot(G.state, seat, { level: levels[seat], rng: seeded(mix(seed, i)) });
      if (!legal(G.state.moves).includes(mv.c)) { ok = false; console.log(`  illegal ${mv.c} at ${G.state.moves}`); break; }
      const r = applyMove(rules, G, seat, mv, T + i);
      if (r.error) { ok = false; console.log(r.error); break; }
      G = r.G;
    }
    if (!rules.over(G.state)) ok = false; else done++;
  }
  check(ok && done === 5, "the computer's moves are always legal, and its games end");
  check(Date.now() - t0 < 4000, `five whole games in ${Date.now() - t0} ms`);
  const l = botMove(rules, newRecord(rules, { seats: 2, options: {}, seed: 9, now: T }), 0, "medium");
  check(Number.isInteger(l.c) && l.c >= 0 && l.c < W, "botMove asks the rules' bot");
  const big = hardMove("0615", { solver });
  check(typeof big.col === "number" && legal("0615").includes(big.col), "Hard's move is a legal column");
}

console.log(bad ? `silo: ${bad} failed` : "silo: every check passed");
process.exit(bad ? 1 : 0);
