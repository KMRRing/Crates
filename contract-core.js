// Contract bridge's rules without a page or a table: the cards, the calls of the auction and what may be called, the
// contract an auction comes to, what may be played to a trick and who takes it, and the score a deal is worth as
// duplicate scores it. Contract's other modules (the bidding system, the card play, the table) all build on these, and
// tests/contract.mjs checks them.
//
// Seats are numbered as seats.js numbers them, clockwise from you: 0 South, 1 West, 2 North, 3 East. Partners sit
// across (0 and 2 are North–South, 1 and 3 East–West), and play passes clockwise, to the next seat up.
//
// A card is its suit times 13 plus its rank: suits 0 ♣, 1 ♦, 2 ♥, 3 ♠ (bridge's order, lowest first), ranks 0 for the
// two up to 12 for the ace. A strain is a suit, or 4 for notrump. A call is a string: "P" (pass), "X" (double), "XX"
// (redouble), or a bid, its level and strain: "1C" … "7N".

export const SUITS = ["♣", "♦", "♥", "♠"];
export const SUIT_NAMES = ["clubs", "diamonds", "hearts", "spades"];
export const SUIT_ONE = ["club", "diamond", "heart", "spade"];
export const STRAINS = ["♣", "♦", "♥", "♠", "NT"];
export const STRAIN_LETTERS = "CDHSN";
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export const RANK_NAMES = ["two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "jack", "queen", "king", "ace"];
export const SEATS = ["South", "West", "North", "East"];
export const COMPASS = ["S", "W", "N", "E"];
export const NT = 4;

export const suitOf = c => Math.floor(c / 13);
export const rankOf = c => c % 13;
export const cardOf = (suit, rank) => suit * 13 + rank;
export const partnerOf = seat => (seat + 2) % 4;
export const nextSeat = seat => (seat + 1) % 4;
/** A seat's side: 0 North–South, 1 East–West. */
export const sideOf = seat => seat % 2;
export const SIDES = ["North–South", "East–West"];

// ---------- the cards ----------
/** A card as it's written: "♠K", "♥10". */
export const cardText = c => `${SUITS[suitOf(c)]}${RANKS[rankOf(c)]}`;
/** A card in words: "the king of spades". */
export const cardWords = c => `the ${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;
/** High-card points: ace 4, king 3, queen 2, jack 1. */
export const pointsOf = c => Math.max(0, rankOf(c) - 8);
export const hcp = hand => hand.reduce((n, c) => n + pointsOf(c), 0);
/** How many cards of each suit a hand holds: [♣, ♦, ♥, ♠]. */
export function lengths(hand) {
  const l = [0, 0, 0, 0];
  for (const c of hand) l[suitOf(c)]++;
  return l;
}
/** A hand as a player holds it: spades, hearts, clubs, diamonds (the colours alternate), each suit high to low. */
export const HOLD_ORDER = [3, 2, 0, 1];
export function sortHand(hand, order = HOLD_ORDER) {
  return [...hand].sort((a, b) => order.indexOf(suitOf(a)) - order.indexOf(suitOf(b)) || b - a);
}
/** The whole pack, shuffled by rng, dealt thirteen to each seat. */
export function dealHands(rng) {
  const pack = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pack[i], pack[j]] = [pack[j], pack[i]]; }
  return [0, 1, 2, 3].map(s => pack.slice(s * 13, s * 13 + 13).sort((a, b) => a - b));
}
/** Cards written as a bridge column writes a hand, suit by suit: "♠AK5 ♥QJ3 ♦742 ♣K98". */
export function handText(hand) {
  return [3, 2, 1, 0].map(s => `${SUITS[s]}${hand.filter(c => suitOf(c) === s).sort((a, b) => b - a).map(c => RANKS[rankOf(c)]).join("") || "—"}`).join(" ");
}

// ---------- the calls ----------
/** A bid's level and strain, or null for a pass, double or redouble. */
export function bidOf(call) {
  if (!/^[1-7][CDHSN]$/.test(call || "")) return null;
  return { level: Number(call[0]), strain: STRAIN_LETTERS.indexOf(call[1]) };
}
export const bidCall = (level, strain) => `${level}${STRAIN_LETTERS[strain]}`;
/** A bid's place in the order of bids: 1♣ 0, 1♦ 1 … 7NT 34. */
export const bidRank = call => { const b = bidOf(call); return b ? (b.level - 1) * 5 + b.strain : -1; };
export const ALL_BIDS = Array.from({ length: 35 }, (_, i) => bidCall(Math.floor(i / 5) + 1, i % 5));
/** A call as a bidding box shows it: "1♥", "2NT", "Pass", "Dbl", "Rdbl". */
export function callText(call) {
  if (call === "P") return "Pass";
  if (call === "X") return "Dbl";
  if (call === "XX") return "Rdbl";
  const b = bidOf(call);
  return b ? `${b.level}${STRAINS[b.strain]}` : String(call);
}
const LEVEL_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven"];
/** A call as it's said aloud: "two hearts", "three notrump", "double". */
export function callWords(call) {
  if (call === "P") return "pass";
  if (call === "X") return "double";
  if (call === "XX") return "redouble";
  const b = bidOf(call);
  if (!b) return String(call);
  return `${LEVEL_WORDS[b.level]} ${b.strain === NT ? "notrump" : b.level === 1 ? SUIT_ONE[b.strain] : SUIT_NAMES[b.strain]}`;
}

/** The seat to call next, after an auction (or that many calls): the dealer first, then clockwise. */
export const turnOf = (dealer, auction) => (dealer + (typeof auction === "number" ? auction : auction.length)) % 4;
/** The last bid made, with who made it and its place in the auction: { call, seat, at } or null. */
export function lastBid(auction) {
  for (let i = auction.length - 1; i >= 0; i--) if (bidOf(auction[i].call)) return { ...auction[i], at: i };
  return null;
}
/** Whether the last bid stands doubled (1) or redoubled (2), or neither (0). */
export function doubledOf(auction) {
  let d = 0;
  for (let i = auction.length - 1; i >= 0; i--) {
    const c = auction[i].call;
    if (bidOf(c)) return d;
    if (c === "X") d = Math.max(d, 1);
    if (c === "XX") d = 2;
  }
  return d;
}
/** The calls a seat may make now: a pass; any bid above the last; a double of the opponents' bid not yet doubled; a
 *  redouble of their double of your side's bid. */
export function legalCalls(auction, seat) {
  const out = ["P"], last = lastBid(auction), from = last ? bidRank(last.call) + 1 : 0;
  for (let r = from; r < 35; r++) out.push(ALL_BIDS[r]);
  if (last) {
    // the call that stands is the last that isn't a pass
    const standing = [...auction].reverse().find(a => a.call !== "P");
    if (standing.call === last.call && sideOf(last.seat) !== sideOf(seat)) out.push("X");
    if (standing.call === "X" && sideOf(standing.seat) !== sideOf(seat) && sideOf(last.seat) === sideOf(seat)) out.push("XX");
  }
  return out;
}
export const isLegalCall = (auction, seat, call) => legalCalls(auction, seat).includes(call);
/** Whether the auction is over: three passes after a bid, or four passes and no bid (passed out). */
export function auctionOver(auction) {
  if (auction.length < 4) return false;
  // with a bid made, three passes after the last call that wasn't one; with none, everyone has passed (four calls)
  return !lastBid(auction) || auction.slice(-3).every(a => a.call === "P");
}
export const passedOut = auction => auction.length >= 4 && auction.every(a => a.call === "P");
/**
 * The contract an auction came to: { level, strain, doubled (0, 1, 2), declarer } (null when passed out). The declarer
 * is whichever of the side that won the auction first named its strain.
 */
export function contractOf(auction) {
  const last = lastBid(auction);
  if (!last) return null;
  const { level, strain } = bidOf(last.call), side = sideOf(last.seat);
  const first = auction.find(a => sideOf(a.seat) === side && bidOf(a.call)?.strain === strain);
  return { level, strain, doubled: doubledOf(auction), declarer: first.seat };
}
/** A contract as it's written: "4♥", "3NT X", "6♠ XX". */
export const contractText = c => (c ? `${c.level}${STRAINS[c.strain]}${c.doubled === 2 ? " XX" : c.doubled ? " X" : ""}` : "Passed out");
/** A contract in words: "four hearts doubled". */
export const contractWords = c => (c ? `${callWords(bidCall(c.level, c.strain))}${c.doubled === 2 ? " redoubled" : c.doubled ? " doubled" : ""}` : "passed out");

// ---------- the play ----------
/** The cards a hand may play to a trick: any, leading; else the suit led if it holds one, else any. */
export function legalCards(hand, trick) {
  if (!trick.length) return [...hand];
  const led = suitOf(trick[0].card), follow = hand.filter(c => suitOf(c) === led);
  return follow.length ? follow : [...hand];
}
/** The place in the trick of the card that takes it: the highest trump, else the highest of the suit led. */
export function trickWinner(trick, strain) {
  let best = 0;
  for (let i = 1; i < trick.length; i++) {
    const a = trick[best].card, b = trick[i].card;
    const trumpA = strain !== NT && suitOf(a) === strain, trumpB = strain !== NT && suitOf(b) === strain;
    if (trumpB && !trumpA) best = i;
    else if (suitOf(b) === suitOf(a) && rankOf(b) > rankOf(a)) best = i;
  }
  return best;
}

// ---------- the score ----------
/** What the contract's tricks are worth when made: below the line in rubber bridge, toward game in duplicate. */
export function trickScore({ level, strain, doubled }) {
  const per = strain === NT ? 30 : strain >= 2 ? 30 : 20;
  return (per * level + (strain === NT ? 10 : 0)) * (doubled === 2 ? 4 : doubled ? 2 : 1);
}
/**
 * A deal's score for the declaring side, as duplicate scores it: tricks is how many declarer's side took, vul whether
 * that side is vulnerable. Positive when made (the contract's tricks, then 300 or 500 for a game or 50 for a part-score,
 * the slam bonus, 50 or 100 for making it doubled or redoubled, and the overtricks), negative when down (the
 * undertricks, which grow when doubled). Returns { score, made, over, under, parts }: parts says where the score came
 * from, for the result's words.
 */
export function dealScore(contract, tricks, vul) {
  const { level, strain, doubled } = contract, need = 6 + level, parts = [];
  if (tricks >= need) {
    const below = trickScore(contract), over = tricks - need;
    parts.push(["Contract", below]);
    if (below >= 100) parts.push(["Game", vul ? 500 : 300]); else parts.push(["Part-score", 50]);
    if (level === 6) parts.push(["Small slam", vul ? 750 : 500]);
    if (level === 7) parts.push(["Grand slam", vul ? 1500 : 1000]);
    if (doubled) parts.push([doubled === 2 ? "Redoubled, made" : "Doubled, made", doubled === 2 ? 100 : 50]);
    if (over) {
      const each = doubled ? (vul ? 200 : 100) * doubled : strain >= 2 ? 30 : 20;
      parts.push([over === 1 ? "Overtrick" : `${over} overtricks`, over * each]);
    }
    return { score: parts.reduce((a, [, v]) => a + v, 0), made: true, over, under: 0, parts };
  }
  const under = need - tricks;
  let pen = 0;
  if (!doubled) pen = under * (vul ? 100 : 50);
  else {
    for (let k = 1; k <= under; k++) pen += vul ? (k === 1 ? 200 : 300) : (k === 1 ? 100 : k <= 3 ? 200 : 300);
    if (doubled === 2) pen *= 2;
  }
  parts.push([under === 1 ? "Down one" : `Down ${under}`, -pen]);
  return { score: -pen, made: false, over: 0, under, parts };
}

// ---------- Chicago ----------
/**
 * A Chicago match is four deals, the dealer moving clockwise: nobody vulnerable on the first, the dealer's side on the
 * second and third, both sides on the fourth. Returns [North–South, East–West] for a deal (no: 1 to 4) and its dealer.
 */
export function vulnerability(no, dealer) {
  if (no === 1) return [false, false];
  if (no === 4) return [true, true];
  return [sideOf(dealer) === 0, sideOf(dealer) === 1];
}
/** Who is vulnerable, in words: "Nobody vulnerable", "North–South vulnerable", "Both vulnerable". */
export function vulText(vul) {
  if (vul[0] && vul[1]) return "Both vulnerable";
  if (vul[0]) return "North–South vulnerable";
  if (vul[1]) return "East–West vulnerable";
  return "Nobody vulnerable";
}
