# Maths

A course from GCSE (a UK 16-year-old's level) through IB Higher Level to the first year at university, on the shared course sheet (`course.js`). `maths.html` is the door; the lessons are `maths-ch*.js`, written with `maths-kit.js` (`P` words, `Q` choose, `N` type a number, `G` set the sliders, `B` a question from Punt's maths bank) and drawn by `maths-stage.js`. Progress is the sheet's `maths:course`; `maths:lessons` is `{ done, of }` for the tile.

Ruling, 4 November 2026 (Korbi): "add the maths course, GCSE to 1st year uni (post IB HL) essentially."

## Traps

- **Answers are expressions, checked another way.** An option is written in `maths-expr.js`'s language (`3*x^2*sin(x)`), printed for the button (`3x² sin x`), and every step carries a `chk` that `tests/maths.mjs` runs by a route the lesson did not use (`tests/maths-check.js`: a count, a numerical derivative or integral, a substitution, a root scan). Exactly one option may pass. A step with a number and no `chk` fails the test; `{ t: "words" }` is for questions about words and is capped at a fifth.
- **No system keyboard.** Typed answers use the stage's own keypad (a phone's number pad has no minus sign, and the keyboard would cover the stage). Typed `√` takes a number or π after it.
- **Maths is drawn by Temml** through `rich.js` (`$…$` in a `rows` cell, `tex` in a formula), loaded when first shown; the source shows until it arrives. Buttons and the words under the stage are plain text, so answers use Unicode (x², √3/2).
- **A plot is sized from its box in pixels**, drawn again on every slider move, with text in rem; it breaks a curve where it jumps (a pole) rather than join the two branches.
- **Practice steps** (`B(id)`) name a question in `maths-bank.js` by id and load the bank only when shown; the test fails on an id that is gone.
