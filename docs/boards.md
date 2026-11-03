# Boards
Crates' boards are drawn fresh from the word bank: 69 countries (and 90 commodities, which Crates no longer deals). Clues and answers map many-to-many (Copper points to Chile, the DR Congo, Zambia and more), and each clue-answer pair has its own explanation and its own difficulty from 1 to 3, because the link is easy for some answers and hard for others. Hong Kong's clues sit under China.

What a board must keep (`gen.js` only keeps a board that does):
- Exactly one solution, given every answer each clue points to.
- Each crate names exactly one answer: the only answer in the whole bank that all four of its clues fit. That matters for close relatives such as FAME and its variants (UCOME, RME, SME, PME, TME): clues true of all biodiesel sit under all six, so a crate needs at least one clue specific to its answer.
- No tile contains the name of an answer on its board, so White gold never appears alongside Gold.
- Red herrings (clues that also point to another crate on the board) follow the difficulty: none on Easy, at most one on Mixed, one or two on Hard. Each herring fits exactly one other crate, and no two herrings link the same pair of crates. A solved crate lists its red herrings but names the other crate only once that one is open too; from then on the herring shows in both ("Amazon also fits Brazil" in Peru, "also fits here, but belongs to Peru" in Brazil).
- Crates are coloured yellow to red by the average difficulty of their clues.

The dropdown in the header is the links choice: Countries, or Classic, which opens Lots (it asks first if a board is unfinished). It is the suite's own dropdown (CLAUDE.md, "Header dropdowns"), as wide as its longest choice so it never changes size, with a line under each choice saying what it deals (`data-note`). A hidden select still holds the choice, so links (`?cat=`) read and set it.
