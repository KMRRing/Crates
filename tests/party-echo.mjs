// Echo (party-echo.js, its words party-echo-words.js), played in Node on the database in memory with the host's phone
// running it (tests/party-harness.js): the words; the clues that cancel by themselves (the same twice, by stem, the word
// itself or of its family, more than one word, a Chinese clue sharing a character with the word); the pile's tally
// (right wins the card, pass loses it, wrong loses it and the next, or a won card on the last); a card played through
// (the clues, the table cancelling and keeping, the guesser's clues, a right guess); a wrong guess counted; a pass; the
// clock for the clues; a guesser who leaves; the end and its verdict.
import { partyTable } from "./party-harness.js";
import echo, { stem, autoOut, tally, verdict, rightGuess, wordOf } from "../party-echo.js";
import { WORDS } from "../party-echo-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(WORDS.length >= 400 && WORDS.every(w => w.length === 2 && w[0] && w[1] && w[0].trim() === w[0] && w[1].trim() === w[1]), `${WORDS.length} words, each in English and Chinese`);
check(new Set(WORDS.map(w => w[0].toLowerCase())).size === WORDS.length && new Set(WORDS.map(w => w[1])).size === WORDS.length, "no word twice, in either language");

// ---------- clues ----------
check(stem("swimmer") === stem("swim") && stem("swimming") === stem("swim") && stem("princess") === stem("prince") && stem("Cats") === stem("cat"), "a word's family shares its stem: swim, swimmer, swimming; prince, princess; cats, cat");
{
  const out = autoOut({ a: "kitten", b: "Kittens", c: "milk", d: "cats", e: "black cat", f: "", g: "mouse" }, ["cat", "猫"]);
  check(out.a === "same" && out.b === "same" && out.c === null && out.d === "word" && out.e === "words" && out.f === "none" && out.g === null,
    `the same clue twice cancels both, the word itself and its family, more than one word, none (${JSON.stringify(out)})`);
  const zh = autoOut({ a: "竹子", b: "大熊", c: "竹子", d: "黑白" }, ["panda", "熊猫"]);
  check(zh.a === "same" && zh.c === "same" && zh.b === "word" && zh.d === null, "in Chinese: the same twice, and a clue sharing a character with the word");
  check(autoOut({ a: "pan" }, ["pancake", "煎饼"]).a === null && autoOut({ a: "pancakes" }, ["pancake", "煎饼"]).a === "word", "a clue inside the word is fine; the word inside the clue isn't");
}

// ---------- the pile ----------
const L = (...o) => o.map(outcome => ({ outcome }));
check(JSON.stringify(tally(L("right", "right", "pass"), 13)) === JSON.stringify({ won: 2, at: 3, lost: 1 }), "right wins the card, pass loses it");
check(JSON.stringify(tally(L("right", "wrong"), 13)) === JSON.stringify({ won: 1, at: 3, lost: 2 }), "wrong loses it and the next card");
check(JSON.stringify(tally(L(...Array(12).fill("right"), "wrong"), 13)) === JSON.stringify({ won: 11, at: 13, lost: 2 }), "wrong on the last card loses a card already won");
check(verdict(13, 13).startsWith("Every") && verdict(10, 13) === "Very good" && verdict(2, 13) === "Try again", "the verdict by the share won");

