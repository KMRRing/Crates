// The level gate (landfall-bots.js): every level is played by a careful bot, a sloppy one, a mis-identifier and a blind one, and
// a good level has the careful bot winning mostly, the blind one rarely and a clear gap to the sloppy one. The distribution of the
// error at the end of each watch and the time a watch takes (the desk's actions are assumed seconds, the sky's wait is the
// engine's own clock) are recorded here; the real time per watch is Korbi's to judge on a phone.
import { LEVELS as ALL } from "../landfall-levels.js";
// sections 10 on (the lead, the lights, the land, cloud, birds, Kelvin's machine) have their own gate, tests/landfall-bots-sea.mjs:
// together they run too long for one quick test
const LEVELS = ALL.filter(L => L.section <= 9);
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
    const r = { n: 0, won: 0, grounded: 0, missed: 0, stars: 0, fix: [], lat: [], secs: [], noonLon: [], noonSecs: [], wrongTaken: 0, wrongAccepted: 0, rejected: 0 };
    if (bot === "nightowl" && L.section !== 2) continue;                       // it only matters where there is a sun to leave alone
    if (bot === "confused" && L.section > 2) continue;                          // any star may be taken on a later level: there is no star to mistake
    for (let seed = 1; seed <= (bot === "confused" || bot === "nightowl" ? FEW : L.section > 2 ? 24 : SEEDS); seed++) {
      const p = play(L.id, seed, bot), S = p.S;
      r.n++; r[S.end.kind === "arrived" ? "won" : S.end.kind]++; r.stars += S.end.stars;
      for (const w of p.watches) { r.fix.push(w.fixError); r.lat.push(w.latError); r.secs.push(w.seconds); if (w.kind === "noon") { r.noonLon.push(w.lonError); r.noonSecs.push(w.seconds); } }
      r.wrongTaken += p.wrongTaken; r.wrongAccepted += p.wrongAccepted; r.rejected += p.rejected;
      if (validate(S).length) invalid++;
    }
    R[L.id][bot] = r;
  }
}
const OLD = LEVELS.filter(L => L.section <= 2), NEWER = LEVELS.filter(L => L.section > 2);          // the pole star and the sun; any star
const rate = (L, b) => R[L][b].won / R[L][b].n;
const DAY = OLD.filter(L => L.section === 2), NIGHT = OLD.filter(L => L.section === 1);
const mean = (ls, b) => ls.reduce((t, L) => t + rate(L.id, b), 0) / ls.length;
const total = b => { const rs = OLD.filter(L => R[L.id][b]).map(L => R[L.id][b]); return rs.reduce((t, r) => t + r.won, 0) / rs.reduce((t, r) => t + r.n, 0); };

for (const L of LEVELS) {
  const row = b => { const r = R[L.id][b]; if (!r) return `${b}   -`; return `${b} ${String(Math.round(100 * r.won / r.n)).padStart(3)}%`; };
  const c = R[L.id].careful;
  console.log(`     ${L.name.padEnd(26)} wins: ${row("careful")}, ${row("confused")}, ${row("sloppy")}, ${row("blind")}${R[L.id].nightowl ? `, ${row("nightowl")}` : ""} | careful: ${(c.stars / Math.max(1, c.won)).toFixed(1)} stars, aground ${c.grounded}, missed ${c.missed} | error at a watch's end p50/p90 ${pct(c.fix, .5).toFixed(1)}/${pct(c.fix, .9).toFixed(1)} nm (north-south ${pct(c.lat, .5).toFixed(1)}/${pct(c.lat, .9).toFixed(1)}) | ${pct(c.secs, .5).toFixed(0)} s a watch`);
}
check(invalid === 0, "every bot's voyage keeps the engine's invariants");
check(OLD.every(L => rate(L.id, "careful") >= 0.65), `the careful bot wins every level more often than not (${OLD.map(L => Math.round(100 * rate(L.id, "careful"))).join(", ")}%)`);
check(total("careful") >= 0.78, `...and usually: ${(100 * total("careful")).toFixed(0)}% over all levels`);
check(total("blind") <= 0.45, `the blind bot rarely: ${(100 * total("blind")).toFixed(0)}% over all levels`);
check(OLD.every(L => rate(L.id, "blind") <= rate(L.id, "careful") - 0.15), "...and on every level it is at least fifteen points behind the careful bot");
check(DAY.every(L => rate(L.id, "sloppy") <= rate(L.id, "careful") - 0.15), "...and so is the sloppy one on every level of the noon sun");
check(total("careful") - total("sloppy") >= 0.15 && total("sloppy") - total("blind") >= 0.08, `the sloppy bot is in between with a clear gap each way: ${(100 * total("careful")).toFixed(0)} / ${(100 * total("sloppy")).toFixed(0)} / ${(100 * total("blind")).toFixed(0)}%`);
check(OLD.every(L => rate(L.id, "sloppy") <= rate(L.id, "careful") + 0.05), "no level rewards sloppiness");
check(rate("the-other-side", "blind") < rate("first-watch", "blind") - 0.2 && rate("the-compass-lies", "blind") < rate("first-watch", "blind") - 0.2, "the levels get harder: the blind bot does worse on the compass and autumn levels than on the first");
{
  const conf = OLD.reduce((t, L) => t + R[L.id].confused.won, 0) / OLD.reduce((t, L) => t + R[L.id].confused.n, 0);
  check(conf < total("careful") + 0.03 && conf > total("sloppy") - 0.1, `taking the wrong star a third of the time costs little, because the plot refuses it and the bot retakes (${(100 * conf).toFixed(0)}%)`);
  const taken = OLD.reduce((t, L) => t + R[L.id].confused.wrongTaken + R[L.id].sloppy.wrongTaken, 0), accepted = OLD.reduce((t, L) => t + R[L.id].confused.wrongAccepted + R[L.id].sloppy.wrongAccepted, 0);
  check(taken > 50 && accepted <= 0.03 * taken, `a wrong star is almost never plotted: ${accepted} of ${taken} (the gate)`);
}
{
  const lat = b => OLD.flatMap(L => R[L.id][b].lat), c = lat("careful"), bl = lat("blind");
  check(pct(c, .9) <= 3.5 && pct(bl, .5) >= 1.5 * pct(c, .5), `the sight pins the latitude: the careful bot is ${pct(c, .5).toFixed(1)} nm off north-south at the median (${pct(c, .9).toFixed(1)} at the 90th), the blind bot ${pct(bl, .5).toFixed(1)} (${pct(bl, .9).toFixed(1)})`);
  const secs = OLD.flatMap(L => R[L.id].careful.secs);
  check(pct(secs, .5) >= 120 && pct(secs, .5) <= 240 && pct(secs, .9) <= 300, `a careful watch takes ${pct(secs, .5).toFixed(0)} s at the median and ${pct(secs, .9).toFixed(0)} s at the 90th: inside the two to four minutes the design asks for (assumed desk times)`);
  const three = OLD.reduce((t, L) => t + R[L.id].careful.stars, 0) / OLD.reduce((t, L) => t + R[L.id].careful.won, 0);
  check(three > 2.0 && three < 2.9, `careful arrivals average ${three.toFixed(2)} stars: three is possible and not automatic`);
}

