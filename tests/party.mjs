// Party (party.js, party-core.js, table.js) and Undercover (party-undercover.js), played in Node on the database in
// memory with the host's phone running each game (tests/party-harness.js). The table seats everyone; a game starts
// with enough players and not with too few; Undercover deals the right number of undercovers and a blank only when
// asked and six or more play, its words in English, Chinese or both; a whole game where the table finds the
// undercover, and one where it doesn't; a tie voted again between those tied, and a second tie putting nobody out; a
// blank voted out guessing the word; a player who leaves mid-game not holding the others up; the evening's wins.
// What else a party plays: every table game and duo match listed has its page, its tile and room enough; which fit how
// many; the table a party deals (partners across a four-seat table), the addresses its phones follow and who follows
// them; a party of three seated at Bones in its own seats, the host running it, a latecomer in the computer's seat.
import { readFileSync, existsSync } from "node:fs";
import { partyTable } from "./party-harness.js";
import { roundTrip } from "./rtdb.js";
import { GAMES, gameById, seeded, shuffle, ELSEWHERE, playable, fits, seatsText, tableFrom } from "../party-core.js";
import { playHref, joins, whoOf } from "../party-href.js";
import { createTable, seated } from "../table.js";
import undercover, { undercoversFor, wordOf, rightGuess, winner } from "../party-undercover.js";
import { PAIRS } from "../party-undercover-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// every game a module the lobby can list
for (const g of GAMES) check(g.id && g.name && g.min >= 2 && g.max >= g.min && g.rules?.length && typeof g.start === "function" && typeof g.advance === "function" && typeof g.view === "function", `${g.name}: a complete party game (${g.min}–${g.max} players)`);
check(PAIRS.length >= 100 && PAIRS.every(p => p.length === 4 && p.every(w => typeof w === "string" && w.trim() === w && w.length) && p[0] !== p[1] && p[2] !== p[3]), `${PAIRS.length} word pairs, each two different words in English and in Chinese`);
check(new Set(PAIRS.map(p => p[0] + "|" + p[1])).size === PAIRS.length, "no pair twice");
check([3, 6, 7, 9, 10, 12].map(undercoversFor).join() === "1,1,2,2,3,3", "one undercover up to six players, two up to nine, three from ten");
{
  const rng = seeded(7), counts = Array(5).fill(0);
  for (let i = 0; i < 5000; i++) counts[shuffle([0, 1, 2, 3, 4], rng)[0]]++;
  check(counts.every(c => Math.abs(c - 1000) < 120), `a fair shuffle (${counts.join(", ")} of 5,000 first)`);
}

const names = n => ["Korbi", "Mei", "Ana", "Bo", "Lin", "Sam", "Wei", "Jo", "Kit", "Ray"].slice(0, n);
const roleOf = (t, r) => Object.keys(t.state.roles).filter(u => t.state.roles[u] === r);
async function everyoneReady(t) { for (let i = 0; i < t.seats.length; i++) if (t.state.alive.includes(t.uid(i))) await t.send(i, { ready: true }); }
async function describeAll(t) { while (t.state.step === "describe") await t.act(t.seatOf(t.state.order[t.state.turn]), st => { st.turn++; }); }
async function voteFor(t, pick) { for (const u of [...t.state.alive]) await t.send(t.seatOf(u), { vote: pick(u) }); }

