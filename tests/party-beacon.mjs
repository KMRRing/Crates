// Beacon (party-beacon.js, its computer in party-beacon-bot.js, its words party-beacon-words.js), played in Node on the
// database in memory with the host's phone running it (tests/party-harness.js): the words (all from Echo's and the drawing
// games' lists, each with what it brings to mind); what makes a clue legal; the computer pilot's clues (legal, aimed at its
// own words, never nearer the reef than the words it aims at) and crew (one guess on a clue it has never heard of); a table
// of four (the deal, the pilots seeing the key, each rule of the turn: own word goes on, open water and the other crew's
// word end the turn, the reef loses, the last word wins, a stop needs a guess, the number limits the guesses); the
// computer as pilot and as crew with two players, a whole game through; a pilot who leaves.
import { partyTable } from "./party-harness.js";
import { seeded } from "../party-core.js";
import beacon, { signal, uncover, pass, remaining, pilotOf, crewOf } from "../party-beacon.js";
import { POOL, ASSOC, GROUPS } from "../party-beacon-words.js";
import { clueProblem, giveClue, nextGuess, related, knows } from "../party-beacon-bot.js";
import { WORDS } from "../party-echo-words.js";
import { KINDS } from "../party-draw-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the words ----------
{
  const banks = new Set([...WORDS.map(w => w[0].toLowerCase()), ...KINDS.flatMap(k => k.words.flatMap(w => w[0].split("|").map(x => x.toLowerCase())))]);
  check(POOL.length >= 400 && POOL.every(w => /^[a-z]{3,10}$/.test(w)), `${POOL.length} words, three to ten letters`);
  check(POOL.every(w => banks.has(w)), "every word is in Echo's or the drawing games' lists");
  check(POOL.every(w => ASSOC.get(w).length >= 2 && ASSOC.get(w).every(a => /^[a-z]{2,20}$/.test(a) && a !== w)), "each word has two or more associates, each one word and not the word itself");
  check([...GROUPS.values()].every(m => m.length >= 3 && m.every(w => POOL.includes(w))), `${GROUPS.size} groups of clues, every member on the board's list`);
  check(POOL.every((w, i) => POOL.findIndex(v => v.startsWith(w.slice(0, 5)) && v.endsWith(w.slice(-3)) && v.length - w.length === 1 && v.slice(0, w.length) === w) < 0), "no word and its plural both");
}

// ---------- clues ----------
{
  const board = ["cat", "pencil", "bank", "sandwich"];
  check(clueProblem("pet", board) === "" && clueProblem("Pet", board) === "", "a clue is legal in any case");
  check(clueProblem("two words", board) && clueProblem("co-op", board) && clueProblem("", board) && clueProblem("x", board), "one word of letters, at least two");
  check(/CAT/.test(clueProblem("cats", board)) && /CAT/.test(clueProblem("category", board)) && /PENCIL/.test(clueProblem("pen", board)), "not a word on the board, its family, or hidden in or around one");
  check(clueProblem("sand", board.filter(w => w !== "sandwich")) === "" && /SANDWICH/.test(clueProblem("sand", board)), "only the words still covered count");
  check(!knows("zzzz") && related("zzzz", "cat") === 0 && related("pet", "cat") > related("pet", "bank") && related("Pets", "dog") > 0 && related("animal", "cat") > 0, "what a clue brings to mind: pet reaches cat, pets reach dog, animal reaches cat, zzzz nothing");
}

