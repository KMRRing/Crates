// Banquet (banquet-rules.js) on seats.js: 划拳's calls and what a hand may call (no 臭拳, a call it can't reach); a round
// (throws hidden until both are in, the one right while the other's wrong making the other drink, both or neither again,
// who throws first in turn); 十五二十 (only the caller calls, two right in a row make the other drink, a wrong call passes
// it); the game's end at the cups; the narrator's lines in Mandarin and Cantonese; the state through the database; the
// computer players (legal throws; the sharp one reading a player's habits); whole games.
import { rules, HUA, SHIWU, callsFor, SHOW_MS } from "../banquet-rules.js";
import { newRecord, applyMove, applyWake, botMove, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(HUA.length === 11 && HUA.every(c => c.zh && c.py && c.en) && HUA[2].zh === "哥俩好" && HUA[5].zh === "五魁首", "划拳's eleven calls, none to ten, each its verse, pinyin and sense");
check(Object.keys(SHIWU).join() === "0,5,10,15,20" && SHIWU[15].zh === "十五" && SHIWU[20].jp === "ji6 sap6", "十五二十's five calls in Cantonese");
check(callsFor("huaquan", 3).join() === "3,4,5,6,7,8" && callsFor("shiwu", 5).join() === "5,10,15", "a hand calls only what it can reach: its own count up to its own and the other's most");

const T = 1_000_000;
const move = (G, seat, m, now = T) => { const r = applyMove(rules, G, seat, m, now); if (r.error) throw new Error(r.error); return r.G; };
const wake = (G, now) => applyWake(rules, G, now) || G;
{
  let G = newRecord(rules, { seats: 2, options: { mode: "huaquan", limit: 3 }, seed: 7, now: T });
  const s = G.state, first = s.first;
  check(s.step === "throw" && rules.toMove(s) === first, "划拳 starts: one throws first");
  check(applyMove(rules, G, first, { t: "throw", hand: 2, call: 1 }).error && applyMove(rules, G, first, { t: "throw", hand: 2, call: 8 }).error, "臭拳 isn't allowed: a call below your own hand, or past what both can show");
  check(applyMove(rules, G, 1 - first, { t: "throw", hand: 2, call: 4 }).error, "the other throws second");
  G = move(G, first, { t: "throw", hand: 2, call: 5 });
  check(G.state.step === "throw" && rules.toMove(G.state) === 1 - first && G.state.throws[first], "the first throw is in, unseen");
  G = move(G, 1 - first, { t: "throw", hand: 3, call: 7 });
  check(G.state.step === "shown" && G.state.last.total === 5 && G.state.last.loser === 1 - first && G.state.cups[1 - first] === 1, "both in: five, the first called it, the other drinks");
  check(G.say.lang === "zh-CN" && G.say.text === "五魁首！七个巧！", "the calls said in Mandarin, as thrown");
  G = wake(G, T + SHOW_MS);
  check(G.state.step === "throw" && G.state.first === 1 - first && G.state.round === 2 && /drinks/.test(G.say.text), "then the next round, the other throwing first");
  G = move(G, 1 - first, { t: "throw", hand: 1, call: 3 });
  G = move(G, first, { t: "throw", hand: 2, call: 3 });
  check(G.state.last.loser === undefined && G.state.cups.join() === [0, 1].map(i => (i === 1 - first ? 1 : 0)).join(), "both right: nobody drinks");
  G = wake(G, T + 2 * SHOW_MS);
  check(/Both right/.test(G.say.text), "and it's said");
  const st = roundTrip(G.state), back = rules.restore(st);
  check(back.cups.length === 2 && back.throws.every(t => t === null) && back.hist.length === 2 && back.last.calls.length === 2, "the state comes back whole from the database");
  // play it out: the first always right, the other never
  for (let i = 0; i < 10 && G.state.step !== "over"; i++) {
    const a = G.state.first, b = 1 - a, ha = 1, hb = 4;
    G = move(G, a, { t: "throw", hand: ha, call: a === first ? 5 : 1 });
    G = move(G, b, { t: "throw", hand: hb, call: b === first ? 5 : 4 });
    G = wake(G, T + (3 + i) * SHOW_MS);
  }
  check(G.state.step === "over" && G.state.winners[0] === first && G.state.cups[1 - first] === 3 && /wins/.test(G.say.text), "three cups drunk: the game is over");
}
{
  let G = newRecord(rules, { seats: 2, options: { mode: "shiwu", limit: 3 }, seed: 3, now: T });
  const c = G.state.caller;
  check(G.state.step === "shiwu" || (G.state.mode === "shiwu" && rules.toMove(G.state) === c), "十五二十: the caller throws first");
  check(applyMove(rules, G, c, { t: "throw", hand: 5, call: 0 }).error && applyMove(rules, G, c, { t: "throw", hand: 7, call: 7 }).error, "hands are five or nothing; the call can't be below your own");
  G = move(G, c, { t: "throw", hand: 5, call: 15 });
  G = move(G, 1 - c, { t: "throw", hand: 10 });
  check(G.state.last.hit && G.state.streak === 1 && G.state.caller === c && G.say.lang === "zh-HK" && G.say.text === "十五！", "a right call (fifteen, in Cantonese): one more and the other drinks");
  G = wake(G, T + SHOW_MS);
  check(/One more/.test(G.say.text) && rules.toMove(G.state) === c, "the caller calls again");
  G = move(G, c, { t: "throw", hand: 0, call: 10 });
  G = move(G, 1 - c, { t: "throw", hand: 5 });
  check(!G.state.last.hit && G.state.streak === 0 && G.state.caller === 1 - c, "a wrong call passes the call");
  G = wake(G, T + 2 * SHOW_MS);
  const c2 = G.state.caller;
  G = move(G, c2, { t: "throw", hand: 10, call: 20 });
  G = move(G, 1 - c2, { t: "throw", hand: 10 });
  G = wake(G, T + 3 * SHOW_MS);
  G = move(G, c2, { t: "throw", hand: 0, call: 0 });
  G = move(G, 1 - c2, { t: "throw", hand: 0 });
  check(G.state.last.loser === 1 - c2 && G.state.cups[1 - c2] === 1 && G.state.caller === 1 - c2, "two right in a row: the other drinks, and calls next");
}
{
  // the computer players: legal throws, and the sharp one reading a habit
  let ok = true;
  for (const mode of ["huaquan", "shiwu"]) for (let seed = 1; seed < 40; seed++) {
    let G = newRecord(rules, { seats: 2, options: { mode, limit: 3 }, seed, now: T });
    for (let i = 0; i < 3000 && G.state.step !== "over"; i++) {
      if (G.state.step === "shown") { G = wake(G, T + (i + 1) * SHOW_MS); continue; }
      const seat = rules.toMove(G.state), r = applyMove(rules, G, seat, botMove(rules, G, seat, seed % 2 ? "sharp" : "easy"), T + i * SHOW_MS);
      if (r.error) { ok = false; break; }
      G = r.G;
    }
    if (G.state.step !== "over") ok = false;
  }
  check(ok, "the computer players' throws are always legal, and their games end");
  // a player who always throws five: the sharp computer calls with it in mind
  let G = newRecord(rules, { seats: 2, options: { mode: "huaquan", limit: 7 }, seed: 11, now: T });
  let reads = 0, n = 0;
  for (let i = 0; i < 200 && G.state.step !== "over"; i++) {
    if (G.state.step === "shown") { G = wake(G, T + (i + 1) * SHOW_MS); continue; }
    const seat = rules.toMove(G.state);
    if (seat === 0) { G = move(G, 0, { t: "throw", hand: 5, call: 5 }, T + i * SHOW_MS); continue; }
    const m = rules.bot(G.state, 1, { level: "sharp", rng: seeded(i + 1) });
    if (G.state.hist.length >= 3) { n++; if (m.call - m.hand === 5) reads++; }
    G = move(G, 1, m, T + i * SHOW_MS);
  }
  check(n > 5 && reads / n > 0.5, `the sharp computer reads a habit: it counts on your five ${Math.round(100 * reads / n)}% of the time`);
}
check(rules.seats.min === 2 && rules.seats.max === 2, "two at the table");

console.log(bad ? `banquet: ${bad} failed` : "banquet: every check passed");
process.exit(bad ? 1 : 0);
