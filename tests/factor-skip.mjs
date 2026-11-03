// Factor's "Skip trades" (factor-skip.js): the button declines every offer now and until the turn comes round to the seat
// that pressed it, then ends by itself; the menu's setting declines for the whole game; a new game and the end of a game
// clear the button; played through the engine, every offer to a skipping seat is answered no and the game goes on.
import { rules } from "../factor-rules.js";
import { startSkip, settle, declines, asked } from "../factor-skip.js";
import { newRecord, applyMove, botMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const G = { seq: 4 };

{
  const skip = startSkip(G);
  check(startSkip(null) === null && skip.seq === 4, "pressing it keeps the game it was pressed in");
  check(settle(skip, G, { turn: 1, step: "main" }, 0) === skip && settle(skip, G, { turn: 3, step: "roll" }, 0) === skip, "it stands while another seat's turn goes on");
  check(settle(skip, G, { turn: 0, step: "roll" }, 0) === null, "it ends when the turn reaches the seat that pressed it");
  check(settle(skip, { seq: 5 }, { turn: 1, step: "main" }, 0) === null, "a new game starts without it");
  check(settle(skip, G, { turn: 1, step: "over" }, 0) === null, "…and so does the end of a game");
  check(settle(null, G, { turn: 1, step: "main" }, 0) === null && settle(skip, G, { turn: 1, step: "main" }, null) === null, "no skip, or a watcher: nothing");
  // the page keeps what settle returns: once ended it is gone, not asleep until the next round
  let kept = skip;
  for (const turn of [1, 2, 0, 1, 2, 3]) kept = settle(kept, G, { turn, step: "main" }, 0);
  check(kept === null, "once the turn has come round it does not come back the round after");
  check(declines({ autoDecline: false }, skip, G, { turn: 1, step: "offer" }, 0) && !declines({ autoDecline: false }, null, G, { turn: 1, step: "offer" }, 0), "the button declines; without it, nothing is");
  check(declines({ autoDecline: true }, null, G, { turn: 1, step: "offer" }, 0) && declines({ autoDecline: true }, null, G, { turn: 3, step: "main" }, 0), "the menu's setting declines for the whole game, whatever the turn");
  check(!declines({ autoDecline: true }, null, G, { turn: 1 }, null), "a watching frame declines nothing: it writes nothing");
  check(asked({ step: "offer" }, 2, 2) && !asked({ step: "offer" }, 1, 2) && !asked({ step: "main" }, 2, 2) && !asked(null, 2, 2), "a seat is asked only in the offer step, when it is its answer");
}

// ---------- played: seat 0 skips, the others offer ----------
{
  let g = newRecord(rules, { seats: 4, seed: 12, now: 0 }), offers = 0, declined = 0, moves = 0, skip = null;
  while (!rules.over(g.state) && moves < 3000) {
    const s = g.state, seat = rules.toMove(s);
    if (s.step === "roll" && s.turn === 0) { skip = null; }          // the turn came round
    if (s.step === "offer" && s.offer.from !== 0 && seat === 0 && s.turnNo > 6) {
      if (!skip && offers % 4 === 0) skip = startSkip(g);
      skip = settle(skip, g, s, 0);
      offers++;
      if (declines({ autoDecline: false }, skip, g, s, 0)) {
        const r = applyMove(rules, g, 0, { t: "answer", yes: false }, 0);
        if (r.error) { check(false, `declining was refused: ${r.error}`); break; }
        g = r.G; declined++; moves++; continue;
      }
    }
    g = applyMove(rules, g, seat, botMove(rules, g, seat, "medium"), 0).G;
    moves++;
  }
  check(offers > 3 && declined > 0, `a played game put ${offers} offers to seat 0, which declined ${declined} unseen`);
  check(rules.over(g.state) || moves >= 3000, "the table is never held up by a seat that skips");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
