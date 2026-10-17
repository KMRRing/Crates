// Texas Hold'em's table (holdem-rules.js), against Macau's regulation (Despacho 11/2008) and the usual rules where it is
// silent: the button and the blinds, the order of play, what a move may be and why it's refused, the least a raise may
// be and a short all-in not reopening the betting, the board turned up in stages, side pots, the showdown, split pots and
// the odd chips, the house's commission (3 to 5%, five big blinds at most), a game of so many hands with a busted player
// buying in again, the database's changes to a state, and the computer players: always legal, using only what their seat
// may know, and the harder ones winning.
import { rules, fresh, sizes, layers, rakeOf, legal, alive, potOf, blindsOf, placeOf, netOf, BLINDS, STACK, HANDS, RAKES, RAKE_CAP, SHOW_MS, STREET_MS, FOLDED_MS } from "../holdem-rules.js";
import { botMove, chen, LEVELS } from "../holdem-bot.js";
import { parseCards } from "../holdem-eval.js";
import { seeded, mix, newRecord, applyMove, applyWake, botMove as seatBot } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const sum = a => a.reduce((t, x) => t + x, 0);
const NOW = 1_000_000;
const act = (s, seat, move) => rules.act(clone(s), seat, move, { now: NOW });
const ok = (s, seat, move) => { const r = act(s, seat, move); if (typeof r === "string") throw new Error(`${seat} ${JSON.stringify(move)}: ${r}`); return r; };
const many = (s, list) => list.reduce((st, [seat, move]) => ok(st, seat, move), s);

/**
 * A game dealt from a rigged pack: holes (a list of two-card texts by seat), the board (five cards) and the rest in any
 * order, laid out as the deal takes them: round the table from the small blind, a burn card, three, a burn, one, a burn, one.
 */
function rig({ seats, button = 0, holes, board, stacks, options = { hands: 20, rake: 0 } }) {
  const tmp = { seats, button }, { sb } = blindsOf(tmp);
  const order = [sb, ...Array.from({ length: seats - 1 }, (_, k) => (sb + 1 + k) % seats)];
  const h = holes.map(t => parseCards(t)), b = parseCards(board), used = new Set([...h.flat(), ...b]);
  const rest = Array.from({ length: 52 }, (_, i) => i).filter(i => !used.has(i));
  const deck = Array(52).fill(-1);
  order.forEach((seat, k) => { deck[k] = h[seat][0]; deck[seats + k] = h[seat][1]; });
  const at = 2 * seats;
  [[at + 1, b[0]], [at + 2, b[1]], [at + 3, b[2]], [at + 5, b[3]], [at + 7, b[4]]].forEach(([i, c]) => { deck[i] = c; });
  for (let i = 0; i < 52; i++) if (deck[i] < 0) deck[i] = rest.pop();
  return fresh({ seats, options, rng: seeded(1), now: NOW, fixed: { deck, button, stacks } });
}
const spread = (n, ...texts) => Array.from({ length: n }, (_, i) => texts[i] || ["2c 3d", "4c 5d", "6c 8d", "9c Td", "Jc Qd", "Kc 2h"][i]);