{
  const t = await partyTable(names(4));
  check(t.players.length === 4 && t.players.every((p, i) => p.seat === i), "four sit down at the table, seats 0 to 3");
  check(!(await t.start("undercover", {})) === false && t.state?.step === "look", "Undercover starts with four");
  check(roleOf(t, "under").length === 1 && roleOf(t, "civ").length === 3 && !roleOf(t, "blank").length, "one undercover, three civilians, no blank");
  const civWord = wordOf(t.state, roleOf(t, "civ")[0]), underWord = wordOf(t.state, roleOf(t, "under")[0]);
  check(civWord !== underWord && roleOf(t, "civ").every(u => wordOf(t.state, u) === civWord) && / · /.test(civWord), `the civilians share a word, the undercover has the other, in both languages (${civWord} / ${underWord})`);
  check(t.branch.say?.text?.includes("look at your word"), "the narrator asks everyone to look at their word");
  await t.send(0, { ready: true });
  check(t.state.step === "look", "the game waits until everyone has seen their word");
  await everyoneReady(t);
  check(t.state.step === "describe" && t.state.order.length === 4 && t.state.round === 1, "then the round of descriptions, in an order of the four");
  check(t.branch.say.text.startsWith("Round 1."), "the narrator says who starts");
  await describeAll(t);
  check(t.state.step === "vote", "after the last description, the vote");
  const u = roleOf(t, "under")[0];
  await voteFor(t, v => (v === u ? t.state.alive.find(x => x !== u) : u));
  check(t.state.step === "out" && t.state.out.uid === u && t.state.out.role === "under", "the undercover voted out");
  await t.tick(3000);
  check(t.state.step === "out", "the result stands a few seconds");
  await t.tick(4000);
  check(t.state.step === "over" && t.state.won === "civ" && t.state.winners.length === 3, "and the civilians win");
  check(Object.values(t.branch.tally).reduce((a, b) => a + b, 0) === 3, "three wins counted for the evening");
  check(winner({ roles: { a: "civ", b: "under" }, alive: ["a", "b"] }) === "under", "an undercover as many as the civilians left wins");
}

{
  const t = await partyTable(names(6));
  await t.start("undercover", { lang: "zh" });
  await everyoneReady(t);
  await describeAll(t);
  const u = roleOf(t, "under")[0];
  check(!/[a-z]/i.test(wordOf(t.state, roleOf(t, "civ")[0])), "Chinese words alone when asked");
  // three tied on two votes each, voted again between them, tied again: nobody out
  const [a, b, c, d, e, f] = t.state.alive;
  const first = { [a]: b, [b]: a, [c]: a, [d]: b, [e]: c, [f]: c };
  await voteFor(t, v => first[v]);
  check(t.state.step === "revote" && [...t.state.tied].sort().join() === [a, b, c].sort().join(), "a tie is voted again between those tied");
  const again = { [a]: b, [b]: c, [c]: a, [d]: a, [e]: b, [f]: c };
  await voteFor(t, v => again[v]);
  check(t.state.step === "describe" && t.state.round === 2 && t.state.alive.length === 6, "a second tie puts nobody out, and the next round starts");
  // the civilians vote each other out until the undercover is as many as them
  let rounds = 0;
  while (t.state.step !== "over" && rounds++ < 8) {
    if (t.state.step === "describe") await describeAll(t);
    if (t.state.step === "vote") {
      const target = t.state.alive.find(x => x !== u);
      await voteFor(t, v => (v === target ? t.state.alive.find(x => x !== target) : target));
    }
    if (t.state.step === "out") await t.tick(7000);
  }
  check(t.state.step === "over" && t.state.won === "under" && t.state.winners.includes(u), "an undercover never found wins once as many as the civilians");
}

{
  const t = await partyTable(names(6));
  await t.start("undercover", { blank: "yes", lang: "en" });
  check(roleOf(t, "blank").length === 1 && roleOf(t, "under").length === 1 && wordOf(t.state, roleOf(t, "blank")[0]) === null, "with six and a blank asked for: one blank, with no word");
  await everyoneReady(t);
  await describeAll(t);
  const blank = roleOf(t, "blank")[0];
  await voteFor(t, v => (v === blank ? t.state.alive.find(x => x !== blank) : blank));
  await t.tick(7000);
  check(t.state.step === "guess", "the blank voted out gets to guess the word");
  const word = PAIRS[t.state.pair][t.state.civ];
  check(rightGuess(t.state, ` ${word.toUpperCase()}! `) && rightGuess(t.state, PAIRS[t.state.pair][2 + t.state.civ]) && !rightGuess(t.state, PAIRS[t.state.pair][1 - t.state.civ]), "a guess is right in either language, whatever its case, and wrong with the undercover's word");
  await t.send(t.seatOf(blank), { guess: word });
  check(t.state.step === "over" && t.state.won === "blank" && t.state.winners.join() === blank, "a right guess wins it for the blank alone");
}

