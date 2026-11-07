// Pewter (party-pewter.js), played in Node: the deal; laying and adding; the bidding (opening, raising, passing, a bid of
// everything); the turning (own stack first, a choice of stacks, a pewter, all silver); losing a coin at random and
// who starts next; elimination and the two-round win; the clock; a player who leaves; computer players, which are
// given only what a player may see (their answers are the same when the coins under others' stacks are swapped); 250
// games played at random with every coin counted at every step and every state put through the database's round trip;
// and a whole game, computer players and all, at a table on tests/party-harness.js.
import { GAMES, gameById, seeded, needOf, playable, fits } from "../party-core.js";
import pewter, { alive, onTable, WINS } from "../party-pewter.js";
import { pewterBot, knowledge, chance, PERSONAS } from "../party-pewter-bot.js";
import { roundTrip } from "./rtdb.js";
import { partyTable } from "./party-harness.js";
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const NAMES = ["Ana", "Bo", "Cy", "Di", "Ed", "Fay"], UIDS = ["a", "b", "c", "d", "e", "f"];
const people = n => UIDS.slice(0, n).map((uid, seat) => ({ uid, name: NAMES[seat], seat }));
let PL = people(4);
const H = (s, u) => s.hand?.[u] || [], K = (s, u) => s.stack?.[u] || [];
const step = (st, inputs = {}, o = {}) => {
  const r = pewter.advance(roundTrip(st), { players: o.players || PL, inputs: roundTrip(inputs) ?? {}, now: o.now ?? 0, rng: seeded(o.seed ?? 3) });
  return r ? { ...r.state, __say: r.say } : null;
};
const clean = st => { const { __say, ...s } = st; return s; };
const run = (st, inputs, o) => { const r = step(st, inputs, o); return r && clean(r); };
const total = (s, u) => H(s, u).length + K(s, u).length;
/** A table past the laying: these stacks (bottom to top), these hands, whose turn, and the rounds won. */
function rig({ stacks, hands = {}, turn = "a", wins = {}, clock = 0, n = 4 }) {
  PL = people(n);
  const s = pewter.start({ players: PL, options: { clock: String(clock) }, rng: seeded(1), now: 0 });
  delete s.say;
  s.hand = {}; s.stack = {};
  for (const p of PL) {
    if (hands[p.uid]?.length) s.hand[p.uid] = [...hands[p.uid]];
    s.stack[p.uid] = [...stacks[p.uid]];
  }
  s.wins = Object.fromEntries(PL.map(p => [p.uid, wins[p.uid] || 0]));
  s.turn = turn; s.first = turn; s.phase = "build"; s.step = "build#2"; s.n = 2; s.log = ["Rigged."];
  return roundTrip(s);
}
const S = { a: ["p", "p"], b: ["p", "b"], c: ["p"], d: ["b", "p", "p"] };
const HD = { a: ["p", "b"], c: ["p", "p"] };
/** Every coin there is: three silver and a pewter for everyone not out, wherever they are. */
const counted = (s, start) => s.seats.every(u => total(s, u) === (start?.[u] ?? 4) || total(s, u) <= (start?.[u] ?? 4))
  && s.seats.every(u => [...H(s, u), ...K(s, u)].filter(c => c === "b").length <= 1 && [...H(s, u), ...K(s, u)].filter(c => c === "p").length <= 3);

