// Bones (bones-rules.js) on seats.js: the double-six set; Fives and Threes' count of the ends (a double at an end both
// halves, the first tile all its pips) and its points; Partnership (the double six leads the first hand, play passes
// on, a tile must fit, a knock only when nothing fits, going out or the block deciding the hand, the losers' pips or
// every hand's, the target); Gaple (the double blank opening, the winner leading a double after, the lowest count
// winning and every player paying every other the difference, a tile laid face down counting, the lone double blank
// at 25); Fives and Threes (the deals, the tiles out of play, every tile scored, nothing past the target, exactly the
// target winning at once, the point for going out, both of a side out in partnerships); the state through the database;
// the line's layout (never two tiles on each other, every tile touching the one before it); the computer players
// (always legal, Hard beating Easy) and whole games of each.
import { rules, TILES, idOf, fivesPoints, endsOf, endsTotal, legalPlays, handPips, handSize, HAND_MS } from "../bones-rules.js";
import { botMove as bonesBot, LEVEL_NAMES } from "../bones-bot.js";
import { layout, rowLenFor, pipSpots } from "../bones-layout.js";
import { newRecord, applyMove, applyWake, botMove, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const T = 1_000_000;
const move = (G, seat, m, now = T) => { const r = applyMove(rules, G, seat, m, now); if (r.error) throw new Error(`${r.error} (${JSON.stringify(m)})`); return r.G; };
const tile = (a, b) => idOf(a, b);
const sum = list => list.reduce((a, b) => a + b, 0);

// ---------- the set and the count ----------
check(TILES.length === 28 && TILES.filter(([a, b]) => a === b).length === 7 && TILES[idOf(6, 3)].join() === "3,6" && idOf(6, 6) === 27 && idOf(0, 0) === 0, "the double-six set: 28 tiles, seven doubles");
check([[3, 1], [5, 1], [6, 2], [9, 3], [10, 2], [12, 4], [15, 8], [18, 6], [20, 4], [7, 0], [8, 0], [0, 0], [24, 8]].every(([t, p]) => fivesPoints(t) === p), "Fives and Threes: a point a five and a three (15 makes 8, 20 makes 4, 7 nothing)");
check(pipSpots(6, true).length === 6 && pipSpots(0, false).length === 0 && pipSpots(5, false).length === 5, "pips drawn for every number");
{
  // a hand-made line: [5-5] first, then [5-2] on the right; [5-3] on the left
  const s = { first: tile(5, 5), firstSides: [5, 5], left: [], right: [] };
  check(endsTotal(s) === 10, "a double led counts its pips once: 10");
  s.right.push({ t: tile(5, 2), v: 2 });
  check(endsTotal(s) === 12 && endsOf(s).Ld && !endsOf(s).Rd, "with a tile on one side, the double left at the other end counts both halves: 10 and 2");
  s.left.push({ t: tile(5, 3), v: 3 });
  check(endsTotal(s) === 5, "and once both sides have tiles, 3 and 2");
  const t = { first: tile(3, 6), firstSides: [3, 6], left: [], right: [{ t: tile(6, 6), v: 6 }] };
  check(endsTotal(t) === 15, "a double at an end: 3 and 6 and 6 make 15");
}

// ---------- Partnership ----------
/** A game with the hands set as given (the deal's shuffle replaced). */
function table(game, hands, extra = {}) {
  const G = newRecord(rules, { seats: hands.length, options: { game, ...extra }, seed: 3, now: T });
  const s = G.state;
  s.hands = hands.map(h => h.map(([a, b]) => tile(a, b)));
  return G;
}
{
  let G = newRecord(rules, { seats: 4, options: { game: "partnership" }, seed: 9, now: T });
  const s = G.state;
  check(s.hands.every(h => h.length === 7) && new Set(s.hands.flat()).size === 28, "Partnership: all 28 dealt, seven each");
  const lead = s.hands.findIndex(h => h.includes(27));
  check(s.turn === lead && legalPlays(s, lead).length === 1 && legalPlays(s, lead)[0].tile === 27, "the holder of the double six leads it, and nothing else");
  check(applyMove(rules, G, lead, { t: "play", tile: s.hands[lead].find(t => t !== 27), end: "L" }).error === "Lead the double six", "another lead is refused");
  G = move(G, lead, { t: "play", tile: 27, end: "L" });
  check(G.state.turn === (lead + 1) % 4 && G.state.first === 27, "laid; the turn passes on");
}
{
  // a hand played out: seat 0 leads, all fit as given, seat 0 goes out
  let G = table("partnership", [[[6, 6], [6, 5], [1, 1]], [[5, 4], [1, 2]], [[4, 3], [2, 2]], [[3, 0], [0, 1]]]);
  G.state.turn = 0; G.state.starter = 0; G.state.must = { seat: 0, tiles: [27] };
  check(applyMove(rules, G, 1, { t: "play", tile: tile(5, 4), end: "L" }).error === "It isn't your turn", "out of turn is refused");
  G = move(G, 0, { t: "play", tile: 27, end: "L" });
  check(applyMove(rules, G, 1, { t: "pass" }).error === "That tile doesn't go there" || applyMove(rules, G, 1, { t: "play", tile: tile(5, 4), end: "L" }).error, "a tile that fits neither end is refused");
  check(applyMove(rules, G, 1, { t: "pass" }).error === undefined, "with nothing that fits, a pass");
  G = move(G, 1, { t: "pass" });
  check(G.state.passes === 1 && G.say.text === "A pass from {s1}." && G.state.log.at(-1).ends.join() === "6,6", "a pass counted, said, and what it was on remembered");
  G = move(G, 2, { t: "pass" });
  G = move(G, 3, { t: "pass" });
  check(G.state.turn === 0 && G.state.step === "play", "three passes: back to the one who laid");
  G = move(G, 0, { t: "play", tile: tile(6, 5), end: "R" });
  check(endsOf(G.state).L === 6 && endsOf(G.state).R === 5, "the ends move on");
  G = move(G, 1, { t: "play", tile: tile(5, 4), end: "R" });
  G = move(G, 2, { t: "play", tile: tile(4, 3), end: "R" });
  G = move(G, 3, { t: "play", tile: tile(3, 0), end: "R" });
  check(G.state.step === "play" && G.state.turn === 0 && legalPlays(G.state, 0).length === 0 && G.state.passes === 0, "round again: a play resets the passes; now nothing fits for the leader");
}
{
  // going out: the side scores the other side's pips
  let G = table("partnership", [[[6, 6]], [[1, 2], [3, 3]], [[0, 4]], [[5, 5], [2, 4]]]);
  G.state.turn = 0; G.state.starter = 0; G.state.must = { seat: 0, tiles: [27] };
  G = move(G, 0, { t: "play", tile: 27, end: "L" });
  check(G.state.step === "scored" && G.state.result.how === "domino" && G.state.result.team === 0 && G.state.scores.join() === "25,0" && G.state.result.delta[0] === 25, "going out: the side scores the other side's pips (9 and 16), its own not counting");
  check(/Out: \{s0\}/.test(G.say.text) && rules.wakeAt(G.state) === T + HAND_MS, "said, and shown a moment");
  G = applyWake(rules, G, T + HAND_MS);
  check(G.state.step === "play" && G.state.handNo === 2 && G.state.turn === 1 && !G.state.must && G.state.hands.every(h => h.length === 7), "the next hand: dealt again, the lead passed on, any tile");
  let A = table("partnership", [[[6, 6]], [[1, 2], [3, 3]], [[0, 4]], [[5, 5], [2, 4]]], { count: "all" });
  A.state.turn = 0; A.state.must = { seat: 0, tiles: [27] };
  A = move(A, 0, { t: "play", tile: 27, end: "L" });
  check(A.state.scores[0] === 25 + 4, "counting every hand: the partner's pips too");
}
{
  // blocked: the side with fewer pips scores the other's
  let G = table("partnership", [[[6, 6], [0, 0]], [[1, 1], [2, 2]], [[0, 1]], [[1, 2], [3, 3]]]);
  G.state.turn = 0; G.state.must = { seat: 0, tiles: [27] };
  G = move(G, 0, { t: "play", tile: 27, end: "L" });
  for (const p of [1, 2, 3, 0]) G = move(G, p, { t: "pass" });
  const r = G.state.result;
  check(G.state.step === "scored" && r.how === "blocked" && r.side.join() === "1,15" && r.team === 0 && G.state.scores[0] === 15, "blocked: the side holding fewer (0 and 1 against 15) scores the other's");
  let E = table("partnership", [[[6, 6], [1, 2]], [[0, 3]], [[0, 2]], [[1, 1]]]);
  E.state.turn = 0; E.state.must = { seat: 0, tiles: [27] };
  E = move(E, 0, { t: "play", tile: 27, end: "L" });
  for (const p of [1, 2, 3, 0]) E = move(E, p, { t: "pass" });
  check(E.state.result.team === -1 && E.state.scores.join() === "0,0", "level: no score");
  // the target ends it
  let W = table("partnership", [[[6, 6]], [[1, 2], [3, 3]], [[0, 4]], [[5, 5], [2, 4]]]);
  W.state.turn = 0; W.state.must = { seat: 0, tiles: [27] }; W.state.scores = [95, 40];
  W = move(W, 0, { t: "play", tile: 27, end: "L" });
  check(W.state.step === "over" && W.state.winners.join() === "0,2" && /120 to 40/.test(W.say.text), "past the target: the game over, the side named");
}

// ---------- Gaple ----------
{
  let G = newRecord(rules, { seats: 4, options: { game: "gaple" }, seed: 4, now: T });
  const lead = G.state.hands.findIndex(h => h.includes(0));
  check(G.state.turn === lead && legalPlays(G.state, lead).map(p => p.tile).join() === "0", "Gaple: the double blank opens the first hand");
  // a hand: lowest count wins; everyone pays everyone the difference (pagat's example: 12, 5, 11, 7)
  let H = table("gaple", [[[0, 0], [6, 6]], [[1, 4]], [[5, 6]], [[3, 4]]]);
  H.state.turn = 0; H.state.must = { seat: 0, tiles: [0] };
  H.state.hands[0] = [0, tile(6, 6)];
  H = move(H, 0, { t: "play", tile: 0, end: "L" });
  for (const p of [1, 2, 3]) H = move(H, p, { t: "pass" });
  H = move(H, 0, { t: "pass" });
  const r = H.state.result;
  check(r.how === "blocked" && r.pips.join() === "12,5,11,7" && r.winner === 1 && r.delta.join() === "-13,15,-9,7" && sum(H.state.scores) === 0, "blocked at 12, 5, 11 and 7: the 5 wins, collecting 15; each pays each the difference");
  H = applyWake(rules, H, T + HAND_MS);
  check(H.state.turn === 1 || H.state.must.seat !== 1, "the next hand: the winner leads");
  check(H.state.must && H.state.hands[H.state.must.seat].some(t => TILES[t][0] === TILES[t][1]) && H.state.must.tiles.every(t => TILES[t][0] === TILES[t][1]), "with a double (the winner's, or the next player's who has one)");
  // the lone double blank at 25, and face down
  const lone = { game: "gaple", opts: { blank25: true }, hands: [[0, tile(3, 4)], [0, tile(0, 5)]], dead: [[], []] };
  check(handPips(lone, 0) === 32 && handPips(lone, 1) === 5, "a lone double blank counts 25; with another blank tile, nothing");
  let D = table("gaple", [[[0, 0], [6, 6]], [[1, 4], [5, 5]], [[5, 6]], [[3, 4]]], { stuck: "discard" });
  D.state.turn = 0; D.state.must = { seat: 0, tiles: [0] }; D.state.hands[0] = [0, tile(6, 6)];
  D = move(D, 0, { t: "play", tile: 0, end: "L" });
  check(applyMove(rules, D, 1, { t: "pass" }).error === "Lay a tile face down", "laying down: no pass when stuck");
  D = move(D, 1, { t: "discard", tile: tile(5, 5) });
  check(D.state.dead[1].length === 1 && D.state.hands[1].length === 1 && handPips(D.state, 1) === 15, "the tile laid face down still counts against its player");
}

// ---------- Fives and Threes ----------
{
  check(handSize("fives", 2) === 7 && handSize("fives", 3) === 5 && handSize("fives", 4) === 5 && handSize("fives", 2, { deal: "championship" }) === 9 && handSize("fives", 4, { deal: "championship" }) === 6, "Fives and Threes: five each, seven for two (the championship: nine for two, six for four)");
  const G = newRecord(rules, { seats: 2, options: { game: "fives" }, seed: 2, now: T });
  check(G.state.hands.every(h => h.length === 7) && G.state.boneyard.length === 14 && !G.state.must, "the rest out of play; any tile leads");
  let F = table("fives", [[[5, 5], [5, 0], [6, 3]], [[0, 3], [2, 2]]]);
  F.state.turn = 0; F.state.starter = 0;
  F = move(F, 0, { t: "play", tile: tile(5, 5), end: "L" });
  check(F.state.scores.join() === "2,0" && F.state.log.at(-1).pts === 2 && /10: 2 for \{s0\}/.test(F.say.text), "the double five led: 10, two points");
  F = move(F, 1, { t: "pass" });
  F = move(F, 0, { t: "play", tile: tile(5, 0), end: "R" });
  check(endsTotal(F.state) === 10 && F.state.scores[0] === 4, "[5-0] on it: 10 and 0, two more");
  F = move(F, 1, { t: "play", tile: tile(0, 3), end: "R" });
  check(endsTotal(F.state) === 13 && F.state.scores[1] === 0, "13: nothing");
  F = move(F, 0, { t: "play", tile: tile(6, 3), end: "R" });
  check(F.state.step === "scored" && F.state.scores[0] === 4 + 1 && F.state.result.go === 1, "16: nothing, but out: a point");
  // the target: past it nothing, exactly it wins at once
  let X = table("fives", [[[5, 5], [6, 3]], [[1, 2], [4, 4]]], { target: 61 });
  X.state.turn = 0; X.state.scores = [60, 58];
  X = move(X, 0, { t: "play", tile: tile(5, 5), end: "L" });
  check(X.state.scores[0] === 60 && X.state.log.at(-1).pts === 0 && /past 61/.test(X.say.text), "two that would take 60 past 61: nothing");
  let Y = table("fives", [[[5, 0], [6, 3]], [[1, 2], [4, 4]]], { target: 61 });
  Y.state.turn = 0; Y.state.scores = [60, 58];
  Y = move(Y, 0, { t: "play", tile: tile(5, 0), end: "L" });
  check(Y.state.step === "over" && Y.state.winners.join() === "0" && Y.say.text === "5: 1 for {s0}. 61 exactly: the game to {s0}.", "one that makes 61 exactly: the game, at once, and both said");
  // partnerships: play goes on until both of a side are out
  let P = table("fives", [[[6, 6]], [[6, 1], [2, 3]], [[1, 4]], [[4, 0], [0, 0]]]);
  P.state.turn = 0;
  P = move(P, 0, { t: "play", tile: 27, end: "L" });
  check(P.state.step === "play" && P.state.out.join() === "0" && P.state.turn === 1, "four as partners: one out, the others play on");
  P = move(P, 1, { t: "play", tile: tile(6, 1), end: "L" });
  P = move(P, 2, { t: "play", tile: tile(1, 4), end: "L" });
  check(P.state.step === "scored" && P.state.result.by === 2 && P.state.scores[0] >= 1 && P.state.turn !== 0, "both of a side out: the hand ends, their side's point");
}
{
  // through the database at any point
  let G = newRecord(rules, { seats: 3, options: { game: "fives" }, seed: 12, now: T }), ok = true;
  for (let i = 0; i < 40 && G.state.step === "play"; i++) {
    const back = rules.restore(roundTrip(structuredClone(G.state)));
    if (JSON.stringify(back.hands) !== JSON.stringify(G.state.hands) || back.left.length !== G.state.left.length || back.log.length !== G.state.log.length || endsTotal(back) !== endsTotal(G.state)) ok = false;
    G = move(G, G.state.turn, bonesBot(G.state, G.state.turn, "easy", seeded(i)), T + i);
  }
  check(ok, "the state comes back whole from the database at every move");
}

// ---------- the layout ----------
{
  const rect = p => ({ x0: p.x - (p.v ? 0.5 : 1), x1: p.x + (p.v ? 0.5 : 1), y0: p.y - (p.v ? 1 : 0.5), y1: p.y + (p.v ? 1 : 0.5) });
  const overlap = (a, b) => a.x0 < b.x1 - 1e-6 && b.x0 < a.x1 - 1e-6 && a.y0 < b.y1 - 1e-6 && b.y0 < a.y1 - 1e-6;
  const touch = (a, b) => {
    const gx = Math.max(a.x0 - b.x1, b.x0 - a.x1), gy = Math.max(a.y0 - b.y1, b.y0 - a.y1);
    return (Math.abs(gx) < 1e-6 && gy < -1e-6) || (Math.abs(gy) < 1e-6 && gx < -1e-6);
  };
  let overlaps = 0, apart = 0, wrong = 0, lines = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const rng = seeded(seed);
    // a random line from a shuffled set: each tile laid on whichever end it fits
    const pack = TILES.map((_, i) => i);
    for (let i = pack.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pack[i], pack[j]] = [pack[j], pack[i]]; }
    const s = { first: pack[0], firstSides: [...TILES[pack[0]]], left: [], right: [] };
    for (const t of pack.slice(1)) {
      const e = endsOf(s), [a, b] = TILES[t];
      const goL = a === e.L || b === e.L, goR = a === e.R || b === e.R;
      if (goL && (!goR || rng() < 0.5)) s.left.push({ t, v: a === e.L ? b : a });
      else if (goR) s.right.push({ t, v: a === e.R ? b : a });
    }
    for (const len of [8, 10, 12, 16, 20]) {
      lines++;
      const L = layout(s.first, s.firstSides, s.left, s.right, len), R = L.tiles.map(rect);
      for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) if (overlap(R[i], R[j])) overlaps++;
      for (const arm of ["L", "R"]) {
        const seq = [L.tiles[0], ...L.tiles.filter(p => p.arm === arm).sort((p, q) => p.i - q.i)];
        for (let k = 1; k < seq.length; k++) if (!touch(rect(seq[k - 1]), rect(seq[k]))) apart++;
      }
      for (const p of L.tiles) if ([p.a, p.b].sort().join() !== TILES[p.t].join()) wrong++;
    }
  }
  check(overlaps === 0, `${lines} lines laid out at five row lengths: no two tiles on each other`);
  check(apart === 0, "every tile touches the one before it in its arm, round the turns too");
  check(wrong === 0, "every tile drawn with its own numbers");
  check(rowLenFor(1.13, 22) >= 10 && rowLenFor(0.7, 22) <= rowLenFor(1.6, 22), "a row as short as the board's shape allows (a tall board more rows, a wide one longer rows)");
}

