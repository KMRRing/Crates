# Firmament

A narrative course in how we came to know the universe (people, arguments, instruments and the evidence that settled each question), in the manner of Simon Singh's Big Bang, on the shared course sheet (`course.js`). Door `firmament.html`; words and questions in `firmament-c1.js` … (chapters), built by `firmament-lessons.js`; every step has a diagram drawn in the app (`firmament-figs.js`, `firmament-stage.js`), nothing fetched. Numeric answers come from `firmament-calc.js` and `tests/firmament.mjs` recomputes each with its own formulas. Progress `firmament:course`, tile count `firmament:lessons`. Recasts `docs/astronomy-outline.md`. Sources still to open are in `docs/firmament-notes.md`.

## Rulings

- 4 November 2026, Korbi: "we do maths *and* astronomy. maths is more pure and astronomy has a bit of a 'big bang' by simon singh element where it's more of a narrative with the greeks and history of physics. so maybe physics/astronomy is the wrong thing to call it, maybe it's more like history of universe or something like that." Name chosen by the builder: Firmament (the vault of heaven the ancients imagined, which the course takes apart).

## Traps

- **Contested numbers are never asked as a bare number**: Eratosthenes' stadion, Ma'mun's mile, al-Biruni's cubit are told as ranges with who disputes.
- **Landfall and Orrery are linked (menu), never restated**; `tests/firmament.mjs` fails on an 8-word run copied from a Landfall note.
- **A figure's `t` is its type**; give a figure's own angle another key (`ang`).
