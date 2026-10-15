// Sketch (party-sketch.js), played in Node on the database in memory with the host's phone running it
// (tests/party-harness.js): three words to choose from at the game's levels, none twice in a game and the party's
// drawn words last; the choice, or the phone's when the clock runs out; guesses, wrong ones changing nothing, a right one
// scored by when it was typed, one typed too late or for another turn not counting; everyone having it ending the turn
// early, the drawing kept to show and the one drawing scoring the guessers' average; the clock ending a turn nobody
// got; the hint's letters; the turns round the table and the rounds; one drawing who leaves; the end and its winners;
// Chinese words, a guess in English still counting.
import { partyTable } from "./party-harness.js";
import sketch, { wordFor, hintOf, pointsFor, letterPlaces, LEVELS, POINTS } from "../party-sketch.js";
import { WORDS } from "../party-draw-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NAMES = ["Korbi", "Mei", "Ana", "Bo"];
const BY_ID = new Map(WORDS.map(w => [w.id, w]));
const list = x => (x ? Object.values(x) : []);
const answer = t => wordFor(t.state.word, t.state.lang).answers[0];
const guess = (t, i, words, at = t.now) => t.send(i, { g: words.map(w => ({ t: w, at })), turn: t.state.turn });

// ---------- the word, the hint, the points ----------
{
  const w = wordFor("giraffe", "en"), z = wordFor("giraffe", "zh"), b = wordFor("giraffe", "both");
  check(w.show === "giraffe" && z.show === "长颈鹿" && b.show === "长颈鹿 · giraffe" && w.answers.includes("长颈鹿") && z.answers.includes("giraffe"), "a word shown in the table's language; either language's answer counts");
  const s = { word: "ice cream", lang: "en", started: 0, span: 80000, reveal: letterPlaces("ice cream") };
  check(hintOf(s, 1000) === "___ _____" && hintOf(s, 40000).replace(/[_ ]/g, "").length === 1 && hintOf(s, 60000).replace(/[_ ]/g, "").length === 2,
    "the hint: every letter a blank, the spaces kept; a letter at half time, another at three quarters");
  check(hintOf({ ...s, word: "cat", reveal: letterPlaces("cat") }, 79000).replace(/_/g, "").length === 1, "a short word gives one letter away at most");
  check(pointsFor(80000, 80000) === POINTS.soon && pointsFor(0, 80000) === POINTS.late && pointsFor(40000, 80000) === 175 && pointsFor(-5, 80000) === POINTS.late, "300 at once, 50 on the bell, in fives between");
}

