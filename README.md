# Crates

Sixteen words, four hidden crates. Group the four words that belong together, then name the country or commodity behind them.

Play: https://kmrring.github.io/Crates/ (on iPhone: Share → Add to Home Screen)

## Boards
Every board is drawn fresh from a word bank: 45 countries and 44 commodities. Clues and answers map many-to-many: Copper points to Chile, Peru, Zambia and five more; the Nile to Egypt and Ethiopia. Each clue-answer pair has its own explanation and its own difficulty from 1 to 3, because the link is easy for some answers and hard for others (about 1,860 pairs over 1,300 clues). Clues also carry topics. The generator picks four answers, then four clues each, and only keeps a board that has exactly one solution given every answer each clue points to. At most two clues per board are red herrings (they also point to another crate on the board). Crates are coloured yellow to red by the average difficulty of their clues.

## Settings
Menu (No. button) → Settings. They apply from the next board.
- Preset: Trader, Balanced or Culture night.
- Difficulty: Easy, Mixed or Hard.
- Topics: each of the 17 topics Off, Less, Normal or More. Money & economy is what an informed newspaper reader knows (currencies, central banks, household-name banks and indices, famous crises, sovereign funds); Finance is what someone working in markets knows (benchmarks and crude grades, bond markets, trading jargon, rogue traders and blow-ups). Benchmarks also carry their sector topic, so TTF comes up under Energy as well.
- Regions and sectors: switch whole groups of answers on or off (for example only European countries, or no chemicals).

If the settings are too narrow to build a board, that board falls back to Balanced and says so.

## Learning mode (solo)
Settings → Learning mode → On. Every clue-answer pair is its own card: knowing that Copper points to Chile doesn't mark Copper→Zambia as known. For each pair on a board the question is: did you tie that clue to that answer?
- Yes: its crate was found and named, or a "one away" guess put it among the three that belonged together (in a one-away with Matches, Rotten eggs and Gunpowder, those three count as known even if the Sulphur crate is never found).
- No: it was the odd one out or the one left out in a "one away", you opened its clue, its crate was found but not named, or its crate was never found and nothing showed you placed it. A pair in a plain miss (two and two, or worse) proves nothing either way.
- A missed pair comes back 3 to 8 boards later in a crate of the same answer, next to companions it wasn't missed with, and usually on a board without the crates it was missed next to. In a Mixed pool, pairs of the other category wait for a board of their own kind, so they can take a little longer.
- A pair you get right retires to the bottom of the deck. Unseen pairs are preferred, so the same clue turns up under its other answers as you go.
- Solved crates flag clues "↻ back soon" or "✓ learned". Progress stays in the browser (or follows a synced run); Settings has a reset.

## Your run on several devices
Menu → Your other devices → Sync this run. The run gets an 8-letter code and a link; open the link on your other device (or type the code into Join there) and both devices follow the same run: the board you're on, your history, settings and learning cards. Changes go up a moment after each move and when you put the page away, and a device that was left open with old progress catches up instead of overwriting newer progress. "Stop syncing on this device" keeps a local copy and lets go of the run.

## Together
Menu → Play together or Play hidden → send the link. Your partner opens it and joins. The team shares 4 lives and 4 clues per board.

One rule runs through both modes: you never see the result of your own action, your partner does.
- Your wrong guess: you see a life go, your partner sees whether it was one away (in Hidden, also whose pick is the odd one out). Everyone keeps their picks after a wrong guess.
- Your clue (Together): your partner reads the explanation and sees the crate colour. In Hidden, clues work differently (below).
- A crate you find: your partner names it.

**Together** — both of you see all sixteen words and each other's picks. Whoever started the game sets the settings.

**Hidden** — each of you sees only your own eight words; your partner's show as blank sealed tiles, and it's up to you to describe which one you mean. Both screens lay the tiles out identically. Every crate holds one to three words from each side, so a crate always needs picks from both of you.
- Before the first board you each set up your own side: your preset, difficulty and topics shape only the eight words dealt to you. Which countries and commodities can come up is shared and set by whoever started the game. The board is dealt once you've both pressed Ready.
- Clues come from the shared pool of four and are spent on tiles that are sealed on your screen: tap one, then its ?. You see that tile's explanation and crate colour (its ? takes the colour); your partner, who can see the word, only sees that a clue was used on it. The rest is up to the two of you.

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
