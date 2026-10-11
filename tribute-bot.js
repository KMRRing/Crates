// Tribute's computer players, and the hint that explains them. A player sees its own cards, every play and pass, the
// counts, and the tribute; it remembers every card played. It decides as a strong player does:
//  - the hand is split into the plays that empty it fastest (手数, the fewest plays), keeping bombs whole and the
//    controls (jokers, level cards, aces, bombs) as ways back to the lead; a wild goes where it does most: a triple
//    into a bomb, a straight or straight flush completed, a single into a pair
//  - leading: the cheapest play in the split that isn't a way back, longer ones and low ones first; nothing an opponent
//    about to go out could follow with his last cards; small cards of his type for a partner about to go out
//  - following an opponent: the cheapest play that beats it, if it costs the hand little; a bomb when he's close to
//    going out, or when a bomb and one more play would take you out; following a partner: let it stand (让牌) unless it
//    takes you out
//  - the last few plays looked ahead: when the hand can go out in two plays, it plays so the last one can't be stopped
//  - a return (还贡): the card that costs the split least, low, from a rank held more than once (so it's less likely
//    to finish the payer's bomb); to a partner, the card that helps most.
import { classify, beats, power, rankOf, suitOf, isWild, isJoker, valueOf, orderOf, teamOf, partnerOf, returnable, playName, rankName, cardName, SJ, BJ, asked, act } from "./tribute-engine.js";

// ---------- a hand by rank ----------
function profile(hand, level) {
  const cnt = new Array(15).fill(0), ids = Array.from({ length: 15 }, () => []), wilds = [], sjs = [], bjs = [];
  for (const id of hand) {
    if (isWild(id, level)) wilds.push(id);
    else if (rankOf(id) === SJ) sjs.push(id);
    else if (rankOf(id) === BJ) bjs.push(id);
    else { const r = rankOf(id); cnt[r]++; ids[r].push(id); }
  }
  return { cnt, ids, wilds, sjs, bjs, level };
}
const nat = p => (p === 1 ? 14 : p);
const CHAINS = [];                                               // every sequence: { type, len, each, low }
for (let low = 1; low <= 10; low++) CHAINS.push({ type: "straight", len: 5, each: 1, low });
for (let low = 1; low <= 12; low++) CHAINS.push({ type: "tube", len: 3, each: 2, low });
for (let low = 1; low <= 13; low++) CHAINS.push({ type: "plate", len: 2, each: 3, low });

// ---------- the split: the plays that empty the hand fastest ----------
/**
 * The best split of a hand into plays: { combos: [{ cards, reading }], plays, score }. Fewer plays is better; a bomb
 * counts as a way back to the lead; small singles are the hardest to be rid of.
 */
