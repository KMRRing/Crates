# Maths

A course from GCSE through IB Higher Level to the first year at university, on the shared course sheet (`course.js`): `maths.html`, lessons in `maths-ch*.js` (`maths-kit.js`), drawn by `maths-stage.js`. `maths:course` is the sheet's progress; `maths:lessons` is `{ done, of }` for the tile.

Ruling, 4 November 2026 (Korbi): "add the maths course, GCSE to 1st year uni (post IB HL) essentially."

## Traps

- **Answers are expressions, checked another way.** An option is written in `maths-expr.js`'s language, printed for the button, and every step carries a `chk` that `tests/maths.mjs` runs by a route the lesson did not use. Exactly one option may pass. A step with a number and no `chk` fails the test; `{ t: "words" }` is for questions about words and is capped at a fifth. An option that is text, not an expression, starts with `~`.
- **No system keyboard.** Typed answers use the stage's own keypad (a phone's number pad has no minus sign, and the keyboard would cover the stage).
- **Maths is drawn by Temml** through `rich.js`, loaded when first shown, so a formula is measured after it arrives: `maths-stage.js` shrinks one that is wider than its box. Buttons and the words under the stage are plain text, so answers use Unicode.
- **A plot is sized from its box in pixels**, drawn again on every slider move; the readout under it has a fixed minimum height, or the figure is measured before the readout fills and its bottom labels are clipped.
- **Practice lessons** (`practiceOf` in `maths-ch7.js`) end every chapter with `B(id)` questions from `maths-bank.js`, which is loaded only when one is shown; the test fails on an id that is gone. Pick single-answer ones.
