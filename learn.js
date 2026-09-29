// Learning mode: remembers, word by word, whether you knew it. A missed word comes back a few boards
// later in a new crate with new companions; a word you get right retires to the bottom of the deck.
// Card states: "w" weak (due again at board d), "n" seen without a clear signal, "k" known.
import { BANK } from "./core.js";
import { groupIndexOf } from "./gen.js";

export const REVIEW_GAP = [3, 8];            // boards until a missed word comes back
export const TAG = { fail: "↻ back soon", learned: "✓ learned" };

export const emptyDeck = () => ({ t: 0, cards: {} });
export function cleanDeck(d) {
  return d && typeof d === "object" && Number.isFinite(d.t) && d.cards && typeof d.cards === "object"
    ? d : emptyDeck();
}

const gap = rng => REVIEW_GAP[0] + Math.floor(rng() * (REVIEW_GAP[1] - REVIEW_GAP[0] + 1));

/**
 * Reads a finished board and updates the deck. A word counts as missed if its crate was never found
 * or never named, if a clue was opened on it, or if a "one away" guess put it in the wrong crate or
 * left it out of its own. Words in a plain miss get no verdict either way.
 * Returns { word: tag } for the words worth flagging on the solved crates.
 */
export function learnFromBoard(deck, board, game, rng = Math.random) {
  const words = board.groups.map(g => g.w.map(i => BANK[g.a].words[i].w));
  const verdict = new Map();
  board.groups.forEach((g, gi) => {
    const f = game.found.find(x => x.g === gi);
    words[gi].forEach(w => verdict.set(w, f && f.named ? "pass" : "fail"));
  });
  for (const key of game.tried) {
    const picked = key.split("|");
    const crates = picked.map(w => groupIndexOf(board, w));
    const counts = {};
    crates.forEach(c => { counts[c] = (counts[c] || 0) + 1; });
    const [top, n] = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
    if (n === 4) continue;
    if (n === 3) {
      picked.forEach((w, k) => { if (crates[k] !== Number(top)) verdict.set(w, "fail"); });
      words[top].forEach(w => { if (!picked.includes(w)) verdict.set(w, "fail"); });
    } else {
      picked.forEach(w => { if (verdict.get(w) === "pass") verdict.set(w, "shaky"); });
    }
  }
  game.revealed.forEach(w => verdict.set(w, "fail"));

  const tags = {};
  const context = board.groups.map(g => g.a);
  board.groups.forEach((g, gi) => g.w.forEach((wi, k) => {
    const w = words[gi][k], key = `${g.a}.${wi}`, prev = deck.cards[key];
    const tally = { f: prev?.f || 0, p: prev?.p || 0 };
    const mates = g.w.filter(x => x !== wi);
    const v = verdict.get(w);
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
  s.unseen = BANK.reduce((n, a) => n + a.words.length, 0) - s.review - s.learned - s.seen;
  return s;
}
