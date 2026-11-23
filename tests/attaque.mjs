// L'Attaque (attaque-board.js, attaque-ai.js, attaque-rules.js): the board and the setups, the attacks, the moves against a
// slow referee on positions from random games, the two-square rule, a game on seats.js (setting up at once, turns, attacks,
// the Flag, a side that cannot move, the quiet draw, resigning, the state through the database), what each side may know
// (viewOf never hands over a hidden kind), the computer's deals of the hidden pieces, and its play where the answer is plain.
// The levels were measured when they were made (23 Nov 2026): Medium beat Easy 4-0 and Hard beat Medium 5-1, a game taking
// Hard up to a second a move in Node; that match is too slow for this test, which keeps their order.
import { N, SIZE, ARMY, LAKE, COUNT, KCH, FLAG, SPY, SCOUT, MINER, MARSHAL, BOMB, fight, validSetup, randomSetup, placeSquare, placeOf, positionOf, movesOf, bannedOf, play, squareName } from "../attaque-board.js";
import { think, sample, LEVELS } from "../attaque-ai.js";
import { rules, viewOf, sideOfSeat, seatOfSide, QUIET, TWO_SQUARE } from "../attaque-rules.js";
import { newRecord, applyMove, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sq = name => (SIZE - Number(name.slice(1))) * SIZE + "abcdefghij".indexOf(name[0]);
const pad = v => String(v).padStart(2, "0");
/** A game in play from the pieces on the board: [side, kind (a character), square, flags ("s" shown, "m" moved)]; every other
 *  piece of each army was taken (so was shown). */
function build(list, t = 0) {
  const pk = Array(2 * ARMY).fill(""), at = Array(2 * ARMY).fill("--"), sn = Array(2 * ARMY).fill("1"), mv = Array(2 * ARMY).fill("1");
  const left = [COUNT.slice(), COUNT.slice()], next = [0, ARMY];
  for (const [side, ch, name, fl = ""] of list) {
    const id = next[side]++;
    pk[id] = ch; left[side][KCH.indexOf(ch)]--; at[id] = pad(sq(name)); sn[id] = fl.includes("s") ? "1" : "0"; mv[id] = fl.includes("m") ? "1" : "0";
  }
  for (const side of [0, 1]) for (let k = 0; k < COUNT.length; k++) for (; left[side][k] > 0; left[side][k]--) pk[next[side]++] = KCH[k];
  return { seats: 2, red: 0, phase: "play", rdy: "11", pk: pk.join(""), at: at.join(""), sn: sn.join(""), mv: mv.join(""), t, moves: [], quiet: 0 };
}
const T = 1_000_000;
const G0 = s => ({ seq: 1, seed: 5, n: 0, seats: 2, options: {}, state: s, started: T });
const mv = (G, seat, m) => { const r = applyMove(rules, G, seat, m, T); if (r.error) throw new Error(`${r.error} (${m})`); return r.G; };
const code = (a, b) => sq(a) * 100 + sq(b);

// ---------- the board, the setups, the attacks ----------
{
  let lakes = 0;
  for (let d = 0; d < N; d++) lakes += LAKE[d];
  check(lakes === 8 && LAKE[sq("c5")] && LAKE[sq("d6")] && LAKE[sq("g5")] && LAKE[sq("h6")] && !LAKE[sq("e5")] && !LAKE[sq("a6")], "two lakes of four squares in the middle rows, three lanes open beside and between them");
  check(COUNT.reduce((a, b) => a + b, 0) === ARMY && COUNT[SCOUT] === 8 && COUNT[BOMB] === 6 && COUNT[MINER] === 5 && COUNT[MARSHAL] === 1, "forty pieces an army: eight Scouts, five Miners, six Bombs, one Marshal");
  const red = new Set(), blue = new Set();
  let back = true;
  for (let i = 0; i < ARMY; i++) { red.add(placeSquare(0, i)); blue.add(placeSquare(1, i)); if (placeOf(0, placeSquare(0, i)) !== i || placeOf(1, placeSquare(1, i)) !== i) back = false; }
  check(red.size === 40 && blue.size === 40 && [...red].every(d => d >= 60) && [...blue].every(d => d < 40) && back && placeSquare(0, 0) === sq("a4") && placeSquare(1, 0) === sq("j7"), "each side sets up in its four rows, front row first and its own left first (Blue's left is Red's right)");
  const rng = seeded(7);
  let ok = true, flagBack = 0, guarded = 0;
  for (let n = 0; n < 400; n++) {
    const s = randomSetup(rng), f = s.indexOf("F");
    if (!validSetup(s) || f < 20) ok = false;
    if (f >= 30) flagBack++;
    if ([f - 1, f + 1, f - 10, f + 10].some(i => i >= 0 && i < 40 && Math.abs((i % 10) - (f % 10)) <= 1 && s[i] === "B")) guarded++;
  }
  check(ok && flagBack > 300 && guarded > 300, `400 dealt setups are whole armies, the Flag never in the front two rows (${flagBack} on the back row, ${guarded} beside a Bomb)`);
  check(!validSetup("F".repeat(40)) && !validSetup(randomSetup(rng).slice(1)) && !validSetup(42), "an army short of a piece, or of the wrong pieces, is no setup");
  check(fight(SPY, MARSHAL) === 1 && fight(MARSHAL, SPY) === 1 && fight(SPY, SCOUT) === -1 && fight(MINER, BOMB) === 1 && fight(9, BOMB) === -1 && fight(4, 4) === 0 && fight(SCOUT, FLAG) === 1 && fight(MARSHAL, 9) === 1,
    "attacks: the Spy takes the Marshal only attacking, a Miner takes a Bomb, a Bomb takes anything else, equals both fall, anything takes the Flag");
}

// ---------- moves, against a referee written the slow way ----------
function refMoves(p, side) {
  const out = [];
  for (let id = side * ARMY; id < side * ARMY + ARMY; id++) {
    const from = p.pos[id], k = p.kind[id];
    if (from < 0 || k === FLAG || k === BOMB) continue;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let r = Math.floor(from / SIZE), c = from % SIZE;
      for (;;) {
        r += dr; c += dc;
        if (r < 0 || r > 9 || c < 0 || c > 9 || LAKE[r * SIZE + c]) break;
        const o = p.pos.findIndex(v => v === r * SIZE + c);
        if (o >= 0 && (o >= ARMY ? 1 : 0) === side) break;
        out.push(from * 100 + r * SIZE + c);
        if (o >= 0 || k !== SCOUT) break;
      }
    }
  }
  return out.sort((a, b) => a - b);
}
{
  let positions = 0, wrong = 0, ends = 0, flags = 0, stuck = 0, quiet = 0, shown = true, apart = true;
  for (let g = 0; g < 30; g++) {
    let G = newRecord(rules, { seats: 2, options: {}, seed: 100 + g, now: T });
    G = mv(G, 0, { setup: randomSetup(seeded(g)) });
    G = mv(G, 1, rules.bot(G.state, 1, { level: "easy", rng: seeded(g) }));
    const rng = seeded(500 + g);
    while (!G.state.over && G.state.moves.length < 4000) {
      const p = positionOf(G.state), ms = movesOf(p, p.t, bannedOf(G.state.moves));
      if (positions < 3000) { positions++; if (JSON.stringify([...movesOf(p)].sort((a, b) => a - b)) !== JSON.stringify(refMoves(p, p.t))) wrong++; }
      const m = ms[Math.floor(rng() * ms.length)];
      G = mv(G, rules.toMove(G.state), m);
      const q = positionOf(G.state), seenOn = new Set();
      for (let id = 0; id < 2 * ARMY; id++) {
        if (q.pos[id] < 0 && !q.seen[id]) shown = false;                   // a taken piece was shown in its fight
        if (q.pos[id] >= 0) { if (seenOn.has(q.pos[id])) apart = false; seenOn.add(q.pos[id]); }
      }
    }
    if (G.state.over) { ends++; const why = G.state.result.why; if (why === "flag") flags++; else if (why === "stuck") stuck++; else if (why === "quiet") quiet++; }
  }
  check(!wrong && positions >= 3000, `the moves of ${positions} positions from random games are the referee's (Scouts run, nothing crosses a lake or a piece, Bombs and the Flag stay)`);
  check(ends === 30 && flags + stuck + quiet === 30 && flags > 0 && shown && apart, `30 random games end (${flags} by the Flag, ${stuck} with a side unable to move, ${quiet} quiet), one piece a square, every taken piece shown`);
}

