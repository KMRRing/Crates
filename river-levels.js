// River's computer players: Fairy-Stockfish at eight strengths, named by rough rating (tools/engine-levels.mjs plays
// them against each other; README, River, has how they were measured). The weakest four draw among the engine's best
// few moves after a small search, likelier the less a move gives up (choose() in uci.js), so they blunder as people
// do; the rest are the engine at full strength on a set number of positions. Not its own limiter (UCI_Elo): that is
// calibrated for chess, and in Xiangqi it lost to the strongest drawing level. A set number of positions, not a set
// time, so a level is as strong on a slow phone as on a fast one.

export const LEVELS = [
  { id: "1", name: "Beginner", rating: 700, limit: "nodes 800", multipv: 12, temper: 300 },
  { id: "2", name: "Novice", rating: 950, limit: "nodes 1000", multipv: 10, temper: 140 },
  { id: "3", name: "Casual", rating: 1150, limit: "nodes 1500", multipv: 8, temper: 70 },
  { id: "4", name: "Club", rating: 1450, limit: "nodes 2500", multipv: 6, temper: 35 },
  { id: "5", name: "Strong club", rating: 1700, limit: "nodes 1500" },
  { id: "6", name: "Expert", rating: 1900, limit: "nodes 4000" },
  { id: "7", name: "Master", rating: 2200, limit: "nodes 20000" },
  { id: "8", name: "Full strength", rating: 2700, limit: "nodes 500000" },
];
export const levelById = id => LEVELS.find(l => l.id === String(id)) || LEVELS[2];
/** The coach's search for a hint: the engine at full strength, about a second or two on a phone. */
export const HINT = { limit: "nodes 250000" };
/** The review's search of each position of a finished game. */
export const REVIEW = { limit: "nodes 20000" };
/** The engine's set-up for Xiangqi, sent once it has started: no NNUE net (it has none for Xiangqi) and the variant. */
export const SETUP = ["setoption name UCI_Variant value xiangqi", "setoption name Use NNUE value false"];
