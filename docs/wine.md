# Wine

A course in wine for someone starting from little: eight chapters (grapes and styles; how wine is made; regions; labels and appellations; tasting; storage, service and pairing; fortified and sparkling; buying and the market), short lessons each followed by questions, and a test at the end of every chapter (Regions has three). `wine.html` is the door; the lessons run on the shared course sheet (`course.js`). The words and questions are in `wine-basics.js`, `wine-regions.js`, `wine-labels.js` and `wine-service.js`, built into steps by `wine-lessons.js`; the stage is `wine-stage.js`. Progress is the sheet's `wine:course`; `wine:lessons` is `{ done, of }` for the tile. Facts that need a second look are listed in `docs/wine-notes.md`.

## Traps

- **No pictures.** The stage draws a card of facts or a glass; nothing is fetched (`tests/wine.mjs` fails on `pics.js`, Wikipedia or `<img>`).
- **Bank questions are used by id** (`B("WN-001")`, from `wine-bank.js`, which is Punt's Wine level and is edited in place): each once in the course, as written, so changing a bank question's answer changes the course. Questions of the course's own (`Q(...)`) are written right answer first; `wine-lessons.js` seats it by a hash of the step's id, so renaming a lesson id reseats its answers.
- **A fact is added with its source in mind**: if it is not certain, put it in `docs/wine-notes.md` rather than guess.
