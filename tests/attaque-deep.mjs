// L'Attaque's Hard computer, Ataraxos's network (attaque-sight.js, attaque-net.js, attaque-deep.js): the game replayed in
// Ataraxos's board stands where ours does, its counts of hidden pieces are right, what it hands the network never depends on a
// hidden kind of the other side's, every move has its pair of cells, the move is drawn from the odds with the long shots left out
// (the coach takes the likeliest), a game begun before the state kept at0 is left to the search, and the packed network reads.
// Measured when it was made (23 Nov 2026): the policy alone, no search, beat the search that was Hard (now Medium) 6-0, three
// games each way, 270 to 950 moves, about 0.8 s a move in Node; too slow for this test, which runs one pass.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createSight, cellOf, kindToType, LAKES } from "../attaque-sight.js";
import { weightsFrom, createNet, CELLS, FEATURES } from "../attaque-net.js";
import { deepMove, sightOf } from "../attaque-deep.js";
import { KCH, positionOf, movesOf, bannedOf } from "../attaque-board.js";
import { think } from "../attaque-ai.js";
import { rules, viewOf } from "../attaque-rules.js";
import { newRecord, applyMove, seeded, botMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** A game between two Easy computers, every state kept. */
function game(seed, plies) {
  let G = newRecord(rules, { seats: 2, seed, options: {} });
  for (const seat of [0, 1]) G = applyMove(rules, G, seat, botMove(rules, G, seat, "medium")).G;
  const rng = seeded(seed), states = [structuredClone(G.state)];
  for (let i = 0; i < plies && !G.state.over; i++) {
    G = applyMove(rules, G, rules.toMove(G.state), think(viewOf(G.state, G.state.t), "easy", { rng }).code).G;
    states.push(structuredClone(G.state));
  }
  return states;
}
const states = game(11, 160).concat(game(12, 160));
check(states.every(s => s.at0 && s.at0.length === 160), "play keeps where the armies stood when it began (at0)");

// the replayed board against ours, square by square
let same = true, counts = true;
for (const s of states.filter((_, i) => i % 7 === 0)) {
  const { board, hidden } = sightOf(s).peek();
  for (let sq = 0; sq < 100; sq++) {
    const b = board[99 - sq];
    const at = [...Array(80).keys()].find(i => s.at.slice(2 * i, 2 * i + 2) === String(sq).padStart(2, "0"));
    if (at == null) { if (b.color !== 0 && b.color !== 3) same = false; continue; }
    if (b.color !== (at < 40 ? 1 : 2) || b.type !== kindToType(KCH.indexOf(s.pk[at]))) same = false;
  }
  for (const side of [0, 1]) {
    const byType = Array(12).fill(0);
    for (let sq = 0; sq < 100; sq++) { const b = board[sq]; if (b.color === side + 1 && !b.visible) byType[b.type]++; }
    if (byType.some((n, t) => n !== hidden[side][t])) counts = false;
  }
}
check(same, "the game replayed in Ataraxos's board (turned round) has every piece where ours has it");
check(counts, "its counts of each side's hidden pieces by kind are the hidden pieces on the board");
check(LAKES.every(d => cellOf(d) === -1) && cellOf(99) === CELLS - 1, "the network's 92 cells leave the lakes out");

// what the network is handed can't depend on a hidden kind of the other side: shuffle them (the moved among the moved, the rest
// among the rest, so the game stays one that could have been played) and nothing changes
let blind = true, seen = 0;
for (const s of states.filter((_, i) => i % 11 === 5)) {
  const sight = sightOf(s), them = 1 - s.t, { board } = sight.peek();
  const live = [];
  for (let i = them * 40; i < them * 40 + 40; i++) {
    if (s.at.slice(2 * i, 2 * i + 2) === "--") continue;
    const b = board[99 - Number(s.at.slice(2 * i, 2 * i + 2))];
    if (!b.visible) live.push({ i, moved: b.moved });
  }
  const rng = seeded(seen + 3), pk = [...s.pk];
  for (const moved of [0, 1]) {
    const group = live.filter(x => x.moved === moved).map(x => x.i), kinds = group.map(i => pk[i]);
    for (let k = kinds.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [kinds[k], kinds[j]] = [kinds[j], kinds[k]]; }
    group.forEach((i, k) => { pk[i] = kinds[k]; });
  }
  if (pk.join("") === s.pk) continue;
  seen++;
  const a = sight.features(), b = sightOf({ ...s, pk: pk.join("") }).features();
  if (a.some((v, i) => v !== b[i])) blind = false;
}
check(blind && seen >= 3, `the network's input is the same whatever the other side's hidden pieces are (${seen} positions shuffled)`);

// every legal move has its pair of cells, the two different
let paired = true;
for (const s of states.filter((_, i) => i % 13 === 0)) {
  const sight = sightOf(s), p = positionOf(s);
  for (const m of movesOf(p, s.t, bannedOf(s.moves))) { const [f, t] = sight.cells(Math.floor(m / 100), m % 100); if (f < 0 || t < 0 || f === t) paired = false; }
}
check(paired, "every legal move is a pair of the network's cells");

// the choice: drawn from the odds, the long shots never; the coach's the likeliest
const s = states[40], legal = movesOf(positionOf(s), s.t, bannedOf(s.moves)), sight = sightOf(s);
const cell = m => sight.cells(Math.floor(m / 100), m % 100);
const stub = { forward: () => {
  const logits = new Float32Array(CELLS * CELLS).fill(-30);
  const put = (m, v) => { const [f, t] = cell(m); logits[f * CELLS + t] = v; };
  put(legal[0], 2); put(legal[1], 1); put(legal[2], Math.log(0.004) + 2);
  return { logits, value: [Math.log(0.2), Math.log(0.3), Math.log(0.5)] };
} };
const rng = seeded(9), drawn = new Map();
for (let k = 0; k < 400; k++) { const c = deepMove(stub, s, { rng }).code; drawn.set(c, (drawn.get(c) || 0) + 1); }
const share = (drawn.get(legal[0]) || 0) / 400;
check(drawn.size === 2 && share > 0.62 && share < 0.84, `a move is drawn from the odds (${Math.round(share * 100)}% for odds of 73%), a long shot (0.4%) never`);
check(deepMove(stub, s, { best: true }).code === legal[0], "the coach takes the likeliest move");
check(deepMove(stub, { ...s, at0: undefined }) === null, "a game begun before at0 was kept is left to the search");

// the packed network: it reads, and one pass gives odds and the game's worth
const t0 = Date.now(), net = createNet(weightsFrom(gunzipSync(readFileSync(new URL("../vendor/ataraxos/ataraxos.bin.gz", import.meta.url)))));
const r = deepMove(net, states[0], { best: true });
check(r && legal.length && Math.abs(r.odds.reduce((a, b) => a + b, 0) - 1) < 1e-4 && Math.abs(r.value.reduce((a, b) => a + b, 0) - 1) < 1e-4,
  `the network reads (${Date.now() - t0} ms with a pass) and gives odds over the moves and the worth of the game`);
check(sight.features().length === CELLS * FEATURES, "its input is 92 cells of 643 numbers");

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
