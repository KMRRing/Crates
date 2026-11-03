// Decoy (party-decoy.js, its questions party-decoy-bank.js, built from kb/), played in Node on the database in memory
// with the host's phone running it (tests/party-harness.js): the questions (each with its truth and three house lies,
// none of them the truth or too near it, a number's truth as often the least as the greatest); what counts as the truth
// (the same words, plurals and articles aside, one answer's words inside the other's, the same number) and as the same
// lie; a game played through: lies, the truth refused, the same lie twice as one, the house making up the numbers, a
// player's own lie not to be picked, the scores (1,000 for the truth, 500 a player fooled, double on the last), Next
// moving on early, the best lie and the winners; the clock; a player who leaves; the mix and the numbers' years.
import { partyTable } from "./party-harness.js";
import decoy, { question, isTruth, sameAnswer, shown, lieProblem, numberOf, houseLie, DECKS, POINTS } from "../party-decoy.js";
import { SAYINGS, NUMBERS, FACTS } from "../party-decoy-bank.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the questions ----------
check(SAYINGS.length >= 300 && NUMBERS.length >= 500 && FACTS.length >= 60, `${SAYINGS.length} sayings, ${NUMBERS.length} numbers, ${FACTS.length} odd facts`);
for (const [kind, deck] of Object.entries(DECKS)) {
  const ids = new Set(deck.map(x => x.id));
  check(ids.size === deck.length, `${kind}: every question once`);
  const odd = deck.filter(x => {
    const q = question(kind, x);
    return !q.t || q.x.length !== 3 || new Set(q.x.map(v => v.toLowerCase())).size !== 3 || q.x.some(v => sameAnswer(v, q.t, q) || lieProblem(v, q));
  });
  check(!odd.length, `${kind}: a truth and three house lies, none the truth, each taken as a lie from a player the house lies for${odd.length ? ` (${odd.slice(0, 4).map(x => x.id).join(", ")})` : ""}`);
}
check(FACTS.every(f => f.q.split("___").length === 2), "an odd fact has one blank");
{
  const num = s => numberOf(s), ranks = [0, 0, 0, 0];
  for (const n of NUMBERS) ranks[n.x.filter(x => num(x) > num(n.t)).length]++;
  check(ranks.every(r => r > NUMBERS.length / 6), `a number's truth is as often below its house lies as above them, so its place gives nothing away (${ranks.join(" ")} with 0–3 lies above)`);
  check(NUMBERS.every(n => num(n.t) >= 0.1 && n.x.every(x => num(x) > 0)), "no number too small to write");
}

// ---------- the truth, and the same lie ----------
{
  const emus = question("facts", FACTS.find(f => f.id === "emu-war"));
  check(isTruth("Emus", emus) && isTruth("an emu.", emus) && isTruth("EMUS", emus) && !isTruth("kangaroos", emus), "the truth in any case, singular or plural, with an article");
  check(isTruth("emus and kangaroos", emus), "an answer holding the truth's words is too near it");
  const minnie = question("facts", FACTS.find(f => f.id === "mickey-minnie"));
  check(isTruth("Minnie", minnie) && !isTruth("Daisy", minnie), "an answer whose words are all in the truth's is too near it (Minnie for Minnie Mouse)");
  const war = question("facts", FACTS.find(f => f.id === "zanzibar")), hearts = question("facts", FACTS.find(f => f.id === "octopus-hearts"));
  check(isTruth("38 mins", war) && !isTruth("40 minutes", war) && isTruth("3", hearts) && !isTruth("four", hearts), "the truth's number is the truth (38 mins; 3 for three)");
  const year = question("numbers", { id: "y", q: "The year of the Bordeaux classification", u: "year", t: "1855", x: ["1843", "1827", "1863"] });
  check(isTruth("1855", year) && !isTruth("1856", year) && !isTruth("1850s", { ...year, t: "1859" }), "a year is the truth only exactly");
  const oil = question("numbers", { id: "o", q: "World oil consumption in 2023", u: "million barrels a day", t: "102", x: ["160", "56", "36"] });
  check(isTruth("102.4", oil) && !isTruth("105", oil) && isTruth("about 102 million", oil), "another number within half a percent is the truth");
  check(oil.label === "How much?" && oil.sub === "In million barrels a day" && year.label === "What year?" && !year.sub && year.voice === "The year of the Bordeaux classification?", "a number's question says what to answer in");
  const count = question("numbers", { id: "c", q: "Number of OPEC member countries in 2024", u: "countries", t: "12", x: ["8", "15", "19"] });
  check(count.label === "How many?" && count.sub === "A number" && !/in countries/.test(count.voice), "a count asks how many, not in what");
  check(sameAnswer("Kangaroos", "a kangaroo", emus) && !sameAnswer("kangaroos", "rabbits", emus) && sameAnswer("1500", "1,500", oil) && !sameAnswer("1500", "1501", oil), "the same lie twice: the same words, or the same number");
  check(shown("2000", oil) === "2,000" && shown("about 1855", year) === "1855" && shown("Kangaroos.", emus) === "Kangaroos" && shown("lots", oil) === "", "a lie as the table sees it: a number written as the truth's are");
  check(lieProblem("lots", oil) === "Write a number." && lieProblem("1855", year).startsWith("That's the truth") && lieProblem("camels", emus) === "", "what's wrong with a lie, in words");
  check(!["kangaroos", "rabbits", "camels"].some(v => isTruth(v, emus)), "the house's lies stand as lies");
  const saying = question("sayings", SAYINGS.find(x => x.l === "Chinese" && x.lit));
  check(saying.q.startsWith("“") && /literally/.test(saying.sub) && !/[一-鿿]/.test(saying.voice), "a Chinese saying is read out by what it says literally, not by its characters");
}

