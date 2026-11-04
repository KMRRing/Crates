# Art history

A course from the pyramids to the end of 1929: 27 lessons in seven chapters (the ancient world, the Middle Ages, the Renaissance, Baroque and Rococo, revolution and reality, towards the modern, the whole story), each with up to six pictures, a credit line under each, and exercises (name the period, name the maker, put three works in order, spot the feature, say what changed). `arthistory.html` is the door; the lessons are on the shared course sheet (`course.js`), the words in `arthistory-text.js`, the works in `arthistory-works.js` (a painting's row is kb/'s, checked by the test), the steps in `arthistory-lessons.js`, the pictures in `arthistory-stage.js`. Progress is the sheet's `arthistory:course`; `arthistory:lessons` is `{ done, of }` for the tile; `arthistory:pile` is the review (a miss comes back after a day, three, a week, three weeks, as in Music).

Ruling, 4 November 2026, 09:06, Korbi: "Just do it for stuff excluding 1930s and after, no? As long as you can find images anywhere that are fair use?"

## Traps

- **Nothing after 1929.** No work, no artist's later phase, no exercise (Bauhaus to 1926 is in; Mondrian's 1930 Composition and Dalí's 1931 are out). `tests/arthistory.mjs` fails on a later date, in a work or in any text.
- **A picture may not load, and the course must still be finishable.** Pictures are fetched from Wikipedia as they are shown (`pics.js`); the app stores titles only. An exercise that asks about "this" is a getter (`ask` in `arthistory-lessons.js`): when the stage reports the picture gone, the question is asked by the work's name instead. Never turn `say` into a plain string, or the word-only version stops working.
- **Every picture title is checked** (`tests/arthistory-titles.mjs`): either already shown by Punt, Quote or Chart ("in use"), or found by a web search on 4 November 2026 (Wikipedia could not be reached from the sandbox). A title no one has checked does not go into a work. A work is public domain by construction (made before 1930) and its picture is whatever Wikipedia shows as the page's lead image; the credit line comes from the data, not the picture.
- **A new work is a kb/ entity with a `pic`**, which is what puts it in Settings' "Keep pictures offline" (`pics-list.js` is built from kb/). Give it a mark of `r` in `kb/audit/marks.js`, or it is among the content marked for removal.
- **Hand-written choices put the right answer first**; the builder seats it by the question's id. The Colosseum and any work with a disputed date (`loose`) are not used for ordering questions.
