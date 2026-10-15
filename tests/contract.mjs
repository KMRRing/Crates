// Contract (contract-core.js, contract-sayc.js, contract-play.js, contract-dds.js, contract-rules.js, contract-course.js):
// the score of a deal against the duplicate scoring table; the calls and what may be called, the contract and its
// declarer; the play (following suit, who takes a trick); SAYC's bids for sample hands and what calls show; whole deals
// bid and played by four computer players, every card accounted for and the score as the table says; the double-dummy
// solver against a plain search of small endings, and on a deal whose answer is known; whole deals played by sampling;
// the Chicago match (vulnerability and dealer by deal, a deal passed out dealt again, the end after four); the state
// through the database's round trip; a table of two people and two computer players; the course, every exercise judged
// as it should be (the bids the system's own, the cards to play best with every card seen); and the puzzle rush's bank
// (contract-rush.js, contract-puzzles.js): every puzzle a position its deal reaches, its best card weighed again.
import fs from "fs";
import * as C from "../contract-core.js";
import { chooseCall, readAuction, readingsOf, explainCall, features, openingSuit } from "../contract-sayc.js";
import { chooseCard, sampleDeal, openingLead, leadFrom, voidsOf, dealsFor, goalOf as goalOfSide } from "../contract-play.js";
import { loadSolver } from "../contract-dds.js";
import { rules, DEALS } from "../contract-rules.js";
import { COURSE, parseCards, auctionOf, contractOf as lessonContract, trickOf, playerOf, holdingOf, wantedOf, systemCall, judgeCall, judgeCard } from "../contract-course.js";
import { lessonsOf, progressOf } from "../course.js";
import { newRecord, applyMove, applyWake, botMove, createRunner } from "../seats.js";
import { createTable } from "../table.js";
import { fakeDb } from "./fake-db.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(pred, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) { if (pred()) return true; await sleep(5); } return pred(); }
const H = text => parseCards(text);
const call = (handText, auctionText) => { const a = auctionOf(auctionText); return chooseCall(H(handText), a.calls, a.dealer).call; };

// ---------- the score ----------
{
  const sc = (text, tricks, vul) => C.dealScore(lessonContract(`${text} S`), tricks, vul).score;
  const table = [
    ["1N", 7, false, 90], ["1C", 7, false, 70], ["1C", 13, false, 190], ["2S", 8, false, 110], ["3N", 9, false, 400], ["3N", 9, true, 600], ["3N", 10, true, 630],
    ["4S", 10, false, 420], ["4H", 10, true, 620], ["5C", 11, false, 400], ["5D", 11, true, 600], ["6N", 12, true, 1440], ["6S", 12, false, 980], ["7N", 13, true, 2220],
    ["2HX", 8, false, 470], ["2HX", 8, true, 670], ["1SXX", 7, false, 520], ["7SXX", 13, true, 2940], ["3NX", 10, false, 650], ["4SX", 11, true, 990],
    ["4S", 9, false, -50], ["4S", 7, true, -300], ["4HX", 9, true, -200], ["4HX", 7, false, -500], ["4HX", 6, false, -800], ["3NX", 7, true, -500],
    ["6NXX", 10, false, -600], ["6NXX", 8, false, -1600], ["7NXX", 0, true, -7600], ["7NX", 0, false, -3500],
  ];
  const wrong = table.filter(([c, t, v, want]) => sc(c, t, v) !== want);
  check(!wrong.length, `the duplicate score of ${table.length} results: part-scores, games, slams, doubled and redoubled, overtricks and undertricks by vulnerability${wrong.length ? `: wrong ${wrong.map(([c, t, v, w]) => `${c} ${t} ${v ? "vul" : "nv"} ${sc(c, t, v)} not ${w}`).join("; ")}` : ""}`);
  const r = C.dealScore({ level: 4, strain: 2, doubled: 0 }, 11, false);
  check(r.made && r.over === 1 && r.parts.map(p => p[0]).join() === "Contract,Game,Overtrick" && r.parts.reduce((a, p) => a + p[1], 0) === 450, "a result says where its points came from: 4♥ with an overtrick, 120 + 300 + 30");
  check(C.vulnerability(1, 2).join() === "false,false" && C.vulnerability(2, 3).join() === "false,true" && C.vulnerability(3, 0).join() === "true,false" && C.vulnerability(4, 1).join() === "true,true",
    "Chicago's vulnerability: nobody, then the dealer's side twice, then both");
}

// ---------- the calls ----------
{
  const A = text => auctionOf(text).calls;
  check(C.legalCalls([], 0).length === 36 && !C.legalCalls([], 0).includes("X"), "the first call: a pass or any of the 35 bids, no double");
  const after = C.legalCalls(A("N: 1H"), 3);
  check(after.includes("1S") && !after.includes("1D") && after.includes("X") && !after.includes("XX"), "after 1♥: 1♠ but not 1♦; the next player may double, not redouble");
  check(!C.legalCalls(A("N: 1H P"), 0).includes("X"), "partner's bid can't be doubled");
  check(C.legalCalls(A("N: 1H X"), 0).includes("XX") && !C.legalCalls(A("N: 1H X P"), 1).includes("XX"), "a redouble by the doubled side only");
  check(C.legalCalls(A("N: 1H P P"), 1).includes("X"), "a double of the opponents' bid two passes later");
  check(!C.auctionOver(A("N: 1H P P")) && C.auctionOver(A("N: 1H P P P")) && !C.auctionOver(A("N: P P P")) && C.auctionOver(A("N: P P P P")) && C.passedOut(A("N: P P P P")),
    "three passes after a bid end it; four at the start pass it out");
  const c = C.contractOf(A("N: 1H P 2H P 4H X XX P P P"));
  check(c.level === 4 && c.strain === 2 && c.doubled === 2 && c.declarer === 2, "4♥ redoubled, declared by North who first bid hearts");
  const c2 = C.contractOf(A("S: 1C P 1H P 1N P 3N P P P"));
  check(c2.strain === C.NT && c2.declarer === 0, "3NT declared by South, who first named notrump");
  check(C.callText("2N") === "2NT" && C.callWords("1H") === "one heart" && C.callWords("3N") === "three notrump" && C.contractText({ level: 6, strain: 3, doubled: 1 }) === "6♠ X", "calls in words and as written");
}

