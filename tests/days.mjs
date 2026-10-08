// The suite's day (days.js): every daily is dealt and kept by the UTC date, records kept by a phone's own day (Origin,
// Order and Arb's, once) move to their dates, a day's best is found across its modes; and no game counts days on its
// own clock again, which is how Origin's and Order's dailies once went missing from the games screen.
import fs from "fs";
import { today, fromPhoneDay, movedToDates, bestOfDay } from "../days.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check(today(new Date(Date.UTC(2026, 9, 8, 10, 11))) === 20261008, "today is the UTC date as YYYYMMDD");
check(today(new Date(Date.UTC(2026, 9, 7, 23, 59))) === 20261007 && today(new Date(Date.UTC(2026, 9, 8, 0, 0))) === 20261008,
  "the day rolls over at midnight UTC, the same moment for everyone");
check(fromPhoneDay(20734) === 20261008 && fromPhoneDay(20733) === 20261007, "a phone's day 20734 was 8 October 2026");

check(same(movedToDates({ 20734: 340, 20733: 300 }), { 20261008: 340, 20261007: 300 }), "Origin's old days move to their dates");
check(same(movedToDates({ "20734/dates": 12, "20734/quantities": 9 }), { "20261008/dates": 12, "20261008/quantities": 9 }),
  "Order's old days move with their modes");
check(same(movedToDates({ 20261008: 200, 20734: 340 }), { 20261008: 340 }) && same(movedToDates({ 20734: 340, 20261008: 400 }), { 20261008: 400 }),
  "where a moved day meets one already there, the higher figure stays");
check(movedToDates({ 20261008: 3, "20261008/dates": 4 }) === null && movedToDates(null) === null && movedToDates({}) === null,
  "nothing to move: nothing written");

check(bestOfDay({ "20261008/dates": 12, "20261008/quantities": 9, "20261007/dates": 20 }, 20261008) === 12, "a day's best is the best of its modes");
check(bestOfDay({ 20261008: 340 }, 20261008) === 340 && bestOfDay({ 20261007: 300 }, 20261008) === null && bestOfDay(null, 20261008) === null,
  "a day kept whole is its own best; a day not played has none");

// no game counts its own days: the phone's clock (its time zone offset), or a today of its own
const root = new URL("..", import.meta.url).pathname;
const games = fs.readdirSync(root).filter(f => f.endsWith(".js") && f !== "days.js" && f !== "sw.js");
const own = games.filter(f => {
  const src = fs.readFileSync(root + f, "utf8");
  return /getTimezoneOffset\(\)[^\n]*864(?:00000|e5)/.test(src) || /^(?:export )?(?:const|let|function) today\b/m.test(src);
});
check(!own.length, `every game's day is the suite's (${own.length ? `its own in ${own.join(", ")}` : `${games.length} scripts`})`);

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("days: every daily goes by the suite's day");
