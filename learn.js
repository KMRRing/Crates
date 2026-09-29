// Learning mode: remembers, clue by clue, whether you knew what it points to. A missed clue comes back
// a few boards later in a new crate, with new companions, and under a different answer when the clue
// belongs to more than one. A clue you place correctly retires to the bottom of the deck.
// Cards are keyed by the clue itself (cardKey), so the same text under two answers is one card.
// Card states: "w" weak (due again at board d; missed under answer a, next to answers c, beside
// clues m), "n" seen without a clear signal, "k" known.
import { BANK, ENTRIES, cardKey } from "./core.js";
import { groupIndexOf } from "./gen.js";

export const REVIEW_GAP = [3, 8];            // boards until a missed clue comes back
export const TAG = { fail: "↻ back soon", learned: "✓ learned" };

export const emptyDeck = () => ({ t: 0, cards: {} });

export function cleanDeck(d) {
  if (!(d && typeof d === "object" && Number.isFinite(d.t) && d.cards && typeof d.cards === "object")) return emptyDeck();
  // Cards used to be keyed by bank position ("answer.word"); move them onto the clue itself.
  const rank = { w: 3, n: 2, k: 1 };
  for (const [key, card] of Object.entries(d.cards)) {
    const m = /^(\d+)\.(\d+)$/.exec(key);
    if (!m) continue;
    delete d.cards[key];
    const a = Number(m[1]), i = Number(m[2]);
    if (!BANK[a]?.words[i]) continue;
    const k = cardKey(a, i);
    const next = { ...card, a: card.a ?? a, m: (card.m || []).map(x => (typeof x === "number" ? cardKey(a, x) : x)) };
    if (!d.cards[k] || rank[next.s] > rank[d.cards[k].s]) d.cards[k] = next;
  }
  return d;
}

const gap = rng => REVIEW_GAP[0] + Math.floor(rng() * (REVIEW_GAP[1] - REVIEW_GAP[0] + 1));

/**
 * Reads a finished board and updates the deck. The question per clue: did you tie it to its answer?
 *   Yes: its crate was found and named, or a "one away" guess put it among the three that belonged.
 *   No:  it was the odd one out or the one left out in a "one away", you opened its clue, its crate
 *        was found but not named, or its crate was never found and nothing showed you placed it.
 * A clue that sat in a plain miss (two and two, or worse) proves nothing either way.
 * Returns { word: tag } for the words worth flagging on the solved crates.
 */
export function learnFromBoard(deck, board, game, rng = Math.random) {
  const words = board.groups.map(g => g.w.map(i => BANK[g.a].words[i].w));
  const named = new Set(game.found.filter(f => f.named).map(f => f.g));
  const missed = new Set(), placed = new Set(), unclear = new Set();
  for (const key of game.tried) {
    const picked = key.split("|");
    const crates = picked.map(w => groupIndexOf(board, w));
    const counts = {};
    crates.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    const [top, n] = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
    if (n === 4) continue;
    if (n === 3) {
      picked.forEach((w, k) => (crates[k] === Number(top) ? placed : missed).add(w));
      words[top].forEach(w => { if (!picked.includes(w)) missed.add(w); });
    } else {
      picked.forEach(w => unclear.add(w));
    }
  }
  game.revealed.forEach(w => missed.add(w));
  game.found.filter(f => !f.named).forEach(f => words[f.g].forEach(w => missed.add(w)));
  const verdictOf = (w, gi) => {
    if (missed.has(w) || (!named.has(gi) && !placed.has(w))) return "fail";
    return unclear.has(w) ? "unclear" : "pass";
  };

  const tags = {};
  const context = board.groups.map(g => g.a);
  board.groups.forEach((g, gi) => g.w.forEach((wi, k) => {
    const w = words[gi][k], key = cardKey(g.a, wi), prev = deck.cards[key];
    const tally = { f: prev?.f || 0, p: prev?.p || 0 };
    const mates = g.w.filter(x => x !== wi).map(x => cardKey(g.a, x));
    const v = verdictOf(w, gi);
    if (v === "fail") {
      deck.cards[key] = { s: "w", d: deck.t + gap(rng), a: g.a, c: context, m: mates, f: tally.f + 1, p: tally.p };
      tags[w] = TAG.fail;
    } else if (v === "pass") {
      deck.cards[key] = { s: "k", f: tally.f, p: tally.p + 1 };
      if (prev?.s === "w") tags[w] = TAG.learned;
    } else if (prev?.s === "w") {                       // still unproven: try again in a new setting
      deck.cards[key] = { ...prev, d: deck.t + gap(rng), a: g.a, c: context, m: mates };
    } else {
      deck.cards[key] = { s: "n", ...tally };
    }
  }));
  return tags;
}

export function deckStats(deck) {
  const s = { review: 0, learned: 0, seen: 0 };
  for (const c of Object.values(deck.cards)) {
    if (c.s === "w") s.review++; else if (c.s === "k") s.learned++; else s.seen++;
  }
  s.unseen = ENTRIES.size - s.review - s.learned - s.seen;
  return s;
}
