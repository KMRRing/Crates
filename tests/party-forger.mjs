// Forger (party-forger.js), played in Node on the database in memory with the host's phone running it
// (tests/party-harness.js): the card in the table's language, a player's line kept as one stroke in their own colour,
// the vote (the most votes alone, a tie nobody); a game: everyone looking at their card, one line each twice round
// starting never with the forger, a line out of turn ignored and the clock passing a turn; the forger caught and naming
// the word, getting away on a tie, caught and naming it wrong; the points and the rounds, each a different forger;
// the end; a forger who leaves; once each as forger.
import { partyTable } from "./party-harness.js";
import forger, { cardOf, lineOf, accusedOf, POINTS, COLOURS } from "../party-forger.js";
import { encode, decode } from "../party-draw.js";
import { WORDS } from "../party-draw-words.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const NAMES = ["Korbi", "Mei", "Ana", "Bo", "Lin"];
const BY_ID = new Map(WORDS.map(w => [w.id, w]));
const list = x => (x ? Object.values(x) : []);

// ---------- the card, a line, the vote ----------
{
  const s = { word: "giraffe", lang: "en" };
  check(cardOf(s).kind === "An animal" && cardOf(s).word === "giraffe" && cardOf({ ...s, lang: "zh" }).word === "长颈鹿" && cardOf({ ...s, lang: "both" }).kind === "动物 · An animal",
    "the card in the table's language: the kind for everyone, the word for the artists");
  check(cardOf(s).answers.includes("长颈鹿") && cardOf({ ...s, lang: "zh" }).answers.includes("giraffe"), "the forger may name it in either language");
  const two = encode([{ c: 3, w: 2, p: [10, 10, 50, 50] }, { c: 3, w: 2, p: [90, 90, 95, 95] }]);
  const line = decode(lineOf(two, 6));
  check(line.length === 1 && line[0].c === 6 && line[0].w === 1 && line[0].p.join() === "10,10,50,50", "a line is one stroke, in the player's own colour and the medium pen");
  check(lineOf("", 1) === "" && lineOf("garbage!", 1) === "" && decode(lineOf(encode([{ c: 0, w: 0, p: [5, 5] }]), 1)).length === 1, "nothing drawn is no line; a dot is one (an eye, say)");
  check(accusedOf({ a: "x", b: "x", c: "y" }) === "x" && accusedOf({ a: "x", b: "y" }) === null && accusedOf({}) === null, "the most votes alone: a tie, or no votes, accuses nobody");
  check(new Set(COLOURS).size === 10, "ten players, ten colours");
}