// ---------- the play ----------
{
  const hand = H("♠AK5 ♥QJ3 ♦742 ♣K98");
  const led = [{ seat: 1, card: H("♥4")[0] }];
  check(C.legalCards(hand, led).map(C.cardText).sort().join() === "♥3,♥J,♥Q" && C.legalCards(hand, [{ seat: 1, card: H("♣2")[0] }]).length === 3, "follow suit if you can");
  check(C.legalCards(H("♠AK5 ♥QJ3"), [{ seat: 1, card: H("♦2")[0] }]).length === 6, "with none of the suit led, anything");
  const t = cards => H(cards).map((card, i) => ({ seat: i, card }));
  check(C.trickWinner(t("♠5 ♠K ♠2 ♠9"), C.NT) === 1 && C.trickWinner(t("♠A ♠5 ♥2 ♠K"), 2) === 2 && C.trickWinner(t("♠A ♥3 ♥2 ♠K"), 2) === 1 && C.trickWinner(t("♦3 ♠A ♦4 ♣A"), C.NT) === 2,
    "the highest of the suit led takes a trick, or the highest trump");
}

// ---------- SAYC: the system's call for sample hands ----------
{
  const cases = [
    // openings
    ["♠AQ1074 ♥K83 ♦Q5 ♣J62", "S:", "1S", "five spades, 12 points"], ["♠K1074 ♥A83 ♦KJ5 ♣Q62", "S:", "1C", "3-3 in the minors: 1♣"],
    ["♠AK1074 ♥KQJ83 ♦5 ♣62", "S:", "1S", "5-5 in the majors: the higher"], ["♠K104 ♥Q83 ♦KJ5 ♣J962", "S:", "P", "10 points: pass"],
    ["♠KQ4 ♥AJ83 ♦K105 ♣Q62", "S:", "1N", "15–17 balanced: 1NT"], ["♠AQ4 ♥AK83 ♦KQ5 ♣K62", "S:", "2N", "20–21 balanced: 2NT"], ["♠AQ4 ♥AK83 ♦KJ5 ♣Q62", "S:", "1C", "19 balanced: one of a suit, to rebid 2NT"],
    ["♠AKQ4 ♥AK83 ♦AQ5 ♣K2", "S:", "2C", "24 points: 2♣"], ["♠94 ♥KQJ1083 ♦Q75 ♣62", "S:", "2H", "a weak two"],
    ["♠KQJ10842 ♥5 ♦Q75 ♣62", "S:", "3S", "a preempt with seven"], ["♠K74 ♥AQ83 ♦KJ54 ♣62", "S:", "1D", "4-4 in hearts and diamonds, no five: 1♦"],
    ["♠K74 ♥AQ8 ♦QJ5 ♣Q962", "N: P P P", "1C", "fourth seat, the rule of 15 met"], ["♠K7 ♥AQ83 ♦J854 ♣Q62", "N: P P P", "P", "fourth seat, short of the rule of 15"],
    ["♠AQ1074 ♥KQ832 ♦5 ♣62", "S:", "1S", "11 points and the rule of 20"],
    // answering a major
    ["♠K74 ♥Q83 ♦J1054 ♣K62", "N: 1H P", "2H", "a single raise"], ["♠K743 ♥A83 ♦Q1054 ♣K2", "N: 1S P", "2N", "Jacoby 2NT"],
    ["♠Q74 ♥K83 ♦Q1054 ♣K62", "N: 1S P", "3S", "a limit raise"], ["♠K74 ♥83 ♦J1054 ♣K962", "N: 1H P", "1N", "1NT, no fit"],
    ["♠KJ74 ♥83 ♦J1054 ♣K96", "N: 1H P", "1S", "a new suit at the one level"], ["♠74 ♥K83 ♦AQ1054 ♣K62", "N: 1S P", "2D", "two over one"],
    ["♠5 ♥QJ873 ♦K1052 ♣762", "N: 1H P", "4H", "a preemptive raise to game"],
    // answering a minor
    ["♠K74 ♥Q83 ♦J54 ♣KJ62", "N: 1D P", "1N", "1NT over 1♦"], ["♠K74 ♥AQ3 ♦K54 ♣J962", "N: 1C P", "2N", "2NT, 13–15"],
    ["♠K74 ♥QJ83 ♦54 ♣K962", "N: 1D P", "1H", "a major at the one level"], ["♠KJ74 ♥QJ83 ♦54 ♣K96", "N: 1C P", "1H", "two four-card majors: up the line"],
    ["♠KJ743 ♥QJ832 ♦4 ♣K9", "N: 1C P", "1S", "two five-card majors: spades"],
    // opener's rebid
    ["♠K74 ♥Q83 ♦AJ54 ♣K62", "S: 1D P 1S P", "1N", "1NT rebid, 12–14"], ["♠K7 ♥QJ83 ♦A5 ♣Q9862", "S: 1C P 1H P", "2H", "a raise with four"], ["♠K7 ♥QJ83 ♦A5 ♣KJ962", "S: 1C P 1H P", "3H", "a jump raise with 16 counting the doubletons"],
    ["♠K7 ♥AQ83 ♦AJ1054 ♣K2", "S: 1D P 1S P", "2H", "a reverse"], ["♠K7 ♥AQJ1083 ♦K54 ♣62", "S: 1H P 1S P", "2H", "a six-card suit again"],
    ["♠AK74 ♥Q8 ♦K5 ♣KJ962", "S: 1C P 1H P", "1S", "four spades at the one level"], ["♠KQ4 ♥A8 ♦KJ54 ♣AQ62", "S: 1D P 1H P", "2N", "2NT, 18–19"],
    ["♠KQ4 ♥A983 ♦KJ54 ♣62", "S: 1D P 2D P", "P", "a minimum after a single raise: pass"], ["♠KQ4 ♥AK83 ♦KJ54 ♣62", "S: 1D P 2D P", "3D", "16 after a single raise: an invitation"],
    // notrump
    ["♠KJ74 ♥Q83 ♦K54 ♣962", "N: 1N P", "2C", "Stayman"], ["♠KQ74 ♥A83 ♦KJ5 ♣Q62", "S: 1N P 2C P", "2S", "Stayman's answer: four spades"],
    ["♠KQ7 ♥A83 ♦KJ5 ♣Q962", "S: 1N P 2C P", "2D", "Stayman's answer: no major"], ["♠KJ74 ♥Q832 ♦K54 ♣62", "N: 1N P 2C P 2H P", "3H", "the fit found, invitational"],
    ["♠974 ♥QJ832 ♦54 ♣962", "N: 1N P", "2D", "a transfer to hearts"], ["♠KQ4 ♥A83 ♦KJ5 ♣Q962", "S: 1N P 2H P", "2S", "the transfer completed"],
    ["♠KQ4 ♥A83 ♦K54 ♣J962", "N: 1N P", "3N", "3NT to play"], ["♠KQ4 ♥AJ3 ♦KQ5 ♣QJ62", "N: 1N P", "6N", "6NT with 18"],
    ["♠K4 ♥AJ3 ♦KQ5 ♣QJ962", "N: 1N P", "4N", "4NT quantitative with 16"], ["♠K4 ♥83 ♦854 ♣QJ9762", "N: 1N P", "2S", "the relay to 3♣ with a weak minor"],
    ["♠K4 ♥83 ♦QJ9762 ♣854", "N: 1N P 2S P 3C P", "3D", "the relay: diamonds to play"], ["♠974 ♥QJ832 ♦54 ♣962", "N: 1N P 2D P 2H P", "P", "a weak hand passes the transfer"],
    ["♠K74 ♥QJ832 ♦A4 ♣962", "N: 1N P 2D P 2H P", "3N", "five hearts and game values: 3NT, partner chooses"],
    ["♠KJ8742 ♥83 ♦A4 ♣962", "N: 1N P 2H P 2S P", "3S", "six spades, invitational"],
    // competition
    ["♠AQJ74 ♥83 ♦954 ♣K62", "E: 1D", "1S", "an overcall"], ["♠KQ74 ♥3 ♦AJ54 ♣K962", "E: 1H", "X", "a takeout double"],
    ["♠K974 ♥832 ♦J54 ♣962", "W: 1H X P", "1S", "answering a takeout double"], ["♠974 ♥KJ83 ♦A54 ♣962", "N: 1C 1S", "X", "a negative double"],
    ["♠KQ4 ♥A83 ♦KJ5 ♣QJ62", "E: 1S", "1N", "a 1NT overcall"], ["♠5 ♥83 ♦KQJ1084 ♣9762", "E: 1H", "3D", "a weak jump overcall"],
    ["♠5 ♥KQ83 ♦AJ54 ♣K962", "E: 2S", "X", "a takeout double of a weak two"], ["♠K74 ♥Q83 ♦J1054 ♣K62", "N: 1H 2C", "2H", "a raise over their overcall"],
    ["♠K74 ♥Q83 ♦J1054 ♣K62", "W: 1D 1S P", "2S", "raising partner's overcall"], ["♠K74 ♥AQ3 ♦J105 ♣K962", "W: 1D 1S P", "2D", "a cue-bid raise of partner's overcall"],
    // slams, the strong 2♣, weak twos
    ["♠K974 ♥A83 ♦Q54 ♣A62", "N: 1S P 3S P 4N P", "5H", "Blackwood: two aces"], ["♠K974 ♥K83 ♦Q54 ♣A62", "N: 1S P 3S P 4N P", "5D", "Blackwood: one ace"],
    ["♠8743 ♥Q3 ♦J954 ♣762", "N: 2C P", "2D", "the waiting 2♦"], ["♠8743 ♥KQ1083 ♦A54 ♣7", "N: 2C P", "2H", "a positive answer"],
    ["♠A84 ♥Q83 ♦K954 ♣Q62", "N: 2H P", "3H", "a preemptive raise of a weak two"],
  ];
  const wrong = cases.filter(([h, a, want]) => call(h, a) !== want);
  check(!wrong.length, `SAYC's call in ${cases.length} sample positions${wrong.length ? `: wrong ${wrong.map(([h, a, w, why]) => `${why} (${a} with ${h}): ${call(h, a)} not ${w}`).join("; ")}` : ""}`);
  check(openingSuit([3, 4, 3, 3]) === 1 && openingSuit([3, 3, 4, 3]) === 0 && openingSuit([3, 3, 3, 4]) === 0 && openingSuit([4, 4, 3, 2]) === 1 && openingSuit([2, 1, 5, 5]) === 3 && openingSuit([6, 1, 1, 5]) === 0, "the suit to open: the longest, the higher of two five-card suits, the longer minor");
  const f = features(H("♠AQ5 ♥K1072 ♦J83 ♣Q94"));
  check(f.hcp === 12 && f.bal && f.L.join() === "3,3,4,3" && f.stop(3) && !f.stop(1), "a hand's points, shape and stoppers");
}

