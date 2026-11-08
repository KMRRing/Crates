// Pewter alone on one phone (party-pewter-solo.js, with the computer players in party-pewter-bot.js), played in Node: the
// deal for one to five computer players of each level; whole games through the loop the page runs (you answering when it
// is your turn, the computer players when their moment has come, the state through JSON as localStorage keeps it, a game
// picked up again halfway); that no computer player of any level ever sends an answer the game would not take, in
// hundreds of seeded games of two to six seats; that none of them sees a coin it should not (swap the hidden ones: the
// same answer); that the levels are ordered (hard beats medium beats simple); and that the page is wired.
import { GAMES, seeded, playable, seatsText } from "../party-core.js";
import pewter, { alive, onTable } from "../party-pewter.js";
import { deal, move, wait, clockOf, YOU, MOST, LEVELS as CHOICES } from "../party-pewter-solo.js";
import { pewterBot, levelOf, LEVELS, PERSONAS } from "../party-pewter-bot.js";
import { roundTrip } from "./rtdb.js";
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const H = (s, u) => s.hand?.[u] || [], K = (s, u) => s.stack?.[u] || [];
const stored = g => JSON.parse(JSON.stringify(g));                      // what localStorage does to it

// ---------- the deal ----------
{
  for (const n of [1, 2, 3, 4, 5]) for (const level of [1, 2, 3]) {
    const g = deal(n, level, seeded(n * 3 + level), 0, "Korbi"), s = g.state;
    const ok = s.seats.length === n + 1 && s.seats[0] === YOU && s.seats.slice(1).join() === s.seats.slice(1).map((_, i) => `bot${i + 1}`).join()
      && s.seats.every(u => H(s, u).slice().sort().join() === "b,p,p,p") && !s.clock && !s.deadline && s.step === "lay#1"
      && s.names[YOU] === "Korbi" && s.names.bot1 === PERSONAS[0].name && s.seats.slice(1).every(u => s.bots[u] === level);
    if (!ok) check(false, `${n} computer player(s) at level ${level}: dealt wrongly`);
  }
  check(true, "1 to 5 computer players at each level: you and them at the table, four coins each, no clock, named by their tempers");
  check(deal(9, 7, seeded(1), 0).foes === MOST && deal(0, 0, seeded(1), 0).foes >= 1 && deal(2, 7, seeded(1), 0).level === 2 && MOST === 5, "the number of opponents is kept within one to five, the level within three");
  check(typeof pewter.solo === "function" && /1–5 computer/.test(pewter.soloText), "Counterfeit has a way to be played alone");
  check(seatsText(playable("pewter")) === "Alone against 1–5 computer players, or 2–6 on their own", `its card says so (“${seatsText(playable("pewter"))}”)`);
  check(GAMES.includes(pewter) && fs.existsSync(new URL(`../${pewter.css}`, import.meta.url)), "the stylesheet is there");
  const apps = fs.readFileSync(new URL("../apps.js", import.meta.url), "utf8");
  check(/id: "pewter",[^\n]*players: \[1, 6\]/.test(apps), "its tile on the games screen says 1 to 6 players");
  const party = pewter.options.find(o => o.id === "level");
  check(party?.value === "2" && party.choices.map(c => c[0]).join() === "1,2,3" && CHOICES.map(c => c[0]).join() === "1,2,3", "a table's Computer level option and the setup's agree: simple, medium, hard");
}