// ---------- the two-square rule ----------
{
  let G = G0(build([[0, "4", "a4"], [0, "F", "j1"], [1, "4", "j10"], [1, "F", "a10"]]));
  const legs = [code("a4", "a5"), code("j10", "j9"), code("a5", "a4"), code("j9", "j10"), code("a4", "a5"), code("j10", "j9")];
  legs.forEach((m, i) => { G = mv(G, i % 2, m); });
  const r = applyMove(rules, G, 0, code("a5", "a4"), T);
  check(bannedOf(G.state.moves) === code("a5", "a4") && r.error === TWO_SQUARE && !applyMove(rules, G, 0, code("a5", "b5"), T).error, "a piece may not go between the same two squares a fourth time running; another way out is fine");
}

// ---------- a game on seats.js ----------
{
  let G = newRecord(rules, { seats: 2, options: { colour: "red" }, seed: 3, now: T });
  const s = G.state;
  check(s.phase === "setup" && s.red === 0 && rules.toMove(s) === null && JSON.stringify(rules.toMoveAll(s)) === "[0,1]" && validSetup(s.pk.slice(0, 40)) && validSetup(s.pk.slice(40)), "a new game: both armies dealt, both sides setting up at once, nobody yet to move");
  check(applyMove(rules, G, 0, { setup: "B".repeat(40) }).error === "That isn't a whole army" && applyMove(rules, G, 0, code("a4", "a5")).error, "a setup that isn't a whole army, and a move before both are set up, are refused");
  const mine = randomSetup(seeded(1));
  G = mv(G, 0, { setup: mine });
  check(G.state.rdy === "10" && JSON.stringify(rules.toMoveAll(G.state)) === "[1]" && applyMove(rules, G, 0, { setup: mine }).error && G.state.pk.slice(0, 40) === mine && positionOf(G.state).pos[0] === sq("a4"), "Red's army goes in where it was arranged, once; Blue is still setting up");
  G = mv(G, 1, rules.bot(G.state, 1, { level: "medium", rng: seeded(2) }));
  check(G.state.phase === "play" && rules.toMove(G.state) === 0 && G.state.t === 0, "with both armies in, Red moves first");
  const blue = newRecord(rules, { seats: 2, options: { colour: "blue" }, seed: 3, now: T });
  check(blue.state.red === 1 && sideOfSeat(blue.state, 0) === 1 && seatOfSide(blue.state, 0) === 1, "colour: blue makes the computer's seat Red, so it moves first");
  const legal = movesOf(positionOf(G.state));
  check(applyMove(rules, G, 1, legal[0], T).error === "It isn't your turn" && applyMove(rules, G, 0, 9999, T).error === "That isn't a legal move", "a move out of turn, and a move that isn't one, are refused");
  const back = rules.restore(roundTrip(structuredClone(G.state)));
  check(JSON.stringify(back.moves) === "[]" && back.at === G.state.at && back.pk === G.state.pk, "the state comes back from the database whole, the empty list of moves too");
  const quit = mv(G, 1, { resign: true });
  check(quit.state.over && quit.state.result.winner === 0 && quit.state.result.why === "resign" && rules.toMove(quit.state) === null, "resigning ends the game and the other side wins");
}
{
  // an attack: both shown, the lower taken; the Flag ends the game
  let G = G0(build([[0, "7", "e4"], [0, "F", "a1"], [0, "3", "j1"], [1, "4", "e5"], [1, "F", "e7"], [1, "B", "d7"], [1, "2", "j10", "m"]]));
  G = mv(G, 0, code("e4", "e5"));
  const p = positionOf(G.state);
  check(p.pos[0] === sq("e5") && p.pos[ARMY] === -1 && p.seen[0] && G.state.fx.ak === "7" && G.state.fx.dk === "4" && G.state.fx.r === 1 && G.state.fx.a === 0 && G.state.fx.d === ARMY && G.state.quiet === 0, "a Major attacking a Sergeant takes it and stands on its square, shown, and the attack is kept for drawing");
  G = mv(G, 1, code("j10", "j2"));
  check(positionOf(G.state).seen[ARMY + 3] === 1, "a Scout's run shows it");
  G = mv(G, 0, code("e5", "e6"));
  G = mv(G, 1, code("j2", "j1"));
  check(positionOf(G.state).pos[2] === sq("j1") && positionOf(G.state).pos[ARMY + 3] === -1 && G.state.fx.r === -1, "a Scout attacking a Miner falls, and the Miner stays");
  G = mv(G, 0, code("e6", "e7"));
  check(G.state.over && G.state.result.winner === 0 && G.state.result.why === "flag", "taking the Flag wins");
}
{
  // a side that cannot move on its turn loses
  let G = G0(build([[0, "F", "a1"], [0, "B", "a2"], [0, "B", "b1"], [0, "4", "j1"], [1, "T", "j2", "sm"], [1, "F", "a10"]], 1));
  G = mv(G, 1, code("j2", "j1"));
  check(G.state.over && G.state.result.winner === 1 && G.state.result.why === "stuck", "Red, left with a Flag and Bombs, cannot move and loses");
  const q = build([[0, "4", "a4"], [0, "F", "j1"], [1, "4", "j10"], [1, "F", "a10"]]);
  q.quiet = QUIET - 1;
  const Q = mv(G0(q), 0, code("a4", "a5"));
  check(Q.state.over && Q.state.result.winner === -1 && Q.state.result.why === "quiet", `${QUIET} moves without an attack make a draw`);
}

