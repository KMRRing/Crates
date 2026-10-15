// Who am I? (party-whoami.js, its decks party-whoami-bank.js built from kb/), played in Node on the database in memory
// with the host's phone running it (tests/party-harness.js): the decks and their cribs; the people dealt by their mark
// (for the party, for learning, or both), their cribs written by hand, those kb/ doesn't hold kept out of it; the mix
// leaving out the deck for learning and dealing each identity once; the look over the cards (a card
// rerolled when most of the others vote for it, with two players at one tap, its owner's vote not counting, a vote on
// the card it replaced not counting, never dealt one that's been dealt; the questions begin when everyone at the table
// is ready for the cards as they are, or the host starts them); the questions (Next from any phone, once a turn; the
// rounds counted as the turn comes round; the clock passing a turn; a player who leaves skipped); the end, every card
// told; the players writing each other's identities; a mix of the decks.
import { partyTable } from "./party-harness.js";
import { gameById } from "../party-core.js";
import whoami, { cribOf, needed, poolOf, WRITE, MIXED } from "../party-whoami.js";
import { DECKS, WHO } from "../party-whoami-bank.js";
import { PEOPLE } from "../kb/items/whoami.js";
import { ENTITIES } from "../kb/entities.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the decks ----------
const all = [...new Set(DECKS.flatMap(d => d.ids))];
const famous = DECKS.find(d => d.id === "people"), learn = DECKS.find(d => d.id === "learn");
const rest = DECKS.filter(d => d !== famous && d !== learn).flatMap(d => d.ids);
check(DECKS.length >= 8 && DECKS.every(d => d.ids.length >= 50 && d.name && d.a), `${DECKS.length} decks of 50 or more (${DECKS.map(d => `${d.name} ${d.ids.length}`).join(", ")})`);
check(all.every(id => WHO[id]) && new Set(rest).size === rest.length && rest.every(id => !famous.ids.includes(id) && !learn.ids.includes(id)),
  `${all.length} identities, each in one deck but the people marked for both`);

// ---------- the people ----------
const idOf = p => [p.kb ?? p.id].flat()[0], mark = new Map(PEOPLE.map(p => [idOf(p), p.for]));
check(famous === DECKS[0] && [...mark].every(([id, m]) => famous.ids.includes(id) === (m !== "learning") && learn.ids.includes(id) === (m !== "party"))
  && famous.ids.length + learn.ids.length === [...mark.values()].reduce((n, m) => n + (m === "both" ? 2 : 1), 0),
  `the people dealt by their mark: Famous people (${famous.ids.length}) those for the party, People worth knowing (${learn.ids.length}) those for learning, both in both`);
check(famous.ids.includes("taylor-swift") && !learn.ids.includes("taylor-swift") && learn.ids.includes("howqua") && !famous.ids.includes("howqua")
  && famous.ids.includes("napoleon") && learn.ids.includes("napoleon"), "Taylor Swift for the party, Howqua (a merchant of Canton) for learning, Napoleon for both");
const own = PEOPLE.filter(p => p.id).map(p => p.id), kb = new Set(ENTITIES.map(e => e.id));
check(own.length >= 50 && own.every(id => !kb.has(id)), `${own.length} people are Who am I's alone: kb/ doesn't hold them, so Punt and the rest never ask about them`);
check(PEOPLE.every(p => { const w = WHO[idOf(p)]; return w.n === p.n && w.c.length >= 4 && w.c.join("|") === p.c.join("|") && w.p; }),
  "every person's crib is the one written by hand, four lines or more, with a picture's page");
check(cribOf("neil-armstrong")[0] === "An American astronaut" && WHO["schwarzen-egger"].n === "Arnold Schwarzenegger" && WHO.napoleon.a?.includes("Napoleon"),
  "a person of kb/'s keeps kb/'s names as other names, not its lines (Neil Armstrong is no longer “a writer”)");
const mix = poolOf(MIXED);
check(new Set(mix).size === mix.length && mix.includes("napoleon") && mix.includes("taylor-swift") && mix.includes("norway") && !mix.includes("howqua")
  && rest.every(id => mix.includes(id)), `A mix leaves out People worth knowing, and deals each identity once (${mix.length})`);
