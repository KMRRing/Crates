// Carrack on the seats.js runner: every seat sets its orders at once, so the computer players must not wait for a slow
// person (rules.toMoveAll, seats.js). Solo: you in seat 0, three computer players; they set theirs while you think, the
// round resolves when you send yours, and the next round's orders are not set for them in the same change.
import { localTable, createRunner } from "../seats.js";
import { rules } from "../carrack-rules.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(pred, ms = 4000) { const end = Date.now() + ms; while (Date.now() < end) { if (pred()) return true; await sleep(5); } return pred(); }

const mem = { G: null, load() { return this.G; }, save(G) { this.G = JSON.parse(JSON.stringify(G)); } };
const solo = localTable(mem);
let last = null;
const r = createRunner({ rules, table: solo, level: () => "easy", pace: 5, botName: s => `Power ${s}`, onView: v => { last = v; } });
solo.onChange(() => r.update());
await r.deal({ powers: ["portugal", "hanse", "venice", "malacca"] }, 4);
check(last.state.pend.every(p => p === 0) && rules.toMoveAll(last.state).length === 4, "a new year: nobody has set orders, all four owe them");
await until(() => rules.toMoveAll(last.state).join() === "0");
check(rules.toMoveAll(last.state).join() === "0" && last.state.round === 1, "the computer players set their orders while the person hasn't: only seat 0 is left, and the year waits");
check(last.state.pend.slice(1).every(p => Array.isArray(p) && p.length >= 1), "their orders are kept as lists that are never empty");
const why = await r.move({ t: "orders", orders: [{ t: "pass" }] });
check(why === "" && last.state.round === 2 && last.state.hist.length === 1, "the person's orders are the last in: the year resolves");
await sleep(60);
check(last.state.round >= 2 && last.state.pend.slice(1).every(p => p === 0 || Array.isArray(p)), "the next year begins with the computer players setting theirs afresh, one year only");
check(last.state.round === 2, "the computer players did not carry the person's pass into a second year");
check(await r.move({ t: "orders", orders: [{ t: "move", from: 0, to: 0, n: 1 }] }) !== "", "an order the rules refuse is refused with a reason");

// a whole game with a person sending nothing but passes: the computer players never stall the years
{
  const mem2 = { G: null, load() { return this.G; }, save(G) { this.G = JSON.parse(JSON.stringify(G)); } };
  const t2 = localTable(mem2);
  let v2 = null;
  const r2 = createRunner({ rules, table: t2, level: () => "easy", pace: 5, botName: s => `Power ${s}`, onView: v => { v2 = v; } });
  t2.onChange(() => r2.update());
  await r2.deal({}, 3);
  const before = v2.state.round;
  for (let i = 0; i < 12 && !v2.over; i++) {
    await until(() => v2.over || v2.state.pend[0] === 0);
    if (!v2.over) await r2.move({ t: "orders", orders: [{ t: "pass" }] });
  }
  await until(() => v2.over, 4000);
  check(v2.over && v2.state.round >= before + 7 && v2.state.res?.order.length === 3, "a whole game: eight years of the computer players' orders, no stall, one result");
}
console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