{
  const t = await partyTable(names(5));
  await t.start("undercover", {});
  const leaver = 3;
  await t.leave(leaver);
  for (let i = 0; i < 5; i++) if (i !== leaver) await t.send(i, { ready: true });
  check(t.state.step === "describe" && !t.state.order.includes(t.uid(leaver)), "someone who leaves mid-game doesn't hold the others up");
  await t.end();
  check(!t.branch.game, "the host can end a game, back to the lobby");
  check(gameById("undercover").min === 3 && !(await t.start("nonsense")), "an unknown game doesn't start");
}
{
  const t = await partyTable(names(2));
  check(!(await t.start("undercover")) && !t.branch.game, "Undercover doesn't start with two");
}

// ---------- what else a party plays: the table games on their own pages, and duo matches for two ----------
{
  const apps = readFileSync(new URL("../apps.js", import.meta.url), "utf8");
  const duo = readFileSync(new URL("../suite.js", import.meta.url), "utf8").match(/DUO_GAMES = \{([^}]*)\}/)[1];
  for (const e of ELSEWHERE) {
    const page = existsSync(new URL(`../${e.page}`, import.meta.url));
    const tile = new RegExp(`id: "${e.id}",[^\\n]*logo:`).test(apps);
    let fitsPage = true;
    if (e.kind === "table") {
      const { rules } = await import(`../${e.id}-rules.js`);
      fitsPage = rules.seats.max >= e.max && (!e.across || rules.seats.min === 4);
    } else fitsPage = (e.max === 2 || /slots: g =>|createDuel\(/.test(readFileSync(new URL(`../${e.id}.js`, import.meta.url), "utf8"))) && new RegExp(`\\b${e.id === "glyph" ? "slate" : e.id}: "${e.page}"`).test(duo)
      && (!e.race || /createDuel\(/.test(readFileSync(new URL(`../${e.id}.js`, import.meta.url), "utf8")));
    check(page && tile && fitsPage && e.blurb, `${e.name}: its page, its tile, ${e.kind === "table" ? `a table of up to ${e.max}` : e.max > 2 ? `a duo match for up to ${e.max}` : "a duo match"}`);
  }
  check(new Set([...GAMES.map(g => g.id), ...ELSEWHERE.map(e => e.id)]).size === GAMES.length + ELSEWHERE.length, "no game listed twice");
  check(playable("echo").kind === "party" && playable("glyph").name === "Slate" && playable("bones").min === 1 && playable("crates").min === 2 && playable("nonsense") === null, "any of them found by its id");
  check(fits(playable("crates"), 2) && !fits(playable("crates"), 1) && !fits(playable("crates"), 3), "a duo match for two only");
  check(fits(playable("tribute"), 4) && fits(playable("hong"), 3) && !fits(playable("tribute"), 5) && !fits(playable("hong"), 1), "Tribute and Hong for two to four");
  check(fits(playable("bones"), 1) && fits(playable("bones"), 4) && !fits(playable("bones"), 5) && fits(playable("quest"), 9), "a table game up to its seats, the computer in the rest");
  check(!fits(playable("undercover"), 2) && fits(playable("undercover"), 3) && fits(playable("whoami"), 2), "Party's own between their least and most");
  check(seatsText(playable("crates")) === "2 players" && seatsText(playable("trumps")) === "1–4 players, the computer in any empty seat"
    && seatsText(playable("tribute")) === "2–4 players, the computer in any empty seat" && seatsText(playable("echo")) === "3–12 players"
    && seatsText(playable("rush")) === "2–6 players", "who plays each, in words");
}
{
  const party = { v: 1, host: "a", players: { a: { name: "Korbi", pid: "pa", seat: 0 }, b: { name: "Mei", pid: "pb", seat: 1 }, x: { online: false } } };
  const b = tableFrom(party, playable("trumps"), 5);
  check(b.v === 1 && b.host === "a" && b.players.a.seat === 0 && b.players.b.seat === 2 && b.players.a.pid === "pa" && !b.players.x,
    "two at a table of four sit across from each other, as partners; an offline mark without a seat isn't seated");
  check(Object.values(b.players).every(p => p.online === false && p.joined === 5) && !b.game, "each marked away until their phone sits down; no game until the host's page deals");
  check(JSON.stringify(roundTrip(b)) === JSON.stringify(b), "a table the database keeps as it is");
  const c = tableFrom({ ...party, players: { ...party.players, c: { name: "Ana", seat: 2 } } }, playable("bones"), 5);
  check([c.players.a.seat, c.players.b.seat, c.players.c.seat].join() === "0,1,2" && !c.players.c.pid, "otherwise in the party's order");
}
{
  const table = { id: "bones", kind: "table", page: "bones.html", at: 77, who: ["a", "b"], max: 4 };
  const duo = { id: "crates", kind: "duo", page: "crates.html", at: 88, who: { 0: "a", 1: "b" }, max: 2 };
  check(playHref(null, "ABCD") === "party.html?table=ABCD", "back to the party: its lobby");
  check(playHref(table, "ABCD") === "bones.html?table=ABCD&party=ABCD&at=77", "a table game: its table in the party's room, the party and the choice with it");
  check(playHref(duo, "ABCD") === "crates.html?room=ABCD&new=88&party=ABCD&at=88", "a duo match: the party's room, as a request said yes to");
  check(joins(table, "a") && joins(table, "c") && joins(duo, "b") && !joins(duo, "c") && !joins(null, "a"),
    "everyone in the party goes; one who came after, only to a table with a computer's seat");
  check(!joins({ ...table, who: ["a", "b", "c", "d"] }, "e") && whoOf(duo).join() === "a,b", "not to a full table; the list read back as the database may give it");
}
{
  // a party of three choosing Bones: the host's lobby deals the table, every phone's game page sits in its own seat,
  // and one who joins the party afterwards takes the computer's seat
  const t = await partyTable(names(3));
  const code = t.seats[0].code, at = 1_000_500;
  await t.db.device("u0").update(`crates/rooms/${code}`, { bones: tableFrom(t.branch, playable("bones"), at) });
  await t.seats[0].act(b => { b.playing = { id: "bones", kind: "table", page: "bones.html", at, who: t.players.map(p => p.uid), max: 4 }; });
  await t.settle();
  check(t.seats.every(s => s.data.playing?.page === "bones.html"), "every phone in the lobby sees the party's choice");
  const pages = [0, 1, 2].map(i => createTable({ game: "bones", app: 1, max: 4, sync: t.db.device(`u${i}`) }));
  for (const [i, p] of pages.entries()) check(await p.join(code, { name: names(3)[i], pid: `p${i}` }) === "ok", `${names(3)[i]}'s phone sits down at the party's table`);
  await t.settle();
  const seats = seated(pages[0].data);
  check(seats.map(p => `${p.name}@${p.seat}`).join() === "Korbi@0,Mei@1,Ana@2" && seats.every(p => p.online === true), "each in their seat from the party, here");
  check(pages[0].me.host && pages[0].me.driver && !pages[1].me.host, "the party's host hosts it, and runs it");
  const late = createTable({ game: "bones", app: 1, max: 4, sync: t.db.device("u9") });
  const r = await late.join(code, { name: "Bo", pid: "p9" });
  await t.settle();
  check(r === "ok" && late.me?.seat === 3, "one who came after takes the empty seat");
}

console.log(bad ? `party: ${bad} failed` : "party: every check passed");
process.exit(bad ? 1 : 0);
