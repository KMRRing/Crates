// Quest (quest-rules.js) on seats.js: the roles dealt for each table (the traitors' count, the specials chosen, those
// with no room dropped) and what each knows; the parties' sizes; a quest (the leader names a party, everyone votes
// in turn round from the leader, unseen until all are in; approved, it sets out; the loyal can only succeed; one fail
// fails it, two the fourth from seven players); refusals (the lead passes, the fifth hands it to the traitors); the
// end (three quests either way, and the Assassin's strike at the Seer); the state through the database; the computer
// players (legal in every step, whole games at every size, with every role, at both levels; the loyal reason from what
// they can know, the traitors fail together only when they must).
import { rules, dealRoles, knowledge, EVIL_COUNT, SIZES, SHOW_MS, isEvil } from "../quest-rules.js";
import { questBot, LEVEL_NAMES } from "../quest-bot.js";
import { newRecord, applyMove, applyWake, botMove, seeded } from "../seats.js";
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
  check(G.state.step === "assassin" && rules.toMove(G.state) === 4 && /Assassin/.test(G.say.text), "three won: the Assassin may yet name the Seer");
  check(applyMove(rules, G, 4, { t: "kill", seat: 4 }).error && applyMove(rules, G, 1, { t: "kill", seat: 0 }).error, "the Assassin names someone else, and only the Assassin names");
  const miss = move(G, 4, { t: "kill", seat: 1 });
  check(miss.state.step === "over" && miss.state.side === "good" && miss.state.why === "safe" && miss.state.winners.join() === "0,1,2,3" && /the Seer was \{s0\}/.test(miss.say.text), "named wrongly: the loyal win");
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
