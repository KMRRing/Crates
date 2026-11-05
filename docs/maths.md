# Maths

A course from GCSE through IB Higher Level to the first year at university, on the shared course sheet (`course.js`): `maths.html`, lessons in `maths-ch*.js` (`maths-kit.js`), drawn by `maths-stage.js`. `maths:course` is the sheet's progress; `maths:lessons` is `{ done, of }` for the tile.

Ruling, 4 November 2026 (Korbi): "add the maths course, GCSE to 1st year uni (post IB HL) essentially."

## Traps

- **Answers are expressions, checked another way.** An option is written in `maths-expr.js`'s language, printed for the button, and every step carries a `chk` that `tests/maths.mjs` runs by a route the lesson did not use. Exactly one option may pass. A step with a number and no `chk` fails the test; `{ t: "words" }` is for questions about words and is capped at a fifth. An option that is text, not an expression, starts with `~`.
- **No system keyboard.** Typed answers use the stage's own keypad (a phone's number pad has no minus sign, and the keyboard would cover the stage).
- **Maths is drawn by Temml** through `rich.js`, loaded when first shown, so a formula is measured after it arrives: `maths-stage.js` shrinks one that is wider than its box. Buttons and the words under the stage are plain text, so answers use Unicode.
- **A plot is sized from its box in pixels**, drawn again on every slider move; the readout under it has a fixed minimum height, or the figure is measured before the readout fills and its bottom labels are clipped.
- **Practice lessons** (`practiceOf` in `maths-ch7.js`) end every chapter with `B(id)` questions from `maths-bank.js`, which is loaded only when one is shown; the test fails on an id that is gone. Pick single-answer ones.

## Odds and judgement (the last part)

Ruling, 5 November 2026 (Korbi): "Fold odds into maths." The Odds tile (a course made 4 November 2026 from plan row 28: probability, expected value, base rates, Bayes, Kelly sizing and calibration, with Quote and Punt as the labs; the casino courses' odds material recast as dice and cards so it stays in the App Store build without the Casino) is the last part of Maths: 19 lessons in 7 chapters, `odds-course.js` on `odds-stage.js`, on a sheet of its own after the Maths one. `odds.html` is only a redirect to `maths.html#odds`, which opens that sheet.

- **Progress was not moved.** The part keeps `odds:course`, `odds:calib` and `odds:ranges` (suite.js syncs them like any key), so a device that had Odds progress loses none and no merge can double-count. The Maths tile's `maths:lessons` is `{ done, of }` over both parts, written when the page opens (`progressAll` in `maths-course.js`); "Start a game over" and the watcher cover both prefixes (`maths:`, `odds:`). "Start Odds and judgement over" writes the three keys empty rather than removing them (a removed key comes back from another device).
- No casino game is named anywhere in `odds*.js`, `odds.html`, `odds.css` or here (`tests/odds.mjs` fails on one): examples are dice, coins, cards, urns, markets and estimates. The casino courses are not touched.
- Every figure is exact arithmetic (`odds-math.js`, fractions in BigInt); `tests/odds.mjs` recomputes each step carrying a `value` by a count or a search, not by the formula the lesson uses.
- The lab reads Ledger's `ledger:stats` and never writes it; with none kept it uses the lesson's own sample.
- Its range sliders are styled under `dialog.ln-sheet.od` only: Maths' own sliders share the page.