export function split(hand, level) {
  const key = `${level}:${hand.slice().sort((a, b) => a - b).join(",")}`;
  const hit = SPLITS.get(key);
  if (hit) return hit;
  const P = profile(hand, level);
  let best = null;
  const tryRest = (cnt, w, chosen, sfs) => {
    const rest = remainder(cnt, w, P);
    const plays = chosen.length + sfs.length + rest.plays;
    const score = plays + rest.score - 0.6 * sfs.length;
    if (!best || score < best.score - 1e-9) best = { chosen: chosen.slice(), sfs: sfs.slice(), rest, plays, score };
  };
  // the sequences, chosen in a fixed order so each set is tried once, at most four
  const dfs = (cnt, w, chosen, from, sfs) => {
    tryRest(cnt, w, chosen, sfs);
    if (chosen.length >= 4) return;
    for (let i = from; i < CHAINS.length; i++) {
      const ch = CHAINS[i];
      let need = 0, ok = true;
      for (let p = ch.low; p < ch.low + ch.len; p++) {
        const r = nat(p);
        if (cnt[r] >= 4) { ok = false; break; }                  // never break a bomb for a sequence
        need += Math.max(0, ch.each - cnt[r]);
      }
      if (!ok || need > Math.min(w, 1) || need >= ch.len * ch.each / 2) continue;
      const used = [];
      for (let p = ch.low; p < ch.low + ch.len; p++) { const r = nat(p), take = Math.min(ch.each, cnt[r]); cnt[r] -= take; used.push([r, take]); }
      chosen.push({ ...ch, need });
      dfs(cnt, w - need, chosen, i, sfs);
      chosen.pop();
      for (const [r, take] of used) cnt[r] += take;
    }
  };
  // straight flushes first (each a bomb): none, or one, or two that don't share cards
  const sfs = straightFlushes(hand, level);
  const base = P.cnt.slice();
  dfs(base, P.wilds.length, [], 0, []);
  for (let i = 0; i < sfs.length; i++) {
    const a = sfs[i];
    const c1 = takeCards(base, a.cards, level);
    if (!c1) continue;
    dfs(c1, P.wilds.length - a.wilds, [], 0, [a]);
    for (let j = i + 1; j < sfs.length; j++) {
      const b = sfs[j];
      if (a.wilds + b.wilds > P.wilds.length || b.cards.some(id => a.cards.includes(id))) continue;
      const c2 = takeCards(c1, b.cards, level);
      if (c2) dfs(c2, P.wilds.length - a.wilds - b.wilds, [], 0, [a, b]);
    }
  }
  const out = concretize(best, P, hand, level);
  if (SPLITS.size > 4000) SPLITS.clear();
  SPLITS.set(key, out);
  return out;
}
const SPLITS = new Map();
function takeCards(cnt, cards, level) {
  const c = cnt.slice();
  for (const id of cards) { if (isWild(id, level) || isJoker(id)) continue; const r = rankOf(id); if (c[r] <= 0) return null; c[r]--; }
  return c;
}
/** The straight flushes a hand could make: natural, or with one or two wilds (and not breaking two bombs to make one). */
function straightFlushes(hand, level) {
  const out = [], wilds = hand.filter(id => isWild(id, level));
  const bySuit = [0, 1, 2, 3].map(() => new Map());
  for (const id of hand) if (!isWild(id, level) && !isJoker(id)) { const m = bySuit[suitOf(id)], r = rankOf(id); if (!m.has(r)) m.set(r, id); }
  const cnt = new Array(15).fill(0);
  for (const id of hand) if (!isWild(id, level) && !isJoker(id)) cnt[rankOf(id)]++;
  for (let s = 0; s < 4; s++) for (let low = 1; low <= 10; low++) {
    const cards = [];
    let gaps = 0, bombsBroken = 0;
    for (let p = low; p < low + 5; p++) {
      const r = nat(p), id = bySuit[s].get(r);
      if (id === undefined) gaps++;
      else { cards.push(id); if (cnt[r] >= 4) bombsBroken++; }
    }
    if (gaps > wilds.length || gaps > 2 || bombsBroken >= 2) continue;
    out.push({ suit: s, low, cards: [...cards, ...wilds.slice(0, gaps)], wilds: gaps, key: low + 4 });
  }
  return out.sort((a, b) => a.wilds - b.wilds || b.key - a.key).slice(0, 6);
}
/**
 * What's left after the sequences, grouped: a bomb of each rank held four or more, triples, pairs and singles; the
 * wilds placed where they do most; triples carrying the smallest pairs as full houses.
 */
