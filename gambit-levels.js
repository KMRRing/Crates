// Chess's computer players: Caissa at eight strengths, named by rough rating (tools/engine-levels.mjs plays them
// against each other; docs/gambit.md has what each was set against). The first six draw among the engine's best few
// moves after a small search, likelier the less a move gives up (choose() in uci.js), so they blunder as people do;
// the draw gets narrower and the search deeper up the ladder. The last two are the engine itself, at a set number of
// positions. Each searches a set number of positions, not for a set time, so a level is as strong on a slow phone
// as on a fast one.

export const LEVELS = [
  { id: "1", name: "Beginner", rating: 700, limit: "nodes 2000", multipv: 12, temper: 200 },
  { id: "2", name: "Novice", rating: 1100, limit: "nodes 2000", multipv: 10, temper: 120 },
  { id: "3", name: "Casual", rating: 1300, limit: "nodes 2500", multipv: 8, temper: 70 },
  { id: "4", name: "Club", rating: 1600, limit: "nodes 3000", multipv: 6, temper: 40 },
  { id: "5", name: "Strong club", rating: 1900, limit: "nodes 3000", multipv: 6, temper: 28 },
  { id: "6", name: "Expert", rating: 2200, limit: "nodes 3000", multipv: 6, temper: 16 },
  { id: "7", name: "Master", rating: 2500, limit: "nodes 1500" },
  { id: "8", name: "Full strength", rating: 3000, limit: "nodes 1500000" },
];
export const levelById = id => LEVELS.find(l => l.id === String(id)) || LEVELS[2];
/** The coach's search: a position's best three moves (a hint, the advice, the check) at full strength, a second or
 *  two on a phone, and a move outside them searched alone (alone). */
export const HINT = { limit: "nodes 400000", alone: "nodes 200000" };
/** The review's search of each position of a finished game. */
export const REVIEW = { limit: "nodes 60000" };