// ---------- what calls show ----------
{
  const R = text => { const a = auctionOf(text); return readingsOf(a.calls, a.dealer); };
  const one = R("S: 1H")[0];
  check(one.hcp[0] >= 10 && one.hcp[1] === 21 && one.len[2][0] === 5, "1♥ shows 11–21 and five hearts");
  const nt = R("S: 1N")[0];
  check(nt.hcp[0] === 15 && nt.hcp[1] === 17 && nt.bal, "1NT shows 15–17, balanced");
  const st = readAuction(auctionOf("N: 1N P 2C").calls, 2);
  check(st.steps[2].conv === "stayman" && st.R[0].hcp[0] >= 7 && st.R[0].needs.some(n => n([0, 0, 4, 2], 9) && !n([4, 4, 3, 2], 9)), "Stayman asks, showing values and a four-card major");
  const jac = readAuction(auctionOf("N: 1S P 2N").calls, 2);
  check(jac.steps[2].conv === "jacoby" && jac.R[0].len[3][0] === 4 && jac.steps[2].gf, "Jacoby 2NT: four spades, game forcing");
  const neg = readAuction(auctionOf("N: 1C 1S X").calls, 2);
  check(neg.steps[2].conv === "negative" && neg.R[0].hcp[0] >= 6, "a negative double");
  const tx = readAuction(auctionOf("W: 1H X").calls, 1);
  check(tx.steps[1].conv === "takeout" && tx.R[2].hcp[0] >= 12, "a takeout double: 12 or more");
  const pass = R("S: P P")[0];
  check(pass.hcp[1] <= 12, "a pass in first seat says no opening");
  check(/15–17/.test(explainCall(auctionOf("S: 1N").calls, 0, 0)) && /Stayman/.test(explainCall(auctionOf("N: 1N P 2C").calls, 2, 2)) && /Jacoby transfer/.test(explainCall(auctionOf("N: 1N P 2D").calls, 2, 2)),
    "calls explained in words: the 1NT opening's range, Stayman, a transfer");
  // the human's call no rule makes is read plainly
  const odd = readAuction(auctionOf("S: 1H P 5C").calls, 0);
  check(odd.R[2].len[0][0] >= 4, "a call no rule makes still reads as natural: five clubs shows clubs");
}

