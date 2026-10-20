// Dandan's judge of a position: the chance a seat goes on to win from it, as Medium against Medium would play it out.
// A logistic model (a weighted sum of what the table shows, squashed to a chance) whose weights were fitted to the
// results of thousands of games between Medium players, a position at the start of every turn of every game, from
// both sides (tools for that are not in the repository; the README says how it was done). Hard's look-ahead
// (dandan-think.js) ends each game it plays out in its head with this, and the coach's chances are its figures.
//
// It reads both hands: a game played out in the head has dealt the other one, so it is known there.
import { DECK, TOKEN_AT } from "./dandan-cards.js";
import { other, isLandId, isLand, isCreature, typesOf, needType, creatures, lands } from "./dandan-core.js";

const REMOVAL = new Set(["Piracy Charm", "Mind Bend", "Repulse", "Commit // Memory", "Metamorphose", "Gone Missing", "Deem Inferior"]);
const DRAW = new Set(["Brainstorm", "Predict", "Take Inventory", "Chart a Course", "Lórien Revealed", "Quicken"]);

/** The names of the features, in order (the weights below are in the same order). */
export const FEATURES = [
  "bias", "hitsMe", "hitsThem", "dangerMe", "dangerThem", "dandansMe", "dandansThem", "attackersMe", "attackersThem",
  "islandsMe", "islandsThem", "noIslandMe", "noIslandThem", "landsMe", "landsThem", "handMe", "handThem",
  "lapseMe", "lapseThem", "dandanHandMe", "dandanHandThem", "removalMe", "removalThem", "landHandMe", "landHandThem",
  "drawMe", "drawThem", "clueMe", "clueThem", "myTurn", "openMe", "openThem", "pressMe", "pressThem", "library",
];

/** How many lands a seat controls with a land type. */
const ofType = (s, seat, type) => { let n = 0; for (const l of s.bf) if (l.ctl === seat && isLand(l) && typesOf(l).includes(type)) n++; return n; };
/** A seat's Dandâns that could attack the other: the other controls the land type each looks for. */
const attackers = (s, seat) => creatures(s, seat).filter(d => ofType(s, other(seat), needType(d)) > 0).length;

/** The features of a position for a seat: the table, both hands as counts of what matters, the turn. */
export function features(s, me) {
  const opp = other(me);
  const hits = seat => Math.min(6, Math.max(0, Math.ceil(s.life[seat] / 4)));
  const hand = seat => s.hand[seat].map(id => (id >= TOKEN_AT ? "" : DECK[id]));
  const cnt = (names, f) => names.reduce((n, x) => n + (f(x) ? 1 : 0), 0);
  const hm = hand(me), ho = hand(opp);
  const open = seat => { let n = 0; for (const l of s.bf) if (l.ctl === seat && isLand(l) && !l.tapped) n++; return n; };
  const islandsOf = seat => { let n = 0; for (const l of s.bf) if (l.ctl === seat && isLand(l) && typesOf(l).includes("Island")) n++; return n; };
  const clues = seat => s.bf.filter(p => p.ctl === seat && p.id >= TOKEN_AT).length;
  const hMe = hits(me), hThem = hits(opp), aMe = attackers(s, me), aThem = attackers(s, opp);
  const iMe = islandsOf(me), iThem = islandsOf(opp);
  return [
    1, hMe, hThem, 1 / Math.max(1, hMe), 1 / Math.max(1, hThem), creatures(s, me).length, creatures(s, opp).length, aMe, aThem,
    Math.min(4, iMe), Math.min(4, iThem), iMe ? 0 : 1, iThem ? 0 : 1, Math.min(8, lands(s, me).length), Math.min(8, lands(s, opp).length),
    Math.min(10, hm.length), Math.min(10, ho.length),
    cnt(hm, n => n === "Memory Lapse"), cnt(ho, n => n === "Memory Lapse"), cnt(hm, n => n === "Dandân"), cnt(ho, n => n === "Dandân"),
    cnt(hm, n => REMOVAL.has(n)), cnt(ho, n => REMOVAL.has(n)), cnt(s.hand[me], isLandId), cnt(s.hand[opp], isLandId),
    cnt(hm, n => DRAW.has(n)), cnt(ho, n => DRAW.has(n)), clues(me), clues(opp),
    s.active === me ? 1 : 0, open(me), open(opp),
    // the race: our attackers against the hits they have left, and theirs against ours
    aMe / Math.max(1, hThem), aThem / Math.max(1, hMe),
    Math.min(1, s.lib.length / 40),
  ];
}

/** The fitted weights (see the README, Dandan: the computer players). */
export const WEIGHTS = [
  0.0278, 0.1925, -0.1924, 0.1097, -0.1094, 0.5833, -0.5834, 0.2740, -0.2739, -0.0220, 0.0220, -0.3058, 0.3059, 0.3696, -0.3696, 0.1867, -0.1867, 0.1600, -0.1600, 0.2418, -0.2418, 0.1608, -0.1608, 0.1660, -0.1660, 0.0906, -0.0906, 0.3218, -0.3218, -0.0565, 0.0731, -0.0731, 0.7280, -0.7281, 0.0001,
];

/** The chance `me` wins from here: 1 or 0 for a game over (a half for both losing), else the model's. */
export function winChance(s, me, w = WEIGHTS) {
  if (s.over) return s.winner < 0 ? 0.5 : s.winner === me ? 1 : 0;
  const x = features(s, me);
  let z = 0;
  for (let i = 0; i < x.length; i++) z += w[i] * x[i];
  return 1 / (1 + Math.exp(-z));
}