function remainder(cnt, w, P) {
  const level = P.level;
  let best = null;
  const targets = [-1];                                          // -1: a wild kept as it is (a level card)
  for (let r = 2; r <= 14; r++) if (cnt[r]) targets.push(r);
  const options = w === 0 ? [[]] : w === 1 ? targets.map(t => [t]) : targets.flatMap((t, i) => targets.slice(i).map(u => [t, u]));
  for (const opt of options) {
    const c = cnt.slice();
    let kept = 0;
    for (const t of opt) { if (t < 0) kept++; else c[t]++; }
    let bombs = 0, triples = [], pairs = [], singles = [], controls = 0, small = 0;
    for (let r = 2; r <= 14; r++) {
      const n = c[r];
      if (!n) continue;
      const v = orderOf(r, level);
      if (n >= 4) bombs++;
      else if (n === 3) triples.push(v);
      else if (n === 2) { pairs.push(v); if (v >= 14) controls++; }
      else { singles.push(v); if (v >= 14) controls++; else if (v <= 7) small++; }
    }
    if (kept === 2) { pairs.push(15); controls++; }
    else if (kept === 1) { singles.push(15); controls++; }
    const sj = P.sjs.length, bj = P.bjs.length;
    let jokerBomb = 0;
    if (sj === 2 && bj === 2) jokerBomb = 1;
    else {
      if (sj === 2) { pairs.push(SJ); controls += 1.5; } else if (sj === 1) { singles.push(SJ); controls++; }
      if (bj === 2) { pairs.push(BJ); controls += 2; } else if (bj === 1) { singles.push(BJ); controls += 1.2; }
    }
    // full houses: each triple takes the smallest pair below the controls
    const plainPairs = pairs.filter(v => v < 14).sort((a, b) => a - b);
    const fulls = Math.min(triples.length, plainPairs.length);
    const plays = bombs + jokerBomb + triples.length + pairs.length + singles.length - fulls;
    const score = -0.6 * bombs - 1.2 * jokerBomb - 0.2 * controls + 0.12 * small;
    const total = plays + score;
    if (!best || total < best.total) best = { plays, score, total, opt, c };
  }
  return best;
}
/** The split as cards: which ids make each play (natural cards first, wilds where the split put them). */
function concretize(best, P, hand, level) {
  const pool = P.ids.map(a => a.slice()), wilds = P.wilds.slice();
  const combos = [];
  const used = new Set();
  const take = (r, n) => { const out = []; while (out.length < n && pool[r].length) out.push(pool[r].shift()); return out; };
  const add = cards => { for (const id of cards) used.add(id); const reading = bestReading(cards, level); if (reading) combos.push({ cards, reading }); };
  for (const sf of best.sfs) {
    for (const id of sf.cards) { if (isWild(id, level)) { const i = wilds.indexOf(id); if (i >= 0) wilds.splice(i, 1); } else { const r = rankOf(id); const i = pool[r].indexOf(id); if (i >= 0) pool[r].splice(i, 1); } }
    add(sf.cards);
  }
  for (const ch of best.chosen) {
    const cards = [];
    for (let p = ch.low; p < ch.low + ch.len; p++) {
      const r = nat(p), got = take(r, ch.each);
      cards.push(...got);
      for (let i = got.length; i < ch.each; i++) cards.push(wilds.shift());
    }
    add(cards);
  }
  // the rest by rank, with the wilds where the remainder placed them
  const extra = {};
  let kept = 0;
  for (const t of best.rest.opt) { if (t < 0) kept++; else extra[t] = (extra[t] || 0) + 1; }
  const groups = [];
  for (let r = 2; r <= 14; r++) {
    const cards = take(r, 99);
    for (let i = 0; i < (extra[r] || 0); i++) cards.push(wilds.shift());
    if (cards.length) groups.push(cards);
  }
  if (kept) groups.push(wilds.splice(0, kept));
  const sj = P.sjs, bj = P.bjs;
  if (sj.length === 2 && bj.length === 2) groups.push([...sj, ...bj]);
  else { if (sj.length) groups.push(sj.slice()); if (bj.length) groups.push(bj.slice()); }
  // triples carry the smallest plain pairs
  const read = groups.map(cards => ({ cards, reading: bestReading(cards, level) })).filter(g => g.reading);
  const triples = read.filter(g => g.reading.type === "triple").sort((a, b) => a.reading.key - b.reading.key);
  const pairs = read.filter(g => g.reading.type === "pair" && g.reading.key < 14).sort((a, b) => a.reading.key - b.reading.key);
  const merged = new Set();
  triples.forEach((t, i) => {
    const p = pairs[i];
    if (!p) return;
    merged.add(t); merged.add(p);
    add([...t.cards, ...p.cards]);
  });
  for (const g of read) if (!merged.has(g)) add(g.cards);
  // anything the split left out (it shouldn't), as singles
  for (const id of hand) if (!used.has(id)) add([id]);
  return { combos, plays: combos.length, score: best.score };
}
/** The strongest reading of a group of cards (a straight flush as the bomb it is). */
function bestReading(cards, level) {
  const rs = classify(cards, level);
  return rs.sort((a, b) => power(b) - power(a) || b.key - a.key)[0] || null;
}