// ---------- the module and the deal ----------
{
  const g = gameById("pewter");
  check(g === pewter && GAMES.includes(pewter) && Array.isArray(g.rules) && g.rules.length >= 3 && g.blurb && g.max === 6, "Pewter is one of Party's games, for up to six");
  check(g.css === undefined || fs.existsSync(new URL(`../${g.css}`, import.meta.url)), "its stylesheet exists");
  check(needOf(g, people(2)) !== "" && /3 players/.test(needOf(g, people(2))) && needOf(g, people(3)) === "" && needOf(g, people(6)) === ""
    && needOf(g, [...people(6), { uid: "g", name: "Gus", seat: 6 }]) !== "", "three to six people; fewer or more can't start");
  check(needOf(g, people(1), { fill: "4" }) === "" && needOf(g, people(2), { fill: "5" }) === "" && /3 players/.test(needOf(g, people(1), { fill: "0" })), "computer players fill the seats: one person alone with them can play");
  check(playable("pewter")?.kind === "party" && fits(playable("pewter"), 4), "a party can play it");
  for (const n of [3, 4, 5, 6]) {
    const s = roundTrip({ ...pewter.start({ players: people(n), options: {}, rng: seeded(n), now: 0 }), say: null });
    check(s.seats.length === n && !s.bots && s.seats.every(u => H(s, u).slice().sort().join() === "b,p,p,p" && !s.stack) && s.step === "lay#1" && s.phase === "lay", `${n} players: three silver and a pewter each, nobody laid yet`);
  }
  const f = roundTrip({ ...pewter.start({ players: people(2), options: { fill: "5" }, rng: seeded(2), now: 0 }), say: null });
  check(f.seats.length === 5 && f.seats.slice(2).join() === "bot1,bot2,bot3" && Object.keys(f.bots).join() === "bot1,bot2,bot3" && f.names.bot1 === "Quant", "two people with Fill to 5: three computer players take the seats, named for Cartel's");
  const a = pewter.start({ players: people(3), options: { clock: "30" }, rng: seeded(2), now: 5000 }), b = pewter.start({ players: people(3), options: { clock: "0" }, rng: seeded(2), now: 5000 });
  check(a.deadline === 35000 && pewter.wakeAt(a) === 35000 && !b.deadline && pewter.wakeAt(b) === null, "the clock is an option");
}

// ---------- laying ----------
{
  PL = people(3);
  const s0 = roundTrip({ ...pewter.start({ players: PL, options: { clock: "0" }, rng: seeded(5), now: 0 }), say: null });
  const some = run(s0, { a: { lay: "p" }, b: { lay: "p" } });
  check(some === null, "the coins stay hidden until everyone has laid");
  check(step(s0, { a: { lay: "x" }, b: { lay: "p" }, c: { lay: "p" } }) === null, "a coin that isn't one is ignored");
  const s1 = run(s0, { a: { lay: "p" }, b: { lay: "b" }, c: { lay: "p" } });
  check(s1.phase === "build" && K(s1, "b").join() === "b" && H(s1, "b").join() === "p,p,p" && H(s1, "a").length === 3 && s1.turn === s1.first, "everyone laid: a coin each on the table, the first player to add or bid");
  const one = roundTrip({ ...s0, hand: { a: ["b"], b: ["p", "p", "p", "b"], c: ["p"] } });
  const s2 = run(one, { a: { lay: "b" }, b: { lay: "p" }, c: { lay: "p" } });
  check(step(one, { a: { lay: "p" }, b: { lay: "p" }, c: { lay: "p" } }) === null && K(s2, "a").join() === "b" && !s2.hand.a && K(s2, "c").join() === "p", "a coin they don't have in hand is ignored; a player with only the pewter lays it, and has no entry left in hand");
  const late = rig({ stacks: S, hands: HD, clock: 20 });
  late.phase = "lay"; late.step = "lay#2"; late.stack = undefined; delete late.stack;
  late.hand = { a: ["p", "b"], b: ["p", "p"], c: ["b"], d: ["p"] };
  late.deadline = 20000;
  const l = run(late, { a: { lay: "b" } }, { now: 20000 });
  check(K(l, "a").join() === "b" && K(l, "b").join() === "p" && K(l, "c").join() === "b" && K(l, "d").join() === "p", "out of time: a silver coin, or the pewter if it is all they have");
}

