# Learning modes (solo)
Learning modes are set in one place: the games screen's Choose, on its Learning side (4 November 2026; Korbi: "let's move all 'learning mode' settings into 'choose' on the main menu and remove it from all the app settings... the app settings are generally just too long with too many things to configure"). No game's menu has one; Crates' Settings only says which is on and keeps its reset. There are two: the piles' mode (`pile:settings`; Chart, Crossword, Deck, Nexus, Nonogram, Punt and Quote; README, Deck) and Crates' own (`crates:mode`, below; Crates takes it up when it opens, and redeals a board not yet touched).

Crates' four settings:
- Off: boards are dealt at random, so a clue can come back.
- Learn: missed clues come back (below).
- No repeats: no clue is dealt twice (under any answer) until you've seen every clue your settings allow; then that category starts over. It counts every board you've played, not just those since you switched it on.
- Clue learn: only tiles you open with ? come back, 3 to 8 boards later in a new crate, even if you skip that board. Solve one without opening it and it's learned. Nothing else on the board is recorded. Tiles you opened in Learn mode count here too.

Learn mode in detail: every clue-answer pair is its own card: knowing that Copper points to Chile doesn't mark Copper→Zambia as known. For each pair on a board the question is: did you tie that clue to that answer?
- Yes: its crate was found and named, or a "one away" guess put it among the three that belonged together (in a one-away with Matches, Rotten eggs and Gunpowder, those three count as known even if the Sulphur crate is never found).
- No: it was the odd one out or the one left out in a "one away", you opened its clue, its crate was found but not named, or its crate was never found and nothing showed you placed it. A pair in a plain miss (two and two, or worse) proves nothing either way.
- A missed pair comes back 3 to 8 boards later in a crate of the same answer, next to companions it wasn't missed with, and usually on a board without the crates it was missed next to. In a Mixed pool, pairs of the other category wait for a board of their own kind, so they can take a little longer.
- A pair you get right retires to the bottom of the deck. Unseen pairs are preferred, so the same clue turns up under its other answers as you go.
- Solved crates flag clues "↻ back soon" or "✓ learned" (in Learn and Clue learn). Progress stays in the browser (or follows a synced run); Crates' Settings has a reset for the learning cards and, in No repeats, a way to start the clues over.
