// Quest (quest-rules.js) on seats.js: the roles dealt for each table (the traitors' count, the specials chosen, those
// with no room dropped) and what each knows; the parties' sizes; a quest (the leader names a party, everyone votes
// in turn round from the leader, unseen until all are in; approved, it sets out; the loyal can only succeed; one fail
// fails it, two the fourth from seven players); refusals (the lead passes, the fifth hands it to the traitors); the
// end (three quests either way, and the traitors' strike at the Seer, made by a person among them when there is one);
// the table's talk (accusing, trusting, taking it back, its limits, the traitors naming the Seer); the state through
// the database; the computer players (legal in every step, whole games at every size, with every role, at both levels;
// the loyal reason from what they can know and what's said, the traitors fail together only when they must; their own
// talk always fit to be said, the Seer's never a lie, the strike going with the traitors' names and finding a Seer who
// gave themselves away).
import { rules, dealRoles, knowledge, EVIL_COUNT, SIZES, SHOW_MS, isEvil, talk, stances, named, striker, TALK_MAX } from "../quest-rules.js";
import { questBot, questChat, suspicion, LEVEL_NAMES } from "../quest-bot.js";
import { newRecord, applyMove, applyWake, botMove, seeded, mix } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const T = 1_000_000;
const move = (G, seat, m, now = T) => { const r = applyMove(rules, G, seat, m, now); if (r.error) throw new Error(`${r.error} (${JSON.stringify(m)})`); return r.G; };
const wake = (G, now) => applyWake(rules, G, now) || G;
const count = (roles, f) => roles.filter(f).length;

// ---------- the roles ----------
{
  let ok = true;
  for (let n = 5; n <= 10; n++) for (let k = 0; k < 20; k++) {
    const roles = dealRoles(n, { guardian: true, veiled: true, hermit: true }, seeded(n * 100 + k));
    if (roles.length !== n || count(roles, isEvil) !== EVIL_COUNT[n] || !roles.includes("seer") || !roles.includes("assassin")) ok = false;
  }
  check(ok, "every table from five to ten: the right count of traitors, the Seer and the Assassin among them");
  const five = dealRoles(5, { guardian: true, veiled: true, hermit: true }, seeded(1));
  check(count(five, isEvil) === 2 && five.includes("impostor") && !five.includes("veiled") && !five.includes("hermit") && five.includes("guardian"), "five players have room for two traitors' roles: the last chosen (the Hermit, the Veiled) go");
  const ten = dealRoles(10, { guardian: true, veiled: true, hermit: true }, seeded(2));
  check(["assassin", "impostor", "veiled", "hermit"].every(r => ten.includes(r)) && count(ten, r => r === "loyal") === 4, "ten have room for all four, beside six loyal (the Seer, the Guardian and four knights)");
  const plain = dealRoles(7, { seer: false, guardian: true, veiled: true }, seeded(3));
  check(!plain.some(r => ["seer", "assassin", "guardian", "impostor", "veiled"].includes(r)) && count(plain, r => r === "traitor") === 3, "with no Seer, no Assassin, Guardian, Impostor or Veiled either: plain traitors and knights");
  const hermitOnly = dealRoles(6, { seer: false, hermit: true }, seeded(4));
  check(hermitOnly.includes("hermit") && count(hermitOnly, r => r === "traitor") === 1, "the Hermit needs no Seer");
}
{
  const roles = ["seer", "guardian", "loyal", "assassin", "impostor", "veiled", "hermit", "loyal", "loyal", "loyal"];
  const k = seat => knowledge(roles, seat);
  check(JSON.stringify(k(0)) === JSON.stringify({ 3: "evil", 4: "evil", 6: "evil" }), "the Seer knows the traitors, all but the Veiled (the Hermit too)");
  check(JSON.stringify(k(1)) === JSON.stringify({ 0: "seer?", 4: "seer?" }), "the Guardian knows the Seer and the Impostor, not which is which");
  check(Object.keys(k(2)).length === 0, "a knight knows nobody");
  check(JSON.stringify(k(3)) === JSON.stringify({ 4: "evil", 5: "evil" }) && JSON.stringify(k(5)) === JSON.stringify({ 3: "evil", 4: "evil" }), "the traitors know each other, all but the Hermit");
  check(Object.keys(k(6)).length === 0, "the Hermit knows nobody");
}
check(Object.entries(SIZES).every(([n, s]) => s.length === 5 && s.every(x => x >= 2 && x < Number(n))) && SIZES[5].join() === "2,3,2,3,3" && SIZES[10].join() === "3,4,4,5,5", "five quests each, their parties smaller than the table");