// ---------- adding and bidding ----------
{
  const s = rig({ stacks: S, hands: HD });
  const add = run(s, { a: { add: "b" } });
  check(K(add, "a").join() === "p,p,b" && H(add, "a").join() === "p" && add.turn === "b" && add.phase === "build" && add.step !== s.step, "adding a coin: on top of the stack, and the next player's turn");
  check(step(s, { b: { add: "p" } }) === null && step(s, { a: { add: "x" } }) === null && step(s, { c: { bid: 1 } }) === null, "out of turn, or a coin that isn't in hand, is ignored");
  check(step(s, { a: { bid: 0 } }) === null && step(s, { a: { bid: 9 } }) === null && step(s, { a: { bid: 1.5 } }) === null, "a bid of none, of more than the coins on the table (8 here), or not a whole number is ignored");
  check(onTable(s) === 8 && run(s, { a: { bid: 8 } }).phase !== "bid", "…a bid of all 8 is allowed, and closes the bidding");
  const open = run(s, { a: { bid: 2 } });
  check(open.phase === "bid" && open.bid.by === "a" && open.bid.n === 2 && open.turn === "b" && !open.passed, "opening the bidding: the bid stands, the next player to raise or pass");
  const forced = rig({ stacks: S, hands: { c: ["p"] }, turn: "a" });
  check(step(forced, { a: { add: "p" } }) === null && run(forced, { a: { bid: 3 } }).bid.n === 3, "with nothing in hand a player can only bid");
  const raise = run(open, { b: { bid: 3 } });
  check(raise.bid.by === "b" && raise.bid.n === 3 && raise.turn === "c" && raise.phase === "bid", "a raise passes the bid, and the next player answers");
  check(step(open, { b: { bid: 2 } }) === null && step(open, { b: { bid: 9 } }) === null && step(open, { c: { bid: 3 } }) === null, "a raise must be higher, within the table, from the player asked");
  const pb = run(open, { b: { pass: 1 } });
  check(pb.passed.join() === "b" && pb.turn === "c" && pb.phase === "bid", "a pass leaves the round");
  const pc = run(pb, { c: { pass: 1 } }), pd = run(pc, { d: { pass: 1 } });
  check(pc.turn === "d" && pd.phase === "flip" || pd.phase === "over" || pd.phase === "lay", "when all the others have passed the bidder turns coins");
  // round the table twice: a raise by an earlier bidder is answered by those after
  let r = open;
  r = run(r, { b: { bid: 3 } }); r = run(r, { c: { pass: 1 } }); r = run(r, { d: { pass: 1 } });
  check(r.phase === "bid" && r.turn === "a" && r.bid.by === "b", "the first bidder is asked again after a raise (and may raise or pass)");
  const done = run(r, { a: { pass: 1 } });
  check(done.bid?.by !== "a" && done.phase !== "bid", "…and when they pass, the highest bidder turns");
}