// ---------- a game ----------
const drawRound = async t => {
  // every turn: the one whose line it is draws it (a stroke across the page) and taps Done
  while (t.state.step === "draw") {
    const u = list(t.state.turns)[t.state.turn], i = t.seatOf(u), y = 100 + 80 * t.state.turn;
    await t.send(i, { round: t.state.round, turn: t.state.turn, s: encode([{ c: 0, w: 1, p: [100, y, 900, y] }]), done: true });
  }
};
const voteAll = async (t, pick) => { for (const u of list(t.state.order)) if (t.seatOf(u) >= 0) await t.send(t.seatOf(u), { vote: pick(u), round: t.state.round }); };
{
  const t = await partyTable(NAMES.slice(0, 4));
  check(await t.start("forger", { rounds: "3" }) && t.state.step === "look" && t.state.rounds === 3, "Forger starts with four: everyone looks at their card");
  const forgers = list(t.state.forgers), w = BY_ID.get(t.state.word);
  check(new Set(forgers).size === 3 && t.state.forger === forgers[0] && w.level <= 2 && w.kind !== "doing", "three rounds, each a different forger; a word a line can begin to show");
  check(new Set(Object.values(t.state.colours)).size === 4 && /The kind: /.test(t.branch.say.text) && !t.branch.say.text.includes(w.en[0]), "each player their own colour; the kind said aloud, never the word");
  for (let i = 0; i < 4; i++) await t.send(i, { ready: true, round: 0 });
  const turns = list(t.state.turns);
  check(t.state.step === "draw" && turns.length === 8 && turns[0] !== t.state.forger && turns.slice(0, 4).join() === turns.slice(4).join() && new Set(turns).size === 4,
    "all ready: one line each, twice round, the forger never first");
  check(/starts: one line each, twice round/.test(t.branch.say.text), "the narrator says who starts");
  const first = turns[0], other = turns[1];
  await t.send(t.seatOf(other), { round: 0, turn: 0, s: encode([{ c: 0, w: 1, p: [0, 0, 500, 500] }]), done: true });
  check(t.state.turn === 0, "a line out of turn counts for nothing");
  await t.send(t.seatOf(first), { round: 0, turn: 0, s: encode([{ c: 0, w: 1, p: [0, 0, 500, 500] }]), done: false });
  check(t.state.turn === 0, "a line still being drawn is waited for");
  await t.send(t.seatOf(first), { round: 0, turn: 0, s: encode([{ c: 0, w: 1, p: [0, 0, 500, 500] }]), done: true });
  const l0 = list(t.state.lines)[0];
  check(t.state.turn === 1 && l0.by === first && decode(l0.s)[0].c === t.state.colours[first] && /line/.test(t.branch.say.text), "Done: the line is the drawing's, in its player's colour; the next player's turn");
  await t.tick(25000);
  check(t.state.turn === 2 && list(t.state.lines).length === 1, "the clock passes a turn with no line");
  await drawRound(t);
  check(t.state.step === "vote" && list(t.state.lines).length === 7 && /Who's the forger/.test(t.branch.say.text), "every line in: the vote");
  const f0 = t.state.forger;
  await t.send(t.seatOf(f0), { vote: f0, round: 0 });
  check(t.state.step === "vote", "nobody votes for themselves");
  await voteAll(t, u => (u === f0 ? list(t.state.order).find(x => x !== f0) : f0));
  check(t.state.step === "name" && t.state.caught && /is the forger/.test(t.branch.say.text), "the most votes on the forger: caught, and asked to name the word");
  await t.send(t.seatOf(f0), { guess: BY_ID.get(t.state.word).zh[0], round: 0 });
  check(t.state.step === "reveal" && t.state.won === "forger" && t.state.scores[f0] === POINTS.forger && /named it/.test(t.branch.say.text), "caught but named it (in Chinese at an English table): the forger wins, 2 points");
  for (let i = 0; i < 4; i++) await t.send(i, { next: true, round: 0 });
  check(t.state.round === 1 && t.state.step === "look" && t.state.forger === forgers[1] && t.state.word !== list(t.state.dealt)[0], "everyone's Next: round two, the next forger, another word");
  // round two: a tied vote lets the forger get away
  for (let i = 0; i < 4; i++) await t.send(i, { ready: true, round: 1 });
  await drawRound(t);
  const f1 = t.state.forger, others = list(t.state.order).filter(u => u !== f1);
  await voteAll(t, u => (u === others[0] ? others[1] : u === others[1] ? others[0] : others[0] === u ? f1 : u === f1 ? others[2] : others[1]));
  check(t.state.step === "reveal" && t.state.won === "forger" && !t.state.caught && t.state.scores[f1] >= POINTS.forger, "nobody with the most votes alone: the forger gets away");
  await t.tick(15000);
  // round three: caught, and the wrong word
  for (let i = 0; i < 4; i++) await t.send(i, { ready: true, round: 2 });
  await drawRound(t);
  const f2 = t.state.forger, before = { ...t.state.scores };
  await voteAll(t, u => (u === f2 ? list(t.state.order).find(x => x !== f2) : f2));
  await t.send(t.seatOf(f2), { guess: "definitely not it", round: 2 });
  check(t.state.won === "artists" && list(t.state.order).every(u => t.state.scores[u] - (before[u] || 0) === (u === f2 ? 0 : POINTS.artist)) && /The artists win/.test(t.branch.say.text),
    "caught and named it wrong: each artist scores 1");
  await t.tick(15000);
  check(t.state.step === "over" && list(t.state.winners).length >= 1 && /That's the game/.test(t.branch.say.text), "after the last round, the end and its winners");
}
{
  // a forger who leaves; once each as forger
  const t = await partyTable(NAMES);
  await t.start("forger", { rounds: "each", lang: "both" });
  check(t.state.rounds === 5 && new Set(list(t.state.forgers)).size === 5 && /·/.test(cardOf(t.state).word), "once each: five rounds, everyone the forger once; both languages on the card");
  for (let i = 0; i < 5; i++) await t.send(i, { ready: true, round: 0 });
  await t.leave(t.seatOf(t.state.forger));
  await drawRound(t);
  check(list(t.state.turns).length === 10 && t.state.step === "vote", "the forger's turns pass once they've gone");
  const f = t.state.forger;
  await voteAll(t, () => f);
  check(t.state.step === "reveal" && t.state.won === "artists", "a forger who's gone is caught and can't name it: the artists win");
}
{
  const t = await partyTable(NAMES.slice(0, 3));
  check(!(await t.start("forger", {})), "Forger doesn't start with three");
}
check(forger.min === 4 && forger.max === 10 && forger.keepsView, "four to ten players");

console.log(bad ? `party-forger: ${bad} failed` : "party-forger: every check passed");
process.exit(bad ? 1 : 0);