check(all.every(id => WHO[id].n && WHO[id].c.length >= 1 && WHO[id].c.length <= 6 && WHO[id].c.every(c => c.length <= 110)), "each with a name and a crib of one to six lines, none overlong");
check(cribOf("zeus").some(c => /thunder/.test(c)) && cribOf("mona-lisa").some(c => /Leonardo/.test(c)) && cribOf("norway").length >= 4, "the crib says what kb/ knows: Zeus's thunder, the Mona Lisa's painter, Norway's clues");
check(gameById("whoami") === whoami && whoami.options[0].choices.length === DECKS.length + 2, "in Party's list, with a choice of every deck, a mix and writing your own");
check([1, 2, 3, 4, 5].map(needed).join() === "1,2,2,3,3", "a card is rerolled by most of the others: the other one of two, both of two, two of three, three of four or five");

// ---------- the look over the cards ----------
const names = n => ["Korbi", "Mei", "Ana", "Bo", "Lin"].slice(0, n);
const cur = t => t.state.order[t.state.turn];
const vote = (t, i, ...targets) => t.send(i, { votes: Object.fromEntries(targets.map(u => [u, t.state.rolls?.[u] || 0])) });
const ready = (t, i) => t.send(i, { ready: t.state.rerolls || 0 });
const used = t => Object.values(t.state.who).map(w => w.id);
{
  const t = await partyTable(names(4));
  check(await t.start("whoami", { deck: "people" }) && t.state.step === "look", "Who am I? starts with four, on a look over the cards");
  check(used(t).length === 4 && new Set(used(t)).size === 4 && used(t).every(id => DECKS[0].ids.includes(id)), "four different famous people dealt");
  const target = t.uid(0), before = t.state.who[target].id;
  await vote(t, 0, target);
  await vote(t, 1, target);
  check(t.state.who[target].id === before, "its owner's vote doesn't count, and one of the three others isn't most");
  await vote(t, 2, target);
  const after = t.state.who[target].id;
  check(after !== before && t.state.rolls[target] === 1 && /Korbi's card is dealt again/.test(t.branch.say.text), "two of the three others: the card is dealt again, and the narrator says whose (not who)");
  check(!t.branch.say.text.includes(WHO[after].n) && !t.branch.say.text.includes(WHO[before].n), "the narrator names neither the old card nor the new");
  check(new Set(used(t)).size === 4 && DECKS[0].ids.includes(after) && t.state.used.includes(before), "the new card from the same deck, nobody else's, and the old one kept out of the deal");
  await vote(t, 3, target);
  check(t.state.rolls[target] === 1 && t.state.who[target].id === after, "the votes on the card it replaced don't count for the new one");
  // everyone ready: the questions begin
  for (let i = 0; i < 3; i++) await ready(t, i);
  check(t.state.step === "look", "three ready of four: still looking");
  await ready(t, 3);
  check(t.state.step === "play" && t.state.turnNo === 1 && t.state.round === 0 && /starts/.test(t.branch.say.text), "all four ready: the first player's turn, announced, no rounds passed");

  // ---------- the questions ----------
  const first = cur(t);
  await t.send(t.seatOf(t.state.order[2]), { next: t.state.turnNo });
  check(cur(t) !== first && t.state.turnNo === 2 && /'s turn\./.test(t.branch.say.text), "Next from any phone passes the turn");
  const no = t.state.turnNo;
  await t.send(0, { next: no });
  await t.send(1, { next: no });
  check(t.state.turnNo === no + 1, "two phones tapping Next for one turn pass it once");
  await t.send(2, { next: t.state.turnNo });
  check(t.state.round === 0 && t.state.turn === 3, "the fourth player's turn, the first round not yet passed");
  await t.send(2, { next: t.state.turnNo });
  check(t.state.round === 1 && t.state.turn === 0 && /Round 2/.test(t.branch.say.text), "round the table and back to the first: a round passed, and the narrator says the round");
  // the end: every card told
  await t.send(0, { end: true });
  check(t.state.step === "over" && !t.state.winners?.length, "the host ends it: game over, no winner counted (the table says who guessed)");
  check(Object.values(t.state.who).every(w => t.branch.say.text.includes(w.n)), "the narrator says who everyone was");
  check(!Object.values(t.branch.tally || {}).length, "no win counted for the evening");
}
{
  // People worth knowing deals its own, and rerolls from them
  const t = await partyTable(names(4));
  await t.start("whoami", { deck: "learn" });
  const target = t.uid(0), before = t.state.who[target].id;
  for (let i = 1; i < 3; i++) await vote(t, i, target);
  check(used(t).every(id => learn.ids.includes(id)) && t.state.who[target].id !== before, "People worth knowing deals its own people, and deals one again from them");
}
{
  // two players: one tap rerolls the other's card
  const t = await partyTable(names(2));
  await t.start("whoami", { deck: "countries" });
  const other = t.uid(1), before = t.state.who[other].id;
  await vote(t, 0, other);
  check(t.state.who[other].id !== before && DECKS.find(d => d.id === "countries").ids.includes(t.state.who[other].id), "two players: one tap deals the other's card again, from the same deck");
}
{
  // a Ready from before a reroll doesn't count; the host can start
  const t = await partyTable(names(3));
  await t.start("whoami", { deck: "people" });
  await ready(t, 0);
  await ready(t, 1);
  const target = t.uid(0);
  await vote(t, 1, target);
  await vote(t, 2, target);
  check(t.state.rerolls === 1 && t.state.step === "look", "three players: both others vote, the card is dealt again");
  await ready(t, 2);
  check(t.state.step === "look", "a Ready from before the new card doesn't count: still looking");
  await ready(t, 0);
  await ready(t, 1);
  check(t.state.step === "play", "everyone ready for the cards as they are: the questions begin");
  const u = await partyTable(names(3));
  await u.start("whoami", { deck: "people" });
  await u.send(0, { start: true });
  check(u.state.step === "play", "the host's Start now begins the questions without waiting");
}
{
  // the clock, and a player who leaves
  const t = await partyTable(names(3));
  await t.start("whoami", { deck: "countries", timer: "60" });
  await t.send(0, { start: true });
  const first = cur(t);
  await t.tick(30000);
  check(cur(t) === first, "the clock runs…");
  await t.tick(31000);
  check(cur(t) !== first && /Time's up/.test(t.branch.say.text), "…and passes the turn when it runs out");
  const leaver = t.state.order[(t.state.turn + 1) % 3];
  await t.leave(t.seatOf(leaver));
  await t.send(t.seatOf(cur(t)), { next: t.state.turnNo });
  check(cur(t) !== leaver && t.state.step === "play", "someone who left the table is skipped");
}
{
  // the players write each other's identities: no look over the cards
  const t = await partyTable(names(3));
  await t.start("whoami", { deck: WRITE });
  check(t.state.step === "write" && Object.keys(t.state.writes).length === 3, "You write them: each writes for the next player");
  const writes = { ...t.state.writes };
  for (let i = 0; i < 3; i++) await t.send(i, { write: ["Ozzy Osbourne", "The Eiffel Tower", "My dentist"][i] });
  check(t.state.step === "play" && t.state.who[writes[t.uid(0)]].n === "Ozzy Osbourne" && t.state.who[writes[t.uid(0)]].by === t.uid(0), "each gets what the player before wrote, and the questions begin at once");
}
{
  const t = await partyTable(names(5));
  await t.start("whoami", { deck: MIXED });
  const decks = new Set(Object.values(t.state.who).map(w => DECKS.find(d => d.ids.includes(w.id)).id));
  check(Object.keys(t.state.who).length === 5 && decks.size >= 2, `a mix deals from the decks together (${[...decks].join(", ")})`);
  const target = t.uid(4);
  for (let i = 0; i < 3; i++) await vote(t, i, target);
  check(t.state.rolls[target] === 1 && all.includes(t.state.who[target].id), "five players: three of the four others reroll a card, from the mix");
}
{
  const t = await partyTable(names(1));
  check(!(await t.start("whoami", {})), "Who am I? doesn't start alone");
}

console.log(bad ? `party-whoami: ${bad} failed` : "party-whoami: every check passed");
process.exit(bad ? 1 : 0);
