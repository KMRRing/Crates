// Assay's levels, pure (no page): a ladder of word games in chapters, each chapter bringing a twist to the ones before:
// plain words of four to six letters; longer words and the hardest of each length; Wordle's hard rule and the strict
// one; several boards at once; the word that dodges; and the three-minute sprint. A level is a kind of game (a mode, a
// length, how hard the words are, a rule), not one word: the first time it is the same word for everyone (the level's
// own seed), and a new word of the level is another from the same recipe, so a level can be replayed for its stars.
// Stars are for the guesses (a sprint's: the words solved): one for solving it, two within a guess of the par (two
// for the dodging word), three within the par. A par is the middle score of the Steady computer player
// (assay-solve.js) over twenty-four words of the recipe, set by hand: never under four on one word, since three
// guesses is luck; a sprint's counted in words, a person typing faster than Steady thinks; and a game's par two short
// of its limit at most, so a solve on the last guess is still a star. Solving a level opens the next; any level open
// can be played at any time, as it was left.
import { newGame, guessesFor, sprintSolved } from "./assay-engine.js";
import { ENGLISH } from "./assay-words.js";

const level = spec => ({ boards: 1, rules: "free", ...spec });
/** The chapters: where each begins in LEVELS, its name and what it brings. */
export const CHAPTERS = [
  { name: "First words", from: 0, about: "Guess the hidden word. Each letter is marked in place, elsewhere in the word, or not in it." },
  { name: "Long words", from: 5, about: "Six and seven letters give more away with every guess, and the hardest words of each length come to mind late." },
  { name: "The rules", from: 10, about: "Wordle's hard rule: a letter found stays where it is, and every letter shown is used. Strict goes further: every guess must be able to be the word." },
  { name: "Boards", from: 15, about: "Two, four or eight words at once, every guess played on all of them, with a few guesses more." },
  { name: "The dodging word", from: 20, about: "No word is chosen. Each guess is marked to keep as many words in play as it can. Leave it one, and guess it." },
  { name: "Sprints", from: 24, about: "Three minutes, as many words as you can. A word spent or solved moves you on at once." },
];
export const LEVELS = [
  level({ name: "Warm-up", len: 5, level: "easy", par: 4 }),
  level({ name: "Short and sweet", len: 4, level: "easy", par: 4 }),
  level({ name: "Everyday", len: 5, level: "medium", par: 4 }),
  level({ name: "Taking its time", len: 6, level: "easy", par: 4 }),
  level({ name: "Tough little words", len: 4, level: "medium", par: 5 }),

  level({ name: "Six letters", len: 6, level: "medium", par: 4 }),
  level({ name: "Seven letters", len: 7, level: "easy", par: 4 }),
  level({ name: "Longer still", len: 7, level: "medium", par: 4 }),
  level({ name: "Tricky fives", len: 5, level: "hard", par: 5 }),
  level({ name: "Hard sixes", len: 6, level: "hard", par: 4 }),

  level({ name: "Held to it", len: 5, level: "easy", rules: "hard", par: 4 }),
  level({ name: "No letting go", len: 5, level: "medium", rules: "hard", par: 4 }),
  level({ name: "Strictly", len: 5, level: "easy", rules: "strict", par: 4 }),
  level({ name: "Only the possible", len: 5, level: "medium", rules: "strict", par: 4 }),
  level({ name: "Held to six", len: 6, level: "medium", rules: "hard", par: 4 }),

  level({ name: "Twin boards", mode: "boards", len: 5, boards: 2, level: "easy", par: 5 }),
  level({ name: "Twin, tougher", mode: "boards", len: 5, boards: 2, level: "medium", par: 5 }),
  level({ name: "Four at once", mode: "boards", len: 5, boards: 4, level: "easy", par: 7 }),
  level({ name: "Four, tougher", mode: "boards", len: 5, boards: 4, level: "medium", par: 7 }),
  level({ name: "Octet", mode: "boards", len: 5, boards: 8, level: "easy", par: 11 }),

  level({ name: "Slippery four", mode: "dodge", len: 4, level: "easy", par: 6 }),
  level({ name: "Slippery five", mode: "dodge", len: 5, level: "easy", par: 5 }),
  level({ name: "Slipperier", mode: "dodge", len: 5, level: "medium", par: 6 }),
  level({ name: "Eel", mode: "dodge", len: 6, level: "medium", par: 6 }),

  level({ name: "Quick fours", mode: "sprint", len: 4, level: "easy", par: 5 }),
  level({ name: "Quick fives", mode: "sprint", len: 5, level: "easy", par: 6 }),
  level({ name: "Against the clock", mode: "sprint", len: 5, level: "medium", par: 5 }),
  level({ name: "Long sprint", mode: "sprint", len: 6, level: "easy", par: 8 }),
].map(L => ({ mode: "classic", ...L }));
export const COUNT = LEVELS.length;
/** The chapter a level is in. */
export const chapterOf = i => { let c = 0; CHAPTERS.forEach((ch, k) => { if (i >= ch.from) c = k; }); return c; };

/** A level's own seed: the word everyone gets the first time. */
export const seedOf = i => 6007 + 7919 * i;
/**
 * A new game of level i (0 on), from a seed (default: the level's own, which asks for no word to be avoided so it is
 * the same for everyone); `avoid` is words seen lately, for a seed of your own.
 */
export function levelGame(i, seed = seedOf(i), avoid = [], lex = ENGLISH) {
  const L = LEVELS[i];
  return newGame({ lex, mode: L.mode, len: L.len, boards: L.boards, level: L.level, rules: L.rules, seed, avoid: seed === seedOf(i) ? [] : avoid });
}

// ---------- the stars ----------
/** How many guesses past the par still earn two stars: one, but the dodging word has no limit to be near, so two. */
export const slackOf = L => (L.mode === "dodge" ? 2 : 1);
/** The words a sprint must solve for 1, 2 and 3 stars. */
export const sprintNeeds = L => [Math.max(1, Math.round(.4 * L.par)), Math.max(2, Math.round(.7 * L.par)), L.par];
/** Stars for a finished game of level i: 0 (not cleared), 1, 2 or 3. */
export function starsFor(i, g) {
  const L = LEVELS[i];
  if (L.mode === "sprint") {
    const n = sprintSolved(g), [one, two, three] = sprintNeeds(L);
    return n >= three ? 3 : n >= two ? 2 : n >= one ? 1 : 0;
  }
  if (g.over !== "won") return 0;
  const used = g.guesses.length;
  return used <= L.par ? 3 : used <= L.par + slackOf(L) ? 2 : 1;
}
/** What the stars ask of a level, in words. */
export function parText(i) {
  const L = LEVELS[i];
  if (L.mode === "sprint") { const [one, two, three] = sprintNeeds(L); return `${three} words for three stars, ${two} for two, ${one} to clear it`; }
  return `${L.par} guesses for three stars, ${L.par + slackOf(L)} for two`;
}
/** The guesses a level allows (a sprint's: each word's; the dodging word: none, no limit). */
export const limitOfLevel = i => { const L = LEVELS[i]; return L.mode === "dodge" ? Infinity : guessesFor(L.len, L.boards); };
