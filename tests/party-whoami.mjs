// Who am I? (party-whoami.js, its decks party-whoami-bank.js built from kb/), played in Node on the database in memory
// with the host's phone running it (tests/party-harness.js): the decks and their cribs; a guess right in any case, with
// more words, by surname, a letter off, by another name, and wrong when it's someone else; a game where a wrong guess
// passes the turn, a right one finishes a player, a player gives up, the others count a guess right in other words, and
// the game ends when one is left with the first to guess winning; the clock passing a turn; a player who leaves being
// skipped; the players writing each other's identities; a mix of the decks.
import { partyTable } from "./party-harness.js";
import { gameById } from "../party-core.js";
import whoami, { rightGuess, namesOf, cribOf, WRITE, MIXED } from "../party-whoami.js";
import { DECKS, WHO } from "../party-whoami-bank.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the decks ----------
const all = DECKS.flatMap(d => d.ids);
check(DECKS.length >= 8 && DECKS.every(d => d.ids.length >= 50 && d.name && d.a), `${DECKS.length} decks of 50 or more (${DECKS.map(d => `${d.name} ${d.ids.length}`).join(", ")})`);
check(new Set(all).size === all.length && all.every(id => WHO[id]), `${all.length} identities, each in one deck`);
check(all.every(id => WHO[id].n && WHO[id].c.length >= 1 && WHO[id].c.length <= 6 && WHO[id].c.every(c => c.length <= 110)), "each with a name and a crib of one to six lines, none overlong");
check(cribOf("zeus").some(c => /thunder/.test(c)) && cribOf("mona-lisa").some(c => /Leonardo/.test(c)) && cribOf("norway").length >= 4, "the crib says what kb/ knows: Zeus's thunder, the Mona Lisa's painter, Norway's clues");
check(gameById("whoami") === whoami && whoami.options[0].choices.length === DECKS.length + 2, "in Party's list, with a choice of every deck, a mix and writing your own");

// ---------- guesses ----------
const ok = (id, text, person = false) => rightGuess(namesOf({ id, n: WHO[id].n }), text, { person });
check(ok("napoleon", "napoleon") && ok("napoleon", "  NAPOLEON! ") && ok("napoleon", "Napolean"), "a guess is right in any case, with punctuation, or one letter off");
check(ok("einstein", "Albert Einstein") && ok("leonardo-da-vinci", "da Vinci", true) && ok("marie-curie", "Curie", true) && !ok("elvis", "Elvis Presley", true), "with a first name before the name, or by surname; a word after it is left to the others to count");
check(ok("zeus", "Jupiter") && ok("the-starry-night", "starry night") && ok("william-shakespeare", "Shakespeare"), "by another name: a god's Roman name, without 'the', a double's");
check(!ok("napoleon", "Caesar") && !ok("leonardo-da-vinci", "Leonardo DiCaprio", true) && !ok("the-starry-night", "night") && !ok("zeus", ""), "and wrong when it's someone else, a namesake, a fragment, or nothing");
check(rightGuess(["Ozzy Osbourne"], "ozzy") === false && rightGuess(["Ozzy Osbourne"], "Ozzy Osbourne") && rightGuess(["Ozzy Osbourne"], "Osbourne", { person: true }), "a written name is matched the same way");

