// Landlord (landlord-rules.js, landlord-bot.js): what a play is (every kind, and what isn't one: a two in a straight,
// a joker pairing with a two, a four with a pair as its two cards, both jokers as kickers, a kicker of the threes' own
// rank) and what beats what (the same kind and size higher, kickers not counting, bombs, the rocket), the plays a hand
// can make, the deal, both biddings (points: rising bids, a 3 ending it, nobody bidding and the cards dealt again; call
// and rob: each rob doubling, the caller's last word), the play (the landlord leading, two passes ending a trick, 要不起
// and what it tells), the scoring (bombs, spring, anti-spring, twice the stake for the landlord), whole games of computer
// players with every card accounted for and the scores balancing, the state through the database, and the strengths.
import { rules, readings, beats, movesFrom, countsOf, check, cardsFor, RANKS, SUITS, SMALL, BIG } from "../landlord-rules.js";
import { botMove, plan, limitsOf, LEVELS } from "../landlord-bot.js";
import { newRecord, applyMove, applyWake, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const ok = (c, what) => { console.log(`${c ? "ok  " : "FAIL"} ${what}`); if (!c) bad++; };
// ranks by name: "3 3 3 4", "S" the small joker, "B" the big
const R = s => s.split(" ").map(x => (x === "S" ? 13 : x === "B" ? 14 : RANKS.indexOf(x)));
const cnt = s => { const c = Array(15).fill(0); for (const r of R(s)) c[r]++; return c; };
const read = s => readings(cnt(s))[0] || null;
const kind = s => read(s)?.type || "none";
// a card by name: "3♦", "10♠", "S", "B"
const C = name => (name === "S" ? SMALL : name === "B" ? BIG : RANKS.indexOf(name.slice(0, -1)) * 4 + SUITS.indexOf(name.slice(-1)));

// ---------- what a play is ----------
ok(kind("7") === "single" && kind("7 7") === "pair" && kind("7 7 7") === "triple" && kind("7 7 7 7") === "bomb" && kind("S B") === "rocket", "a single, a pair, three, a bomb, the rocket");
ok(kind("7 7 7 3") === "trio1" && kind("7 7 7 B") === "trio1" && kind("7 7 7 3 3") === "trio2", "three with one (a joker will do), three with a pair");
ok(kind("3 4 5 6 7") === "straight" && kind("3 4 5 6 7 8 9 10 J Q K A") === "straight" && kind("3 3 4 4 5 5") === "pairs" && kind("7 7 7 8 8 8") === "plane", "straights from five cards to all twelve, pairs in a row, an airplane");
ok(kind("7 7 7 8 8 8 3 9") === "plane1" && kind("7 7 7 8 8 8 3 3") === "plane1" && kind("7 7 7 8 8 8 3 3 9 9") === "plane2", "an airplane with a card each (two may pair), with a pair each");
ok(kind("7 7 7 7 3 9") === "four2" && kind("7 7 7 7 3 3 9 9") === "four22", "four with two cards, four with two pairs");
ok(kind("J Q K A 2") === "none" && kind("10 J Q K A 2") === "none" && kind("3 4 5 6") === "none" && kind("3 3 4 4") === "none" && kind("2 2 2 A A A") === "none", "no two in a chain, no straight under five, no pairs in a row under three, no airplane with twos");
ok(kind("2 S") === "none" && kind("7 7 7 7 3 3") === "none" && kind("7 7 7 7 S B") === "none" && kind("7 7 7 8 8 8 S B") === "none", "a joker doesn't pair with a two; a four takes two different cards (not a pair, not both jokers); an airplane's wings aren't both jokers");
ok(kind("7 7 7 7 3") === "none" && kind("7 7 7 8 8 8 8 9") === "none" && kind("3 3 4 4 5 5 5") === "none", "four with one isn't a play, nor an airplane whose wing is one of its own ranks");
ok(kind("3 3 3 4 4 4 5 5 5 6 6 6") === "plane", "twelve cards of four threes in a row read as an airplane of four, the strongest reading");

// ---------- what beats what ----------
const beat = (a, b) => beats(read(a), read(b));
ok(beat("8", "7") && !beat("7", "8") && beat("2", "A") && beat("S", "2") && beat("B", "S"), "singles: 3 up to A, then 2, the small joker, the big");
ok(beat("4 4 4 3", "3 3 3 K") && !beat("4 4 4 3", "3 3 3 K K"), "a three goes by its own rank, the kicker not counting; three with one doesn't beat three with a pair");
ok(beat("4 5 6 7 8", "3 4 5 6 7") && !beat("4 5 6 7 8 9", "3 4 5 6 7"), "a straight beats a lower one of the same length only");
ok(beat("3 3 3 3", "2") && beat("3 3 3 3", "10 J Q K A") && beat("4 4 4 4", "3 3 3 3") && !beat("3 3 3 3", "4 4 4 4"), "a bomb beats anything but a higher bomb");
ok(beat("S B", "2 2 2 2") && !beat("2 2 2 2", "S B"), "the rocket beats every bomb, and nothing beats it");
ok(beat("8 8 8 8 3 4", "7 7 7 7 K A") && !beat("7 7 7 7 K A", "8 8 8 8 3 4") && beat("3 3 3 3", "8 8 8 8 K A"), "four with two goes by its four; a lower bomb beats it");
{
  const m = movesFrom(cnt("3 3 5 5 9 9 9 9 S B"), read("4 4"));
  ok(m.some(p => p.type === "pair" && p.rank === 2) && !m.some(p => p.type === "pair" && p.rank === 0) && m.some(p => p.type === "bomb") && m.some(p => p.type === "rocket") && m.every(p => p.type === "pair" || p.type === "bomb" || p.type === "rocket"), "following a pair: the pairs above it, the bomb, the rocket");
  const lead = movesFrom(cnt("3 4 5 6 7 7 7 7 8"));
  ok(lead.some(p => p.type === "straight" && p.len === 6) && lead.some(p => p.type === "four2") && lead.some(p => p.type === "trio1"), "leading: chains of every length, a four with two, threes with kickers");
}

// ---------- the deal and the bidding ----------
const O = { deals: 2, bidding: "points", talk: "en" };
const G0 = (seed = 1, opts = {}) => newRecord(rules, { seats: 3, options: { ...O, ...opts }, seed, now: 0 });
{
  const G = G0(3), s = G.state;
  ok(s.hands.every(h => h.length === 17) && s.kitty.length === 3 && new Set([...s.hands.flat(), ...s.kitty]).size === 54, "seventeen each and three in the kitty, every card dealt once");
  ok(s.hands[s.first].includes(s.shown) && s.turn === s.first && s.step === "bid", "whoever holds the face-up card bids first");
  const a = s.first, b = (a + 1) % 3, c = (a + 2) % 3;
  let g = applyMove(rules, G, a, { t: "bid", n: 1 }).G;
  ok(/more than 1/.test(applyMove(rules, g, b, { t: "bid", n: 1 }).error || ""), "a bid must be higher than the last");
  g = applyMove(rules, g, b, { t: "bid", n: 2 }).G;
  g = applyMove(rules, g, c, { t: "bid", n: 0 }).G;
  ok(g.state.landlord === b && g.state.stake === 2 && g.state.hands[b].length === 20 && g.state.kitty.every(k => g.state.hands[b].includes(k)) && g.state.step === "play" && g.state.turn === b, "the highest bidder is landlord at that stake, takes the kitty and leads");
  ok(/lead/.test(applyMove(rules, g, b, { t: "pass" }).error || ""), "the landlord can't pass the first lead");
  const g3 = applyMove(rules, G, a, { t: "bid", n: 3 }).G;
  ok(g3.state.landlord === a && g3.state.stake === 3, "a bid of 3 ends the bidding at once");
  let t = G;
  for (const seat of [a, b, c]) t = applyMove(rules, t, seat, { t: "bid", n: 0 }).G;
  ok(t.state.step === "thrown" && rules.toMove(t.state) === null, "nobody bids: the cards are thrown in");
  const t2 = applyWake(rules, t, t.state.until);
  ok(t2.state.step === "bid" && t2.state.deal === 1 && t2.state.hands.every(h => h.length === 17) && t2.state.hands.flat().join() !== t.state.hands.flat().join(), "and dealt again, the same deal");
}
{
  // calling and robbing
  const G = G0(5, { bidding: "rob" }), s = G.state, a = s.first, b = (a + 1) % 3, c = (a + 2) % 3;
  let g = applyMove(rules, G, a, { t: "bid", yes: true }).G;
  ok(g.state.caller === a && g.state.turn === b, "a call, and the next may rob");
  g = applyMove(rules, g, b, { t: "bid", yes: true }).G;
  g = applyMove(rules, g, c, { t: "bid", yes: false }).G;
  ok(g.state.turn === a && g.state.phase === "final", "robbed: the caller has the last word");
  const back = applyMove(rules, g, a, { t: "bid", yes: true }).G;
  ok(back.state.landlord === a && back.state.stake * 2 ** back.state.doubles === 4, "the caller robs back: landlord at 1, doubled twice");
  const let_ = applyMove(rules, g, a, { t: "bid", yes: false }).G;
  ok(let_.state.landlord === b && let_.state.stake * 2 ** let_.state.doubles === 2, "or lets it go: the robber is landlord at 2");
  let h = applyMove(rules, G, a, { t: "bid", yes: false }).G;
  h = applyMove(rules, h, b, { t: "bid", yes: false }).G;
  h = applyMove(rules, h, c, { t: "bid", yes: true }).G;
  ok(h.state.landlord === c && h.state.doubles === 0, "the last to be asked calls: nobody's left to rob");
  let n = applyMove(rules, G, a, { t: "bid", yes: false }).G;
  n = applyMove(rules, n, b, { t: "bid", yes: true }).G;
  ok(n.state.turn === c && n.state.queue.length === 1, "a player who didn't call can't rob: only the one after the caller is asked");
}

// ---------- the play ----------
/** A state set up by hand: the landlord seat 0, hands by name, the landlord to lead. */
function table(hands, { landlord = 0, turn = landlord, stake = 1 } = {}) {
  const G = G0(9), s = G.state;
  s.hands = hands.map(h => h.split(" ").map(C));
  s.kitty = s.hands[landlord].slice(0, 3);
  Object.assign(s, { step: "play", landlord, turn, stake, doubles: 0, high: stake, bids: [], queue: [] });
  return G;
}
{
  let G = table(["3♦ 3♣ 9♠ K♥", "4♦ 5♠ 8♠ A♣", "7♦ 10♦ J♦ 2♠"]);
  G = applyMove(rules, G, 0, { t: "play", cards: [C("3♦")] }).G;
  G = applyMove(rules, G, 1, { t: "play", cards: [C("A♣")] }).G;
  G = applyMove(rules, G, 2, { t: "pass" }).G;
  ok(G.state.trick.plays.at(-1).cant === false && G.say.text === "Pass", "a pass with a play in hand is 不要 (Pass)");
  G = applyMove(rules, G, 0, { t: "pass" }).G;
  ok(G.state.trick.last === null && G.state.turn === 1, "two passes end the trick: its last player leads");
  ok(/aren't a play/.test(check(G.state, 1, [C("4♦"), C("5♠")]).why || ""), "two different cards aren't a play");
  G = applyMove(rules, G, 1, { t: "play", cards: [C("8♠")] }).G;
  G = applyMove(rules, G, 2, { t: "play", cards: [C("2♠")] }).G;
  G = applyMove(rules, G, 0, { t: "pass" }).G;
  ok(G.state.trick.plays.at(-1).cant === true && G.say.text === "Can't beat it" && G.state.cants.some(c => c[0] === 0 && c[1] === "single" && c[2] === 12), "nothing to beat it with is 要不起 (Can't beat it), and the table notes what it couldn't beat");
  const L = limitsOf({ cants: G.state.cants });
  ok(L.caps[0][13] === 0 && L.caps[0][14] === 0 && L.caps[0][5] === 3 && !L.rocket[0], "要不起 to a two: no joker, no bomb, no rocket in that hand");
}
{
  // a spring: the landlord out before either peasant plays
  let G = table(["3♦ 3♣ 3♥ 4♠ S B", "5♦ 6♠ 8♠ A♣ K♣", "7♦ 10♦ J♦ 2♠ 9♣"]);
  G = applyMove(rules, G, 0, { t: "play", cards: ["S", "B"].map(C) }).G;
  ok(G.state.doubles === 1, "the rocket doubles the stake");
  G = applyMove(rules, G, 1, { t: "pass" }).G;
  G = applyMove(rules, G, 2, { t: "pass" }).G;
  G = applyMove(rules, G, 0, { t: "play", cards: ["3♦", "3♣", "3♥", "4♠"].map(C) }).G;
  const r = G.state.result;
  ok(G.state.step === "shown" && r.won && r.spring && r.unit === 4 && r.deltas.join() === "8,-4,-4", `spring: the rocket and the spring double a stake of 1 to 4; the landlord takes it from each peasant (${r.deltas})`);
}
{
  // an anti-spring: the landlord plays once, the peasants go out
  let G = table(["3♦ 4♣ 9♥ 10♠", "5♦ 6♠", "7♦ 7♣ 2♠ 2♣"]);
  G = applyMove(rules, G, 0, { t: "play", cards: [C("3♦")] }).G;
  G = applyMove(rules, G, 1, { t: "pass" }).G;
  G = applyMove(rules, G, 2, { t: "play", cards: [C("2♠")] }).G;
  G = applyMove(rules, G, 0, { t: "pass" }).G;
  G = applyMove(rules, G, 1, { t: "pass" }).G;
  G = applyMove(rules, G, 2, { t: "play", cards: ["7♦", "7♣"].map(C) }).G;
  G = applyMove(rules, G, 0, { t: "pass" }).G;
  G = applyMove(rules, G, 1, { t: "pass" }).G;
  G = applyMove(rules, G, 2, { t: "play", cards: [C("2♣")] }).G;
  const r = G.state.result;
  ok(r && !r.won && r.anti && r.unit === 2 && r.deltas.join() === "-4,2,2", `anti-spring: the peasants out with the landlord's one lead, the stake doubled (${r?.deltas})`);
}

// ---------- the computer players ----------
{
  const p = plan(cnt("3 4 5 6 7 8 8 8 9 9 9 J Q K A 2 B"));
  ok(p.plays.some(x => x.type === "straight" && x.len === 5) && p.plays.some(x => x.type === "plane1" && x.len === 2) && p.plays.length === 6, `a hand organised: a straight, an airplane with the jack and queen as wings, the rest alone (${p.plays.map(x => x.type).join(", ")})`);
  const q = plan(cnt("3 3 4 4 5 5 6 6 7 7 9 9 9 9"));
  ok(q.plays.some(x => x.type === "pairs" && x.len === 5) && q.plays.some(x => x.type === "bomb"), "pairs in a row kept whole, the four of nines a bomb");
}
const rng = seeded(41);
function playOut(seed, levels, opts = {}) {
  let G = G0(seed, { deals: 2, ...opts }), now = 0, moves = 0, lost = false;
  for (let i = 0; i < 4000 && !rules.over(G.state); i++) {
    const who = rules.toMove(G.state);
    if (who == null) { now = G.state.until; G = applyWake(rules, G, now); continue; }
    const m = botMove(G.state, who, { level: levels[who], rng });
    const r = applyMove(rules, G, who, m, now);
    if (r.error) return { error: `${levels[who]}: ${r.error} ${JSON.stringify(m)}` };
    G = r.G; moves++;
    const s = G.state;
    if (s.step === "play" && s.hands.flat().length + s.played.length !== 54) lost = true;
  }
  return { G, moves, lost };
}
{
  LEVELS.hard.mid = 6;                                                // the test plays Hard's look ahead lightly, for time
  let fine = true, deals = 0, moves = 0;
  for (let g = 0; g < 6; g++) {
    const lv = ["hard", "medium", "easy"].map((_, i) => ["hard", "medium", "easy"][(i + g) % 3]);
    const r = playOut(300 + g, lv, { bidding: g % 2 ? "rob" : "points" });
    if (r.error) { fine = false; console.log(`  ${r.error}`); break; }
    if (r.lost || !rules.over(r.G.state) || r.G.state.scores.reduce((a, b) => a + b, 0) !== 0) { fine = false; console.log("  lost cards, unfinished, or the scores don't balance", r.G.state.scores); }
    deals += r.G.state.log.length; moves += r.moves;
  }
  ok(fine, `whole games of computer players, both biddings: every move legal, every card accounted for, the scores balancing (${deals} deals, ${moves} moves)`);
}
{
  const G = G0(17), back = roundTrip(G);
  const r = applyMove(rules, back, G.state.first, { t: "bid", n: 3 });
  const s = r.G?.state;
  ok(s && s.landlord === G.state.first && s.hands[s.landlord].length === 20 && s.trick.plays.length === 0 && s.cants.length === 0, "the game carries on from what the database gives back");
  let g = r.G;
  g = applyMove(rules, g, s.landlord, { t: "play", cards: [s.hands[s.landlord][19]] }).G;
  const b2 = roundTrip(g);
  ok(applyMove(rules, b2, (s.landlord + 1) % 3, { t: "pass" }).G?.state.trick.passes === 1, "and mid-trick");
}
{
  // a whole game with every state through the database on the way (a table's game is read back after each move)
  let G = roundTrip(G0(23, { deals: 2, bidding: "rob" })), now = 0, fine = true;
  for (let i = 0; i < 3000 && !rules.over(G.state); i++) {
    const who = rules.toMove(G.state);
    if (who == null) { now = G.state.until; G = roundTrip(applyWake(rules, G, now)); continue; }
    const st = rules.restore(JSON.parse(JSON.stringify(G.state)));
    const r = applyMove(rules, G, who, botMove(st, who, { level: "medium", rng }), now);
    if (r.error) { fine = false; console.log(`  ${r.error}`); break; }
    G = roundTrip(r.G);
  }
  ok(fine && rules.over(G.state) && G.state.scores.reduce((a, b) => a + b, 0) === 0, "a whole game read back from the database after every move");
}
{
  // Medium against Easy: each deal played with the sides swapped
  const pts = { medium: 0, easy: 0 };
  for (let d = 0; d < 6; d++) for (const [x, y] of [["medium", "easy"], ["easy", "medium"]]) {
    const lv = [x, y, y];
    const r = playOut(700 + d, lv);
    r.G.state.scores.forEach((v, i) => { pts[lv[i]] += v; });
  }
  ok(pts.medium > pts.easy, `Medium scores more than Easy over 24 deals played both ways (${pts.medium} against ${pts.easy})`);
}

console.log(bad ? `landlord: ${bad} failed` : "landlord: every check passed");
process.exit(bad ? 1 : 0);
