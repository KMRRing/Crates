// The games on the games screen that aren't built yet (31 October 2026, Korbi: "Bridges, masyu, nurikabe, slitherlink,
// rack, go, pegs, meld, French tarot… the rest just get a tile placeholder with todo for now"). Each has a tile, and the tile
// opens soon.html, which says what the game will be and what's left to do. `id`, `name` and `sec` are the tile's (apps.js);
// `line` is the game in a sentence, `todo` what building it takes and where the risk is. A game that gets built loses its entry
// here and its tile points at its own page; tests/soon.mjs fails while a tile and its entry disagree.
export const SOON = {
  stone: {
    name: "Stone", sec: "table",
    line: "Go (Weiqi, 围棋): black and white stones on a board, territory taken and held, stones captured when they lose their last liberty.",
    todo: [
      "Checked 1 November 2026: the one ready-made GNU Go in WebAssembly (npm `gnugo.js`, GNU Go 3.8 through Emscripten, a wrapper under the engine's GPL) is 8.9 MB with the engine inline, and exports only start, play a stone, ask the engine for a move and read the board. It has no pass, no resign, no level and no scoring, so a person's pass can't be told to the engine and it can't count a finished game. Using GNU Go therefore means building it ourselves with Emscripten and a wrapper that adds pass, level and score (that package's gnugowrapper.c is the starting point), and the size is one more thing to weigh against the offline cache. The alternative is our own Monte-Carlo search: passable on 9×9, weak on 19×19.",
      "Rules are small: capture, ko (no repeating a position), no suicide. Chinese area scoring (stones plus territory) so a finished game needs no dispute over dead stones.",
      "Boards of 9, 13 and 19; two on one phone and a partner's match are cheap, the opponent is the cost.",
      "Beside Gambit (chess) and River (xiangqi); the same reason: a real board when meeting Chinese counterparties.",
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
  ingot: {
    name: "Ingot", sec: "idle",
    line: "2048's game: slide numbered tiles about a four-by-four board; two equal tiles that meet merge into their sum, and a new tile appears after every move. Tiles are bars of metal that double.",
    todo: [
      "Added 2 November 2026 (Korbi: \"2048\"). 2048 (Gabriele Cirulli, 2014) was released under the MIT licence, and the number is no one's name, but the tile is Ingot, in Idle beside Orrery and Topple.",
      "The rules are four swipes and a spawn (a 2 nine times in ten, a 4 otherwise). The choice is one of four, and the board remembers a careless one, as every idle game here asks.",
      "Needs: a limited undo, the day's seed for the spawns (so a daily is the same board for everyone), a best, and a calm mode with the bars in 3D.",
      "A search that scores the four swipes would give a hint and a par.",
    ],
  },
};
