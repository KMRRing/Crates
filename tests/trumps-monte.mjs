// Monte zero (trumps-monte.js, Korbi 25 Nov 2026): the lab's Schafkopf engine plays legal moves, bids included, through whole
// hands of Codex's own game, from the state as the game keeps it (its log rebuilt from the bids and tricks); and it is what the
// worker answers for the "monte" level. Small searches here (the real ones are 256 deals a card and 1,024 a bid).
import { rules } from "../trumps-rules.js";
import { GAMES } from "../trumps-games.js";
import { monteMove, MONTE } from "../trumps-monte.js";
import { botMove, thinksAhead, MONTE_LEVEL } from "../trumps-bot.js";
import { seeded } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const S = GAMES.schafkopf, same = (a, b) => JSON.stringify(a) === JSON.stringify(b), t0 = Date.now();
let decisions = 0, illegal = 0, bids = 0;
for (let k = 0; k < 2; k++) {
  const rng = seeded(40 + k);
  let s = rules.deal({ options: { game: "schafkopf", deals: 2 }, rng });
  for (let n = 0; n < 200 && !rules.over(s); n++) {
    const who = rules.toMove(s);
    if (who == null) { s = rules.wake(s, { rng, now: 1e12 }); continue; }
    let m;
    if (who === k % 4 && (s.step === "bid" || s.step === "play")) {
      m = monteMove(s, who, { deals: 8, bidDeals: 8 });
      decisions++;
      if (s.step === "bid") bids++;
      const legal = s.step === "bid" ? S.bids(s, who).some(b => same(b, m)) : S.legal(s, who).includes(m.card);
      if (!legal) illegal++;
    } else m = rules.bot(s, who, { level: "easy", rng });
    s = rules.act(s, who, m, { rng, now: 1e12 });
    if (typeof s === "string") { check(false, `a move was refused: ${s}`); break; }
  }
}
check(decisions > 20 && bids > 0 && illegal === 0, `Monte zero's ${decisions} moves (${bids} bids) over two games of two hands are all legal`);
check(MONTE.deals === 256 && MONTE.bidDeals === 1024, "the real searches: 256 deals a card, 1,024 a bid (the lab's strongest arm)");
check(MONTE_LEVEL[0] === "monte" && MONTE_LEVEL[1] === "Monte zero" && thinksAhead("schafkopf", "monte") && !thinksAhead("jass", "monte"), "Schafkopf's level after Hard, worked out ahead in the worker");
{ const s = rules.deal({ options: { game: "schafkopf" }, rng: seeded(3) }), w = rules.toMove(s), m = botMove(s, w, "monte", seeded(4));
  check(S.bids(s, w).some(b => same(b, m)), "on the page, where the worker's move isn't in, the seat plays as Hard: a legal bid"); }
{ const { readFileSync } = await import("node:fs");
  check(/level === "monte"[^\n]*monteMove\(state, seat\)/.test(readFileSync(new URL("../trumps-worker.js", import.meta.url), "utf8")), "the worker answers the monte level with Monte zero"); }
console.log(`${Date.now() - t0} ms`);
process.exit(bad ? 1 : 0);
