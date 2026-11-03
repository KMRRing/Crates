// Tarot's play-outs: a deal in progress as plain arrays that can be played to the end fast (tarot-rules.js's rules,
// without the record-keeping), the rule-of-thumb player that plays every seat in a play-out, and the sampling of the
// cards a seat can't see. tarot-think.js plays each choice out in many sampled deals and tarot-bot.js's levels use
// both. Pure (no page), so the worker, the tests and the bench share it.
import { PTS, EXCUSE, PETIT, GRAND, isBout, isKing, classOf, suitOf, rankOf, legalCards, winnerOf, SIZES, TARGETS, dealValue, payments, POIGNEE_BONUS, leadBan } from "./tarot-rules.js";

const sideIn = (m, x) => (x === m.taker || x === m.partner ? 0 : 1);

/**
 * A deal in play as the play-outs hold it, seen from `viewer` (a seat, whose hand is real) with the other hands given:
 * hands[seat] arrays of cards. What the viewer may not know is not read from the record (the hidden piles are
 * the caller's sampled ones, `hidden`: { side, cards }).
 */
export function simOf(s, hands, { hidden = null, partner = null } = {}) {
  const n = s.n, total = SIZES[n].hand;
  const m = {
    n, total, hands: hands.map(h => [...h]), plays: s.trick.plays.map(p => ({ seat: p.seat, card: p.card })),
    trickNo: s.tricks.length, turn: s.turn, taker: s.taker, partner: partner ?? (s.partner == null ? -1 : s.partner), revealed: !!s.revealed,
    call: s.call == null ? -1 : s.call, bid: s.bid, chelem: !!s.chelem,
    pts: [0, 0], bouts: [0, 0], won: [s.won[0], s.won[1]], played: new Uint8Array(78), voids: new Uint8Array(n * 5),
    poignee: 0, petit: 0, ban: leadBan(s), scratch: new Uint8Array(78),
  };
  for (const p of s.poignees) m.poignee += POIGNEE_BONUS[p.level];
  // the piles: the tricks won are public; a pile's first cards (the dog, the discard) only to whoever saw them
  for (const side of [0, 1]) {
    const pile = s.piles[side], from = hidden && hidden.side === side ? s.base[side] : 0;
    for (let i = from; i < pile.length; i++) { m.pts[side] += PTS[pile[i]]; if (isBout(pile[i])) m.bouts[side]++; }
  }
  if (hidden) for (const c of hidden.cards) { m.pts[hidden.side] += PTS[c]; if (isBout(c)) m.bouts[hidden.side]++; }
  // what has been played, and who has shown a void
  const replay = plays => {
    for (let i = 0; i < plays.length; i++) {
      const { seat, card } = plays[i];
      m.played[card] = 1;
      noteVoid(m, plays, i, seat, card);
    }
  };
  for (const t of s.tricks) replay(t.plays);
  replay(s.trick.plays);
  return m;
}
/** A play that failed to follow shows a void; a trump that didn't beat the trumps there shows none higher (kept simple). */
function noteVoid(m, plays, i, seat, card) {
  if (card === EXCUSE) return;
  let led = -1;
  for (let k = 0; k < i; k++) if (plays[k].card !== EXCUSE) { led = classOf(plays[k].card); break; }
  if (led < 0) return;
  const c = classOf(card);
  if (c !== led) {
    m.voids[seat * 5 + led] = 1;
    if (led !== 4 && c !== 4) m.voids[seat * 5 + 4] = 1;
    if (led === 4) m.voids[seat * 5 + 4] = 1;
  }
}
export function cloneSim(m) {
  return { ...m, hands: m.hands.map(h => h.slice()), plays: m.plays.map(p => ({ ...p })), pts: m.pts.slice(), bouts: m.bouts.slice(), won: m.won.slice(), played: m.played.slice(), voids: m.voids.slice(), scratch: new Uint8Array(78) };
}

