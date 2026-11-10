# Working on Codex (this repo is Crates)

Plain HTML, CSS and JS modules, no build step. Live at https://kmrring.github.io/Crates/ (GitHub Pages serves `main`). Tests in `tests/` say what to fix when they fail; most rules below are enforced by one.

## Who and how
- Korbi (owner) never uses a command line: do the git work yourself and make everything work from the app. He's a biofuels trader: terse, expert, define a technical term the first time.
- A game is `<game>.html/.js/.css`, its engine and data files, and `tests/<game>.mjs`. On-screen names differ from file names (Gears=pipes, Mahjong=hong, Hanse=factor, Dujiang=nurikabe, Chess=gambit, Xiangqi=river, Guandan=tribute, Dou Dizhu=landlord, Nonet=sudoku, Tally=kakuro, Cull=hitori, Portolan=slitherlink, Jam=shunt); `apps.js` has the list. Name games by their official name unless it's a trademark; no falling-blocks game (Tetris).
- The per-game docs were deleted on 7 November 2026 (Korbi: "unless it's truly essential, remove it"). Old ones: `git show e2c62ef8:docs/<game>.md`. Korbi's rulings now live as dated comments in the code or test they govern: add one there, not a doc. `docs/licences-images-and-engines.md` stays (no GPL engines, public-domain images only).
- Clean code as you go; comments say why, not what.

## Several Claudes at once
- Stay in one game. Shared files need Korbi's OK first: `style.css`, `apps.js`, `pwa.js`, `suite.js`, `menu.js`, `pile.js`, `deck.*`, `core.js`, `rooms.js`, `together.js`, `rich.js`, `pics.js`, `wide.js`, `net.js`, `memdb.js`, `random*.js`, `lan*.js`, `tools/`, `.github/`, `kb/` and every bank built from it, and this file.
- `git pull --rebase` before pushing. Never force-push or rewrite `main`. Never commit `sw.js`: the workflow writes it after the tests pass (`--local` makes one to try offline play).
- Before pushing: `node tools/pick-tests.mjs --run $(git diff --name-only origin/main)`. Only tests under five seconds run unless Korbi says otherwise (`--slow`, `--all`); the whole suite runs nightly. Syntax: `node tests/syntax.mjs` (`node --check` misses module errors on Node 22).
- After pushing, check the Actions run is green and the bot committed `sw.js`; look at the last nightly run when you start. A red test means installed copies stay on the last good version.

## Standalone repos
- Gears, Jam (repo Shunt), Mahjong, Hanse, Dujiang, Lanterns and Landfall each live in `github.com/KMRRing/<name>` with their own Pages site: one game, copied unchanged from Crates, no games screen, no partner or second player, a minimal menu with a "Refresh game" line. Work there is cheaper (small context); this repo stays the master of shared files.
- `tools/standalone.mjs` (usage in its header) makes one (`out`), shows what changed on either side since the base commit in `.crates-base` (`status`), and merges chosen files back (`in`) or forward (`from`). Merge game files only, never menu code (`menu.js`, `games-find.js`, a game's menu function). Then test and push Crates, and `base` the repo. `tools/standalone-menu.patch` is the menu change.
- A session can push only to repos attached to it (`add_repo`).

## Screens
- The page never scrolls: fit 390×600 up with `#app.fit-screen`, `.fit-col`, `.fit-grow`, `.fit-box`, `.fit-scroll`; nothing changes size mid-game. Look at 390×664, 390×844 and iPad 820×1180 / 1180×820 before pushing a visible change.
- Sizes in rem (px only for borders, radii, strokes, SVG text); sideways is exactly `@media (orientation: landscape) and (min-width: 700px)` (`#app.beside`, `.fit-half`); script sizes use `scale()` / `sideways()` from `wide.js`. `tests/wide.mjs` checks.
- No `alert()`, `confirm()` or `prompt()` (Korbi: "feels budget"): use `sure()`, `typed()`, `notice()` from `sure.js`.
- Full screen: every page's `#app` is `full` (ambient: cards, boards, idle, pictures) or `full titled` (puzzles, quizzes, tools); menu mark top right; a thin status line is `full-pull`; list a new game in `tests/full-screen.mjs`.
- Look: only `style.css` tokens (`--yard`, `--sheet`, `--tile`, `--ink`, `--brass`, `--plate`, enamels `--c0`..`--c3`), square-ish corners, no pills, wide-spaced capitals for names. Themes are Codex (day/night) and Office (night only); dark rules go under both `prefers-color-scheme` and `data-mode="night"`; a new game needs an Office icon in `apps.js`.
- Waits use `busy()` / `progress()` / `waitMark()` from `loading.js`, never a spinner of your own. The mark and icons are generated (`tools/build-mark.mjs`); never edit them by hand.
- Menus use `menu.js` controls (`part`, `choice`, `ticks`, `toggle`, `action`, `line`; Quote's is the model). Parts in order: play, content, together, settings, about. Difficulty is the shared Easy / Medium / Hard row that `menu.js` adds for any page that asks `ramp()` (Korbi, 8 Nov 2026: a game's bots get all three levels, and the old "no difficulty picker" is retired; no picker of your own), no instructions, topics come from Settings' `topics.js`. A game with a clock or animation listens to `onPause`.

## State, days, modes
- Saved state is `localStorage` under the game's own prefix (`<game>:…`; a best in `<game>:best`); `suite.js` syncs keys between devices and a watching partner sees only those, so everything shown must be in them. A watching frame (`IN_FRAME`) writes nowhere.
- Dailies use `today()` from `suite.js`, never your own day count; count a daily the moment its result is final; the tile opens today's with `arrivedForToday()`.
- Random mode: a solo game calls `roundOver("<id>")` from `random.js` when a round's result is final and goes in `random-core.js`'s `ROUNDS` or `LEFT_OUT`.
- Offline: `sw.js` lists whatever the pages load, found by `tools/offline.mjs`; a path built at run time must be kept in `offlineFiles` there and in `RUNTIME` of `tests/offline.mjs`.

## Together
- Duo play is the game opened with `?room=CODE`; no room setup in a game's menu; a game with duo goes in `DUO_GAMES` in `suite.js` and reports through `createTogether`'s `result` or `reportDuo`. Games for a few seats run on `seats.js`; head-to-head on `duel.js`; tables (`table.js`) and parties (`party-core.js`, `ELSEWHERE`) as the tests in `tests/` show. The database drops empty arrays and objects, so state must survive `roundTrip` (`tests/rtdb.js`).

## Knowledge and questions
- `kb/` is the one source for Crates' pairs, Punt, Quote and Chart: edit `kb/`, run `node tools/build-kb.mjs` (under 30 s; index `LINKS`/`ENTITIES` once, never scan them in a loop), never edit a built bank (`node tools/adopt-banks.mjs` rescues an edit). Crates' answers and clues are append-only (shared board codes point at positions). `kb/MIGRATION.md` and `kb/KINDS.md` list what needs a person.
- Question banks: every wrong option as long, specific and plausible as the right one; extra detail goes in the explanation (`tests/banks.mjs`).
