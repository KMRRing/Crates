# Crates

Sixteen words, four hidden crates. Group the four words that belong together, then name the country or commodity behind them.

Play: https://kmrring.github.io/Crates/ (on iPhone: Share → Add to Home Screen)

## Solo
- Four lives and three clues per puzzle. "One away" means three of your four belong together.
- Tap a word, then the ? on its corner to spend a clue. An opened clue keeps its ? and can be reread any time.
- A crate is worth 2 points: 1 for finding it, 1 for naming it. A wrong name or a skip keeps the half.
- Pick Countries, Commodities or Mixed in the top bar. Progress stays in the browser.

## Together
- Menu (No. button) → Play together → send the link. Your partner opens it and joins.
- Each player has 2 lives per puzzle; the puzzle is lost when both are out.
- Each player starts with 2 clues and gains 1 per new puzzle, up to 3. Opened clues show for both.
- You see each other's picks live (coloured ring and initial), and every locked-in guess appears for both with its result.

## Links
- `?cat=countries`, `?cat=commodities` or `?cat=mixed` opens straight into that pool.
- `?room=ABCD` joins a game together.

## Setup for Together mode (once)
Together mode uses the same Firebase project as CroatiaQuiz (croatiabio). Its database rules need the `crates` block:
Firebase console → Realtime Database → Rules → replace with the contents of `firebase-rules.json` → Publish.

## Files
`data.js` is the puzzle pack as base64-encoded JSON, so answers aren't visible at a glance. New packs are written in chat and pushed here. `tests/fake-sync.js` stands in for Firebase in local two-tab tests.
