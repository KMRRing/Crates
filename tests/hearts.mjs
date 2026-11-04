// Hearts (hearts-rules.js, hearts-bot.js): the deal and the pass in its four directions (the fourth none), the 2♣ lead, following
// suit, no points on the first trick, hearts led only once broken, the trick and who leads next, a hand's points, shooting the
// moon both ways, the end of the game (and a tie for the lead playing on), the state through the database, whole games of
// computer players at every strength with every move checked against a rulebook written out again here, and the strengths
// against each other.
import { readFileSync } from "node:fs";
import { rules, legalCards, whyNot, handResult, trickWinner, pointsOf, cardName, RANKS, SUITS, TRICK_MS, SHOW_MS, QUEEN_SPADES, TWO_CLUBS, byHand } from "../hearts-rules.js";
import { botMove, passCards } from "../hearts-bot.js";
import { newRecord, applyMove, applyWake, seeded, createRunner } from "../seats.js";
import { createTable } from "../table.js";
import { fakeDb } from "./fake-db.js";
import { roundTrip, same } from "./rtdb.js";

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(pred, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (pred()) return true; await sleep(5); } return pred(); }

let bad = 0;
const ok = (yes, what) => { console.log(`${yes ? "ok  " : "FAIL"} ${what}`); if (!yes) bad++; };
const C = name => { const r = RANKS.indexOf(name.slice(0, -1)), s = SUITS.indexOf(name.slice(-1)); if (r < 0 || s < 0) throw new Error(name); return r * 4 + s; };
const H = s => (s ? s.split(" ").map(C) : []);
const must = (r, what) => { if (r.error) throw new Error(`${what}: ${r.error}`); return r.G; };
const R = (seed = 1, options = {}) => newRecord(rules, { seats: 4, options, seed, now: 0 });

// ---------- the cards ----------
ok(QUEEN_SPADES === C("Q♠") && TWO_CLUBS === C("2♣"), "the Q♠ and the 2♣ are where the rules say");
ok(Array.from({ length: 52 }, (_, i) => pointsOf(i)).reduce((a, b) => a + b, 0) === 26 && pointsOf(C("Q♠")) === 13 && pointsOf(C("A♥")) === 1 && pointsOf(C("K♠")) === 0, "a deck holds 26 points: a heart each, the Q♠ thirteen");

