// Every lexicon Assay plays (README, Assay): the words, and the two number games. A game keeps the id of its lexicon
// (`lang`), so a saved game, a level and a link all find the right one. Only English is dealt in the daily, the
// team's table and the race; the others are played alone, from the menu and the ladder.
import { ENGLISH } from "./assay-words.js";
import { PRIMES, EQUATIONS } from "./assay-numbers.js";

export const ALL = { en: ENGLISH, primes: PRIMES, equations: EQUATIONS };
export const IDS = Object.keys(ALL);
/** The lexicon of an id (English for any other, such as a game saved before there were others). */
export const lexOf = id => ALL[id] || ENGLISH;
/** What a lexicon's pieces are called: letters, digits or characters; a word, a prime or an equation. */
export const unitOf = lex => lex.unit || "letters";
export const nounOf = lex => lex.noun || "word";
/** Makes the lexicon ready to deal from (a file to fetch for equations); a promise. */
export const ready = lex => (lex.load ? lex.load() : Promise.resolve());