// ---------- a game, step by step ----------
/** A table with the roles laid out as given (the deal's shuffle replaced), and its leader. */
function table(roles, leader = 0, options = {}) {
  const G = newRecord(rules, { seats: roles.length, options, seed: 5, now: T });
  G.state.roles = roles.slice();
  G.state.leader = leader;
  return G;
}
/** Everyone still to vote votes, in turn, as votes[seat] says. */
function voteAll(G, votes) {
  while (G.state.step === "vote") { const p = rules.toMove(G.state); G = move(G, p, { t: "vote", yes: votes[p] }); }
  return G;
}
{
  const roles = ["seer", "loyal", "loyal", "assassin", "traitor"];
  let G = newRecord(rules, { seats: 5, options: {}, seed: 11, now: T });
  check(G.state.step === "propose" && G.state.quests.length === 5 && G.state.quests.every(q => !q.two) && rules.toMove(G.state) === G.state.leader, "a game opens with the leader naming the first party");
  check(/Look at your role/.test(G.say.text) && /\{s\d\}/.test(G.say.text), "and the narrator says who leads");
  G = table(roles, 1);
  check(applyMove(rules, G, 1, { t: "team", team: [1, 2, 3] }).error && applyMove(rules, G, 1, { t: "team", team: [1, 1] }).error && applyMove(rules, G, 2, { t: "team", team: [1, 2] }).error, "a party of the wrong size, the same one twice, or named by anyone but the leader: refused");
  G = move(G, 1, { t: "team", team: [2, 1] });
  check(G.state.step === "vote" && G.state.team.join() === "1,2" && rules.toMove(G.state) === 2, "the party named, the votes start with the one after the leader");
  check(applyMove(rules, G, 2, { t: "vote", yes: "yes" }).error && applyMove(rules, G, 0, { t: "vote", yes: true }).error, "a vote is yes or no, in turn");
  G = move(G, 2, { t: "vote", yes: true });
  check(G.state.votes[2] === true && G.state.step === "vote" && G.state.log.length === 0, "a vote is kept, and nothing shows until all are in");
  for (const [p, y] of [[3, false], [4, false], [0, true]]) G = move(G, p, { t: "vote", yes: y });
  check(rules.toMove(G.state) === 1, "round the table to the leader last");
  G = move(G, 1, { t: "vote", yes: true });
  check(G.state.step === "shown" && G.state.show === "vote" && G.state.log[0].approved && G.state.log[0].votes.join() === "true,true,true,false,false" && rules.wakeAt(G.state) === T + SHOW_MS, "all in: three to two, approved, shown for a moment");
  G = wake(G, T + SHOW_MS);
  check(G.state.step === "quest" && rules.toMove(G.state) === 1, "then the party sets out");
  check(applyMove(rules, G, 1, { t: "card", success: false }).error === "The loyal can only succeed", "the loyal can only succeed");
  G = move(G, 1, { t: "card", success: true });
  G = move(G, 2, { t: "card", success: true });
  check(G.state.step === "shown" && G.state.quests[0].result === "success" && G.state.quests[0].fails === 0 && G.state.log[0].fails === 0, "two successes: the quest succeeds");
  G = wake(G, T + 2 * SHOW_MS);
  check(G.state.step === "propose" && G.state.q === 1 && G.state.leader === 2 && G.state.rejects === 0, "the next quest, the lead passed on");
  // quest 2: a traitor fails it
  G = move(G, 2, { t: "team", team: [2, 3, 4] });
  G = voteAll(G, [true, true, true, true, true]);
  G = wake(G, T + 3 * SHOW_MS);
  G = move(G, 2, { t: "card", success: true });
  G = move(G, 3, { t: "card", success: false });
  G = move(G, 4, { t: "card", success: true });
  check(G.state.quests[1].result === "fail" && G.state.quests[1].fails === 1 && /fails: 1 fail/.test(G.say.text), "one fail fails it, and only the count is told");
  check(JSON.stringify(Object.keys(G.state.cards)) === JSON.stringify(["2", "3", "4"]), "the cards are kept by seat for the party only");
  // refusals: the lead passes; five in a row and the traitors win
  G = wake(G, T + 4 * SHOW_MS);
  let t = T + 4 * SHOW_MS;
  for (let r = 0; r < 4; r++) {
    const leader = G.state.leader;
    G = move(G, leader, { t: "team", team: [0, 1, 2].slice(0, G.state.quests[G.state.q].size) });
    G = voteAll(G, [false, false, false, false, false]);
    t += SHOW_MS;
    G = wake(G, t);
    if (r === 0) check(G.state.rejects === 1 && G.state.leader === (leader + 1) % 5 && G.state.step === "propose", "refused: the lead passes on");
  }
  check(G.state.rejects === 4, "four refused in a row");
  G = move(G, G.state.leader, { t: "team", team: [0, 1, 2].slice(0, G.state.quests[G.state.q].size) });
  G = voteAll(G, [false, false, false, false, false]);
  check(/Rejected/.test(G.say.text), "the fifth refused");
  G = wake(G, t + SHOW_MS);
  check(G.state.step === "over" && G.state.side === "evil" && G.state.why === "rejects" && G.state.winners.join() === "3,4", "five refused in a row: the traitors win at once");
}
{
  // three successes, then the Assassin; and the fourth quest at seven needs two fails
  const roles = ["seer", "loyal", "loyal", "loyal", "assassin", "traitor", "traitor"];
  let G = table(roles, 0), t = T;
  const quest = (team, cards) => {
    G = move(G, G.state.leader, { t: "team", team });
    G = voteAll(G, roles.map(() => true));
    G = wake(G, (t += SHOW_MS));
    for (const p of G.state.team) G = move(G, p, { t: "card", success: cards[p] ?? true });
    G = wake(G, (t += SHOW_MS));
  };
  check(G.state.quests[3].two && !G.state.quests[2].two, "from seven players the fourth quest needs two fails");
  quest([0, 1], {});
  quest([0, 1, 2], {});
  quest([0, 4, 5], { 4: false });
  check(G.state.quests.filter(q => q.result === "success").length === 2 && G.state.quests[2].result === "fail", "two won, one lost");
  quest([1, 2, 3, 4], { 4: false });
  check(G.state.quests[3].result === "success" && G.state.quests[3].fails === 1, "the fourth: one fail isn't enough");
  check(G.state.step === "assassin" && rules.toMove(G.state) === 4 && /traitors may yet name the Seer/.test(G.say.text), "three won: the traitors may yet name the Seer, the Assassin (played by a person) striking");
  check(applyMove(rules, G, 4, { t: "kill", seat: 4 }).error && applyMove(rules, G, 4, { t: "kill", seat: 5 }).error === "Name one of the loyal" && applyMove(rules, G, 1, { t: "kill", seat: 0 }).error, "the strike is at one of the loyal (the traitors know each other now), and only the one who strikes makes it");
  const miss = move(G, 4, { t: "kill", seat: 1 });
  check(miss.state.step === "over" && miss.state.side === "good" && miss.state.why === "safe" && miss.state.winners.join() === "0,1,2,3" && miss.state.striker === 4 && /The traitors name \{s1\}, but the Seer was \{s0\}/.test(miss.say.text), "named wrongly: the loyal win");
  const hit = move(G, 4, { t: "kill", seat: 0 });
  check(hit.state.side === "evil" && hit.state.why === "assassin" && hit.state.winners.join() === "4,5,6", "the Seer named: the traitors win");
  const back = rules.restore(roundTrip(structuredClone(G.state)));
  check(back.quests.every((q, i) => q.result === G.state.quests[i].result && (q.team || []).join() === (G.state.quests[i].team || []).join()) && back.log.length === G.state.log.length && back.log.every(l => l.votes.length === 7), "the state comes back whole from the database");
}
{
  // no Seer: three quests won is the win; three failed the traitors'
  const roles = ["loyal", "loyal", "loyal", "traitor", "traitor"];
  let G = table(roles, 0, { seer: false }), t = T;
  const quest = (team, fail) => {
    G = move(G, G.state.leader, { t: "team", team });
    G = voteAll(G, roles.map(() => true));
    G = wake(G, (t += SHOW_MS));
    for (const p of G.state.team) G = move(G, p, { t: "card", success: !(fail && isEvil(roles[p])) });
    G = wake(G, (t += SHOW_MS));
  };
  for (const team of [[0, 1], [0, 1, 2], [0, 1]]) quest(team, false);
  check(G.state.step === "over" && G.state.side === "good" && G.state.why === "quests", "with no Seer to find, three quests won win it");
  G = table(roles, 0, { seer: false }); t = T;
  for (const team of [[0, 3], [0, 1, 4], [3, 4]]) quest(team, true);
  check(G.state.side === "evil" && G.state.why === "quests" && G.state.winners.join() === "3,4", "three failed: the traitors win");
}
{
  // the state between any two steps survives the database
  let G = table(["seer", "loyal", "guardian", "assassin", "impostor", "loyal", "loyal", "veiled"], 2), ok = true;
  G = move(G, 2, { t: "team", team: [2, 3, 5] });
  for (const v of [true, false, true]) { G = move(G, rules.toMove(G.state), { t: "vote", yes: v }); }
  const mid = rules.restore(roundTrip(structuredClone(G.state)));
  if (mid.votes.length !== 8 || mid.votes.filter(x => x === null).length !== 5 || mid.team.join() !== "2,3,5") ok = false;
  G = voteAll(G, Array(8).fill(true).map((_, i) => i !== 0));
  G = wake(G, T + SHOW_MS);
  G = move(G, 2, { t: "card", success: true });
  const q = rules.restore(roundTrip(structuredClone(G.state)));
  if (q.cards[2] !== true || q.cards[3] !== null || q.cards[5] !== null || Object.keys(q.cards).length !== 3) ok = false;
  check(ok, "a vote half given and a quest half played come back from the database (nulls and all)");
}

