// Coup alone on one phone (party-coup-solo.js, with the computer player in party-coup-bot.js), played in Node: the deal for
// one to four computer players; that the computer's answer is always one the game accepts, and never depends on a hand it
// can't see (the same position with the other players' hidden cards swapped for others gives the same answer); that it
// plays better than a player choosing at random; whole games with a computer in your seat too, every state through the
// database's round trip; and that the page is wired (the tile's words, the stylesheet, the solo hook).
import { GAMES, seeded, playable, seatsText } from "../party-core.js";
import coup, { CARDS, alive } from "../party-coup.js";
import { deal, move, botsAnswer, pending, safe, seatsOf, YOU, FOES } from "../party-coup-solo.js";
import { coupBot, waiting, holds, TEMPER } from "../party-coup-bot.js";
import { roundTrip } from "./rtdb.js";
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const H = (s, u) => s.hand?.[u] || [];
const keepState = g => ({ ...g, state: roundTrip(g.state) });             // the database drops empty lists and objects; localStorage doesn't

// ---------- the deal ----------
{
  for (const n of [1, 2, 3, 4]) {
    const g = deal(n, seeded(n), 0, "Korbi");
    const s = g.state;
    const all = [...Object.values(s.hand).flat(), ...s.deck];
    check(s.seats.length === n + 1 && s.seats[0] === YOU && s.seats.slice(1).join() === FOES.slice(0, n).map((_, i) => `bot${i + 1}`).join(), `${n} computer player${n === 1 ? "" : "s"}: you and ${n} at the table`);
    check(s.seats.every(u => H(s, u).length === 2) && CARDS.every(c => all.filter(x => x === c).length === 3) && !s.clock && !s.deadline, "two cards each, every character three times, no clock");
    check(s.names[YOU] === "Korbi" && s.names.bot1 === FOES[0] && seatsOf(n, "Korbi").length === n + 1, "named: you, then Quill, Sable, Pip and Wren in order");
  }
  check(deal(9, seeded(1), 0).foes === 4 && deal(0, seeded(1), 0).foes >= 1, "the number of opponents is kept within one to four");
  check(typeof coup.solo === "function" && /1–4 computer/.test(coup.soloText), "Coup has a way to be played alone");
  check(seatsText(playable("coup")) === "Alone against 1–4 computer players, or 2–6 on their own", `its card says so (“${seatsText(playable("coup"))}”)`);
  check(seatsText(playable("hilo")) === "Any number on one phone, or 2–24 on their own", "Higher or Lower's card still says what it did");
  check(fs.existsSync(new URL(`../${coup.css}`, import.meta.url)) && GAMES.includes(coup), "the stylesheet is there");
}

// ---------- a player that chooses at random among what the rules allow, to play against ----------
function chaos(s, u, rng) {
  const pickOf = list => list[Math.floor(rng() * list.length)];
  const others = alive(s).filter(v => v !== u), mine = H(s, u);
  if (s.phase === "turn") {
    if (s.coins[u] >= 10) return { do: "coup", target: pickOf(others) };
    const kinds = ["income", "aid", "tax", "steal", "exchange", ...(s.coins[u] >= 3 ? ["assassinate"] : []), ...(s.coins[u] >= 7 ? ["coup"] : [])];
    const kind = pickOf(kinds);
    return ["steal", "assassinate", "coup"].includes(kind) ? { do: kind, target: pickOf(others) } : { do: kind };
  }
  if (s.phase === "challenge") return { c: rng() < .3 ? "challenge" : "allow" };
  if (s.phase === "block") return { b: rng() < .3 ? pickOf({ aid: ["duke"], assassinate: ["contessa"], steal: ["captain", "ambassador"] }[s.act.kind]) : "allow" };
  if (s.phase === "lose") return { lose: Math.floor(rng() * mine.length) };
  const pool = [...mine, ...s.exch.drawn], idx = pool.map((_, i) => i).sort(() => rng() - .5).slice(0, mine.length).sort((a, b) => a - b);
  return { keep: idx };
}

/** One whole game: `who(u)` gives the function that answers for seat u. Returns the game, or null if the game ever refused an answer or stalled. */
function playOut(foes, seed, who) {
  const rng = seeded(seed * 31 + foes);
  let g = deal(foes, rng, 0);
  for (let n = 0; g.state.phase !== "over"; n++) {
    if (n > 4000) return null;
    let inputs = g.inputs;
    for (const u of waiting(g.state)) if (!inputs[u]) inputs = { ...inputs, [u]: who(u)(g.state, u, rng) };
    const m = move({ ...g, inputs }, rng, 0);
    if (!m) return null;
    g = keepState(m);
  }
  return g;
}

