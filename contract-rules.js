// Contract on seats.js: a Chicago match of four deals at a table of four, North–South against East–West. Each deal is
// dealt, bid (the auction), played a trick at a time (dummy's cards laid out after the opening lead, played by
// declarer) and scored as duplicate scores it; the dealer moves clockwise and the vulnerability with the deal (none;
// the dealer's side; the dealer's side; both). A deal everyone passes is dealt again. The rules are contract-core.js's,
// the computer's bidding contract-sayc.js's and its card play contract-play.js's.
import { dealHands, legalCalls, auctionOver, passedOut, contractOf, legalCards, trickWinner, sideOf, partnerOf, nextSeat, dealScore,
  vulnerability, vulText, contractWords, SIDES, NT } from "./contract-core.js";
import { chooseCall } from "./contract-sayc.js";
import { playByRules } from "./contract-play.js";

export const TRICK_MS = 1200;          // a trick taken stays on the table this long
export const DEAL_MS = 7000;           // a deal's result, shown before the next deal
export const PASS_MS = 2600;           // a deal passed out, shown before it's dealt again
export const DEALS = 4;

/** The seat whose card it is: declarer plays dummy's. */
export const dummyOf = s => (s.contract ? partnerOf(s.contract.declarer) : null);
const sideName = side => `{s${side}} and {s${side + 2}}`;

function newDeal(s, rng) {
  s.hands = dealHands(rng);
  s.dealt = s.hands.map(h => [...h]);
  s.auction = [];
  s.step = "bid";
  s.turn = s.dealer;
  s.contract = null;
  s.trick = [];
  s.tricks = [];
  s.won = [0, 0];
  s.dummyShown = false;
  delete s.result;
  delete s.until;
}

// Moves worked out ahead, off the page's thread (contract-worker.js), for the decision each answers: the table's move
// takes one when it's there instead of playing by the rules of thumb (seats.js asks for a move then and there).
const ahead = new Map();
/** A decision, told apart from any other: the deal, the auction or the cards so far, the seat, its level. */
export const aheadKey = (s, seat, level) => [level, s.no, s.dealer, s.dealt?.[0]?.join("."), s.step, seat, s.auction.length, s.tricks.length, s.trick.map(t => t.card).join(" ")].join("|");
export function remember(key, move) {
  ahead.set(key, move);
  if (ahead.size > 16) ahead.delete(ahead.keys().next().value);
}