// ---------- what a seat knows ----------
/** The cards this seat hasn't seen: not in its hand, not played, not shown in tribute. */
export function unseen(state, seat) {
  const seen = new Set(state.hands[seat]);
  for (const p of state.played) for (const id of p) seen.add(id);
  const out = [];
  for (let id = 0; id < 108; id++) if (!seen.has(id)) out.push(id);
  return out;
}
/** Whether a play is the top of its kind: nothing unseen could make a higher one of its type (bombs aside). */
function isTop(reading, others, level) {
  if (reading.bomb) return true;
  if (reading.type === "single") return !others.some(id => valueOf(id, level) > reading.key);
  if (reading.type === "pair") {
    const c = {};
    for (const id of others) { const v = isWild(id, level) ? 15 : valueOf(id, level); c[v] = (c[v] || 0) + 1; }
    const w = others.filter(id => isWild(id, level)).length;
    return !Object.entries(c).some(([v, n]) => Number(v) > reading.key && (n >= 2 || (n === 1 && w > 0 && Number(v) < SJ)));
  }
  return false;
}

// ---------- the moves ----------
/** Every play of the type and length of `top` (any type when leading: from the split) that beats it, cheapest ways. */
export function candidates(hand, level, top) {
  const P = profile(hand, level), out = [];
  const w = P.wilds.length, seen = new Set();
  const push = cards => {
    const reading = classify(cards, level).filter(r => beats(r, top)).sort((a, b) => power(a) - power(b) || a.key - b.key)[0];
    if (!reading) return;
    const k = `${reading.type}:${reading.key}:${reading.bomb}:${cards.length}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ cards, reading });
  };
  const of = (r, n) => P.ids[r].slice(0, n);
  const t = top.type;
  if (!top.bomb) {
    if (t === "single") {
      for (let r = 2; r <= 14; r++) if (P.cnt[r]) push([P.ids[r][P.ids[r].length - 1]]);
      if (P.sjs.length) push([P.sjs[0]]);
      if (P.bjs.length) push([P.bjs[0]]);
      if (w) push([P.wilds[0]]);
    } else if (t === "pair" || t === "triple") {
      const n = t === "pair" ? 2 : 3;
      for (let r = 2; r <= 14; r++) {
        const have = P.cnt[r];
        if (have >= n) push(of(r, n));
        else if (have && have + w >= n) push([...of(r, have), ...P.wilds.slice(0, n - have)]);
      }
      if (n === 2) { if (P.sjs.length === 2) push(P.sjs.slice()); if (P.bjs.length === 2) push(P.bjs.slice()); if (w === 2) push(P.wilds.slice()); }
    } else if (t === "full") {
      for (let r = 2; r <= 14; r++) {
        const have = P.cnt[r];
        if (have + w < 3 || !have) continue;
        const tw = Math.max(0, 3 - have), trip = [...of(r, Math.min(3, have)), ...P.wilds.slice(0, tw)];
        // the smallest pair to go with it (by rank as played: a level pair last)
        for (const q of BY_VALUE[level] || (BY_VALUE[level] = Array.from({ length: 13 }, (_, i) => i + 2).sort((a, b) => orderOf(a, level) - orderOf(b, level)))) {
          if (q === r) continue;
          const hq = P.cnt[q];
          if (hq >= 2) { push([...trip, ...of(q, 2)]); break; }
          if (hq === 1 && w - tw >= 1) { push([...trip, P.ids[q][0], P.wilds[tw]]); break; }
        }
      }
    } else if (t === "straight" || t === "tube" || t === "plate") {
      const ch = { straight: [5, 1], tube: [3, 2], plate: [2, 3] }[t];
      for (let low = 1; low + ch[0] - 1 <= 14; low++) {
        const cards = [];
        let need = 0;
        for (let p = low; p < low + ch[0]; p++) { const r = nat(p), got = P.ids[r].slice(0, ch[1]); cards.push(...got); need += ch[1] - got.length; }
        if (need > w) continue;
        push([...cards, ...P.wilds.slice(0, need)]);
      }
    }
  }
  // bombs: four or more alike (the smallest that beats), straight flushes, the four jokers
  for (let r = 2; r <= 14; r++) {
    const have = P.cnt[r];
    for (let n = 4; n <= have + w; n++) {
      if (have < Math.max(2, n - w)) continue;
      const cards = [...of(r, Math.min(have, n)), ...P.wilds.slice(0, Math.max(0, n - have))];
      const before = out.length;
      push(cards);
      if (out.length > before) break;                            // the smallest size of this rank that beats
    }
  }
  for (const sf of straightFlushes(hand, level)) push(sf.cards);
  if (P.sjs.length === 2 && P.bjs.length === 2) push([...P.sjs, ...P.bjs]);
  return out;
}
const BY_VALUE = {};
/** How much a play costs the hand: the plays left after it, against the split's own count less one. */
function cost(hand, level, cards, before) {
  const rest = hand.filter(id => !cards.includes(id));
  if (!rest.length) return -10;                                  // it takes you out
  const s = split(rest, level);
  return (s.plays + s.score) - (before.plays + before.score - 1);
}

/** The view a decision needs. */
function situation(state, seat) {
  const level = state.level, hand = state.hands[seat], mate = partnerOf(seat);
  const opps = [0, 1, 2, 3].filter(s => teamOf(s) !== teamOf(seat));
  const counts = state.hands.map(h => h.length);
  return { level, hand, mate, opps, counts, others: unseen(state, seat), next: (seat + 1) % 4, prev: (seat + 3) % 4 };
}

/**
 * The decision for a seat now, with its reason: { action, why, alts? } — a play ({ t: "play", cards }), a pass, or a
 * return ({ t: "return", card }).
 */
export function decide(state, seat, { search = 0, seed = 1, budget = Infinity } = {}) {
  const ask = asked(state, seat);
  if (!ask) return null;
  if (ask === "return") return decideReturn(state, seat);
  const s = situation(state, seat);
  const d = state.top ? decideFollow(state, seat, s) : decideLead(state, seat, s);
  if (search > 0 && worthSearching(state, seat, s)) return lookAhead(state, seat, d, search, seed, budget);
  return d;
}

// ---------- looking ahead: the rest of the hand played out in worlds that fit what's been seen ----------
// Late in a hand, or when someone is close to going out, the choice is tried: the unseen cards dealt to the others
// (their counts, and the tribute cards where they're known to be), the rest of the hand played by these same rules,
// the result scored as the level swing for this seat's side, over many such worlds.
function worthSearching(state, seat, s) {
  const total = s.counts.reduce((a, b) => a + b, 0);
  return total <= 60 || s.counts.some((n, i) => n > 0 && n <= 8) || s.hand.length <= 12;
}
/** Deals the cards this seat can't see to the others, as many as each holds, the known ones where they are. */
function sampleWorld(state, seat, r) {
  const hands = state.hands.map(h => h.slice());
  const known = new Map();
  for (const e of state.log) if (e.e === "tribute" || e.e === "return") known.set(e.card, e.to);
  const pool = [];
  for (const id of unseen(state, seat)) {
    const at = known.get(id);
    if (at !== undefined && at !== seat) continue;               // stays where it's known to be
    pool.push(id);
  }
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  for (let o = 0; o < 4; o++) {
    if (o === seat) continue;
    const need = state.hands[o].length;
    const keep = [];
    for (const [id, at] of known) if (at === o && !state.played.some(p => p.includes(id)) && state.hands[seat].indexOf(id) < 0) keep.push(id);
    const fill = pool.splice(0, Math.max(0, need - keep.length));
    hands[o] = [...keep.slice(0, need), ...fill];
  }
  return hands;
}
function rollout(state, hands) {
  const st = { ...state, hands: hands.map(h => h.slice()), played: state.played.map(p => p.slice()), out: state.out.slice(), log: state.log.slice(-40), top: state.top ? { ...state.top } : null };
  for (let g = 0; g < 400 && st.phase === "play"; g++) {
    const seat = st.turn;
    const d = decide(st, seat);
    try { act(st, seat, d.action); } catch { return null; }
  }
  return st.result;
}
/** The decision `d` the rules made, tested against the other plays worth considering in sampled worlds. */
function lookAhead(state, seat, d, worlds, seed, budget) {
  const t0 = Date.now();
  const level = state.level, hand = state.hands[seat];
  const opts = [d.action];
  const same = (a, b) => a.t === b.t && (a.t === "pass" || (a.cards.length === b.cards.length && a.cards.every(id => b.cards.includes(id))));
  const add = a => { if (!opts.some(o => same(o, a))) opts.push(a); };
  if (state.top) {
    add({ t: "pass" });
    const cs = candidates(hand, level, state.top.reading);
    const before = split(hand, level);
    cs.map(c => ({ c, k: cost(hand, level, c.cards, before) })).sort((a, b) => a.k - b.k).slice(0, 4).forEach(({ c }) => add({ t: "play", cards: c.cards }));
  } else {
    for (const c of split(hand, level).combos) add({ t: "play", cards: c.cards });
  }
  if (opts.length < 2) return d;
  const r = rngOf(seed + hand.length * 7919 + state.log.length);
  const totals = opts.map(() => 0);
  let n = 0;
  for (let k = 0; k < worlds && (k < 6 || Date.now() - t0 < budget); k++) {
    const hands = sampleWorld(state, seat, r);
    const res = opts.map(a => {
      const st = { ...state, hands: hands.map(h => h.slice()), played: state.played.map(p => p.slice()), out: state.out.slice(), log: state.log.slice(), top: state.top ? { ...state.top } : null, tribute: state.tribute };
      try { act(st, seat, a); } catch { return null; }
      const end = st.phase === "over" ? st.result : rollout(st, st.hands);
      return end ? (teamOf(end.order[0]) === teamOf(seat) ? end.gain : -end.gain) : null;
    });
    if (res.some(x => x === null)) continue;
    res.forEach((x, i) => { totals[i] += x; });
    n++;
  }
  if (!n) return d;
  const avg = totals.map(t => t / n);
  let bi = 0;
  for (let i = 1; i < opts.length; i++) if (avg[i] > avg[bi] + 0.15) bi = i;   // the rules' own choice unless clearly beaten
  if (bi === 0) return { ...d, looked: { worlds: n, value: avg[0] } };
  const a = opts[bi];
  const what = a.t === "pass" ? "Pass" : `Play ${playName(classify(a.cards, level).sort((x, y) => power(y) - power(x))[0] || { type: "single", key: 0 })}`;
  const lv = x => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(1)}`;
  return { action: a, why: `${what}: tried in ${n} deals of the cards you can't see, it does best, ${lv(avg[bi])} levels to your side on average against ${lv(avg[0])} for ${d.action.t === "pass" ? "passing" : "the usual play"}.`, looked: { worlds: n, value: avg[bi] } };
}
function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}


