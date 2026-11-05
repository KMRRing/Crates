// Carrack's Expert player and coach: the expert's orders are ones the rules accept, in every round of games against Medium
// players, and fast; the coach's weighing names orders, puts the player's own among its options, calls a clearly poor set worse
// (with a reason) and a set it chose itself the same; the worker's door (`handle`) answers as the page's call does.
import { rules, resolveRound, checkOrders } from "../carrack-rules.js";
import { botOrders } from "../carrack-bot.js";
import { weigh, verdict, ordersWords, handle, GAP } from "../carrack-coach.js";
import { seeded } from "../seats.js";

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

// the coach
const w0 = rules.deal({ seats: 4, options: {}, rng: seeded(5) });
const none = weigh(w0, 0, null, { seed: 1 });
ok(none.best.length >= 1 && checkOrders(w0, 0, none.best) === "", "a hint is a set of orders the rules accept");
ok(ordersWords(w0, none.best).every(x => /^[A-Z]/.test(x) && x.length > 5), "orders come out in words");
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