// ---------- what a side may know ----------
{
  let G = newRecord(rules, { seats: 2, options: {}, seed: 11, now: T });
  G = mv(G, 0, { setup: randomSetup(seeded(3)) });
  G = mv(G, 1, { setup: randomSetup(seeded(4)) });
  const rng = seeded(9);
  let leak = false, honest = true;
  for (let n = 0; n < 150 && !G.state.over; n++) {
    for (const side of [0, 1]) {
      const v = viewOf(G.state, side), p = positionOf(G.state);
      for (let id = (1 - side) * ARMY; id < (2 - side) * ARMY; id++) if (!p.seen[id] && v.p.kind[id] !== -1) leak = true;
      if (n % 15 === 0) {
        for (let k = 0; k < 20; k++) {
          const deal = sample(v, rng), cnt = Array(COUNT.length).fill(0);
          for (let id = (1 - side) * ARMY; id < (2 - side) * ARMY; id++) {
            cnt[deal[id]]++;
            if (p.seen[id] && deal[id] !== p.kind[id]) honest = false;                  // what was shown stays
            if (p.moved[id] && (deal[id] === FLAG || deal[id] === BOMB)) honest = false; // what moved is no Bomb or Flag
          }
          if (cnt.some((c, kk) => c !== COUNT[kk])) honest = false;
        }
      }
    }
    const ms = movesOf(positionOf(G.state), G.state.t, bannedOf(G.state.moves));
    G = mv(G, rules.toMove(G.state), ms[Math.floor(rng() * ms.length)]);
  }
  check(!leak, "neither side's view ever holds a kind the other side hasn't shown");
  check(honest, "every deal of the hidden pieces is a whole army, keeps what was shown, and puts no Bomb or Flag on a piece that moved");
}

