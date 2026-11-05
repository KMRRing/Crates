// Carrack's Expert player and coach: the expert's orders are ones the rules accept, in every round of games against Medium
// players, and fast; the coach's weighing names orders, puts the player's own among its options, calls a clearly poor set worse
// (with a reason) and a set it chose itself the same; the worker's door (`handle`) answers as the page's call does.
import { rules, resolveRound, checkOrders } from "../carrack-rules.js";
import { botOrders } from "../carrack-bot.js";
import { weigh, verdict, ordersWords, handle, GAP } from "../carrack-coach.js";
import { seeded } from "../seats.js";
import { BOOK, bookOrders } from "../carrack-book.js";
import { POWERS } from "../carrack-rules.js";

let bad = 0;
const ok = (yes, what) => { console.log(`${yes ? "ok  " : "FAIL"} ${what}`); if (!yes) bad++; };

// a game of four, seat 0 the expert (a short budget, as a slow phone would give it), the rest Medium
const rng = seeded(21), bot = seeded(22);
const s = rules.deal({ seats: 4, options: {}, rng });
let legal = 0, rounds = 0, slowest = 0;
while (s.step !== "over") {
  const t = performance.now();
  const mine = botOrders(s, 0, { level: { level: "expert", budget: 120 }, rng: bot });
  slowest = Math.max(slowest, performance.now() - t);
  rounds++;
  if (checkOrders(s, 0, mine) === "") legal++;
  resolveRound(s, s.pw.map((_, k) => (k === 0 ? mine : botOrders(s, k, { level: "medium", rng: bot }))), rng);
}
ok(legal === rounds, `the expert's orders are legal in all ${rounds} rounds`);
ok(slowest < 1500, `the expert decides inside its budget (slowest ${Math.round(slowest)} ms)`);

// the opening book: every entry is a set of orders the rules accept in some game of that power (the first year's in a fresh
// deal; the second's after the first year's book entry or Medium's play, as tools/carrack-book.mjs searched it)
{
  const named = POWERS.every(p => Array.isArray(BOOK[p.id]) && BOOK[p.id].length === 2), legalIn = POWERS.map(() => [0, 0]);
  POWERS.forEach((p, pi) => {
    for (let sd = 1; sd <= 200 && !(legalIn[pi][0] && legalIn[pi][1]); sd++) {
      const g = rules.deal({ seats: 4, options: {}, rng: seeded(sd) }), seat = g.pw.indexOf(pi);
      if (seat < 0) continue;
      const b = bookOrders(g, seat), fits = b.length && checkOrders(g, seat, b) === "";
      if (!BOOK[p.id][0].length || fits) legalIn[pi][0] = 1;
      const r = seeded(sd + 99);
      resolveRound(g, g.pw.map((_, k) => (k === seat && fits ? b : botOrders(g, k, { level: "medium", rng: r }))), seeded(sd));
      const b2 = bookOrders(g, seat);
      if (!BOOK[p.id][1].length || (b2.length && checkOrders(g, seat, b2) === "")) legalIn[pi][1] = 1;
    }
  });
  ok(named, "the book has two years for each of the nine powers");
  ok(legalIn.every(([a, b]) => a && b), `each power's book orders are legal in a game (${legalIn.map(x => x.join("")).join(" ")})`);
}

// the coach
const w0 = rules.deal({ seats: 4, options: {}, rng: seeded(5) });
const none = weigh(w0, 0, null, { seed: 1 });
ok(none.best.length >= 1 && checkOrders(w0, 0, none.best) === "", "a hint is a set of orders the rules accept");
ok(ordersWords(w0, none.best).every(x => /^[A-Z]/.test(x) && x.length > 5), "orders come out in words");
const twice = [{ t: "move", from: 0, to: 1, n: 1 }, { t: "move", from: 0, to: 1, n: 1 }];
ok(ordersWords(w0, twice).length === 1 && /2 fleets/.test(ordersWords(w0, twice)[0]), "two single-fleet sails of one lane are listed once, as two fleets");
const again = weigh(w0, 0, none.best, { seed: 1 });
ok(again.same && again.margin < GAP && verdict(w0, 0, again).includes("same"), "the coach's own orders are the same as the coach's");
const pass = weigh(w0, 0, [{ t: "pass" }], { seed: 1 });
ok(!pass.same && pass.margin >= GAP && /^ends the year with/.test(pass.why), `passing the first year is called worse (${pass.margin.toFixed(1)} points, ${pass.why})`);
ok(verdict(w0, 0, pass).startsWith("The coach prefers"), "the check says what it would set");
ok(JSON.stringify(handle({ op: "weigh", state: w0, seat: 0, draft: [{ t: "pass" }], seed: 1 })) === JSON.stringify(pass), "the worker's door gives the same weighing");
const viaDoor = handle({ op: "bot", state: w0, seat: 0, seed: 3, tune: { budget: 100 } });
ok(Array.isArray(viaDoor) && checkOrders(w0, 0, viaDoor) === "", "the worker's door gives the bot's orders");

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