// ---------- the table's talk ----------
/** A word said, on a copy (as the page says it: the state read back first). */
const say = (s, seat, m) => talk(rules.restore(structuredClone(s)), seat, m);
const said = (s, seat, m) => { const r = say(s, seat, m); if (typeof r === "string") throw new Error(`${r} (${JSON.stringify(m)})`); return r; };
{
  const roles = ["seer", "loyal", "loyal", "assassin", "traitor", "loyal", "loyal"];      // seven: three traitors
  let s = table(roles, 0).state;
  s = said(s, 1, { t: "accuse", seat: 3 });
  check(s.talk.length === 1 && s.talk[0].by === 1 && s.talk[0].seat === 3 && s.talk[0].k === 0 && stances(s)[1][3] === "accuse", "anyone may accuse another, whenever: the line kept with how many parties had been voted on");
  check(say(s, 1, { t: "accuse", seat: 3 }) === "You accuse them already" && say(s, 1, { t: "accuse", seat: 1 }) === "Choose another player" && say(s, 1, { t: "trust", seat: 9 }) === "Choose another player"
    && say(s, 2, { t: "drop", seat: 3 }) === "You've said nothing of them" && typeof say(s, 2, { t: "shout", seat: 3 }) === "string", "not twice, not of yourself or a seat that isn't there, nothing to take back unsaid, nothing but accuse, trust or take back");
  s = said(s, 1, { t: "trust", seat: 3 });
  check(stances(s)[1][3] === "trust", "trusting one you accused turns your word");
  s = said(s, 1, { t: "drop", seat: 3 });
  check(stances(s)[1][3] === undefined && s.talk.length === 3, "and taking it back leaves no word at all");
  for (const x of [2, 3, 4]) s = said(s, 0, { t: "accuse", seat: x });
  check(/as many as there are traitors/.test(say(s, 0, { t: "accuse", seat: 5 })) && typeof say(s, 0, { t: "trust", seat: 5 }) !== "string", "no more accused than there are traitors (three at seven)");
  for (const x of [1, 2, 3]) s = said(s, 6, { t: "trust", seat: x });
  check(/all the others who can be loyal/.test(say(s, 6, { t: "trust", seat: 4 })), "and no more trusted than the others who can be loyal (three, beside yourself)");
  s = said(s, 3, { t: "deny", seat: 0, why: "back" });
  check(s.talk.at(-1).why === "back" && say(s, 3, { t: "deny" }) === "You've said so" && said(s, 4, { t: "accuse", seat: 0, why: "nonsense" }).talk.at(-1).why === undefined, "a word back (not me), not twice running; a reason kept only from those the page can word");
  check(say(s, 3, { t: "name", seat: 0 }) === "Accuse a player, or say you trust them", "nobody names the Seer before the traitors confer");
  check(rules.toMove(s) === 0 && s.step === "propose", "and no word moves the game: whose turn it is stays");
  const back = rules.restore(roundTrip(structuredClone(s)));
  check(back.talk.length === s.talk.length && back.talk.every((l, i) => JSON.stringify(l) === JSON.stringify(s.talk[i])) && back.people.length === 7, "the talk comes back whole from the database (seat 0 and no party yet too)");
  check(say({ ...structuredClone(s), step: "over" }, 1, { t: "accuse", seat: 2 }) === "The game is over", "none once the game is over");
}
{
  // the strike is the traitors' to agree on: whoever a person plays among them makes it
  const roles = ["seer", "loyal", "traitor", "loyal", "assassin", "loyal", "impostor"];
  /** Three quests won, the seats in `people` played by persons (their moves carry no bot), the rest by the computer. */
  const won = people => {
    let G = table(roles, 0), t = T;
    for (let i = 0; i < 400 && G.state.step !== "assassin"; i++) {
      const at = rules.wakeAt(G.state);
      if (at != null) { G = wake(G, at); continue; }
      const p = rules.toMove(G.state), st = G.state.step;
      const m = st === "propose" ? { t: "team", team: [0, 1, 3, 5].slice(0, G.state.quests[G.state.q].size) } : st === "vote" ? { t: "vote", yes: true } : { t: "card", success: true };
      G = move(G, p, people.includes(p) ? m : { ...m, bot: true }, (t += 1));
    }
    return G;
  };
  const a = won([2]);
  check(a.state.step === "assassin" && a.state.people[2] && !a.state.people[4] && striker(a.state) === 2 && rules.toMove(a.state) === 2, "the computer plays the Assassin, a person a traitor: the strike is that person's");
  check(striker(won([2, 4]).state) === 4 && striker(won([6, 2]).state) === 6 && striker(won([]).state) === 4 && striker(won([0, 1]).state) === 4,
    "a person playing the Assassin strikes; else the first traitor a person plays round from the Assassin; with no person among the traitors, the computer's Assassin");
  // the computer taking a person's seat (gone a while) takes the strike with it
  const away = structuredClone(a.state); away.people[2] = false;
  check(striker(away) === 4, "a seat the computer has played since is the computer's again");
  let s = a.state;
  check(say(s, 1, { t: "name", seat: 3 }) === "The traitors are choosing whom to strike" && say(s, 6, { t: "name", seat: 4 }) === "Name one of the loyal" && say(s, 6, { t: "accuse", seat: 1 }) === "Name the one you think is the Seer", "while they confer only the traitors speak, and only to name one of the loyal");
  s = said(s, 6, { t: "name", seat: 1 });
  check(named(s)[6] === 1 && say(s, 6, { t: "name", seat: 1 }) === "You've named them" && named(said(s, 6, { t: "name", seat: 3 }))[6] === 3, "a traitor names one, and may change their mind");
  // the computer's strike goes with the name most of them gave
  let c = won([]).state;
  c = said(c, 2, { t: "name", seat: 3 }); c = said(c, 6, { t: "name", seat: 3 }); c = said(c, 4, { t: "name", seat: 1 });
  let follows = true;
  for (let i = 0; i < 20; i++) if (questBot(c, 4, "medium", seeded(i)).seat !== 3) follows = false;
  check(follows, "the computer's Assassin strikes the one most of the traitors named");
}

