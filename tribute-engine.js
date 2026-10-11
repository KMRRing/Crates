// Tribute: Guan Dan (掼蛋), four players in two partnerships, two decks, by the official competition rules
// (《竞技掼蛋竞赛规则（试行）》, 2022): 27 cards each, play passes to the right, the level cards rank above the ace and
// the two hearts of the level are wild; singles, pairs, triples, full houses, straights of five, three pairs in a row,
// two triples in a row, and bombs (four or more alike, a straight flush between five and six alike, the four jokers on
// top); a partner leads after you go out (接风); the winners rise three, two or one levels; tribute and its return
// from the second hand. The referee only: cards, combinations, the trick, tribute, the result and the next hand. Pure;
// the page, the computer players, the worker and the tests play through it.

// ---------- cards ----------
// A card is its id, 0–107: two decks of 52 (deck × 52 + suit × 13 + rank − 2, suits ♠ ♥ ♣ ♦, ranks 2–14 with the ace
// 14), then the small jokers 104, 105 and the big ones 106, 107.
export const SUITS = ["♠", "♥", "♣", "♦"], SUIT_NAMES = ["spades", "hearts", "clubs", "diamonds"];
export const HEARTS = 1, SJ = 16, BJ = 17;
export const rankOf = id => (id >= 106 ? BJ : id >= 104 ? SJ : ((id % 52) % 13) + 2);
export const suitOf = id => (id >= 104 ? -1 : Math.floor((id % 52) / 13));
export const isJoker = id => id >= 104;
/** One of the two wild cards: the hearts of the hand's level (逢人配). */
export const isWild = (id, level) => id < 104 && suitOf(id) === HEARTS && rankOf(id) === level;
const FACE = ["", "", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
/** A rank as written: 2…10, J, Q, K, A; the jokers. */
export const rankName = r => (r === BJ ? "big joker" : r === SJ ? "small joker" : FACE[r]);
export const cardName = id => (isJoker(id) ? rankName(rankOf(id)) : `${FACE[rankOf(id)]}${SUITS[suitOf(id)]}`);
/** A card's place in the ranking of singles, pairs, triples and bombs: 2…A, then the level (15), small joker, big. */
export const orderOf = (r, level) => (r === level ? 15 : r);
export const valueOf = (id, level) => orderOf(rankOf(id), level);

// ---------- randomness ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- combinations ----------
// A reading of some cards: { type, key, n, bomb } — type single, pair, triple, full, straight, tube, plate or bomb
// (bomb also for a straight flush, sf: true, and the four jokers); key is what it's compared by (the order of its rank,
// or for a sequence its top card's natural rank); bomb is its tier (1: four alike, 2: five, 3: a straight flush,
// 4–8: six to ten alike, 9: the four jokers), 0 for anything else.
const SIZE_TIER = { 4: 1, 5: 2, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8 };
export const power = c => (c.bomb ? c.bomb * 100 + c.key : 0);
const nat = p => (p === 1 ? 14 : p);                             // a sequence's position 1 is the ace, low
/**
 * Every way some cards can be read as one play (more than one only when wild cards could stand for different cards):
 * [{ type, key, n, bomb, sf? }]. Level cards that aren't wild keep their natural rank in a sequence.
 */
export function classify(ids, level) {
  const n = ids.length, out = [];
  if (!n || n > 10) return out;
  let w = 0, sj = 0, bj = 0;
  const cnt = new Array(15).fill(0), suits = new Set();
  for (const id of ids) {
    if (isWild(id, level)) { w++; continue; }
    const r = rankOf(id);
    if (r === SJ) sj++;
    else if (r === BJ) bj++;
    else { cnt[r]++; suits.add(suitOf(id)); }
  }
  const ranks = [];
  for (let r = 2; r <= 14; r++) if (cnt[r]) ranks.push(r);
  if (n === 1) return [{ type: "single", key: w ? 15 : valueOf(ids[0], level), n, bomb: 0 }];
  if (n === 4 && sj === 2 && bj === 2) return [{ type: "bomb", key: 0, n, bomb: 9, jokers: true }];
  const jokers = sj + bj;
  if (jokers) {
    // a joker goes only in a pair of the same joker, or as that pair under a full house's triple; never with a wild
    if (n === 2 && (sj === 2 || bj === 2)) out.push({ type: "pair", key: sj === 2 ? SJ : BJ, n, bomb: 0 });
    if (n === 5 && jokers === 2 && (sj === 2 || bj === 2) && ranks.length <= 1) {
      const r = ranks[0] ?? level;
      if ((cnt[r] || 0) + w === 3) out.push({ type: "full", key: orderOf(r, level), n, bomb: 0 });
    }
    return out;
  }
  // all alike (wilds standing in; wilds alone are level cards)
  if (ranks.length <= 1) {
    const r = ranks[0] ?? level, key = orderOf(r, level);
    if (n === 2) out.push({ type: "pair", key, n, bomb: 0 });
    else if (n === 3) out.push({ type: "triple", key, n, bomb: 0 });
    else if (n >= 4) out.push({ type: "bomb", key, n, bomb: SIZE_TIER[n] });
  }
  // a full house: three alike and a pair, of different ranks
  if (n === 5) {
    const seen = new Set();
    for (let t = 2; t <= 14; t++) for (let p = 2; p <= 14; p++) {
      if (p === t || cnt[t] > 3 || cnt[p] > 2) continue;
      if (ranks.some(r => r !== t && r !== p)) continue;
      if ((3 - cnt[t]) + (2 - cnt[p]) !== w) continue;
      const key = orderOf(t, level);
      if (!seen.has(key)) { seen.add(key); out.push({ type: "full", key, n, bomb: 0 }); }
    }
  }
  // sequences: a straight (or straight flush) of five, three pairs in a row, two triples in a row; the ace low or high
  const run = (len, each, type) => {
    for (let low = 1; low + len - 1 <= 14; low++) {
      let need = 0, ok = true;
      const inside = new Set();
      for (let p = low; p < low + len; p++) {
        const r = nat(p);
        inside.add(r);
        if (cnt[r] > each) { ok = false; break; }
        need += each - cnt[r];
      }
      if (!ok || need !== w || ranks.some(r => !inside.has(r))) continue;
      const key = low + len - 1;
      if (type === "straight") {
        // one suit among the natural cards (wilds take any suit): a straight flush, a bomb; a natural one is only that
        if (suits.size <= 1) out.push({ type: "bomb", key, n, bomb: 3, sf: true });
        if (suits.size > 1 || w > 0) out.push({ type: "straight", key, n, bomb: 0 });
      } else out.push({ type, key, n, bomb: 0 });
    }
  };
  if (n === 5) run(5, 1, "straight");
  if (n === 6) { run(3, 2, "tube"); run(2, 3, "plate"); }
  return out;
}
/** Whether play a beats play b (b null: a lead, anything goes): the same type and length higher, or a bomb above it. */
export function beats(a, b) {
  if (!b) return true;
  if (a.bomb) return !b.bomb || power(a) > power(b);
  if (b.bomb) return false;
  return a.type === b.type && a.n === b.n && a.key > b.key;
}
/** The best reading of some cards that may be played now (on top of `top`, or led), or null. */
export function readingFor(ids, level, top) {
  const rs = classify(ids, level).filter(r => beats(r, top));
  if (!rs.length) return null;
  // a straight flush led may as well be the bomb; following, the smallest reading that beats keeps the most in hand
  return rs.sort((a, b) => (top ? power(a) - power(b) || a.key - b.key : power(b) - power(a) || b.key - a.key))[0];
}
/** What a play looks like in words: "a pair of 7s", "a straight to the 10", "a bomb of five Qs". */
export function playName(c) {
  const rk = k => (k === 15 ? "level card" : k === SJ ? "small joker" : k === BJ ? "big joker" : FACE[k]);
  const plural = k => (k === 15 ? "level cards" : k >= SJ ? `${rk(k)}s` : `${FACE[k]}s`);
  const an = w => (/^(A|8)\b/.test(w) ? `an ${w}` : `a ${w}`);
  const count = ["", "", "", "", "four", "five", "six", "seven", "eight", "nine", "ten"];
  switch (c.type) {
    case "single": return an(rk(c.key));
    case "pair": return `a pair of ${plural(c.key)}`;
    case "triple": return `three ${plural(c.key)}`;
    case "full": return `a full house, ${plural(c.key)}`;
    case "straight": return `a straight to the ${FACE[c.key]}`;
    case "tube": return `three pairs to the ${FACE[c.key]}`;
    case "plate": return `two triples to the ${FACE[c.key]}`;
    default:
      if (c.jokers) return "the four jokers";
      if (c.sf) return `a straight flush to the ${FACE[c.key]}`;
      return `a bomb of ${count[c.n]} ${plural(c.key)}`;
  }
}

// ---------- the table ----------
// Seats 0–3 in the order of play (each plays after the one before: 0, 1, 2, 3, 0…); partners sit opposite, 0 and 2
// against 1 and 3. A team's level runs 2 to the ace (14).
export const teamOf = seat => seat % 2;
export const partnerOf = seat => (seat + 2) % 4;
const next = seat => (seat + 1) % 4;
export const DEFAULTS = { mode: "deals", deals: 6, tribute: true };

/** A new game: both teams at 2, the first hand dealt. opts: { mode: "deals" | "toA", deals, tribute }. */
export function newGame(opts = {}, seed = 1) {
  const game = { v: 1, opts: { ...DEFAULTS, ...opts }, seed, levels: [2, 2], declarer: -1, handNo: 0, lastOrder: null, results: [] };
  return deal(game, seed);
}
/**
 * A hand: the cards dealt from the seed, the level the declaring team plays (2 at first), and the tribute owed from the
 * last hand. The state carries the game along: { ...game, level, hands, phase, … }.
 */
export function deal(game, seed) {
  const deck = Array.from({ length: 108 }, (_, i) => i), r = rng(seed);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const level = game.declarer >= 0 ? game.levels[game.declarer] : 2;
  const hands = [0, 1, 2, 3].map(s => sortHand(deck.slice(s * 27, s * 27 + 27), level));
  const state = {
    ...game, seed, level, hands, played: [[], [], [], []], phase: "play", turn: 0, lead: 0, top: null, passes: 0, out: [],
    tribute: null, log: [], result: null, shown: null,
  };
  if (game.handNo === 0 || !game.lastOrder) {
    // the first hand: a card turned up at random (never a joker or a wild) shows who leads
    let pick;
    do pick = deck[Math.floor(r() * 108)]; while (isJoker(pick) || isWild(pick, level));
    const seat = hands.findIndex(h => h.includes(pick));
    state.shown = pick; state.turn = state.lead = seat;
    log(state, { e: "lead", seat, card: pick });
    return state;
  }
  setUpTribute(state);
  return state;
}
/** Cards in the order a hand is kept: by rank as played (the level above the ace, the jokers on top), then suit. */
export const sortHand = (hand, level) => hand.slice().sort((a, b) => valueOf(a, level) - valueOf(b, level) || suitOf(a) - suitOf(b) || a - b);
const log = (state, e) => { state.log.push(e); };

// ---------- tribute (进贡) and its return (还贡) ----------
/** The card a payer must give: the highest by rank as played (jokers included), never a wild. */
export function tributeCard(hand, level) {
  let best = null;
  for (const id of hand) {
    if (isWild(id, level)) continue;
    if (best === null || valueOf(id, level) > valueOf(best, level)) best = id;
  }
  return best;
}
/** Cards a receiver may return: rank 10 or lower, not a level card; if he has none, his lowest. */
export function returnable(hand, level) {
  const ok = hand.filter(id => !isJoker(id) && rankOf(id) <= 10 && rankOf(id) !== level);
  if (ok.length) return ok;
  const low = Math.min(...hand.map(id => valueOf(id, level)));
  return hand.filter(id => valueOf(id, level) === low);
}
function setUpTribute(state) {
  const order = state.lastOrder, up = order[0], second = order[1];
  const double = teamOf(up) === teamOf(second);
  const payers = double ? [0, 1, 2, 3].filter(s => teamOf(s) !== teamOf(up)) : [order[3]];
  const bigs = payers.reduce((n, s) => n + state.hands[s].filter(id => rankOf(id) === BJ).length, 0);
  if (!state.opts.tribute) { state.turn = state.lead = up; log(state, { e: "no-tribute" }); return; }
  if (bigs === 2) {                                              // the payers hold both big jokers: resistance (抗贡)
    state.tribute = { kind: "resisted", payers, pays: [], returns: [] };
    state.turn = state.lead = up;
    log(state, { e: "resist", seats: payers });
    return;
  }
  const pays = payers.map(from => ({ from, card: tributeCard(state.hands[from], state.level) }));
  if (double) {
    // the higher card to the first out, the lower to the second; alike, each pays the player before him (贡左还右)
    const [a, b] = pays, va = valueOf(a.card, state.level), vb = valueOf(b.card, state.level);
    if (va !== vb) { (va > vb ? a : b).to = up; (va > vb ? b : a).to = second; }
    else for (const p of pays) p.to = p.from === next(up) ? up : second;
  } else pays[0].to = up;
  for (const p of pays) {
    state.hands[p.from].splice(state.hands[p.from].indexOf(p.card), 1);
    state.hands[p.to].push(p.card);
    state.hands[p.to] = sortHand(state.hands[p.to], state.level);
    log(state, { e: "tribute", from: p.from, to: p.to, card: p.card });
  }
  state.tribute = { kind: double ? "double" : "single", payers, pays, returns: pays.map(p => ({ from: p.to, to: p.from, card: null })) };
  // the first lead: the payer (of a double, the one who paid the first out)
  state.lead = pays.find(p => p.to === up).from;
  state.phase = "return";
  state.turn = state.tribute.returns.find(r => r.card === null).from;
}

// ---------- what a seat may do ----------
/** What the seat is asked now: "play" (lead or follow), "return" (a card back to its payer), or nothing (null). */
export function asked(state, seat) {
  if (state.phase === "return") return state.tribute.returns.some(r => r.from === seat && r.card === null) ? "return" : null;
  if (state.phase === "play" && state.turn === seat) return "play";
  return null;
}
/** Seats still to act (in a return, either receiver may go first). */
export function waitingOn(state) {
  if (state.phase === "return") return state.tribute.returns.filter(r => r.card === null).map(r => r.from);
  if (state.phase === "play") return [state.turn];
  return [];
}
const active = state => [0, 1, 2, 3].filter(s => state.hands[s].length > 0);
const nextActive = (state, seat) => { let s = next(seat); for (let i = 0; i < 4 && !state.hands[s].length; i++) s = next(s); return s; };

/**
 * Applies an action: { t: "play", cards: [ids], as?: reading } (as: which reading, when the wilds allow several),
 * { t: "pass" }, { t: "return", card }. Throws on anything not allowed. Returns the state.
 */
export function act(state, seat, action) {
  const ask = asked(state, seat);
  if (!ask) throw new Error(`seat ${seat} isn't asked now (${state.phase})`);
  if (ask === "return") {
    if (action.t !== "return" || !returnable(state.hands[seat], state.level).includes(action.card)) throw new Error("not a card that may be returned");
    const ret = state.tribute.returns.find(r => r.from === seat && r.card === null);
    ret.card = action.card;
    state.hands[seat].splice(state.hands[seat].indexOf(action.card), 1);
    state.hands[ret.to].push(action.card);
    state.hands[ret.to] = sortHand(state.hands[ret.to], state.level);
    log(state, { e: "return", from: seat, to: ret.to, card: action.card });
    const left = state.tribute.returns.find(r => r.card === null);
    if (left) state.turn = left.from;
    else { state.phase = "play"; state.turn = state.lead; }
    return state;
  }
  if (action.t === "pass") {
    if (!state.top) throw new Error("the leader must play");
    state.passes++;
    log(state, { e: "pass", seat });
    // the trick is over once everyone still holding cards, other than its last player, has passed in turn
    const need = active(state).filter(s => s !== state.top.seat).length;
    if (state.passes >= need) {
      const winner = state.top.seat;
      // gone out on it: the partner leads (接风)
      const leader = state.hands[winner].length ? winner : partnerOf(winner);
      log(state, { e: "trick", seat: winner, lead: leader });
      state.top = null; state.passes = 0; state.turn = state.lead = leader;
      return state;
    }
    state.turn = nextActive(state, seat);
    return state;
  }
  if (action.t !== "play") throw new Error("play or pass");
  const cards = action.cards || [];
  const hand = state.hands[seat];
  const left = hand.slice();
  for (const id of cards) { const i = left.indexOf(id); if (i < 0) throw new Error(`card ${id} isn't in hand`); left.splice(i, 1); }
  const top = state.top?.reading || null;
  let reading = action.as ? classify(cards, state.level).find(r => r.type === action.as.type && r.key === action.as.key && !!r.sf === !!action.as.sf) : readingFor(cards, state.level, top);
  if (!reading || !beats(reading, top)) throw new Error(`not a play that ${top ? "beats the one down" : "may be led"}`);
  state.hands[seat] = left;
  state.played[seat].push(...cards);
  state.top = { seat, cards: cards.slice(), reading };
  state.passes = 0;
  log(state, { e: "play", seat, cards: cards.slice(), type: reading.type, key: reading.key, bomb: reading.bomb });
  if (!left.length) {
    state.out.push(seat);
    log(state, { e: "out", seat, place: state.out.length });
    // the hand ends when a team's two are out first and second, or when three are out
    if (state.out.length === 2 && teamOf(state.out[0]) === teamOf(state.out[1])) return finish(state);
    if (state.out.length === 3) return finish(state);
  }
  // nobody left to answer it (the others are out): the trick is over at once
  const need = active(state).filter(s => s !== seat).length;
  if (need === 0) return finish(state);
  state.turn = nextActive(state, seat);
  return state;
}

// ---------- the end of a hand: who rises, and by how much ----------
function finish(state) {
  const order = state.out.slice();
  for (const s of [0, 1, 2, 3]) if (!order.includes(s)) order.push(s);
  // a 1-2 finish: the losers' order doesn't matter, both are last; otherwise the last is the one still holding cards
  const up = order[0], team = teamOf(up), mate = order.indexOf(partnerOf(up));
  const gain = mate === 1 ? 3 : mate === 2 ? 2 : 1;
  const levels = state.levels.slice(), was = levels[team];
  // passing the ace: the declaring team, at its own ace, out first with its partner not last
  const passedA = state.declarer === team && state.level === 14 && was === 14 && gain >= 2;
  levels[team] = Math.min(14, was + gain);
  const handNo = state.handNo + 1;
  let over = passedA, winner = passedA ? team : -1;
  if (!over && state.opts.mode === "deals" && handNo >= state.opts.deals && levels[0] !== levels[1]) { over = true; winner = levels[0] > levels[1] ? 0 : 1; }
  state.phase = "over"; state.turn = -1;
  state.result = { order, team, gain, levels, passedA, over, winner, level: state.level };
  state.results = [...(state.results || []), { handNo: state.handNo, order, team, gain, level: state.level }];
  log(state, { e: "hand", order, team, gain });
  return state;
}
/** The next hand, or a new game once this one is over: the winners' new level is played, and tribute is owed. */
export function nextHand(state, seed) {
  const r = state.result;
  if (!r) throw new Error("the hand isn't over");
  if (r.over) return newGame(state.opts, seed);
  const game = { v: 1, opts: state.opts, levels: r.levels, declarer: r.team, handNo: state.handNo + 1, lastOrder: r.order, results: state.results };
  return deal(game, seed);
}