// ---------- the computer's answers are always accepted, and games with it finish ----------
{
  let games = 0, refused = 0, turns = 0;
  for (const foes of [1, 2, 3, 4]) for (let seed = 1; seed <= 40; seed++) {
    const g = playOut(foes, seed, () => coupBot);
    games++;
    if (!g) { refused++; continue; }
    const all = [...Object.values(g.state.hand || {}).flat(), ...Object.values(g.state.dead || {}).flat(), ...g.state.deck];
    if (all.length !== 15) refused++;
    turns += g.seq;
  }
  check(games === 160 && refused === 0, `160 games of computer players only, one to four against the seat that would be you: every answer taken, every game finished, all fifteen cards at the end (${(turns / games).toFixed(0)} steps a game)`);
}

// ---------- the safe answers are accepted too, wherever they're used ----------
{
  let tried = 0, wrong = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const rng = seeded(seed), foes = 1 + (seed % 4);
    let g = deal(foes, rng, 0);
    for (let n = 0; g.state.phase !== "over" && n < 3000; n++) {
      // every position of the game: the stand-in answer for each seat that must answer, alone or with the rest
      const w = waiting(g.state);
      const only = ["turn", "lose", "exchange"].includes(g.state.phase);
      if (only) { tried++; if (!move({ ...g, inputs: { [w[0]]: safe(g.state, w[0]) } }, rng, 0)) wrong++; }
      else { tried++; if (!move({ ...g, inputs: Object.fromEntries(w.map(u => [u, safe(g.state, u)])) }, rng, 0)) wrong++; }
      let inputs = g.inputs;
      for (const u of w) inputs = { ...inputs, [u]: coupBot(g.state, u, rng) };
      g = keepState(move({ ...g, inputs }, rng, 0));
    }
  }
  check(tried > 600 && wrong === 0, `the stand-in answer is taken in every one of ${tried} positions`);
}

// ---------- it reads only what its player may know ----------
{
  // the same position, the other players' hidden cards (and the deck) dealt out again, must give the same answer
  let positions = 0, differ = 0;
  const phases = {};
  for (let seed = 1; seed <= 28; seed++) {
    const rng = seeded(seed + 500), foes = 1 + (seed % 4);
    let g = deal(foes, rng, 0);
    for (let n = 0; g.state.phase !== "over" && n < 3000; n++) {
      const s = g.state, w = waiting(s);
      for (const u of w) {
        const t = structuredClone(s);
        // what u can't see: every other seat's cards in hand, and the deck (and the cards drawn for an exchange that isn't u's)
        const hidden = [...Object.entries(t.hand).filter(([v]) => v !== u).flatMap(([, c]) => c), ...t.deck, ...(t.exch && t.act.by !== u ? t.exch.drawn : [])];
        const mix = hidden.map(x => x).sort(() => rng() - .5);
        for (const v of Object.keys(t.hand)) if (v !== u) t.hand[v] = t.hand[v].map(() => mix.pop());
        const exchOther = t.exch && t.act.by !== u;
        if (exchOther) t.exch.drawn = t.exch.drawn.map(() => mix.pop());
        t.deck = t.deck.map(() => mix.pop());
        // a claim true or false is the claimant's secret too: the claim itself is public, and so is who made it
        const a = coupBot(s, u, seeded(seed * 3 + n)), b = coupBot(t, u, seeded(seed * 3 + n));
        positions++; phases[s.phase] = (phases[s.phase] || 0) + 1;
        if (JSON.stringify(a) !== JSON.stringify(b)) differ++;
      }
      let inputs = g.inputs;
      for (const u of w) inputs = { ...inputs, [u]: coupBot(s, u, rng) };
      g = keepState(move({ ...g, inputs }, rng, 0));
    }
  }
  check(positions > 1000 && differ === 0 && ["turn", "challenge", "block", "lose", "exchange"].every(p => phases[p] > 20), `the same answer in ${positions} positions whatever the other players hold (${Object.entries(phases).map(([k, v]) => `${k} ${v}`).join(", ")})`);
  const s = deal(3, seeded(4), 0).state;
  check(holds(s, YOU, "duke", "bot1") > 0 && holds(s, YOU, "duke", "bot1") < 1, "the chance another player holds a character is a chance, not a certainty");
  const t = structuredClone(s); t.hand[YOU] = ["duke", "duke"]; t.dead = { bot1: ["duke"] }; t.hand.bot1 = [t.hand.bot1[0]];
  check(holds(t, YOU, "duke", "bot2") === 0 && holds(t, YOU, "duke", "bot1") === 0, "with all three Dukes in sight (two in my hand, one face up) nobody else can have one");
}

