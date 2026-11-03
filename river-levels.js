// Xiangqi's computer players: Xiangqi's own engine (river-engine.js) at eight strengths, named by rough rating
// (tools/engine-levels.mjs plays them against each other, and the records of Fairy-Stockfish's levels, which these
// replaced, give the scale). The weakest four draw among the engine's best few moves after a small search, likelier the
// less a move gives up (choose() in uci.js), so they blunder as people do; the rest are the engine on a set number of
// positions. A set number of positions, not a set time, so a level is as strong on a slow phone as on a fast one.

export const LEVELS = [
  { id: "1", name: "Beginner", rating: 700, limit: "nodes 3000", multipv: 12, temper: 300 },
  { id: "2", name: "Novice", rating: 900, limit: "nodes 3000", multipv: 10, temper: 140 },
  { id: "3", name: "Casual", rating: 1150, limit: "nodes 4500", multipv: 8, temper: 70 },
  { id: "4", name: "Club", rating: 1450, limit: "nodes 7500", multipv: 6, temper: 35 },
  { id: "5", name: "Strong club", rating: 1700, limit: "nodes 4000" },
  { id: "6", name: "Expert", rating: 1950, limit: "nodes 20000" },
  { id: "7", name: "Master", rating: 2200, limit: "nodes 100000" },
  { id: "8", name: "Full strength", rating: 2300, limit: "nodes 500000" },
];
export const levelById = id => LEVELS.find(l => l.id === String(id)) || LEVELS[2];
/** The coach's search: a position's best three moves (a hint, the advice, the check) at full strength, about a second
 *  or two on a phone, and a move outside them searched alone (alone). */
export const HINT = { limit: "nodes 400000", alone: "nodes 200000" };
/** The review's search of each position of a finished game. */
export const REVIEW = { limit: "nodes 40000" };
