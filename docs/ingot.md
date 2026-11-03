# Ingot

- 2 November 2026, Korbi: "2048". A placeholder tile until 4 November 2026, when apps without real content were to be avoided.

The 2048 game: a four-by-four board of metal bars, a swipe (or an arrow key) slides every bar, equal bars that meet merge into their sum, a new bar lands after every swipe (a 2 nine times in ten, a 4 otherwise). `ingot.html`, `ingot.js`, `ingot.css`, rules and search in `ingot-engine.js`. The bars run lead, tin, copper, bronze, brass, silver, electrum, gold, rose gold, platinum, gilt at 2048, then steels; the value is always printed and the stamp on the top face changes with it.

**Licence.** The game's idea is free (Gabriele Cirulli's 2048, MIT, 2014, itself after Threes and 1024); the rules here are written fresh and none of its code or art is used. The search is our own expectimax (best of four swipes, the landing averaged), nothing from another solver.

- **Draws come from the seed and the draw's number**, not from a stream, so the day's board (`daySeed(today())`) is the same for everyone playing the same swipes, and an undo takes the number back: the same swipe again gets the same bar, so undo cannot be used to re-roll luck.
- **A daily counts the moment the game ends** (no swipe left, or "End this game"), first go on the day only (`ingot:daily`); leaving it earlier asks first.
- **Par** is what the search (two swipes deep) scores on the game's own seed, worked out in the background in 6 ms slices and kept in the run; a hint (three deep, one more when the board is nearly full) is limited to three a game, as undo is.
- No 3D calm mode: the bars are drawn in CSS with a top face and shade, which was as much as it needed.
