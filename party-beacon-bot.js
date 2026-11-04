// The computer's side of Beacon (party-beacon.js), with no page in it: what makes a clue legal, how much a clue and a
// word have to do with each other, the clue the computer gives as a pilot, and the guesses it makes as a crew.
//
// What it knows is party-beacon-words.js: for each word on a board, what it brings to mind, likeliest first. A clue
// is related to a word as strongly as it comes early in that word's line (a pool word as a clue also reaches the lines
// that name it, and the words in its own line). The pilot looks at every clue the cards it wants bring to mind and takes
// the one whose run of its own cards, when the board is ranked by the clue, is longest and furthest from the first
// card that isn't its own, with a heavy penalty for the one that ends the game. The crew ranks the board by the clue
// and takes the top card, then more while they stay clearly related and the number allows. A clue it has never heard
// of ranks nothing: it guesses one card at random, as a table does when a clue means nothing to it.
import { stem } from "./party-echo.js";
import { ASSOC, GROUPS } from "./party-beacon-words.js";

const letters = w => String(w || "").toLowerCase().replace(/[^a-z]/g, "");
const KEYS = new Map();
const keyOf = w => {
  let k = KEYS.get(w);
  if (k === undefined) KEYS.set(w, k = stem(letters(w)));
  return k;
};
const GROUP_STRENGTH = 0.72;
const strength = rank => Math.max(0.35, 1 - 0.07 * rank);

// clue key → { card word → how strongly }; clue key → the clue as written
const REACH = new Map(), SHOW = new Map();
const link = (k, card, s) => {
  let m = REACH.get(k);
  if (!m) REACH.set(k, m = new Map());
  if ((m.get(card) || 0) < s) m.set(card, s);
};
for (const [word, list] of ASSOC) {
  list.forEach((a, r) => {
    const k = keyOf(a);
    if (k === keyOf(word)) return;
    if (!SHOW.has(k)) SHOW.set(k, a);
    link(k, word, strength(r));
    if (ASSOC.has(a)) link(keyOf(word), a, strength(r) * 0.9);        // a word that brings another to mind is reached by it
  });
}
// a clue that covers a whole kind of thing reaches each of them about as well as a fourth or fifth thought
const HUBS = new Map();
for (const [hub, members] of GROUPS) {
  const k = keyOf(hub);
  if (!SHOW.has(k)) SHOW.set(k, hub);
  for (const m of members) {
    link(k, m, GROUP_STRENGTH);
    if (!HUBS.has(m)) HUBS.set(m, []);
    HUBS.get(m).push(hub);
  }
}
for (const [word] of ASSOC) if (!SHOW.has(keyOf(word))) SHOW.set(keyOf(word), word);
/** The clues that bring a word to mind, likeliest first. */
const cluesFor = word => [...(ASSOC.get(word) || []), ...(HUBS.get(word) || [])];

/** How strongly a clue brings a word to mind: 0 (nothing) to 1. */
export const related = (clue, word) => REACH.get(keyOf(clue))?.get(word) || 0;
/** Whether the computer has any idea what a clue means. */
export const knows = clue => REACH.has(keyOf(clue));

/**
 * What is wrong with a clue given the words on the board (the ones still covered), in words, or "": one word of letters,
 * and nothing on the board, in any form of the word or hidden in it.
 */
export function clueProblem(clue, board) {
  const c = String(clue || "").trim().toLowerCase();
  if (!/^[a-z]{2,20}$/.test(c)) return "One word, letters only";
  for (const w of board) {
    if (keyOf(c) === keyOf(w) || (c.length >= 3 && w.length >= 3 && (c.includes(w) || w.includes(c)))) return `Too close to ${w.toUpperCase()}`;
  }
  return "";
}

const GENERIC = ["thing", "stuff", "item", "object"];
const live = rev => [...rev].map((r, i) => (r === "0" ? i : -1)).filter(i => i >= 0);

/**
 * The clue a computer pilot gives for `team` ("a" or "b" in the key): { clue, n, aims } with the number of its own cards
 * it is aiming at (aims, their positions). `rev` marks the cards already uncovered.
 */
export function giveClue({ words, key, rev, team }, rng) {
  const mine = "ab"[team], open = live(rev), board = open.map(i => words[i]);
  const own = open.filter(i => key[i] === mine), ass = open.find(i => key[i] === "x");
  const tried = new Set();
  let best = null;
  for (const i of own) for (const a of cluesFor(words[i])) {
    const k = keyOf(a);
    if (tried.has(k)) continue;
    tried.add(k);
    if (clueProblem(a, board)) continue;
    const ranked = open.map(j => [j, related(a, words[j])]).sort((p, q) => q[1] - p[1] || (key[p[0]] === mine) - (key[q[0]] === mine));
    const run = [];
    for (const [j, s] of ranked) { if (key[j] === mine && s > 0 && run.length < 4) run.push([j, s]); else break; }
    if (!run.length) continue;
    const stop = ranked[run.length]?.[1] ?? 0, last = run.at(-1)[1];
    if (stop >= last && run.length < 4) continue;                       // the first stranger ties the last card: no clue
    const value = run.reduce((t, [, s]) => t + s, 0) + 0.18 * run.length - 1.4 * stop - 2.5 * (ass != null ? related(a, words[ass]) : 0) + rng() * 0.12;
    if (!best || value > best.value) best = { value, clue: a, n: run.length, aims: run.map(r => r[0]) };
  }
  if (best) return { clue: best.clue, n: best.n, aims: best.aims };
  // nothing safe: the likeliest legal word for one of its cards, or a plain one
  for (const i of own) for (const a of cluesFor(words[i])) if (!clueProblem(a, board)) return { clue: a, n: 1, aims: [i] };
  return { clue: GENERIC.find(g => !clueProblem(g, board)) || "hmm", n: 1, aims: [] };
}

/**
 * The card a computer crew uncovers next, or -1 to stop. `made` is how many it has uncovered this turn and `n` the
 * number in the clue (0: any number). The first is always made; the rest while they are clearly related, the last one
 * the number allows (the bonus) only when it is nearly certain.
 */
export function nextGuess({ words, rev, clue, n, made }, rng) {
  const ranked = live(rev).map(i => [i, related(clue, words[i]) + rng() * 0.02]).sort((p, q) => q[1] - p[1]);
  if (!ranked.length) return -1;
  const [i, s] = ranked[0];
  if (made === 0) return i;
  const allowed = n === 0 ? 3 : n;
  if (made < allowed) return s >= 0.4 ? i : -1;
  return s >= 0.85 ? i : -1;
}
