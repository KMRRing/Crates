# Almanac

Called Lexicon until 2 November 2026. Its id, its saved keys (`lexicon:`) and its crossword kind are still `lexicon`, so what is saved opens as it did; `lexicon.html` forwards to `almanac.html`, `#e=` and all, so a link to an entry made before still works.

Everything the games know, as a star chart you fly through: every thing in the knowledge base is a star, coloured by Settings' subjects and set in its subject's region, the better learned the brighter it burns. Tap a star for its entry in a popup (what it is, what's said about it, the numbers Quote knows, its links each with the reason), follow the links in the popup, Back through them, or show one in the sky. Search flies to a star. The list view (search, results, entries) is still there, from the menu.

## Rulings

- 3 November 2026, Korbi: "The star chart should be the default it opens on. It should occupy the whole screen. The "entry" information should be retrievable and navigable as pop up in this view. Search at the top is ok. The title (almanac) and partner status should not be visible in this mode, just settings in top right, search bar top left (but both "inside" the star view container) and then subjects and entries as pop ups similar to now."

## Traps

- **The sky is the front door, and nothing about the last way you looked is kept.** The list is `#list` / `#list&e=<id>`; `#e=<id>` is the sky with that entry's popup. The header (title, partner pill) is the list view's and out of sight over the sky, so the menu carries the way out: Games first (it clicks the hidden header's button, which `bindSwitcher` owns).
- **Dim is not unknown.** The pile (`pile.js`) only holds what you *missed*, so a star lights as you work a miss back up the piles, and everything you always got right stays dim. Showing what you know needs the games to record right answers' entity ids too.
- **The layout is a file, not a calculation.** `almanac-sky-layout.js` is written by `node almanac-sky-build.mjs` (seeded: the same kb/ gives the same bytes). Run it again when kb/ has grown a good deal; until then newcomers are put beside their neighbours, and `tests/almanac-sky.mjs` fails when fewer than 95% of the things have a place in the file.
- **Raw WebGL, no three.js:** the vendored build has no points or shaders. The camera, the data and the glow are pure modules (`almanac-sky-camera.js`, `-data.js`, `-learn.js`), so another view of the same sky can lean on them.
- **What the sky shows is in `lexicon:sky`** (camera, subjects off, chosen star, whether its popup is a card or open) **and `lexicon:sky:lit`** (the glow as a percent per star): a watching partner has no pile of yours, so the glow is kept beside the camera. A frame reads them and writes nothing; the page writes 700 ms after the last change, not per frame.
- **The popups are not modal** (the sky behind them stays alive, a tap on empty sky closes them), so they are plain boxes, not `<dialog>`s: only the menu and the games screen are, and only those pause the sky. The browser's Back closes the entry popup (one history step however many entries are followed in it).