// ---------- whole deals by four computer players ----------
function playDeal(seed, { level = "easy", solver = null, think = null } = {}) {
  const r = rng(seed);
  let s = rules.deal({ options: { dealer: seed % 4 }, rng: r });
  let illegal = 0, calls = 0;
  for (let k = 0; k < 400 && (s.step === "bid" || s.step === "play" || s.step === "trick" || s.step === "passed"); k++) {
    if (s.step === "trick" || s.step === "passed") { s = rules.wake(s, { rng: r, now: 1e15 }); if (s.step === "bid" && !s.auction.length && k) break; continue; }
    const seat = rules.toMove(s);
    let m;
    if (s.step === "play" && solver) m = { t: "card", card: chooseCard(s, seat, solver, { ...think, rng: r }).card };
    else m = rules.bot(s, seat, { level, rng: r });
    if (m.t === "call") calls++;
    const next = rules.act(JSON.parse(JSON.stringify(s)), seat, m, { rng: r, now: 0 });
    if (typeof next === "string") { illegal++; break; }
    s = next;
  }
  return { s, illegal, calls };
}
{
  let illegal = 0, played = 0, wrongCount = 0, wrongScore = 0, passed = 0, made = 0;
  for (let k = 0; k < 60; k++) {
    const { s, illegal: il } = playDeal(1000 + k);
    illegal += il;
    if (s.step === "bid" && !s.auction.length) { passed++; continue; }
    if (s.step !== "scored") { illegal++; continue; }
    played++;
    const all = s.tricks.flatMap(t => t.cards.map(x => x.card));
    if (s.tricks.length !== 13 || new Set(all).size !== 52 || s.hands.some(h => h.length)) wrongCount++;
    // every trick's cards came from the seat that played it, as dealt
    if (s.tricks.some(t => t.cards.some(x => !s.dealt[x.seat].includes(x.card)))) wrongCount++;
    const side = C.sideOf(s.contract.declarer), took = s.tricks.filter(t => C.sideOf(t.winner) === side).length;
    const want = C.dealScore(s.contract, took, s.vul[side]).score;
    if (s.result.tricks !== took || s.result.score !== want || s.scores[want >= 0 ? side : 1 - side] !== Math.abs(want)) wrongScore++;
    if (s.result.made) made++;
  }
  check(!illegal && played >= 50, `60 deals bid and played by four computer players, every call and card legal (${played} played, ${passed} passed out and dealt again, ${made} contracts made)`);
  check(!wrongCount, "every deal: thirteen tricks, every card played once, each from the hand it was dealt to");
  check(!wrongScore, "every deal scored as the table says: the declaring side's tricks, the score by vulnerability");
}

// ---------- the double-dummy solver ----------
const dds = await loadSolver(fs.readFileSync(new URL("../vendor/dds/dds.wasm", import.meta.url)));
{
  /** Tricks the side to move takes from here, everyone at their best, by plain search (small endings only). */
  function search(hands, trick, strain, toMove) {
    const left = Math.max(...hands.map(h => h.length)) + (trick.length ? 1 : 0);
    if (!left) return 0;
    let best = -1;
    for (const c of C.legalCards(hands[toMove], trick)) best = Math.max(best, cardTricks(hands, trick, strain, toMove, c));
    return best;
  }
  function cardTricks(hands, trick, strain, toMove, c) {
    const me = C.sideOf(toMove), h2 = hands.map((h, p) => (p === toMove ? h.filter(x => x !== c) : h)), t2 = [...trick, { seat: toMove, card: c }];
    if (t2.length === 4) {
      const w = t2[C.trickWinner(t2, strain)].seat, rest = h2.every(h => !h.length) ? 0 : search(h2, [], strain, w);
      const after = Math.max(...h2.map(h => h.length));
      return C.sideOf(w) === me ? 1 + rest : after - rest;
    }
    const nx = (toMove + 1) % 4, r = search(h2, t2, strain, nx), total = Math.max(...hands.map(h => h.length));
    return C.sideOf(nx) === me ? r : total - r;
  }
  let n = 0, diff = 0;
  for (let k = 0; k < 120; k++) {
    const r = rng(k + 7), size = 2 + (k % 3), pack = Array.from({ length: 52 }, (_, i) => i);
    for (let i = 51; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pack[i], pack[j]] = [pack[j], pack[i]]; }
    const leader = k % 4, played = k % 4, strain = Math.floor(r() * 5), hands = [0, 1, 2, 3].map(p => pack.slice(p * size, p * size + size));
    const trick = [];
    for (let i = 0; i < played; i++) { const seat = (leader + i) % 4, c = C.legalCards(hands[seat], trick)[0]; hands[seat] = hands[seat].filter(x => x !== c); trick.push({ seat, card: c }); }
    const toMove = (leader + played) % 4, res = dds.solve(hands, trick, strain, leader);
    for (const c of C.legalCards(hands[toMove], trick)) { n++; if (res.get(c) !== cardTricks(hands, trick, strain, toMove, c)) diff++; }
  }
  check(n > 200 && !diff, `the solver against a plain search of ${n} cards in small endings, every strain, mid-trick too: ${diff} differ`);
  // a deal with a known answer: each hand a whole suit; the hand on lead takes every trick in its own suit as trumps
  const suits = [0, 1, 2, 3].map(s => Array.from({ length: 13 }, (_, r) => s * 13 + r));
  const res = dds.solve([suits[3], suits[2], suits[1], suits[0]], [], 3, 0);
  check([...res.values()].every(t => t === 13) && res.size === 13, "South holding every spade, spades trumps, on lead: thirteen tricks whatever card");
  const resNT = dds.solve([suits[3], suits[2], suits[1], suits[0]], [], C.NT, 1);
  check([...resNT.values()].every(t => t === 13), "the same in notrump with West on lead: West's hearts take all thirteen");
  const t0 = Date.now(), r = rng(3);
  for (let k = 0; k < 6; k++) dds.solve(C.dealHands(r), [], k % 5, k % 4);
  console.log(`     a full deal solved in ${((Date.now() - t0) / 6).toFixed(0)} ms on average here`);
}

