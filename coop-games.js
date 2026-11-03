// The games that can be played as a pair on one shared board (docs/coop.md), by id. Each is a module of pure functions
// (<game>-coop.js: id, name, page, keys, share, run, valid) that a phone loads when a partner is let in, from any page,
// so none of them may touch a page. A game is added here once its own page is wired to the shared board.
import slitherlink from "./slitherlink-coop.js";

export const COOP_GAMES = { slitherlink };
export const coopGame = id => COOP_GAMES[id] || null;
