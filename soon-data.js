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
  solitaire: {
    name: "Solitaire", sec: "table",
    line: "Patience for one: Klondike, FreeCell and Spider, each with a daily deal, the cards dealt from the day's seed so everyone plays the same game.",
    todo: [
      "Added 2 November 2026 (Korbi: \"solitaire, 2048, connect four: ok, add placeholders\"). The most conspicuous absence from a games library, and the cheapest of the board and card games to hold a player: no opponent, so no computer player to write.",
      "The rules are small and well known: Klondike (draw one or three), FreeCell (all cards face up, four free cells; nearly every deal can be won, so a solver can certify a deal) and Spider (one, two or four suits).",
      "The cost is the feel, not the rules: drag a card or tap it to send it where it goes, auto-move to the foundations, undo without limit, and a hint from the solver. A deal is kept only if the solver wins it, as Classics' puzzles are proven to have an answer.",
      "A daily deal per variant, by `today()` from `suite.js`; the best is a win streak or a time, whichever the games screen reads best.",
    ],
  },
  silo: {
    name: "Silo", sec: "table",
    line: "Four in a row for two: discs dropped into a standing grid of seven columns, six high, and the first to line up four across, down or on a diagonal wins.",
    todo: [
      "Added 2 November 2026 (Korbi: \"connect four\"). Connect Four is Hasbro's name for the game, so the tile is Silo; the rules of the game belong to no one, the name does.",
      "A solved game: with perfect play the first player wins by starting in the middle column. So the computer's levels are about how often it misses a threat, not how deep it sees: a few plies of search with a count of open threes plays as well as anyone will beat, and the weaker levels make a chosen share of mistakes.",
      "On seats.js, so two on one phone, a partner's match and a table of friends come with it; a drop that falls and the winning four lit are the only drawing.",
      "Possible later: Gambit's and River's coach (why a move is a mistake), and a bigger grid with five to win.",
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
  flank: {
    name: "Flank", sec: "table",
    line: "Reversi for two: discs black on one side and white on the other; place one so it brackets a line of the other's discs between two of yours, and they all turn. Most discs when the board is full wins.",
    todo: [
      "Added 2 November 2026 (Korbi: \"othello\"). Othello is a trademark and Reversi, the 1880s game it came from, is the name anyone may use; the tile is Flank, for what a move does. Rules belong to no one.",
      "On seats.js, so two on one phone, a partner's match and a table of friends come with it: a legal move must flank at least one line, a player with none passes, and the game ends when neither can move. The turning discs are the only drawing.",
      "The computer is our own search: the board is small enough for a few plies with weights for corners, edges and how many moves each side has left (mobility), and the weaker levels make a chosen share of mistakes. The strong free engines (Edax) are GPL, which is the case for writing our own.",
      "Needs, as every board game here: a coach, a daily puzzle (a position and its best move), and a calm mode with the discs in 3D.",
    ],
  },
  crown: {
    name: "Crown", sec: "table",
    line: "Draughts (checkers) for two: men step diagonally forward on the dark squares, a jump over an enemy man is compulsory, and a man that reaches the far row is crowned and moves both ways.",
    todo: [
      "Added 2 November 2026 (Korbi: \"draughts\"). Both names are the common words for the game and free; the tile is Crown, for the move that decides it.",
      "English draughts (8\u00d78, American checkers) first, International (10\u00d710, men capture backwards, kings fly, the longest capture is compulsory) as a second set of rules. The sets are data: the board's size, whether men capture backwards, whether a king flies, whether the longest capture is compulsory. A forced capture is where the beginner's mistakes are, so the board marks the pieces that must jump.",
      "On seats.js. The computer is our own search with a transposition table (the game tree is small; English draughts is a solved draw). The strong engines (Scan, GPL) are not needed.",
      "Needs: a coach, a daily puzzle (a shot: a sacrifice that wins), and a calm mode with the men in 3D.",
    ],
  },
  cargo: {
    name: "Cargo", sec: "idle",
    line: "Falling blocks: crates of four squares fall into a well; slide and turn them to fill a row across, which clears and lets the rest fall. The well fills as you slip, and the game ends when a new crate cannot enter.",
    todo: [
      "Added 2 November 2026 (Korbi: \"falling blocks\"). The idea of falling pieces is free; the Tetris Company has won against a clone that copied the look and feel (Tetris Holding v. Xio, 2012), so Cargo is built to share none of it: its own piece set (not the seven tetrominoes in their standard colours), a narrower well, crates in the codex's own colours, and no use of Tetris's guideline names. Build it last of the three.",
      "Idle's rule applies: little thinking, a move that is remembered. A pause with the menu (README, The pause), a gravity that rises slowly, a best, and a calm mode with the crates in 3D and no loss, only a tidy well.",
      "Touch: drag to slide, tap to turn, swipe down to drop; the page never scrolls, which a swipe has to be built around.",
    ],
  },
};
