# Crates

Sixteen words, four hidden crates. Group the four words that belong together, then name the country or commodity behind them.

Play: https://kmrring.github.io/Crates/ (on iPhone: Share → Add to Home Screen)

## Boards
Every board is drawn fresh from a word bank: 44 countries and 44 commodities, each with a set of clue words. Every word carries one or more topics, a difficulty from 1 to 3, and a list of other answers it could also fit. The generator picks four answers, then four words each, and only keeps a board that has exactly one solution. At most two words per board are red herrings (they also fit another crate on the board). Crates are coloured yellow to red by the average difficulty of their words.

## Settings
Menu (No. button) → Settings. They apply from the next board.
- Preset: Trader, Balanced or Culture night.
- Difficulty: Easy, Mixed or Hard.
- Topics: each of the 16 topics Off, Less, Normal or More.
- Regions and sectors: switch whole groups of answers on or off (for example only European countries, or no chemicals).

If the settings are too narrow to build a board, that board falls back to Balanced and says so.

## Learning mode (solo)
Settings → Learning mode → On. The game then keeps a card for every word you meet:
- A word counts as missed if its crate was never found or never named, if you opened its clue, or if a "one away" guess put it in the wrong crate or left it out of its own crate. Words in a plain miss get no verdict either way.
- A missed word comes back 3 to 8 boards later, in its own answer's crate but next to companions it wasn't missed with, and on a board without the crates it was missed next to. At most two missed words share a crate, so there are always new clues beside them.
- A word you get right retires to the bottom of the deck and only reappears once fresher words run out.
- Unseen words are preferred, so you work through the whole bank.
- Solved crates flag words "↻ back soon" or "✓ learned". Progress stays in the browser; Settings has a reset.

## Solo
- Four lives and four clues per board. "One away" means three of your four belong together.
- Tap a word, then the ? on its corner to spend a clue. An opened clue keeps its ? and can be reread any time.
- A crate is worth 2 points: 1 for finding it, 1 for naming it. A wrong name or a skip keeps the half.
- Tap a solved crate to see why each word belongs, and which words were red herrings.
- Pick Countries, Commodities or Mixed in the top bar. Recent boards in the menu can be replayed. Progress stays in the browser.

## Together
- Menu → Play together → send the link. Your partner opens it and joins.
- The settings of whoever started the game apply to both; only they can change them.
- Each player has 2 lives and 2 clues per board; the board is lost when both are out of lives.
- Clues refresh with every board; unused ones don't carry over. Opened clues show for both.
- You see each other's picks live (coloured ring and initial), and every locked-in guess appears for both with its result.

## Links
- `?cat=countries`, `?cat=commodities` or `?cat=mixed` opens straight into that pool.
- `?b=CODE` opens one specific board. Shared results include this link.
- `?room=ABCD` joins a game together.

## Setup for Together mode (once)
Together mode uses the same Firebase project as CroatiaQuiz (croatiabio). Its database rules need the `crates` block:
Firebase console → Realtime Database → Rules → replace with the contents of `firebase-rules.json` → Publish.

## Files
`bank.js` is the word bank as base64-encoded JSON, so answers aren't visible at a glance. It is append-only: board codes point at answer and word positions, so words are only ever added at the end of an answer and answers at the end of the bank. `gen.js` builds and checks boards. `tests/fake-sync.js` stands in for Firebase in local two-tab tests.
