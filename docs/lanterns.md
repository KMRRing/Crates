# Lanterns

Akari ("Light Up", Nikoli's: house name per `docs/classics.md`, the old name only a search keyword). Light lanterns on white cells until every white cell is lit; a lantern shines along its row and column to the next rock or the edge, no lantern may shine on another, and a numbered rock has exactly that many lanterns on the cells touching it. Every puzzle has exactly one answer by reasoning, graded Easy (the plain rules), Medium (looking one step ahead), Hard (a two-round supposition) or Expert (a supposition followed to the end); sizes 7×7, 10×10, 14×14; daily (10×10 Medium), Random, seed links, hints. The theme is lighthouses on a sea of shoals and rocks. Saved keys `lanterns:`; played alone (no co-op or head-to-head).

## Rulings
- 4 November 2026, Korbi: "agree lighthouse is good ... these should be the optional 3d modes. there should be the simple 2d mode, and then the toggle for the 3d, similar to bridges." 2D is the default; 3D (`lanterns-3d.js`, the sea of lighthouses with beams sweeping along rows and columns) is the Menu's Play in 3D or the 3D button, `prefs.view`, and one run drives both.

## Traps
- **The generator is seed-exact**: the same seed must make the same puzzle on every device, so it never reads a clock. A level that doesn't come in the tries allowed deals the nearest (the page says so); Expert comes about half the time at 10×10 and 14×14 and rarely at 7×7.
- **Numbers are paired down, not rocks**: every rock starts numbered by the answer's lanterns and a number is dropped while the level's solver still finishes, so a rock without a number is still a rock.
- **Hint steps are applied one at a time but a Hard or Expert pass settles everything it can** (`trialStep` without `rec`); the hint takes only the first.
- **3D draws no shadows and no filters** (Safari blurs a filter on a large picture): the beams are stacked translucent strips. It was only looked at in Chromium.
