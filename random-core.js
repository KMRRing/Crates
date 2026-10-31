// Random mode's rules (README, Random mode), apart from any page so the tests run them in Node: which games it deals
// and what a round of each is, the ones it leaves out and why, the choice of games kept on the device, and the pick.
// random.js is the page's side of it: the games screen's Random, the tag in a game's title, the banner at a round's end.

/**
 * The games random mode deals, by the games screen's id (apps.js), each with what counts as its round. The moment a
 * round's result is final, the game calls roundOver (random.js), and random mode moves on to the next game. A game
 * here must make that call (tests/random.mjs reads every one's files for it).
 */
export const ROUNDS = {
  // Knowledge
  crates: "a board, solved or out of lives",
  punt: "a run, its last bet settled (an endless run, when you end it)",
  quote: "a set, its last quote settled",
  origin: "a run of five countries, its last one decided",
  order: "a run, its last card placed or its lives gone",
  chart: "a set, its last pin in",
  arb: "a run of five routes, its last one decided",
  crossword: "a grid, solved or revealed",
  // Courses
  calibre: "a level, its movement running",
  blend: "an order certified, or a desk's tanks closed",
  refinery: "a level, its plant run to more stars than it had",
  brut: "a flight of six wines named, or a study session",
  parley: "a study session",
  // Puzzles
  glyph: "a board, solved or given up",
  delta: "a board, solved or given up",
  spot: "a run, its lives gone",
  manifest: "a run, its twelve rounds played or its lives gone",
  harbour: "a level's plan run to delivery, or a week of a region's season",
  pipes: "a level, cleared or spilled, or a descent",
  survey: "a block cleared",
  stow: "a manifest stowed, or a level of loose cargo won or stuck",
  // Classics
  sudoku: "a grid solved",
  mines: "a field, cleared or blown up",
  nonogram: "a picture finished, and named when naming is on",
  hitori: "a puzzle solved",
  bulls: "a code broken or its rows run out, a duel settled, or a lock opened",
  assay: "a word, found or its guesses gone",
  yield: "a puzzle to Master refiner, or over (every word, the clock, or the words shown)",
  isomer: "a puzzle solved",
  ladder: "a ladder climbed",
  lode: "a board finished",
  lots: "a board over",
  codeword: "a grid solved",
  acrostic: "a text solved",
  calcudoku: "a grid solved",
  kakuro: "a grid solved",
  // Idle: the game over, as each says it
  heliograph: "a game over",
  shunt: "a game over",
  polder: "a game over",
  topple: "a game over (in Levels, the level's)",
  orrery: "a game over",
  avalanche: "a game over",
  netting: "a game over",
  settle: "a game over",
  drift: "a game over",
  slipway: "a part carved to a star, or an assembly that holds",
  loom: "a cloth woven",
  guilloche: "a plate, every zone cut true",
  // Board & card games: a hand where the game is dealt hand by hand, else a game
  cartel: "a game",
  hong: "a hand",
  tribute: "a hand",
  river: "a game",
  gambit: "a game",
  boast: "a round of bidding, its cups lifted",
  bigtwo: "a deal",
  landlord: "a deal",
  banquet: "a match",
  gammon: "a game (a point or more of the match)",
  trumps: "a hand",
  contract: "a deal",
  bones: "a hand",
  factor: "a game",
  dandan: "a game",
  // Casino
  baccarat: "a coup",
  blackjack: "a hand",
  roulette: "a spin",
  sicbo: "a roll",
  craps: "a pass line decided: a come-out's natural or craps, the point made, or a seven out",
  holdem: "a hand",
};

/** The games random mode leaves out, and why. Party's own games (`party: true` in apps.js: they open Party) are out
 *  without a word here; every other game on the games screen is in ROUNDS or here (tests/random.mjs checks). */
export const LEFT_OUT = {
  deck: "the review of every game's misses: it deals only what's due, so there's often nothing to play",
  lexicon: "the knowledge base to look things up in, not a game",
  ledger: "the record of how well you learn, not a game",
  party: "a room for people round a table, each on their own phone",
  cue: "a word to act, draw or describe for the people round you",
  quest: "hidden loyalties, a game for people round a table (Party's section)",
  timegrapher: "an instrument, not a game",
  // not built yet: the tile opens a page saying what's to do (soon-data.js); a game that's built moves to ROUNDS
  bridges: "not built yet", masyu: "not built yet", nurikabe: "not built yet", slitherlink: "not built yet",
  rack: "not built yet", stone: "not built yet", pegs: "not built yet", meld: "not built yet", tarot: "not built yet",
};

/** Every game random mode can deal, in the order above. */
export const ELIGIBLE = Object.freeze(Object.keys(ROUNDS));
const IN = new Set(ELIGIBLE);

/**
 * The games chosen, from what the device keeps ({ out: [ids] }: the ones taken out, so a game added later comes in, as
 * every game does at first): every eligible game but those, in ELIGIBLE's order.
 */
export function chosenFrom(kept) {
  const out = new Set(Array.isArray(kept?.out) ? kept.out : []);
  return ELIGIBLE.filter(id => !out.has(id));
}
/** What the device keeps for a choice of games: the eligible ones left out (unknown ids are dropped). */
export function keptFrom(chosen) {
  const on = new Set(chosen.filter(id => IN.has(id)));
  return { out: ELIGIBLE.filter(id => !on.has(id)) };
}
/** Random mode can start with at least one game chosen. */
export const canStart = chosen => Array.isArray(chosen) && chosen.some(id => IN.has(id));

/**
 * The next game: one of `chosen` (eligible ids) at random, never `current` (the game just played) unless it's the only
 * one; null when nothing is chosen. `random` is Math.random's kind (0 ≤ x < 1).
 */
export function pickNext(chosen, current = null, random = Math.random) {
  const pool = (chosen || []).filter(id => IN.has(id));
  if (!pool.length) return null;
  const others = pool.filter(id => id !== current), from = others.length ? others : pool;
  return from[Math.min(from.length - 1, Math.floor(random() * from.length))];
}

/** A game on seats.js has ended a round when its step (as random.js's seatRounds reads it: "over" for the game's end)
 *  changes to "over" or to one of `steps` (a hand shown or scored); the first step seen (`seen` null) is where the
 *  table stood when the page opened, not a change. */
export const endsRound = (seen, now, steps = []) => seen != null && now !== seen && (now === "over" || steps.includes(now));

/** Random mode is solo: never in a duo match (?room=), a table (?table=), a party (?party=) or a partner's watching
 *  view (?watch, ?frame). `search` is the address's query (location.search). */
const TOGETHER = ["room", "table", "party", "watch", "frame"];
export const soloAddress = search => { const q = new URLSearchParams(search || ""); return !TOGETHER.some(k => q.has(k)); };

/** A run of random mode as the session keeps it ({ game, at }: the game it sent you to, and when), or null when there's
 *  none or what's kept isn't one. */
export function runOf(text) {
  try {
    const r = JSON.parse(text);
    return r && typeof r.game === "string" && IN.has(r.game) ? { game: r.game, at: Number(r.at) || 0 } : null;
  } catch { return null; }
}
