// Cabal (party-coup.js), played in Node: the deal; each action's rules (what it costs, who may challenge or block it, what
// a wrong challenge and a wrong bluff cost); the sabotage that can cost the target both cards; the exchange; the
// clock; a player who leaves; and 400 games played at random, two to six players, with every card counted at every step
// and every state put through the database's round trip. Last, a whole game at a table on tests/party-harness.js.
import { GAMES, gameById, seeded, needOf, playable, fits } from "../party-core.js";
import coup, { CARDS, ACTIONS, alive, blockers, challengers } from "../party-coup.js";
import { roundTrip } from "./rtdb.js";
import { partyTable } from "./party-harness.js";
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const NAMES = ["Ana", "Bo", "Cy", "Di", "Ed", "Fay"], UIDS = ["a", "b", "c", "d", "e", "f"];
const people = n => UIDS.slice(0, n).map((uid, seat) => ({ uid, name: NAMES[seat], seat }));
let PL = people(4);
const H = (s, u) => s.hand?.[u] || [], D = (s, u) => s.dead?.[u] || [];
/** One call of the game's advance on the state as the database would give it, or null if nothing moves. */
const step = (st, inputs = {}, o = {}) => {
  const r = coup.advance(roundTrip(st), { players: o.players || PL, inputs: roundTrip(inputs) ?? {}, now: o.now ?? 0, rng: seeded(o.seed ?? 3) });
  return r ? { ...r.state, __say: r.say } : null;
};
const clean = st => { const { __say, ...s } = st; return s; };
const run = (st, inputs, o) => { const r = step(st, inputs, o); return r && clean(r); };
/** A table with these hands (the rest of the fifteen cards in the deck), coins and whose turn. */
function rig({ hands, coins = {}, turn = "a", n = 4, clock = 0 }) {
  PL = people(n);
  const s = coup.start({ players: PL, options: { clock: String(clock) }, rng: seeded(1), now: 0 });
  delete s.say;
  const rest = CARDS.flatMap(c => Array(3).fill(c));
  for (const c of Object.values(hands).flat()) rest.splice(rest.indexOf(c), 1);
  s.hand = Object.fromEntries(PL.map(p => [p.uid, [...hands[p.uid]]]));
  s.deck = rest;
  s.coins = Object.fromEntries(PL.map(p => [p.uid, coins[p.uid] ?? 2]));
  s.turn = turn;
  s.log = ["Rigged."];
  return roundTrip(s);
}
const HANDS = { a: ["duke", "assassin"], b: ["captain", "ambassador"], c: ["contessa", "duke"], d: ["assassin", "captain"] };
/** Every card of the fifteen, wherever it is: each character three times. */
function counted(s) {
  const all = [...Object.values(s.hand || {}).flat(), ...Object.values(s.dead || {}).flat(), ...s.deck, ...(s.exch ? s.exch.drawn : [])];
  return all.length === 15 && CARDS.every(c => all.filter(x => x === c).length === 3);
}
const all = (who, v) => Object.fromEntries(who.map(u => [u, v]));
const allow = who => all(who, { c: "allow" });
const aidOk = who => all(who, { b: "allow" });

