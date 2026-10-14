// River's computer players: Fairy-Stockfish at eight strengths, named by rough rating (tools/engine-levels.mjs plays
// them against each other; README, River, has how they were measured). The weakest four draw among the engine's best
// few moves after a small search, likelier the less a move gives up (choose() in uci.js), so they blunder as people
// do; the rest are the engine's own limiter (UCI_Elo) or its full strength, each searching a set number of positions,
// so a level is as strong on a slow phone as on a fast one.

export const LEVELS = [
  { id: "1", name: "Beginner", rating: 500, limit: "nodes 800", multipv: 12, temper: 300 },
  { id: "2", name: "Novice", rating: 800, limit: "nodes 1200", multipv: 10, temper: 180 },
  { id: "3", name: "Casual", rating: 1100, limit: "nodes 2000", multipv: 8, temper: 110 },
  { id: "4", name: "Club", rating: 1400, limit: "nodes 3500", multipv: 6, temper: 65 },
  { id: "5", name: "Strong club", rating: 1700, limit: "nodes 3000" },
  { id: "6", name: "Expert", rating: 2000, limit: "nodes 15000" },
  { id: "7", name: "Master", rating: 2300, limit: "nodes 80000" },
  { id: "8", name: "Full strength", rating: 2600, limit: "nodes 500000" },
];
export const levelById = id => LEVELS.find(l => l.id === String(id)) || LEVELS[2];
/** The coach's search for a hint: the engine at full strength, about a second or two on a phone. */
export const HINT = { limit: "nodes 250000" };
/** The engine's set-up for Xiangqi, sent once it has started: no NNUE net (it has none for Xiangqi) and the variant. */
export const SETUP = ["setoption name UCI_Variant value xiangqi", "setoption name Use NNUE value false"];
