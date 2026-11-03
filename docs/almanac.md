# Almanac

Called Lexicon until 2 November 2026. Its id, its saved keys (`lexicon:`) and its crossword kind are still `lexicon`, so what is saved opens as it did; `lexicon.html` forwards to `almanac.html`, `#e=` and all, so a link to an entry made before still works.

Everything the games know, looked up. Search any of the knowledge base's things, a country, a company, a painting, a river, a law, by its name or another of its names, accents ignored, names that start with what you typed first and the best-connected first among them. An entry shows what the thing is (its kinds, and its region or commodity family), its picture where it has one, what's said about it (its note, its country and region, a painting's year), the numbers Quote knows about it, the topics its links touch (energy, metals, history…), and every link in groups (clues to it, a clue to, painted by, paintings, hangs in, on its walls, movement, in, within it), each with the reason and a tap through to its own entry. `#e=<id>` opens an entry, so links can be shared and the back button walks back through what you've opened.

Held sideways (README, Bigger screens), the search and what it found stand on the left and the entry beside it, wider, so one thing after another can be opened from the list without losing it (the list is filled even when the page opens on an entry); with no entry open the list takes the whole width.

## The star chart

A second way in, beside the list (which stays the default): every thing is a star, coloured by Settings' subjects and set in that subject's region, the better learned the brighter it burns (`#sky`; `almanac-sky*.js`). Drag to orbit, pinch or wheel to zoom, tap a star for its card, search flies to it. Without WebGL it says so and offers the list.

- **Dim is not unknown.** The pile (`pile.js`) only holds what you *missed*, so a star lights as you work a miss back up the piles, and everything you always got right stays dim. Showing what you know needs the games to record right answers' entity ids too.
- **The layout is a file, not a calculation.** `almanac-sky-layout.js` is written by `node almanac-sky-build.mjs` (seeded: the same kb/ gives the same bytes). Run it again when kb/ has grown a good deal; until then newcomers are put beside their neighbours, and `tests/almanac-sky.mjs` fails when fewer than 95% of the things have a place in the file.
- **Raw WebGL, no three.js:** the vendored build has no points or shaders. The camera, the data and the glow are pure modules (`almanac-sky-camera.js`, `-data.js`, `-learn.js`), so another view of the same sky can lean on them.
- **What the sky shows is in `lexicon:sky`** (open, camera, subjects off, chosen star) **and `lexicon:sky:lit`** (the glow as a percent per star): a watching partner has no pile of yours, so the glow is kept beside the camera. A frame reads them and writes nothing; the page writes 700 ms after the last change, not per frame.