// ---------- a game ----------
{
  const t = await partyTable(NAMES.slice(0, 3));
  check(await t.start("sketch", { rounds: "1", level: "mixed" }) && t.state.step === "choose", "Sketch starts with three: the first to draw chooses");
  const [u0, u1, u2] = [0, 1, 2].map(i => t.uid(i));
  check(t.state.drawer === u0 && list(t.state.offer).length === 3 && list(t.state.offer).map(id => BY_ID.get(id).level).join() === LEVELS.mixed.join(), "Korbi draws first, offered an easy word, a medium and a hard");
  check(/Korbi draws first/.test(t.branch.say.text), "the narrator says who draws");
  await t.send(1, { pick: 0, turn: t.state.turn });
  check(t.state.step === "choose", "only the one drawing chooses");
  await t.send(0, { pick: 1, turn: t.state.turn });
  check(t.state.step === "draw" && t.state.word === list(t.state.offer)[1] && t.state.deadline - t.now === 80000, "the word chosen, and the clock: 80 seconds");
  check(t.branch.shown?.sketch && list(t.branch.shown.sketch).includes(t.state.word), "the party remembers the word drawn");
  await t.send(0, { d: "BBAAAAgg", turn: t.state.turn });
  await t.tick(10000);
  await guess(t, 1, ["xyzzy", "plugh"]);
  check(t.state.step === "draw" && !Object.keys(t.state.got || {}).length, "wrong guesses change nothing");
  await guess(t, 1, ["xyzzy", "plugh", answer(t)], t.now);
  const g1 = t.state.got?.[u1];
  check(g1 && g1.pts === pointsFor(70000, 80000) && /Mei got it/.test(t.branch.say.text), `a right guess scores by when it was typed (${g1?.pts} with 70 of 80 seconds left), and is said`);
  await guess(t, 2, ["?"], t.now);
  await t.tick(30000);
  await guess(t, 2, [answer(t).toUpperCase()], t.now - 20000);
  const s = t.state;
  check(s.step === "show" && s.got[u2].pts === pointsFor(60000, 80000), "everyone has it: the turn ends at once, each scored as they typed it");
  check(s.scores[u1] === g1.pts && s.scores[u2] === s.got[u2].pts && s.scores[u0] === Math.round((g1.pts + s.got[u2].pts) / 2 / 5) * 5, "the one drawing scores the guessers' average");
  check(s.last.d === "BBAAAAgg" && s.last.word === s.word && list(s.last.got).join() === [u1, u2].join(), "the drawing kept to show, with who got it in order");
  check(/Everyone got it/.test(t.branch.say.text), "the narrator says everyone got it");
  await t.tick(7000);
  check(t.state.step === "choose" && t.state.drawer === u1, "after the word's shown, Mei chooses");
  const offered = new Set(list(t.state.offer));
  check(!offered.has(s.word) && list(t.state.dealt).length === 6, "no word offered twice in a game");
  await t.tick(15000);
  check(t.state.step === "draw" && offered.has(t.state.word), "the clock runs out: the phone chooses one of hers");
  // a guess too late, and one for another turn
  await t.send(0, { g: [{ t: answer(t), at: t.now }], turn: t.state.turn - 1 });
  check(!t.state.got?.[u0], "a guess for another turn doesn't count");
  await t.tick(80000);
  await guess(t, 0, [answer(t)], t.now);
  check(t.state.step === "show" && !Object.keys(t.state.got || {}).length && t.state.scores[u1] === g1.pts && /Nobody got it/.test(t.branch.say.text), "time's up with nobody: no points, a guess after the bell too late");
  await t.tick(7000);
  check(t.state.drawer === u2, "then Ana");
  await t.send(2, { pick: 0, turn: t.state.turn });
  await guess(t, 0, [answer(t)]);
  await guess(t, 1, [answer(t)]);
  await t.tick(7000);
  check(t.state.step === "over" && /That's the game/.test(t.branch.say.text), "one round: everyone has drawn once, and it's over");
  const top = Math.max(...Object.values(t.state.scores));
  check(list(t.state.winners).length >= 1 && list(t.state.winners).every(u => t.state.scores[u] === top), `the most points wins (${top})`);
}
{
  // two rounds; one drawing who leaves; the party's drawn words dealt last
  const t = await partyTable(NAMES);
  await t.start("sketch", { rounds: "2", level: "easy", lang: "zh" });
  check(list(t.state.offer).every(id => BY_ID.get(id).level === 1) && /[一-鿿]/.test(wordFor(list(t.state.offer)[0], "zh").show), "Easy: three easy words, shown in Chinese");
  await t.send(0, { pick: 0, turn: t.state.turn });
  await guess(t, 1, [BY_ID.get(t.state.word).en[0]]);
  check(t.state.got?.[t.uid(1)], "a guess in English counts at a Chinese table");
  await t.leave(0);
  check(t.state.step === "show" && /has gone/.test(t.branch.say.text), "the one drawing leaves: the turn ends, the word told");
  await t.tick(7000);
  check(t.state.drawer === t.uid(1), "and the next draws");
  // Mei, Ana and Bo draw; round two skips Korbi, who left
  for (let k = 0; k < 3; k++) { await t.tick(15000); await t.tick(80000); await t.tick(7000); }
  check(t.state.round === 1 && t.state.drawer === t.uid(1) && /Round 2/.test(t.branch.say.text), "round two begins with Mei, Korbi gone");
}
{
  // the party's drawn words dealt last: with every easy word but three drawn, those three are offered
  const easy = WORDS.filter(w => w.level === 1).map(w => w.id);
  const s = sketch.start({ players: [{ uid: "a", name: "A" }, { uid: "b", name: "B" }], options: { level: "easy" }, rng: Math.random, now: 0, shown: easy.slice(3) });
  check(list(s.offer).sort().join() === easy.slice(0, 3).sort().join(), "the words the party hasn't drawn come first");
}
{
  const t = await partyTable(NAMES.slice(0, 1));
  check(!(await t.start("sketch", {})), "Sketch doesn't start with one");
}
check(sketch.min === 2 && sketch.max === 12 && sketch.keepsView && sketch.options.map(o => o.id).join() === "lang,level,rounds,secs", "two to twelve; words, difficulty, rounds and time to draw");

console.log(bad ? `party-sketch: ${bad} failed` : "party-sketch: every check passed");
process.exit(bad ? 1 : 0);