// ---------- a game ----------
const names = n => ["Korbi", "Mei", "Ana", "Bo", "Lin"].slice(0, n);
const givers = t => t.state.order.filter(u => u !== t.state.guesser);
async function clue(t, by) { for (const u of givers(t)) await t.send(t.seatOf(u), { clue: by(u) }); }
{
  const t = await partyTable(names(4));
  check(await t.start("echo", { lang: "en", cards: "8" }) && t.state.step === "clue" && t.state.cards === 8 && t.state.deck.length === 9, "Echo starts with four: eight cards");
  const g1 = t.state.guesser, word = WORDS[t.state.deck[t.state.card]];
  check(t.state.order.includes(g1) && /guesses/.test(t.branch.say.text), "one guesses, announced");
  const [a, b, c] = givers(t);
  await t.send(t.seatOf(a), { clue: "zzfirst" });
  check(t.state.step === "clue", "the clues wait for every clue-giver");
  await t.send(t.seatOf(b), { clue: "Zzfirst" });
  await t.send(t.seatOf(c), { clue: "zzother" });
  check(t.state.step === "check" && t.state.clues[a].why === "same" && t.state.clues[b].why === "same" && !t.state.clues[c].why, "the same clue twice cancels out, both copies (the database keeps no null: a clue that stands has no why)");
  // the table keeps one the phone cancelled, and cancels another
  await t.act(t.seatOf(c), st => { st.clues[a].keep = true; st.clues[c].cut = true; });
  await t.send(t.seatOf(c), { show: true });
  check(t.state.step === "guess" && /here are your clues: 1 of 3/.test(t.branch.say.text), "shown to the guesser: what the table left (1 of 3)");
  await t.send(t.seatOf(g1), { guess: word[0].toUpperCase() });
  check(t.state.step === "result" && t.state.log[0].outcome === "right" && /Right!/.test(t.branch.say.text), `a right guess wins the card (${word[0]})`);
  await t.tick(9500);
  const g2 = t.state.guesser;
  check(t.state.step === "clue" && g2 !== g1 && t.state.card === 1, "the next card, the next guesser");
  await clue(t, u => `clue${u}`);
  await t.send(t.seatOf(givers(t)[0]), { show: true });
  await t.send(t.seatOf(g2), { guess: "certainly not it" });
  check(t.state.log[1].outcome === "wrong" && /costs the next card/.test(t.branch.say.text), "a wrong guess, and the next card is lost too");
  await t.send(t.seatOf(g2), { count: true });
  check(t.state.log[1].outcome === "wrong", "the guesser can't count their own guess…");
  await t.send(t.seatOf(givers(t)[0]), { count: true });
  check(t.state.log[1].outcome === "right" && t.state.log[1].counted && tally(t.state.log, 8).won === 2, "…but a clue-giver can: right in other words");
  await t.tick(9500);
  const g3 = t.state.guesser;
  await clue(t, u => `x${u}`);
  await t.send(t.seatOf(givers(t)[0]), { show: true });
  await t.send(t.seatOf(g3), { pass: true });
  check(t.state.log[2].outcome === "pass" && tally(t.state.log, 8).at === 3, "a pass loses only this card");
  // play out the rest: right every time
  for (let i = 0; i < 12 && t.state.step !== "over"; i++) {
    if (t.state.step === "result") { await t.tick(9500); continue; }
    await clue(t, u => `y${u}`);
    await t.send(t.seatOf(givers(t)[0]), { show: true });
    await t.send(t.seatOf(t.state.guesser), { guess: WORDS[t.state.deck[t.state.card]][0] });
  }
  if (t.state.step === "result") await t.tick(9500);
  check(t.state.step === "over" && tally(t.state.log, 8).won === 7 && t.state.winners.length === 4 && /7 of 8/.test(t.branch.say.text), "the pile spent: 7 of 8, and the whole table wins");
}
{
  // the clock, Chinese words, and a guesser who leaves
  const t = await partyTable(names(4));
  await t.start("echo", { lang: "zh", clock: "60" });
  check(/[一-鿿]/.test(wordOf(t.state)) && !/[a-z]/i.test(wordOf(t.state)), "Chinese words alone when asked");
  await t.send(t.seatOf(givers(t)[0]), { clue: "某个" });
  await t.tick(61000);
  check(t.state.step === "check" && Object.values(t.state.clues).filter(c => c.why === "none").length === 2, "when the clock runs out, the clues not given count as none");
  check(rightGuess(t.state, WORDS[t.state.deck[t.state.card]][0]) && rightGuess(t.state, WORDS[t.state.deck[t.state.card]][1]), "a guess is right in either language");
  const g = t.state.guesser, card = t.state.card;
  await t.leave(t.seatOf(g));
  check(t.state.step === "clue" && t.state.card === card + 1 && t.state.guesser !== g && t.state.log[0].left, "a guesser who leaves loses the card, and the next one guesses");
}
{
  const t = await partyTable(names(2));
  check(!(await t.start("echo", {})), "Echo doesn't start with two");
}
check(echo.min === 3 && echo.options.some(o => o.id === "cards"), "three to play; a choice of 8, 13 or 20 cards");

console.log(bad ? `party-echo: ${bad} failed` : "party-echo: every check passed");
process.exit(bad ? 1 : 0);