// ---------- the deal ----------
{
  check(rules.seats.min === 2 && rules.seats.max === 6 && rules.id === "holdem", "two to six players");
  check(STACK === 100 * BLINDS.big && BLINDS.small * 2 === BLINDS.big, "a buy-in of a hundred big blinds, the small blind half the big (Article 5)");
  check(HANDS.join() === "10,20,40" && RAKES.join() === "5,3,0" && RAKE_CAP === 5, "games of 10, 20 or 40 hands; a commission of 5% (the most), 3% (the least) or none, five big blinds at most (Article 16)");
  let all = true, blinds = true, order = true, uniq = true, heads = true;
  for (let n = 2; n <= 6; n++) for (let button = 0; button < n; button++) {
    const s = fresh({ seats: n, options: {}, rng: seeded(n * 10 + button), fixed: { button } });
    const { sb, bb } = blindsOf(s);
    // the small blind is the first left of the button, the big blind the next; heads-up the button is the small blind
    if (n === 2 ? sb !== button : sb !== (button + 1) % n) heads = false;
    if (s.bets[sb] !== BLINDS.small || s.bets[bb] !== BLINDS.big || s.stacks[sb] !== STACK - BLINDS.small || s.stacks[bb] !== STACK - BLINDS.big) blinds = false;
    if (sum(s.bets) !== 150 || potOf(s) !== 150) blinds = false;
    // first to act: left of the big blind; heads-up the button (the small blind)
    if (s.turn !== (n === 2 ? button : (bb + 1) % n)) order = false;
    const cards = [...s.hole.flat(), ...s.board];
    if (new Set(cards).size !== cards.length || cards.length !== 2 * n + 5 || cards.some(c => c < 0 || c > 51)) uniq = false;
    if (s.hole.some(h => h.length !== 2) || s.seen !== 0 || s.step !== "bet" || s.bet !== BLINDS.big || s.raise !== BLINDS.big) all = false;
  }
  check(heads, "the small blind is the first left of the button, the big blind the next (Article 5); heads-up the button posts the small blind");
  check(blinds, "the blinds are posted from the stacks: HK$50 and HK$100, HK$150 in the pot");
  check(order, "play starts left of the big blind (Article 6), heads-up with the button");
  check(uniq, "two hole cards each and five of the board, no card twice");
  check(all, "a fresh hand: nothing of the board turned, the big blind to match, a raise at least the big blind");
  // the pack goes out as the regulation has it: from the small blind, a card at a time, a card burned before each stage
  const s = rig({ seats: 3, button: 0, holes: ["Ah Ad", "Kh Kd", "Qh Qd"], board: "2c 7s 9d Jh 3c" });
  check(s.hole[1].join() === parseCards("Kh Kd").join() && s.hole[2].join() === parseCards("Qh Qd").join() && s.board.join() === parseCards("2c 7s 9d Jh 3c").join(), "the rigged pack deals each seat its cards and the board in order (a card burned before the flop, the turn, the river)");
  check(placeOf(s, 0) === "button" && placeOf(s, 1) === "small blind" && placeOf(s, 2) === "big blind", "a seat's place: button, small blind, big blind");
  const six = fresh({ seats: 6, options: {}, rng: seeded(2), fixed: { button: 0 } });
  check([0, 1, 2, 3, 4, 5].map(i => placeOf(six, i)).join() === "button,small blind,big blind,early position,hijack,cutoff", "six seats: button, blinds, early position, hijack, cutoff");
  check(alive(six).length === 6 && legal(six, six.turn).toCall === BLINDS.big && legal(six, six.turn).minTo === 2 * BLINDS.big && !legal(six, six.turn).canCheck, "first to act faces the big blind, may raise to twice it");
}

// ---------- moves, and why they're refused ----------
{
  const s = rig({ seats: 3, button: 0, holes: spread(3), board: "Ac 7s 9d Jh 3c" });          // seat 0 (button) to act; 1 small blind, 2 big blind
  check(act(s, 1, { t: "fold" }) === "It isn't your turn", "a move out of turn is refused");
  check(act(s, 0, { t: "check" }).includes("to call"), "no check with a bet to you");
  check(act(s, 0, { t: "raise", to: 150 }).includes("least you can raise to is HK$200"), "a raise less than the big blind over the bet is refused, saying the least");
  check(act(s, 0, { t: "raise", to: 100 }).includes("no raise") && act(s, 0, { t: "raise", to: 50 }).includes("no raise"), "a raise that isn't over the bet is refused");
  check(act(s, 0, { t: "raise", to: STACK + 1 }).includes("most") && act(s, 0, { t: "raise" }) === "Say what to raise to" && act(s, 0, { t: "raise", to: 250.5 }) === "Say what to raise to", "more than your chips, or no amount: refused");
  check(act(s, 0, { t: "jump" }) === "Fold, check, call or raise" && act(s, 0, null) === "Fold, check, call or raise", "a move that isn't one is refused");
  const c = ok(s, 0, { t: "call" });
  check(c.stacks[0] === STACK - 100 && c.bets[0] === 100 && c.put[0] === 100 && c.turn === 1 && c.last[0] === "call 100", "a call puts in what's owed and passes the move on");
  const f = ok(s, 0, { t: "fold" });
  check(f.out[0] && f.last[0] === "fold" && f.turn === 1 && alive(f).length === 2, "a fold takes the seat out of the hand");
  const r = ok(s, 0, { t: "raise", to: 300 });
  check(r.bet === 300 && r.raise === 200 && r.turn === 1 && r.stacks[0] === STACK - 300 && legal(r, 1).toCall === 250 && legal(r, 1).minTo === 500, "a raise to 300 is a raise of 200: the next may raise to 500");
  check(act(r, 1, { t: "raise", to: 400 }).includes("least you can raise to is HK$500"), "a re-raise must be at least the last raise (Article 12)");
  const r2 = ok(r, 1, { t: "raise", to: 1500 });
  check(r2.raise === 1200 && legal(r2, 2).minTo === 2700 && legal(r2, 2).toCall === 1400, "a raise of 1,200 sets the least for the next: to 2,700");
  check(s.raises === 0 && r.raises === 1 && r2.raises === 2 && ok(ok(r, 1, { t: "call" }), 2, { t: "call" }).raises === 0, "bets and raises are counted for the round (the blinds aren't), and start again with the flop");
  check(sizes(s, 0).map(x => x.to).join() === "200,250,300,350,10000" && sizes(s, 0).map(x => x.label).join() === "Min,½ pot,¾ pot,Pot,All in", "the raises offered in a tap: the least, half the pot, three quarters, the pot (call, then raise the pot: 100 + 250), all in, on the table's steps of 50");
  const board = "Ac 7s 9d Jh 3c";
  const deep = stacks => rig({ seats: 3, button: 0, holes: spread(3), board, stacks });
  const at300 = ok(deep([STACK, 400, STACK]), 0, { t: "raise", to: 300 });
  check(sizes(deep([STACK, 400, STACK]), 0).length === 5 && sizes(at300, 1).map(x => `${x.label}:${x.to}`).join() === "All in:400", "a player with too little for a full raise is offered only all in");
  check(sizes(ok(deep([STACK, 150, STACK]), 0, { t: "raise", to: 300 }), 1).length === 0, "one who can't even cover the bet isn't offered a raise at all");
  const bb = many(s, [[0, { t: "call" }], [1, { t: "call" }]]);
  check(bb.turn === 2 && bb.step === "bet" && bb.seen === 0 && legal(bb, 2).canCheck && legal(bb, 2).toCall === 0, "the big blind has the option to check when no one has raised (Article 6)");
  check(ok(bb, 2, { t: "check" }).seen === 3, "the round over, the flop is turned");
  const rb = ok(bb, 2, { t: "raise", to: 300 });
  check(rb.turn === 0 && rb.acted[2] && !rb.acted[0] && !rb.acted[1], "the big blind may raise instead, and the others must answer");
}

