# Crates

Sixteen words, four hidden crates. Group the four words that belong together, then name the country or commodity behind them.

Play: https://kmrring.github.io/Crates/ (on iPhone: Share → Add to Home Screen)

## Boards
Every board is drawn fresh from a word bank: 69 countries and 90 commodities. Clues and answers map many-to-many: Copper points to Chile, the DR Congo, Zambia and eight more; the Nile to Egypt and Ethiopia; Commonwealth to the UK, Poland and Lithuania. Each clue-answer pair has its own explanation and its own difficulty from 1 to 3, because the link is easy for some answers and hard for others (about 5,500 pairs over 3,700 clues). Hong Kong's clues sit under China. Clues also carry topics. The generator picks four answers, then four clues each, and only keeps a board that has exactly one solution given every answer each clue points to. Each crate must also name exactly one answer: the only answer in the whole bank that all four of its clues fit. That matters for close relatives such as FAME and its variants (UCOME, RME, SME, PME, TME): clues true of all biodiesel sit under all six, so a crate needs at least one clue specific to its answer. No tile contains the name of an answer on its board, so White gold never appears alongside Gold. Red herrings (clues that also point to another crate on the board) follow the difficulty: none on Easy, at most one on Mixed (on roughly two boards in five), one or two on Hard (two on roughly one board in five). Each herring fits exactly one other crate, and no two herrings link the same pair of crates. A solved crate lists its red herrings but names the other crate only once that one is open too; from then on the herring shows in both crates ("Amazon also fits Brazil" in Peru, "also fits here, but belongs to Peru" in Brazil). Crates are coloured yellow to red by the average difficulty of their clues.

## Settings
Menu (No. button) → Settings. They apply from the next board.
- Preset: Trader, Balanced or Culture night.
- Difficulty: Easy, Mixed or Hard.
- Topics: Off, Less, Normal or More for each. Countries and commodities have their own lists, and Settings shows the ones your pool deals from. Country topics (19): Film, TV & games covers films, series, video and board games; Craft & style covers textiles and weaving, tailoring and menswear, shoes and watches. Commodity topics (10): Origins, Production, Uses, Specs & science, Markets, Trade & logistics, Policy, Companies, History, Culture & language. Money & economy is what an informed newspaper reader knows (currencies, central banks, household-name banks and indices, famous crises, sovereign funds); Finance is what someone working in markets knows (benchmarks and crude grades, bond markets, trading jargon, rogue traders and blow-ups). Benchmarks also carry their sector topic, so TTF comes up under Energy as well.
- Regions and sectors: switch whole groups of answers on or off (for example only European countries, or no chemicals). Commodity sectors: Energy; Biofuels & low-carbon; Metals & minerals; Grains & oilseeds; Softs, fibres & livestock; Chemicals; Circular & recycled; Credits & freight.

If the settings are too narrow to build a board, that board falls back to Balanced and says so.

## Learning modes (solo)
Settings → Learning mode has four settings:
- Off: boards are dealt at random, so a clue can come back.
- Learn: missed clues come back (below).
- No repeats: no clue is dealt twice (under any answer) until you've seen every clue your settings allow; then that category starts over. It counts every board you've played, not just those since you switched it on.
- Clue learn: only tiles you open with ? come back, 3 to 8 boards later in a new crate, even if you skip that board. Solve one without opening it and it's learned. Nothing else on the board is recorded. Tiles you opened in Learn mode count here too.

Learn mode in detail: every clue-answer pair is its own card: knowing that Copper points to Chile doesn't mark Copper→Zambia as known. For each pair on a board the question is: did you tie that clue to that answer?
- Yes: its crate was found and named, or a "one away" guess put it among the three that belonged together (in a one-away with Matches, Rotten eggs and Gunpowder, those three count as known even if the Sulphur crate is never found).
- No: it was the odd one out or the one left out in a "one away", you opened its clue, its crate was found but not named, or its crate was never found and nothing showed you placed it. A pair in a plain miss (two and two, or worse) proves nothing either way.
- A missed pair comes back 3 to 8 boards later in a crate of the same answer, next to companions it wasn't missed with, and usually on a board without the crates it was missed next to. In a Mixed pool, pairs of the other category wait for a board of their own kind, so they can take a little longer.
- A pair you get right retires to the bottom of the deck. Unseen pairs are preferred, so the same clue turns up under its other answers as you go.
- Solved crates flag clues "↻ back soon" or "✓ learned" (in Learn and Clue learn). Progress stays in the browser (or follows a synced run); Settings has a reset for the learning cards and, in No repeats, a way to start the clues over.