export const rules = {
  id: "contract",
  seats: { min: 4, max: 4 },

  deal({ options = {}, rng }) {
    const first = Number.isInteger(options.dealer) ? options.dealer : Math.floor(rng() * 4);
    const s = { seats: 4, opts: { ...options }, no: 1, first, dealer: first, vul: vulnerability(1, first), scores: [0, 0], history: [] };
    newDeal(s, rng);
    s.say = `Deal 1 of ${DEALS}: {s${first}} deals, ${vulText(s.vul).toLowerCase()}.`;
    return s;
  },

  toMove(s) {
    if (s.step === "bid") return s.turn;
    if (s.step === "play") return s.turn === dummyOf(s) ? s.contract.declarer : s.turn;
    return null;
  },

  act(s, seat, m, { rng, now }) {
    if (rules.toMove(s) !== seat) return "It isn't your turn";
    if (s.step === "bid") {
      if (!m || m.t !== "call" || !legalCalls(s.auction, s.turn).includes(m.call)) return "That call isn't allowed now";
      s.auction.push({ seat: s.turn, call: m.call });
      delete s.say;
      if (!auctionOver(s.auction)) { s.turn = nextSeat(s.turn); return s; }
      if (passedOut(s.auction)) {
        s.step = "passed";
        s.until = now + PASS_MS;
        s.say = "Passed out: the cards are dealt again.";
        return s;
      }
      s.contract = contractOf(s.auction);
      s.step = "play";
      s.turn = nextSeat(s.contract.declarer);                     // the opening lead: declarer's left
      s.say = `${cap(contractWords(s.contract))} by {s${s.contract.declarer}}.`;
      return s;
    }
    if (s.step !== "play") return "Wait for the table";
    const hand = s.hands[s.turn];
    if (!m || m.t !== "card" || !legalCards(hand, s.trick).includes(m.card)) return hand.includes(m?.card) ? "Follow suit" : "That card isn't in the hand";
    s.hands[s.turn] = hand.filter(c => c !== m.card);
    s.trick.push({ seat: s.turn, card: m.card });
    delete s.say;
    if (!s.tricks.length && s.trick.length === 1) s.dummyShown = true;
    if (s.trick.length < 4) { s.turn = nextSeat(s.turn); return s; }
    const w = s.trick[trickWinner(s.trick, s.contract.strain)].seat;
    s.tricks.push({ cards: s.trick.slice(), winner: w });
    s.won[sideOf(w)]++;
    s.step = "trick";
    s.turn = w;
    s.until = now + TRICK_MS;
    return s;
  },

  bot(s, seat, { level, rng }) {
    const key = aheadKey(s, seat, level), known = ahead.get(key);
    if (known) {
      ahead.delete(key);
      if (s.step === "bid" ? legalCalls(s.auction, s.turn).includes(known.call) : legalCards(s.hands[s.turn], s.trick).includes(known.card)) return known;
    }
    if (s.step === "bid") return { t: "call", call: chooseCall(s.hands[s.turn], s.auction, s.dealer).call };
    return { t: "card", card: playByRules(s, rng) };
  },

  over: s => s.step === "over",
  wakeAt: s => (s.step === "trick" || s.step === "scored" || s.step === "passed" ? s.until : null),

  wake(s, { rng, now }) {
    if (s.step === "trick") {
      if (s.hands.some(h => h.length)) { s.trick = []; s.step = "play"; delete s.until; return s; }
      return scoreDeal(s, now);
    }
    if (s.step === "passed") { newDeal(s, rng); s.say = `{s${s.dealer}} deals again.`; return s; }
    if (s.step === "scored") {
      if (s.no >= DEALS) {
        s.step = "over";
        delete s.until;
        const [ns, ew] = s.scores;
        s.winners = ns === ew ? [] : ns > ew ? [0, 2] : [1, 3];
        s.say = ns === ew ? `The match is drawn, ${ns} all.` : `${sideName(ns > ew ? 0 : 1)} win the match, ${Math.max(ns, ew)} to ${Math.min(ns, ew)}.`;
        return s;
      }
      s.no++;
      s.dealer = nextSeat(s.dealer);
      s.vul = vulnerability(s.no, s.dealer);
      newDeal(s, rng);
      s.say = `Deal ${s.no} of ${DEALS}: {s${s.dealer}} deals, ${vulText(s.vul).toLowerCase()}.`;
      return s;
    }
    return null;
  },

  restore(s) {
    const list = v => (v ? Object.values(v) : []);
    s.hands = [0, 1, 2, 3].map(i => list(s.hands?.[i]));
    s.dealt = [0, 1, 2, 3].map(i => list(s.dealt?.[i]));
    s.auction = list(s.auction);
    s.trick = list(s.trick);
    s.tricks = list(s.tricks).map(t => ({ ...t, cards: list(t.cards) }));
    s.won = [0, 1].map(i => s.won?.[i] || 0);
    s.scores = [0, 1].map(i => s.scores?.[i] || 0);
    s.vul = [0, 1].map(i => !!s.vul?.[i]);
    s.history = list(s.history).map(h => ({ ...h, dealt: [0, 1, 2, 3].map(i => list(h.dealt?.[i])), auction: list(h.auction), vul: [0, 1].map(i => !!h.vul?.[i]), lead: h.lead ?? null }));
    if (s.winners) s.winners = list(s.winners);
    s.dummyShown = !!s.dummyShown;
    return s;
  },
};

const cap = t => t[0].toUpperCase() + t.slice(1);

/** The deal's score: what declarer's side took against the contract, put to the match's running score. */
function scoreDeal(s, now) {
  const c = s.contract, side = sideOf(c.declarer), tricks = s.won[side];
  const r = dealScore(c, tricks, s.vul[side]);
  const ns = side === 0 ? r.score : -r.score;
  s.scores[ns >= 0 ? 0 : 1] += Math.abs(ns);
  s.result = { ...r, tricks, side, ns };
  s.history.push({ no: s.no, dealer: s.dealer, vul: [...s.vul], contract: { ...c }, tricks, ns, dealt: s.dealt.map(h => [...h]), auction: s.auction.map(a => ({ ...a })), lead: s.tricks[0]?.cards[0]?.card ?? null });
  s.step = "scored";
  s.until = now + DEAL_MS;
  const by = c.level + 6, diff = tricks - by;
  const how = diff >= 0 ? (diff ? `made with ${diff} over` : "made") : `down ${-diff}`;
  s.say = `${cap(contractWords(c))}, ${how}: ${Math.abs(ns)} to ${sideName(ns >= 0 ? 0 : 1)}.`;
  return s;
}
export { SIDES, NT };
