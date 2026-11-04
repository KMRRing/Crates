# Odds
A course (4 November 2026, plan row 28: "Course: odds and judgement. Probability, expected value, base rates (how common something is before any evidence), Bayes, Kelly bet sizing and calibration, with Quote and Punt as the labs. The blackjack, hold'em and craps courses already hold the odds material: recast it as dice and cards, so it stays in the App Store build when the Casino is left out"), on `course.js`.

- No casino game is named anywhere in `odds*.js`, `odds.html`, `odds.css` or here (`tests/odds.mjs` fails on one): examples are dice, coins, cards, urns, markets and estimates. The casino courses are not touched.
- Every figure is exact arithmetic (`odds-math.js`, fractions in BigInt); `tests/odds.mjs` recomputes each step carrying a `value` by a count or a search, not by the formula the lesson uses.
- Calibration is the learner's own record, `odds:calib` (`n`, `bins` by confidence, `brier`, `seen`) and `odds:ranges` (`[hits, tries]`), both small totals. "Start over" writes them empty rather than removing them, so another device's copy is emptied too (suite.js syncs a removed key as nothing).
- The tile's stars are the lessons in `odds:course` (`oddsLessons` in `suite.js`).
- The lab reads Ledger's `ledger:stats` and never writes it; with none kept it uses the lesson's own sample.
