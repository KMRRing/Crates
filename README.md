# Crates

Sixteen words, four hidden crates. Group the four words that belong together, then name the country or commodity behind them.

Play: https://kmrring.github.io/Crates/ (on iPhone: Share → Add to Home Screen)

## Boards
Every board is drawn fresh from a word bank: 45 countries and 44 commodities, each with a set of clue words (about 1,300 in all). Every word carries one or more topics, a difficulty from 1 to 3, and a list of other answers it could also fit. The generator picks four answers, then four words each, and only keeps a board that has exactly one solution. At most two words per board are red herrings (they also fit another crate on the board). Crates are coloured yellow to red by the average difficulty of their words.

## Settings
Menu (No. button) → Settings. They apply from the next board.
- Preset: Trader, Balanced or Culture night.
- Difficulty: Easy, Mixed or Hard.
- Topics: each of the 17 topics (Finance included) Off, Less, Normal or More.
- Regions and sectors: switch whole groups of answers on or off (for example only European countries, or no chemicals).

If the settings are too narrow to build a board, that board falls back to Balanced and says so.

## Learning mode (solo)
Settings → Learning mode → On. The game keeps a card for every clue, and the question for each clue is: did you tie it to its answer?
- Yes: its crate was found and named, or a "one away" guess put it among the three that belonged together (in a one-away with Matches, Rotten eggs and Gunpowder, those three count as known even if the Sulphur crate is never found).
- No: it was the odd one out or the one left out in a "one away", you opened its clue, its crate was found but not named, or its crate was never found and nothing showed you placed it. A clue in a plain miss (two and two, or worse) proves nothing either way.
- A missed clue comes back 3 to 8 boards later, next to companions it wasn't missed with and on a board without the crates it was missed next to. At most two missed clues share a crate. If the clue belongs to more than one answer (Carbon: Coal and Graphite), it comes back under a different one.
- A clue you get right retires to the bottom of the deck and only reappears once fresher clues run out. Unseen clues are preferred, so you work through the whole bank.
- Solved crates flag clues "↻ back soon" or "✓ learned". Progress stays in the browser; Settings has a reset.

## Solo
- Four lives and four clues per board. "One away" means three of your four belong together.
- Tap a word, then the ? on its corner to spend a clue. The clue gives the word's explanation and its crate's colour (yellow easiest, red hardest), so two opened clues tell you whether those words share a crate. An opened clue can be reread any time.
- A crate is worth 2 points: 1 for finding it, 1 for naming it. A wrong name or a skip keeps the half.
- Tap a solved crate to see why each word belongs, and which words were red herrings.
- Pick Countries, Commodities or Mixed in the top bar. Recent boards in the menu can be replayed. Progress stays in the browser.
- Copy result puts your score, time, lives and clues used, the guess grid and a link to the same board on the clipboard. Time only runs while the board is on screen.

## Your run on several devices
Menu → Your other devices → Sync this run. The run gets an 8-letter code and a link; open the link on your other device (or type the code into Join there) and both devices follow the same run: the board you're on, your history, settings and learning cards. Changes go up a moment after each move and when you put the page away, and a device that was left open with old progress catches up instead of overwriting newer progress. "Stop syncing on this device" keeps a local copy and lets go of the run.

## Together
Menu → Play together or Play hidden → send the link. Your partner opens it and joins. The team shares 4 lives and 4 clues per board.

One rule runs through both modes: you never see the result of your own action, your partner does.
- Your wrong guess: you see a life go, your partner sees whether it was one away.
- Your clue: your partner reads the explanation and sees the crate colour.
- A crate you find: your partner names it.

**Together** — both of you see all sixteen words and each other's picks. Whoever started the game sets the settings.

**Hidden** — each of you sees only your own eight words; your partner's show as blank sealed tiles, and it's up to you to describe which one you mean. Both screens lay the tiles out identically. Every crate holds one to three words from each side, so a crate always needs picks from both of you.
- Before the first board you each set up your own side: your preset, difficulty and topics shape only the eight words dealt to you. Which countries and commodities can come up is shared and set by whoever started the game. The board is dealt once you've both pressed Ready.
- Clues work the other way round: tap a tile that's sealed on your screen to ask about it. Your partner reveals it, reads the explanation out (not the word), and the crate colour appears on your sealed tile.

## Links
- `?cat=countries`, `?cat=commodities` or `?cat=mixed` opens straight into that pool.
- `?b=CODE` opens one specific board. Shared results include this link.
- `?room=ABCD` joins a game together.
- `?run=ABCDEFGH` makes this device follow a synced solo run.

## Setup for Together mode (once)
Together mode and synced runs use the same Firebase project as CroatiaQuiz (croatiabio). Its database rules need the `crates` block (game rooms and synced runs):
Firebase console → Realtime Database → Rules → replace with the contents of `firebase-rules.json` → Publish.

## Files
`bank.js` is the word bank as base64-encoded JSON, so answers aren't visible at a glance. It is append-only: board codes point at answer and word positions, so words are only ever added at the end of an answer and answers at the end of the bank. `gen.js` builds and checks boards, including the split boards for hidden mode. `run.js` keeps a solo run in step across devices; `net.js` loads the Firebase connection when either needs it. `tests/fake-sync.js` stands in for Firebase in local two-tab tests.