// ---------- it plays better than choosing at random ----------
{
  // one computer player among players who choose at random from what the rules allow
  const rows = [];
  for (const foes of [1, 3]) {
    let wins = 0; const N = 70;
    for (let seed = 1; seed <= N; seed++) {
      const g = playOut(foes, seed + 900, u => (u === YOU ? coupBot : chaos));
      if (g?.state.won === YOU) wins++;
    }
    rows.push([foes + 1, wins / N]);
  }
  check(rows.every(([n, share]) => share > 1.6 / n), `a computer player against players choosing at random wins ${rows.map(([n, w]) => `${(100 * w).toFixed(0)}% of ${n}-player games (a fair share is ${(100 / n).toFixed(0)}%)`).join(" and ")}`);
}

// ---------- the computer players are fair to one another ----------
{
  const wins = {}, N = 220;
  for (let seed = 1; seed <= N; seed++) {
    const g = playOut(4, seed + 2000, () => coupBot);
    wins[g.state.won] = (wins[g.state.won] || 0) + 1;
  }
  const shares = Object.values(wins).map(v => v / N);
  check(Object.keys(wins).length === 5 && Math.min(...shares) > .1 && Math.max(...shares) < .34, `at a table of five computer players, each wins 10–34% (${Object.entries(wins).sort().map(([u, v]) => `${u} ${(100 * v / N).toFixed(0)}%`).join(", ")})`);
  check(TEMPER.length >= 5 && TEMPER.every(([a, b]) => a > 0 && b > 0), "each seat has a temper");
}

// ---------- the loop the page runs: the computer answers, the game moves on, the human's answer is waited for ----------
{
  const rng = seeded(77);
  let g = deal(3, rng, 0, "Korbi");
  // start at the first step in which the human must answer or act: the computer players get there by themselves
  let guard = 0, humanTurns = 0, windows = 0, outsideWaits = 0;
  while (g.state.phase !== "over" && guard++ < 3000) {
    const m = move(g, rng, 0);
    if (m) { g = keepState(m); continue; }
    const todo = pending(g);
    if (todo.length) {
      const before = Object.keys(g.inputs).length;
      g = botsAnswer(g, rng, 0);
      if (Object.keys(g.inputs).length !== before + todo.length) outsideWaits++;
      continue;
    }
    // nothing for a computer player to do: it's waiting on you
    if (!waiting(g.state).includes(YOU)) { outsideWaits++; break; }
    if (g.state.phase === "turn") humanTurns++; else windows++;
    g = { ...g, inputs: { ...g.inputs, [YOU]: coupBot(g.state, YOU, rng) } };
  }
  check(g.state.phase === "over" && outsideWaits === 0 && humanTurns > 3 && windows > 5, `the loop plays a game through: ${humanTurns} turns of yours, ${windows} challenge, block, choice or exchange asked of you`);
  check(guard < 3000 && g.state.won && alive(g.state).length === 1, "and ends with one player left");

  // a challenge or block window is answered by every computer player at once, as at a table; a turn by the one whose turn it is
  const t = deal(4, seeded(5), 0);
  let w = t;
  w.state.turn = "bot2";
  const turn = botsAnswer(w, seeded(1), 0);
  check(Object.keys(turn.inputs).join() === "bot2", "on a computer player's turn only that player answers");
  const ch = structuredClone(w); ch.state.phase = "challenge"; ch.state.act = { by: "bot1", kind: "tax" }; ch.state.claim = { by: "bot1", card: "duke", on: "act" }; ch.state.step = "challenge#2";
  const all = botsAnswer(ch, seeded(1), 0);
  check(Object.keys(all.inputs).sort().join() === "bot2,bot3,bot4" && pending(all).length === 0 && waiting(all.state).includes(YOU), "in a challenge window every computer player but the claimant answers at once, and yours is still waited for");
  check(move(all, seeded(1), 0) === null, "and the game waits for you");
  const you = { ...all, inputs: { ...all.inputs, [YOU]: { c: "allow" } } };
  check(!!move(you, seeded(1), 0), "until you answer");
}

// ---------- the page ----------
{
  const solo = fs.readFileSync(new URL("../party-coup-solo.js", import.meta.url), "utf8"), party = fs.readFileSync(new URL("../party.js", import.meta.url), "utf8");
  check(/party:coup/.test(solo) && /setTimeout/.test(solo) && /onPause/.test(solo) && /IN_FRAME/.test(solo), "it keeps the game on the phone as party:coup, gives the computer a moment to answer, stops for the menu and does nothing in a watching frame");
  check(/def\?\.solo/.test(party), "Party's page opens a game with a solo hook on this phone");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
