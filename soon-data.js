// The games on the games screen that aren't built yet (31 October 2026, Korbi: "Bridges, masyu, nurikabe, slitherlink,
// rack, go, pegs, meld, French tarot… the rest just get a tile placeholder with todo for now"). Each has a tile, and the tile
// opens soon.html, which says what the game will be and what's left to do. `id`, `name` and `sec` are the tile's (apps.js);
// `line` is the game in a sentence, `todo` what building it takes and where the risk is. A game that gets built loses its entry
// here and its tile points at its own page; tests/soon.mjs fails while a tile and its entry disagree.
export const SOON = {
  bridges: {
    name: "Bridges", sec: "classics",
    line: "Hashiwokakero: islands numbered with how many bridges they need, joined by one or two straight bridges, none crossing, until every island is in one network.",
    todo: [
      "The engine: a generator that makes boards with exactly one solution, and a solver that grades them by the hardest step a person would need (Hitori's and Sudoku's pipeline, README, Classics).",
      "Dragging from island to island builds a bridge; tapping a bridge cycles none, one, two. Undo, hints and the time, as the other Classics have them.",
      "Then dailies, Random's round (a board solved) and the head-to-head by duel.js, as for every Classic.",
    ],
  },
  masyu: {
    name: "Masyu", sec: "classics",
    line: "One loop through a grid, passing every pearl: it turns on a black pearl and runs straight for at least a cell either side of it; it goes straight through a white pearl and turns in at least one of the cells beside it.",
    todo: [
      "Shares a loop engine with Slitherlink, so it waits for that one.",
      "Generating boards with a single solution is the risk: more pearls than needed make it easy, fewer leave it ambiguous.",
      "Drawing the loop is a drag across cells; a tap on a cell edge is the alternative on a phone.",
    ],
  },
  nurikabe: {
    name: "Nurikabe", sec: "classics",
    line: "Numbered cells are islands of exactly that many cells, each with one number; the rest is one connected sea, with no 2×2 block of it.",
    todo: [
      "The risk is the generator: boards that are unique and solvable by reasoning alone, never by guessing, are hard to make (Survey's and Hitori's rule), and many generators fail it.",
      "Do not ship it until a solver that only reasons as a person does can finish every board it makes.",
    ],
  },
  slitherlink: {
    name: "Slitherlink", sec: "classics",
    line: "One loop along the edges of a grid of dots; each number says how many of its cell's four sides the loop uses.",
    todo: [
      "The engine: a solver on edges with propagation, a generator that checks the solution is unique, difficulty by the hardest human step.",
      "Tapping an edge draws it, a second tap marks it as not used, a third clears it. The loop engine is then Masyu's too.",
      "Next after Meld and Pegs; the best of the loop puzzles, and Classics has no loop yet.",
    ],
  },
  rack: {
    name: "Rack", sec: "table",
    line: "A word game on a board: seven tiles on a rack, premium squares, words that cross, a bag drawn from.",
    todo: [
      "The decision before any code: the word list. ENABLE is public domain but lacks British words; Collins is the one UK players expect and is proprietary. Check what Assay's and Codeword's lists already carry.",
      "A strong computer opponent is cheap once the list is a compact word index: find every word that fits on an anchor square, score them, play the best (or a weaker one, by level).",
      "Two players on one phone and a partner's match, as the other table games have. Quiet, tactile: wooden tiles, no flash.",
      "A full list adds weight to the offline cache (sw.js keeps every file); size it first.",
    ],
  },
  stone: {
    name: "Stone", sec: "table",
    line: "Go (Weiqi, 围棋): black and white stones on a board, territory taken and held, stones captured when they lose their last liberty.",
    todo: [
      "First thing to check: a maintained GNU Go build as WebAssembly (roughly 10 kyu, an amateur rank where a lower number is stronger; GPL, as Stockfish already is here). Failing that, our own Monte-Carlo search: passable on 9×9, weak on 19×19.",
      "Rules are small: capture, ko (no repeating a position), no suicide. Chinese area scoring (stones plus territory) so a finished game needs no dispute over dead stones.",
      "Boards of 9, 13 and 19; two on one phone and a partner's match are cheap, the opponent is the cost.",
      "Beside Gambit (chess) and River (xiangqi); the same reason: a real board when meeting Chinese counterparties.",
    ],
  },
  pegs: {
    name: "Pegs", sec: "table",
    line: "Cribbage for two: discard two cards to the dealer's crib, peg to 31, then count fifteens, pairs, runs, flushes and the jack; first to 121 round the board.",
    todo: [
      "On seats.js (README, Seats): a pure rules module and a bot, the runner and the page around it, as Big Two and Landlord are.",
      "The counting is the engine: every hand scores exactly, so tests can check hundreds of hands against known totals.",
      "The bot's discards by expected value over the possible starter cards; its pegging by a simple rule of thumb.",
      "A two-player game, so it suits a partner's match.",
    ],
  },
  tarot: {
    name: "Tarot", sec: "table",
    line: "French tarot (le tarot): 78 cards, the 21 trumps and the Excuse beside four suits, three to five players, a bid to win the points, the dog (the cards set aside) taken by the bidder.",
    todo: [
      "Not in Trumps, which holds Jass, Belote, Coinche and Schafkopf; French tarot is its own game with its own rules.",
      "The rules to build: dealing for three, four or five players (five call a partner by a king), the bids Petite, Garde, Garde sans and Garde contre, the dog and the discard, the Excuse, following suit and trumping, the three oudlers (the 1 and 21 of trumps and the Excuse), a contract of 56, 51, 41 or 36 of the 91 points by how many the bidder holds, the poignée, the chelem and the petit au bout.",
      "The bot is the hard part: bidding on a hand and the bidder's play against the defenders'.",
      "On seats.js; the largest of the new games, so it comes last.",
    ],
  },
};
