// Pegs (pegs-rules.js, pegs-bot.js): cribbage for two. What a hand counts (fifteens, pairs, runs and double runs, flushes
// and the crib's stricter one, his nobs, against known hands: the 29, the double double run, the nineteen); what a card
// scores in the play (15, 31, pairs and their royals, runs in any order, run and fifteen together); the deal and the
// crib, his heels, the go said by the engine and one for it, one for the last card, 31, the show in its order, and the
// game won at once in the play or in a count; whole games of the three strengths with every card accounted for; the
// state through the database; and the pages wired to it.
import fs from "node:fs";
import { rules, RANKS, rankOf, suitOf, value, short, cardName, countHand, playScore, playable, SHOW_MS, TO } from "../pegs-rules.js";
import { newRecord, applyMove, applyWake, botMove, seeded } from "../seats.js";
import { roundTrip, same as sameKeys } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const SUITS = "♦♣♥♠";
const C = name => { const r = RANKS.indexOf(name.slice(0, -1)), s = SUITS.indexOf(name.slice(-1)); if (r < 0 || s < 0) throw new Error(name); return s * 13 + r; };
const H = s => s.split(" ").map(C);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- cards ----------
check(value(C("A♦")) === 1 && value(C("9♣")) === 9 && value(C("10♥")) === 10 && value(C("J♠")) === 10 && value(C("K♦")) === 10, "an ace is 1, the face cards 10 (for fifteens and the count; runs go by rank)");
check(short(C("7♥")) === "7♥" && cardName(C("Q♠")) === "queen of spades", "names");

// ---------- counting a hand ----------
const count = (hand, starter, o) => countHand(H(hand), C(starter), o);
check(count("5♥ 5♣ 5♠ J♦", "5♦").total === 29, "the 29: three fives and the jack of the starter's suit, the fourth five turned");
check(count("7♦ 7♣ 8♦ 8♣", "9♠").total === 24, "a double double run: four runs of three, two pairs, four fifteens, 24");
check(count("K♦ J♣ 8♠ 6♥", "4♦").total === 0, "nothing at all: the nineteen hand");
{
  const c = count("3♦ 3♣ 4♥ 5♠", "K♦");
  check(c.total === 12 && c.fifteens === 2 && c.pairs === 1 && c.run.len === 3 && c.run.n === 2, "a double run of three, a pair and two fifteens: 12");
}
{
  const c = count("A♦ 3♦ 7♦ 10♦", "8♠");
  check(c.flush === 4 && c.fifteens === 1 && c.total === 6, "four of a suit in the hand is four");
  const d = count("A♦ 3♦ 7♦ 10♦", "8♦");
  check(d.flush === 5 && d.total === 7, "…five with the starter");
  check(count("A♦ 3♦ 7♦ 10♦", "8♠", { crib: true }).flush === 0 && count("A♦ 3♦ 7♦ 10♦", "8♦", { crib: true }).flush === 5, "the crib's flush needs all five");
}
check(count("J♠ 2♦ 6♣ 9♥", "4♠").nobs === 1 && count("J♠ 2♦ 6♣ 9♥", "4♥").nobs === 0, "his nobs: the jack of the starter's suit");
check(count("J♠ 2♦ 6♣ 9♥", "4♠").total === 5, "…a jack, two fifteens (2-4-9, 6-9) and the nobs");
check(count("4♦ 5♣ 6♥ 7♠", "8♦").run.len === 5 && count("4♦ 5♣ 6♥ 7♠", "8♦").total >= 5, "a run of five counts five");
check(count("5♦ 5♣ 5♥ 5♠", "10♦").total === 28 + 0 && count("5♦ 5♣ 5♥ 5♠", "10♦").fifteens === 4 + 4, "four fives and a ten: eight fifteens, six pairs, 28");
check(count("2♦ 3♣ 4♥ 5♠", "A♦").run.len === 5 && count("A♦ 2♣ 3♥ K♠", "Q♦").run.len === 3, "the ace is low: A-2-3 runs, K-Q-A doesn't");
check(count("Q♦ K♣ A♥ 4♠", "7♦").run === null, "…and Q-K-A is not a run");