// ---------- the board in stages, and the order of play ----------
{
  let s = rig({ seats: 4, button: 1, holes: spread(4, "Ah Kd", "2c 3d", "Qs Qd", "7c 8d"), board: "Ac Ks 9d Jh 3c" });
  // button 1: small blind 2, big blind 3, first to act 0
  check(s.turn === 0 && blindsOf(s).sb === 2 && blindsOf(s).bb === 3, "four seats, button on 1: small blind 2, big blind 3, seat 0 first");
  s = many(s, [[0, { t: "call" }], [1, { t: "call" }], [2, { t: "call" }], [3, { t: "check" }]]);
  check(s.seen === 3 && s.bet === 0 && s.bets.every(b => b === 0) && s.turn === 2 && s.raise === BLINDS.big, "the flop: bets cleared, the first player left of the button (2) first (Article 7)");
  check(s.put.every(p => p === 100) && potOf(s) === 400, "the pot holds what everyone put in");
  s = many(s, [[2, { t: "check" }], [3, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }]]);
  check(s.seen === 4 && s.turn === 2, "the turn: one more card, the same order");
  s = many(s, [[2, { t: "raise", to: 100 }], [3, { t: "call" }], [0, { t: "fold" }], [1, { t: "call" }]]);
  check(s.seen === 5 && s.turn === 2 && alive(s).length === 3, "the river; a seat that folded isn't asked again");
  s = many(s, [[2, { t: "check" }], [3, { t: "check" }], [1, { t: "check" }]]);
  check(s.step === "shown" && s.result.shown.length === 3 && s.open, "after the last round every player left shows their cards (Article 8)");
  check(s.wake === undefined && rules.wakeAt(s) === NOW + SHOW_MS, "the hand is shown a while, then the next is dealt");
  // the button for the last player to act after the flop
  let t = rig({ seats: 3, button: 0, holes: spread(3), board: "Ac Ks 9d Jh 3c" });
  t = many(t, [[0, { t: "call" }], [1, { t: "call" }], [2, { t: "check" }]]);
  check(t.turn === 1, "after the flop the small blind (first left of the button) acts first");
  t = many(t, [[1, { t: "check" }], [2, { t: "check" }]]);
  check(t.turn === 0 && t.seen === 3, "and the button last");
}

// ---------- heads-up ----------
{
  let s = rig({ seats: 2, button: 0, holes: ["Ah Kd", "Qs Qd"], board: "2c 7s 9d Jh 3c" });
  check(s.turn === 0 && s.bets[0] === 50 && s.bets[1] === 100 && legal(s, 0).toCall === 50, "heads-up: the button posts the small blind and acts first");
  s = many(s, [[0, { t: "call" }]]);
  check(s.turn === 1 && legal(s, 1).canCheck, "the big blind has the option");
  s = many(s, [[1, { t: "check" }]]);
  check(s.seen === 3 && s.turn === 1, "after the flop the other player (the big blind) acts first, the button last");
}

