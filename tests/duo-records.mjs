// The pair's duo records (duo-records.js): a team game's best, a head-to-head's wins each way, a game played both ways
// keeping both (Punt, Spot and Manifest, since October 2026: before, its first team match hid every head-to-head), and
// the words on the tile.
import { duoRecordsOf, duoLine } from "../duo-records.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const me = "korbi", them = "sarah";
const all = {
  punt: {
    m1: { [me]: { score: 1400, won: true, coop: false }, [them]: { score: 900, won: false, coop: false } },
    m2: { [me]: { score: 800, won: false, coop: false }, [them]: { score: 1200, won: true, coop: false } },
    m3: { [me]: { score: 1240, won: true, coop: true }, [them]: { score: 1240, won: true, coop: true } },
    m4: { [me]: { score: 1500, won: true, coop: false } },
  },
  delta: {
    a: { [me]: { score: 95, won: true, coop: true, lower: true } },
    b: { [them]: { score: 80, won: true, coop: true, lower: true } },
  },
  crates: {
    a: { [me]: { score: null, won: true, coop: true }, [them]: { score: null, won: true, coop: true } },
    b: { [me]: { score: null, won: false, coop: true } },
  },
  chart: { a: { [me]: { score: 30, won: null, coop: false }, [them]: { score: 30, won: null, coop: false } } },
  river: {},
};
const r = duoRecordsOf(all, me);

check(r.punt.n === 4 && r.punt.duels === 3 && r.punt.mine === 2 && r.punt.theirs === 1, "head-to-heads: the wins each way, a match counted once whoever reported it");
check(r.punt.teams === 1 && r.punt.best === 1240, "a game played both ways keeps its team matches too");
check(r.delta.teams === 2 && r.delta.lower && r.delta.best === 80 && r.delta.duels === 0, "a team game scored lower: its best is the least");
check(r.crates.best == null && r.crates.wins === 1 && r.crates.teams === 2, "a team game with no score: how many were won");
check(r.chart.duels === 1 && r.chart.mine === 0 && r.chart.theirs === 0, "a draw counts for neither");
check(r.river.n === 0 && duoLine(r.river) === "" && duoLine(undefined) === "", "no match yet: nothing on the tile");

check(duoLine(r.punt, n => n.toLocaleString("en-GB")) === "Duo 2–1 · team 1,240", "both ways: the wins, then the team's best");
check(duoLine(r.delta, (n, lower) => (lower ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` : String(n))) === "Duo 1:20", "a team's best time");
check(duoLine(r.crates) === "Duo 1/2", "boards cleared of those played");
check(duoLine(r.chart) === "Duo 0–0", "head to head only: the wins each way");
check(duoLine(duoRecordsOf(all, them).punt, String) === "Duo 1–2 · team 1240", "the other side sees the wins the other way round");

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