// ---------- the play by sampling ----------
{
  // dealing the unseen hands: sizes, voids, what the auction showed
  const r = rng(11);
  let s = rules.deal({ options: { dealer: 0 }, rng: r });
  s.hands = [H("♠AKQJ ♥AKQ ♦AKQ ♣AKQ"), H("♠5432 ♥5432 ♦5432 ♣5"), H("♠T98 ♥T98 ♦T98 ♣T987"), H("♠76 ♥J76 ♦J76 ♣J6432")];
  s.dealt = s.hands.map(h => [...h]);
  s.auction = auctionOf("S: 7N P P P").calls;
  s.contract = C.contractOf(s.auction);
  s.step = "play";
  s.turn = 1;
  const lead = H("♣5")[0];
  s = rules.act(s, 1, { t: "card", card: lead }, { rng: r, now: 0 });
  check(s.dummyShown && s.turn === 2, "after the opening lead dummy is shown, and dummy's card is declarer's to play");
  const deals = Array.from({ length: 20 }, () => sampleDeal(s, 0, r)).filter(Boolean);
  const okSizes = deals.every(d => d.every((h, p) => h.length === s.hands[p].length) && new Set(d.flat()).size === d.flat().length);
  check(deals.length === 20 && okSizes && deals.every(d => d[0].join() === s.hands[0].join() && d[2].join() === s.hands[2].join()), "deals of the unseen hands keep declarer's and dummy's cards, each hand's size, no card twice");
  // West showed out of nothing yet; give East a known void and check it's kept
  s.tricks = [{ cards: [{ seat: 1, card: H("♦5")[0] }, { seat: 2, card: H("♦T")[0] }, { seat: 3, card: H("♣2")[0] }, { seat: 0, card: H("♦A")[0] }], winner: 0 }];
  check(voidsOf({ ...s, trick: [] })[3].has(1), "a seat that didn't follow is known void");
  const z = rng(5), cards = [];
  const full = rules.deal({ options: { dealer: 0 }, rng: z });
  let st = full;
  while (st.step === "bid") st = rules.act(st, rules.toMove(st), rules.bot(st, rules.toMove(st), { level: "hard", rng: z }), { rng: z, now: 0 });
  if (st.step === "play") {
    const seat = rules.toMove(st), legal = C.legalCards(st.hands[st.turn], st.trick);
    const pick = chooseCard(st, seat, dds, { deals: 6, ms: 3000, rng: z, leadBySampling: true });
    check(legal.includes(pick.card) && pick.list.length >= 1 && pick.list.every(x => x.n >= 1 && x.make >= 0 && x.make <= 1), `the opening lead by sampling: a legal card, each weighed over ${pick.list[0]?.n} deals`);
    cards.push(pick.card);
  }
  // a cold contract is made: thirteen top tricks in notrump
  let cold = rules.deal({ options: { dealer: 0 }, rng: z });
  cold.hands = [H("♠AKQJ ♥AKQ ♦AKQ ♣AKQ"), H("♠5432 ♥5432 ♦5432 ♣5"), H("♠T98 ♥T98 ♦T98 ♣T987"), H("♠76 ♥J76 ♦J76 ♣J6432")];
  cold.dealt = cold.hands.map(h => [...h]);
  cold.auction = auctionOf("S: 7N P P P").calls;
  cold.contract = C.contractOf(cold.auction);
  cold.step = "play";
  cold.turn = 1;
  for (let k = 0; k < 80 && cold.step !== "scored"; k++) {
    if (cold.step === "trick") { cold = rules.wake(cold, { rng: z, now: 1e15 }); continue; }
    const seat = rules.toMove(cold), c = chooseCard(cold, seat, dds, { deals: 4, ms: 500, rng: z }).card;
    cold = rules.act(cold, seat, { t: "card", card: c }, { rng: z, now: 0 });
  }
  check(cold.step === "scored" && cold.result.tricks === 13 && cold.result.score === 1520, "a cold grand slam played by sampling takes all thirteen: 7NT, 1520");
  // whole deals played by sampling on both sides
  let legalAll = true, finished = 0;
  const t0 = Date.now();
  for (let k = 0; k < 2; k++) {
    const { s: done, illegal } = playDeal(2000 + k, { level: "hard", solver: dds, think: { deals: 5, ms: 400 } });
    if (illegal) legalAll = false;
    if (done.step === "scored") finished++;
  }
  check(legalAll && finished >= 1, `whole deals played by sampling, every card legal (${finished} finished, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

// ---------- opening leads by the rules ----------
{
  check(C.cardText(leadFrom(H("♠KQJ4"))) === "♠K" && C.cardText(leadFrom(H("♠KJ742"), { nt: true })) === "♠4" && C.cardText(leadFrom(H("♠94"))) === "♠9" && C.cardText(leadFrom(H("♠AK53"))) === "♠A",
    "leads by convention: the top of a sequence, fourth best, the top of a doubleton, the ace from ace-king");
  const s = { hands: [H("♠KQJ4 ♥83 ♦9754 ♣K62"), [], [], []], contract: { level: 4, strain: 2, doubled: 0, declarer: 3 }, auction: auctionOf("E: 1H P 4H P P P").calls, dealer: 3, tricks: [], trick: [], turn: 0 };
  check(C.cardText(openingLead(s, 0)) === "♠K", "against 4♥, the king of spades from K-Q-J");
  const s2 = { ...s, hands: [H("♠9 ♥83 ♦9754 ♣KQ6542"), [], [], []], auction: auctionOf("E: 1H P 1S 2C 4H P P P").calls };
  check(C.suitOf(openingLead(s2, 0)) === 0, "partner's suit... or here your own: the clubs you bid");
  const s3 = { ...s, hands: [H("♠9762 ♥83 ♦QJ109 ♣K62"), [], [], []], auction: auctionOf("E: 1H P 2H 3D 4H P P P").calls };
  check(C.cardText(openingLead(s3, 0)) === "♦Q", "partner bid diamonds: lead one, the top of the sequence");
}

// ---------- the Chicago match ----------
{
  const r = rng(77);
  let s = rules.deal({ options: { dealer: 3 }, rng: r });
  const seen = [];
  for (let k = 0; k < 3000 && s.step !== "over"; k++) {
    if (s.step === "bid" && !s.auction.length) seen.push([s.no, s.dealer, s.vul.join()].join("|"));
    if (rules.wakeAt(s) != null) { s = rules.wake(s, { rng: r, now: 1e15 }); continue; }
    const seat = rules.toMove(s);
    s = rules.act(s, seat, rules.bot(s, seat, { level: "easy", rng: r }), { rng: r, now: 0 });
  }
  const firsts = [...new Set(seen)].map(x => x.split("|"));
  const byDeal = n => firsts.find(x => Number(x[0]) === n);
  check(s.step === "over" && s.history.length === DEALS, "a match is four deals, then over");
  check(byDeal(1)[1] === "3" && byDeal(2)[1] === "0" && byDeal(3)[1] === "1" && byDeal(4)[1] === "2", "the dealer moves clockwise: East, South, West, North");
  check(byDeal(1)[2] === "false,false" && byDeal(2)[2] === "true,false" && byDeal(3)[2] === "false,true" && byDeal(4)[2] === "true,true", "nobody vulnerable, then the dealer's side (North–South, then East–West), then both");
  const total = [0, 0];
  for (const h of s.history) total[h.ns >= 0 ? 0 : 1] += Math.abs(h.ns);
  check(total.join() === s.scores.join() && (s.scores[0] === s.scores[1] ? !s.winners.length : s.winners.length === 2), `the running score adds up (${s.scores.join(" to ")}) and names the winners`);
  // a deal everyone passes is dealt again: the same deal number and dealer
  let p = rules.deal({ options: { dealer: 1 }, rng: rng(5) });
  for (let k = 0; k < 4; k++) p = rules.act(p, rules.toMove(p), { t: "call", call: "P" }, { rng: r, now: 0 });
  check(p.step === "passed" && rules.toMove(p) === null, "four passes: the deal is passed out");
  const before = p.dealt.map(h => h.join()).join("|");
  p = rules.wake(p, { rng: rng(6), now: p.until });
  check(p.step === "bid" && p.no === 1 && p.dealer === 1 && p.dealt.map(h => h.join()).join("|") !== before && !p.auction.length, "and dealt again by the same dealer, the deal number unchanged");
  check(rules.act(p, (p.turn + 1) % 4, { t: "call", call: "P" }, { rng: r, now: 0 }) === "It isn't your turn" && rules.act(p, p.turn, { t: "call", call: "XX" }, { rng: r, now: 0 }) === "That call isn't allowed now", "a call out of turn, or one that isn't allowed, is refused");
}

// ---------- seats.js and the database ----------
{
  let G = newRecord(rules, { seats: 4, seed: 42, now: 0 });
  const back = roundTrip(G);
  check(back.state.auction === undefined || back.state.auction.length === 0, "an empty auction is dropped by the database");
  const r2 = applyMove(rules, back, G.state.turn, { t: "call", call: "P" }, 1);
  check(!r2.error && r2.G.state.auction.length === 1, "restore makes a state read back from the database whole again, and play goes on");
  // a game played move by move through the database's round trip
  let ok = true;
  for (let k = 0; k < 400 && !rules.over(G.state); k++) {
    const st = rules.restore(JSON.parse(JSON.stringify(G.state)));
    const w = applyWake(rules, G, 1e15 + k * 1e6);
    if (w) { G = roundTrip(w); continue; }
    const seat = rules.toMove(st);
    if (seat == null) break;
    const m = botMove(rules, G, seat, "easy"), r = applyMove(rules, G, seat, m, k);
    if (r.error) { ok = false; console.log("     refused:", r.error, JSON.stringify(m)); break; }
    G = roundTrip(r.G);
    if (G.state.step === "over") break;
  }
  check(ok && rules.over(G.state), "a whole match through the database, each move's state read back from it");
}

// ---------- at a table: two people and two computer players ----------
{
  const db = fakeDb(), devices = [];
  function device(uid, name) {
    const d = { uid, name, last: null };
    d.table = createTable({ game: "contract", app: 1, max: 4, sync: db.device(uid), backupMs: 400, onState: () => d.runner?.update(), onLeave: () => {} });
    d.runner = createRunner({ rules, table: d.table, pace: 2, botName: s => C.SEATS[s], level: () => "easy", onView: v => { d.last = v; } });
    devices.push(d);
    return d;
  }
  const host = device("h", "Korbi"), guest = device("g", "Sarah");
  const code = await host.table.open({ name: "Korbi", pid: "pk" });
  await db.settle();
  check(await guest.table.join(code, { name: "Sarah", pid: "ps" }) === "ok", "Sarah sits down at Korbi's table");
  await db.settle();
  // partners across: the guest in North's seat, as Party seats two at a four-seat table
  const branch = db.read(`crates/rooms/${code}/contract`);
  const sarah = Object.values(branch.players).find(p => p.name === "Sarah");
  await host.table.act(cur => { cur.players[Object.keys(cur.players).find(k => cur.players[k].name === "Sarah")].seat = 2; });
  await db.settle(8);
  await host.runner.deal({}, 4);
  await db.settle(8);
  check(host.last.G?.seats === 4 && host.last.seats.map(x => (x.bot ? "bot" : x.name)).join() === "Korbi,bot,Sarah,bot" && guest.last.seat === 2, `Korbi South, Sarah North, the computer East and West${sarah ? "" : " (seated)"}`);
  let moves = 0;
  for (let k = 0; k < 600; k++) {
    await until(() => host.last.state.step === "scored" || [0, 2].includes(host.last.toMove), 2000);
    const st = host.last.state;
    if (st.step === "scored" || st.step === "over") break;
    const who = host.last.toMove === 0 ? host : guest;
    await until(() => who.last.toMove === who.last.seat, 500);
    if (who.last.toMove !== who.last.seat) continue;
    const m = rules.bot(who.last.state, who.last.seat, { level: "easy", rng: Math.random });
    if (!(await who.runner.move(m))) moves++;
    await db.settle(4);
  }
  await until(() => host.last.state.step === "scored" && guest.last.state.step === "scored", 3000);
  check(host.last.state.step === "scored" && guest.last.state.step === "scored" && moves > 0 && host.last.G.n === guest.last.G.n, `a whole deal at the table, both phones seeing it the same (${moves} moves by the two people)`);
  const s = host.last.state, mine = guest.last.state.hands;
  check(s.result && mine.every(h => !h.length), "the deal scored on both");
  for (const d of devices) d.runner.stop();
}

// ---------- the course ----------
{
  const L = lessonsOf(COURSE);
  check(L.length >= 20 && new Set(L.map(x => x.lesson.id)).size === L.length && L.every(x => x.lesson.title && x.lesson.steps.length), `${L.length} lessons, each with its own id, a title and steps`);
  const last = L.at(-1).lesson;
  check(last.steps.at(-1).play === true && L.every(x => x.lesson === last || x.lesson.steps.every(s => !s.play)), "the last lesson ends in a match, and only it");
  const problems = [];
  let bids = 0, plays = 0, taps = 0, quizzes = 0, ddChecked = 0;
  for (const { lesson } of L) lesson.steps.forEach((st, i) => {
    const where = `${lesson.id} step ${i + 1}`;
    if (!st.say) problems.push(`${where}: no words`);
    let seen;
    try {
      seen = [...(st.hand ? H(st.hand) : []), ...(st.dummy ? H(st.dummy) : []), ...(st.trick ? H(st.trick) : []), ...Object.values(st.deal || {}).flatMap(H)];
      for (const r of st.rows || []) if (r.cards) H(r.cards);
    } catch (e) { problems.push(`${where}: ${e.message}`); return; }
    if (new Set(seen).size !== seen.length) problems.push(`${where}: a card shown twice`);
    if (st.contract && !lessonContract(st.contract)) problems.push(`${where}: no contract "${st.contract}"`);
    if (st.goal === "bid") {
      bids++;
      const a = auctionOf(st.auction);
      if (!a) { problems.push(`${where}: no auction`); return; }
      if ((a.dealer + a.calls.length) % 4 !== 0) problems.push(`${where}: it isn't South's call`);
      if (a.calls.some((x, k) => !C.legalCalls(a.calls.slice(0, k), x.seat).includes(x.call))) problems.push(`${where}: an illegal call in the auction`);
      if (H(st.hand).length !== 13) problems.push(`${where}: the hand isn't thirteen cards`);
      const sys = systemCall(st).call;
      if (sys !== st.answer) problems.push(`${where}: the system calls ${sys}, the lesson says ${st.answer}`);
      if (!judgeCall(st, st.answer).ok) problems.push(`${where}: the answer judged wrong`);
      const other = C.legalCalls(a.calls, 0).find(c => c !== st.answer);
      if (judgeCall(st, other).ok) problems.push(`${where}: another call judged right`);
    }
    if (st.goal === "play") {
      plays++;
      const holding = holdingOf(st), ans = H(st.answer)[0], t = trickOf(st);
      if (!holding.includes(ans)) problems.push(`${where}: the answer isn't in the hand that plays`);
      else if (!judgeCard(st, ans).ok) problems.push(`${where}: the answer judged wrong: ${judgeCard(st, ans).why}`);
      for (const w of Object.keys(st.wrong || {})) { const c = H(w)[0]; if (!holding.includes(c) || judgeCard(st, c).ok) problems.push(`${where}: the wrong card ${w} isn't judged wrong`); }
      const legal = C.legalCards(holding, t), right = legal.filter(c => judgeCard(st, c).ok);
      if (!right.length) problems.push(`${where}: no card is right`);
      // with every hand given: the lesson's card is as good as any with every card seen
      if (st.deal) {
        const hands = [H(st.hand), H(st.deal.W), H(st.dummy), H(st.deal.E)];
        const sizes = hands.map(h => h.length), played = new Set(t.map(x => x.seat));
        const n = Math.max(...sizes);
        if (hands.some((h, p) => h.length !== n - (played.has(p) ? 1 : 0))) problems.push(`${where}: the hands' sizes don't fit the trick (${sizes.join(", ")})`);
        else {
          const c = lessonContract(st.contract), res = dds.solve(hands, t, c.strain, t.length ? t[0].seat : playerOf(st)), best = Math.max(...res.values());
          ddChecked++;
          for (const x of right) if (res.get(x) !== best) problems.push(`${where}: ${C.cardText(x)} takes ${res.get(x)} with every card seen, the best ${best}`);
        }
      }
    }
    if (st.tap) {
      taps++;
      const want = wantedOf(st);
      if (!want.length || want.length === H(st.hand).length && st.tap === "honours") problems.push(`${where}: nothing (or everything) to tap`);
    }
    if (st.quiz) {
      quizzes++;
      if (!(st.answer >= 0 && st.answer < st.quiz.length) || !st.why) problems.push(`${where}: the quiz's answer isn't an option, or no words for it`);
      if (st.score) {
        const c = lessonContract(st.score.contract), sc = Math.abs(C.dealScore(c, st.score.tricks, st.score.vul).score);
        if (String(sc) !== st.quiz[st.answer]) problems.push(`${where}: the score is ${sc}, the answer ${st.quiz[st.answer]}`);
      }
      if (st.hand && /How many high-card points/.test(st.say) && String(C.hcp(H(st.hand))) !== st.quiz[st.answer]) problems.push(`${where}: the hand has ${C.hcp(H(st.hand))} points`);
    }
  });
  check(!problems.length, `every exercise works: ${bids} calls the system makes, ${plays} cards to play (${ddChecked} checked with every card seen), ${taps} hands to tap through, ${quizzes} questions`);
  for (const p of problems) console.log(`     ${p}`);
  const store = {};
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
  let pr = progressOf("contract", COURSE);
  check(pr.done === 0 && pr.next.lesson.id === L[0].lesson.id, "nothing done yet: the first lesson next");
  store["contract:course"] = JSON.stringify({ done: { tricks: 1, trumps: 2 }, at: null });
  pr = progressOf("contract", COURSE);
  check(pr.done === 2 && pr.next.lesson.id === L[2].lesson.id, "two lessons done: the third next");
}