// ---------- leading ----------
function decideLead(state, seat, s) {
  const { level, hand, counts, mate, opps, others } = s;
  const sp = split(hand, level);
  const combos = sp.combos;
  if (combos.length === 1) return { action: { t: "play", cards: combos[0].cards }, why: `Lead ${playName(combos[0].reading)}: it's your last play.` };
  const control = c => c.reading.bomb > 0 || (c.reading.key >= 15 && (c.reading.type === "single" || c.reading.type === "pair")) || isTop(c.reading, others, level);
  const oppMin = Math.min(...opps.map(o => counts[o] || 99).filter(n => n > 0));
  // two plays left and one is sure: lead the other, then the sure one
  if (combos.length === 2) {
    const sure = combos.find(c => c.reading.bomb || isTop(c.reading, others, level));
    if (sure) { const other = combos.find(c => c !== sure); return { action: { t: "play", cards: other.cards }, why: `Lead ${playName(other.reading)}: ${playName(sure.reading)} is sure to win the lead back, and takes you out.` }; }
  }
  const mateClose = counts[mate] > 0 && counts[mate] <= 4;
  const scored = combos.map(c => {
    const r = c.reading;
    let score = r.key + { straight: -4, tube: -4, plate: -4, full: -2, single: 0, pair: 0.5, triple: 1, bomb: 40 }[r.type];
    if (control(c)) score += 25;
    // an opponent about to go out: nothing he could follow with his last cards
    for (const o of opps) {
      const n = counts[o];
      if (!n) continue;
      if (n <= 5 && r.n === n && !isTop(r, others, level)) score += 30 - n;
      if (n === 1 && r.type === "single" && !isTop(r, others, level)) score += 20;
      if (n === 2 && r.type === "pair" && !isTop(r, others, level)) score += 12;
    }
    // a partner about to go out: low singles and pairs he can follow
    if (mateClose && (r.type === "single" || r.type === "pair") && r.n <= counts[mate]) score -= 8 - Math.min(8, r.key / 2);
    return { c, score };
  }).sort((a, b) => a.score - b.score);
  const pick = scored[0].c;
  let why = `Lead ${playName(pick.reading)}`;
  const backs = combos.filter(c => c !== pick && control(c));
  if (mateClose && pick.reading.n <= counts[mate]) why += `: low, for your partner, who has ${counts[mate]} left`;
  else if (oppMin <= 5 && scored[0].score < 30) why += `: nothing an opponent with ${oppMin} left can follow with`;
  else if (pick.reading.n >= 5) why += ": a long play sheds the most cards while you hold the lead";
  else why += ": the cheapest play in your hand";
  if (backs.length) why += `; ${backs.length === 1 ? playName(backs[0].reading) : `${backs.length} strong plays`} stay to win the lead back`;
  return { action: { t: "play", cards: pick.cards }, why: `${why}. Your hand goes out in ${combos.length} plays.` };
}

