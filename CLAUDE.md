# Working on Crates

Almanac: a suite of web games, opening on the screen of games (`index.html`, `home.js`; Crates is at `crates.html`) (Crates, Slate, Delta, Punt, Cartel, Spot, Quote, Manifest, Chart, Survey, Pipes, Rush, Deck,
Parley, Blend, Refinery, Brut, Stow, Hong, Tribute), plain HTML, CSS and JavaScript modules with no build step for the games themselves.
Every push to `main` is tested by `.github/workflows/pages.yml`; GitHub Pages serves `main` at
https://kmrring.github.io/Crates/, and installed copies (his phone) move to it only when the workflow publishes
`sw.js`, which it does only when every test passes.
README.md describes every game and every decision; read the section of the game you work on first.

The owner, Korbi, never uses a command line: do the git work yourself, and make anything he needs work from the app.

## Several Claudes at once

1. **Stay in one app.** A game is its `<game>.html`, `.js` and `.css`, its own engine and data files, and
   `tests/<game>.mjs`. Change only those, and only that game's section of README.md.
2. **Shared files are one Claude at a time.** Before starting on any of these, the owner should know, so nobody else
   is in them: `style.css`, `apps.js`, `pwa.js`, `suite.js`, `pile.js`, `deck.*`, `core.js`, `rooms.js`, `together.js`,
   `rich.js`, `pics.js`, `wide.js`, `tools/`, `.github/`, `kb/` and every bank built from it (`bank.js`, `chart-bank.js`,
   `chart-geo.js`, `quote-bank.js`, `kb-index.js`, and Punt's `art`, `cities`, `flags`, `eco`, `phy`, `chm`, `cs`,
   `phil`, `rel`, `refining` banks), and this file.
3. **Pull before you push:** `git pull --rebase`. Never force-push, never rewrite `main`'s history: that is how one
   Claude silently deletes another's work.
4. **Never commit `sw.js`.** It lists every file for offline play with a version from their contents, so every
   change would touch it; the workflow writes it after the tests pass and commits it as github-actions[bot] (pull
   before your next push). `node tools/build-sw.mjs` writes nothing locally; `--local` writes one to try offline play,
   which you then don't commit.
5. **Built files are rebuilt, not merged.** If a rebase conflicts in a bank built from `kb/`, settle `kb/` and run
   `node tools/build-kb.mjs`.
