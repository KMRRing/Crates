# Go
Go against a KataGo network (our own search and WebAssembly arithmetic, in a worker), or two on one phone. Boards 9, 13, 19; Chinese area scoring, komi 7.5 (the engine still plays a handicap of 2 to 9, with a half point, but the menu offers none), positional superko. After two passes the net marks the stones it thinks are dead and you correct them. Pages: `go.html`, `go.js`; rules `go-rules.js`; net `go-net.js` + `vendor/go/go-nn.wasm`; search `go-search.js`; levels `go-levels.js`.

## Rulings
- 3 November 2026 (Korbi, 23:48): "yep go" to building Go with KataGo as the opponent; and (22:22, on Chess's engine) "yea we go for the weaker one": a smaller, licence-clean opponent beats a stronger unlicensed one.
- 4 November 2026 (Korbi): "add 3d mode to go". An optional 3D board (`go-3d.js`): kaya goban in a warm room, slate and shell stones, drop with a click, captures lift off. The view is `go:view`, written only when he picks one; otherwise `defaultIs3D()` decides.
- 5 November 2026 (Korbi): lessons are "a 'lessons' tab accessible there same as any other lesson for these games". Menu, Learn (`go-course.js` on `course.js`, progress `go:course`); its last lesson plays 9x9 as Black against Novice and leaves the ramp alone. The course teaches Chinese area scoring, komi 7.5 and positional superko, as the engine plays.

## Licences (details in `vendor/go/NOTE.txt`)
- Net: g170 b6c96, KataGo's first run, public domain (CC0) per katagotraining.org's Neural Network License. Only g170 networks may be used here. A kata1 network needs its notice ("Copyright 2026 David J Wu (lightvector)", MIT) to travel with it; a zhizi network needs "Copyright (c) 2026 hzyhhzy & zhizigo.com"; other contributors' networks have no stated terms: never use them.
- KataGo's engine is MIT (`vendor/go/LICENSE-KataGo.txt`); none of its code is in the page. The About dialog (Menu, About the computer) carries the notice.

## Traps
- **Zero border**: every tensor in `go-nn.c` has two zero cells round the board, and only the inside is written. A scratch tensor must keep one channel count for good (a different stride moves the border onto old data), and short vectors for the module go to the fixed `scratch`, never into memory a tensor may later take. Either mistake made a read depend on the reads before it (`tests/go-net.mjs` checks).
- **A drag in 3D never plays a stone**: it turns the view (`marks: () => false`), so the Move switch of Moor is Slide here (a one-finger drag pans instead of turns). Two taps beside the board reset the view; a double tap on it is the confirm tap. Only checked in Chromium (SwiftShader).
- The course's ladder and net claims (`tests/go-course.mjs`) search with a runner that may only extend or pass: they prove the lesson's lines, not that no clever defence exists. Keep a ladder or net position to the verified shape.
- Levels are looks (visits), not clocks; 19x19 gets half, 13x13 three quarters. They are not calibrated to human ranks: in 4-game matches on 9x9 each level beat the one below about 3 games in 4 (Novice < Casual < Club < Keen < Strong), nothing more is known.
- Ladder (planes 14 to 17) and pass-alive area (18, 19) inputs are zero, so the net reads ladders and settled groups less well than KataGo proper.
- Dead stones are proposed from the net's ownership (a group is dead if most of its stones lie where the net sees the other side owning): it can be wrong; the player's marks are final.
- The computer resigns after three reads under 3% win rate, well into the game; it passes only if a pass is its best move or you passed.

**4 November 2026, Korbi: the menu is the minimum it needs to be.** The menu is Board (9, 13, 19), You play (Black, White, Two on this phone) and Play in 2D or 3D. The computer's strength, Handicap, Tap twice to play a stone, Click of stones and Show who is ahead are gone: the strength is the hidden ramp (`go:ramp` over the six levels, up a step after a win, down after a loss; its first step is the level that was saved), no handicap, a second tap on the same point plays it, the stones click, no estimate line. Board stays: it is the game's own size, not a level.
