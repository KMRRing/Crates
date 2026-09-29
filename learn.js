// Learning mode: one card per clue-answer pair (Copper→Chile and Copper→Zambia are learned separately),
// remembering whether you tied that clue to that answer. A missed pair comes back a few boards later in
// a new crate, with new companions; a pair you place correctly retires to the bottom of the deck.
// Card states: "w" weak (due again at board d; missed next to answers c, beside pairs m),
// "n" seen without a clear signal, "k" known.
import { BANK, PAIRS, cardKey, norm } from "./core.js";
import { groupIndexOf } from "./gen.js";

export const REVIEW_GAP = [3, 8];            // boards until a missed clue comes back
export const TAG = { fail: "↻ back soon", learned: "✓ learned" };

export const emptyDeck = () => ({ t: 0, cards: {} });

/** Old card keys → today's pair keys. Cards were once keyed "answer.word", then "category:clue". */
function migrateKey(key, card) {
  const pos = /^(\d+)\.(\d+)$/.exec(key);
  if (pos) return BANK[+pos[1]]?.words[+pos[2]] ? [[+pos[1], +pos[2]]] : [];
  const clue = /^(country|commodity):(.+)$/.exec(key);
  if (!clue) return null;
  // only onto pairs that existed back then (and, for a miss, the answer it was missed under)
  const found = [];
  BANK.forEach((ans, a) => ans.words.forEach((w, i) => {
    if (ans.cat === clue[1] && norm(w.w) === clue[2] && !w.since && (card.a == null || card.a === a)) found.push([a, i]);
  }));
  return found;
}

export function cleanDeck(d) {
  if (!(d && typeof d === "object" && Number.isFinite(d.t) && d.cards && typeof d.cards === "object")) return emptyDeck();
  const rank = { w: 3, n: 2, k: 1 };
  for (const [key, card] of Object.entries(d.cards)) {
    const targets = migrateKey(key, card);
    if (!targets) continue;
    delete d.cards[key];
    for (const [a, i] of targets) {
      const mates = (card.m || []).map(x => (typeof x === "number" ? cardKey(a, x)
        : /^(country|commodity):/.test(x) ? `${a}|${x.split(":").slice(1).join(":")}` : x));
      const { a: _, ...rest } = card;
      const next = { ...rest, m: mates };
      const k = cardKey(a, i);
      if (!d.cards[k] || rank[next.s] > rank[d.cards[k].s]) d.cards[k] = next;
    }
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
      deck.cards[key] = { s: "w", d: deck.t + gap(rng), c: context, m: mates, f: tally.f + 1, p: tally.p };
      tags[w] = TAG.fail;
    } else if (v === "pass") {
      deck.cards[key] = { s: "k", f: tally.f, p: tally.p + 1 };
      if (prev?.s === "w") tags[w] = TAG.learned;
    } else if (prev?.s === "w") {                       // still unproven: try again in a new setting
      deck.cards[key] = { ...prev, d: deck.t + gap(rng), c: context, m: mates };
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
  s.unseen = PAIRS.size - s.review - s.learned - s.seen;
  return s;
}