// ---------- the module and the deal ----------
{
  const g = gameById("coup");
  check(g === coup && GAMES.includes(coup) && g.min === 2 && g.max === 6 && Array.isArray(g.rules) && g.rules.length >= 4 && g.blurb, "Cabal is one of Party's games, for two to six");
  check(fs.existsSync(new URL(`../${g.css}`, import.meta.url)), "its stylesheet exists");
  check(needOf(g, people(1)) === "Cabal needs 2 players: 1 more to join" && needOf(g, people(2)) === "" && needOf(g, people(6)) === "" && needOf(g, [...people(6), { uid: "g", name: "Gus", seat: 6 }]) === "Cabal takes at most 6", "it needs two players, and takes six");
  check(playable("coup")?.kind === "party" && fits(playable("coup"), 6) && !fits(playable("coup"), 1), "a party of two to six can play it");
  check(ACTIONS.tax.claim === "duke" && ACTIONS.steal.blockedBy.join() === "captain,ambassador" && ACTIONS.aid.anyone && !ACTIONS.income.claim && !ACTIONS.coup.blockedBy, "the actions' characters and blocks");
  for (const n of [2, 3, 4, 5, 6]) {
    const s = roundTrip({ ...coup.start({ players: people(n), options: {}, rng: seeded(n), now: 0 }), say: null });
    const first = s.turn;
    check(s.seats.length === n && PL.length && s.seats.every(u => H(s, u).length === 2) && counted(s) && s.deck.length === 15 - 2 * n, `${n} players: two cards each, the rest (${15 - 2 * n}) the court deck, every character three times`);
    check(s.seats.every(u => s.coins[u] === (n === 2 && u === first ? 1 : 2)), n === 2 ? "two players: the one who starts has 1 coin, the other 2" : `${n} players: two coins each`);
  }
  const a = coup.start({ players: people(4), options: { clock: "30" }, rng: seeded(2), now: 5000 }), b = coup.start({ players: people(4), options: { clock: "0" }, rng: seeded(2), now: 5000 });
  check(a.deadline === 35000 && a.clock === 30000 && coup.wakeAt(a) === 35000 && !b.deadline && coup.wakeAt(b) === null, "the clock is an option: a deadline for the turn, or none");
  check(a.step === "turn#1" && a.phase === "turn" && /starts/.test(a.say), "it begins with the first player's turn, and says who");
}

// ---------- income, the wrong player, what can't be done ----------
{
  const s = rig({ hands: HANDS });
  const s1 = run(s, { a: { do: "income" } });
  check(s1.coins.a === 3 && s1.turn === "b" && s1.phase === "turn" && s1.step !== s.step, "Income: a coin, and the next player's turn");
  check(step(s, { b: { do: "income" } }) === null, "a player out of turn is ignored");
  check(step(s, { a: { do: "assassinate", target: "b" } }) === null && step(s, { a: { do: "coup", target: "b" } }) === null, "no Sabotage without 3 coins, no Oust without 7");
  check(step(s, { a: { do: "steal" } }) === null && step(s, { a: { do: "steal", target: "a" } }) === null && step(s, { a: { do: "steal", target: "z" } }) === null && step(s, { a: { do: "nonsense" } }) === null, "a target is needed, and not yourself, and someone in the game");
  const ten = rig({ hands: HANDS, coins: { a: 10 } });
  check(step(ten, { a: { do: "income" } }) === null && step(ten, { a: { do: "tax" } }) === null && step(ten, { a: { do: "aid" } }) === null && step(ten, { a: { do: "coup", target: "b" } }), "with 10 coins a Coup is all you may do");
  check(/must Oust a rival/.test(run(rig({ hands: HANDS, coins: { b: 11 } }), { a: { do: "income" } }) && step(rig({ hands: HANDS, coins: { b: 11 } }), { a: { do: "income" } }).__say), "…and the table says so when it's their turn");
}