// ---------- turning ----------
{
  // a: own stack p,p then others; the top of a stack is the last coin
  const s = rig({ stacks: { a: ["p", "p"], b: ["b", "p"], c: ["p", "p"], d: ["p", "p"] }, hands: {} });
  const bidA = n => run(run(s, { a: { bid: n } }), { b: { pass: 1 } });
  let x = run(run(run(run(s, { a: { bid: 2 } }), { b: { pass: 1 } }), { c: { pass: 1 } }), { d: { pass: 1 } });
  check(x.phase === "lay" && x.wins.a === 1 && x.turn === "a" && x.first === "a" && H(x, "b").join() === "b,p" && !x.stack && !x.flip, "a bid of 2 on two silver of their own: the round won at once, the coins back in hands, the winner starts");
  x = run(run(run(run(s, { a: { bid: 3 } }), { b: { pass: 1 } }), { c: { pass: 1 } }), { d: { pass: 1 } });
  check(x.phase === "flip" && x.flip.got === 2 && x.flip.ups.a === 2 && x.bid.n === 3, "a bid of 3: their own two first, then a choice of stack");
  check(step(x, { a: { from: "a" } }) === null && step(x, { a: { from: "z" } }) === null && step(x, { b: { from: "c" } }) === null, "a stack must be another player's, and the bidder chooses");
  const c1 = run(x, { a: { from: "c" } });
  check(c1.phase === "lay" && c1.wins.a === 1 && c1.log.some(l => /silver \(3 of 3\)/.test(l)), "turning silver from a stack completes the bid");
}
{
  // the top of b's stack is the pewter: b = [p, b]
  const s = rig({ stacks: { a: ["p", "p"], b: ["p", "b"], c: ["p", "p"], d: ["p", "p"] }, hands: {} });
  let x = s;
  for (const m of [{ a: { bid: 3 } }, { b: { pass: 1 } }, { c: { pass: 1 } }, { d: { pass: 1 } }]) x = run(x, m);
  check(x.phase === "flip", "(a bid of 3 on 8 coins)");
  const hit = run(x, { a: { from: "b" } });
  check(hit.phase === "lay" && total(hit, "a") === 1 && hit.wins.a === 0 && hit.first === "a" && hit.step !== x.step && hit.log.some(l => /Ana turns Bo's lead/.test(l)) && hit.log.some(l => /loses a coin at random/.test(l)), "the pewter on top of Bo's stack: Ana loses a coin at random, the coins go back, Ana starts");
  check(["a", "b", "c", "d"].every(u => u === "a" || total(hit, u) === 2) && H(hit, "b").join() === "p,b" && !hit.stack, "…and nobody else loses anything");
  // own pewter: a = [b, p]: top silver, then the pewter under it, bids 2 turns both
  const own = rig({ stacks: { a: ["b", "p"], b: ["p"], c: ["p"], d: ["p"] }, hands: {} });
  const o = run(run(run(run(own, { a: { bid: 2 } }), { b: { pass: 1 } }), { c: { pass: 1 } }), { d: { pass: 1 } });
  check(o.log.some(l => /their own lead/.test(l)) && total(o, "a") === 1 && o.first === "a", "the bidder's own pewter under their top coin: found by turning two");
  const safe = run(run(run(run(own, { a: { bid: 1 } }), { b: { pass: 1 } }), { c: { pass: 1 } }), { d: { pass: 1 } });
  check(safe.wins.a === 1, "…but a bid of 1 turns only the silver on top");
  // a bid of everything: opens and turns with no one raising
  const all = rig({ stacks: { a: ["p"], b: ["p"], c: ["p"], d: ["b"] }, hands: {} });
  const e = run(all, { a: { bid: 4 } });
  check(e.phase === "flip" && e.flip.got === 1 || e.log.some(l => /lead/.test(l)), "a bid of every coin: no one can raise it, so it is turned at once");
}
{
  // the bidder out: the owner of the pewter starts the next round
  const lone = rig({ stacks: { a: ["p"], b: ["b"], c: ["p", "p"], d: ["p"] }, hands: {} });
  let x = run(lone, { a: { bid: 2 } });
  for (const u of ["b", "c", "d"]) x = run(x, { [u]: { pass: 1 } });
  check(x.phase === "flip", "(a bid of 2 with one coin of their own)");
  const out = run(x, { a: { from: "b" } });
  check(total(out, "a") === 0 && !alive(out).includes("a") && out.first === "b" && out.turn === "b" && out.phase === "lay" && out.log.some(l => /is out/.test(l)), "a bidder whose last coin goes is out, and the owner of the pewter starts the next round");
  check(!Object.hasOwn(out.hand || {}, "a") && alive(out).join() === "b,c,d", "…with no entry left for them in the database's lists");
  const mine = rig({ stacks: { a: ["b"], b: ["p"], c: ["p", "p"], d: ["p"] }, hands: {} });
  const own = run(mine, { a: { bid: 1 } });
  check(own.phase === "bid", "(a bid of 1 over their own pewter)");
  let y = own;
  for (const u of ["b", "c", "d"]) y = run(y, { [u]: { pass: 1 } });
  check(!alive(y).includes("a") && y.turn === "b" && y.first === "b", "a bidder put out by their own pewter: the next player starts");
}
{
  // the second round won ends the game
  const s = rig({ stacks: { a: ["p", "p"], b: ["p"], c: ["p"], d: ["p"] }, hands: {}, wins: { a: 1 } });
  const x = run(run(run(run(s, { a: { bid: 2 } }), { b: { pass: 1 } }), { c: { pass: 1 } }), { d: { pass: 1 } });
  check(x.phase === "over" && x.step === "over" && x.won === "a" && x.winners.join() === "a" && x.wins.a === WINS && !x.bid && !x.deadline, "the second round won wins the game");
  check(step(x, { a: { lay: "p" } }) === null, "…and an over game ignores everything");
  // the last one in wins: Bo has the only other coin, and it is the pewter
  const t = rig({ stacks: { a: ["p"], b: ["b"], c: ["p"], d: ["p"] }, hands: {} });
  delete t.stack.c; delete t.stack.d;
  const w = run(t, { a: { bid: 2 } });
  check(w.phase === "over" && w.won === "b" && w.winners.join() === "b" && w.log.at(-1) === "Bo is the last with any coins, and wins!", "when only one player has coins, they win");
}

// ---------- the clock, and a player who leaves ----------
{
  const s = rig({ stacks: S, hands: HD, clock: 30 });
  s.deadline = 30000;
  check(step(s, {}, { now: 29000 }) === null, "before the time is up nothing moves");
  const a = run(s, {}, { now: 30000 });
  check(K(a, "a").join() === "p,p,p" && H(a, "a").join() === "b" && a.turn === "b", "a turn out of time adds a silver coin");
  const forced = rig({ stacks: S, hands: {}, clock: 30 });
  const f = run(forced, {}, { now: 99999 });
  check(f.phase === "bid" && f.bid.n === 2 && f.bid.by === "a", "…with no coin in hand, it opens at what they have laid");
  const bidding = rig({ stacks: S, hands: HD, clock: 30 });
  let o = run(bidding, { a: { bid: 2 } }); o.deadline = 30000;
  const p = run(o, {}, { now: 30000 });
  check(p.passed?.join() === "b" && p.turn === "c", "…and in the bidding, a pass");
  const fl = rig({ stacks: { a: ["p"], b: ["p", "p"], c: ["p", "p"], d: ["p"] }, hands: {}, clock: 30 });
  let q = fl; q = run(q, { a: { bid: 4 } }); q = run(q, { b: { pass: 1 } }); q = run(q, { c: { pass: 1 } }); q = run(q, { d: { pass: 1 } });
  q.deadline = 30000;
  check(q.phase === "flip" || q.phase === "lay", "(a bid of 4 on one coin of their own)");
  if (q.phase === "flip") {
    const t = run(q, {}, { now: 30000 });
    check(t && (t.flip?.got >= 2 || t.phase === "lay"), "…and in the turning, a stack chosen at random");
  }
}
{
  const s = rig({ stacks: S, hands: HD });
  const gone = u => PL.filter(p => p.uid !== u);
  const l = run(s, {}, { players: gone("c") });
  check(!alive(l).includes("c") && l.phase === "lay" && l.turn === "a" && Object.keys(l.hand).sort().join() === "a,b,d" && !l.stack && l.log.some(x => /void/.test(x)), "someone who leaves is out, and the round is void: coins back, laid again");
  const l2 = run(rig({ stacks: S, hands: HD, turn: "c" }), {}, { players: gone("c") });
  check(l2.turn === "d" && l2.phase === "lay", "…the turn that was theirs passes to the next player");
  const alone = run(s, {}, { players: PL.filter(p => p.uid === "a") });
  check(alone.phase === "over" && alone.won === "a", "the last at the table wins");
}

// ---------- the computer players ----------
{
  const withBots = (seed, fill = 5) => roundTrip({ ...pewter.start({ players: people(2), options: { fill: String(fill), clock: "0" }, rng: seeded(seed), now: 0 }), say: null });
  let s = withBots(4);
  check(s.phase === "lay" && !s.botAt, "computer players lay at once, with the humans");
  const laidBy = run(s, { a: { lay: "p" }, b: { lay: "p" } }, { now: 0 });
  check(laidBy.phase === "build" && K(laidBy, "bot1").length === 1 && K(laidBy, "bot3").length === 1, "…and the coins go down when the people have laid");
  // a computer player's turn waits a moment, and then it moves
  let t = laidBy;
  t.turn = "bot1"; t.first = "bot1"; t.botAt = 700; t.hand.bot1 = ["p", "p", "b"];
  check(step(t, {}, { now: 100 }) === null && run(t, {}, { now: 5000 }) !== null && pewter.wakeAt(t) === 700, "a computer player's turn waits for its moment (botAt), and the game asks to be woken for it");
  // what they may see: the answer is the same whatever lies under the others' stacks
  let same = 0, differ = 0;
  const swap = (st, keep, r) => {
    const c = structuredClone(st);
    for (const u of c.seats) {
      if (u === keep) continue;
      for (const key of ["hand", "stack"]) if (c[key]?.[u]) c[key][u] = c[key][u].map(() => (r() < .5 ? "p" : "b"));
    }
    return c;
  };
  const r = seeded(77);
  for (let g = 0; g < 40; g++) {
    let st = withBots(g + 10, 4 + (g % 3));
    st = run(st, { a: { lay: "p" }, b: { lay: r() < .5 ? "p" : "b" } }, { now: 0 }) || st;
    st.botAt = 0;
    const phases = [];
    for (let k = 0; k < 40 && st.phase !== "over" && st.phase !== "lay"; k++) {
      const asked = st.phase === "flip" ? st.bid.by : st.turn;
      if (st.bots?.[asked]) {
        const mine = pewterBot(st, asked, seeded(g * 100 + k));
        const other = pewterBot(swap(st, asked, r), asked, seeded(g * 100 + k));
        if (JSON.stringify(mine) === JSON.stringify(other)) same++; else differ++;
        phases.push(st.phase);
      }
      // humans just pass, add or pick the first they can
      const inp = {};
      if (!st.bots?.[asked]) {
        if (st.phase === "build") inp[asked] = H(st, asked).length ? { add: H(st, asked)[0] } : { bid: 1 };
        else if (st.phase === "bid") inp[asked] = { pass: 1 };
        else inp[asked] = { from: alive(st).find(u => u !== asked && K(st, u).length > (st.flip?.ups?.[u] || 0)) };
      }
      const nx = step(st, inp, { now: 1e9, seed: g + k });
      if (!nx) break;
      st = clean(nx); st.botAt = 0;
    }
  }
  check(same > 60 && differ === 0, `a computer player's answer never depends on the coins it can't see (${same} answers, hidden coins swapped for others each time)`);
  const k = knowledge(roundTrip({ ...t }), "bot1");
  check(!("hand" in k) && !("stack" in k) && Object.keys(k.size).length === 5 && k.myHand.length === 3, "its knowledge holds only sizes, and its own coins");
  check(chance({ me: "x", alive: ["x", "y"], size: { x: 1, y: 3 }, myStack: ["p"] }, 1) === 1 && chance({ me: "x", alive: ["x", "y"], size: { x: 1, y: 3 }, myStack: ["b"] }, 1) === 0
    && chance({ me: "x", alive: ["x", "y"], size: { x: 1, y: 3 }, myStack: ["p"] }, 3) < 1 && chance({ me: "x", alive: ["x", "y"], size: { x: 1, y: 3 }, myStack: ["p"] }, 5) === 0, "a safe stack is a sure bid, one over a pewter never, and more than the table holds is impossible");
  const names = PERSONAS.map(p => p.name);
  check(new Set(names).size === PERSONAS.length && PERSONAS.every(p => p.need > 0 && p.need < 1), "each computer player has its own temper");
}

// ---------- 300 games at random ----------
{
  const rnd = seeded(2026);
  const one = (list, r) => list[Math.floor(r() * list.length)];
  let finished = 0, longest = 0, hits = 0, wonRounds = 0, outs = 0, ok = true, why = "";
  const fail = m => { if (ok) why = m; ok = false; };
  for (let g = 0; g < 160 && ok; g++) {
    const humans = 1 + (g % 6) % 3 + 1, fill = g % 2 ? 0 : 3 + (g % 4);
    const n = Math.max(humans, Math.min(6, fill));
    if (n < 3) { continue; }
    PL = people(humans);
    let s = roundTrip({ ...pewter.start({ players: PL, options: { clock: "0", fill: String(fill) }, rng: seeded(g + 1), now: 0 }), say: null });
    const seats = s.seats.length;
    let steps = 0, prev = s.n, now = 0;
    const seen = new Set([s.step]);
    while (s.phase !== "over" && ok && steps < 3000) {
      steps++;
      const inp = {};
      const askedFor = s.phase === "lay" ? alive(s) : [s.phase === "flip" ? s.bid.by : s.turn];
      for (const u of askedFor) {
        if (s.bots?.[u]) continue;
        const mine = H(s, u);
        if (s.phase === "lay") inp[u] = { lay: one(mine, rnd) };
        else if (s.phase === "build") inp[u] = mine.length && rnd() < .6 ? { add: one(mine, rnd) } : { bid: 1 + Math.floor(rnd() * onTable(s)) };
        else if (s.phase === "bid") inp[u] = rnd() < .5 && s.bid.n < onTable(s) ? { bid: s.bid.n + 1 + Math.floor(rnd() * (onTable(s) - s.bid.n)) } : { pass: 1 };
        else inp[u] = { from: one(alive(s).filter(v => v !== u && K(s, v).length > (s.flip.ups?.[v] || 0)), rnd) };
      }
      now += 2000;
      const r = step(s, inp, { now, seed: g * 7 + steps });
      if (!r) { fail(`game ${g}: no move from ${s.step} with ${JSON.stringify(inp)}`); break; }
      const before = s;
      s = clean(r);
      if (!(s.n > prev) && s.phase !== "over" || seen.has(s.step) && s.step !== "over") { fail(`game ${g}: step ${s.step} repeats`); break; }
      prev = s.n; seen.add(s.step);
      for (const u of s.seats) {
        const coins = [...H(s, u), ...K(s, u)];
        if (coins.filter(c => c === "b").length > 1 || coins.filter(c => c === "p").length > 3) fail(`game ${g}: ${u} holds ${coins.join()}`);
        if (coins.length > (before ? total(before, u) : 4)) fail(`game ${g}: ${u} gained a coin`);
        if (s.stack && s.phase === "lay" || s.phase === "over" && s.stack) fail(`game ${g}: coins left on the table between rounds`);
      }
      if (s.log.length > 30) fail("the log grew");
      for (const u of s.seats) if (H(s, u).length === 0 && s.hand?.[u]) fail("an empty list was kept");
      if (s.hand && !Object.keys(s.hand).length) fail("an empty object was kept");
      if (s.phase === "lay" && before.phase !== "lay") { if (before.bid) wonRounds++; }
      if (alive(s).length < alive(before).length) outs++;
      if (s.log.length && before.log.at(-1) !== s.log.at(-1) && /lead!/.test(s.log.slice(-3).join("|")) && !/lead!/.test(before.log.slice(-3).join("|"))) hits++;
    }
    if (s.phase === "over") {
      finished++; longest = Math.max(longest, steps);
      if (!(s.winners.length === 1 && s.seats.includes(s.won) && (s.wins[s.won] >= WINS || alive(s).join() === s.won))) fail(`game ${g}: the winner isn't a winner`);
      if (s.seats.length !== seats) fail("the seats changed");
    } else if (ok) fail(`game ${g} didn't end in ${steps} steps`);
  }
  check(ok && finished > 60, `${finished} random games with people and computer players, all finished (the longest ${longest} moves), every coin counted at every step and every state through the database's round trip${ok ? "" : `: ${why}`}`);
  check(hits > 100 && outs > 5, `…with plenty of pewters turned (${hits}) and players put out (${outs}) among them`);
}

// ---------- a whole game at a table ----------
{
  const t = await partyTable(["Korbi", "Mei", "Ana"]);
  check(await t.start("pewter", { clock: "0", fill: "5" }) && t.state.step === "lay#1" && t.state.seats.length === 5 && /Coins/.test(t.branch.say.text), "Party starts Coins for three, two computer players in the empty seats, and the phone says so");
  let moves = 0;
  const humanSeat = u => t.seatOf(u);
  while (t.state.step !== "over" && moves++ < 600) {
    const s = t.state;
    const asked = s.phase === "flip" ? s.bid.by : s.turn;
    if (s.phase === "lay") {
      for (const p of t.players) if (!t.branch.inputs?.[p.uid]) { await t.send(humanSeat(p.uid), { lay: H(s, p.uid)[0] }); if (t.state.step !== s.step) break; }
    } else if (s.bots?.[asked]) await t.tick(2000);
    else if (s.phase === "build") await t.send(humanSeat(asked), H(s, asked).length && s.n % 3 ? { add: H(s, asked)[0] } : { bid: 1 });
    else if (s.phase === "bid") await t.send(humanSeat(asked), { pass: 1 });
    else await t.send(humanSeat(asked), { from: alive(s).find(u => u !== asked && K(s, u).length > (s.flip.ups?.[u] || 0)) });
  }
  const winnerPid = () => t.players.find(p => p.uid === t.state.won)?.pid;
  check(t.state.step === "over" && t.state.winners.length === 1 && (!winnerPid() || t.branch.tally?.[winnerPid()] === 1), `to the end in ${moves} moves: a human winner's win is counted for the evening`);
}

console.log(bad ? `party-pewter: ${bad} problems` : "party-pewter: all fine");
if (bad) process.exitCode = 1;
