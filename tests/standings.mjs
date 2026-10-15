// A table's standings (standings.js): the best first, equal values sharing a rank, a game scored lower ranked the
// other way, and amounts signed as the rows show them.
import { rank, signed } from "../standings.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const rows = [{ name: "A", value: 300 }, { name: "B", value: 450 }, { name: "C", value: 300 }, { name: "D", value: -20 }];
const r = rank(rows);
check(r.map(x => `${x.name}${x.rank}`).join(" ") === "B1 A2 C2 D4", "best first; equal values share a rank, the next one skipping it");
check(rank(rows, { lower: true }).map(x => `${x.name}${x.rank}`).join(" ") === "D1 A2 C2 B4", "lower first, for a game scored that way");
check(rank([{ name: "A", value: "12" }, { name: "B", value: null }]).map(x => x.name).join() === "A,B", "values read as numbers, a missing one as nothing");
check(rank(rows, { value: x => x.name.charCodeAt(0) })[0].name === "D", "ranked by what value() says");
check(signed(120) === "+120" && signed(-35) === "−35" && signed(0) === "±0" && signed(1234.5, x => x.toFixed(1)) === "+1234.5", "amounts signed: plus, a true minus, and ±0");

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