// ---------- playing a card ----------
export function playCard(m, seat, card) {
  const h = m.hands[seat], i = h.indexOf(card);
  h[i] = h[h.length - 1]; h.pop();
  m.played[card] = 1;
  noteVoid(m, m.plays, m.plays.length, seat, card);
  m.plays.push({ seat, card });
  m.ban = null;
  if (card === m.call) m.revealed = true;
  if (m.plays.length < m.n) { m.turn = (seat + 1) % m.n; return; }
  finishTrick(m);
}
function give(m, side, cards, skipEx = true) {
  for (const c of cards) { if (skipEx && c === EXCUSE) continue; m.pts[side] += PTS[c]; if (isBout(c)) m.bouts[side]++; }
}
function finishTrick(m) {
  const plays = m.plays, last = m.trickNo + 1 === m.total;
  const wi = winnerOf(plays);
  let winner = plays[wi].seat, wside = sideIn(m, winner);
  const cards = plays.map(p => p.card);
  const ex = plays.find(p => p.card === EXCUSE);
  if (last && cards.includes(PETIT)) m.petit = wside === 0 ? 10 : -10;
  if (ex) {
    const sp = sideIn(m, ex.seat);
    if (last) {
      if (m.won[sp] === m.total - 1 && (plays[0].card === EXCUSE || wside === sp)) { wside = sp; give(m, sp, cards, false); }
      else { give(m, wside, cards); give(m, 1 - sp, [EXCUSE], false); }
    } else if (wside !== sp) {
      give(m, sp, [EXCUSE], false);
      give(m, wside, cards);
      m.pts[sp] -= 1; m.pts[wside] += 1;                                // the half-point card owed (assumed to be at hand)
    } else give(m, wside, cards, false);
  } else give(m, wside, cards, false);
  m.won[wside]++;
  m.plays = [];
  m.trickNo++;
  m.turn = winner;
}
export const finished = m => m.trickNo >= m.total;
/** The deal's deltas by seat, from a finished play-out. */
export function deltasOf(m) {
  const bouts = m.bouts[0], target = TARGETS[bouts], diffH = m.pts[0] - 2 * target;
  const made = diffH >= 0, margin = Math.ceil(Math.abs(diffH) / 2);
  let chelem = 0;
  if (m.won[0] === m.total) chelem = m.chelem ? 400 : 200;
  else if (m.chelem || m.won[1] === m.total) chelem = -200;
  const X = dealValue({ made, margin, bid: m.bid, petit: m.petit || 0, poignee: m.poignee, chelem });
  return payments(m.n, m.taker, m.partner < 0 ? null : m.partner, X);
}

// ---------- what a seat sees of the others ----------
/** 1 an ally, −1 an opponent, 0 not known, as seat q sees seat o. */
export function relOf(m, q, o) {
  if (q === o) return 1;
  const { taker, partner, n, revealed } = m;
  if (q === taker) {
    if (partner < 0) return -1;
    if (revealed) return o === partner ? 1 : -1;
    return n === 5 ? 0 : -1;
  }
  if (q === partner) return o === taker ? 1 : -1;
  if (o === taker) return -1;
  if (n < 5) return 1;
  if (revealed && partner >= 0) return o === partner ? -1 : 1;
  return 0;
}
const voidOf = (m, seat, cls) => m.voids[seat * 5 + cls] === 1;

/** Cards not yet seen by the seat that count for a comparison: how many beat `c` in its class. */
function unseenAbove(m, mine, c) {
  let k = 0;
  if (c < 21) { for (let t = c + 1; t < 21; t++) if (!m.played[t] && !mine[t]) k++; return k; }
  const s = suitOf(c), r = rankOf(c);
  for (let x = r + 1; x < 14; x++) { const id = 22 + 14 * s + x; if (!m.played[id] && !mine[id]) k++; }
  return k;
}
function unseenIn(m, mine, cls) {
  let k = 0;
  if (cls === 4) { for (let t = 0; t < 21; t++) if (!m.played[t] && !mine[t]) k++; return k; }
  for (let x = 0; x < 14; x++) { const id = 22 + 14 * cls + x; if (!m.played[id] && !mine[id]) k++; }
  return k;
}
/** The chance that one of the seats still to play beats card c (not counting allies). */
function overtakeRisk(m, q, mine, c, later) {
  const r = 1 - 1 / (m.n - 1);
  let keep = 1;
  if (c < 21) {
    const mH = unseenAbove(m, mine, c), rm = Math.pow(r, mH);
    for (const l of later) if (relOf(m, q, l) <= 0 && !voidOf(m, l, 4)) keep *= rm;
    return 1 - keep;
  }
  const s = suitOf(c), mH = unseenAbove(m, mine, c), Us = unseenIn(m, mine, s), Tu = unseenIn(m, mine, 4);
  const rh = Math.pow(r, mH), rv = Math.pow(r, Us), rt = Math.pow(r, Tu);
  for (const l of later) {
    if (relOf(m, q, l) > 0) continue;
    const vs = voidOf(m, l, s);
    const hold = vs ? 0 : 1 - rh, cut = voidOf(m, l, 4) ? 0 : (vs ? 1 : rv) * (1 - rt);
    keep *= (1 - hold) * (1 - cut);
  }
  return 1 - keep;
}
/** What a card is worth keeping for: its chance to win a trick later. */
const keepValue = (m, mine, c) => {
  if (c === EXCUSE) return 0;
  const h = unseenAbove(m, mine, c);
  return (PTS[c] + 3) * Math.pow(0.5, h) * (c < 21 ? 0.9 : 0.6);
};