// ---------- following ----------
function decideFollow(state, seat, s) {
  const { level, hand, counts, mate, others } = s;
  const top = state.top.reading, from = state.top.seat;
  const cands = candidates(hand, level, top);
  if (!cands.length) return { action: { t: "pass" }, why: `Pass: nothing beats ${playName(top)}.` };
  const before = split(hand, level);
  // a play that takes you out is always taken
  const out = cands.find(c => c.cards.length === hand.length);
  if (out) return { action: { t: "play", cards: out.cards }, why: `Play ${playName(out.reading)}: it takes you out.` };
  const fromMate = from === mate;
  const fromLeft = counts[from];                                 // cards the player who played it has left
  const plain = cands.filter(c => !c.reading.bomb).map(c => ({ ...c, cost: cost(hand, level, c.cards, before) })).sort((a, b) => a.cost - b.cost || a.reading.key - b.reading.key);
  const bombs = cands.filter(c => c.reading.bomb).map(c => ({ ...c, cost: cost(hand, level, c.cards, before) })).sort((a, b) => power(a.reading) - power(b.reading));
  if (fromMate) {
    // your partner's play: let it stand, unless a free play of yours takes you to one play from out
    const free = plain.find(c => c.cost <= 0 && hand.length - c.cards.length > 0 && split(hand.filter(id => !c.cards.includes(id)), level).plays <= 1 && counts[mate] > 3);
    if (free) return { action: { t: "play", cards: free.cards }, why: `Play ${playName(free.reading)} over your partner: it leaves you one play from out.` };
    return { action: { t: "pass" }, why: `Pass: your partner's ${playName(top)} holds; don't take it from him (让牌).` };
  }
  // an opponent's play
  const danger = fromLeft > 0 && fromLeft <= 7;                   // he's close to going out
  const afterMe = (seat + 1) % 4;
  const mateStillToPlay = counts[mate] > 0 && state.passes < 2 && (from === afterMe || from === (seat + 1) % 4);
  const allowed = danger ? 3 : before.plays <= 4 ? 1.5 : 0.8;
  const best = plain[0];
  if (best && best.cost <= allowed) {
    // the controls aren't spent early on small plays unless it matters
    const spendsControl = best.reading.key >= 15 && (top.type === "single" || top.type === "pair") && top.key <= 11 && !danger && fromLeft > 10 && before.plays > 5;
    if (!spendsControl) {
      const why = danger ? `Beat it with ${playName(best.reading)}: ${nameOf(state, from)} has only ${fromLeft} left.` : best.cost <= 0 ? `Beat it with ${playName(best.reading)}: it's already a play in your hand.` : `Beat it with ${playName(best.reading)}: the cheapest that does.`;
      return { action: { t: "play", cards: best.cards }, why };
    }
  }
  // a bomb: when he's close to going out, or when a bomb and one more play would take you out
  if (bombs.length) {
    const b = bombs[0];
    const restPlays = split(hand.filter(id => !b.cards.includes(id)), level).plays;
    const finishing = restPlays <= 1;
    const fourTrap = fromLeft === 4 && !finishing;                // 火不炸四: four left may be a bomb
    if ((danger && !fourTrap) || finishing || (top.bomb && danger)) {
      const why = finishing ? `Bomb with ${playName(b.reading)}: then one more play takes you out.` : `Bomb with ${playName(b.reading)}: ${nameOf(state, from)} is down to ${fromLeft}.`;
      return { action: { t: "play", cards: b.cards }, why };
    }
  }
  if (best && best.cost <= allowed + 1.5 && danger) return { action: { t: "play", cards: best.cards }, why: `Beat it with ${playName(best.reading)}, though it breaks your hand: ${nameOf(state, from)} has ${fromLeft} left.` };
  const why = best ? `Pass: beating ${playName(top)} would cost your hand ${best.cost > 1.5 ? "too much" : "a control you'll want later"}.` : bombs.length ? `Pass: keep your bomb; ${nameOf(state, from)} has ${fromLeft} left.` : `Pass: nothing beats ${playName(top)}.`;
  return { action: { t: "pass" }, why, mateStillToPlay };
}
const nameOf = (state, seat) => state.names?.[seat] || ["South", "East", "North", "West"][seat];

