// Cue's Turn setting and its table: who is X for each card (in turn, random, chosen), and what X sees (the same cue, a
// different one, none) against what everyone else sees; the cooldown (its length from the options, the host's stepper,
// the same moment on every phone); a deck that never repeats a card; and a whole evening on the database in memory, a
// table of phones, the host's running it (tests/party-harness.js).
import { partyTable } from "./party-harness.js";
import cue from "../party-cue.js";
import { gameById, needOf, optionsOf } from "../party-core.js";
import { begin, nextCard, pickNext, viewOf, revealOf, isOver, need, setCount, stepped, whoNext, whole, mayPick } from "../cue-turn.js";
import { LIB } from "../cue-library.js";
import { clockAt, seconds, READ, PRESETS, COUNT } from "../cue-clock.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const rng = seed => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const people = ["Korbi", "Mei", "Ana", "Bo"].map((name, i) => ({ uid: `u${i}`, name }));
const uids = people.map(p => p.uid);
const opts = (o = {}) => ({ deck: "mix", level: "2", sees: "same", who: "turn", count: "10", ...o });
const start = (o, seed = 1) => begin({ players: people, options: opts(o), rnd: rng(seed), now: 1000 });
const views = s => uids.map(u => viewOf(s, u));

// ---------- the same cue ----------
{
  const s = start({ sees: "same" });
  const v = views(s);
  check(v.every(x => x.text === s.card.t), "same: everyone sees the cue, X included");
  check(v.filter(x => x.role === "x").length === 1 && viewOf(s, s.x).role === "x" && viewOf(s, s.x).line === viewOf(s, s.x).cat.x, "…and one player is X, told what to do");
  check(s.card.o === null, "…and no twin is dealt");
  check(revealOf(s) === "", "…and there's nothing to reveal");
}
// ---------- a different cue ----------
{
  let always = true, hidden = true, onlyX = true;
  for (let seed = 1; seed <= 60; seed++) {
    const s = start({ sees: "odd" }, seed), v = views(s);
    const odd = uids.filter((u, i) => v[i].text !== s.card.t);
    if (odd.length !== 1 || odd[0] !== s.x) onlyX = false;
    if (!s.card.o || s.card.o === s.card.t) always = false;
    if (v.some(x => x.role === "x")) hidden = false;     // nobody is told they're X, X included
  }
  check(always, "odd: a different cue is dealt, never the card's own text");
  check(onlyX, "…and X alone sees it, everyone else the card");
  check(hidden, "…and nobody is told who X is, X included");
  const s = start({ sees: "odd" });
  check(revealOf(s).includes(people.find(p => p.uid === s.x).name) && revealOf(s).includes(s.card.o) && revealOf(s).includes(s.card.t), "…and the reveal names X and gives both cues");
  const w = start({ sees: "odd", deck: "words" }, 4), kind = c => LIB.find(x => x.t === c && x.cat === "words").kind;
  check(kind(w.card.o) === kind(w.card.t) && w.card.o !== w.card.t, "…a word's twin is another word of its kind");
  const d = start({ sees: "odd", deck: "describe" }, 3);
  check(LIB[d.card.i].o === d.card.o, "…a card with a twin gives that twin");
}
// ---------- no cue ----------
{
  const s = start({ sees: "none" }), v = views(s);
  const x = viewOf(s, s.x);
  check(x.blind && x.text === null && x.role === "x", "none: X sees a blank card, and knows it is theirs");
  check(uids.filter(u => u !== s.x).every(u => viewOf(s, u).text === s.card.t && viewOf(s, u).line === viewOf(s, u).cat.guess), "…everyone else sees the cue, and how to help X guess it");
  check(v.filter(a => a.text === null).length === 1, "…and only X sees nothing");
  const all = new Set();
  for (let seed = 1; seed <= 80; seed++) all.add(start({ sees: "none" }, seed).card.i);
  check([...all].every(i => ["describe", "words", "three", "act"].includes(LIB[i].cat)), "…and the cards dealt are only ones that can be guessed");
  check(revealOf(s).includes(s.card.t), "…and the reveal tells the cue");
  check(need(people, opts({ sees: "none", deck: "likely" })).includes("can't be guessed") && need(people, opts({ sees: "none", deck: "act" })) === "", "…and a deck of cards nobody could guess won't start");
}
// ---------- who is X ----------
{
  // in turn: seat order, round and round, a player who's gone skipped
  let s = start({ who: "turn" }), seen = [s.x];
  const r = rng(9);
  for (let i = 0; i < 6; i++) { nextCard(s, s.n, uids, r, 2000); seen.push(s.x); }
  check(seen.join() === "u0,u1,u2,u3,u0,u1,u2", `in turn: seat order, round again (${seen.join(" ")})`);
  nextCard(s, s.n, ["u0", "u1", "u3"], r, 2000);
  check(s.x === "u3", "…a player who is away is skipped");
  // random: everyone once before anyone twice, never the same twice running
  s = start({ who: "random" }, 5);
  const xs = [s.x];
  for (let i = 0; i < 15; i++) { nextCard(s, s.n, uids, r, 2000); xs.push(s.x); }
  const fours = [0, 4, 8, 12].map(i => new Set(xs.slice(i, i + 4)).size);
  check(fours.every(n => n === 4) && xs.every((u, i) => i === 0 || u !== xs[i - 1]), `random: everyone before anyone twice, nobody twice running (${xs.join(" ")})`);
  const mean = Array.from({ length: 400 }, (_, i) => start({ who: "random" }, i + 1).x);
  check(uids.every(u => mean.filter(x => x === u).length > 60), "…and the first X is any of them");
  // chosen: a pick step, the host first, then the one whose turn it was
  s = start({ who: "chosen" });
  check(s.step === "pick" && s.x === null && !s.card && mayPick(s, "u0", true) && !mayPick(s, "u1", false), "chosen: at the start the host picks, nobody else");
  check(!pickNext(s, s.n, "nobody", uids, r, 2000) && s.step === "pick", "…a pick of someone not at the table does nothing");
  const n = s.n;
  check(pickNext(s, n, "u2", uids, r, 2000) && s.step === "card" && s.x === "u2" && viewOf(s, "u2").role === "x", "…the pick is X, and the card is turned up");
  check(!pickNext(s, n, "u3", uids, r, 2000), "…a second pick for the same step is turned down");
  check(mayPick(s, "u2", false) && !mayPick(s, "u3", false) && mayPick(s, "u3", true), "…then the player whose turn it was picks next (and the host can)");
  const taken = nextCard(s, s.n, uids, r, 3000);
  check(taken && s.step === "pick" && s.card === null && s.x === "u2", "…Next goes to the pick, with X as it was");
}
// ---------- the same tap twice ----------
{
  const s = start({}), n = s.n, r = rng(3);
  const first = s.card.i;
  check(nextCard(s, n, uids, r, 2000) && s.card.i !== first, "a tap on Next turns up the next card");
  check(!nextCard(s, n, uids, r, 2100) && s.n === n + 1, "…a second tap on the same card (another phone's) does nothing");
}
// ---------- the deck ----------
{
  const s = start({ deck: "rather", level: "0" }), r = rng(2);
  const seen = [s.card.i];
  for (let i = 0; i < 19; i++) { nextCard(s, s.n, uids, r, 2000); seen.push(s.card.i); }
  check(new Set(seen).size === 20 && seen.every(i => LIB[i].cat === "rather" && LIB[i].lvl === 0), "a deck of one category and level deals its 20 cards once each");
  nextCard(s, s.n, uids, r, 2000);
  check(s.deck.round === 2 && s.card.i !== undefined, "…then shuffles again");
  const m = start({ deck: "mix" }, 8), cats = new Set([m.card.i]);
  for (let i = 0; i < 30; i++) { nextCard(m, m.n, uids, r, 2000); cats.add(m.card.i); }
  check(new Set([...cats].map(i => LIB[i].cat)).size >= 8, "a mix comes from many categories at once, not mostly words");
  const back = JSON.parse(JSON.stringify(m)), rt = whole({ ...back, deck: { ...back.deck, order: Object.assign({}, back.deck.order) } });
  check(Array.isArray(rt.deck.order) && rt.deck.order.length === m.deck.order.length, "a deck the database gave back as an object is a list again");
}
// ---------- the cooldown ----------
{
  check(seconds("45") === 45 && seconds(" 20 s ") === 20 && seconds("0", 3) === 3 && seconds("abc", 3) === 3 && seconds("601", 3) === 3 && seconds(2.5, 3) === 3 && PRESETS.every(p => seconds(p) === p), "a typed cooldown is a whole number of seconds from 1 to 600");
  for (const count of [3, 10, 45]) {
    const c = ms => clockAt(ms, count * 1000);
    check(c(READ - 1).phase === "read" && c(READ).n === count && c(READ + count * 1000 - 1).n === 1 && c(READ + count * 1000).phase === "over", `${count} s: a second to read, then ${count} down to 1, then over`);
  }
  check(clockAt(1000).n === 3 && clockAt(4000).phase === "over" && COUNT === 3000, "…and with none given, three seconds as before");
  const s = start({ count: "20" });
  check(s.count === 20 && !isOver(s, 1000 + READ + 19000) && isOver(s, 1000 + READ + 20000), "the table's cooldown is the host's, over at the same moment for everyone (the table's clock)");
  check(!isOver(start({ count: "0" }), 1e9) && isOver({ ...start({ count: "0" }), revealed: true }, 0), "…none never ends by itself, Reveal ends any");
  check(stepped(10, 1) === 15 && stepped(10, -1) === 9 && stepped(5, 1) === 6 && stepped(60, -1) === 55 && stepped(60, 1) === 75 && stepped(0, -1) === 0 && stepped(600, 1) === 600, "the stepper moves by 1 second under ten, 5 under a minute, 15 above");
  const t = start({ count: "10" });
  check(setCount(t, 25) && t.count === 25 && !setCount(t, -1) && !setCount(t, 601) && !setCount(t, 2.5) && t.count === 25, "the host sets the cooldown to a whole number of seconds");
}