// ---------- a short all-in doesn't reopen the betting ----------
{
  let s = rig({ seats: 3, button: 0, holes: spread(3, "Ah Ad", "Kh Kd", "Qh Qd"), board: "2c 7s 9d Jh 3c", stacks: [STACK, 400, STACK] });
  s = ok(s, 0, { t: "raise", to: 300 });
  check(legal(s, 1).maxTo === 400 && legal(s, 1).minTo === 400 && legal(s, 1).canRaise, "a player with 350 behind may only raise all in");
  s = ok(s, 1, { t: "raise", to: 400 });                                                // 100 over: short of a full raise (200)
  check(s.bet === 400 && s.raise === 200 && s.stacks[1] === 0 && s.last[1] === "allin 400", "an all-in for less than a full raise doesn't change the raise");
  check(legal(s, 2).canRaise && legal(s, 2).minTo === 600, "the big blind, who hasn't acted, may still raise");
  const c = ok(s, 2, { t: "call" });
  check(c.turn === 0 && c.closed[0] && !legal(c, 0).canRaise && legal(c, 0).toCall === 100, "the raiser, who had acted, may only call or fold");
  check(act(c, 0, { t: "raise", to: 900 }).includes("short of a full raise") && ok(c, 0, { t: "call" }).seen === 3, "a re-raise by them is refused; a call goes on");
  const r = ok(s, 2, { t: "raise", to: 700 });
  check(r.raise === 300 && !r.closed[0] && legal(r, 0).canRaise && legal(r, 0).toCall === 400, "a full raise by another reopens it for everyone");
}

// ---------- all in, side pots, the showdown ----------
/** The run-out of an all-in hand: the board turned up a stage at a time, then the showdown. */
function runOut(s) {
  const steps = [];
  let t = clone(s), now = NOW;
  while (t.step === "runout") { now = rules.wakeAt(t); t = rules.wake(t, { rng: seeded(1), now }); steps.push(t.seen); }
  return { s: t, steps, now };
}
{
  // three players all in for 1,000, 3,000 and 5,000 more: the short stack has the best hand, the middle the second, the deep the worst
  let s = rig({ seats: 3, button: 0, holes: ["Ah Ad", "Kh Kd", "Qh Qd"], board: "2c 7s 9d Jh 3c", stacks: [1000, 3000, 10000] });
  s = many(s, [[0, { t: "raise", to: 1000 }], [1, { t: "raise", to: 3000 }], [2, { t: "raise", to: 5000 }]]);
  check(s.step === "runout" && s.turn === null && s.open && s.seen === 0 && rules.toMove(s) === null, "everyone all in or called: the cards are turned up and the board run out");
  check(JSON.stringify(layers(s)) === JSON.stringify([{ amount: 3000, seats: [0, 1, 2] }, { amount: 4000, seats: [1, 2] }, { amount: 2000, seats: [2], back: true }]), "the pot in its layers: a main pot of 3 × 1,000, a side pot of 2 × 2,000, and the 2,000 nobody called, which goes back");
  const r = runOut(s);
  check(r.steps.join() === "3,4,5,5" && r.s.step === "shown" && r.now === NOW + 4 * STREET_MS, "the flop, the turn and the river come a stage at a time, a beat after the river, then the showdown");
  check(r.s.stacks.join() === "3000,4000,7000", "the best hand wins the main pot, the second the side pot, and the bet nobody called goes back");
  check(r.s.result.pots.map(p => p.winners.join()).join("|") === "0|1|2" && r.s.result.deltas.join() === "2000,1000,-3000" && sum(r.s.stacks) === 14000, "who won each layer, and what each gained or lost");
  check(r.s.result.shown.map(x => x.text).join("|") === "Pair of aces|Pair of kings|Pair of queens" && r.s.result.shown.every(x => x.five.length === 5), "every hand shown, in words, with its five cards");
  // the same with a call, not a raise, and the deep stack the winner
  let t = rig({ seats: 3, button: 0, holes: ["Qh Qd", "Kh Kd", "Ah Ad"], board: "2c 7s 9d Jh 3c", stacks: [1000, 3000, 10000] });
  t = many(t, [[0, { t: "raise", to: 1000 }], [1, { t: "raise", to: 3000 }], [2, { t: "call" }]]);
  check(t.step === "runout" && layers(t).length === 2, "a call of the biggest bet: two layers, nothing uncalled");
  const rt = runOut(t).s;
  check(rt.stacks.join() === "0,0,14000", "the deep stack wins both layers");
  // one all in and two with chips go on betting the side pot
  let u = rig({ seats: 3, button: 0, holes: ["Qh Qd", "Kh Kd", "Ah Ad"], board: "2c 7s 9d Jh 3c", stacks: [1000, 5000, 5000] });
  u = many(u, [[0, { t: "raise", to: 1000 }], [1, { t: "call" }], [2, { t: "call" }]]);
  check(u.step === "bet" && u.seen === 3 && alive(u).length === 3 && u.turn === 1, "the others call the all-in and go on to the flop with chips behind");
  u = many(u, [[1, { t: "raise", to: 500 }], [2, { t: "call" }]]);
  check(u.step === "bet" && u.seen === 4 && u.turn === 1, "the all-in player isn't asked again");
  u = many(u, [[1, { t: "check" }], [2, { t: "check" }], [1, { t: "check" }], [2, { t: "check" }]]);
  check(u.step === "shown" && u.stacks.join() === "0,3500,7500" && JSON.stringify(u.result.pots.map(p => p.amount)) === "[3000,1000]", "a side pot goes to the best hand of those in it: the player all in can only win the main pot");
}