// ---------- the return (还贡) ----------
function decideReturn(state, seat) {
  const level = state.level, hand = state.hands[seat];
  const ret = state.tribute.returns.find(r => r.from === seat && r.card === null);
  const toMate = ret.to === partnerOf(seat);
  const ok = returnable(hand, level);
  const copies = r => hand.filter(id => rankOf(id) === r && !isWild(id, level)).length;
  const scored = ok.map(id => {
    const rest = hand.filter(x => x !== id), sp = split(rest, level);
    const r = rankOf(id);
    // to an opponent: low, cheap to the hand, from a rank held twice or more (less likely to finish his bomb)
    let score = (sp.plays + sp.score) * 10 + r * (toMate ? -0.6 : 0.6) + (copies(r) === 1 && !toMate ? 1.5 : 0);
    return { id, score };
  }).sort((a, b) => a.score - b.score);
  const id = scored[0].id;
  const why = toMate ? `Return ${cardName(id)} to your partner: the most useful card you can give that your hand can spare.` : `Return ${cardName(id)}: low, and your hand misses it least${copies(rankOf(id)) > 1 ? "; you hold another, so it's less likely to make his bomb" : ""}.`;
  return { action: { t: "return", card: id }, why };
}

/** The hint's alternatives for the seat now: the bot's choice first, then other plays that would do (for cycling). */
export function hints(state, seat) {
  const d = decide(state, seat);
  if (!d) return [];
  const out = [d];
  if (asked(state, seat) !== "play") return out;
  const level = state.level, hand = state.hands[seat];
  const more = state.top ? candidates(hand, level, state.top.reading) : split(hand, level).combos;
  for (const c of more) if (!out.some(x => x.action.cards && x.action.cards.length === c.cards.length && x.action.cards.every(id => c.cards.includes(id)))) out.push({ action: { t: "play", cards: c.cards }, why: `${playName(c.reading)}.` });
  return out.slice(0, 8);
}
export { rankName };
