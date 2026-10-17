// Baccarat's rules, pure (no page): punto banco as Macau deals it. Eight decks in a shoe, shuffled from a seed; the first
// card turned and as many burned as it counts; a cut card near the back, after which one more hand is dealt and the
// shoe is changed. Each hand two cards to the Player (閒) and two to the Banker (莊), a third by the tableau (no choice
// anyone makes), the total nearer nine winning; bets on either, on a Tie, on either hand's first two cards making a
// pair, and on the Banker winning with six. The roads the scoreboard draws from the results (the bead plate, the big
// road, the three roads derived from it, and what each would show next) are worked out here too. The page (baccarat.js)
// draws it; tests/baccarat.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), shoe (card ids, the order they come), pos (the next card),
// cut (where the cut card lies), last (the cut card has come out: this is the shoe's last hand), shoeNo, burn ({ shown,
// count }: the card turned at the shoe's start and how many it burned), results (this shoe's hands, for the roads),
// table ("commission" or "nocommission"), balance, bets (on the table now: { spot: HK$ }), lastBets, hands (played in
// all), peak, toppedUp }.

export const DECKS = 8, CUT_FROM_END = 14;
export const START = 50000, MIN = 500, MAX = 100000, SIDE_MAX = 10000, UNIT = 100;
export const CHIPS = [100, 500, 1000, 5000, 10000];
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
/** A card: id = rank × 4 + suit (rank 0 the ace … 12 the king; suit ♦ ♣ ♥ ♠ as cards.js draws them). */
export const rankOf = id => id >> 2;
export const suitOf = id => id & 3;
/** What a card counts: an ace 1, two to nine their pips, a ten or a court card nothing. */
export const value = id => (rankOf(id) < 9 ? rankOf(id) + 1 : 0);
/** A hand's total: the last digit of the sum. */
export const total = cards => cards.reduce((a, id) => a + value(id), 0) % 10;

// the bets: where they go on the layout, what they're called, what they pay (the table's own rule for the Banker)
export const SPOTS = [
  { id: "player", name: "Player", zh: "閒", pays: "1 to 1" },
  { id: "banker", name: "Banker", zh: "莊", pays: "0.95 to 1" },
  { id: "tie", name: "Tie", zh: "和", pays: "8 to 1" },
  { id: "ppair", name: "Player pair", zh: "閒對", pays: "11 to 1" },
  { id: "bpair", name: "Banker pair", zh: "莊對", pays: "11 to 1" },
  { id: "super6", name: "Super 6", zh: "超級六", pays: "12 to 1" },
];
export const MAIN = new Set(["player", "banker"]);

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = (s, k) => Math.floor(draw(s.seed, s.n++) * k);

// ---------- a hand ----------
/**
 * Whether the Banker draws a third card: on two cards totalling 0–2 always, 7 never; otherwise by the Player's third
 * card (none: the Banker draws on 0–5, as the Player does): on 3 unless it was an 8, on 4 against 2–7, on 5 against
 * 4–7, on 6 against 6–7. The tableau every baccarat table deals by.
 */
export function bankerDraws(bt, p3) {
  if (p3 == null) return bt <= 5;
  const v = value(p3);
  if (bt <= 2) return true;
  if (bt === 3) return v !== 8;
  if (bt === 4) return v >= 2 && v <= 7;
  if (bt === 5) return v >= 4 && v <= 7;
  if (bt === 6) return v === 6 || v === 7;
  return false;
}
/**
 * A hand dealt from the top of these cards (Player, Banker, Player, Banker, then the third cards): { player, banker
 * (their cards), pt, bt (totals), winner ("P", "B" or "T"), natural (either had 8 or 9 on two cards), ppair, bpair
 * (each hand's first two cards a pair by rank), used (cards taken) }.
 */
export function dealHand(cards) {
  const player = [cards[0], cards[2]], banker = [cards[1], cards[3]];
  let used = 4;
  const p2 = total(player), b2 = total(banker), natural = p2 >= 8 || b2 >= 8;
  if (!natural) {
    let p3 = null;
    if (p2 <= 5) { p3 = cards[used++]; player.push(p3); }
    if (bankerDraws(b2, p3)) banker.push(cards[used++]);
  }
  const pt = total(player), bt = total(banker);
  return {
    player, banker, pt, bt, natural, used,
    winner: pt > bt ? "P" : bt > pt ? "B" : "T",
    ppair: rankOf(player[0]) === rankOf(player[1]),
    bpair: rankOf(banker[0]) === rankOf(banker[1]),
  };
}

// ---------- what a bet pays ----------
/**
 * What a bet on a spot wins or loses on a hand, net of the stake (a push 0): the Player 1 to 1; the Banker 0.95 to 1 at
 * a commission table, 1 to 1 at a no-commission one but half when it wins with six; both pushed by a tie; the Tie 8 to 1;
 * a pair 11 to 1; Super 6 (the Banker winning with six) 12 to 1.
 */