{
  // the second section's point: a sun that is not taken leaves the longitude to the reckoning
  const lon = b => DAY.flatMap(L => R[L.id][b].noonLon), c = lon("careful"), n = lon("nightowl"), s = lon("sloppy");
  check(mean(DAY, "careful") - mean(DAY, "nightowl") >= 0.2, `by night alone is not enough: on the noon levels a careful bot that never takes the sun wins ${(100 * mean(DAY, "nightowl")).toFixed(0)}% against ${(100 * mean(DAY, "careful")).toFixed(0)}% for one that does`);
  check(pct(c, .5) <= 3 && pct(c, .9) <= 8 && pct(n, .5) >= 2 * pct(c, .5), `the sun and the clock pin the longitude: after a noon watch the careful bot is ${pct(c, .5).toFixed(1)} nm off east-west at the median (${pct(c, .9).toFixed(1)} at the 90th), the one that left the sun alone ${pct(n, .5).toFixed(1)} (${pct(n, .9).toFixed(1)}), the sloppy ${pct(s, .5).toFixed(1)} (${pct(s, .9).toFixed(1)})`);
  const secs = DAY.flatMap(L => R[L.id].careful.noonSecs);
  check(pct(secs, .5) >= 120 && pct(secs, .5) <= 240 && pct(secs, .9) <= 300, `a careful noon watch takes ${pct(secs, .5).toFixed(0)} s at the median and ${pct(secs, .9).toFixed(0)} s at the 90th (assumed desk times; the waits run at thirty minutes a second, the catch at the clock's pace)`);
  check(mean(DAY, "blind") < mean(NIGHT, "blind") && mean(DAY, "sloppy") < mean(NIGHT, "sloppy"), `the noon levels are harder to get through blind or careless than the night ones (${(100 * mean(DAY, "blind")).toFixed(0)} against ${(100 * mean(NIGHT, "blind")).toFixed(0)}% blind, ${(100 * mean(DAY, "sloppy")).toFixed(0)} against ${(100 * mean(NIGHT, "sloppy")).toFixed(0)}% sloppy)`);
}

{
  // sections 3 to 9: any star by the intercept, a clock to read, a light, a gale
  const lopWon = b => NEWER.reduce((t, L) => t + rate(L.id, b), 0) / NEWER.length;
  check(NEWER.every(L => rate(L.id, "careful") >= 0.65), `the careful bot wins every level of sections 3 to 9 more often than not (${NEWER.map(L => Math.round(100 * rate(L.id, "careful"))).join(", ")}%)`);
  check(NEWER.every(L => rate(L.id, "blind") <= rate(L.id, "careful") - 0.25), "...and the blind bot is at least a quarter behind on each");
  check(lopWon("careful") - lopWon("sloppy") >= 0.08, `the sloppy bot is behind the careful one over them: ${(100 * lopWon("careful")).toFixed(0)} / ${(100 * lopWon("sloppy")).toFixed(0)} / ${(100 * lopWon("blind")).toFixed(0)}%`);
  const fixes = NEWER.flatMap(L => R[L.id].careful.fix), blind = NEWER.flatMap(L => R[L.id].blind.fix);
  check(pct(fixes, .5) <= 4 && pct(blind, .5) >= 2 * pct(fixes, .5), `a fix every watch pins the ship: ${pct(fixes, .5).toFixed(1)} nm off at the median (${pct(fixes, .9).toFixed(1)} at the 90th) against ${pct(blind, .5).toFixed(1)} blind`);
  const secs = NEWER.flatMap(L => R[L.id].careful.secs);
  check(pct(secs, .5) >= 100 && pct(secs, .5) <= 300, `a careful watch of two stars takes ${pct(secs, .5).toFixed(0)} s at the median (assumed desk times)`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-bots: every level is winnable by care and not by luck");