// ---------- the deal and the pass ----------
{
  const G = R(3), s = G.state;
  ok(s.hands.every(h => h.length === 13) && new Set(s.hands.flat()).size === 52, "four hands of thirteen, every card dealt once");
  ok(s.hands.every(h => [...h].sort(byHand).join() === h.join()), "each hand is held in order: spades, hearts, clubs, diamonds, low to high");
  ok(s.step === "pass" && s.dir === "left" && rules.toMove(s) === 0, "the first hand passes left, seat 0 first to choose");
  ok(/Pass three/.test(applyMove(rules, G, 0, { t: "give", cards: s.hands[0].slice(0, 2) }).error || ""), "two cards aren't a pass");
  ok(/aren't your cards/.test(applyMove(rules, G, 0, { t: "give", cards: [s.hands[1][0], s.hands[1][1], s.hands[1][2]] }).error || ""), "another seat's cards can't be passed");
  ok(/Pass three/.test(applyMove(rules, G, 0, { t: "give", cards: [s.hands[0][0], s.hands[0][0], s.hands[0][1]] }).error || ""), "one card three times isn't a pass");
  ok(/Play a card/.test(applyMove(rules, G, 0, { t: "play", card: TWO_CLUBS }).error || "") || /Not now/.test(applyMove(rules, G, 0, { t: "play", card: TWO_CLUBS }).error || ""), "no card is played before the pass is done");
}
/** A game played on by Easy until it's the nth hand's turn to pass (or to play, when it's held). */
function toHand(n, seed) {
  let G = R(seed), now = 0;
  const rng = seeded(seed);
  while (G.state.deal < n) {
    const who = rules.toMove(G.state);
    if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
    G = must(applyMove(rules, G, who, botMove(G.state, who, { level: "easy", rng }), now), "play");
  }
  return G;
}
for (const [n, dir, to] of [[1, "left", i => (i + 1) % 4], [2, "right", i => (i + 3) % 4], [3, "across", i => (i + 2) % 4]]) {
  let G = toHand(n, 40 + n);
  ok(G.state.dir === dir && G.state.step === "pass", `hand ${n} passes ${dir}`);
  const before = G.state.hands.map(h => [...h]);
  // the others choose before the first seat: anyone may, whoever's turn it is
  const gave = [];
  for (const seat of [2, 0, 3, 1]) {
    const cards = before[seat].slice(seat, seat + 3);
    gave[seat] = cards;
    G = must(applyMove(rules, G, seat, { t: "give", cards }), `pass ${dir}`);
  }
  const s = G.state;
  ok(s.step === "play" && s.hands.every(h => h.length === 13), `pass ${dir}: three cards each way, thirteen left`);
  ok([0, 1, 2, 3].every(i => gave[i].every(c => s.hands[to(i)].includes(c) && !s.hands[i].includes(c)) && s.recv[to(i)].join() === gave[i].join()), `pass ${dir}: each seat's three arrive at the ${dir === "left" ? "next seat" : dir === "right" ? "seat before" : "seat across"}`);
  ok(s.hands[s.turn].includes(TWO_CLUBS) && s.turn === s.hands.findIndex(h => h.includes(TWO_CLUBS)), `pass ${dir}: the holder of the 2♣ leads, wherever it went`);
}
{
  // the fourth hand is held: no pass, straight to the 2♣
  const G = toHand(4, 44), s = G.state;
  ok(s.dir === "hold" && s.step === "play" && s.hands[s.turn].includes(TWO_CLUBS) && s.recv.every(x => !x.length) && s.hands.every(h => h.length === 13), "the fourth hand is held: no pass, the 2♣ leads at once");
  const five = toHand(5, 44);
  ok(five.state.dir === "left" && five.state.step === "pass", "and the fifth passes left again");
}

// ---------- the play: a table made by hand ----------
/** A hand in play: hands as strings per seat, with what else to set. */
const table = (hands, o = {}) => {
  const base = rules.deal({ seats: 4, options: o.opts || {}, rng: seeded(2) });
  const s = {
    ...base, step: "play", dir: "hold", give: [[], [], [], []], recv: [[], [], [], []], hands: hands.map(H), took: (o.took || ["", "", "", ""]).map(H), won: [0, 0, 0, 0],
    voids: [0, 0, 0, 0], played: H(o.played || ""), done: o.done ?? 1, broken: !!o.broken, trick: { plays: (o.trick || []).map(([seat, c]) => ({ seat, card: C(c) })), lead: o.turn ?? 0 },
    turn: o.turn ?? 0, scores: o.scores || [0, 0, 0, 0], deal: o.deal ?? 4, log: [],
  };
  s.played.push(...s.trick.plays.map(p => p.card));
  return { seq: 1, seed: 7, n: 0, seats: 4, options: {}, state: s, started: 0 };
};
const play = (G, seat, name, now = 0) => applyMove(rules, G, seat, { t: "play", card: C(name) }, now);

{
  // the first trick: the 2♣ is led, and only it
  const G = table(["2♣ 5♣ K♥ 7♠", "3♣ Q♥ 9♦ 4♠", "4♣ A♥ 2♦ 5♠", "6♣ 3♥ 8♦ 6♠"], { done: 0, turn: 0 });
  ok(/Lead the 2♣/.test(play(G, 0, "5♣").error || "") && !play(G, 0, "2♣").error, "the first lead is the 2♣");
  const G1 = must(play(G, 0, "2♣"), "lead");
  ok(G1.state.turn === 1, "then the next seat plays");
  ok(/Follow suit/.test(play(G1, 1, "9♦").error || "") && /Follow suit: play a club/.test(play(G1, 1, "Q♥").error || ""), "a club must follow the club led");
}
{
  // void in clubs on the first trick: nothing with points while there's another card
  const G = table(["2♣ 5♣ K♥ 7♠", "Q♥ 9♦ 4♠ Q♠", "4♣ A♥ 2♦ 5♠", "6♣ 3♥ 8♦ 6♠"], { done: 0, turn: 0 });
  const G1 = must(play(G, 0, "2♣"), "lead");
  ok(/No points on the first trick/.test(play(G1, 1, "Q♥").error || "") && /No points on the first trick/.test(play(G1, 1, "Q♠").error || "") && !play(G1, 1, "9♦").error && !play(G1, 1, "4♠").error, "void in clubs on the first trick: no heart, no Q♠, while there's another card");
  const allPoints = table(["2♣ 5♣", "Q♥ A♥ Q♠", "4♣ 5♠", "6♣ 8♦"], { done: 0, turn: 0 });
  const A = must(play(allPoints, 0, "2♣"), "lead");
  ok(legalCards(A.state, 1).length === 3 && !play(A, 1, "Q♠").error, "a hand of nothing but points may play them on the first trick");
}
{
  // hearts: not led until broken, unless there's nothing else
  const G = table(["K♥ 5♣ 7♠", "Q♥ 9♦", "A♥ 2♦", "3♥ 8♦"], { done: 2, turn: 0 });
  ok(/Hearts aren't broken/.test(play(G, 0, "K♥").error || "") && !play(G, 0, "5♣").error, "hearts can't be led until one's been played");
  const only = table(["K♥ Q♥", "Q♣ 9♦", "A♣ 2♦", "3♣ 8♦"], { done: 2, turn: 0 });
  ok(!play(only, 0, "K♥").error, "a hand of hearts alone may lead one");
  const broken = table(["K♥ 5♣ 7♠", "Q♥ 9♦", "A♥ 2♦", "3♥ 8♦"], { done: 2, turn: 0, broken: true });
  ok(!play(broken, 0, "K♥").error, "once broken, a heart may be led");
  // a heart thrown on a trick breaks them
  const d = table(["5♣ 7♠ K♥", "Q♥ 9♦", "A♣ 2♦", "3♣ 8♦"], { done: 2, turn: 0 });
  const D = must(play(must(play(d, 0, "5♣"), "a"), 1, "Q♥"), "b");
  ok(D.state.broken && d.state.broken === false, "a heart thrown on a trick breaks hearts (the Q♠ alone doesn't)");
  const q = table(["5♣ 7♠ K♥", "Q♠ 9♦", "A♣ 2♦", "3♣ 8♦"], { done: 2, turn: 0 });
  ok(!must(play(must(play(q, 0, "5♣"), "a"), 1, "Q♠"), "b").state.broken, "the Q♠ alone doesn't break hearts");
  ok(whyNot(G.state, 0, C("3♥")) === "That isn't your card", "a card you don't hold isn't yours to play");
}
{
  // a trick: highest of the suit led, the points to the winner, who leads next
  let G = table(["5♣ K♠", "9♣ 4♠", "A♣ 2♠", "Q♠ 3♥"], { done: 1, turn: 0 });
  G = must(play(G, 0, "5♣"), "1"); G = must(play(G, 1, "9♣"), "2"); G = must(play(G, 2, "A♣"), "3"); G = must(play(G, 3, "Q♠"), "4");
  ok(G.state.step === "trick" && rules.toMove(G.state) === null && G.state.until === TRICK_MS && !applyWake(rules, G, TRICK_MS - 1), "the fourth card shows the trick for a moment");
  ok(trickWinner(G.state.trick.plays) === 2, "the A♣ takes it: the Q♠ of another suit doesn't");
  const W = applyWake(rules, G, TRICK_MS);
  ok(W.state.step === "play" && W.state.turn === 2 && W.state.took[2].join() === String(C("Q♠")) && W.state.done === 2 && W.state.won[2] === 1, "the winner takes the Q♠ and leads next");
  ok(W.state.voids[3] === 1 << 1 && W.state.voids[0] === 0, "a seat that didn't follow is known to be out of the suit");
}

// ---------- a hand's points, the moon, the end ----------
/** The last trick of a hand, for the moon: seat 0 has taken all but the last heart and leads it. */
const lastTrick = (o = {}) => {
  const hearts = "2♥ 3♥ 4♥ 5♥ 6♥ 7♥ 8♥ 9♥ 10♥ J♥ Q♥ K♥ A♥".split(" ");
  return table(["A♥", "2♦", "3♦", "4♦"], { done: 12, turn: 0, broken: true, took: [`Q♠ ${hearts.slice(0, 12).join(" ")}`, "", "", ""], ...o });
};
const finish = G => { let g = G; for (const [seat, c] of [[0, "A♥"], [1, "2♦"], [2, "3♦"], [3, "4♦"]]) g = must(play(g, seat, c), c); return applyWake(rules, g, TRICK_MS); };
{
  const done = finish(lastTrick({ scores: [10, 20, 30, 40] }));
  ok(done.state.result.moon === 0 && done.state.result.pts.join() === "26,0,0,0", "all twenty-six points: the moon is shot");
  ok(done.state.scores.join() === "10,46,56,66" && done.state.step === "shown" && done.state.until === TRICK_MS + SHOW_MS, "the shooter scores nothing and the others 26 each");
  const sub = finish(lastTrick({ scores: [10, 20, 30, 40], opts: { moon: "sub" } }));
  ok(sub.state.scores.join() === "-16,20,30,40", "or, in the menu, 26 off the shooter's own score");
  const normal = table(["A♣", "2♣", "3♣", "4♣"], { done: 12, turn: 0, took: ["10♥ J♥", "Q♠", "2♥ 3♥ 4♥ 5♥ 6♥", "7♥ 8♥ 9♥ Q♥ K♥ A♥"] });
  let g = normal; for (const [seat, c] of [[0, "A♣"], [1, "2♣"], [2, "3♣"], [3, "4♣"]]) g = must(play(g, seat, c), c);
  const e = applyWake(rules, g, TRICK_MS).state;
  ok(e.result.pts.join() === "2,13,5,6" && e.result.moon === -1 && e.scores.join() === "2,13,5,6", "an ordinary hand: each seat's points, a heart one and the Q♠ thirteen");
  ok(e.log.length === 1 && e.log[0].delta.join() === "2,13,5,6", "the hand is logged");
}
{
  // the game ends when someone reaches the target; the lowest score wins
  const end = finish(lastTrick({ scores: [0, 80, 90, 95] }));
  ok(end.state.step === "over" && end.state.winners.join() === "0" && rules.over(end.state), "past 100, the game is over and the lowest score has won");
  const to50 = finish(lastTrick({ scores: [0, 10, 20, 30], opts: { to: 50 } }));
  ok(to50.state.step === "over", "the target is the menu's: 50 ends it sooner");
  // a tie for the lowest plays on
  const nine = table(["A♣", "2♣", "3♣", "4♣"], { done: 12, turn: 0, took: ["", "", "Q♠", "2♥ 3♥ 4♥ 5♥ 6♥ 7♥ 8♥ 9♥ 10♥ J♥ Q♥ K♥ A♥"], scores: [95, 95, 90, 90] });
  let g = nine; for (const [seat, c] of [[0, "A♣"], [1, "2♣"], [2, "3♣"], [3, "4♣"]]) g = must(play(g, seat, c), c);
  const e = applyWake(rules, g, TRICK_MS).state;
  ok(e.scores.join() === "95,95,103,103" && e.step === "shown", "past the target with a tie for the lowest, the game goes on");
  // "Next hand" skips the wait; the wake does the same when the time's up
  const G2 = { ...end, state: { ...e } };
  const n = applyMove(rules, { ...G2, state: e }, 0, { t: "next" }, 0);
  ok(!n.error && n.G.state.deal === e.deal + 1 && n.G.state.hands.every(h => h.length === 13), "Next hand deals at once");
  ok(applyWake(rules, { ...G2, state: e }, e.until).state.deal === e.deal + 1, "and the clock does it when the time's up");
}

// ---------- the state through the database ----------
{
  let G = R(21), now = 0;
  const rng = seeded(4);
  let checked = 0, fine = true;
  for (let i = 0; i < 400 && !rules.over(G.state); i++) {
    const back = roundTrip(G);
    // after the database's treatment, the game must carry on as it would have
    const who = rules.toMove(G.state);
    if (who == null) { const a = applyWake(rules, G, G.state.until), b = applyWake(rules, back, G.state.until); fine &&= same(a.state, b.state); G = a; continue; }
    const m = botMove(G.state, who, { level: "medium", rng });
    const a = applyMove(rules, G, who, m, now), b = applyMove(rules, back, who, m, now);
    fine &&= !a.error && !b.error && same(a.G.state, b.G.state);
    G = a.G; checked++;
  }
  ok(fine && checked > 100, `a game read back from the database after every move plays on the same (${checked} moves, passes, tricks and ends of hands)`);
}

// ---------- whole games, every move checked against the rulebook written out again ----------
/** The cards a seat may play, from the rules as the game states them (not hearts-rules.js's code). */
function rulebook(s, seat) {
  const hand = s.hands[seat], first = s.done === 0, ledSuit = s.trick.plays.length ? s.trick.plays[0].card & 3 : null;
  const hasLed = ledSuit !== null && hand.some(c => (c & 3) === ledSuit), nonHeart = hand.some(c => (c & 3) !== 2), clean = hand.some(c => !pointsOf(c));
  return hand.filter(c => {
    if (ledSuit === null) return first ? c === C("2♣") : !((c & 3) === 2 && !s.broken && nonHeart);
    if ((c & 3) !== ledSuit) return !hasLed && !(first && pointsOf(c) && clean);
    return true;
  });
}
{
  const rng = seeded(31), levels = [["hard", "medium", "easy", "medium"], ["medium", "medium", "medium", "easy"], ["easy", "easy", "easy", "easy"]];
  let all = true, moves = 0, hands = 0, moons = 0, why = "";
  for (let g = 0; g < 6; g++) {
    let G = R(100 + g, { to: g % 2 ? 50 : 100, moon: g % 3 ? "add" : "sub" }), now = 0;
    const lv = levels[g % 3];
    for (let i = 0; i < 8000 && !rules.over(G.state); i++) {
      const s = G.state, who = rules.toMove(s);
      if (who == null) { now = s.until; const w = applyWake(rules, G, now); if (!w) { all = false; why = "no wake"; break; } G = w; if (G.state.result && G.state.step !== "trick" && G.state.log.length > hands) { hands = G.state.log.length; } continue; }
      const m = botMove(s, who, { level: lv[who], rng });
      if (m.t === "play" && !rulebook(s, who).includes(m.card)) { all = false; why = `illegal ${cardName(m.card)} (${s.hands[who].map(cardName).join(" ")}) trick ${s.trick.plays.map(p => cardName(p.card)).join(" ")}`; break; }
      const r = applyMove(rules, G, who, m, now);
      if (r.error) { all = false; why = r.error; break; }
      G = r.G; moves++;
      const t = G.state;
      if (t.step === "play" || t.step === "trick") {
        if (t.hands.flat().length + t.played.length !== 52 + (t.step === "trick" ? 0 : 0) - (t.step === "play" ? 0 : 0)) { all = false; why = "cards lost"; break; }
        if (legalCards(t, t.turn ?? 0).some(c => t.step === "play" && !rulebook(t, t.turn).includes(c))) { all = false; why = "legalCards disagrees with the rulebook"; break; }
      }
    }
    if (!rules.over(G.state)) { all = false; why ||= "never ended"; }
    const st = G.state;
    // each hand: 26 points taken in all, nothing else
    for (const e of st.log) {
      if (e.moon < 0 ? e.delta.reduce((a, b) => a + b, 0) !== 26 : (st.opts.moon === "add" ? e.delta.reduce((a, b) => a + b, 0) !== 78 : e.delta.reduce((a, b) => a + b, 0) !== -26)) { all = false; why = `a hand's points don't add up ${JSON.stringify(e)}`; }
      if (e.moon >= 0) moons++;
    }
    if (st.log.reduce((a, e) => a.map((v, i) => v + e.delta[i]), [0, 0, 0, 0]).join() !== st.scores.join()) { all = false; why = "scores aren't the sum of the hands"; }
    if (Math.max(...st.scores) < st.opts.to || st.winners.length !== 1 || st.scores[st.winners[0]] !== Math.min(...st.scores)) { all = false; why = "the game ended wrongly"; }
    hands = 0;
  }
  ok(all, `whole games of computer players at every strength: every move in the rulebook's set, every card accounted for, each hand 26 points, the winner the lowest${why ? ` (${why})` : ""}`);
}

// ---------- at a table: two people and two computer players ----------
{
  // the timed steps shortened so the test needn't wait them out
  const quick = { ...rules,
    act: (s, seat, m, ctx) => { const r = rules.act(s, seat, m, ctx); if (typeof r !== "string" && r.until) r.until = ctx.now + 20; return r; },
    wake: (s, ctx) => { const r = rules.wake(s, ctx); if (r?.until) r.until = ctx.now + 20; return r; } };
  const db = fakeDb(), devices = [];
  function device(uid) {
    const d = { uid, last: null };
    d.table = createTable({ game: "hearts", app: 1, max: 4, sync: db.device(uid), backupMs: 400, onState: () => d.runner?.update(), onLeave: () => {} });
    d.runner = createRunner({ rules: quick, table: d.table, pace: 5, botName: s => `Bot ${s}`, level: () => "easy", onView: v => { d.last = v; } });
    devices.push(d);
    return d;
  }
  const host = device("h"), guest = device("g");
  const code = await host.table.open({ name: "Korbi", pid: "pk" });
  await db.settle();
  ok(await guest.table.join(code, { name: "Mei", pid: "pm" }) === "ok", "a friend sits down at the table");
  await db.settle();
  await host.runner.deal({}, 4);
  await db.settle(8);
  ok(host.last.seats.map(s => (s.bot ? "bot" : s.name)).join() === "Korbi,Mei,bot,bot" && host.last.state.step === "pass", "two people and two computer players, the first hand passing");
  // the friend chooses first, though seat 0 is the one the table waits on
  const rng = seeded(6);
  const err1 = await guest.runner.move(botMove(guest.last.state, 1, { level: "easy", rng }));
  await db.settle(6);
  ok(!err1 && host.last.state.give[1].length === 3 && host.last.state.step === "pass" && host.last.toMove === 0, "a friend may pass before their turn comes, and the table still waits for seat 0");
  const again = await guest.runner.move(botMove(guest.last.state, 1, { level: "easy", rng }));
  ok(/passed already/.test(again), "but only once");
  ok(!(await host.runner.move(botMove(host.last.state, 0, { level: "easy", rng }))), "the host passes");
  await until(() => host.last.state.step === "play" && guest.last.state.step === "play", 3000);
  ok(host.last.state.step === "play" && host.last.state.hands.every(h => h.length === 13), "the computer players pass on their own, and the play begins");
  // the people play on their turns; the computer's turns are the host's phone's alone
  let moves = 0;
  for (let i = 0; i < 200 && !["shown", "over"].includes(host.last.state.step); i++) {
    await until(() => ["shown", "over"].includes(host.last.state.step) || [0, 1].includes(host.last.toMove), 1500);
    const t = host.last.toMove;
    if (t !== 0 && t !== 1) continue;
    const who = t === 0 ? host : guest;
    await until(() => who.last.toMove === t, 500);
    const e = await who.runner.move(botMove(who.last.state, t, { level: "easy", rng }));
    if (!e) moves++;
    await db.settle(4);
  }
  await until(() => ["shown", "over"].includes(host.last.state.step) && guest.last.state.step === host.last.state.step, 2000);
  const e = host.last.state;
  ok(["shown", "over"].includes(e.step) && moves > 10 && e.result.pts.reduce((a, b) => a + b, 0) === 26 && same(e.scores, guest.last.state.scores), `a whole hand at the table: the people on their turns (${moves} moves), the computer on its own, the points 26, both phones agreeing`);
  for (const d of devices) d.runner.stop();
}

// ---------- the computer players ----------
{
  const rng = seeded(8);
  const tidy = hand => passCards(hand, "medium", rng);
  // holding the Q♠ with few spades, it goes; with many spades, it stays
  const short = H("Q♠ 4♠ 9♥ 3♥ 2♥ 5♣ 7♣ 9♣ J♣ 3♦ 6♦ 8♦ K♦"), long = H("Q♠ 4♠ 5♠ 6♠ 7♠ 9♥ 3♥ 2♥ 5♣ 7♣ 3♦ 6♦ 8♦");
  ok(tidy(short.sort(byHand)).includes(C("Q♠")), "with the Q♠ and two spades, it is passed");
  ok(!tidy(long.sort(byHand)).includes(C("Q♠")), "with the Q♠ and five spades, it is kept");
  const aces = H("A♠ K♠ 4♠ 9♥ 3♥ 2♥ 5♣ 7♣ 9♣ J♣ 3♦ 6♦ 8♦").sort(byHand), p = tidy(aces);
  ok(p.includes(C("A♠")) && p.includes(C("K♠")), "the A♠ and K♠ in a short suit go, they would catch the Q♠");
  const hi = H("A♥ K♥ Q♥ 4♠ 5♠ 6♠ 7♠ 8♠ 2♣ 3♣ 4♦ 5♦ 6♦").sort(byHand);
  ok(tidy(hi).filter(c => (c & 3) === 2).length >= 2, "high hearts are passed");
  // the play: take the only club, dump the Q♠ when void, shed the highest when last and nothing's in the trick, duck high,
  // and take a small trick off a rival who has every point so far
  const t = table(["9♣ 3♣ 5♦ 7♠", "J♣ 8♦ 4♥ 9♠", "4♣ 9♦ 5♥ Q♠", "2♣ 7♦ 6♥ J♠"], { done: 3, turn: 2, trick: [[0, "9♣"], [1, "J♣"]] });
  ok(botMove(t.state, 2, { level: "medium", rng }).card === C("4♣"), "following a club it can't beat, it plays its only club");
  const v = table(["9♣ 3♣ 5♦ 7♠", "J♣ 8♦ 4♥ 9♠", "4♦ 9♦ 5♥ Q♠", "2♣ 7♦ 6♥ J♠"], { done: 3, turn: 2, trick: [[0, "9♣"], [1, "J♣"]] });
  ok(botMove(v.state, 2, { level: "medium", rng }).card === C("Q♠"), "void in the suit led, it dumps the Q♠ on the trick");
  const y = table(["5♦ 9♣", "7♣ 4♠", "8♣ 6♠", "3♣ K♣ 2♠"], { done: 5, turn: 3, trick: [[0, "9♣"], [1, "7♣"], [2, "8♣"]] });
  ok(botMove(y.state, 3, { level: "medium", rng }).card === C("K♣"), "last with nothing in the trick, it sheds its highest club");
  const duck = table(["9♥ 5♦", "4♥ 7♠", "J♥ 8♥ 3♥ 6♠", "2♥ 3♠"], { done: 5, turn: 2, broken: true, trick: [[0, "9♥"], [1, "4♥"]] });
  ok(botMove(duck.state, 2, { level: "medium", rng }).card === C("8♥"), "with hearts in the trick it plays the highest heart that still ducks (the 8♥ under the 9♥)");
  const hold = o => table(["9♦ 5♣", "2♥ 7♠", "8♦ 6♠", "J♦ 3♦ 4♠ 5♠"], { done: 6, turn: 3, broken: true, trick: [[0, "9♦"], [1, "2♥"], [2, "8♦"]], ...o });
  ok(botMove(hold({}).state, 3, { level: "medium", rng }).card === C("3♦"), "last with a heart in the trick, it ducks under the 9♦");
  ok(botMove(hold({ took: ["Q♠ 3♥ 4♥", "", "", ""] }).state, 3, { level: "medium", rng }).card === C("J♦"), "but when a rival has every point so far, it takes the one-point trick off him");
  // Hard, from the start of a hand: legal, and quick
  const G = R(55);
  let g = G; const r2 = seeded(3);
  for (const seat of [0, 1, 2, 3]) g = must(applyMove(rules, g, seat, botMove(g.state, seat, { level: "medium", rng: r2 }), 0), "pass");
  const t0 = Date.now(), who = g.state.turn, m = botMove(g.state, who, { level: "hard", rng: r2 });
  ok(m.t === "play" && m.card === C("2♣") && Date.now() - t0 < 2000, `Hard's first decision of a hand is the only one (${Date.now() - t0} ms)`);
  // a harder decision: the second card, twelve to choose from
  g = must(applyMove(rules, g, who, m, 0), "lead");
  const second = g.state.turn, t1 = Date.now(), m2 = botMove(g.state, second, { level: "hard", rng: r2 });
  ok(rulebook(g.state, second).includes(m2.card) && Date.now() - t1 < 2500, `Hard looks ahead and stays legal (${Date.now() - t1} ms)`);
}
{
  // the strengths: Medium takes fewer points than Easy
  const rng = seeded(77), pts = { medium: 0, easy: 0 };
  for (let g = 0; g < 10; g++) {
    const lv = g % 2 ? ["medium", "easy", "medium", "easy"] : ["easy", "medium", "easy", "medium"];
    let G = R(900 + g, { to: 50 }), now = 0;
    while (!rules.over(G.state)) {
      const who = rules.toMove(G.state);
      if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
      G = must(applyMove(rules, G, who, botMove(G.state, who, { level: lv[who], rng }), now), "play");
    }
    G.state.scores.forEach((v, i) => { pts[lv[i]] += v; });
  }
  ok(pts.medium < pts.easy, `Medium takes fewer points than Easy over 10 games (${pts.medium} against ${pts.easy})`);
}

if (bad) { console.log(`hearts: ${bad} failed`); process.exit(1); }
console.log("hearts: every check passed");
