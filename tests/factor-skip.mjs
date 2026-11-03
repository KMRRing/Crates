// Factor's "Ignore trades" (factor-skip.js): the permanent switch (and the menu's "Decline trades automatically", the same
// `autoDecline`) declines every offer to the seat until it is switched off; played through the engine, every offer to an
// ignoring seat is answered no and the game goes on.
import { rules } from "../factor-rules.js";
import { declines, asked } from "../factor-skip.js";
import { newRecord, applyMove, botMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

{
  const on = { autoDecline: true }, off = { autoDecline: false };
  check(declines(on, { turn: 1, step: "offer" }, 0) && declines(on, { turn: 3, step: "main" }, 0) && declines(on, { turn: 0, step: "roll" }, 0), "switched on, it declines for the whole game, whatever the turn (it does not end when the turn comes round)");
  check(!declines(off, { turn: 1, step: "offer" }, 0), "switched off, nothing is declined");
  check(!declines(on, { turn: 1 }, null) && !declines(on, null, 0), "a watching frame (no seat) declines nothing: it writes nothing");
  check(asked({ step: "offer" }, 2, 2) && !asked({ step: "offer" }, 1, 2) && !asked({ step: "main" }, 2, 2) && !asked(null, 2, 2), "a seat is asked only in the offer step, when it is its answer");
}

// ---------- played: seat 0 ignores trades (on for the second half of the game), the others offer ----------
{
  let g = newRecord(rules, { seats: 4, seed: 12, now: 0 }), offers = 0, declined = 0, moves = 0;
  while (!rules.over(g.state) && moves < 3000) {
    const s = g.state, seat = rules.toMove(s);
    if (s.step === "offer" && s.offer.from !== 0 && seat === 0 && s.turnNo > 6) {
      offers++;
      if (declines({ autoDecline: true }, s, 0)) {
        const r = applyMove(rules, g, 0, { t: "answer", yes: false }, 0);
        if (r.error) { check(false, `declining was refused: ${r.error}`); break; }
        g = r.G; declined++; moves++; continue;
      }
    }
    g = applyMove(rules, g, seat, botMove(rules, g, seat, "medium"), 0).G;
    moves++;
  }
  check(offers > 3 && declined === offers, `a played game put ${offers} offers to seat 0, which declined all ${declined} unseen`);
  check(rules.over(g.state) || moves >= 3000, "the table is never held up by a seat that skips");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
