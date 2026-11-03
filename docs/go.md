# Go
Go against a KataGo network (our own search and WebAssembly arithmetic, in a worker), or two on one phone. Boards 9, 13, 19; handicap 2 to 9; Chinese area scoring, komi 7.5 (a half point with a handicap), positional superko. After two passes the net marks the stones it thinks are dead and you correct them. Pages: `go.html`, `go.js`; rules `go-rules.js`; net `go-net.js` + `vendor/go/go-nn.wasm`; search `go-search.js`; levels `go-levels.js`.

## Rulings
- 3 November 2026 (Korbi, 23:48): "yep go" to building Go with KataGo as the opponent; and (22:22, on Chess's engine) "yea we go for the weaker one": a smaller, licence-clean opponent beats a stronger unlicensed one.

## Licences (details in `vendor/go/NOTE.txt`)
- Net: g170 b6c96, KataGo's first run, public domain (CC0) per katagotraining.org's Neural Network License. Only g170 networks may be used here. A kata1 network needs its notice ("Copyright 2026 David J Wu (lightvector)", MIT) to travel with it; a zhizi network needs "Copyright (c) 2026 hzyhhzy & zhizigo.com"; other contributors' networks have no stated terms: never use them.
- KataGo's engine is MIT (`vendor/go/LICENSE-KataGo.txt`); none of its code is in the page. The About dialog (Menu, About the computer) carries the notice.

## Traps
- **Zero border**: every tensor in `go-nn.c` has two zero cells round the board, and only the inside is written. A scratch tensor must keep one channel count for good (a different stride moves the border onto old data), and short vectors for the module go to the fixed `scratch`, never into memory a tensor may later take. Either mistake made a read depend on the reads before it (`tests/go-net.mjs` checks).
- Levels are looks (visits), not clocks; 19x19 gets half, 13x13 three quarters. They are not calibrated to human ranks: in 4-game matches on 9x9 each level beat the one below about 3 games in 4 (Novice < Casual < Club < Keen < Strong), nothing more is known.
- Ladder (planes 14 to 17) and pass-alive area (18, 19) inputs are zero, so the net reads ladders and settled groups less well than KataGo proper.
- Dead stones are proposed from the net's ownership (a group is dead if most of its stones lie where the net sees the other side owning): it can be wrong; the player's marks are final.
- The computer resigns after three reads under 3% win rate, well into the game; it passes only if a pass is its best move or you passed.