// ---------- the computer pilot and crew ----------
{
  let aimed = 0, fine = 0, refused = 0, multi = 0, boards = 200;
  for (let g = 0; g < boards; g++) {
    const rng = seeded(g + 1), s = beacon.start({ players: [{ uid: "a", name: "A", seat: 0 }, { uid: "b", name: "B", seat: 1 }], options: { spy: "computer" }, rng });
    const team = g % 2, mine = "ab"[team], c = giveClue({ words: s.words, key: s.key, rev: s.rev, team }, rng);
    const cover = s.words.filter((w, i) => s.rev[i] === "0");
    if (clueProblem(c.clue, cover)) refused++;
    const ranked = s.words.map((w, i) => [i, related(c.clue, w)]).sort((p, q) => q[1] - p[1] || (s.key[p[0]] === mine) - (s.key[q[0]] === mine));
    if (c.aims.length === c.n && c.aims.every(i => s.key[i] === mine)) aimed++;
    if (ranked.slice(0, c.n).every(([i]) => s.key[i] === mine)) fine++;
    if (c.n >= 2) multi++;
  }
  check(refused === 0, "the computer's clue is always legal");
  check(aimed === boards && fine >= boards * 0.95, `its clue aims at its own words, and they top the board's ranking by it (${fine} of ${boards})`);
  check(multi >= boards * 0.08, `it signals two or more words sometimes (${multi} of ${boards})`);
  const rng = seeded(5), words = POOL.slice(0, 25), rev = "0".repeat(25);
  check(nextGuess({ words, rev, clue: "zzzz", n: 2, made: 0 }, rng) >= 0 && nextGuess({ words, rev, clue: "zzzz", n: 2, made: 1 }, rng) === -1, "a clue it has never heard of: one guess, then it stops");
  const pets = ["cat", "dog", "rabbit", "bank", "tax", "sword", "lamp", "oven", "river", "snow", "tower", "ring", "map", "pig", "pen", "owl", "ice", "boat", "rose", "fox", "gold", "cave", "bed", "coin", "sun"];
  const first = nextGuess({ words: pets, rev, clue: "pet", n: 3, made: 0 }, rng);
  const up = [...rev].map((r, i) => (i < 3 ? "1" : r)).join("");
  check(["cat", "dog", "rabbit"].includes(pets[first]) && nextGuess({ words: pets, rev: rev.slice(0, first) + "1" + rev.slice(first + 1), clue: "pet", n: 3, made: 1 }, rng) >= 0
    && nextGuess({ words: pets, rev: up, clue: "pet", n: 3, made: 3 }, rng) === -1,
    "pet with 3: it guesses a pet, goes on while pets are left, and stops at the number unless sure");
}