// ---------- at a table ----------
{
  const t = await partyTable(["Korbi", "Mei", "Ana", "Bo"]);
  const game = gameById("cue");
  check(game && game === cue && game.min === 2 && game.max === 12 && game.options.every(o => o.choices.some(([v]) => v === o.value)), "Cue is a party game for 2 to 12, every option's default one of its choices");
  check(await t.start("cue", { sees: "odd", who: "turn", count: "10" }) && t.state.step === "card" && t.state.sees === "odd", "the host starts it with the Turn setting");
  const seen = () => t.seats.map(s => viewOf(s.data.game.state, s.uid));
  let v = seen();
  const x = t.state.x;
  check(v.filter(a => a.text !== t.state.card.t).length === 1 && t.seatOf(x) >= 0 && v[t.seatOf(x)].text === t.state.card.o, "every phone shows its player's view: the odd cue on X's alone");
  check(t.branch.say?.text?.includes("different cue") && !t.branch.say.text.includes(t.branch.players[x].name), "the narrator says somebody has a different cue, not who");
  // a tap on Next from a phone that isn't the host's, then the same tap from another
  const n = t.state.n;
  await t.act(2, st => nextCard(st, n, uids.map((_, i) => t.uid(i)), Math.random, t.now));
  const after = t.state;
  await t.act(3, st => nextCard(st, n, uids.map((_, i) => t.uid(i)), Math.random, t.now));
  check(after.n === n + 1 && t.state.n === n + 1 && t.state.cards === 2, "Next from any phone turns the card once, whoever taps (a second tap on the same card does nothing)");
  check(t.state.x === t.uid(1), "…and X is the next player in turn");
  await t.act(0, st => setCount(st, 25));
  check(t.state.count === 25, "the host's stepper changes the cooldown for the table");
  // a late player watches, seeing the card as the others do
  const late = viewOf(t.state, "stranger");
  check(late.role === "watch" && late.text === t.state.card.t, "a player who joined after the start sees the card as the others do");
}
{
  const t = await partyTable(["Korbi", "Mei"]);
  check(!(await t.start("cue", { sees: "odd" })) && !t.branch.game, "a different cue won't start with two players");
  check(await t.start("cue", { sees: "none", who: "chosen", deck: "act" }) && t.state.step === "pick", "…none and chosen start with two, at the pick");
  const o = optionsOf(cue, { sees: "none" });
  check(needOf(cue, [], o).includes("2 players") && needOf(cue, [{}, {}, {}], optionsOf(cue, { sees: "odd" })) === "", "the lobby says what stops it starting");
  await t.act(0, st => pickNext(st, st.n, t.uid(1), [t.uid(0), t.uid(1)], Math.random, t.now));
  check(t.state.step === "card" && t.state.x === t.uid(1) && viewOf(t.state, t.uid(1)).blind && viewOf(t.state, t.uid(0)).text === t.state.card.t, "the host picked Mei: she sees nothing, Korbi sees the card");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("cue-turn: who is X, what X sees, the cooldown, a table of phones");
