// The level gate (landfall-bots.js): every level is played by a careful bot, a sloppy one, a mis-identifier and a blind one, and
// a good level has the careful bot winning mostly, the blind one rarely and a clear gap to the sloppy one. The distribution of the
// error at the end of each watch and the time a watch takes (the desk's actions are assumed seconds, the sky's wait is the
// engine's own clock) are recorded here; the real time per watch is Korbi's to judge on a phone.
import { LEVELS } from "../landfall-levels.js";
import { play, BOTS } from "../landfall-bots.js";
import { validate } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const SEEDS = 40, FEW = 20;
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

const R = {};                                   // R[level][bot] = { n, won, grounded, missed, stars, fix, lat, secs, wrongTaken, wrongAccepted }
let invalid = 0;
for (const L of LEVELS) {
  R[L.id] = {};
  for (const bot of Object.keys(BOTS)) {
    const r = { n: 0, won: 0, grounded: 0, missed: 0, stars: 0, fix: [], lat: [], secs: [], wrongTaken: 0, wrongAccepted: 0, rejected: 0 };
    for (let seed = 1; seed <= (bot === "confused" ? FEW : SEEDS); seed++) {
      const p = play(L.id, seed, bot), S = p.S;
      r.n++; r[S.end.kind === "arrived" ? "won" : S.end.kind]++; r.stars += S.end.stars;
      for (const w of p.watches) { r.fix.push(w.fixError); r.lat.push(w.latError); r.secs.push(w.seconds); }
      r.wrongTaken += p.wrongTaken; r.wrongAccepted += p.wrongAccepted; r.rejected += p.rejected;
      if (validate(S).length) invalid++;
    }
    R[L.id][bot] = r;
  }
}
const rate = (L, b) => R[L][b].won / R[L][b].n;
const total = b => { const rs = LEVELS.map(L => R[L.id][b]); return rs.reduce((t, r) => t + r.won, 0) / rs.reduce((t, r) => t + r.n, 0); };

for (const L of LEVELS) {
  const row = b => { const r = R[L.id][b]; return `${b} ${String(Math.round(100 * r.won / r.n)).padStart(3)}%`; };
  const c = R[L.id].careful;
  console.log(`     ${L.name.padEnd(26)} wins: ${row("careful")}, ${row("confused")}, ${row("sloppy")}, ${row("blind")} | careful: ${(c.stars / Math.max(1, c.won)).toFixed(1)} stars, aground ${c.grounded}, missed ${c.missed} | error at a watch's end p50/p90 ${pct(c.fix, .5).toFixed(1)}/${pct(c.fix, .9).toFixed(1)} nm (north-south ${pct(c.lat, .5).toFixed(1)}/${pct(c.lat, .9).toFixed(1)}) | ${pct(c.secs, .5).toFixed(0)} s a watch`);
}
check(invalid === 0, "every bot's voyage keeps the engine's invariants");
check(LEVELS.every(L => rate(L.id, "careful") >= 0.65), `the careful bot wins every level more often than not (${LEVELS.map(L => Math.round(100 * rate(L.id, "careful"))).join(", ")}%)`);
check(total("careful") >= 0.8, `...and usually: ${(100 * total("careful")).toFixed(0)}% over all levels`);
check(total("blind") <= 0.45, `the blind bot rarely: ${(100 * total("blind")).toFixed(0)}% over all levels`);
check(LEVELS.every(L => rate(L.id, "blind") <= rate(L.id, "careful") - 0.15), "...and on every level it is at least fifteen points behind the careful bot");
check(total("careful") - total("sloppy") >= 0.15 && total("sloppy") - total("blind") >= 0.08, `the sloppy bot is in between with a clear gap each way: ${(100 * total("careful")).toFixed(0)} / ${(100 * total("sloppy")).toFixed(0)} / ${(100 * total("blind")).toFixed(0)}%`);
check(LEVELS.every(L => rate(L.id, "sloppy") <= rate(L.id, "careful") + 0.05), "no level rewards sloppiness");
check(rate("the-other-side", "blind") < rate("first-watch", "blind") - 0.2 && rate("the-compass-lies", "blind") < rate("first-watch", "blind") - 0.2, "the levels get harder: the blind bot does worse on the compass and autumn levels than on the first");
{
  const conf = LEVELS.reduce((t, L) => t + R[L.id].confused.won, 0) / LEVELS.reduce((t, L) => t + R[L.id].confused.n, 0);
  check(conf < total("careful") + 0.03 && conf > total("sloppy") - 0.1, `taking the wrong star a third of the time costs little, because the plot refuses it and the bot retakes (${(100 * conf).toFixed(0)}%)`);
  const taken = LEVELS.reduce((t, L) => t + R[L.id].confused.wrongTaken + R[L.id].sloppy.wrongTaken, 0), accepted = LEVELS.reduce((t, L) => t + R[L.id].confused.wrongAccepted + R[L.id].sloppy.wrongAccepted, 0);
  check(taken > 50 && accepted <= 0.03 * taken, `a wrong star is almost never plotted: ${accepted} of ${taken} (the gate)`);
}
{
  const lat = b => LEVELS.flatMap(L => R[L.id][b].lat), c = lat("careful"), bl = lat("blind");
  check(pct(c, .9) <= 3.5 && pct(bl, .5) >= 1.5 * pct(c, .5), `the sight pins the latitude: the careful bot is ${pct(c, .5).toFixed(1)} nm off north-south at the median (${pct(c, .9).toFixed(1)} at the 90th), the blind bot ${pct(bl, .5).toFixed(1)} (${pct(bl, .9).toFixed(1)})`);
  const secs = LEVELS.flatMap(L => R[L.id].careful.secs);
  check(pct(secs, .5) >= 120 && pct(secs, .5) <= 240 && pct(secs, .9) <= 300, `a careful watch takes ${pct(secs, .5).toFixed(0)} s at the median and ${pct(secs, .9).toFixed(0)} s at the 90th: inside the two to four minutes the design asks for (assumed desk times)`);
  const three = LEVELS.reduce((t, L) => t + R[L.id].careful.stars, 0) / LEVELS.reduce((t, L) => t + R[L.id].careful.won, 0);
  check(three > 2.0 && three < 2.9, `careful arrivals average ${three.toFixed(2)} stars: three is possible and not automatic`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-bots: every level is winnable by care and not by luck");