// ---------- the play's scoring ----------
const ps = s => playScore(H(s));
check(ps("5♦ 10♣").pts === 2 && ps("5♦ 10♣").count === 15, "fifteen: two");
check(ps("K♦ Q♣ J♥ A♠").pts === 2 && ps("K♦ Q♣ J♥ A♠").count === 31, "thirty-one: two");
check(ps("7♦ 7♣").pts === 2 && ps("7♦ 7♣ 7♥").pts === 6 && ps("7♦ 7♣ 7♥ 7♠").pts === 12, "a pair two, three alike six, four alike twelve");
check(ps("K♦ Q♣").pts === 0, "a king and a queen are no pair, though both count ten");
check(ps("3♦ 5♣ 4♥").pts === 3 && ps("7♦ 9♣ 8♥").pts === 3 && ps("2♦ 3♣ 4♥ 5♠").pts === 4, "a run, its cards in any order: as many as its length");
check(ps("9♦ 3♣ 4♥ 5♠").pts === 3 && ps("2♦ 9♣ 3♥ 4♠").pts === 0, "a run is the last cards: an odd one before it doesn't spoil it, one inside does");
check(ps("5♦ 4♣ 6♥").pts === 5, "a run and a fifteen together: 5-4-6 is fifteen (2) and a run (3)");
check(ps("4♦ 4♣ 5♥ 6♠").pts === 3, "a run after a pair counts the run, not the pair");
check(same(playable(H("10♦ 5♣ 9♥"), 22), H("5♣ 9♥")) && playable(H("10♦"), 22).length === 0, "the cards that can go without passing 31");

// ---------- the deal ----------
const R = (seed = 1, opts = {}) => newRecord(rules, { seats: 2, options: opts, seed, now: 0 });
{
  const G = R(6), s = G.state, non = 1 - s.dealer;
  check(s.hands[0].length === 6 && s.hands[1].length === 6 && new Set([...s.hands[0], ...s.hands[1], s.starter]).size === 13, "six cards each and a starter, none twice");
  check(s.step === "discard" && s.opts.to === 121 && rules.toMove(s) === non, "the one who didn't deal sends to the crib first");
  check(/Pick two/.test(applyMove(rules, G, non, { t: "crib", cards: [s.hands[non][0]] }).error || ""), "two cards, not one");
  check(/in your hand/.test(applyMove(rules, G, non, { t: "crib", cards: [s.hands[non][0], s.hands[s.dealer][0]] }).error || ""), "…and from your own hand");
  const g1 = applyMove(rules, G, non, { t: "crib", cards: s.hands[non].slice(0, 2) }).G;
  check(g1.state.hands[non].length === 4 && g1.state.crib.length === 2 && g1.state.step === "discard" && rules.toMove(g1.state) === s.dealer, "two go to the crib, then the dealer's turn");
  check(same(g1.state.keep[non], g1.state.hands[non]), "the four kept are remembered for the show");
  const g2 = applyMove(rules, g1, s.dealer, { t: "crib", cards: s.hands[s.dealer].slice(0, 2) }).G;
  check(g2.state.step === "play" && g2.state.crib.length === 4 && g2.state.turn === non && g2.state.seq.length === 0, "both sent: the play begins, led by the one who didn't deal");
  check(R(2, { to: 61 }).state.opts.to === 61 && R(2, { to: 99 }).state.opts.to === 121 && same(TO, [121, 61]), "a game to 121, or to 61");
}
{
  // his heels: a jack turned is two for the dealer
  let G = R(8);
  const s = G.state, non = 1 - s.dealer;
  s.starter = C("J♦");
  G = applyMove(rules, G, non, { t: "crib", cards: s.hands[non].slice(0, 2) }).G;
  G = applyMove(rules, G, s.dealer, { t: "crib", cards: s.hands[s.dealer].slice(0, 2) }).G;
  check(G.state.scores[s.dealer] === 2 && G.state.last.did === "heels" && G.state.scores[non] === 0, "a jack turned up: his heels, two for the dealer");
  const T = R(8);
  T.state.starter = C("9♦");
  const t2 = applyMove(rules, applyMove(rules, T, 1 - T.state.dealer, { t: "crib", cards: T.state.hands[1 - T.state.dealer].slice(0, 2) }).G, T.state.dealer, { t: "crib", cards: T.state.hands[T.state.dealer].slice(0, 2) }).G;
  check(same(t2.state.scores, [0, 0]), "any other card scores nothing");
}