// ---------- the commission ----------
{
  const heads = (rake, extra = {}) => rig({ seats: 2, button: 0, holes: ["Ah Ad", "Kh Kd"], board: "2c 7s 9d Jh 3c", options: { hands: 20, rake }, ...extra });
  const checkDown = s => many(s, [[0, { t: "call" }], [1, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }]]);
  let s = checkDown(heads(5));
  check(s.result.rake === 10 && s.stacks.join() === `${STACK + 90},${STACK - 100}`, "a pot of 200 at 5%: the house takes 10, the winner has 190 for the 100 they put in (Article 16)");
  s = checkDown(heads(3));
  check(s.result.rake === 6 && s.stacks[0] === STACK + 94, "at 3% (the regulation's least) 6");
  s = checkDown(heads(0));
  check(s.result.rake === 0 && s.stacks[0] === STACK + 100, "with no commission nothing is taken");
  // the cap: five big blinds
  let big = many(heads(5), [[0, { t: "raise", to: STACK }], [1, { t: "call" }]]);
  big = runOut(big).s;
  check(big.result.rake === RAKE_CAP * BLINDS.big && big.stacks[0] === 2 * STACK - 500, "a pot of 20,000 at 5% would be 1,000: the house never takes more than five big blinds (500)");
  // a bet nobody called isn't raked
  let un = rig({ seats: 2, button: 0, holes: ["Ah Ad", "Kh Kd"], board: "2c 7s 9d Jh 3c", stacks: [STACK, 2000], options: { hands: 20, rake: 5 } });
  un = runOut(many(un, [[0, { t: "raise", to: STACK }], [1, { t: "call" }]])).s;
  check(un.result.rake === 200 && un.stacks.join() === "11800,0" && JSON.stringify(un.result.pots.map(p => p.amount)) === "[3800,8000]", "of 10,000 against 2,000 only the 4,000 contested is raked (5% = 200); the 8,000 nobody called goes back whole");
  // everyone folds
  let f = rig({ seats: 3, button: 0, holes: spread(3), board: "2c 7s 9d Jh 3c", options: { hands: 20, rake: 5 } });
  f = many(f, [[0, { t: "fold" }], [1, { t: "fold" }]]);
  check(f.step === "shown" && f.result.uncontested && !f.result.shown.length && f.result.rake === 5 && f.stacks.join() === `${STACK},${STACK - 50},${STACK + 45}`, "everyone folds: the big blind wins the small blind's 50 less 5 for the house, and nobody shows a card");
  check(rules.wakeAt(f) === NOW + FOLDED_MS && FOLDED_MS < SHOW_MS, "a hand that ends in folds is over sooner");
  // everyone folds to a raise: what nobody matched goes back and isn't raked; the pot is only what was contested
  let g = rig({ seats: 3, button: 0, holes: spread(3), board: "2c 7s 9d Jh 3c", options: { hands: 20, rake: 5 } });
  g = many(g, [[0, { t: "raise", to: 1000 }], [1, { t: "fold" }], [2, { t: "fold" }]]);
  check(JSON.stringify(g.result.pots.map(p => [p.amount, !!p.back])) === "[[238,false],[900,true]]" && g.result.rake === 12 && g.stacks.join() === `${STACK + 138},${STACK - 50},${STACK - 100}`, "a raise of 1,000 that everyone folds to: 900 of it goes back, the 250 contested (the raiser's 100 and the blinds) is raked 12, and the raiser wins 238");
  check(g.result.won.join() === "238,0,0" && g.result.deltas.join() === "138,-50,-100" && g.say === "{s0} wins HK$238, everyone else folded; HK$900 comes back.", "what each won of the contested pot, and what is said");
  // the rake itself, as a rule
  const rk = (pct, ...put) => rakeOf({ opts: { rake: pct }, put });
  check(rk(3, 250, 250, 50) === 16 && rk(5, 100, 100) === 10 && rk(5, 10000, 10000) === 500 && rk(0, 500, 500) === 0 && rk(5, 100, 50, 0) === 5, "whole dollars, rounded down (3% of 550 is 16.5: 16); the cap; none; the blinds' 150 raked on the 100 contested");
}

