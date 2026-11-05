# Statecraft and strategy

A course on the shared course sheet (`course.js`): 56 lessons in ten chapters (the tools, diplomacy, tribute and neutrality, the thinkers with four lessons on Clausewitz, war with the sea and logistics, deterrence, the economic weapon in three lessons with information and new domains, empire and revolution, thirteen cases, a capstone), source in `docs/political-theory-outline.md` section 10. Maps and tap-the-place are History of trade's; every other exercise (pairs, order, sorting, true or false, terms to open, a diagram to explore or build, a slider, a decision, switches) is the lesson kit's (`docs/lesson-kit.md`), laid among a lesson's steps by `statecraft-kit-steps.js`; the quotation is the course's own (`statecraft-stage.js`). Misses return in a review pile (`statecraft:pile`).

Ruling, 5 November 2026, Korbi: "build the two political courses"; "split these as you said".

## Traps

- **Facts, not advocacy; neutral on present-day conflicts and governments.** A perishable fact (a treaty's status, a count) carries `dated:` and "as of <date> (source)" in its words.
- **A contested number is never asked as a number** (casualties, the Chinese famine): give a bracket or a range, or ask which reading is defensible. `tests/statecraft.mjs` checks the question openings.
- **At most a quarter of the key facts have Europe or the US as subject** (`w: 1` on a lesson or step); the test counts.
- **Quotations are public domain or the German original.** Clausewitz is paraphrased or quoted in German; no translation was verified.
- **No operational weapons detail.**
- **The right answer is seated by the question's id** (`hash`, as in trade); renaming a lesson reseats its answers.
- **Places** not in trade or kb/ are in `statecraft-places.js`, added to trade's table at import; import it before drawing a map.
- **Screens never ask the same way twice in a row** (`tests/statecraft.mjs`); `statecraft-lessons.js` turns a repeated question into true or false on three answers, a luck question in a case into a sort, a card of terms into cards to open and a case's eight answers into two sets of cards around its decision. A question stands alone on its screen (no map or card behind it).
- **Cases** (chapter 9) carry the eight-question card from `E(...)` and a `decide` step in `statecraft-kit-steps.js`; a case that can be told without a constraint is a hero story.