export function payout(spot, stake, hand, table) {
  const w = hand.winner;
  switch (spot) {
    case "player": return w === "P" ? stake : w === "T" ? 0 : -stake;
    case "banker":
      if (w === "T") return 0;
      if (w !== "B") return -stake;
      if (table === "commission") return Math.floor(stake * 0.95);
      return hand.bt === 6 ? Math.floor(stake / 2) : stake;
    case "tie": return w === "T" ? stake * 8 : -stake;
    case "ppair": return hand.ppair ? stake * 11 : -stake;
    case "bpair": return hand.bpair ? stake * 11 : -stake;
    case "super6": return w === "B" && hand.bt === 6 ? stake * 12 : -stake;
    default: throw new Error(`no such bet: ${spot}`);
  }
}
/** Every bet on the table settled: { lines: [{ spot, stake, net }], net (all together), back (what comes back to the rail) }. */
export function settle(bets, hand, table) {
  const lines = Object.entries(bets).filter(([, v]) => v > 0).map(([spot, stake]) => ({ spot, stake, net: payout(spot, stake, hand, table) }));
  const net = lines.reduce((a, l) => a + l.net, 0), back = lines.reduce((a, l) => a + (l.net >= 0 ? l.stake + l.net : 0), 0);
  return { lines, net, back };
}
/** Whether bets may go down as they are: each a multiple of the unit, the main bets within the table's limits, the side
 *  bets within theirs, never Player and Banker together, all within what you hold. The reason when not, or null. */
export function betsProblem(bets, balance) {
  const all = Object.entries(bets).filter(([, v]) => v > 0), sum = all.reduce((a, [, v]) => a + v, 0);
  if (!all.length) return "No bets on the table";
  if (sum > balance) return "That's more than you hold";
  if (bets.player > 0 && bets.banker > 0) return "Player or Banker, not both";
  for (const [spot, v] of all) {
    if (v % UNIT) return `Bets go in HK$${UNIT}s`;
    if (MAIN.has(spot) && (v < MIN || v > MAX)) return `Player and Banker take HK$${MIN.toLocaleString("en-GB")} to HK$${MAX.toLocaleString("en-GB")}`;
    if (!MAIN.has(spot) && v > SIDE_MAX) return `The side bets take up to HK$${SIDE_MAX.toLocaleString("en-GB")}`;
  }
  return null;
}