6. **Test before pushing:** `node tests/<game>.mjs` for what you touched, all of `tests/*.mjs` if you touched a shared
   file. The workflow runs them all; if one fails, `sw.js` isn't published and installed copies stay on the last good
   version (a fresh visit to the site still gets the new files, so don't leave it broken).
7. **After pushing, check the run went green** (Actions on GitHub) and that the bot committed `sw.js` when you changed
   a game file; installed copies update a minute or two later.

## Knowledge lives in kb/

`kb/` is the one source for Crates, Punt's knowledge levels, Quote and Chart (README: "The knowledge base"). Edit
`kb/`, run `node tools/build-kb.mjs`, never edit a built bank; `tests/kb.mjs` must pass. Edited one anyway? `node tools/adopt-banks.mjs` brings the edits into `kb/` and checks the rebuild is byte-identical; rebuilding without it undoes them.

- **Entities** have sets (what they are: country, commodity, city, painting…) and facts (position, note, year…).
- **Links** say why two things connect. A clue link is one of Crates' pairs: the hand-written hint (the "because"), its
  aspects (the topics Crates' settings weight: they belong to the link, not the thing), difficulty, the other answers
  it fits, its position. Typed links: in, painted-by, hangs-in, movement.
- **Crates is append-only:** shared board codes point at answer and clue positions (`crates`, `pos`). New answers and
  new clues go at the end; nothing is reordered or removed.
- **The build writes questions** for a painting (Punt's who, where, movement; Quote's year) and a pin for a museum, when
  kb/ has the facts and no hand-written ones exist: to add a painting, add the entity and its three links, nothing else.
  Its `note` is told with the answers. A movement option must be wrong: mark a movement `within` its parent (Rococo
  in the Baroque) and a painting `notWith` a movement it could fairly be said to be (View of Toledo: Baroque).
- **Items** (Chart's pins, Quote's estimates, Punt's choices) point at the entities they're about; misses carry those
  entities into the pile, and the other games' learning modes deal questions about them.
- **Kinds:** a clue thing's kind (`kind:person`, `kind:food`…) is either set by hand or given by `tools/kb-kinds.mjs`
  from its hints (marked `kindBy: "words"`); a kind by hand always stands. Settling one from `kb/KINDS.md`: add the
  set and drop `kindBy`.
- `kb/MIGRATION.md` and `kb/KINDS.md` list what still needs a person: words that may be two things under one name,
  facts two sources gave differently, places whose country names no country, clue things whose kind is open.

## How the owner wants things

- **The page never scrolls.** Every game fits the screen from 390×600 up; anything long scrolls inside its own box
  (dialogs may scroll). Use `style.css`'s frame: `#app.fit-screen`, `.fit-col`, `.fit-grow`, `.fit-box`, `.fit-scroll`.
  Nothing should change size mid-game.
- **Look before you push** a visible change: a browser at 390×664 and 390×844 (Playwright works in the container),
  and on an iPad both ways, 820×1180 and 1180×820 (README, Bigger screens).
- **Clean code as you go**, don't just flag it; comments say why, not what.
- **Write the README** for every change: plain prose, what it does and why, in the game's section.
- He's a biofuels trader and wants expert, terse engagement; define a technical term the first time you use it.

## Bigger screens

A phone held upright is the design, and must look exactly as it did; a tablet draws it larger, and a screen held
sideways puts a game's parts beside its board (README, "Bigger screens"; `style.css`).
- **Sizes in rem**, not px, for anything that should grow: a tablet grows the root's font size. n px is n/16 rem, the
  same on a phone. Borders, radii, strokes and shadows stay px, and so does text in an SVG drawn to a viewBox.
  `tests/wide.mjs` fails on a px size of 3 or more.
- **Sideways** is `@media (orientation: landscape) and (min-width: 700px)`, exactly (`SIDEWAYS` in `wide.js`, which
  `tests/wide.mjs` checks every stylesheet against). Give `#app` the class `beside` (header across, the board's column
  and a side column `--beside` wide) and place your parts in it in your own stylesheet; or `wide`, the whole width, for
  a card that divides itself. A half that's only a box sideways is a `.fit-half` (on a phone it isn't a box at all).
  Buttons low in the side column, boxes to type in high (a tablet's keyboard covers the bottom).
- **Sizes in script** multiply by `scale()` from `wide.js`; ask `sideways()` for which layout is showing, and redraw on
  `resize` (the screen turns).

## The look

Brass instruments on an almanac's page (README, "The look"). Build every screen from `style.css`'s tokens: `--yard`
(the page), `--sheet` (cards, dialogs), `--tile`/`--tile-edge`, `--ink`, `--ink-soft`, `--brass` (lines, frames, scales),
`--rule` (hairlines), `--plate`/`--plate-ink` (a primary action: navy lettered in gilt by day, brass lettered in navy by
night), the enamels `--c0`..`--c3`, `--learn`. A game's own accent is one enamel, `--<game>-in`, with its soft fill
`color-mix(in srgb, var(--<game>-in) 15%, var(--sheet))`; good and bad are verdigris `#2F7D5B`/`#7FC2A8` and oxblood
`#A8382B`/`#E8806F`. No cool greys, no pills: corners are square-ish (4–6px), the main action is the plate, names of
things are wide spaced capitals (`font-stretch: var(--wide); text-transform: uppercase; letter-spacing: .08em+`).
**Loading:** `busy(label)` from `loading.js` for any wait that holds up the screen (the rete, large, mid-screen);
`sextant()` before the words of a short wait in a line or a box. Never a spinner of your own, never "Loading…" alone.

## Saved state syncs

`suite.js` syncs every `localStorage` key between devices on the same solo code (except `suite:`, Crates' run keys and
Firebase's own). Keep a game's keys under its own prefix (`manifest:run2`, `quote:best`): a change from another device
to the open game's keys reloads it. A game's best goes in `<game>:best` (a number, a `{ score }`, or bests by level) to
show on the games screen. The same prefix is what a partner watches: everything a game shows must be in its own keys
(`<game>:…`; a game keeping keys under another prefix lists it in `PREFIXES` in `suite.js`, as Slate's `glyph:` and
Blend's `blend2:`), written as it changes and read at start-up, or the watcher's frame draws a screen of its own
(Calibre's design, Rush's position, Parley's card and Pipes' board were once kept only in memory). A watching frame
(`IN_FRAME` from `suite.js`) reads the partner's copy and its writes go nowhere, so don't keep state that matters
anywhere else, and don't end or restart a run on `visibilitychange` there.

## Offline

Every page must open with no connection, from the home screen too. `sw.js` keeps whatever the pages load:
`tools/offline.mjs` finds it by reading them (scripts, styles, imports, workers, fetches, any string naming one of
the app's files), wherever it lives, `kb/` included (Origin, Arb, Lexicon and Order once imported `kb/` files the list
left out, and never opened offline). A load whose path is built as the code runs (a template with `${}`, a variable)
can't be followed: make sure what it loads is kept (`offlineFiles` in `tools/offline.mjs`), then add it to `RUNTIME`
in `tests/offline.mjs`, which fails until you do. The service worker's logic is `tools/service-worker.js`.

## Dailies

- **One day for every game:** `today()` from `suite.js` (the UTC date, YYYYMMDD, `days.js`). Never count days yourself:
  Origin, Order and Arb once used the phone's own clock and their dailies never reached the games screen
  (`tests/days.mjs` fails on a day of a game's own).
- **Count a daily the moment its result is final** (the solve, the last answer settling), not when its summary opens:
  leaving after the last answer must not lose the day. Record it where the games screen reads it (`markOf` in
  `suite.js`): `noteComparable`, `noteDayTime`, or `<game>:daily` by the day.
- **The tile opens today's** while it's still to play (`#today`): a game with a daily takes it with
  `arrivedForToday()` at start-up and opens today's, asking before it leaves a run you've started.

## Playing together

Players pair once on the games screen; a duo match is the game opened with `?room=CODE` (the pair's room), which the
partner sheet and the request banner do. Don't add room setup (start, join, share a code) to a game's menu: a game
only joins the room in its address, and offers "Back to solo" while in it. A request's yes adds `&new=` (its time):
`together.js` then deals a new table, and seats belong to players, not devices (`sitDown` in `rooms.js`). Don't run
the solo game while a room in the address is being joined (Hong, Tribute: `busy` until the room's state is drawn).
A game that gets a duo match goes in `DUO_GAMES` in `suite.js`. A finished duo match is recorded for the pair: on `together.js`,
give `createTogether` a `result(state)` returning `{ match, score, won, coop, lower }` once the match is over; otherwise
call `reportDuo(game, match, { score, won, coop, lower })` from `suite.js` on each player's device.

## Header dropdowns

A game's header `<select class="pool">` is shown as the suite's dropdown: link `dropdown.css`, give the select
`data-accent` (its logo prefix: cr, sl, d, pt, bl, br, pa, rf, ru, sv…) and call `dropdown(select)` from `dropdown.js`
once. The select stays the one place the choice lives; its options, value and events work as before.

## Menus

Every game's menu is the same popup (`menu.js`, loaded by every page): a sheet from the bottom on a phone, a card on
a wide screen, an × at the top right, a tap outside closes it. Fill `#menuBody` as before, but:
- **Build with `menu.js`'s controls:** `part(body, name)` for each part, `choice(label, [[value, text]…], value, onChange)` for one of several (a segmented row when it's three short options or fewer, else a grid under the label), `ticks(label, options, values, onChange, max)` for some of several, `mirror(label, select)` for a header select, `toggle(label, on, onChange)` for on or off, `action(text, fn, "primary" | "" | "link")` for buttons (the menu closes, then fn runs), `line(text)` for a status line. Every game's menu is built this way now; follow one (Quote's is the fullest).
- **Mark the parts** (`part(body, name)` from `menu.js`, or `data-part` on a container); they're laid out in this order
  under the same small heading: `play` (new run, where you are: no heading), `content` (daily or random, difficulty or
  level, topics, chapters), `together` (only what's specific to this game's duo match: pairing, watching and asking
  live on the games screen), `settings` (learning mode, length, the game's own options), `about` (stats, sources).
- **Content choices come in four kinds** and should look the same in every game: one of (a dropdown or segmented
  control), include (tick boxes with All/None), mix (Off/Less/Normal/More, Crates' topics), progression (chapters in
  order: done, current, locked, with Continue).
- **No instructions in the menu.** A line longer than about two sentences is folded into a closed "How it works" at
  the bottom by `menu.js`; better still, cut it. Keep a menu to choices, buttons and a short status line.

## Themes

Three themes (Almanac, Modern, Kontor), each day and night, set by `theme.js` on `<html data-theme data-mode>`.
- Write styles that follow them: colours from the variables (`--yard`, `--ink`, `--sheet`, `--tile`, `--brass`,
  `--plate`…), never fixed hex for the page, panels or buttons (a game's own board colours are fine); spaced capitals
  as `text-transform: var(--caps); letter-spacing: calc(.1em * var(--track))`, wide lettering as `var(--wide)`.
- Dark rules go in `@media (prefers-color-scheme: dark) { html:not([data-mode="day"]) … }` plus a copy under
  `html[data-mode="night"] …` (every stylesheet is written that way now).
- Almanac's ornaments (ticks, inset frames, gilt) are Almanac's: if you add one, undo it for Modern and Kontor in
  `themes.css`. A new game needs a Modern logo and a Kontor icon in `apps.js` (else it shows Almanac's).
- Check a new screen in all three, day and night.

## Checking syntax

`node --check file.js` does NOT catch a syntax error in an ES module on Node 22 (it falls back quietly and exits 0).
Check with `node --experimental-default-type=module --check file.js`, or run `node tests/syntax.mjs`, which does that
for every script and runs in CI. A missing brace in solo.js once passed every test and stopped Crates at "Loading".

## The pause

A game stands still while its menu, rules or the games screen is open. A game with a clock, a countdown, an animation
that scores, or a computer that moves by itself must listen: `onPause(pause, resume)` from `menu.js` (resume gets the
milliseconds it stood, to move a start or deadline on), and not start its clock while `isPaused()`. Duo clocks don't stop.

## Writing questions

A right option must not give itself away: make every wrong option as long, as specific and as plausible as the right
one (a neighbouring idea, or the answer with one thing changed), and don't let the answer be the only option with a
formula or a number. Put the extra detail in the explanation (`x`), not the answer. `tests/banks.mjs` fails otherwise.
Banks built from the knowledge base (art, chm, cities, cs, eco, flags, phil, phy, refining, rel) are edited in
`kb/items/choice/<bank>.js`, then `node tools/build-kb.mjs`; maths, wine, words, reasoning and patterns are edited in place.

## Keeping the build fast

`tools/build-kb.mjs` runs in under a second; CI fails it after 30. Never scan `LINKS` or `ENTITIES` inside a loop or a
sort comparator: index what you need once (a Map by id, or by id and relation) and look it up. One such scan in the
architecture section once made the build take two minutes, and every push's pipeline five.