// ---------- the computer players ----------
{
  check(LEVEL_NAMES.map(l => l[0]).join() === "easy,medium", "two levels: Easy and Sharp");
  const roles = ["seer", "loyal", "loyal", "assassin", "traitor", "loyal", "loyal"];
  const G = table(roles, 3);
  const team = questBot(G.state, 3, "medium", seeded(1)).team;
  check(team.length === 2 && team.includes(3) && !team.includes(4), "a traitor leading takes itself along, not another traitor");
  // the fourth quest needs two fails: a traitor leading takes one more of its own
  const g4 = structuredClone(G.state);
  g4.q = 3; g4.quests.forEach((q, i) => { if (i < 3) Object.assign(q, { result: i === 1 ? "fail" : "success", fails: i === 1 ? 1 : 0, team: [0, 1] }); });
  const t4 = questBot(g4, 3, "medium", seeded(2)).team;
  check(t4.length === 4 && t4.includes(3) && t4.includes(4), "for the quest that needs two fails, it brings another of its own");
  // a quest with two of them on it, one fail enough: only one fails
  const q = structuredClone(G.state);
  Object.assign(q, { step: "quest", q: 1, team: [0, 3, 4], cards: { 0: null, 3: null, 4: null } });
  let both = 0;
  for (let i = 0; i < 200; i++) { const a = questBot(q, 3, "medium", seeded(i)).success, b = questBot(q, 4, "medium", seeded(i + 999)).success; if (!a && !b) both++; if (!b) both += 100; }
  check(both === 0, "two traitors on a quest one fail fails: the second round the table never fails it too");
  // the Seer's knowledge: it doesn't approve a party it knows is foul every time, and approves clean ones mostly
  const vote = structuredClone(G.state);
  Object.assign(vote, { step: "vote", q: 1, team: [1, 2, 3], votes: Array(7).fill(null), leader: 1 });
  let yes = 0;
  for (let i = 0; i < 200; i++) if (questBot(vote, 0, "medium", seeded(i)).yes) yes++;
  check(yes < 160, `the Seer doesn't wave a traitor's party through as a knight might (${yes} of 200)`);
  check(questBot(vote, 2, "medium", seeded(3)).yes === true || questBot(vote, 2, "medium", seeded(4)).yes === true, "a knight with nothing to go on approves a first party with itself in it");
  // the fifth party: the loyal approve, the traitors refuse a clean one
  const fifth = structuredClone(vote);
  Object.assign(fifth, { rejects: 4, team: [0, 1, 2] });
  check(questBot(fifth, 5, "medium", seeded(5)).yes === true && questBot(fifth, 4, "medium", seeded(6)).yes === false, "the fifth party: a knight approves it, a traitor refuses a clean one");
  // the Assassin names one it doesn't know for a traitor
  const end = structuredClone(G.state);
  end.step = "assassin";
  let fine = true;
  for (let i = 0; i < 40; i++) { const k = questBot(end, 3, "medium", seeded(i)).seat; if (k === 3 || k === 4 || !(k >= 0 && k < 7)) fine = false; }
  check(fine, "the Assassin never names itself or another traitor");
}
{
  // what's said weighs: on whom, and by whom
  const roles = ["seer", "loyal", "loyal", "assassin", "traitor", "loyal", "loyal"];
  const s0 = table(roles, 2).state;
  const accused = [5, 6].reduce((s, by) => said(s, by, { t: "accuse", seat: 1 }), s0);
  check(suspicion(accused, 2)[1] > suspicion(s0, 2)[1] + 0.03, `a knight suspects the one two others accuse more (${suspicion(s0, 2)[1].toFixed(2)} → ${suspicion(accused, 2)[1].toFixed(2)})`);
  let left = true;
  for (let i = 0; i < 30; i++) if (questBot(accused, 2, "medium", seeded(i)).team.includes(1)) left = false;
  check(left, "and, leading, leaves them out of the party");
  // a player on a failed quest of two with the knight is all but caught: their accusation counts for its target
  const g = structuredClone(s0);
  Object.assign(g, { q: 1, leader: 3 });
  g.quests[0] = { ...g.quests[0], result: "fail", fails: 1, team: [2, 4] };
  g.log = [{ q: 0, leader: 2, team: [2, 4], votes: [true, true, true, true, true, true, true], approved: true, fails: 1 }];
  const smear = said(g, 4, { t: "accuse", seat: 6 });
  check(suspicion(g, 2)[4] > 0.95 && suspicion(smear, 2)[6] < suspicion(g, 2)[6], `an accusation from the one it caught makes the knight think better of its target (${suspicion(g, 2)[6].toFixed(2)} → ${suspicion(smear, 2)[6].toFixed(2)})`);
}
{
  // their own talk: nothing before the first vote; accused, a word back decided once; a word of their own a party
  const roles = ["seer", "loyal", "loyal", "assassin", "traitor", "loyal", "loyal"];
  const s0 = table(roles, 2).state;
  check([0, 1, 2, 3, 4, 5, 6].every(p => questChat(s0, p, "medium", seeded(p)) === null), "before the first party is voted on, nobody says anything of their own");
  let back = 0, same = true;
  for (let by = 0; by < 7; by++) for (let at = 0; at < 7; at++) {
    if (by === at) continue;
    const s = said(s0, by, { t: "accuse", seat: at }), m = questChat(s, at, "medium", seeded(by * 7 + at));
    if (JSON.stringify(m) !== JSON.stringify(questChat(s, at, "medium", seeded(99)))) same = false;
    if (m && !(m.t === "deny" || (m.t === "accuse" && m.seat === by && m.why === "back"))) same = false;
    if (m?.t === "accuse") back++;
  }
  check(same && back > 0, `accused, a player answers the accuser or lets it pass, the same however it's asked (${back} of 42 accused back)`);
  // a party in: someone with a strong view says it, then waits for the next
  const g = structuredClone(s0);
  Object.assign(g, { q: 1, leader: 3 });
  g.quests[0] = { ...g.quests[0], result: "fail", fails: 1, team: [2, 4] };
  g.log = [{ q: 0, leader: 2, team: [2, 4], votes: [true, true, true, true, true, true, true], approved: true, fails: 1 }];
  let w = null;
  for (let i = 0; i < 20 && !w; i++) w = questChat(g, 2, "medium", seeded(i));
  check(w?.t === "accuse" && w.seat === 4 && w.why === "fail", "the knight who was on a failed quest of two with a traitor accuses them, for the fail");
  const after = said(g, 2, w);
  check([...Array(20).keys()].every(i => questChat(after, 2, "medium", seeded(i)) === null), "and says nothing more of its own until the next party");
}
{
  // the Seer who named the traitors before any quest showed them is the one the traitors strike
  const roles = ["seer", "loyal", "loyal", "assassin", "traitor", "loyal", "impostor"];
  let quiet = table(roles, 1).state;
  Object.assign(quiet, { step: "assassin", q: 3 });
  quiet.log = [{ q: 0, leader: 1, team: [1, 2], votes: [true, true, true, true, true, true, true], approved: true, fails: 0 },
    { q: 1, leader: 2, team: [2, 5, 0], votes: [true, true, true, true, true, true, true], approved: true, fails: 0 },
    { q: 2, leader: 3, team: [3, 1, 5], votes: [true, true, true, true, true, true, true], approved: true, fails: 0 }];
  let loud = quiet;
  for (const x of [3, 4, 6]) loud = said({ ...loud, step: "propose" }, 0, { t: "accuse", seat: x });
  loud = { ...loud, step: "assassin" };
  let hitQuiet = 0, hitLoud = 0;
  for (let i = 0; i < 40; i++) { if (questBot(quiet, 3, "medium", seeded(i)).seat === 0) hitQuiet++; if (questBot(loud, 3, "medium", seeded(i)).seat === 0) hitLoud++; }
  check(hitLoud >= 36 && hitLoud > hitQuiet, `a Seer who accused every traitor before a quest failed is struck (${hitLoud} of 40, against ${hitQuiet} of 40 kept quiet)`);
  // conferring, each computer traitor names one of the loyal, once (then agrees at most once); the loyal keep quiet
  const names = [3, 4, 6].map(p => questChat(quiet, p, "medium", seeded(p)));
  check(names.every(m => m?.t === "name" && !isEvil(roles[m.seat])) && [0, 1, 2, 5].every(p => questChat(quiet, p, "medium", seeded(p)) === null), "conferring, each traitor names one of the loyal; the loyal say nothing");
  const once = said(quiet, 3, names[0]);
  const again = questChat(once, 3, "medium", seeded(5));
  check(again === null, "a traitor names its pick once");
}
{
  // whole games with the table talking between the moves: every word fit to be said, the Seer's never a lie, every game over
  let ok = true, games = 0, lines = 0, most = 0, seerLied = false;
  const t0 = Date.now();
  for (const level of ["easy", "medium"]) for (const n of [5, 7, 10]) for (const options of [{ guardian: true, veiled: true, hermit: true }, { seer: false }]) {
    let G = newRecord(rules, { seats: n, options, seed: n * 977 + (level === "easy" ? 1 : 2), now: T }), step = "", from = 0;
    for (let i = 0; i < 1500 && G.state.step !== "over"; i++) {
      // a round of talk: each in turn may say a thing, three of their own a step at most
      const key = `${G.state.step}:${G.state.log.length}`;
      if (key !== step) { step = key; from = G.state.talk.length; }
      for (let p = 0; p < n; p++) {
        const s = rules.restore(structuredClone(G.state)), own = s.talk.slice(from).filter(l => l.why !== "back").length;
        const m = questChat(s, p, level, seeded(mix(G.seed, i * 16 + p)), { quiet: own >= 3 });
        if (!m) continue;
        const r = talk(s, p, m);
        if (typeof r === "string") { ok = false; console.log(`  n=${n} ${level}: ${r} ${JSON.stringify(m)}`); continue; }
        const known = knowledge(s.roles, p);
        if (s.roles[p] === "seer" && ((m.t === "accuse" && !isEvil(s.roles[m.seat]) && !(s.roles.includes("veiled") && !known[m.seat])) || (m.t === "trust" && known[m.seat] === "evil"))) seerLied = true;
        G = { ...G, state: r };
      }
      const at = rules.wakeAt(G.state);
      if (at != null) { G = wake(G, at); continue; }
      const seat = rules.toMove(G.state), r = applyMove(rules, G, seat, botMove(rules, G, seat, level), T + i);
      if (r.error) { ok = false; console.log(`  n=${n} ${level}: ${r.error}`); break; }
      G = r.G;
    }
    if (G.state.step !== "over") ok = false;
    games++; lines += G.state.talk.length; most = Math.max(most, G.state.talk.length);
  }
  check(ok && most < TALK_MAX, `${games} whole games with the table talking: every word fit to be said, every game over (${(lines / games).toFixed(0)} lines a game, ${most} at most; ${((Date.now() - t0) / games).toFixed(0)} ms a game)`);
  check(!seerLied, "the Seer never accuses one it knows is loyal, nor trusts a traitor it knows");
}
{
  // whole games, every size, every role, both levels: every move legal, every game ends
  let ok = true, games = 0, good = 0, steps = 0;
  const sides = {};
  for (const level of ["easy", "medium"]) for (let n = 5; n <= 10; n++) for (const options of [{}, { guardian: true, veiled: true, hermit: true }, { seer: false }]) for (let seed = 1; seed <= (n >= 9 ? 2 : 3); seed++) {
    let G = newRecord(rules, { seats: n, options, seed: seed * 31 + n, now: T }), i = 0;
    for (; i < 800 && G.state.step !== "over"; i++) {
      const at = rules.wakeAt(G.state);
      if (at != null) { G = wake(G, at); continue; }
      const seat = rules.toMove(G.state), r = applyMove(rules, G, seat, botMove(rules, G, seat, level), T + i);
      if (r.error) { ok = false; console.log(`  n=${n} ${level} ${JSON.stringify(options)}: ${r.error}`); break; }
      G = r.G;
      if (i % 23 === 0) G = { ...G, state: rules.restore(roundTrip(structuredClone(G.state))) };
    }
    steps += i;
    if (G.state.step !== "over") { ok = false; continue; }
    games++;
    if (G.state.side === "good") good++;
    sides[G.state.why] = (sides[G.state.why] || 0) + 1;
    if (G.state.winners.some(w => isEvil(G.state.roles[w]) !== (G.state.side === "evil"))) ok = false;
  }
  check(ok, `${games} whole games between computer players at every size, role and level: every move legal, every game over (${good} won by the loyal; ${Object.entries(sides).map(([k, v]) => `${k} ${v}`).join(", ")})`);
}

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
