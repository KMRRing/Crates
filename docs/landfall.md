# Landfall

A first-person celestial-navigation game: a 19th-century Hanseatic barque, a chart table, a sextant, and a dead-reckoning position (a guess from speed, course and time) whose fog of doubt collapses along the line of each sight. You learn the constellations by using them. `landfall.html`, `landfall.js`, `landfall.css`; sky maths in `landfall-sky.js`, the voyage in `landfall-engine.js` and `landfall-model.js`; every screen but the sky is drawn from the engine's state.

Design doc (Korbi's brief): https://claude.ai/artifact/7L9GDgY1kegrGHHHk5aJtS

Ruling, 3 November 2026, 16:23, Korbi: "it's a new game: The design doc is ready to hand over: https://claude.ai/artifact/7L9GDgY1kegrGHHHk5aJtS one for the todo list: new idle game."

## Traps

- **Polaris gives latitude only.** It sits within a degree of the pole, so a sight of it says how far north, never how far east. The fog collapses north-south and stays long east-west. Do not "fix" that.
- **The longitude trap.** A degree of longitude is `cos(latitude)` as wide as one of latitude. The chart's plane (`landfall-sky.js`) and the dead reckoning both honour it; a log-and-compass guess east or west drifts further the higher the latitude. Dividers on the chart have one scale in M1, so it does not yet bite.
- **The engine is pure and seeded.** One seed plus a draw counter; replays reseed date, hour and weather. Page state (`S.ui`: hint tier, lamp, course) lives outside the engine and is not part of a run's rules.
- **A wrong star is not plotted.** The plot refuses a sight whose line sits further from the dead reckoning than `3.5·sqrt(P11+σ²)+1.5` nm, so a bad pick costs a retake, not the voyage (`tests/landfall-bots.mjs` gates it: 0 of 385).
- **Mastery** is 1 seen, 2 found with plenty of help, 3 found with little (hint tier 0 is the most help, 4 none); it only rises. Keys: `landfall:run`, `level`, `best` (stars by level), `mastery`, `sound`, `help`, `seen`.

## Sources and licences

Every number in the catalogue comes from one table; the others only check it. Nothing is fetched at run time and no data of anyone's is shipped except the first.

- **Yale Bright Star Catalogue, 5th revised edition** (Hoffleit & Warren 1991; NASA/NSSDC Astronomical Data Center V/50, via CDS): a scientific catalogue, not copyrightable data. Read through B. Wade's JSON conversion, `brettonw/YaleBrightStarCatalog` (MIT, the converter's licence). 519 stars in `landfall-stars.js`, made by `landfall-stars-build.mjs`.
- **Hipparcos (ESA), via XHIP**, as packaged in d3-celestial 0.7.35 (BSD-3-Clause). Only checks positions and the IAU's names of the 57 navigational stars; nothing is copied into the tree.
- **astronomy-engine** (Don Cross, MIT). Dev tool only: `landfall-sky-reference.mjs` makes `tests/landfall-sky-reference.json` (39 bodies, dates 1840 to 2040) that the sky is checked against. Not shipped.
- **Constellation figures** (`landfall-figures.js`) are our own line drawings, not Stellarium's (GPL). The 57 selected stars are the Nautical Almanac's list of names.
- Stories, facts and the sea (a made-up one, no real coast) are our own words.

Sky accuracy against astronomy-engine: stars within 0.16′ in altitude and azimuth, the sun within 0.5′ (the doc asks for 6′).

## Milestones

Each ends at a gate Korbi plays on his phone before the next starts.

1. **Sky and Polaris** (built). Real sky, sextant slider, latitude reveal. Gate: the latitude reveal feels good in play. Six levels, 3 to 5 watches each; a careful bot wins about 85% and a blind one about 41%.
2. **The noon sun.** Sun sights, a day and a night watch. Gate: a day and night voyage plays end to end.
3. **Named stars and the fix.** Two lines cross. Gate: the careful bot clearly beats the sloppy one.
4. **The chronometer.** Longitude from time; east and west stars. Gate: a wrong clock visibly misleads east and west stars.
5. **The coast and the daily.** Landfall, the daily voyage. Gate: the daily result can be shared and the voyage is winnable.

After M5: the long passage (design doc, section 6).

## Open questions, defaults taken

- Dividers are hands-on, with a skip. One free use of each cross-check per watch.
- The sea is invented. The moon is for M5 or later.
- Phone layout: one, a window (top third) over the desk, the whole sky by pulling the window down. A second layout (sky full-screen, desk as a sheet) was not built.
- Filed under Idle, as Korbi said; it is nearer a simulation than an idle game, so the section may move.

## Not yet

Rain, spray and gulls; hull creak; a moon; weather that moves; a live view of the sextant drum for a watcher (the rest of the state is mirrored by the `landfall:` keys). The bell, the quiet bed, twinkle, the horizon dimming and the lamp were cheap and are in. Clouds are flat discs.
