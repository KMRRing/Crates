# Statecraft and strategy

A course on the shared course sheet (`course.js`): 43 lessons in ten chapters (the tools, diplomacy, tribute and neutrality, the thinkers, war, deterrence, economy and information and domains, empire and revolution, eight cases, a capstone), source in `docs/political-theory-outline.md` section 10. Maps and tap-the-place are History of trade's; ordering, matching and a primary-source quotation are the course's own stage (`statecraft-stage.js`). Misses return in a review pile (`statecraft:pile`).

Ruling, 5 November 2026, Korbi: "build the two political courses"; "split these as you said".

## Traps

- **Facts, not advocacy; neutral on present-day conflicts and governments.** A perishable fact (a treaty's status, a count) carries `dated:` and "as of <date> (source)" in its words.
- **A contested number is never asked as a number** (casualties, the Chinese famine): give a bracket or a range, or ask which reading is defensible. `tests/statecraft.mjs` checks the question openings.
- **At most a quarter of the key facts have Europe or the US as subject** (`w: 1` on a lesson or step); the test counts.
- **Quotations are public domain or the German original.** Clausewitz is paraphrased or quoted in German; no translation was verified.
- **No operational weapons detail.**
- **The right answer is seated by the question's id** (`hash`, as in trade); renaming a lesson reseats its answers.
- **Places** not in trade or kb/ are in `statecraft-places.js`, added to trade's table at import; import it before drawing a map.
- **Cases** (chapter 9) carry the eight-question card from `E(...)`; a case that can be told without a constraint is a hero story.