// ---------- the rule-of-thumb player ----------
/**
 * Every legal card of seat q with a score, best first: [[card, score]…]. It reads the seat's own hand, the cards
 * played and the voids shown, and who it takes to be on its side; nothing else.
 */
export function scoreMoves(m, q) {
  const hand = m.hands[q], plays = m.plays, L = legalCards(hand, plays, m.ban), n = m.n;
  const mine = m.scratch;
  mine.fill(0);
  for (const c of hand) mine[c] = 1;
  const tl = m.total - m.trickNo, out = [];
  if (!plays.length) {
    const att = q === m.taker || q === m.partner;
    const enemies = [];
    for (let o = 0; o < n; o++) if (o !== q && relOf(m, q, o) <= 0) enemies.push(o);
    let myT = 0;
    for (const c of hand) if (c < 21) myT++;
    const outT = unseenIn(m, mine, 4);
    for (const c of L) {
      let sc;
      if (c === EXCUSE) sc = tl <= 2 ? 1000 : -2.5;
      else if (c < 21) {
        const h = unseenAbove(m, mine, c);
        if (c === PETIT) sc = tl === 1 ? 60 : (outT === 0 ? -1 : -60);
        else if (att) sc = outT === 0 ? -3 : (myT >= 4 ? 6 + c * 0.06 - (h > 0 ? 1.2 : 0) : (h === 0 ? 2.5 : -3 - h * 0.3));
        else sc = outT === 0 ? -3 : (h === 0 ? 3 : -4.5 - h * 0.2);
        if (c === GRAND && !att) sc += 1;
      } else {
        const s = suitOf(c), r = rankOf(c), h = unseenAbove(m, mine, c);
        let k = 0;
        for (const x of hand) if (x >= 22 && suitOf(x) === s) k++;
        const Us = unseenIn(m, mine, s), Tu = outT, rr = 1 - 1 / (n - 1);
        let keep = 1;
        for (const e of enemies) {
          const vs = voidOf(m, e, s);
          keep *= 1 - (voidOf(m, e, 4) ? 0 : (vs ? 1 : Math.pow(rr, Us)) * (1 - Math.pow(rr, Tu)));
        }
        const cut = 1 - keep;
        if (h === 0) sc = (PTS[c] + 3) * (1 - cut) - (PTS[c] + 1) * cut + 2;
        else {
          sc = -PTS[c] * 0.9 - h * 0.3 + (k === 1 ? 1.5 : k === 2 ? 0.5 : 0) - r * 0.05;
          for (let o = 0; o < n; o++) {
            if (o === q || !voidOf(m, o, s) || voidOf(m, o, 4)) continue;
            sc += relOf(m, q, o) > 0 ? 4 : -3;
          }
        }
      }
      out.push([c, sc]);
    }
  } else {
    const later = [];
    for (let k = plays.length; k < n - 1; k++) later.push((plays[0].seat + k + 1) % n);
    const wi = winnerOf(plays), cur = plays[wi], curIsEx = cur.card === EXCUSE;
    let capture = 0, exposure = 0;
    for (const p of plays) {
      if (relOf(m, q, p.seat) > 0) exposure += PTS[p.card]; else capture += PTS[p.card];
    }
    const rel = curIsEx ? -1 : relOf(m, q, cur.seat);
    const poCur = curIsEx ? 1 : overtakeRisk(m, q, mine, cur.card, later);
    const trial = plays.concat([{ seat: q, card: 0 }]);
    for (const c of L) {
      let sc;
      trial[trial.length - 1].card = c;
      const wins = c !== EXCUSE && winnerOf(trial) === trial.length - 1;
      const kv = keepValue(m, mine, c);
      const lastTrick = tl === 1;
      if (c === EXCUSE) {
        if (tl === 2) sc = 1000;
        else sc = -(rel > 0 && poCur < 0.3 ? 0 : (rel < 0 ? capture * 0 + exposure : exposure * poCur)) - 1.2 - 0.5 * Math.max(0, tl - 2);
        if (rel > 0 && poCur < 0.3) sc -= 2;
      } else if (wins) {
        const po = overtakeRisk(m, q, mine, c, later);
        const feed = later.length ? 0.6 * later.filter(l => relOf(m, q, l) > 0).length : 0;
        const petitBonus = lastTrick && plays.some(p => p.card === PETIT) ? 10 : 0;
        let cost = c < 21 ? (c === PETIT ? (lastTrick ? 0 : 30) : 0.5 + c * 0.22) : PTS[c] * 0.25 + rankOf(c) * 0.1;
        if (c === GRAND) cost = 2.5;
        sc = (1 - po) * (capture + feed + 1 + petitBonus) - po * (PTS[c] + exposure) - cost - kv * 0.15;
        if (rel > 0 && poCur < 0.2) sc -= 3;                              // an ally is safely winning: don't spend a winner
      } else if (rel > 0 && poCur < 0.35) {
        // an ally is winning: give points to it, and keep what can still win
        let gain = PTS[c] * 0.85;
        if (c < 21) gain = isBout(c) ? PTS[c] * 0.5 : 0.4;
        if (c === PETIT) gain = lastTrick ? 5 : -25;
        sc = (1 - poCur) * gain - kv - (c < 21 ? 2 + c * 0.1 : 0);
        sc += 0.2 * (13 - rankOf(c) < 0 ? 0 : 0);
      } else {
        // the trick is lost (or an ally's, in danger): lose it as cheaply as possible
        const risk = rel > 0 ? poCur : 1;
        const lose = risk * (PTS[c] + (rel > 0 ? exposure - PTS[c] * 0 : exposure));
        sc = -lose - kv * 0.9 - (c < 21 ? 0.5 + c * 0.1 : 0) - rankOf(c) * 0.02;
        if (c === PETIT && !lastTrick) sc -= 30;
        if (isBout(c)) sc -= PTS[c] * risk;
      }
      out.push([c, sc]);
    }
  }
  out.sort((a, b) => b[1] - a[1]);
  return out;
}
/** The player's card. */
export function choose(m, q) {
  const hand = m.hands[q], L = legalCards(hand, m.plays, m.ban);
  if (L.length === 1) return L[0];
  return scoreMoves(m, q)[0][0];
}
/** Plays a sim to the end, every seat by the rule-of-thumb player; the deal's deltas. */
export function rollout(m) {
  while (m.trickNo < m.total) {
    const q = m.turn;
    playCard(m, q, choose(m, q));
  }
  return deltasOf(m);
}