// ---------- a game ----------
const NAMES = ["Korbi", "Mei", "Ana", "Bo", "Lin"];
const optsOf = t => Object.values(t.state.opts || {}).map(o => ({ ...o, by: o.by ? Object.values(o.by) : [] }));
const qOf = t => { const q = Object.values(t.state.qs)[t.state.at]; return { ...q, x: Object.values(q.x) }; };
// a lie from each seat: each its own, unless said otherwise
const lieAll = async (t, lies) => { for (const [i, lie] of Object.entries(lies)) await t.send(Number(i), { lie, qn: t.state.at }); };
{
  const t = await partyTable(NAMES.slice(0, 4));
  check(await t.start("decoy", { deck: "facts", length: "5" }) && t.state.step === "write" && Object.values(t.state.qs).length === 5, "Decoy starts with four: five odd facts");
  check(/Question 1 of 5/.test(t.branch.say.text) && /Write a lie/.test(t.branch.say.text) && !/___/.test(t.branch.say.text), "the question read out, its blank said as a word");
  const q = qOf(t);
  await t.send(0, { lie: q.t, qn: 0 });
  check(t.state.step === "write", "the truth isn't taken as a lie (the phone says so before it's sent)");
  await t.send(0, { lie: "zz first lie", qn: 3 });
  check(t.state.step === "write", "a lie for another question isn't this one's");
  await lieAll(t, { 0: "zz first lie", 1: "zz same lie", 2: "ZZ Same Lie.", 3: "zz fourth lie" });
  const opts = optsOf(t);
  const [u0, u1, u2, u3] = [0, 1, 2, 3].map(i => t.uid(i));
  const at = text => opts.findIndex(o => o.text.toLowerCase() === text);
  check(t.state.step === "pick" && opts.length === 5 && opts.filter(o => o.truth).length === 1 && opts.filter(o => o.house).length === 1,
    "the lies are in: the truth, three lies (two the same), and the house's to make five, one more than there are players");
  const same = opts[at("zz same lie")];
  check(same && same.by.length === 2 && same.by.includes(u1) && same.by.includes(u2), "the same lie twice is one answer, with both its authors");
  check(/Which is the truth/.test(t.branch.say.text), "the narrator asks for the truth");
  await t.send(0, { pick: at("zz first lie"), qn: 0 });
  check(t.state.step === "pick", "nobody picks their own lie");
  const truth = opts.findIndex(o => o.truth);
  await t.send(0, { pick: truth, qn: 0 });               // Korbi finds the truth
  await t.send(1, { pick: at("zz fourth lie"), qn: 0 });  // Mei is fooled by Bo
  await t.send(2, { pick: at("zz first lie"), qn: 0 });   // Ana by Korbi
  await t.send(3, { pick: at("zz same lie"), qn: 0 });    // Bo by Mei and Ana's
  const sc = t.state.scores;
  check(t.state.step === "reveal" && sc[u0] === POINTS.truth + POINTS.fool && sc[u1] === POINTS.fool && sc[u2] === POINTS.fool && sc[u3] === POINTS.fool,
    `1,000 for the truth, 500 to each author for each one fooled (${[u0, u1, u2, u3].map(u => sc[u]).join(" ")})`);
  check(/Korbi's lie, zz first lie, fooled Ana/.test(t.branch.say.text) && /Mei and Ana's lie/.test(t.branch.say.text) && /Korbi found it/.test(t.branch.say.text), "the reveal read out: who fooled whom, who found the truth");
  for (let i = 0; i < 3; i++) await t.send(i, { next: true, qn: 0 });
  check(t.state.step === "reveal", "Next waits for everyone…");
  await t.send(3, { next: true, qn: 0 });
  check(t.state.step === "write" && t.state.at === 1, "…and then moves on before the clock");
  // the rest: Korbi always finds the truth; on the second question Ana fools three, the best lie of the game. The lies
  // hold no number, nor a number's word: a fact whose truth is "3" would refuse "lie three 3" as too near it
  for (let n = 1; n < 5; n++) {
    const before = { ...t.state.scores }, c = "wxyz"[n - 1];
    await lieAll(t, { 0: `kappa lie ${c}`, 1: `mu lie ${c}`, 2: `sigma lie ${c}`, 3: `rho lie ${c}` });
    const os = optsOf(t), ix = text => os.findIndex(o => o.text === text), tr = os.findIndex(o => o.truth);
    if (n === 1) for (const i of [0, 1, 3]) await t.send(i, { pick: ix("sigma lie w"), qn: n });
    else for (const i of [0, 1, 3]) await t.send(i, { pick: tr, qn: n });
    await t.send(2, { pick: tr, qn: n });
    check(t.state.step === "reveal", `question ${n + 1} answered`);
    if (n === 4) check(t.state.scores[u0] - before[u0] === 2 * POINTS.truth, "the last question counts double");
    if (n < 4) await t.tick(25000);
  }
  await t.tick(25000);
  check(t.state.step === "over", "after the last question, the end");
  const top = Math.max(...Object.values(t.state.scores));
  check(Object.values(t.state.winners).every(u => t.state.scores[u] === top) && /wins|win,/.test(t.branch.say.text), `the most points wins (${top.toLocaleString("en-GB")})`);
  check(t.state.best?.text === "sigma lie w" && t.state.best.n === 3 && /best lie: sigma lie w, by Ana/.test(t.branch.say.text), "the best lie: the one that fooled the most at once");
}
{
  // the clock: lies not written, picks not made
  const t = await partyTable(NAMES.slice(0, 4));
  await t.start("decoy", { deck: "sayings", length: "5", clock: "60" });
  await t.send(1, { lie: "to sing in the rain", qn: 0 });
  await t.tick(30000);
  check(t.state.step === "write", "the clock runs");
  await t.tick(31000);
  const opts = optsOf(t);
  check(t.state.step === "pick" && opts.length === 5 && opts.filter(o => o.house).length === 3, "when it runs out, the lies written and the house's (as many as it has) make up the answers");
  await t.send(0, { pick: opts.findIndex(o => o.truth), qn: 0 });
  await t.tick(61000);
  check(t.state.step === "reveal" && Object.keys(t.state.picks).length === 1 && t.state.scores[t.uid(0)] === POINTS.truth, "picks not made count for nothing when the clock runs out");
  check(t.state.deadline - t.now <= 20000, "the answers stand for twenty seconds at most");
}
{
  // a player who leaves, the house lying for a player, and the mix
  const t = await partyTable(NAMES.slice(0, 5));
  await t.start("decoy", { deck: "mixed", length: "8" });
  const kinds = Object.values(t.state.qs).map(q => q.kind);
  check(["sayings", "numbers", "facts"].every(k => kinds.filter(x => x === k).length >= 2), `a mix has each kind more than once (${kinds.join(" ")})`);
  const s = { ...t.state, order: Object.values(t.state.order), qs: Object.values(t.state.qs).map(q => ({ ...q, x: Object.values(q.x) })) };
  const helped = [0, 1, 2].map(i => houseLie(s, t.uid(i)));
  check(new Set(helped).size === 3, "the house lies for a player who asks, a different lie for each of the first three");
  await t.send(0, { lie: helped[0], qn: 0 });
  await t.send(1, { lie: shown(qOf(t).num ? "7" : "a lie of mine", qOf(t)), qn: 0 });
  await t.send(2, { lie: qOf(t).num ? "9999" : "another lie", qn: 0 });
  await t.send(3, { lie: qOf(t).num ? "8888" : "one more", qn: 0 });
  await t.leave(4);
  check(t.state.step === "pick", "a player who leaves isn't waited for");
  // the lie as the table shows it (a number's written as the truth's are: 1500 as 1,500)
  const opts = optsOf(t), given = shown(helped[0], qOf(t));
  check(opts.some(o => o.by.includes(t.uid(0)) && o.text === given) && opts.filter(o => o.house).every(o => o.text !== given), "a lie the house gave a player is that player's, not the house's too");
}
{
  const t = await partyTable(NAMES.slice(0, 4));
  await t.start("decoy", { deck: "numbers", length: "12" });
  const qs = Object.values(t.state.qs), years = qs.filter(q => q.year).length;
  check(qs.every(q => q.num) && years >= 4 && years <= 8, `numbers: years and the rest in turn (${years} years of 12)`);
}
{
  const t = await partyTable(NAMES.slice(0, 2));
  check(!(await t.start("decoy", {})), "Decoy doesn't start with two");
}
check(decoy.min === 3 && decoy.max === 12 && decoy.options.some(o => o.id === "deck") && decoy.options.some(o => o.id === "clock"), "three to twelve players; a choice of questions and a clock");

console.log(bad ? `party-decoy: ${bad} failed` : "party-decoy: every check passed");
process.exit(bad ? 1 : 0);