## Glyph
Tap the title (Crates or Glyph) to switch games. Glyph lives at glyph.html.

Fill a small crossword so every across and down run is a real word. Coloured fields carry secret letter rules, and the colour family says what kind:
- Blues and greens judge each letter on its own (a tick or cross on the letter).
- Yellows and oranges judge neighbouring pairs, read left to right and top to bottom (the mark sits on the join).
- Purples and pinks, dashed, judge the whole field once every cell is filled (one mark for the field).

Each placement counts toward par (words plus fields). On Easy, checks and rule reveals are unlimited. Otherwise two checks per board give every placed letter that matches our fill a green outline; replace one and the matching letter stays in the cell's corner as a reminder. A letter a check found isn't ours gets an orange outline on its key whenever the cursor is on that cell, in any field. Typing: tap a cell and type; the cursor moves along the row (the default) or, after tapping the same cell again, down the column, and Place (bottom left of the keyboard) puts the word down. Retyping one letter of a word and pressing Place counts as a new placement. Placing letters that don't complete a word is allowed, to build a frame: they show greyed with a dotted underline, aren't judged, don't count as placements, and the first Clear removes them; a letter is judged once it's part of a complete real word. While the cursor is in a single-letter field, the keyboard shows the letters that field has taken (green) and rejected (red). Clear (between Fields and Check letters) escalates: the first press empties letters that aren't part of a complete real word, the next also words that break a rule of a field you can see, the next the whole board; clearing never counts as a placement. Fields opens a sheet with everything each field has passed and failed, and a ? per field: two per board (the "2 × ?" beside Close counts them down) reveal a field's rule (for a single-letter field the keyboard then shows every letter green or red). In a together game a revealed rule, and that field's marks, are shown to both players. New board is in the menu. The board and keyboard size themselves to the visible screen, clear of Safari's bars. Our fill uses only very common words; any fill that obeys every rule and makes real words wins too. Every rule is revealed when the board ends.

Difficulty comes from the rules, each rated easy, medium or hard; every level mixes all three field types. The rule catalogue (glyph-gen.js): vowels, consonants, alphabet halves and thirds, straight or curved letters, enclosed spaces, keyboard rows, typing hand, mirror symmetry, odd alphabet positions, rarer letters and hidden keywords for single letters; ascending, descending, vowel-consonant, same class, same shape, same keyboard row, same hand, within three letters and double letters for pairs; no duplicates, no vowels, exactly one vowel, a repeated letter, one shape, rearranges into a word, one keyboard row and an even alphabet sum for whole fields.

Together: Menu → Play together sends a link (or a four-letter code). Both players place words on the same board, share the placements and the two checks, and each sees the marks for half the fields, so you have to tell each other what you see. Glyph games use the same Firebase rooms as Crates (crates/rooms/CODE, marked game: "glyph"), so no rule changes are needed; a Glyph code entered in Crates opens Glyph.

Words: SCOWL word lists (sizes 10-20 for our fills, up to 70 with British and American spellings for what you may place), packed in glyph-words.js.

## Your run on several devices
Menu → Your other devices → Sync this run. The run gets an 8-letter code and a link; open the link on your other device (or type the code into Join there) and both devices follow the same run: the board you're on, your history, settings and learning cards. Changes go up a moment after each move and when you put the page away, and a device that was left open with old progress catches up instead of overwriting newer progress. Each change also carries the size of the word bank it was made with. A device still on an older version of the app reloads itself onto the new one instead of dealing boards of its own (it couldn't read boards that use newer words), and a device that is only following, untouched, doesn't run the clock or write anything. "Stop syncing on this device" keeps a local copy and lets go of the run.

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
