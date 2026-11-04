# Astronomy: course outline (stage 1, for Korbi's review)

Status: outline only. No course UI, no code, no change to `apps.js`, `kb/` or any shared file. Nothing here is a ruling of Korbi's yet. Pattern: `docs/history-of-trade-outline.md`.
Shape: 12 chapters of 3 to 4 short lessons on the shared course sheet (`course.js`), door page `astronomy.html` (name open, question 1), `courses` section of `apps.js`. Family: a course, so `full titled` (`tests/full-screen.mjs`).

## 0. Decided, and what was checked

- **Not duplicated from Landfall.** `landfall-notes.js` already holds, as ambient notes: the sky turning and which way (`turn`, `spin`), the pole's height (`polehigh`), Orion, Sirius, Aldebaran, the astrolabe and sextant, dip, refraction, declination, longitude as time, the chronometer, the Longitude Act, Harrison's H4, a fix. This course **links to those ids and never restates them**. Where a chapter touches one it says "Landfall note `<id>`" and teaches only the new half (the *why*: what the Earth is doing, what the object is). The Navigation tile is retired, so no navigation chapter here either.
- **Pictures conflict with the rules.** `pics.js` fetches lead images from Wikipedia at display time. The standing rule is *no picture fetched from Wikipedia at run time*, and the Wine course shows the other pattern (no pictures; `tests/wine.mjs` forbids `pics.js`). So this course must not use `pics.js`. Proposal: **bundled** NASA/ESA images (downsized, one licence line each in `docs/licences-images-and-engines.md`, as Columbiad's Blue Marble is) plus drawn SVG diagrams. See section 2, question 4.
- **NASA vs ESA licence.** NASA media is published without copyright (NASA media usage guidelines), so Hubble, Apollo, Voyager, SDO and most JWST images are usable with a credit line. **ESA material is not public domain by default** (mostly CC BY-SA 3.0 IGO, which obliges share-alike: avoid, or take only the NASA-hosted copy). Joint ESA/NASA JWST and Hubble images are on NASA/STScI pages: use those copies and credit "NASA, ESA, CSA, STScI". Each image's page is read before it is bundled.
- **kb/ today.** Nothing for planets, stars or galaxies. Space-related entities that exist: `jupiter-god`, `mars-god`, `venus-god`, `saturn-god` (set `roman-god`), `moon-landing` (`kind:event`), `nasa` (`kind:organisation`), and the name-collisions `mars` (`kind:company`), `mooncake`. Section 4 proposes new sets; `kb/` belongs to its own agent, so the course's data would live in `astronomy-*.js` until Korbi decides.
- **Conjunction's bodies.** `bulls-bodies.js` has eight: Vulcan, Sun, Saturn, Moon, Comet, Jupiter, Europa, Venus, each with a silhouette (`sil`) and marking (`cue`) that `tests/bulls-bodies.mjs` keeps unique. **Vulcan and "Comet" are not real bodies as drawn**: Vulcan was Le Verrier's hypothetical planet inside Mercury's orbit (1859), later made unnecessary by general relativity (chapter 4 tells that story; it is the course's one "which of these is a myth" item). Europa is real but a moon. This is why "which of these bodies is it" (style A below) works on exactly these eight and nothing else yet; chapters 4 and 5 need at most six more drawn bodies (Mercury, Mars, Uranus, Neptune, Pluto, Ceres) if Korbi wants a wider set, which means a change to `bulls-bodies.js` (Conjunction's file, not ours): open question 6.
- **What I checked on the web (4 November 2026)** and what I only recalled. Read: NASA/IPAC on the Exoplanet Archive passing 6,000 (17 September 2025); Sky & Telescope on the Hubble tension (H0 ranges); Freedman's DPF 2026 slides (SH0ES 73.0 ± 1.0, Planck 67.4 ± 0.5); Live Science's moons page (updated 25 March 2026); ESA Gaia news (DR4 on 2 December 2026); orbitcodex on DESI DR2; a Good Morning America report on Artemis II; IFLScience on Voyager 1's one-light-day date. The NASA planetary fact sheet was **not reachable** (blocked), so planetary dimensions below are recalled from it and marked `check`. Everything not labelled "checked" is **recalled** and must be opened against its primary source before it goes in a question (rule: every figure verified at build time, as `docs/trade` does).
- **Dated facts go stale.** Counts (moons, exoplanets, missions) and anything about "the next" event carry an `asOf` date in the data and the course prints "as of <month year>". A nightly test cannot check them, so list them in the data file with `volatile: true` and re-read before each release.

## 1. Question styles (one palette, chapters pick from it)

Built to the `CLAUDE.md` rules for questions: every wrong option as long and plausible as the right one, none the only one with a number or formula, the right answer's place cycling by question id, `tests/banks.mjs` passes.

- **A. Which body is it:** a drawn body from `bulls-bodies.js` (Conjunction's eight) with a one-line clue ("a small grey globe with craters", "the largest globe, banded, red spot"); pick the name. Wrong options are other bodies of the same class. Reuses the SVG symbols, no new pictures. Vulcan appears only as the "which is not real" answer.
- **B. Scale it:** pick the right order of magnitude or the right comparison ("Jupiter's diameter is about N Earths"); options are neighbouring orders, never a distractor 1000 times off.
- **C. Order three:** put three events or objects in order (by distance, size, date). Never uses a contested date or a contested size (a `loose` flag, as in Art history).
- **D. Read the sky:** a drawn diagram (phase, eclipse geometry, an HR diagram with a dot, a light curve) and one question about it.
- **E. Pick the range:** for a contested or revised number the learner picks which range is defensible; the answer text says who measures what. A contested number is **never** asked as "what is the number".
- **F. Myth or fact:** the common claim and the corrected version (seasons come from distance; the Moon's far side is dark; the Sun is yellow; Pluto is "not a planet because it is small"; the Great Wall is visible from the Moon).
- **G. Who saw it first:** match an observation to the people who recorded it (the 1054 supernova, Halley's comet, Venus's phases, Andromeda), used heavily in chapter 9.
- **H. Spot the connection:** link two things across chapters (Cepheids to the age of the universe; the Moon's recession to eclipses; the Saros to Babylon).
- Review pile like Music and Art history: a miss returns after a day, three, a week, three weeks.

## 2. The chapters

Format per chapter: goals, key facts (checked / recalled; contested or revised values give the range), pictures, styles, link to Landfall, reading. Full references in section 5. Figures marked `check` are recalled and need a primary-source read before use.

### 1. The sky and its motions
Goals: the apparent motion of sky objects is the Earth's motion; the Sun, Moon and planets follow one path; the sky slowly changes over millennia. Landfall note `turn`, `spin`, `polehigh` and `declination` already show the turning sky and the pole's height: this chapter starts after them.
Facts:
1. A sidereal day (one turn against the stars) is 23 h 56 min 4 s; the solar day is 24 h, because the Earth also moves round the Sun. `check`
2. The ecliptic is the Sun's yearly path; the Moon and planets stay within a few degrees of it, which is why Conjunction's bodies all sit along it.
3. Seasons come from the axial tilt, about 23.4 degrees, not from distance: the Earth is closest to the Sun (perihelion, about 147 million km) in early January, in northern winter. `check` distance.
4. Precession, the wobble of the Earth's axis, takes about 26,000 years (25,772 years, `check`); the pole star changes: Thuban about 2700 BCE, Polaris now, Vega about 13,700 CE.
5. Planets "wander" (Greek *planetes*); retrograde motion is the Earth overtaking an outer planet, not the planet reversing.
6. The IAU fixed 88 constellations with boundaries in 1922 to 1930; they are regions of the sky, not just patterns. The zodiac the Sun passes through has 13 of them: Ophiuchus is crossed too.
7. Naked-eye limit is about magnitude 6; each 5 magnitudes is a factor of 100 in brightness; a dark site shows roughly 2,500 stars at once. `check`
8. Light pollution is graded on the Bortle scale, 1 (darkest) to 9 (inner city).
Pictures: drawn diagrams (celestial sphere, ecliptic, a retrograde loop, precession circle). Possible NASA all-sky image (Gaia or Fermi) for the Milky Way band, credit line.
Styles: D, F (seasons), C (pole stars by date).
Landfall: notes `turn`, `spin`, `polehigh`, `declination`, `orion`. Link, do not repeat.
Reading: Kaler (*The Ever-Changing Sky*), Dibon-Smith or the IAU constellation boundaries (Delporte 1930), Bortle (2001, Sky & Telescope).

### 2. The Moon and eclipses
Goals: phases come from geometry; eclipses come from rare alignments; the Moon is a changing neighbour.
Facts:
1. Mean distance 384,400 km; diameter about 3,475 km (0.27 Earth); the Moon recedes about 3.8 cm a year (lunar laser ranging). `check`
2. A lunar month: 29.53 days from new moon to new moon (synodic), 27.32 days against the stars (sidereal).
3. Tidal locking: the Moon shows one face; the "far side" is not dark, it is the side we never see.
4. The Moon probably formed from a giant impact about 4.5 billion years ago (the Theia hypothesis); isotope similarity with Earth is still debated (**CONTESTED**: details of the impactor and of how much came from each body).
5. A total solar eclipse happens because the Sun is about 400 times wider and about 400 times farther than the Moon: a coincidence of this epoch, and it ends as the Moon recedes (annular only, in some hundreds of millions of years).
6. Eclipses do not happen every month because the Moon's orbit is tilted about 5 degrees to the ecliptic; they come in "seasons" about six months apart.
7. The Saros cycle is 6,585.3 days (about 18 years 11 days), used by Babylonian astronomers to predict eclipses (told in chapter 9).
8. Total solar eclipses in the near future (`check`, volatile): 12 August 2026 (Greenland, Iceland, Spain), 2 August 2027 (North Africa, Egypt), 22 July 2028 (Australia). Verified against NASA's eclipse tables before the date is printed.
9. Twelve people have walked on the Moon (Apollo 11 to 17, 1969 to 1972); the last, Eugene Cernan, on 14 December 1972.
Pictures: drawn phase and eclipse diagrams (NASA SVS Moon images if bundled, credit line); Apollo images (NASA, public domain).
Styles: A (Moon), D (phase and eclipse geometry), F (far side), C, H (recession to eclipses).
Landfall: tides and the moon are on Landfall's "carries later" list (M5), not built: when it ships, chapter 2 links to it; nothing taught here about tides.
Reading: Espenak and Meeus (*Five Millennium Canon*), NASA Eclipse web site, Canup on the giant impact.

### 3. The Sun
Goals: the Sun is a star, powered by fusion, with weather that reaches us.
Facts:
1. 1 AU, the Earth-Sun distance, is exactly 149,597,870.7 km by IAU definition (2012); light takes 499 s (8 min 19 s) to cross it.
2. The Sun holds 99.86% of the solar system's mass and could hold about 1.3 million Earths by volume; diameter about 1.39 million km. `check`
3. Core about 15 million K; photosphere (visible surface) 5,772 K (IAU nominal); the corona is over a million K, hotter than the surface: the coronal heating problem is **unsettled** (waves versus nanoflares).
4. Fusion turns about 4 million tonnes of mass into energy every second (4.26 million is the commonly given figure); the Sun is about 4.6 billion years old, roughly halfway through its hydrogen-burning life.
5. The Sun's colour is white; it looks yellow through air.
6. Sunspot cycle about 11 years (magnetic cycle 22). Solar Cycle 25 passed its maximum around late 2024 (NASA and NOAA, October 2024), `check`.
7. The 1859 Carrington event: the largest recorded geomagnetic storm; telegraph systems failed and auroras reached the tropics.
8. The solar-neutrino deficit (Davis, 1960s) was resolved by neutrino flavour oscillation (SNO, 2001 and 2002).
9. Parker Solar Probe has passed within about 6.1 million km of the surface (24 December 2024, about 692,000 km/h). `check`
Pictures: NASA SDO (Solar Dynamics Observatory) images, public domain.
Styles: A (Sun), B (scale), F (colour of the Sun), E (corona heating, as "what's known and what is not").
Landfall: notes `shades` (looking at the sun) and `noonlat`/`declination` use the Sun as a sighting target; this chapter teaches what the Sun is.
Reading: Kippenhahn et al. (*Stellar Structure and Evolution*), Phillips (*Guide to the Sun*), NASA Heliophysics.

### 4. The planets and small bodies
Goals: the order and nature of the planets; why Pluto was reclassified; what comets and asteroids are; the Vulcan story.
Facts:
1. Eight planets, four rocky and four giants (two gas, two ice). Orbital periods: Mercury 88 d, Venus 224.7 d, Earth 365.25 d, Mars 687 d, Jupiter 11.9 y, Saturn 29.5 y, Uranus 84 y, Neptune 165 y. `check`
2. Venus rotates backward, one turn in about 243 Earth days: a Venus day is longer than its year. Surface about 465 degrees C, hotter than Mercury's.
3. Jupiter's diameter is about 11 Earths; its Great Red Spot is a storm older than 150 years (**CONTESTED** whether it is the same storm Cassini saw in 1665 or a later one).
4. Saturn's mean density (about 0.69 g/cm3) is below water's.
5. IAU Resolution (24 August 2006): a planet orbits the Sun, is round, and has cleared its orbit; Pluto, Eris, Ceres, Haumea, Makemake are dwarf planets. Pluto's discoverer was Tombaugh, 1930; New Horizons flew by on 14 July 2015.
6. Moon counts change and **differ by source**: Saturn 274 (IAU Minor Planet Center, March 2025) to "at least 285" (Live Science, 25 March 2026); Jupiter 97 to 101; Uranus 28 or 29 (a 29th found by JWST in August 2025 awaiting confirmation); Neptune 16. Ask these only as style E (range), with an `asOf` date, or not at all.
7. Vulcan: Le Verrier (1859) attributed Mercury's extra perihelion precession (about 43 arcseconds per century) to an unseen planet inside its orbit; Einstein's general relativity (1915) explained it with no new planet. Vulcan is one of Conjunction's bodies; it is the "not real" item.
8. Halley's comet returns every 75 to 79 years (last 1986, next about 2061); the 1P/Halley link between the 1531, 1607 and 1682 comets is Halley's 1705 prediction.
9. 66 million years ago an impact at Chicxulub (Yucatan) ended the non-avian dinosaurs; NASA's DART hit the asteroid Dimorphos on 26 September 2022 and changed its orbit by about 33 minutes (planetary defence demonstration).
10. Interstellar visitors: 1I/'Oumuamua (2017), 2I/Borisov (2019), 3I/ATLAS (2025).
Pictures: NASA planetary images (Voyager, Cassini, Juno, MESSENGER), public domain; drawn orbit diagram.
Styles: A (every Conjunction body: Venus, Saturn, Jupiter, Europa, Comet, Vulcan-or-not), B (size), C (order by distance), E (moon counts), F (Pluto).
Landfall: none (the planets are not navigation targets here; Venus, Jupiter, Mars and Saturn are Landfall's wandering stars if M3 ever adds them, then link).
Reading: Hartmann (*Moons and Planets*), de Pater and Lissauer (*Planetary Sciences*), Brown (*How I Killed Pluto*), Baum (*Vulcan*).

### 5. How we know distances
Goals: why astronomers talk of a "distance ladder"; each rung calibrates the next.
Facts:
1. Parallax: nearby stars shift against distant ones as the Earth moves; 1 parsec is the distance of a star with 1 arcsecond of parallax = 3.26 light-years = 206,265 AU.
2. Bessel measured 61 Cygni's parallax in 1838 (about 0.3 arcsecond), the first success; Proxima Centauri is the nearest star at 4.24 light-years, Sirius 8.6.
3. Hipparcos (ESA, launched 1989) measured about 118,000 stars to about a milliarcsecond; Gaia (launched 2013) measures about 1.8 billion sources (DR3, June 2022). Gaia science operations ended in January 2025 and the spacecraft was switched off in March 2025 (`check`); **its fourth data release is scheduled for 2 December 2026** (checked, ESA), which falls within a month of today. State it with an asOf.
4. Cepheid variables: Henrietta Leavitt (1912) found that brighter ones pulse more slowly, so the pulse period gives true brightness, so distance.
5. Hubble used Cepheids in 1923 to show that Andromeda lies far outside the Milky Way, settling the "Great Debate" (Shapley versus Curtis, 1920).
6. Type Ia supernovae (a white dwarf reaching about 1.4 solar masses) are "standard candles" for billions of light-years; their dimming in 1998 showed the expansion is accelerating (Nobel 2011, Perlmutter, Schmidt, Riess).
7. The Moon's distance by laser ranging (Apollo reflectors) to millimetres; the AU was once measured from transits of Venus (1761, 1769) and radar (1961).
8. **The Hubble tension (revised, contested):** the rate of expansion today. SH0ES (Riess) with Cepheids: 73.0 ± 1.0 km/s/Mpc; Planck CMB (assuming standard cosmology): 67.4 ± 0.5; Freedman's group (JWST, tip-of-the-red-giant-branch and carbon stars): 68.4 to 71.5, which sits between and the Riess team disputes it. Checked (Sky & Telescope; Freedman DPF 2026).
Pictures: drawn parallax, ladder and Leavitt plot diagrams; Gaia Milky Way image (ESA/Gaia/DPAC is CC BY-SA IGO: **draw our own or use a NASA image**).
Styles: B, C (order the rungs), E (the Hubble constant), G (Leavitt, Bessel), H.
Landfall: note `lontime` is distance on the Earth by time; this chapter is distance in space. No overlap.
Reading: Freedman and Madore on the ladder, Riess et al. (SH0ES), Gaia collaboration papers, Leavitt (1912).

### 6. Stars and their lives
Goals: stars are classified by temperature and brightness; mass sets the life; the heavy elements are made in stars.
Facts:
1. The Hertzsprung-Russell diagram plots luminosity against temperature; most stars (including the Sun) lie on the main sequence.
2. Spectral classes O B A F G K M run hot to cool (blue to red); Cecilia Payne showed in 1925 that stars are mostly hydrogen and helium (an astronomy-establishment resistance she met: Russell dissuaded her at first).
3. A star's life is set by its mass: the Sun about 10 billion years on the main sequence; a star of 20 solar masses a few million; the smallest red dwarfs trillions of years (longer than the universe's age so far).
4. The Sun ends as a red giant then a white dwarf, not a supernova (below the Chandrasekhar limit, about 1.4 solar masses).
5. Core-collapse supernovae leave neutron stars (about 1.4 to 2 solar masses in about 20 km) or black holes; the neutron star merger GW170817 (17 August 2017) made gold and platinum (kilonova).
6. Most elements heavier than hydrogen and helium come from stars: "we are made of star-stuff" (calcium in bones, iron in blood).
7. Betelgeuse (a red supergiant in Orion) dimmed sharply in 2019 and 2020 (the Great Dimming); its distance is **revised and contested**: about 550 light-years (Joyce et al. 2020 gave about 168 million km radius), against an older Hipparcos figure near 640. It will go supernova, but not "soon" in human terms (within about 100,000 years).
8. The 1054 supernova (Crab Nebula) was recorded in Chinese and Japanese records and possibly Arab and Native American ones (chapter 9).
9. Pulsars were found by Jocelyn Bell Burnell in 1967; the Nobel went to her supervisor, Hewish, in 1974.
Pictures: Hubble/JWST nebulae and the Crab (NASA/STScI, public domain, credit); drawn HR diagram.
Styles: D (HR diagram), A (Sun), C (order stars' life stages), E (Betelgeuse's distance), G.
Landfall: notes `sirius`, `aldebaran`, `orion` use these stars as marks in the sky; this chapter is what they are (Sirius is a binary with a white dwarf; Aldebaran is an orange giant; Betelgeuse is the red shoulder).
Reading: Payne-Gaposchkin (*Stars and Clusters*), Kippenhahn, Longair, Bell Burnell on pulsars.

### 7. Galaxies and the large-scale universe
Goals: our galaxy is one of billions; galaxies have structure and a black hole at the centre; the cosmic web.
Facts:
1. The Milky Way is a barred spiral about 100,000 light-years across; the Sun lies about 26,000 light-years from the centre (26 to 27 thousand). Stars in it: **100 to 400 billion** (contested, depends on counting dim red dwarfs).
2. Sagittarius A* is a black hole of about 4.3 million solar masses (Genzel and Ghez, Nobel 2020); the Event Horizon Telescope imaged M87* (April 2019) and Sgr A* (May 2022).
3. Andromeda (M31) is 2.5 million light-years away and approaching; whether it will merge with us is **revised**: the long-quoted "collision in 4 to 5 billion years" is now put at roughly even odds within 10 billion years in a 2025 Gaia and Hubble re-analysis (`check`, volatile).
4. Edwin Hubble 1929 and Lemaitre 1927: galaxies recede in proportion to distance.
5. The Local Group has over 50 galaxies, the Virgo Supercluster is the next scale; galaxies cluster along filaments around huge voids: the cosmic web. Laniakea (2014) is a supercluster of about 100,000 galaxies (Tully); its boundaries are **definitional**.
6. The observable universe is about 93 billion light-years across (radius about 46.5 billion light-years), larger than 13.8 because space expanded while the light travelled.
7. Number of galaxies: **a few hundred billion to about two trillion** (two trillion from Conselice 2016; later work on dark-sky data suggests far fewer, about 200 billion). Ask as style E.
8. Galaxy types: spirals, ellipticals, irregulars; the Hubble tuning-fork diagram is a classification, not an evolutionary path.
9. Quasars (1963, Maarten Schmidt) are active black holes in distant galaxies.
Pictures: Hubble Ultra Deep Field, JWST Deep Field (NASA/STScI), M31 images, drawn Milky Way plan with the Sun marked.
Styles: B (scale), E (stars in the Milky Way, galaxies), D (the tuning fork), G, F ("the Milky Way is the only galaxy").
Landfall: none. Asterism's nebulae are decorative; if kb gets nebula entities the chapter can borrow their names.
Reading: Binney and Tremaine, Tully on Laniakea, the EHT papers, Sawala et al. (2025) on Andromeda.

### 8. Cosmology
Goals: the story of the whole universe; what is measured and what is theory.
Facts:
1. The universe is 13.8 billion years old (Planck 2018: 13.80 ± 0.02 billion), **tied to the Hubble tension**: a model with H0 near 73 would make it younger by a billion years. Style E.
2. The cosmic microwave background (CMB) at 2.725 K was found by Penzias and Wilson in 1965; it is light from when the universe was about 380,000 years old (recombination).
3. Big Bang nucleosynthesis made roughly 75% hydrogen and 25% helium by mass in the first minutes; the match with old stars is a main test.
4. The matter content: about 5% ordinary, 27% dark matter, 68% dark energy (Planck 2018, ΩM = 0.315 ± 0.007, checked via the figure in the DESI literature). Dark matter is seen only by gravity (galaxy rotation, lensing); what it is, is **unknown**.
5. Acceleration (1998) is attributed to dark energy; in March 2025 DESI's second data release hinted it may evolve over time, at 2.8 to 4.2 sigma depending on the supernova set, **short of the 5 sigma discovery threshold**, and a DES recalibration lowered one of those to 3.2 (checked). The course states it as "hint, not result".
6. Inflation (Guth, Linde, Starobinsky, 1980s) is a short burst of exponential growth that explains the universe's flatness; it is widely held but **not directly tested**; the primordial gravitational wave signal claimed by BICEP2 in 2014 turned out to be dust.
7. The universe's expansion is of space itself, no centre, no edge we can reach; "what is it expanding into" is a mistaken question (style F).
8. Olbers' paradox: why the night sky is dark: the universe has a finite age and expands.
9. Lemaitre, a Belgian priest, proposed the "primeval atom" (1931); "Big Bang" was Hoyle's dismissive name on the BBC in 1949.
Pictures: Planck CMB map (ESA: **licence is ESA's own; check, avoid if not NASA-hosted**; WMAP's CMB map is NASA and public domain); drawn timeline of the universe.
Styles: B, D (a timeline), E (age, Hubble constant, matter fractions), F, H.
Landfall: none.
Reading: Peebles (*Principles of Physical Cosmology*), Weinberg (*The First Three Minutes*), Singh (*Big Bang*), Planck Collaboration 2020.

### 9. Telescopes and light
Goals: all we know of the sky arrives as light (and a few other messengers); each part of the spectrum needs its own instrument.
Facts:
1. The refractor was patented in the Netherlands by Lippershey (1608); Galileo built his own in 1609 and in 1610 saw Jupiter's four moons, Venus's phases and the Milky Way's stars.
2. Newton's reflector (1668) avoided colour fringing; the biggest telescopes ever since are reflectors.
3. The electromagnetic spectrum from radio to gamma; the atmosphere blocks most of it, so X-ray, ultraviolet and most infrared telescopes fly in space.
4. Fraunhofer lines (1814) in the Sun's spectrum, explained by Kirchhoff and Bunsen (1859): each element has its fingerprint, so we know what stars are made of.
5. Hubble Space Telescope: launched 24 April 1990, a 2.4 m mirror; its flaw (spherical aberration) was fixed by astronauts in December 1993.
6. JWST: launched 25 December 2021, 6.5 m segmented mirror (18 hexagons) at the Sun-Earth L2 point, 1.5 million km away, observing in the infrared; first images released 12 July 2022. `check`
7. Radio: Jansky (1932), Reber (1937); FAST in China has a 500 m dish; Arecibo collapsed in December 2020.
8. Gravitational waves: LIGO detected the merger GW150914 on 14 September 2015 (announced 11 February 2016; Nobel 2017).
9. Rubin Observatory (Chile) released its first images in June 2025; its ten-year survey will image the whole southern sky every few nights. ESO's Extremely Large Telescope (39 m) first light is **currently scheduled for the late 2020s and has slipped before** (`check`, volatile).
10. Seeing and adaptive optics; aperture matters more than magnification; a pair of binoculars shows Jupiter's moons.
Pictures: drawn diagrams (refractor vs reflector, the spectrum, a spectrum with lines); NASA images of Hubble and JWST.
Styles: D (spectra), C, G, F, A (Moon through Galileo's telescope as a "which" image).
Landfall: note `astrolabe` and `sextant` are the pre-telescope instruments for measuring altitude; this chapter links to them as the *start* of the history of instruments.
Reading: King (*History of the Telescope*), Longair (*The Cosmic Century*), NASA/STScI on JWST.

### 10. The history of astronomy, told globally
Goals: astronomy was invented many times, by many people, for calendars, farming, navigation and religion; the Copernican turn is one chapter of a longer, shared story. Rule: **fewer than a third of key facts have European actors**, and the Europeans of the Renaissance are given the later lessons, not the first ones. (A test counts the region tag of each fact, as the trade course proposes.)
Lessons (short): Babylon and Egypt; Greece and Alexandria; India; China; the Islamic world; Mesoamerica; Polynesia and the Pacific; Aboriginal and other skies; then Copernicus onward.
Facts:
1. **Babylon:** the *Enuma Anu Enlil* omens and the Venus tablet of Ammisaduqa (observations from about 1600 BCE, copies later); Babylonian astronomers found the Saros and used arithmetic, not geometry, to predict (the "System A and B" tablets, last centuries BCE).
2. **Greece:** Aristarchus (about 270 BCE) argued the Earth goes round the Sun; Eratosthenes (about 240 BCE) measured the Earth's circumference from shadows at Syene and Alexandria; his stadion's length is **CONTESTED**, so his error is anywhere from 1% to 16%, depending on the stadion. Hipparchus (about 130 BCE) found precession; Ptolemy's *Almagest* (about 150 CE) was the standard for 1,400 years. The Antikythera mechanism (about 2nd to 1st century BCE) is a geared calendar and eclipse computer (date **CONTESTED**, roughly 200 to 100 BCE).
3. **India:** Aryabhata (born 476 CE; *Aryabhatiya*, 499) states the Earth turns daily (readings of his planetary model as heliocentric are **disputed**); Brahmagupta (628) gave zero's rules and an Earth circumference; the Kerala school (Madhava, 14th century; Nilakantha, about 1500) improved planetary models and series for sine; Jai Singh II built five Jantar Mantar observatories (Jaipur, 1720s to 1730s), the largest stone sundial ever built.
4. **China:** oracle bones (about 1300 BCE) record eclipses; Chinese records of comets, including what we now call Halley's from 240 BCE, run longest and are used by modern astronomers; the 1054 supernova was recorded as a "guest star" (and in Japan; claims for Arab and Native American records are **contested**); Su Song's water-driven astronomical clock tower at Kaifeng, 1088 to 1092; Guo Shoujing built the Gaocheng observatory (1276) and his calendar (the Shoushi) was accurate to 365.2425 days.
5. **Islamic world:** the House of Wisdom's translation movement (9th century, Baghdad); al-Sufi (964) described the Andromeda galaxy, the first known; Ibn al-Haytham (about 1011) on optics and against Ptolemy's physical inconsistency; al-Biruni measured the Earth (about 1020); the Maragha observatory (1259, Nasir al-Din al-Tusi) produced the Tusi couple, a device **later found in Copernicus's** work (**CONTESTED** whether he knew it by transmission, plausible but not documented); Ulugh Beg's Samarkand observatory (1420s) produced the best star catalogue before Tycho. Many bright star names (Betelgeuse, Aldebaran, Altair, Vega) are Arabic.
6. **Mesoamerica:** the Maya Dresden Codex (about 11th to 12th century, copied from older) contains a Venus table accurate over centuries; Maya calendar; the Caracol at Chichen Itza is argued as an observatory (**CONTESTED**); the Aztec Sun Stone and the Mexica "New Fire" ceremony of 1507 tied to the Pleiades.
7. **Polynesia and the Pacific:** star compasses, swell reading, and bird flight allowed settlement of an ocean triangle from Hawaii to Rapa Nui to Aotearoa; Mau Piailug (Satawal) taught Nainoa Thompson, and the Hokule'a sailed Hawaii to Tahiti in 1976 without instruments. Landfall carries celestial navigation as a European method; this lesson is the non-instrument counterpart. Link, no repeated content.
8. **Aboriginal Australian and other skies:** the Emu in the Sky (a shape in the dark clouds of the Milky Way); claims of the "oldest astronomy" are **CONTESTED** as dates (tens of thousands of years is a claim of continuity, not of record).
9. **Europe, the turn:** Copernicus's *De revolutionibus* (1543); Tycho's naked-eye observatory at Hven (1576 to 1597); Kepler's three laws (1609 and 1619) from Tycho's data; Galileo's telescope (1609 to 1610) and trial (1633); Newton's *Principia* (1687).
10. **After:** Herschel found Uranus (1781); Neptune was predicted by Le Verrier and Adams and found by Galle (1846); Leavitt and Cannon (Harvard computers, women paid to classify stars) set the foundations of stellar astronomy; Payne 1925; Hubble 1929.
Pictures: museum open-access images only (the Met, the Rijksmuseum, the Wellcome, Smithsonian, with licence recorded); Antikythera, the Dresden Codex (SLUB Dresden, public domain), Jantar Mantar (own photography is not available, so a drawing).
Styles: G (who saw it first), C (order by date, never a `loose`-contested one), E (Eratosthenes's error), F (the Church, "Columbus proved the Earth was round", "the Middle Ages forgot astronomy"), H (Tusi couple to Copernicus), A (Venus, the Moon).
Landfall: notes `astrolabe`, `act`, `h4` and `brouwer` already tell the European navigator's side; chapter 10 links instead of repeating, and its Pacific lesson is the counterpart.
Reading: Aveni (*Skywatchers*), Ruggles (*Handbook of Archaeoastronomy and Ethnoastronomy*), Saliba (*A History of Arabic Astronomy*), Needham (*Science and Civilisation in China*, vol. 3), Plofker (*Mathematics in India*), Lewis (*We, the Navigators*), Norris on Aboriginal astronomy.

### 11. Space exploration
Goals: how we went from rockets to rovers; who went and why; what is being done now.
Facts:
1. Sputnik 1, 4 October 1957 (USSR); Gagarin, the first human in orbit, 12 April 1961; Tereshkova, the first woman, 1963; Leonov's first spacewalk, 1965.
2. Apollo 11 landed on 20 July 1969 (Armstrong and Aldrin); Apollo 17 (1972) was the last crewed landing so far.
3. Voyager 1 and 2 launched in 1977; Voyager 1 passed the heliopause in August 2012, Voyager 2 in November 2018; Voyager 1 reaches one light-day from Earth around **18 November 2026** (IFLScience citing NASA's trajectory; checked). The "Pale Blue Dot" image is 14 February 1990.
4. Rovers and landers: Viking 1 and 2 (1976); Pathfinder (1997); Curiosity (2012); Perseverance (February 2021, with the Ingenuity helicopter, which flew 72 times before it ended in January 2024); China's Zhurong (2021).
5. Moon, recent: Chang'e 4 landed on the far side (January 2019); Chang'e 6 returned far-side samples (June 2024); India's Chandrayaan-3 landed near the south pole (23 August 2023).
6. Asteroid samples: Hayabusa2 (Ryugu, 2020), OSIRIS-REx (Bennu, September 2023).
7. Pluto, 14 July 2015 (New Horizons); Rosetta and Philae landed on comet 67P (November 2014); Cassini-Huygens at Saturn (2004 to 2017; Huygens landed on Titan on 14 January 2005).
8. **Artemis II** flew a crew around the Moon in April 2026 (launched 1 April, back after about 10 days; Good Morning America, 13 April 2026). One further source I found named an August target date, which I take to be stale; the course's text must be re-read against NASA before print. **Artemis III is reported as a 2027 Earth-orbit docking test and the first landing (Artemis IV) as early 2028** (one news report, `check`, volatile).
9. The ISS has been continuously crewed since 2 November 2000.
10. Commercial: reusable boosters (Falcon 9 first landing, December 2015) cut launch costs; this chapter states what is known and does not advocate for any company.
Pictures: NASA images (public domain); drawn trajectories.
Styles: C (order missions), G, A (Moon, Europa for Europa Clipper, Saturn for Cassini), B (distances), F.
Landfall: none. Columbiad is the game; link to it for "how a cannon shot would fly" (do not repeat its gravity lessons).
Reading: Wilford, Chaikin (*A Man on the Moon*), NASA History Series, Siddiqi (*Challenge to Apollo*).

### 12. Astrobiology and open questions
Goals: what we know about life elsewhere (nothing certain); what remains open in astronomy.
Facts:
1. The first exoplanet around a Sun-like star: 51 Pegasi b (1995, Mayor and Queloz, Nobel 2019). The NASA Exoplanet Archive passed **6,000 confirmed exoplanets** in September 2025, with more than 8,000 candidates pending (checked); fewer than 100 are directly imaged. Dated count (volatile).
2. TRAPPIST-1 has seven Earth-sized planets, announced February 2017.
3. The habitable zone: the distance where liquid water is possible on a surface; it is a *necessary-ish* condition, not a promise (Europa, Enceladus are outside it and may have subsurface oceans).
4. Enceladus plumes (Cassini, 2005 on) and Europa's ocean: Europa Clipper launched October 2024 and is due at Jupiter in 2030 (`check`).
5. Mars: Viking's life-detection tests (1976) were ambiguous; ALH84001 (1996) was claimed to carry fossils and is now widely thought not to; Perseverance found a "leopard-spot" rock at Cheyava Falls (2024, 2025) that may have a biological origin, **not shown**.
6. **Contested biosignature claims:** phosphine on Venus (2020, disputed since); dimethyl sulfide on K2-18 b (JWST, 2023 and 2025, **disputed**: statistical significance and analyses differ).
7. The Drake equation (1961) is a way of organising ignorance, not a calculation; the Fermi paradox ("where is everybody?") has no accepted answer; the Wow! signal (15 August 1977) was never repeated.
8. Open in astronomy: what dark matter is; whether dark energy evolves; the Hubble tension (chapter 5); how black-hole growth began so early (JWST found large ones less than a billion years after the Big Bang); what happened before or at the Big Bang.
9. Planet Nine (the hypothesised distant planet): **unconfirmed**, its main support a clustering of orbits that may be a bias in surveys.
10. Extremophiles on Earth (Antarctic lakes, hydrothermal vents) widen what "habitable" means.
Pictures: NASA (JWST spectrum of WASP-96b or similar, TRAPPIST-1 artist's concept is NASA/JPL-Caltech, public domain), drawn habitable-zone diagram.
Styles: E (exoplanet count, biosignature claims), F (aliens), D (a light curve with a transit), H, A (Europa).
Landfall: none.
Reading: Sagan (*Cosmos*), Seager (*Exoplanet Atmospheres*), Lingam and Loeb (*Life in the Cosmos*), Madhusudhan's papers and the critiques.

## 3. What this course shares with Landfall (by link, never repeat)

| This course | Landfall note id | Treatment |
|---|---|---|
| ch. 1 the sky and motions | `turn`, `spin`, `polehigh`, `declination`, `orion` | Link at the top of the chapter; teach only the *why* (Earth's spin, precession, the ecliptic) |
| ch. 3 the Sun | `shades`, `noonlat` | Link; teach what the Sun is |
| ch. 6 stars | `sirius`, `aldebaran`, `orion` | Link; teach what each is, not how to find it |
| ch. 9 telescopes | `astrolabe`, `sextant`, `dip`, `refraction` | Link as the earlier instruments; do not explain dip or refraction |
| ch. 10 history | `astrolabe`, `act`, `h4`, `brouwer`, `chrono` | The European navigator's side is told in Landfall; ch. 10 only links |
| ch. 2 the Moon | M5 (not built): moon's age and tides | When it ships, link; nothing taught here about tides |

A `tests/astronomy.mjs` would fail if a lesson's text contains the term or a distinctive phrase of a Landfall note it should only link (run over `NOTES` from `landfall-notes.js`).

## 4. Links to kb/ entities

Today `kb/entities.js` has no planet, star, galaxy or mission entity. The exceptions: `jupiter-god`, `mars-god`, `venus-god`, `saturn-god` (set `roman-god`) are the *gods*, with homonym entities already present (`mars` is a company), `moon-landing` (`kind:event`) and `nasa` (`kind:organisation`); the build already warns of "words that may be two things under one name".
Proposal if Korbi wants the course to feed the other games (Crates, Punt, Quote's years, Chart's pins, as `trade` does): new sets `celestial-body` (Sun, Moon, eight planets, the dwarfs, big moons), `star` (the 20 brightest), `space-mission` (Sputnik to Artemis, with the launch year as a Quote fact), `astronomer` (about 40 people, year and place, so Chart can pin where each worked: Maragha, Samarkand, Hven, Jaipur, Chichen Itza, Kaifeng). **Linking rule:** `celestial-body` entities carry `diameterKm`, `distanceAU`, `year` (for a discovery) as facts; the god entities link by `links` ("named for"), not merged. This is a `kb/` change (shared, one agent at a time), so stage 2 would ask Korbi first; if he says no, the course keeps its own `astronomy-data.js`, and `kb` gains nothing.

## 5. Sources register (proposed)

Books: Aveni (*Skywatchers*, 2001); Saliba (*A History of Arabic Astronomy*, 1994); Needham (*Science and Civilisation in China*, vol. 3, 1959); Plofker (*Mathematics in India*, 2009); Lewis (*We, the Navigators*, 1972); Kaler (*The Ever-Changing Sky*); Peebles (*Principles of Physical Cosmology*, 1993); Weinberg (*The First Three Minutes*); Singh (*Big Bang*); Baum (*The Hunt for Vulcan*, 2016); Brown (*How I Killed Pluto and Why It Had It Coming*, 2010); King (*The History of the Telescope*); Sagan (*Cosmos*); Wilford (*We Reach the Moon*).
Primary data (to open when a figure is used): NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov, **not reachable this session**), NASA Exoplanet Archive, IAU Minor Planet Center (moon counts), NASA Eclipse web site, Planck 2018 results (A&A 641 A6), ESA Gaia pages, JWST and Hubble mission pages, NASA SDO, NASA History.
Licence register: one line per bundled image in `docs/licences-images-and-engines.md`; ESA material only where its licence is read and fits.

## 6. How a reviewer should check this outline

- Every figure marked `check` or "recalled" is opened against its primary source at build time; the data file stores the source and the date opened.
- Volatile facts (moon counts, exoplanet count, Voyager's distance, Artemis dates, Gaia DR4, DESI, Andromeda, ELT first light, the next eclipse) carry `asOf` and `volatile: true`, and the course never asks them as a bare number.
- A contested number is only style E; Eratosthenes, Betelgeuse's distance, the galaxy count and the age are the model cases.
- Region tags on chapter 10's facts, counted by a test.

## 7. Open editorial questions for Korbi

1. **Name and door.** "Astronomy", "The sky", or something in Codex's voice? (Default: Astronomy, `astronomy.html`.)
2. **Level.** Default is for a curious adult who knows no physics: no equations beyond a ratio, terms defined at first use. Do you want an optional "go deeper" step per lesson with the formulae (Kepler's third law, the distance modulus)?
3. **History's position.** I put it at chapter 10, after the science, so a learner meets Cepheids before Leavitt. The alternative is history first (chapters 1 to 2 as story). Which?
4. **Pictures.** Because `pics.js` breaks the no-Wikipedia-at-run-time rule, I propose bundled, downsized NASA images only (about 25 to 40 images, 20 to 60 KB each, so under 2 MB), and drawn SVG for everything else. Alternatively no photographs at all, as in Wine. Which?
5. **Politics and religion in chapter 10.** The Galileo trial and the Church are told as facts with the sources, not as a "science versus religion" morality tale; Islamic and Indian astronomers are shown as astronomers, not as "preservers". Is that the tone?
6. **More drawn bodies.** Conjunction has eight; the course would like Mercury, Mars, Uranus, Neptune, Pluto and Ceres as drawn bodies for style A. That is a change to `bulls-bodies.js` (Conjunction's file, and `tests/bulls-bodies.mjs` wants every silhouette unique). Allow it, or style A stays limited to the eight (Vulcan only as a myth item)?
7. **Volatile facts.** Allowed in the course with an `asOf`, or kept out entirely (moon counts, exoplanet count, Artemis)? My default is in, dated.
8. **Scope of chapter 12.** Biosignature disputes are told in detail (K2-18 b, phosphine). OK, or leave them as one line?
9. **Kb link.** Section 4: new sets in `kb/` or the course's own data file?
10. **Daily and review.** Does the course get a daily "name the body" (style A, one per day) on the games screen, or only the review pile?

## 8. Effort estimate (stage 2 and later)

Per chapter: write 3 to 4 lessons (about 20 steps each with 8 to 12 questions) about 1.5 sessions, plus pictures and figure-checking 0.5 session; ten chapters at that rate is about 20 sessions of one agent. In stages:
- Stage 2 skeleton (door page, `astronomy-course.js` with chapter 1 and 2, the stage draws a body, a diagram or a picture, key `astronomy:course`, tests, full-screen and themes): 2 to 3 sessions.
- Chapters 3 to 9: about 1.5 sessions each, so 10 to 11.
- Chapter 10 (history, region test, licences): 3 sessions, the hardest to source.
- Chapters 11 and 12: 2 to 3 sessions.
- Images (bundle, licence lines, offline list): 1 to 2 sessions. Review by Korbi at the end of each stage.
Total about 18 to 22 agent sessions; the first playable course (chapters 1 to 4) at about 7.
The biggest risks: (a) the volume of figures to verify, (b) chapter 10's sourcing, (c) the pictures question, (d) writing question options as long and plausible as the right answer for numbers (style B).