// ---------- the computer players ----------
{
  check(LEVEL_NAMES.map(l => l[0]).join() === "easy,medium,hard", "three levels");
  let ok = true, games = 0;
  for (const [game, seats, extra] of [["partnership", 4, {}], ["gaple", 4, {}], ["gaple", 4, { stuck: "discard", blank25: true }], ["fives", 2, {}], ["fives", 3, {}], ["fives", 4, { deal: "championship" }]]) {
    for (const level of ["easy", "medium", "hard"]) {
      let G = newRecord(rules, { seats, options: { game, ...extra, deals: 3, target: game === "partnership" ? 100 : 61 }, seed: games * 7 + 1, now: T }), i = 0;
      for (; i < 3000 && G.state.step !== "over"; i++) {
        const at = rules.wakeAt(G.state);
        if (at != null) { G = applyWake(rules, G, at); continue; }
        const seat = rules.toMove(G.state), r = applyMove(rules, G, seat, botMove(rules, G, seat, level), T + i);
        if (r.error) { ok = false; console.log(`  ${game} ${level}: ${r.error}`); break; }
        G = r.G;
      }
      if (G.state.step !== "over") ok = false;
      if (game === "gaple" && sum(G.state.scores) !== 0) ok = false;
      games++;
    }
  }
  check(ok, `${games} whole games, every game at every level: every move legal, every game over (Gaple's chips summing to nothing)`);
  // Hard against Easy: the Hard side should win most
  let hard = 0;
  for (let g = 0; g < 14; g++) {
    let G = newRecord(rules, { seats: 4, options: { game: "partnership", target: 100 }, seed: 500 + g, now: T }), i = 0;
    for (; i < 4000 && G.state.step !== "over"; i++) {
      const at = rules.wakeAt(G.state);
      if (at != null) { G = applyWake(rules, G, at); continue; }
      const seat = rules.toMove(G.state);
      G = applyMove(rules, G, seat, botMove(rules, G, seat, seat % 2 === 0 ? "hard" : "easy"), T + i).G;
    }
    if (G.state.winners.includes(0)) hard++;
  }
  check(hard >= 9, `Hard partners beat Easy ones most of the time (${hard} of 14)`);
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