// ---------- a game ----------
const names = n => ["Korbi", "Mei", "Ana", "Bo", "Lin"].slice(0, n);
const cur = t => t.state.order[t.state.turn];
const asker = t => t.seatOf(cur(t));
const done = (t, u) => t.state.done?.[u];                    // the database keeps no empty object: none done yet is none
const guess = (t, text, i = asker(t)) => t.send(i, { guess: text, turnNo: t.state.turnNo });
{
  const t = await partyTable(names(4));
  check(await t.start("whoami", { deck: "people" }) && t.state.step === "play", "Who am I? starts with four");
  const ids = Object.values(t.state.who).map(w => w.id);
  check(ids.length === 4 && new Set(ids).size === 4 && ids.every(id => DECKS[0].ids.includes(id)), "four different famous people dealt");
  check(t.state.turns[cur(t)] === 1 && /starts/.test(t.branch.say.text), "the first player's turn, announced");
  const first = cur(t);
  await guess(t, "Nobody at all");
  check(t.state.last?.right === false && cur(t) !== first && t.state.turns[cur(t)] === 1 && /No\./.test(t.branch.say.text), "a wrong guess: no, and the turn passes");
  const second = cur(t);
  await t.send(asker(t), { next: true, turnNo: t.state.turnNo });
  check(cur(t) !== second && !done(t, second), "Next player passes the turn");
  // the third player gets theirs right
  const third = cur(t), right = t.state.who[third].n;
  await guess(t, right.toUpperCase());
  check(done(t, third)?.how === "got" && done(t, third).rank === 1 && /Yes!/.test(t.branch.say.text), `a right guess (${right}): done, and first`);
  // a near guess the others count
  const fourth = cur(t), w = t.state.who[fourth];
  await guess(t, "the famous one");
  const no = t.state.last.no;
  check(t.state.last.right === false, "a guess in other words isn't right by itself…");
  await t.send(t.seatOf(fourth), { count: no });
  check(!done(t, fourth), "…the guesser can't count their own…");
  await t.send(t.seatOf(third), { count: no });
  check(done(t, fourth)?.how === "got" && t.state.last.counted && /Counted/.test(t.branch.say.text), "…but one of the others can");
  // two left: one gives up, and the game is over
  const fifth = cur(t);
  await t.send(t.seatOf(fifth), { giveup: true, turnNo: t.state.turnNo });
  check(t.state.step === "over" && done(t, fifth)?.how === "gave" && t.state.winners.join() === third, "a player gives up; one is left, and the first to guess wins");
  const last = t.state.order.find(u => !done(t, u));
  check(t.branch.say.text.includes(`${t.state.who[last].n}`) && t.branch.say.text.includes("got there first"), "the narrator says who got there first and who the last one was");
  check(Object.values(t.branch.tally).reduce((a, b) => a + b, 0) === 1, "one win counted for the evening");
}
{
  // the clock, and a player who leaves
  const t = await partyTable(names(3));
  await t.start("whoami", { deck: "countries", timer: "60" });
  const first = cur(t);
  await t.tick(30000);
  check(cur(t) === first, "the clock runs…");
  await t.tick(31000);
  check(cur(t) !== first && /Time's up/.test(t.branch.say.text), "…and passes the turn when it runs out");
  const leaver = t.state.order[(t.state.turn + 1) % 3];
  await t.leave(t.seatOf(leaver));
  await t.send(asker(t), { next: true, turnNo: t.state.turnNo });
  check(cur(t) !== leaver && t.state.step === "play" && t.state.order.length === 3, "someone who left the table is skipped");
}
{
  // the players write each other's identities
  const t = await partyTable(names(3));
  await t.start("whoami", { deck: WRITE });
  check(t.state.step === "write" && Object.keys(t.state.writes).length === 3, "You write them: each writes for the next player");
  const writes = { ...t.state.writes };
  for (let i = 0; i < 3; i++) await t.send(i, { write: ["Ozzy Osbourne", "The Eiffel Tower", "My dentist"][i] });
  check(t.state.step === "play" && t.state.who[writes[t.uid(0)]].n === "Ozzy Osbourne" && t.state.who[writes[t.uid(0)]].by === t.uid(0), "each gets what the player before wrote, and the game begins");
  const u = cur(t), mine = t.state.who[u].n;
  await guess(t, mine.toLowerCase().replace(/^the /, ""));
  check(done(t, u)?.how === "got", `a written identity is guessed as a dealt one is (${mine})`);
}
{
  const t = await partyTable(names(5));
  await t.start("whoami", { deck: MIXED });
  const decks = new Set(Object.values(t.state.who).map(w => DECKS.find(d => d.ids.includes(w.id)).id));
  check(Object.keys(t.state.who).length === 5 && decks.size >= 2, `a mix deals from the decks together (${[...decks].join(", ")})`);
}
{
  const t = await partyTable(names(1));
  check(!(await t.start("whoami", {})), "Who am I? doesn't start alone");
}

console.log(bad ? `party-whoami: ${bad} failed` : "party-whoami: every check passed");
process.exit(bad ? 1 : 0);
