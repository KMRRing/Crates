# Full screen

3 November 2026, Korbi: "all games should be full screen by default ... there's just too much "stuff" on all of these screens. the general recipe should be 1) no title etc, settings icon in the top right is used to navigate back to menu always ... buttons exist inside the full screen, not outside." And, 16:42, about the Almanac: "replace the settings icon with the codex logo icon same as the other apps. don't call it "games", call it "back to menu"."

Then, 20:46 the same evening: "I may have gone too far asking every game to be full screen without the title. in reality, a lot of the games look better with the title there - just maybe not some of the card and idle games that should be a bit more ambient. the puzzles however, should probably keep the title layout ... Punt for instance to me looks odd without the Punt title." And, 20:54, on the list: "Harbour should go to idle, then yes implement as suggested".

So a page with a header has `full` on its `#app` (no logo or header buttons; the Codex mark alone at the top right, which opens the menu; Back to menu first in the menu) in one of two states. How to adopt either is in CLAUDE.md, "Full screen"; `tests/full-screen.mjs` holds the lists.
- **`full`**: ambient, nothing but the picture. Card and dice games, board games, idle games, pictures (Manifest, Almanac, Guilloché, Timegrapher), and Party's Snap and Sketch.
- **`full titled`**: the same quiet band with the game's name in it, in the suite's name lettering, left. Puzzles, quizzes, text and form pages, courses, tools and word games, Party and its games, Crates and Lots. A new game takes the state of its family (a puzzle or quiz page is titled, a card table or picture is full).

Not a rule for the page's content: its own status and buttons stay, inside the picture.

Traps: Hong, Tribute and Trumps have their own optional "Full screen" (the cloth the whole screen, the header's buttons on it): its class is `ontable`, because `full` is the frame's; a hidden header is still in the page (the hidden title button is what Back to menu clicks, and the pill in it is where the menu reads your partner's line); a titled page's name is that same title element, shown, with its logo, pill and Random tag still hidden, and not tappable (`pointer-events: none`); Party is one page for all its games, so `party.js` adds and drops `titled` as the game changes; a party's game has no Back to menu (its party part has the way out); a frame that only watches a partner has no button at all.