// ---------- equal hands split the pot ----------
{
  let s = rig({ seats: 3, button: 0, holes: ["Ah 2d", "As 3c", "4h 5d"], board: "7c 8d 9h Js Kc", options: { hands: 20, rake: 5 } });
  s = many(s, [[0, { t: "call" }], [1, { t: "call" }], [2, { t: "check" }], [1, { t: "check" }], [2, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [2, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [2, { t: "check" }], [0, { t: "check" }]]);
  check(s.step === "shown" && s.result.pots[0].winners.join() === "0,1" && s.result.rake === 15, "two hands the same: both win the pot");
  check(s.stacks[1] === STACK + 43 && s.stacks[0] === STACK + 42 && s.stacks[2] === STACK - 100, "a pot of 285 after the house's 15 splits 142 each, and the odd chip goes to the first of them left of the button (Article 10)");
  const w = rig({ seats: 2, button: 0, holes: ["Ah Kd", "As Kc"], board: "2c 7s 9d Jh 3c" });
  const t = many(w, [[0, { t: "call" }], [1, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }], [1, { t: "check" }], [0, { t: "check" }]]);
  check(t.stacks.join() === `${STACK},${STACK}` && /split the pot/.test(t.say), "a tie on the whole board splits the pot back to the stacks");
}

// ---------- a game: hands, the button, buying in again ----------
/** A whole game through seats.js's record, as the runner plays it; a policy picks every move. rt: the record goes through the database between every step. */
function playGame({ seats, options, seed, policy, rt = false, limit = 20000 }) {
  let G = newRecord(rules, { seats, options, seed, now: NOW }), now = NOW, rake = 0, hands = [], tick = 0;
  const log = [];
  while (tick++ < limit) {
    if (rt) G = roundTrip(G);
    const st = rules.restore(clone(G.state));
    if (rules.over(st)) break;
    const who = rules.toMove(st);
    if (who != null) {
      const move = policy(G, who);
      const r = applyMove(rules, G, who, move, now);
      if (r.error) throw new Error(`seat ${who} ${JSON.stringify(move)} refused: ${r.error}`);
      G = r.G;
    } else {
      now = rules.wakeAt(st);
      const g = applyWake(rules, G, now);
      if (!g) throw new Error("a timed step didn't move on");
      G = g;
    }
    const after = rules.restore(clone(G.state));
    if (after.step === "shown" && after.result && !hands.includes(`${after.hand}`)) { hands.push(`${after.hand}`); rake += after.result.rake; log.push(after.result.deltas.join()); }
    // chips are never made or lost, but for the house's commission
    const total = sum(after.stacks) + (after.step === "bet" || after.step === "runout" ? sum(after.put) : 0);
    if (total + rake !== STACK * sum(after.buys)) throw new Error(`chips off: ${total} + ${rake} rake ≠ ${STACK * sum(after.buys)}`);
  }
  return { G, s: rules.restore(clone(G.state)), rake, log };
}
const passive = (G, seat) => { const s = rules.restore(clone(G.state)), me = legal(s, seat); return me.canCheck ? { t: "check" } : { t: "call" }; };
const shove = (G, seat) => { const s = rules.restore(clone(G.state)), me = legal(s, seat); return me.canRaise ? { t: "raise", to: me.maxTo } : me.canCheck ? { t: "check" } : { t: "call" }; };
{
  const g = playGame({ seats: 4, options: { hands: 10, rake: 5 }, seed: 7, policy: passive });
  check(g.s.step === "over" && g.s.hand === 10 && g.s.buys.every(b => b === 1), "a game of 10 hands, played out: over after the tenth, nobody having bust");
  check(sum(g.s.stacks) + g.rake === 4 * STACK && g.rake > 0 && sum(g.s.nets) === -g.rake, "the chips in the game are the buy-ins less what the house took, and the nets add up to its commission");
  check(g.s.house === g.rake && g.s.wins.length === 4 && sum(g.s.wins) >= 10, "the game keeps the commission taken and the hands each seat won");
  check(g.s.winners.length >= 1 && g.s.winners.every(w => g.s.nets[w] === Math.max(...g.s.nets)), "whoever is ahead at the end wins; equal nets share it");
  check(g.G.say?.text.includes("That's the game"), "the game's end is said (the runner lifts it from the state to the record)");
  const buttons = new Set();
  let G = newRecord(rules, { seats: 5, options: { hands: 10, rake: 0 }, seed: 9, now: NOW }), first = G.state.button, order = [first];
  for (let i = 0; i < 4; i++) {
    for (let k = 0; k < 400 && rules.restore(clone(G.state)).step !== "shown"; k++) { const s = rules.restore(clone(G.state)); const who = rules.toMove(s); if (who == null) G = applyWake(rules, G, rules.wakeAt(s)); else G = applyMove(rules, G, who, passive(G, who), NOW).G; }
    G = applyWake(rules, G, rules.wakeAt(G.state));
    order.push(G.state.button);
  }
  check(order.every((b, i) => !i || b === (order[i - 1] + 1) % 5), `the button moves one seat clockwise every hand (${order.join(" ")}) (Article 1)`);
  // everyone shoves: players go broke and buy in again for the same, so the game goes on
  const h = playGame({ seats: 3, options: { hands: 10, rake: 0 }, seed: 3, policy: shove });
  check(h.s.step === "over" && sum(h.s.buys) > 3 && sum(h.s.stacks) === STACK * sum(h.s.buys), "players who go broke buy in again for the same stack, and the chips still add up");
  const nets = h.s.nets;
  check(sum(nets) === 0 && nets.every((n, i) => n === h.s.stacks[i] - h.s.buys[i] * STACK), "a seat's result is its chips less all its buy-ins; with no commission they sum to nothing");
  check(playGame({ seats: 2, options: { hands: 10, rake: 5 }, seed: 5, policy: shove }).s.step === "over", "a heads-up game of all-ins goes the distance");
}

// ---------- what the database does to a state ----------
{
  for (const [seats, seed, policy, name] of [[4, 11, passive, "calling"], [3, 12, shove, "all-ins"]]) {
    const a = playGame({ seats, options: { hands: 10, rake: 5 }, seed, policy });
    const b = playGame({ seats, options: { hands: 10, rake: 5 }, seed, policy, rt: true });
    check(JSON.stringify(a.s.stacks) === JSON.stringify(b.s.stacks) && a.log.join("|") === b.log.join("|") && b.s.step === "over", `a game of ${name} comes out the same with the record through the database at every step (nulls, empty lists, …)`);
  }
  const s = fresh({ seats: 3, options: {}, rng: seeded(4), fixed: { button: 0 } });
  const back = rules.restore(roundTrip(s));
  check(JSON.stringify(back.rebought) === "[]" && back.turn === s.turn && back.until === 0, "a fresh hand's empty list (nobody bought in again) comes back");
  const done = ok(ok(s, s.turn, { t: "fold" }), 1, { t: "fold" });
  const dr = rules.restore(roundTrip(done));
  check(dr.result.shown.length === 0 && dr.result.uncontested === true && dr.turn === null, "a hand won by folds: no hands shown, nobody to move, as it was");
}

// ---------- seats.js ----------
{
  const G = newRecord(rules, { seats: 6, options: { hands: 10, rake: 5 }, seed: 21, now: NOW });
  check(G.seats === 6 && G.state.opts.hands === 10 && G.state.opts.rake === 5 && newRecord(rules, { seats: 9, seed: 1 }).seats === 6, "at most six seats; the options kept");
  check(newRecord(rules, { seats: 3, options: { hands: 7, rake: 4 }, seed: 1 }).state.opts.hands === 20 && newRecord(rules, { seats: 3, options: { hands: 7, rake: 4 }, seed: 1 }).state.opts.rake === 5, "options that aren't the game's go back to its own (20 hands, 5%)");
  check(G.say?.text.startsWith("Hand 1 of 10.") && G.say.text.includes("{s"), "the deal is said for the narrator, naming a seat as {sN}");
  const who = G.state.turn, ex = applyMove(rules, G, (who + 1) % 6, { t: "call" });
  check(ex.error === "It isn't your turn", "the runner refuses a move out of turn");
  const a = applyMove(rules, G, who, { t: "fold" }).G, b = applyMove(rules, G, who, { t: "fold" }).G;
  check(JSON.stringify(a) === JSON.stringify(b), "a move worked out twice comes out the same");
  const m1 = seatBot(rules, G, who, "hard"), m2 = seatBot(rules, G, who, "hard");
  check(JSON.stringify(m1) === JSON.stringify(m2) && !applyMove(rules, G, who, m1).error, "a computer player's move is the same worked out twice, and legal");
}

// ---------- the computer players ----------
{
  check([chen(parseCards("Ah Ad")), chen(parseCards("Kh Kd")), chen(parseCards("Ah Kh")), chen(parseCards("Ah Kd")), chen(parseCards("Th 9h")), chen(parseCards("7h 2d")), chen(parseCards("2h 2d")), chen(parseCards("Qh Jd")), chen(parseCards("Qh Jh")), chen(parseCards("5h 4h"))].join() === "20,16,12,10,8,-1,5,7,9,6", "Chen's count: AA 20, KK 16, AKs 12, AKo 10, T9s 8, 72o −1, 22 5, QJo 7, QJs 9, 54s 6");
  // always legal, every level, every table size
  let refused = 0, moves = 0;
  const driver = level => (G, seat) => { const m = seatBot(rules, G, seat, level); moves++; if (applyMove(rules, G, seat, m, NOW).error) refused++; return m; };
  for (const level of ["easy", "medium", "hard"]) for (const seats of [2, 3, 6]) playGame({ seats, options: { hands: 10, rake: 5 }, seed: seats * 31 + level.length, policy: driver(level) });
  check(refused === 0 && moves > 300, `${moves} computer moves over games of every level and size, none refused`);
  // a computer player uses only what its seat may know: change the others' cards and the cards still to come, and it plays the same
  let same = true, trials = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const G = newRecord(rules, { seats: 4, options: { hands: 10, rake: 5 }, seed, now: NOW });
    let g = G;
    for (let step = 0; step < 14 && !rules.over(g.state); step++) {
      const s = rules.restore(clone(g.state)), who = rules.toMove(s);
      if (who == null) break;
      const swapped = clone(s), unseen = Array.from({ length: 52 }, (_, i) => i).filter(c => ![...s.hole[who], ...s.board.slice(0, s.seen)].includes(c));
      const rng = seeded(seed * 7 + step);
      for (let i = 0; i < 4; i++) if (i !== who) swapped.hole[i] = [unseen.splice(Math.floor(rng() * unseen.length), 1)[0], unseen.splice(Math.floor(rng() * unseen.length), 1)[0]];
      for (let k = s.seen; k < 5; k++) swapped.board[k] = unseen.splice(Math.floor(rng() * unseen.length), 1)[0];
      for (const level of ["easy", "hard"]) {
        trials++;
        if (JSON.stringify(botMove(s, who, { level, rng: seeded(step + 1) })) !== JSON.stringify(botMove(swapped, who, { level, rng: seeded(step + 1) }))) same = false;
      }
      g = applyMove(rules, g, who, seatBot(rules, g, who, "medium"), NOW).G;
    }
  }
  check(same && trials > 300, `${trials} decisions played the same with the others' cards and the cards to come changed: a seat uses only what it may see`);
}