// ---------- the play ----------
// a deal in the middle of the play: dealer 1, seat 0 to lead, these cards in hand and kept, this crib and starter
function playing(h0, h1, extra = {}) {
  const G = R(9), s = G.state;
  s.dealer = 1; s.step = "play"; s.turn = 0; s.deal = 1;
  s.hands = [H(h0), H(h1)];
  s.keep = [H(h0), H(h1)];
  s.crib = H("2♦ 3♣ 8♥ 9♠"); s.starter = C("4♥"); s.seq = []; s.played = [[], []];
  s.scores = [0, 0]; s.prev = [0, 0]; delete s.show; delete s.won;
  Object.assign(s, extra);
  return { ...G, state: s };
}
const mv = (G, seat, card, now = 0) => applyMove(rules, G, seat, { t: "play", card: C(card) }, now);
{
  // a go: nobody can play, one for go, the other leads; then the last card
  let G = playing("10♥ 9♣", "10♠ 5♦");
  G = mv(G, 0, "10♥").G;
  check(G.state.turn === 1 && countOf(G) === 10, "the count goes up as cards go down");
  G = mv(G, 1, "10♠").G;
  check(G.state.scores[1] === 2 && G.state.last.why === "a pair", "a pair is two to the one who made it");
  G = mv(G, 0, "9♣").G;
  check(G.state.scores[0] === 1 && G.state.last.did === "go" && G.state.seq.length === 0 && G.state.turn === 1, "29, and the 5♦ can't go: one for go, the count starts again, led by the other");
  G = mv(G, 1, "5♦").G;
  check(G.state.scores[1] === 3 && G.state.step === "show" && G.state.show.stage === 0 && G.state.show.seat === 0, "the last card: one, and then the show begins with the one who didn't deal");
  check(/over 31/.test(mv(playing("10♥ 9♣", "10♠ 5♦", { seq: [{ seat: 1, card: C("K♣") }, { seat: 0, card: C("Q♣") }, { seat: 1, card: C("5♣") }] }), 0, "9♣").error || ""), "a card that would pass 31 can't be played");
  check(/isn't your turn/.test(mv(playing("10♥ 9♣", "10♠ 5♦"), 1, "10♠").error || ""), "…nor out of turn");
  check(/isn't in your hand/.test(mv(playing("10♥ 9♣", "10♠ 5♦"), 0, "10♠").error || ""), "…nor a card you don't hold");
}
function countOf(G) { return G.state.seq.reduce((a, e) => a + value(e.card), 0); }
{
  // thirty-one exactly: two, and the count starts again led by the other
  let G = playing("K♥ K♠ 2♦ 6♣", "K♣ A♦ 8♠ 9♥");
  G = mv(G, 0, "K♥").G; G = mv(G, 1, "K♣").G; G = mv(G, 0, "K♠").G;
  check(G.state.scores[0] === 6 && G.state.scores[1] === 2 && countOf(G) === 30, "three kings: a pair royal, six");
  G = mv(G, 1, "A♦").G;
  check(G.state.scores[1] === 4 && G.state.seq.length === 0 && G.state.turn === 0 && G.state.last.why === "thirty-one", "31: two, and the other leads");
  // a player who can't play when the other can goes on: the engine says go for them
  let H2 = playing("9♥ 2♦", "10♣ 8♠ 6♦", { });
  H2 = mv(H2, 0, "9♥").G; H2 = mv(H2, 1, "10♣").G;                                 // 19
  H2 = mv(H2, 0, "2♦").G;                                                          // 21: the other has the 8♠ and the 6♦, neither fits... 21+8 = 29
  check(H2.state.turn === 1, "21 and the other can still play (8♠ makes 29)");
  H2 = mv(H2, 1, "8♠").G;                                                          // 29: the 6♦ can't, and seat 0 is out of cards
  check(H2.state.last.did === "go" && H2.state.last.seat === 1 && H2.state.scores[1] >= 1 && H2.state.turn === 1, "29 and no one can play on: the go is the last player's, who leads on");
}
{
  // the other can't play but I can: I play on, the other says go (shown on the play's line)
  let G = playing("9♥ 2♦ 3♠", "10♣ 8♠");
  G = mv(G, 0, "9♥").G; G = mv(G, 1, "10♣").G;                                    // 19
  G = mv(G, 0, "3♠").G;                                                           // 22: the other's 8♠ is 30, which fits
  check(G.state.turn === 1, "22: 8♠ makes 30, which fits");
  let K = playing("9♥ 2♦ 3♠", "10♣ 10♠");
  K = mv(K, 0, "9♥").G; K = mv(K, 1, "10♣").G;                                    // 19
  K = mv(K, 0, "3♠").G;                                                           // 22: the 10♠ would make 32: the other says go
  check(K.state.turn === 0 && K.state.last.go === 1, "22: the other's 10♠ would pass 31, so they say go and the first plays on");
  K = mv(K, 0, "2♦").G;                                                           // 24, still no
  check(K.state.scores[0] >= 1 && K.state.seq.length === 0 && K.state.turn === 1, "…and having nothing more to play, scores the go");
}
{
  // a game won in the middle of the play, at once
  let G = playing("10♥ 9♣", "10♠ 5♦", { scores: [50, 119], prev: [48, 117] });
  G = mv(G, 0, "10♥").G; G = mv(G, 1, "10♠").G;
  const s = G.state;
  check(rules.over(s) && s.final.winner === 1 && s.scores[1] === 121 && s.final.scores[0] === 50 && s.final.skunk === 2 && same(s.winners, [1]), "121 in the play ends the game there and then (the other left under 61 is double skunked)");
  check(rules.toMove(s) === null && applyMove(rules, G, 0, { t: "play", card: C("9♣") }).error === "The game is over", "nothing moves after");
  const m = playing("10♥ 9♣", "10♠ 5♦", { scores: [80, 119], opts: { to: 121 } });
  const w = mv(mv(m, 0, "10♥").G, 1, "10♠").G.state;
  check(w.final.skunk === 1, "under 91 is a skunk");
  check(playing("10♥ 9♣", "10♠ 5♦", { scores: [100, 119] }) && mv(mv(playing("10♥ 9♣", "10♠ 5♦", { scores: [100, 119] }), 0, "10♥").G, 1, "10♠").G.state.final.skunk === 0, "…and not under 91 after all");
}

// ---------- the show ----------
{
  let G = playing("10♥ 9♣", "10♠ 5♦");
  G.state.keep = [H("5♣ 5♠ 5♥ J♦"), H("2♦ 4♣ 9♦ K♠")]; G.state.starter = C("5♦");
  G = mv(G, 0, "10♥").G; G = mv(G, 1, "10♠").G; G = mv(G, 0, "9♣").G; G = mv(G, 1, "5♦").G;
  const s = G.state, before = [...s.scores];
  check(s.step === "show" && s.show.seat === 0 && s.show.total === 29 && s.until === 0 + SHOW_MS, "the one who didn't deal counts first: the 29");
  check(rules.toMove(s) === null && !rules.over(s), "a count shown is nobody's move");
  const g1 = applyMove(rules, G, 1, { t: "next" }, 10).G.state;
  check(g1.show.stage === 1 && g1.show.seat === 1 && g1.scores[0] === 0 + before[0] && g1.scores[1] === before[1] + g1.show.total, "…then the dealer's hand");
  const g2 = applyMove(rules, { ...G, state: g1 }, 0, { t: "next" }, 20).G.state;
  check(g2.show.stage === 2 && g2.show.seat === 1 && g2.show.cards.length === 4 && g2.crib.length === 4, "…then the dealer counts the crib");
  const g3 = applyMove(rules, { ...G, state: g2 }, 0, { t: "next" }, 30).G.state;
  check(g3.step === "discard" && g3.deal === 2 && g3.dealer === 0 && g3.hands.every(h => h.length === 6) && g3.crib.length === 0, "…and the next deal, the deal passing");
  check(g3.scores[0] === s.scores[0] && g3.scores[1] === g2.scores[1], "the score carries over");
  check(applyWake(rules, G, SHOW_MS - 1) === null && applyWake(rules, G, SHOW_MS)?.state.show.stage === 1, "a count stays up for its time, then the next comes by itself");
  const tap = applyMove(rules, G, 1, { t: "next" }, 5);
  check(!tap.error, "either seat may move it on");
}
{
  // a game won in the count: the first to count wins before the other counts
  let G = playing("10♥ 9♣", "10♠ 5♦", { scores: [118, 115] });
  G.state.keep = [H("5♣ 5♠ 5♥ J♦"), H("2♦ 4♣ 9♦ K♠")]; G.state.starter = C("5♦");
  G = mv(G, 0, "10♥").G; G = mv(G, 1, "10♠").G; G = mv(G, 0, "9♣").G;
  G = mv(G, 1, "5♦").G;
  check(G.state.step === "show" && G.state.won === 0 && G.state.scores[0] === 121, "121 in a count: the game is won as it's counted");
  const done = applyMove(rules, G, 1, { t: "next" }, 5).G.state;
  check(rules.over(done) && done.final.winner === 0 && done.final.loser === 1 && done.scores[1] < 121, "…and the next tap ends it before the dealer counts");
}

// ---------- whole games ----------
function playOut(seed, levels, { record = false } = {}) {
  let G = newRecord(rules, { seats: 2, options: {}, seed, now: 0 }), now = 0, steps = 0, ok = true;
  const seen = [];
  while (!rules.over(G.state) && steps++ < 20000) {
    const st = G.state;
    const tracked = [...st.hands[0], ...st.hands[1], ...st.played[0], ...st.played[1], ...st.crib, st.starter];
    const dealt = 13;
    if (new Set(tracked).size !== tracked.length || (st.step !== "discard" && tracked.length !== dealt) || st.scores.some(v => v > st.opts.to || v < 0)) { ok = false; console.log("  cards", st.step, tracked.length, st.scores); break; }
    const who = rules.toMove(st);
    if (who == null) { now += SHOW_MS; G = applyWake(rules, G, now) || G; continue; }
    const m = botMove(rules, G, who, levels[who]);
    const r = applyMove(rules, G, who, m, now);
    if (r.error) { ok = false; console.log("  refused:", r.error, JSON.stringify(m), st.step); break; }
    G = r.G;
    if (record) seen.push(G);
  }
  return { G, ok: ok && rules.over(G.state), steps, seen };
}
{
  const t0 = Date.now(), games = [];
  for (const levels of [["easy", "easy"], ["medium", "medium"], ["hard", "hard"], ["hard", "easy"]]) for (let seed = 1; seed <= 3; seed++) games.push(playOut(seed * 13, levels));
  check(games.every(g => g.ok), `twelve whole games of the strengths, every move legal and every card in one place (${Date.now() - t0} ms)`);
  check(games.every(g => g.G.state.scores.some(v => v === 121) && g.G.state.final.winner === g.G.state.scores.findIndex(v => v === 121)), "…each ends with one side on 121 and the right winner");
  check(games.every(g => g.G.state.deal >= 3), "…over several deals");
}
{
  let hard = 0, n = 0;
  for (let seed = 1; seed <= 5; seed++) for (const swap of [0, 1]) {
    const { G } = playOut(seed * 29, swap ? ["easy", "hard"] : ["hard", "easy"]);
    n++;
    if (G.state.final.winner === (swap ? 1 : 0)) hard++;
  }
  check(hard >= 6, `Hard beats Easy: ${hard} of ${n} games (it wins about 3 in 5)`);
}

// ---------- through the database ----------
{
  const { seen } = playOut(4, ["hard", "medium"], { record: true });
  const shown = seen.find(g => g.state.step === "show"), inPlay = seen.find(g => g.state.step === "play" && g.state.seq.length >= 2);
  const sample = [R(8), inPlay, shown, seen.at(-1)].filter(Boolean);
  let fine = 0;
  for (const G of sample) if (sameKeys(rules.restore(structuredClone(G.state)), rules.restore(structuredClone(roundTrip(G).state)))) fine++;
  check(fine === sample.length, `a game kept in the database and read back is the same (${sample.length} points in a game)`);
  const back = roundTrip(shown), next = applyMove(rules, back, 0, { t: "next" }, 5);
  check(!next.error && next.G.state.step === "show", "…and goes on from there");
  const lonely = { ...inPlay, state: { ...inPlay.state, seq: [], played: [[], []] } };
  const r = rules.restore(roundTrip(lonely).state);
  check(Array.isArray(r.seq) && r.played.length === 2 && Array.isArray(r.played[0]), "empty lists (a round just begun, nothing played) come back as lists");
}

// ---------- the pages ----------
const apps = fs.readFileSync(root + "apps.js", "utf8"), page = fs.readFileSync(root + "pegs.js", "utf8"), html = fs.readFileSync(root + "pegs.html", "utf8");
check(/id: "pegs",[^\n]*href: "\.\/pegs\.html"[^\n]*logo: LOGO\("pegs", PEGS_LOGO\)/.test(apps) && !/id: "pegs"[^\n]*soon: true/.test(apps), "the tile opens the game, not the placeholder");
check(/seatRounds\("pegs", \["show"\]\)/.test(page) && /noteStreak\("pegs"/.test(page) && /seatPage\(/.test(page) && /bindSwitcher\(\$\("appsBtn"\), "pegs"\)/.test(page), "the page counts a deal as Random's round, notes the streak and sits on seats.js");
check(/pegs\.css/.test(html) && /cards\.css/.test(html) && /pegs\.js/.test(html) && /class="pegs fit-screen beside"/.test(html), "the page links its styles and script");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("pegs: counting, the play, go, 31, heels, the show, the win in play and in count, whole games and the database");
