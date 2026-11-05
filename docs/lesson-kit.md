# Lesson kit

Interaction steps for courses on `course.js` (`lesson-kit.js`, `lesson-figs.js`, `lesson-kit.css`; the header comment of `lesson-kit.js` lists the ten types and their fields). Traps only.

- 5 November 2026, Korbi: each screen finds a different, not repetitive way to be interacted with; less information per screen, more screens, more visual aids; ideally every piece of information is presented interactively. Exercises are small (pairs 5, order 5, bins 6 items) and matching is tap-to-pair, never a dropdown.
- **`course.js` is untouched.** A course's stage owns a kit and hands it the steps with `kind: "kit"`; the kit judges as the reader taps (calling `api.answer`) except pair and order, which the sheet's Check button judges (`submits`). A stage that has `submit` but no `submits` sends every task through the button, so a stage using the kit must define `submits`.
- **State lives on `st.k`, never on the step.** A review step is an `Object.create` of its step.
- **A wrong move inside a tap-judged step is not a sheet answer.** `settle` counts tries and shows the hint after two, which would reveal a whole five-pair exercise for two slips; the kit keeps its own note line and reports one miss to the review. Only Check (pair, order) goes through `settle`.
- **The slider is patched in place** on `input` (the figure, the value, the readout); redrawing the stage would drop the thumb mid-drag.
- **Exploring types stay live after they are done** (decide, toggle, slider, reveal, explore), the scored ones lock.
- **A fact nobody verified carries `check: true`** on its step; the stage shows a small "check" tag and `flagged(steps)` lists them for the audit.
- Figure text sizes are the drawing's units (SVG attributes), not CSS px, so `tests/wide.mjs` stays quiet.