// ---------- sampling the cards a seat can't see ----------
/**
 * Hands for the other seats that fit what seat q has seen: the cards unplayed and not q's, dealt out so no hand holds a
 * suit it showed it lacked, the dog's cards that must be the taker's (kings, bouts, trumps) with them, the poignées
 * shown with their holders. Returns { hands, hidden: { side, cards } | null, partner }.
 */
export function sample(s, q, rng) {
  let r;
  for (let k = 0; k < 8; k++) { r = sampleOnce(s, q, rng); if (!r.bad) break; }
  return r;
}
function sampleOnce(s, q, rng) {
  let bad = 0;
  const n = s.n, total = SIZES[n].hand;
  const base = simOf(s, s.hands.map((h, i) => (i === q ? h : [])));    // for its played cards and voids
  const played = base.played;
  const own = new Set(s.hands[q]);
  const sizes = s.hands.map(h => h.length);
  const hands = s.hands.map((h, i) => (i === q ? [...h] : []));
  const seen = (s.dogSeen || false);
  // hidden pile: the discard (to anyone but the taker, who made it) or the unseen dog
  let hidden = null;
  const k = s.dog.length;
  if (s.bid > 2) hidden = { side: s.bid === 3 ? 0 : 1, size: k, plain: false, fixed: [] };
  else if (q !== s.taker) hidden = { side: 0, size: k, plain: true, fixed: s.ecartShown.filter(c => !played[c]) };
  const fixedOf = Array.from({ length: n }, () => []);
  for (const p of s.poignees) if (p.seat !== q) for (const c of p.cards) if (!played[c]) fixedOf[p.seat].push(c);
  const fixedSet = new Set(fixedOf.flat());
  const dogHeld = [];
  if (seen && q !== s.taker) for (const c of s.dog) if (!played[c] && !s.ecartShown.includes(c) && (isKing(c) || c < 22)) dogHeld.push(c);
  const dogPlain = seen && q !== s.taker ? s.dog.filter(c => !played[c] && !dogHeld.includes(c) && !s.ecartShown.includes(c)) : [];
  const dogSet = new Set(dogPlain);
  const slots = sizes.map((z, i) => (i === q ? 0 : z));
  for (let i = 0; i < n; i++) if (i !== q) { for (const c of fixedOf[i]) hands[i].push(c); slots[i] -= fixedOf[i].length; }
  for (const c of dogHeld) if (!fixedSet.has(c)) { hands[s.taker].push(c); slots[s.taker]--; }
  let hslots = 0;
  if (hidden) { hslots = hidden.size - hidden.fixed.length; }
  const pool = [];
  for (let c = 0; c < 78; c++) {
    if (played[c] || own.has(c) || fixedSet.has(c) || dogHeld.includes(c) || (hidden && hidden.fixed.includes(c))) continue;
    if (q === s.taker && s.bid <= 2 && s.ecart.includes(c)) continue;      // the taker's own discard is known
    pool.push(c);
  }
  // deal: the most restricted cards first
  const allowed = c => {
    const out = [], cls = c === EXCUSE ? -1 : classOf(c);
    for (let i = 0; i < n; i++) if (i !== q && slots[i] > 0 && (cls < 0 || !base.voids[i * 5 + cls])) out.push(i);
    if (hslots > 0 && (!hidden.plain || (c >= 22 && !isKing(c)))) out.push(-1);
    return out;
  };
  const order = pool.map(c => [c, rng()]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const keyed = order.map(c => [c, allowed(c).length]).sort((a, b) => a[1] - b[1]);
  const hiddenCards = hidden ? [...hidden.fixed] : [];
  for (const [c] of keyed) {
    const ok = allowed(c);
    let target;
    if (!ok.length) {
      bad++;
      // nothing fits: any seat with room
      const any = [];
      for (let i = 0; i < n; i++) if (i !== q && slots[i] > 0) any.push(i);
      if (hslots > 0) any.push(-1);
      if (!any.length) continue;
      target = any[Math.floor(rng() * any.length)];
    } else {
      let tot = 0;
      const w = ok.map(i => { const x = i === -1 ? hslots * (dogSet.has(c) ? 2.5 : 1) : slots[i]; tot += x; return x; });
      let r = rng() * tot;
      target = ok[ok.length - 1];
      for (let j = 0; j < ok.length; j++) { r -= w[j]; if (r <= 0) { target = ok[j]; break; } }
    }
    if (target === -1) { hiddenCards.push(c); hslots--; } else { hands[target].push(c); slots[target]--; }
  }
  // repair: a card in a hand that showed it void is swapped with one that suits both
  const viol = (i, c) => c !== EXCUSE && base.voids[i * 5 + classOf(c)] === 1;
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      if (i === q) continue;
      for (let a = 0; a < hands[i].length; a++) {
        const x = hands[i][a];
        if (!viol(i, x) || fixedSet.has(x)) continue;
        search: for (let j = 0; j < n; j++) {
          if (j === q || j === i) continue;
          for (let b = 0; b < hands[j].length; b++) {
            const y = hands[j][b];
            if (fixedSet.has(y) || viol(j, x) || viol(i, y)) continue;
            hands[i][a] = y; hands[j][b] = x; moved = true;
            break search;
          }
        }
      }
    }
    if (!moved) break;
  }
  bad = 0;
  for (let i = 0; i < n; i++) if (i !== q) for (const c of hands[i]) if (viol(i, c)) bad++;
  let partner = s.partner == null ? -1 : s.partner;
  if (s.n === 5 && s.call != null && q !== s.taker && q !== s.partner && !s.revealed) {
    partner = hands.findIndex((h, i) => i !== s.taker && i !== q && h.includes(s.call));
  } else if (s.n === 5 && s.call != null && q === s.taker && !s.revealed && !s.alone) {
    partner = hands.findIndex((h, i) => i !== s.taker && h.includes(s.call));
  }
  return { hands, hidden: hidden ? { side: hidden.side, cards: hiddenCards } : null, partner, bad };
}

/**
 * Plays a candidate card out in a sampled deal and returns the seat's score, for each card in `cands`.
 */
export function evaluate(s, q, cands, rng, samples, { deadline = Infinity } = {}) {
  const sums = cands.map(() => 0);
  let done = 0;
  for (let k = 0; k < samples; k++) {
    if (k > 0 && Date.now() > deadline) break;
    const smp = sample(s, q, rng);
    const root = simOf(s, smp.hands, { hidden: smp.hidden, partner: smp.partner });
    for (let i = 0; i < cands.length; i++) {
      const m = cloneSim(root);
      playCard(m, q, cands[i]);
      const d = rollout(m);
      sums[i] += d[q];
    }
    done++;
  }
  return { means: sums.map(x => (done ? x / done : 0)), n: done };
}