// ---------- a table of four ----------
const names = n => ["Korbi", "Mei", "Ana", "Bo", "Lin", "Sam"].slice(0, n);
const cardsOf = (s, owner) => s.words.map((w, i) => i).filter(i => s.key[i] === owner && s.rev[i] === "0");
const guessAs = (t, i, card) => t.act(i, st => (st.step === "guess" && st.teams[t.uid(i)] === st.turn && st.spy[st.turn] !== t.uid(i) ? uncover(st, card) : false));
const signalAs = (t, i, text, n) => t.act(i, st => (st.step === "clue" && st.spy[st.turn] === t.uid(i) ? !signal(st, text, n) : false));
const passAs = (t, i) => t.act(i, st => (st.teams[t.uid(i)] === st.turn && st.spy[st.turn] !== t.uid(i) ? pass(st) : false));
const crewSeat = (t, team) => t.seats.findIndex(s => t.state.teams[s.uid] === team && s.uid !== t.state.spy[team]);
const pilotSeat = (t, team) => t.seatOf(t.state.spy[team]);
{
  const t = await partyTable(names(4));
  check(await t.start("beacon", {}) && t.state.step === "clue", "Beacon starts with four");
  const s = t.state, k = [...s.key];
  const count = c => k.filter(x => x === c).length;
  check(s.words.length === 25 && new Set(s.words).size === 25 && s.key.length === 25 && s.rev === "0".repeat(25), "25 different words, none uncovered");
  check(count("a") === (s.first === 0 ? 9 : 8) && count("b") === (s.first === 1 ? 9 : 8) && count("n") === 7 && count("x") === 1, "nine for the crew that goes first, eight for the other, seven open water, one reef");
  const crew = u => Object.keys(s.teams).filter(x => s.teams[x] === u);
  check(crew(0).length === 2 && crew(1).length === 2 && s.spy[0] !== s.spy[1] && s.teams[s.spy[0]] === 0 && s.teams[s.spy[1]] === 1, "two crews of two, each with its own player for a pilot");
  check(/goes first/.test(t.branch.say.text) && s.turn === s.first, "announced: the crews and who goes first");
  const T = s.turn, other = 1 - T, mine = "ab"[T], theirs = "ab"[other];
  // only the pilot of the crew in play may signal; the signal must be legal
  check(!(await signalAs(t, crewSeat(t, T), "pet", 1)) && !(await signalAs(t, pilotSeat(t, other), "pet", 1)) && t.state.step === "clue", "neither a guesser nor the other pilot can signal");
  const hidden = t.state.words.find((w, i) => s.rev[i] === "0");
  check(!(await signalAs(t, pilotSeat(t, T), hidden, 1)) && !(await signalAs(t, pilotSeat(t, T), "two words", 1)) && t.state.step === "clue", "an illegal clue is refused");
  check(await signalAs(t, pilotSeat(t, T), "Zqjx", 2) && t.state.step === "guess" && t.state.clue.w === "zqjx" && t.state.left === 3 && /zqjx, 2/.test(t.branch.say.text), "a clue lowercased; two words means three guesses; said aloud");
  // who can guess
  check(!(await guessAs(t, pilotSeat(t, T), cardsOf(t.state, mine)[0])) && !(await guessAs(t, crewSeat(t, other), cardsOf(t.state, mine)[0])) && t.state.rev === "0".repeat(25), "the pilot cannot guess, nor the other crew");
  check(!(await passAs(t, crewSeat(t, T))) && t.state.step === "guess", "a crew cannot stop before its first guess");
  const own = cardsOf(t.state, mine);
  check(await guessAs(t, crewSeat(t, T), own[0]) && t.state.rev[own[0]] === "1" && t.state.turn === T && t.state.made === 1 && t.state.left === 2 && /to go/.test(t.branch.say.text), "its own word: uncovered, and the crew goes on");
  check(!(await guessAs(t, crewSeat(t, T), own[0])), "a word already uncovered cannot be taken again");
  check(await passAs(t, crewSeat(t, T)) && t.state.turn === other && t.state.step === "clue" && !t.state.clue, "a crew may stop after one: the other crew's turn");
  // open water ends the turn
  await signalAs(t, pilotSeat(t, other), "zqjx", 1);
  const water = cardsOf(t.state, "n")[0];
  check(await guessAs(t, crewSeat(t, other), water) && t.state.turn === T && t.state.step === "clue" && /open water/.test(t.branch.say.text), "open water ends the turn");
  // the other crew's word ends the turn and counts for them
  await signalAs(t, pilotSeat(t, T), "zqkx", 1);
  const before = remaining(t.state, other), stranger = cardsOf(t.state, theirs)[0];
  check(await guessAs(t, crewSeat(t, T), stranger) && remaining(t.state, other) === before - 1 && t.state.turn === other, "the other crew's word ends the turn, and is theirs");
  // the number limits the guesses: 1 means two (one and a bonus)
  await signalAs(t, pilotSeat(t, other), "zqlx", 1);
  const o2 = cardsOf(t.state, theirs);
  await guessAs(t, crewSeat(t, other), o2[0]);
  check(t.state.turn === other && t.state.left === 1, "one in the number: a guess, and one more");
  await guessAs(t, crewSeat(t, other), o2[1]);
  check(t.state.turn === T && /all .* may take/.test(t.branch.say.text), "…and then the turn is over");
  // the reef loses at once
  await signalAs(t, pilotSeat(t, T), "zqmx", 3);
  const reef = cardsOf(t.state, "x")[0];
  check(await guessAs(t, crewSeat(t, T), reef) && t.state.step === "over" && t.state.won === other && /reef/.test(t.branch.say.text), "the reef: the other crew wins");
  check(t.state.winners.length === 2 && t.state.winners.every(u => t.state.teams[u] === other) && Object.keys(t.branch.tally).length === 2, "its crew, pilot and guesser, win the evening's point");
  check(!(await guessAs(t, crewSeat(t, T), cardsOf(t.state, mine)[0] ?? 0)), "nothing more can be taken once it is over");
}
{
  // the last word wins, even if it was the other crew's that finished them
  const t = await partyTable(names(4));
  await t.start("beacon", {});
  let s = t.state;
  const T = s.turn, other = 1 - T, theirs = "ab"[other];
  // the crew in play uncovers every one of the other crew's words but one, turn after turn
  for (let guard = 0; guard < 40 && remaining(t.state, other) > 1; guard++) {
    const turn = t.state.turn;
    await signalAs(t, pilotSeat(t, turn), "zqjx", 9);
    const targets = cardsOf(t.state, turn === T ? theirs : "ab"[T]);
    if (turn === T) await guessAs(t, crewSeat(t, turn), targets[0]);
    else await guessAs(t, crewSeat(t, turn), cardsOf(t.state, "ab"[turn])[0]);
    if (t.state.turn === turn && t.state.step === "guess") await passAs(t, crewSeat(t, turn));
  }
  check(remaining(t.state, other) === 1, "(the other crew is down to its last word)");
  const last = cardsOf(t.state, theirs)[0];
  if (t.state.step === "clue" && t.state.turn !== T) {                       // their turn: take their last word
    await signalAs(t, pilotSeat(t, other), "zqjx", 1);
    await guessAs(t, crewSeat(t, other), last);
  } else {                                                                   // our turn: give it to them by mistake
    await signalAs(t, pilotSeat(t, T), "zqjx", 1);
    await guessAs(t, crewSeat(t, T), last);
  }
  check(t.state.step === "over" && t.state.won === other && /last word/.test(t.branch.say.text), "uncovering a crew's last word wins it for them, whoever did");
  check(await t.start("beacon", {}) && t.state.step === "clue" && t.state.rev === "0".repeat(25), "play again deals a new board");
}

