# Start here

Codex: browser games, plain HTML/CSS/JS. Repos under github.com/KMRRing/: **Crates** (the whole suite, the master) and one small repo per game: gears, shunt, mahjong, hanse, dujiang, lanterns, landfall (own Pages site each).

1. Attach the repo you'll change (a session can push only to attached repos). If the change should reach the suite too, attach Crates.
2. Read `CLAUDE.md` in Crates (about 25 bullets). The small repos have no rules of their own: same code, copied.
3. Prefer working in the small repo (far less context). To carry game changes into Crates or back: `node tools/standalone.mjs status|in|from <dir>` (header of that file); never move menu code.
4. Run the quick tests, `git pull --rebase`, push, check Actions is green. Never commit `sw.js` in Crates.
5. Old per-game notes were deleted: `git show e2c62ef8:docs/<game>.md`.

My ask: <one task, one repo>