// ---------- the shoe ----------
/** A fresh shoe: eight decks shuffled (Fisher–Yates on the seed), the cut card CUT_FROM_END from the back. */
function newShoe(s) {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) for (let id = 0; id < 52; id++) shoe.push(id);
  for (let i = shoe.length - 1; i > 0; i--) { const j = pick(s, i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
  s.shoe = shoe;
  s.cut = shoe.length - CUT_FROM_END;
  // the burn: the first card turned face up, and as many burned face down as it counts (a ten or a court card ten)
  const shown = shoe[0], count = value(shown) || 10;
  s.burn = { shown, count };
  s.pos = 1 + count;
  s.last = false;
  s.results = [];
}
/** A new game from a seed: a shoe burned and ready, your bankroll, nothing on the table. */
export function newGame(seed, table = "commission") {
  const s = { v: 1, seed: seed >>> 0, n: 0, shoe: [], pos: 0, cut: 0, last: false, shoeNo: 1, burn: null, results: [], table, balance: START, bets: {}, lastBets: {}, hands: 0, peak: START, toppedUp: 0 };
  newShoe(s);
  return s;
}
/** A new shoe on the same game (the table changes it at the end, or you ask for one). */
export function changeShoe(game) {
  const s = structuredClone(game);
  newShoe(s);
  s.shoeNo++;
  return s;
}

/**
 * Deals a hand on the bets on the table: the game after it, and what happened, for the page to show: hand (as dealHand),
 * settled (as settle), cutCame (the cut card came out in this hand: the next is the shoe's last), shoeDone (this was the
 * last hand: the next deal is from a new shoe). Pure; throws when the bets can't go down (betsProblem's reason).
 */
export function deal(game) {
  const s = structuredClone(game), problem = betsProblem(s.bets, s.balance);
  if (problem) throw new Error(problem);
  const hand = dealHand(s.shoe.slice(s.pos));
  const wasLast = s.last, cutCame = !s.last && s.pos + hand.used > s.cut;
  s.pos += hand.used;
  if (cutCame) s.last = true;
  const settled = settle(s.bets, hand, s.table);
  s.balance += settled.net;
  s.peak = Math.max(s.peak, s.balance);
  s.lastBets = s.bets;
  s.bets = {};
  s.hands++;
  s.results.push({ w: hand.winner, pp: hand.ppair, bp: hand.bpair, pt: hand.pt, bt: hand.bt, nat: hand.natural });
  return { state: s, hand, settled, cutCame, shoeDone: wasLast };
}

// ---------- the roads ----------
const ROWS = 6;
/** The bead plate (珠盤路): every hand in order, down each column of six then on to the next. [{ x, y, r }] (r: the result). */
export const beadPlate = results => results.map((r, k) => ({ x: Math.floor(k / ROWS), y: k % ROWS, r }));

/**
 * The big road's columns (大路), as the derived roads read it: a column for each run of one side's wins, a tie marked
 * on the win before it (ties before the shoe's first win, on that first win). [[{ w, ties, pp, bp, k (the hand) }]].
 */
export function bigColumns(results) {
  const cols = [];
  let leading = 0, prev = null;
  results.forEach((r, k) => {
    if (r.w === "T") { if (prev) prev.ties++; else leading++; return; }
    const e = { w: r.w, ties: 0, pp: r.pp, bp: r.bp, k };
    if (!prev) { e.ties = leading; leading = 0; }
    if (prev && prev.w === r.w) cols[cols.length - 1].push(e); else cols.push([e]);
    prev = e;
  });
  return { cols, leading };
}
/**
 * Columns of marks laid out on a grid six high, as a scoreboard draws them: down each column, and where it would run
 * off the foot or into a mark already there, on to the right along that row (the dragon's tail, 長龍). Each column starts
 * at the top of the next grid column that's free. [{ x, y, col, row, mark }].
 */
export function layout(columns) {
  const taken = new Set(), at = (x, y) => `${x},${y}`, out = [];
  let startX = -1;
  columns.forEach((col, c) => {
    let x = startX + 1;
    while (taken.has(at(x, 0))) x++;
    startX = x;
    let y = 0, turned = false;
    col.forEach((mark, row) => {
      if (row > 0) {
        if (!turned && y + 1 < ROWS && !taken.has(at(x, y + 1))) y++;
        else { turned = true; x++; while (taken.has(at(x, y))) x++; }
      }
      taken.add(at(x, y));
      out.push({ x, y, col: c, row, mark });
    });
  });
  return out;
}
/**
 * A derived road's marks (k = 1 the big eye boy, 大眼仔; 2 the small road, 小路; 3 the cockroach road, 曱甴路), one for each
 * mark of the big road from where the road starts, in order: red where the big road keeps a pattern, blue where it breaks
 * one. A mark starting a column asks whether the two columns before it, the last and the one k further back, are the same
 * length (red if so); one further down a column asks whether the column k back reaches its row (red), stops just short of
 * it (blue), or stopped two or more short (red again). The road starts at the second row of column k, or the top of
 * column k + 1. ["red" | "blue"].
 */
export function derived(cols, k) {
  const out = [];
  cols.forEach((col, c) => col.forEach((_, r) => {
    if (r === 0) {
      if (c < k + 1) return;
      out.push(cols[c - 1].length === cols[c - 1 - k].length ? "red" : "blue");
    } else {
      if (c < k) return;
      const len = cols[c - k].length;
      out.push(len > r ? "red" : len === r ? "blue" : "red");
    }
  }));
  return out;
}
/** A derived road's marks in its columns (a new column when the colour changes), as the scoreboard lays them out. */
export function runs(marks) {
  const cols = [];
  marks.forEach((m, i) => { if (i && m === marks[i - 1]) cols[cols.length - 1].push(m); else cols.push([m]); });
  return cols;
}
export const ROADS = [{ k: 1, name: "Big eye boy", zh: "大眼仔" }, { k: 2, name: "Small road", zh: "小路" }, { k: 3, name: "Cockroach road", zh: "曱甴路" }];
/**
 * The ask road (問路): what each derived road would show next if the next hand were a Banker or a Player win: { B: [k1,
 * k2, k3], P: [...] }, each "red", "blue" or null (that road hasn't started, nor would it).
 */
export function ask(results) {
  const out = {};
  for (const w of ["B", "P"]) {
    const { cols } = bigColumns([...results, { w, pp: false, bp: false }]), before = bigColumns(results).cols;
    out[w] = ROADS.map(({ k }) => {
      const now = derived(before, k).length, then = derived(cols, k);
      return then.length > now ? then[then.length - 1] : null;
    });
  }
  return out;
}
/** The shoe's counts, as the scoreboard keeps them: hands, Banker, Player and Tie wins, Banker and Player pairs, naturals. */
export function counts(results) {
  const c = { hands: results.length, B: 0, P: 0, T: 0, bp: 0, pp: 0, nat: 0 };
  for (const r of results) { c[r.w]++; if (r.bp) c.bp++; if (r.pp) c.pp++; if (r.nat) c.nat++; }
  return c;
}
/** Cards left in the shoe before the cut card (none once it's out). */
export const toCut = s => Math.max(0, s.cut - s.pos);
