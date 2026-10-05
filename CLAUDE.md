# Working on Crates

A suite of web games (Crates, Slate, Delta, Punt, Cartel, Spot, Quote, Manifest, Chart, Survey, Pipes, Rush, Deck,
Parley, Blend, Refinery, Brut), plain HTML, CSS and JavaScript modules with no build step for the games themselves.
Every push to `main` goes live at https://kmrring.github.io/Crates/ (GitHub Pages, straight from the branch).
README.md describes every game and every decision; read the section of the game you work on first.

The owner, Korbi, never uses a command line: do the git work yourself, and make anything he needs work from the app.

## Several Claudes at once

1. **Stay in one app.** A game is its `<game>.html`, `.js` and `.css`, its own engine and data files, and
   `tests/<game>.mjs`. Change only those, and only that game's section of README.md.
2. **Shared files are one Claude at a time.** Before starting on any of these, the owner should know, so nobody else
   is in them: `style.css`, `apps.js`, `pwa.js`, `pile.js`, `deck.*`, `core.js`, `rooms.js`, `together.js`,
   `rich.js`, `pics.js`, `tools/`, `.github/`, `kb/` and every bank built from it (`bank.js`, `chart-bank.js`,
   `chart-geo.js`, `quote-bank.js`, and Punt's `art`, `cities`, `flags`, `eco`, `phy`, `chm`, `cs`, `phil`, `rel`,
   `refining` banks), and this file.
3. **Pull before you push:** `git pull --rebase`. Never force-push, never rewrite `main`'s history: that is how one
   Claude silently deletes another's work.
4. **`sw.js` is rebuilt, never merged.** It lists every file for offline play with a version from their contents,
   so every change touches it. After `git pull --rebase`, run `node tools/build-sw.mjs` and commit it with your
   change; if a rebase conflicts in `sw.js`, take either side and rebuild. (Once the deploy workflow waiting in
   `tools/ci/pages.yml` is live, the workflow builds `sw.js` and nobody commits it: that needs the GitHub token to
   have the Workflows and Pages permissions.)
5. **Built files are rebuilt, not merged.** If a rebase conflicts in a bank built from `kb/`, settle `kb/` and run
   `node tools/build-kb.mjs`.
6. **Test before pushing:** `node tests/<game>.mjs` for what you touched, all of `tests/*.mjs` if you touched a shared
   file. Nothing stops a failing push from going live yet, so this is the only gate.
7. **After pushing, check the Pages build** finished (the repo's Pages builds on GitHub); the site updates a minute or
   two later.

## Knowledge lives in kb/

`kb/` is the one source for Crates, Punt's knowledge levels, Quote and Chart (README: "The knowledge base"). Edit
`kb/`, run `node tools/build-kb.mjs`, never edit a built bank; `tests/kb.mjs` must pass.

- **Entities** have sets (what they are: country, commodity, city, painting…) and facts (position, note, year…).
- **Links** say why two things connect. A clue link is one of Crates' pairs: the hand-written hint (the "because"), its
  aspects (the topics Crates' settings weight: they belong to the link, not the thing), difficulty, the other answers
  it fits, its position. Typed links: in, painted-by, hangs-in, movement.
- **Crates is append-only:** shared board codes point at answer and clue positions (`crates`, `pos`). New answers and
  new clues go at the end; nothing is reordered or removed.
- **Items** (Chart's pins, Quote's estimates, Punt's choices) point at the entities they're about; misses carry those
  entities into the pile, and the other games' learning modes deal questions about them.
- `kb/MIGRATION.md` lists what still needs a person: words that may be two things under one name, facts two sources
  gave differently, places whose country names no country.

## How the owner wants things

- **The page never scrolls.** Every game fits the screen from 390×600 up; anything long scrolls inside its own box
  (dialogs may scroll). Use `style.css`'s frame: `#app.fit-screen`, `.fit-col`, `.fit-grow`, `.fit-box`, `.fit-scroll`.
  Nothing should change size mid-game.
- **Look before you push** a visible change: a browser at 390×664 and 390×844 (Playwright works in the container).
- **Clean code as you go**, don't just flag it; comments say why, not what.
- **Write the README** for every change: plain prose, what it does and why, in the game's section.
- He's a biofuels trader and wants expert, terse engagement; define a technical term the first time you use it.