// ---------- Foreign Aid: anyone with the Syndic blocks it ----------
{
  const s1 = run(rig({ hands: HANDS }), { a: { do: "aid" } });
  check(s1.phase === "block" && blockers(s1).join() === "b,c,d", "Foreign Aid: the other three may block it");
  check(step(s1, { b: { b: "allow" }, c: { b: "allow" } }) === null, "the window waits until all have answered");
  check(step(s1, { b: { b: "allow" }, c: { b: "captain" }, d: { b: "allow" } }) === null, "a block with a character that doesn't stop it isn't an answer");
  const ok = run(s1, aidOk(["b", "c", "d"]));
  check(ok.coins.a === 4 && ok.turn === "b" && ok.phase === "turn", "all allow: 2 coins");
  const blocked = run(s1, { b: { b: "allow" }, c: { b: "duke" }, d: { b: "allow" } });
  check(blocked.phase === "challenge" && blocked.claim.by === "c" && blocked.claim.on === "block" && challengers(blocked).join() === "a,b,d", "a Syndic's block can be challenged by anyone else, the one taking aid too");
  const stands = run(blocked, allow(["a", "b", "d"]));
  check(stands.coins.a === 2 && stands.turn === "b" && stands.phase === "turn", "unchallenged, the block stands: no coins");
  const first = run(s1, { b: { b: "duke" }, c: { b: "duke" }, d: { b: "allow" } });
  check(first.claim.by === "b", "two block: the one nearest the player taking aid is the block");
  // c really has the Syndic
  const c1 = run(blocked, { a: { c: "allow" }, b: { c: "allow" }, d: { c: "challenge" } });
  check(c1.phase === "lose" && c1.loser === "d" && H(c1, "c").length === 2 && counted(c1), "challenged wrongly: the challenger must lose an influence, the Syndic swapped for a new card");
  const c2 = run(c1, { d: { lose: 1 } });
  check(D(c2, "d").join() === "captain" && H(c2, "d").join() === "assassin" && c2.coins.a === 2 && c2.turn === "b" && counted(c2), "…of their choice, and the block stands");
  // b bluffs
  const bb = run(s1, { b: { b: "duke" }, c: { b: "allow" }, d: { b: "allow" } });
  const b1 = run(bb, { a: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  check(b1.phase === "lose" && b1.loser === "b" && b1.then === "caught", "a bluffed block, challenged: the bluffer loses an influence");
  const b2 = run(b1, { b: { lose: 0 } });
  check(D(b2, "b").join() === "captain" && b2.coins.a === 4 && b2.turn === "b" && b2.phase === "turn", "…and the block fails: the aid goes ahead");
}

// ---------- Tax: a claim, challenged true or false ----------
{
  const s1 = run(rig({ hands: HANDS }), { a: { do: "tax" } });
  check(s1.phase === "challenge" && s1.claim.by === "a" && s1.claim.card === "duke" && s1.claim.on === "act" && challengers(s1).join() === "b,c,d" && s1.coins.a === 2, "Tax claims the Syndic, and anyone else may challenge");
  const free = run(s1, allow(["b", "c", "d"]));
  check(free.coins.a === 5 && free.turn === "b", "unchallenged: 3 coins");
  check(step(s1, allow(["b", "c"])) === null, "the window waits for everyone…");
  const late = step(s1, { b: { c: "allow" }, c: { c: "allow" } }, { now: 1 });
  check(late === null, "…and without a clock, for ever");
  // a really has the Syndic; b and d both challenge: the one next to a speaks first
  const t1 = run(s1, { b: { c: "challenge" }, c: { c: "allow" }, d: { c: "challenge" } });
  check(t1.phase === "lose" && t1.loser === "b" && H(t1, "a").length === 2 && counted(t1), "challenged wrongly, with two challengers: the first after the player loses, and the Syndic is swapped for a card from the deck");
  const t2 = run(t1, { b: { lose: 0 } });
  check(D(t2, "b").join() === "captain" && t2.coins.a === 5 && t2.turn === "b", "…and the Tax goes ahead");
  // b bluffs Tax
  const fb = run(rig({ hands: HANDS, turn: "b" }), { b: { do: "tax" } });
  const f1 = run(fb, { a: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  check(f1.loser === "b" && f1.then === "caught", "a bluffed Tax, challenged: the bluffer loses an influence");
  const f2 = run(f1, { b: { lose: 1 } });
  check(D(f2, "b").join() === "ambassador" && f2.coins.b === 2 && f2.turn === "c" && f2.phase === "turn" && counted(f2), "…and gets no coins");
}

// ---------- Sabotage ----------
{
  const rg = o => rig({ hands: HANDS, coins: { a: 3 }, ...o });
  const s1 = run(rg(), { a: { do: "assassinate", target: "b" } });
  check(s1.coins.a === 0 && s1.claim.card === "assassin" && s1.act.paid === 3 && s1.phase === "challenge", "Sabotage: 3 coins paid at once, and the Saboteur claimed");
  const s2 = run(s1, allow(["b", "c", "d"]));
  check(s2.phase === "block" && blockers(s2).join() === "b", "unchallenged, only the target may block it");
  const s3 = run(s2, { b: { b: "allow" } });
  check(s3.phase === "lose" && s3.loser === "b" && s3.then === "next", "not blocked: the target loses an influence");
  const s4 = run(s3, { b: { lose: 1 } });
  check(D(s4, "b").join() === "ambassador" && H(s4, "b").join() === "captain" && s4.turn === "b" && s4.coins.a === 0, "…of their choice");
  // the Kontor
  const k1 = run(s2, { b: { b: "contessa" } });
  check(k1.phase === "challenge" && k1.claim.card === "contessa" && k1.claim.on === "block" && step(s2, { b: { b: "duke" } }) === null, "the Kontor blocks it (and nothing else does), and that can be challenged");
  const k2 = run(k1, allow(["a", "c", "d"]));
  check(k2.phase === "turn" && k2.turn === "b" && H(k2, "b").length === 2 && k2.coins.a === 0, "unchallenged: the target lives, and the 3 coins are gone");
  // b has no Kontor: challenged, loses both
  const k3 = run(k1, { a: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  check(k3.phase === "lose" && k3.loser === "b" && k3.then === "caught", "a bluffed Kontor, challenged: the bluffer loses an influence…");
  const k4 = run(k3, { b: { lose: 0 } });
  check(D(k4, "b").length === 2 && H(k4, "b").length === 0 && alive(k4).join() === "a,c,d" && k4.turn === "c" && counted(k4), "…and the sabotage goes ahead: both cards gone, out of the game");
  // a bluffs the Saboteur
  const bl = run(rig({ hands: HANDS, coins: { b: 3 }, turn: "b" }), { b: { do: "assassinate", target: "a" } });
  const bl1 = run(bl, { c: { c: "challenge" }, a: { c: "allow" }, d: { c: "allow" } });
  check(bl1.loser === "b" && bl1.coins.b === 0, "a bluffed Saboteur: caught…");
  const bl2 = run(bl1, { b: { lose: 0 } });
  check(bl2.coins.b === 3 && bl2.turn === "c" && H(bl2, "a").length === 2 && D(bl2, "b").join() === "captain", "…the 3 coins come back, and nobody is hurt");
  // a really has it: the target challenges and loses both
  const dk = run(s1, { b: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  check(dk.loser === "b" && dk.then === "stood", "challenged wrongly by the target: they lose an influence");
  const dk2 = run(dk, { b: { lose: 0 } });
  check(dk2.phase === "block" && blockers(dk2).join() === "b", "…and can still block");
  const dk3 = run(dk2, { b: { b: "allow" } });
  check(H(dk3, "b").length === 0 && D(dk3, "b").length === 2 && alive(dk3).join() === "a,c,d" && dk3.turn === "c", "…not blocking, they lose the other too");
  // the target has one card: challenging wrongly is the end of them
  const lone = rig({ hands: { ...HANDS, b: ["captain"] }, coins: { a: 3 } });
  const l1 = run(lone, { a: { do: "assassinate", target: "b" } });
  const l2 = run(l1, { b: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  check(H(l2, "b").length === 0 && D(l2, "b").join() === "captain" && l2.turn === "c" && l2.phase === "turn" && l2.coins.a === 0, "a lone card lost to a wrong challenge: out at once, and the saboteuration has nobody left to hit");
}

// ---------- Steal ----------
{
  const rg = o => rig({ hands: HANDS, turn: "b", ...o });
  const s1 = run(rg(), { b: { do: "steal", target: "c" } });
  const s2 = run(s1, allow(["a", "c", "d"]));
  check(s2.phase === "block" && blockers(s2).join() === "c" && ACTIONS.steal.blockedBy.length === 2, "Steal: challenged first, then the target may block");
  const s3 = run(s2, { c: { b: "allow" } });
  check(s3.coins.b === 4 && s3.coins.c === 0 && s3.turn === "c", "it takes 2 coins");
  const one = run(run(run(rg({ coins: { c: 1 } }), { b: { do: "steal", target: "c" } }), allow(["a", "c", "d"])), { c: { b: "allow" } });
  const none = run(run(run(rg({ coins: { c: 0 } }), { b: { do: "steal", target: "c" } }), allow(["a", "c", "d"])), { c: { b: "allow" } });
  check(one.coins.b === 3 && one.coins.c === 0 && none.coins.b === 2 && none.coins.c === 0, "…or what the target has: 1, or none");
  check(step(s2, { c: { b: "duke" } }) === null && step(s2, { c: { b: "contessa" } }) === null, "only the Privateer or the Astronomer stops it");
  const blk = run(s2, { c: { b: "ambassador" } });
  check(blk.phase === "challenge" && blk.claim.by === "c" && blk.claim.card === "ambassador", "a block with the Astronomer");
  const stand = run(blk, allow(["a", "b", "d"]));
  check(stand.coins.b === 2 && stand.coins.c === 2 && stand.turn === "c", "unchallenged, nothing is taken");
  const caught = run(run(blk, { b: { c: "challenge" }, a: { c: "allow" }, d: { c: "allow" } }), { c: { lose: 0 } });
  check(D(caught, "c").join() === "contessa" && caught.coins.b === 4 && caught.coins.c === 0, "c has no Astronomer: caught, and the steal goes ahead");
  // b really has the Privateer; a challenges and loses
  const c1 = run(s1, { a: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  check(c1.loser === "a" && c1.then === "stood", "challenged wrongly: the challenger loses an influence, then the steal goes on");
  // the Privateer blocks a steal as the Astronomer does: the target claims it, whether or not they hold one, and whoever was stolen from (or anyone else) may challenge the block
  const cb = run(s2, { c: { b: "captain" } });
  check(cb.phase === "challenge" && cb.claim.by === "c" && cb.claim.card === "captain" && cb.claim.on === "block", "a block with the Privateer, claimed against a Privateer's steal");
  const bluff = run(cb, { b: { c: "challenge" }, a: { c: "allow" }, d: { c: "allow" } });
  check(bluff.phase === "lose" && bluff.loser === "c" && bluff.then === "caught", "c has no Privateer and b, who stole, challenges the block: caught");
  const bluffEnd = run(bluff, { c: { lose: 0 } });
  check(D(bluffEnd, "c").join() === "contessa" && bluffEnd.coins.b === 4 && bluffEnd.coins.c === 0 && bluffEnd.turn === "c" && counted(bluffEnd), "…c loses an influence and the steal goes ahead");
  const other = run(cb, { a: { c: "challenge" }, b: { c: "allow" }, d: { c: "allow" } });
  check(other.loser === "c" && other.then === "caught", "a player other than the one who stole may challenge the block too");
  const real = rg({ hands: { ...HANDS, c: ["captain", "duke"] } });
  const r3 = run(run(run(run(real, { b: { do: "steal", target: "c" } }), allow(["a", "c", "d"])), { c: { b: "captain" } }), { b: { c: "challenge" }, a: { c: "allow" }, d: { c: "allow" } });
  check(r3.phase === "lose" && r3.loser === "b" && r3.then === "stood" && H(r3, "c").length === 2 && counted(r3), "c does hold the Privateer: shown, b who challenged loses an influence, and c takes a fresh card for it");
  const r4 = run(r3, { b: { lose: 0 } });
  check(r4.coins.b === 2 && r4.coins.c === 2 && r4.turn === "c" && D(r4, "b").length === 1 && counted(r4), "…and the steal is blocked: nothing is taken");
  const quiet = run(cb, allow(["a", "b", "d"]));
  check(quiet.coins.b === 2 && quiet.coins.c === 2 && quiet.turn === "c" && D(quiet, "c").length === 0, "an unchallenged Privateer block stands, bluff or not");
}

// ---------- Exchange ----------
{
  const s1 = run(rig({ hands: HANDS, turn: "b" }), { b: { do: "exchange" } });
  const s2 = run(s1, allow(["a", "c", "d"]));
  check(s2.phase === "exchange" && s2.exch.drawn.length === 2 && s2.deck.length === 5 && counted(s2), "Exchange: the Astronomer claimed, then two cards drawn from the deck");
  check(step(s2, { b: { keep: [0] } }) === null && step(s2, { b: { keep: [0, 0] } }) === null && step(s2, { b: { keep: [0, 9] } }) === null && step(s2, { a: { keep: [0, 1] } }) === null, "keep as many as you hold: no more, no fewer, no repeats, nothing out of range, and only the one exchanging");
  const pool = [...H(s2, "b"), ...s2.exch.drawn];
  const s3 = run(s2, { b: { keep: [1, 3] } });
  check(H(s3, "b").join() === [pool[1], pool[3]].join() && s3.deck.length === 7 && s3.turn === "c" && !s3.exch && counted(s3), "the two chosen are kept, the rest shuffled into the deck");
  const l2 = run(run(rig({ hands: { ...HANDS, b: ["captain"] }, turn: "b" }), { b: { do: "exchange" } }), allow(["a", "c", "d"]));
  check(l2.phase === "exchange" && Object.values(l2.hand.b).length === 1, "with one card left, it's one to keep of three");
  const l3 = run(l2, { b: { keep: [2] } });
  check(H(l3, "b").length === 1 && H(l3, "b")[0] === [...H(l2, "b"), ...l2.exch.drawn][2] && counted(l3), "…and one kept");
}

// ---------- Oust ----------
{
  const s1 = run(rig({ hands: HANDS, coins: { a: 7 } }), { a: { do: "coup", target: "d" } });
  check(s1.coins.a === 0 && s1.phase === "lose" && s1.loser === "d" && s1.then === "next", "Oust: 7 coins, and the player loses an influence at once: it can't be challenged or blocked");
  const s2 = run(s1, { d: { lose: 0 } });
  check(D(s2, "d").join() === "assassin" && s2.turn === "b", "…their choice");
  const one = run(rig({ hands: { ...HANDS, d: ["assassin"] }, coins: { a: 7 } }), { a: { do: "coup", target: "d" } });
  check(one.phase === "turn" && H(one, "d").length === 0 && D(one, "d").join() === "assassin" && alive(one).join() === "a,b,c" && one.coins.d === 0, "a player's last card needs no choosing: they're out");
  const s3 = step(s1, { d: { lose: 5 } });
  check(s3 === null, "a card that isn't theirs isn't a choice");
  const some = run(rig({ hands: HANDS, coins: { a: 7 } }), { a: { do: "coup", target: "d" } });
  check(run(some, { d: { lose: 0 } }).phase === "turn", "an Oust that ends nothing passes the turn");
}

// ---------- a game to the end: two players, then the win ----------
{
  PL = people(2);
  let s = roundTrip({ ...coup.start({ players: PL, options: {}, rng: seeded(9), now: 0 }), say: null });
  const first = s.turn, second = first === "a" ? "b" : "a";
  s.hand = { a: ["duke", "captain"], b: ["contessa"] };
  s.deck = CARDS.flatMap(c => Array(3).fill(c)); for (const c of ["duke", "captain", "contessa"]) s.deck.splice(s.deck.indexOf(c), 1);
  s.coins = { a: 7, b: 3 }; s.turn = "a";
  s = roundTrip(s);
  const t1 = run(s, { a: { do: "coup", target: "b" } });
  check(t1.phase === "over" && t1.won === "a" && t1.winners.join() === "a" && t1.step === "over" && /wins/.test(t1.log.at(-1)), "the last player with influence wins, and the game is over with its winners named");
  check(step(t1, { a: { do: "income" } }) === null && coup.wakeAt(t1) === null && first && second, "an ended game does nothing more");
}

// ---------- the clock ----------
{
  const s = rig({ hands: HANDS, clock: 30 });
  s.deadline = 31000;
  check(run(s, {}, { now: 30999 }) === null && coup.wakeAt(s) === 31000, "before the deadline nothing moves");
  const t = run(s, {}, { now: 31000 });
  check(t.coins.a === 3 && t.turn === "b" && t.deadline === 61000, "a turn that runs out is Income, and the next player has a new 30 seconds");
  const ten = rig({ hands: HANDS, coins: { a: 10 }, clock: 30 }); ten.deadline = 31000;
  const tc = run(ten, {}, { now: 31000 });
  check(tc.coins.a === 3 && tc.phase === "lose" && tc.loser !== "a", "…or, with 10 coins, an Oust on someone else");
  const c = run(rig({ hands: HANDS, clock: 30 }), { a: { do: "tax" } }, { now: 0 });
  c.deadline = 30000;
  const late = run(c, { b: { c: "challenge" }, c: { c: "allow" } }, { now: 30000 });
  check(late.phase === "lose" && late.loser === "b", "a challenge window that runs out counts the answers it has: a challenge stands (and d's silence is an allow)");
  const silent = run(c, {}, { now: 30000 });
  check(silent.coins.a === 5 && silent.turn === "b", "…with none, the claim stands");
  const lz = run(c, { b: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } });
  lz.deadline = 60000;
  const forced = run(lz, {}, { now: 60000 });
  check(forced && forced.phase === "turn" && H(forced, "b").length === 1 && D(forced, "b").length === 1 && counted(forced), "a loser who doesn't choose in time loses one at random");
  const ex = run(run(rig({ hands: HANDS, turn: "b", clock: 30 }), { b: { do: "exchange" } }), allow(["a", "c", "d"]));
  ex.deadline = 30000;
  const kept = run(ex, {}, { now: 30000 });
  check(kept.phase === "turn" && H(kept, "b").join() === HANDS.b.join() && counted(kept), "an exchange that runs out keeps the cards you held");
}

// ---------- a player who leaves ----------
{
  const s = rig({ hands: HANDS });
  const gone = u => PL.filter(p => p.uid !== u);
  const l1 = run(s, {}, { players: gone("a") });
  check(l1.turn === "b" && D(l1, "a").join() === "duke,assassin" && H(l1, "a").length === 0 && alive(l1).join() === "b,c,d" && l1.phase === "turn", "someone who leaves the table is out, their cards face up, and a turn that was theirs passes");
  const w = run(s, { a: { do: "tax" } });
  const l2 = run(w, allow(["b", "c"]), { players: gone("d") });
  check(l2.coins.a === 5 && l2.turn === "b" && !alive(l2).includes("d"), "one who leaves from a window no longer holds it up");
  const l3 = run(w, {}, { players: gone("a") });
  check(l3.phase === "turn" && l3.turn === "b" && l3.coins.a === 0 && l3.coins.b === 2, "the player whose claim it was leaving: the turn is dropped");
  const lz = run(run(w, { b: { c: "challenge" }, c: { c: "allow" }, d: { c: "allow" } }), {}, { players: gone("b") });
  check(lz.phase === "turn" && lz.turn === "c" && lz.coins.a === 5 && !alive(lz).includes("b"), "a loser who leaves is out, and the game goes on (the Tax too)");
  const two = rig({ hands: HANDS, n: 2, turn: "a" });
  two.hand = { a: HANDS.a, b: HANDS.b };
  const alone = run(two, {}, { players: PL.filter(p => p.uid === "a") });
  check(alone.phase === "over" && alone.won === "a", "the last at the table wins");
}

// ---------- 400 games at random ----------
{
  const rnd = seeded(2026);
  const one = (list, r) => list[Math.floor(r() * list.length)];
  let finished = 0, longest = 0, challenged = 0, exchanges = 0, ok = true, why = "";
  const fail = m => { if (ok) why = m; ok = false; };
  for (let g = 0; g < 400 && ok; g++) {
    const n = 2 + (g % 5);
    PL = people(n);
    let s = roundTrip({ ...coup.start({ players: PL, options: { clock: "0" }, rng: seeded(g + 1), now: 0 }), say: null });
    let steps = 0, prev = s.n, seenSteps = new Set([s.step]);
    while (s.phase !== "over" && ok && steps < 4000) {
      steps++;
      const inp = {};
      if (s.phase === "turn") {
        const u = s.turn, coins = s.coins[u], others = alive(s).filter(x => x !== u);
        const options = coins >= 10 ? ["coup"] : Object.keys(ACTIONS).filter(k => !ACTIONS[k].cost || coins >= ACTIONS[k].cost);
        const kind = one(options, rnd);
        inp[u] = { do: kind, ...(ACTIONS[kind].target ? { target: one(others, rnd) } : {}) };
      } else if (s.phase === "challenge") {
        for (const u of challengers(s)) inp[u] = { c: rnd() < 0.3 ? "challenge" : "allow" };
      } else if (s.phase === "block") {
        for (const u of blockers(s)) inp[u] = { b: rnd() < 0.35 ? one(ACTIONS[s.act.kind].blockedBy, rnd) : "allow" };
      } else if (s.phase === "lose") {
        inp[s.loser] = { lose: Math.floor(rnd() * H(s, s.loser).length) };
      } else if (s.phase === "exchange") {
        const by = s.act.by, k = H(s, by).length, pool = k + 2, idx = [...Array(pool).keys()].sort(() => rnd() - 0.5).slice(0, k);
        inp[by] = { keep: idx };
        exchanges++;
      } else { fail(`unknown phase ${s.phase}`); break; }
      const r = step(s, inp);
      if (!r) { fail(`game ${g}: no move from ${s.step} with ${JSON.stringify(inp)}`); break; }
      const before = s;
      s = clean(r);
      if (!(s.n > prev) || seenSteps.has(s.step)) { fail(`game ${g}: step ${s.step} repeats`); break; }
      prev = s.n; seenSteps.add(s.step);
      if (!counted(s)) { fail(`game ${g}: the cards no longer add up at ${s.step}`); break; }
      for (const u of s.seats) {
        if (H(s, u).length + D(s, u).length !== 2) fail(`game ${g}: ${u} has ${H(s, u).length} and ${D(s, u).length} face up`);
        if (!(s.coins[u] >= 0) || (H(s, u).length === 0 && s.coins[u] !== 0)) fail(`game ${g}: coins ${s.coins[u]} for ${u}`);
      }
      if (s.log.length > 30) fail("the log grew");
      if (s.phase === "lose" && before.phase === "challenge") challenged++;
      if (s.phase === "turn" && !alive(s).includes(s.turn)) fail(`game ${g}: the turn is a dead player's`);
    }
    if (s.phase === "over") {
      finished++; longest = Math.max(longest, steps);
      if (!(s.winners.length === 1 && alive(s).join() === s.won)) fail(`game ${g}: the winner isn't the one left`);
    } else if (ok) fail(`game ${g} didn't end in ${steps} steps`);
  }
  check(ok && finished === 400, `400 random games, two to six players, all finished (the longest ${longest} moves), the fifteen cards counted at every step and every state through the database's round trip${ok ? "" : `: ${why}`}`);
  check(challenged > 100 && exchanges > 100, `…with plenty of challenges (${challenged}) and exchanges (${exchanges}) among them`);
}

// ---------- a whole game at a table ----------
{
  const t = await partyTable(["Korbi", "Mei", "Ana"]);
  check(await t.start("coup", { clock: "0" }) && t.state.step === "turn#1" && t.state.seats.length === 3 && /starts/.test(t.branch.say.text), "Party starts Coup for three, and the phone says who starts");
  const who = () => t.seatOf(t.state.turn);
  const winnerPid = () => t.players.find(p => p.uid === t.state.won)?.pid;
  let turns = 0;
  while (t.state.step !== "over" && turns++ < 200) {
    const s = t.state;
    if (s.phase === "turn") {
      const u = s.turn, others = alive(s).filter(x => x !== u);
      await t.send(who(), s.coins[u] >= 7 ? { do: "coup", target: others[0] } : { do: "income" });
    } else if (s.phase === "lose") await t.send(t.seatOf(s.loser), { lose: 0 });
    else throw new Error(`unexpected ${s.phase}`);
  }
  check(t.state.step === "over" && t.state.winners.length === 1 && t.branch.tally?.[winnerPid()] === 1, `to the end in ${turns} moves: the winner's win is counted for the evening`);
}

console.log(bad ? `party-coup: ${bad} problems` : "party-coup: all fine");
if (bad) process.exitCode = 1;