// ---------- the puzzle rush ----------
{
  const { PUZZLES } = await import("../contract-puzzles.js");
  const { stateOf, stepOf, judge, askText, whyText, motifsOf } = await import("../contract-rush.js");
  const problems = [], ids = new Set();
  let declaring = 0;
  for (const p of PUZZLES) {
    if (ids.has(p.id)) problems.push(`${p.id}: twice`);
    ids.add(p.id);
    let s;
    try { s = stateOf(p); } catch (e) { problems.push(`${p.id}: ${e.message}`); continue; }
    const dealt = p.dealt.map(H);
    if (dealt.some(h => h.length !== 13) || new Set(dealt.flat()).size !== 52) problems.push(`${p.id}: not one pack dealt thirteen each`);
    if (s.step !== "play" || !(s.turn === 0 || (s.turn === 2 && s.contract.declarer === 0))) { problems.push(`${p.id}: not South's card (or dummy's, South declaring)`); continue; }
    if (s.contract.declarer === 0) declaring++;
    const legal = C.legalCards(s.hands[s.turn], s.trick).map(C.cardText);
    if (legal.sort().join() !== [...p.opts].sort().join()) problems.push(`${p.id}: the cards weighed (${p.opts.join(" ")}) aren't the ones it may play (${legal.join(" ")})`);
    const top = Math.max(...p.make), at = n => p.make[p.opts.indexOf(n)];
    if (!p.ok.includes(p.best) || at(p.best) !== top || p.ok.some(n => !p.opts.includes(n) || top - at(n) > 1)) problems.push(`${p.id}: the best isn't the best, or one as good isn't`);
    if (p.opts.some(n => !p.ok.includes(n) && top - at(n) < 25)) problems.push(`${p.id}: a card not as good is within 25 points of the best`);
    if (!(p.r >= 1 && p.r <= 10)) problems.push(`${p.id}: no rating`);
    if (motifsOf(s, H(p.best)[0]).join() !== (p.why || []).join()) problems.push(`${p.id}: what the best does isn't found again`);
    const step = stepOf(p), wrong = p.opts.find(n => !p.ok.includes(n));
    if (!judgeCard(step, H(p.best)[0]).ok || (wrong && judgeCard(step, H(wrong)[0]).ok) || p.ok.some(n => !judgeCard(step, H(n)[0]).ok)) problems.push(`${p.id}: the stage's judging doesn't agree`);
    if (judge(p, p.best).verdict !== "best" || (wrong && judge(p, wrong).verdict !== "wrong") || p.ok.filter(n => n !== p.best).some(n => judge(p, n).verdict !== "fine")) problems.push(`${p.id}: the verdicts`);
    if (!/needs \d+ of the last \d+ to (make|beat) it\. Still out: .*(Your|Dummy.s) card\.$/.test(askText(p))) problems.push(`${p.id}: the question's words`);
    if ((p.why || []).length && !whyText(p)) problems.push(`${p.id}: no words for what it does`);
  }
  const byRating = Array.from({ length: 10 }, (_, r) => PUZZLES.filter(p => p.r === r + 1).length);
  check(PUZZLES.length >= 100 && !problems.length, `${PUZZLES.length} puzzles (${declaring} declaring, the rest defending), each a position the deal reaches, South's card, the cards weighed those it may play, the best clear of the rest by 25 points of the deals, the stage and the verdict judging alike`);
  for (const x of problems.slice(0, 12)) console.log(`     ${x}`);
  check(byRating.every(n => n >= 5), `every rating stocked: ${byRating.join(" ")}`);
  // a puzzle from each rating weighed again over deals of its own: the best still makes or beats it more often
  const z = rng(77), again = [];
  for (let r = 1; r <= 10; r++) {
    const p = PUZZLES.find(q => q.r === r);
    if (!p) continue;
    const s = stateOf(p), g = goalOfSide(s, s.turn), hands = dealsFor(s, rules.toMove(s), z, 60), made = new Map(p.opts.map(n => [n, 0]));
    for (const h of hands) {
      const res = dds.solve(h, s.trick, s.contract.strain, s.turn);
      for (const n of p.opts) if (g.won + res.get(H(n)[0]) >= g.need) made.set(n, made.get(n) + 1);
    }
    const best = made.get(p.best), rival = Math.max(...p.opts.filter(n => !p.ok.includes(n)).map(n => made.get(n)));
    again.push({ id: p.id, ok: best > rival, best: Math.round((100 * best) / hands.length), rival: Math.round((100 * rival) / hands.length) });
  }
  check(again.every(x => x.ok), `a puzzle of each rating weighed again over 60 deals of its own, the best still ahead (${again.map(x => `${x.best}–${x.rival}`).join(", ")})`);
}

console.log(bad ? `\ncontract: ${bad} failed` : "\ncontract: every check passed");
process.exit(bad ? 1 : 0);