// ---------- the harder players win ----------
{
  // the same table every game, levels alternating round it; a game's result is each seat's net, summed by level
  const play = (levels, games, hands) => {
    const net = { easy: 0, medium: 0, hard: 0 }, seatsN = levels.length;
    for (let g = 0; g < games; g++) {
      const rot = levels.map((_, i) => levels[(i + g) % seatsN]);                // the seats' levels turn round so no seat is favoured
      const r = playGame({ seats: seatsN, options: { hands, rake: 0 }, seed: 1000 + g, policy: (G, seat) => seatBot(rules, G, seat, rot[seat]) });
      r.s.nets.forEach((n, i) => { net[rot[i]] += n; });
    }
    return net;
  };
  const a = play(["hard", "easy", "hard", "easy"], 24, 20);
  check(a.hard > 0 && a.easy < 0, `hard players beat easy ones over 24 games of 20 hands (hard ${a.hard}, easy ${a.easy})`);
  const b = play(["medium", "easy", "medium", "easy"], 24, 20);
  check(b.medium > 0 && b.easy < 0, `medium players beat easy ones (medium ${b.medium}, easy ${b.easy})`);
  const c = play(["hard", "medium"], 24, 20);
  console.log(`    (heads-up, hard against medium: hard ${c.hard}, medium ${c.medium})`);
  check(c.hard > -2000, "hard is no worse than medium heads-up (within the noise of 480 hands)");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("holdem: the deal, the blinds and the button, moves and raises, side pots, the showdown, the commission, split pots, a game of hands, the database, the computer players");
