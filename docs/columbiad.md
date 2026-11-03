# Columbiad

A cannon idler in the Idle section: Verne's Baltimore Gun Club, a cannon on a 2D Earth with honest gravity (later with the Moon on its orbit), one drag back like a slingshot to aim and load powder, a separate Fire button, levels of 10 to 30 seconds, instant retries, no fail state.

- 3 November 2026, Korbi: "Columbiad: a cannon idler, design doc, is complete now. read it, understand it, add it to the todo".
- The design doc: https://claude.ai/artifact/1tPNSJZHWYwwdaNLfUksLY (units, the dial, the scatter, the levels and the maths are there).

## Traps

- **The same on every device.** `columbiad-engine.js` keeps its integrator to + − * / and sqrt: Math.sin, cos, pow, exp and atan2 are not bit-identical between V8 and JavaScriptCore, and a shot that hits on one phone must hit on the other. The Moon's rail is a table built by half-angle recurrence (`turnsOf` removes whole turns first, so it returns exactly), not a sine. The winning shots in `columbiad-proofs.js` are stored with a margin, and levels are robust enough that a last-bit difference cannot decide one.
- **The step is a function of the state only**, never of the frame time (`dt` from the distance to the nearest body and the speed), or a slow phone would fly a different shot.
- **A hit is the first entry into the ring on the continuous path** (segment against circle at every step, in the target's own frame so a ring on the Moon works), not a sample that lands inside.
- **A flight lasts a tenth of a game second** (a surface orbit is 0.085 s), so `columbiad-view.js` shows it stretched, with its own pace and slow motion near the ring; that is display, not physics, and the engine never sees it.
- **The cone costs 26 flights** (about 8 ms): it is computed when the aim changes, never per frame. The aim view's camera holds the cone's whole box, or a flat shot goes out of sight.

## Milestones

1. **Proving ground**: Earth-only ballistics, the drag-aim control, the scatter cone, ghost trails, six levels. Gate: a single shot feels good in play.
2. **The Moon moves**: the Moon on its rail, a live-updating cone, fire when ready. Gate: players use the cone's sweep to time shots.
3. **Gentle landing and the free return**: arrival speed bands, gates in order, a loop round the Moon. Gate: the free return reads as the wow level.
4. **Random and daily**: seeded setups, the real Moon for the daily (from the mean elongation formula), streaks, a share line. Gate: a day's puzzle is solvable and shareable.
5. **Polish**: audio, slow motion, crew log lines, the engraving look, reduced-motion paths. (Section 5, Beyond the Moon, is a stretch goal.)