// ---------- the loop the page runs ----------
/** Whether the game waits for you now. */
const yours = g => {
  const s = g.state;
  if (!alive(s).includes(YOU) || s.phase === "over") return false;
  if (s.phase === "lay") return !g.inputs[YOU];
  return (s.phase === "flip" ? s.bid.by : s.turn) === YOU;
};
/** One whole game, you played by a computer player too; null if it ever stalls or takes an answer that wasn't one. */
function solo(foes, level, seed, { stopAt = 0 } = {}) {
  const rng = seeded(seed);
  let now = 1e6, g = deal(foes, level, rng, now, "Korbi"), moves = 0, early = 0, why = "";
  for (let i = 0; i < 6000 && g.state.phase !== "over"; i++) {
    g = { ...stored(g), state: roundTrip(stored(g).state) };           // the phone keeps it; the database's rules for what it drops hold too
    if (stopAt && moves === stopAt) { stopAt = 0; g = stored(g); }       // picked up again here, as after a reload
    if (yours(g)) {
      const next = move({ ...g, inputs: { ...g.inputs, [YOU]: pewterBot(g.state, YOU, rng) } }, rng, now);
      if (!next) { why = `your answer in ${g.state.step} was not taken`; break; }
      g = next; moves++; continue;
    }
    const ms = wait(g, now);
    if (ms && alive(g.state).includes(YOU)) {
      if (move(g, rng, now)) { early++; why = `moved before its moment in ${g.state.step}`; break; }
      now += ms + 20;
    }
    const next = move(g, rng, now);
    if (!next) { why = `stuck in ${g.state.step}`; break; }
    g = next; moves++;
  }
  return g.state.phase === "over" && !why ? { g, moves } : { why: why || "did not end" };
}
{
  let finished = 0, fail = "", wins = 0, longest = 0;
  for (let k = 0; k < 60 && !fail; k++) {
    const r = solo(1 + k % 5, 1 + k % 3, 400 + k);
    if (r.why) fail = `game ${k} (${1 + k % 5} computer players, level ${1 + k % 3}): ${r.why}`;
    else { finished++; longest = Math.max(longest, r.moves); if (r.g.state.won === YOU) wins++; }
  }
  check(!fail && finished === 60, `${finished} whole games through the page's loop, you and the computer players answering (the longest ${longest} moves)${fail ? `: ${fail}` : ""}`);
  check(wins >= 5 && wins < 80, `…and you win some and lose some (${wins} of ${finished} won, with a computer player in your seat)`);
  const half = solo(3, 2, 77, { stopAt: 25 });
  check(!half.why && half.g.state.phase === "over", "a game stopped halfway and picked up from what the phone kept goes on to the end");
  // the computer players answer only when their moment has come; out yourself, the rest play on at once
  let g = deal(3, 2, seeded(12), 5e5, "Korbi");
  g = move({ ...g, inputs: { [YOU]: { lay: H(g.state, YOU)[0] } } }, seeded(1), 5e5);
  check(g.state.phase === "build" && Object.keys(g.state.stack).length === 4, "everyone lays at once when you have");
  g.state.turn = g.state.first = "bot1"; g.state.botAt = 5e5 + 900;
  check(wait(g, 5e5) === 900 && !move(g, seeded(2), 5e5 + 100) && !!move(g, seeded(2), 5e5 + 901), "a computer player's turn waits for its moment, and the page is told how long");
  const out = { ...g, state: { ...g.state, hand: { ...g.state.hand }, stack: { ...g.state.stack } } };
  delete out.state.hand[YOU]; delete out.state.stack[YOU];
  check(!alive(out.state).includes(YOU) && wait(out, 5e5) === 250 && clockOf(out, 5e5) === 5e5 + 900 && !!move(out, seeded(2), 5e5), "out yourself, the rest do not wait their moments");
  check(wait({ ...g, state: { ...g.state, phase: "over" } }, 0) === null, "a game that is over wants nothing");
}

// ---------- no computer player sends what the game would not take ----------
/** A game of computer players of these levels in the seats, played with the game's own advance; null if it ever stalls. */
function bots(levels, seed, checked = true) {
  const rng = seeded(seed);
  let s = roundTrip({ ...pewter.start({ players: [{ uid: "x", name: "X" }], options: { fill: String(levels.length), clock: "0" }, rng, now: 0 }), say: null });
  const fast = !checked;
  s.bots = Object.fromEntries(s.seats.map((u, i) => [u, levels[i]]));
  for (let now = 2000, steps = 0; s.phase !== "over"; now += 2000) {
    if (steps++ > 3000) return { why: "did not end" };
    const r = pewter.advance(fast ? s : roundTrip(s), { players: [], inputs: {}, now, rng });
    if (!r) return { why: `stuck in ${s.step}` };
    s = r.state;
    const coins = u => [...H(s, u), ...K(s, u)];
    if (!fast) for (const u of s.seats) if (coins(u).filter(c => c === "b").length > 1 || coins(u).length > 4) return { why: `${u} holds ${coins(u).join()}` };
  }
  return { winner: s.seats.indexOf(s.won), s };
}
{
  let ok = 0, why = "";
  for (let g = 0; g < 240 && !why; g++) {
    const n = 2 + g % 5, levels = Array.from({ length: n }, (_, i) => 1 + (g + i * (1 + g % 2)) % 3);
    const r = bots(levels, 900 + g);
    if (r.why) why = `game ${g} (${levels}): ${r.why}`; else ok++;
  }
  check(!why && ok === 240, `240 games of computer players of every level in 2 to 6 seats: every answer taken, every game ended${why ? `: ${why}` : ""}`);
}