// ---------- the computer ----------
async function playOut(t, rounds, humanTeams) {
  const rng = seeded(11);
  for (let i = 0; i < rounds && t.state.step !== "over"; i++) {
    const s = t.state, team = s.turn;
    const humanPilot = s.spy[team] !== "bot" && humanTeams.includes(team);
    if (s.step === "clue" && humanPilot) {
      const c = giveClue({ words: s.words, key: s.key, rev: s.rev, team }, rng);
      await signalAs(t, t.seatOf(s.spy[team]), c.clue, c.n);
    } else if (s.step === "guess" && crewOf(s, team, new Set(t.players.map(p => p.uid))).length && humanTeams.includes(team)) {
      const seat = t.seats.findIndex(x => s.teams[x.uid] === team && x.uid !== s.spy[team]);
      const g = nextGuess({ words: s.words, rev: s.rev, clue: s.clue.w, n: s.clue.n, made: s.made }, rng);
      if (g < 0) await passAs(t, seat); else await guessAs(t, seat, g);
    } else await t.tick(2700);
  }
}
{
  // two players, both pilots with the computer as their crew: it guesses by itself, a word every few seconds
  const t = await partyTable(names(2));
  await t.start("beacon", {});
  check(t.state.spy.every(u => u !== "bot") && Object.keys(t.state.teams).length === 2, "two players: a crew of one each, each its pilot");
  const T = t.state.turn;
  await signalAs(t, pilotSeat(t, T), "zqjx", 1);
  check(t.state.step === "guess" && t.state.botAt > t.now, "with no player to guess, the computer crew waits a moment before its first word");
  const rev0 = t.state.rev;
  await t.tick(500);
  check(t.state.rev === rev0, "…not before");
  await t.tick(3000);
  check(t.state.rev !== rev0 || t.state.turn !== T, "…and then guesses");
  await playOut(t, 60, [0, 1]);
  check(t.state.step === "over" || [...t.state.rev].filter(r => r === "1").length >= 4 && t.state.log.length > 0, "two pilots and computer crews play on, turn after turn");
}
{
  // computer pilots: the table is all guessers
  const t = await partyTable(names(4));
  await t.start("beacon", { spy: "computer" });
  check(t.state.spy[0] === "bot" && t.state.spy[1] === "bot", "Pilots: Computer gives both crews a computer pilot");
  check(t.state.step === "clue" && !t.state.clue, "…which waits a moment, then signals");
  await t.tick(500);
  check(t.state.step === "clue", "…not at once");
  await t.tick(3000);
  check(t.state.step === "guess" && t.state.clue && !clueProblem(t.state.clue.w, []) && t.state.clue.n >= 1 && /^[a-z]+$/.test(t.state.clue.w), `it signals: ${t.state.clue?.w} ${t.state.clue?.n}`);
  const T = t.state.turn, seat = t.seats.findIndex(x => t.state.teams[x.uid] === T);
  const target = t.state.words.findIndex((w, i) => t.state.rev[i] === "0");
  check(await guessAs(t, seat, target), "a player guesses for the computer's pilot");
  // whole games between the computer's pilots and crews, the pure functions end to end (the table's timers aside)
  let ended = 0, reef = 0;
  for (let g = 0; g < 60; g++) {
    const rng = seeded(100 + g), s = beacon.start({ players: [{ uid: "a", name: "A", seat: 0 }, { uid: "b", name: "B", seat: 1 }], options: { spy: "computer" }, rng });
    for (let i = 0; i < 400 && s.step !== "over"; i++) {
      if (s.step === "clue") { const c = giveClue({ words: s.words, key: s.key, rev: s.rev, team: s.turn }, rng); signal(s, c.clue, c.n); }
      else { const x = nextGuess({ words: s.words, rev: s.rev, clue: s.clue.w, n: s.clue.n, made: s.made }, rng); if (x < 0) pass(s); else uncover(s, x); }
    }
    if (s.step === "over") { ended++; if (s.key[[...s.rev].findIndex((r, i) => r === "1" && s.key[i] === "x")] === "x") reef++; }
  }
  check(ended === 60 && reef <= 6, `60 games between computer pilots and crews all end, ${reef} on the reef`);
}
{
  // a pilot who leaves: the computer takes the signal
  const t = await partyTable(names(4));
  await t.start("beacon", {});
  const T = t.state.turn, pilot = t.state.spy[T];
  await t.leave(t.seatOf(pilot));
  const here = new Set(t.players.map(p => p.uid));
  check(pilotOf(t.state, T, here) === "bot" && !here.has(pilot), "a pilot who leaves is replaced by the computer");
  await t.tick(3000);
  check(t.state.step === "guess" && t.state.clue, "…which signals for the crew");
}

check(beacon.min === 2 && beacon.max === 10 && beacon.options.some(o => o.id === "spy") && beacon.css === "party-beacon.css", "two to ten players, a choice of pilots");
console.log(bad ? `party-beacon: ${bad} failed` : "party-beacon: every check passed");
process.exit(bad ? 1 : 0);
