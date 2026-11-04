# History of trade

A course of 45 lessons in 14 chapters, from the first obsidian blades to today's straits, on the shared course sheet (`course.js`). Every lesson has a map drawn in the app (`world.js` land, `trade-map.js`), a few questions (choices, and "tap the place" with the names hidden until answered), and each chapter ends with its reading list. `trade.html` is the door; the outline is `docs/history-of-trade-outline.md`. The words and questions are `trade-c1.js` to `trade-c5.js`, built into steps by `trade-lessons.js`; places are `trade-places.js` (its own) and `trade-kb.js` (a copy of kb/'s `trade-place`, `trade-history` and `geo-place` rows and the `merchant-power` cards, checked by `tests/trade-kb.mjs`; `--write` rewrites it). Progress is the sheet's `trade:course`; `trade:lessons` is `{ done, of }` for the tile; `trade:pics` is `"off"` when pictures are switched off.

## Rulings

- 4 November 2026, Korbi: global, not Eurocentric (chapters 1 to 8 are pre-European trade, with real weight); the colonial chapters (Columbian exchange, Atlantic slave trade and Indian Ocean slavery, East India companies and Bengal, opium and the unequal treaties, Congo, indenture, Haiti) as full as the rest and unflinching; facts sourced per chapter (a reading list) and, where genuinely argued, as the range with who disputes it; facts, not policy advocacy; it absorbs the Geography topic and kb/'s trade entities (read by id, nothing leaves kb/).
- Defaults chosen by the builder while Korbi answers (4 November 2026): (1) pictures through `pics.js` as Art history does (Wikipedia lead image at display time), though `rules.md` says no picture from Wikipedia at run time: the contradiction is reported, not resolved; (2) no atrocity photographs, only maps, objects, documents and art (`tests/trade.mjs` fails on a title or caption naming one); (3) chapters 13 and 14 tilt toward energy and commodities, with perishable current-events facts mapped or dated, never tested; (4) a universal course otherwise.

## Traps

- **Contested numbers are never asked as a number.** They are asked as "which statement is defensible", the answer carrying the range and who disputes it. A figure the outline marks `(check)` stays out of questions until verified (`tests/trade.mjs` lists the ones it refuses; `docs/history-of-trade-notes.md` lists what is open).
- **A picture may not load, and the course must still be finishable.** Words never depend on a picture; a title no one has looked at on a connected machine is in the notes file.
- **Maps name places that fit.** A place whose name cannot be set without overlapping another is a test failure: drop the lesser place from the lesson's `pts`, not from the text.
