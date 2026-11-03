# Navigation

A course in celestial navigation and the sea: eighteen short lessons in four chapters (the chart, the night sky, taking a sight, time and tide), each with an instrument to use (a chart to mark, a compass card, a dead-reckoning plot, a log line, a sky chart to tap, a mariner's astrolabe, a sextant, the dip and refraction table, a chronometer, a clock's error in miles, the moon and the tide). `navigation.html` is the door (the plate, where you have got to); the lessons are on the shared course sheet (`course.js`), with its own stage (`navigation-stage.js`, the instruments in `navigation-sky.js` and `navigation-sea.js`), the lessons in `navigation-lessons.js` and the arithmetic in `navigation-math.js`. Progress is the sheet's own, `navigation:course`; `navigation:lessons` is `{ done, of }` for the tile.

Ruling, 4 November 2026, 00:24, Korbi: "a tasteful overlap between the theme: celestial navigation, exploration age mercantilism, chronography, astronomy; and a sustainable puzzle view that isn't too heavy in gimmicks".

## Sources and licences

- The sky is Landfall's, imported read-only: `landfall-sky.js` (the maths) and `landfall-stars.js`, the Yale Bright Star Catalogue, 5th revised edition (Hoffleit & Warren 1991; NASA/NSSDC Astronomical Data Center V/50, via CDS), a scientific catalogue, read through B. Wade's JSON conversion (`brettonw/YaleBrightStarCatalog`, MIT). `landfall-figures.js` (our own drawings) gives the Plough, the Little Bear and Cassiopeia; the lines of Orion, the Cross and the Pointers are ours, in `navigation-sky.js`. Nothing is fetched at run time. docs/landfall.md has the full record.
- History is public domain and checkable: Mercator 1569, Wright 1599, Hadley 1730, the sextant 1757, the Longitude Act 1714, H4 1761–62, Cook's K1 1772–75, Newton 1687, the East India Company 1600, the VOC 1602, Brouwer's route 1611.

## Traps

- **The course stands on Landfall's files.** A change to `landfall-sky.js`, `landfall-stars.js` or `landfall-figures.js` reaches here; `tests/navigation.mjs` checks the facts the words state (the Pointers, the belt of Orion, the Cross, the pole star's distance from the pole) and will fail if a rename or a catalogue change moves them.
- **The numbers in the words are computed**, from the same functions the instruments use, when the module loads (`navigation-lessons.js`); never type one in. The right answer of a quiz is put in a seat that cycles 0, 1, 2 (`pick`), so a test of a quiz reads `quiz[answer]`, not a position.
- **The step's picture is `desc`, the sky's camera is `alt`.** `alt` on a sky step is the altitude the chart is centred on; it is not a description.
- **A sky step's `names` and `goal` are looked up by name or designation** (`star()`); a duplicate designation (α¹ Cru) is found by its name. A target must be above the horizon and on the chart at the step's place and time (tested).
- **The dialog's class is `navc`, the instruments' is `nvi-<instrument>`:** `nv` is the stylesheet's prefix for what is drawn in the box, and a class shared by the sheet and an instrument once put a stroke on all the text.
- **The sextant's drum steps 0.1° (6′)**, so its tolerance is 0.15°; a tighter one cannot be hit.
- **The moon's age is the mean cycle** (good to about half a day), the tide a two-term model (the moon's tide and the sun's, 0.4 of it): it shows springs and neaps, not any port's tide.