// ---------- what they may see ----------
{
  const r = seeded(31), swap = (st, keep) => {
    const c = structuredClone(st);
    for (const u of c.seats) if (u !== keep) for (const key of ["hand", "stack"]) if (c[key]?.[u]) c[key][u] = c[key][u].map(() => (r() < .5 ? "p" : "b"));
    return c;
  };
  let same = 0, differ = 0;
  for (const level of [1, 2, 3]) for (let g = 0; g < 14; g++) {
    const rng = seeded(level * 100 + g);
    let s = roundTrip({ ...pewter.start({ players: [{ uid: "x", name: "X" }], options: { fill: "5", clock: "0" }, rng, now: 0 }), say: null });
    s.bots = Object.fromEntries(s.seats.map(u => [u, level]));
    for (let now = 2000, i = 0; s.phase !== "over" && i < 400; now += 2000, i++) {
      const asked = s.phase === "lay" ? s.seats[0] : s.phase === "flip" ? s.bid.by : s.turn;
      if (alive(s).includes(asked)) {
        const a = JSON.stringify(pewterBot(s, asked, seeded(i))), b = JSON.stringify(pewterBot(swap(s, asked), asked, seeded(i)));
        if (a === b) same++; else differ++;
      }
      const nx = pewter.advance(roundTrip(s), { players: [], inputs: {}, now, rng });
      if (!nx) break;
      s = nx.state;
    }
  }
  check(same > 1500 && differ === 0, `at every level a computer player's answer is the same whatever lies under the others' stacks (${same} answers)`);
  check(levelOf({ bots: { a: 1 } }, "a") === 1 && levelOf({ bots: { a: true } }, "a") === 2 && levelOf({}, "a") === 2, "a table that only says 'a computer player' gets medium");
}

// ---------- the levels, in order ----------
{
  /** The share of games won by a seat of level `a` among `na` of them and `nb` of level `b`, seats turned each game. */
  const share = (a, b, na, nb, games, seed) => {
    let won = 0, done = 0;
    for (let g = 0; g < games; g++) {
      const lv = [...Array(na).fill(a), ...Array(nb).fill(b)], t = g % lv.length, order = lv.slice(t).concat(lv.slice(0, t));
      const r = bots(order, seed + g, false);
      if (r.why) continue;
      done++; if (order[r.winner] === a) won++;
    }
    return won / done;
  };
  const N = 250;
  for (const [a, b, name] of [[3, 1, "hard beats simple"], [2, 1, "medium beats simple"], [3, 2, "hard beats medium"]]) {
    const duel = share(a, b, 1, 1, N, 5000), crowd = share(a, b, 1, 3, N, 8000);
    check(duel > .53 && crowd > .27, `${name}: ${(duel * 100).toFixed(0)}% of two-seat games (fair 50%), ${(crowd * 100).toFixed(0)}% against three (fair 25%)`);
  }
  check(Object.keys(LEVELS).join() === "1,2,3", "the levels are three");
}

// ---------- the page ----------
{
  const soloSrc = fs.readFileSync(new URL("../party-pewter-solo.js", import.meta.url), "utf8"), party = fs.readFileSync(new URL("../party.js", import.meta.url), "utf8");
  check(/"pewter:solo"/.test(soloSrc) && !/party:pewter/.test(soloSrc) && /setTimeout/.test(soloSrc) && /onPause/.test(soloSrc) && /IN_FRAME/.test(soloSrc),
    "it keeps the game on the phone under pewter:, gives the computer players their moment, stops for the menu and does nothing in a watching frame");
  check(/def\?\.solo/.test(party), "Party's page opens a game with a solo hook on this phone");
  check(onTable({ seats: ["a"], stack: { a: ["p", "p"] } }) === 2, "(the table's coin count is the one the page uses)");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