// ---------- the computer, where the answer is plain ----------
{
  const pick = (s, level = "medium", seed = 1) => think(viewOf(s, s.t), level, { rng: seeded(seed) }).code;
  const base = [[0, "F", "a1"], [0, "B", "b1"], [0, "B", "a2"], [1, "F", "a10", ""], [1, "B", "b10"], [1, "B", "a9"]];
  const take = build([...base, [0, "7", "e4"], [1, "4", "e5", "sm"], [1, "9", "j7", "sm"]]);
  check(["medium", "hard"].every(l => pick(take, l) === code("e4", "e5")), "it takes a Sergeant it knows its Major beats");
  const spy = build([...base, [0, "S", "e4"], [0, "9", "h4", "s"], [1, "T", "e5", "sm"]]);
  check(["medium", "hard"].every(l => pick(spy, l) === code("e4", "e5")), "its Spy takes the Marshal beside it");
  const bomb = build([...base, [0, "5", "e4"], [0, "6", "h2"], [1, "B", "e5", "s"], [1, "3", "j8", "sm"]]);
  check(["medium", "hard"].every(l => pick(bomb, l) !== code("e4", "e5")), "it never sends a Lieutenant into a Bomb it has seen");
  const run = build([...base, [0, "9", "e4", "s"], [0, "4", "j2"], [1, "T", "e5", "sm"]]);
  check(["medium", "hard"].every(l => { const m = pick(run, l), t = m % 100; return Math.floor(m / 100) === sq("e4") && Math.abs(Math.floor(t / SIZE) - 4) + Math.abs((t % SIZE) - 4) > 1; }), "its General, shown and beside the Marshal, gets out of reach");
  // the last hidden piece of Blue's that never moved must be the Flag: every other one is shown or has moved
  const flag = build([[0, "F", "a1"], [0, "B", "b1"], [0, "B", "a2"], [0, "4", "f9"], [0, "6", "e2"], [1, "B", "e10", "s"], [1, "B", "g10", "s"], [1, "F", "f10"], [1, "5", "c8", "m"], [1, "6", "h7", "m"]]);
  check(pick(flag, "medium") === code("f9", "f10") && pick(flag, "hard") === code("f9", "f10"), "it works out where the Flag must be and takes it");
  check(LEVELS.easy.depth < LEVELS.medium.depth && LEVELS.medium.depth < LEVELS.hard.depth && LEVELS.easy.samples < LEVELS.medium.samples && LEVELS.medium.samples < LEVELS.hard.samples, "the levels look further ahead and deal more often, in order");
  const G = newRecord(rules, { seats: 2, options: {}, seed: 9, now: T });
  const set = rules.bot(G.state, 1, { level: "hard", rng: seeded(4) });
  check(validSetup(set.setup) && set.setup === G.state.pk.slice(40), "setting up, the computer puts in the army it was dealt");
}

console.log(bad ? `attaque: ${bad} failed` : "attaque: every check passed");
process.exit(bad ? 1 : 0);
