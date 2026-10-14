// Snap (party-snap.js), played in Node on the database in memory with the host's phone running it
// (tests/party-harness.js): the deck (the projective plane of order 7: 57 cards of 8 pictures, any two sharing exactly
// one); the round's taps (a wrong one ignored, the first right one waiting a moment for others, the earliest made
// winning); the tower (the pile's card to the winner, the most cards winning) and the well (the winner's card to the
// pile, the first with none left winning); a table left with one player.
import { partyTable } from "./party-harness.js";
import snap, { CARDS, PICTURES, shared } from "../party-snap.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- the deck ----------
check(CARDS.length === 57 && CARDS.every(c => c.length === 8 && new Set(c).size === 8 && c.every(p => p >= 0 && p < 57)), "57 cards of eight different pictures");
{
  let ok = true;
  for (let i = 0; i < 57; i++) for (let j = i + 1; j < 57; j++) if (CARDS[i].filter(p => CARDS[j].includes(p)).length !== 1) ok = false;
  check(ok, "any two cards share exactly one picture");
  const on = Array(57).fill(0);
  for (const c of CARDS) for (const p of c) on[p]++;
  check(on.every(n => n === 8), "every picture is on eight cards");
  check(CARDS.every((c, i) => CARDS.every((d, j) => i === j || (c.includes(shared(i, j)) && d.includes(shared(i, j))))), "shared() finds it");
}
check(PICTURES.length === 57 && new Set(PICTURES).size === 57, "57 pictures, all different");

// ---------- who tapped first ----------
{
  const players = [{ uid: "a", name: "A" }, { uid: "b", name: "B" }, { uid: "c", name: "C" }];
  const s0 = snap.start({ players, options: { mode: "tower" }, rng: (() => { let x = 1; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })(), now: 0 });
  const right = u => shared(s0.hands[u].at(-1), s0.centre), wrong = u => CARDS[s0.hands[u].at(-1)].find(p => p !== right(u));
  check(snap.advance(s0, { players, inputs: { a: { tap: wrong("a"), rn: 0, at: 1 } }, now: 10 }) === null, "a wrong tap does nothing");
  check(snap.advance(s0, { players, inputs: { a: { tap: right("a"), rn: 1, at: 1 } }, now: 10 }) === null, "a tap for another round does nothing");
  const r1 = snap.advance(s0, { players, inputs: { a: { tap: right("a"), rn: 0, at: 1000 } }, now: 1100 });
  check(r1 && r1.state.step === "spot" && r1.state.until === 1500, "the first right tap waits a moment for others");
  const r2 = snap.advance(r1.state, { players, inputs: { a: { tap: right("a"), rn: 0, at: 1000 }, b: { tap: right("b"), rn: 0, at: 950 } }, now: 1500 });
  check(r2 && r2.state.step === "won" && r2.state.win.uid === "b" && r2.state.hands.b.length === 2 && r2.state.hands.b.at(-1) === s0.centre,
    "the tap made first wins, though it reached the table second: the pile's card is now theirs");
}

// ---------- the tower ----------
const NAMES = ["Korbi", "Mei", "Ana", "Bo"];
const st = t => t.state;
const top = (t, u) => Object.values(st(t).hands[u]).at(-1);
const tapRight = (t, i) => { const u = t.uid(i); return t.send(i, { tap: shared(top(t, u), st(t).centre), rn: st(t).rn }); };
{
  const t = await partyTable(NAMES.slice(0, 3));
  check(await t.start("snap", { mode: "tower" }) && st(t).step === "spot" && [0, 1, 2].every(i => Object.values(st(t).hands[t.uid(i)]).length === 1) && Object.values(st(t).deck).length === 24,
    "the tower starts: a card each, 24 on the pile (short)");
  const u0 = t.uid(0), c0 = st(t).centre;
  await t.send(0, { tap: CARDS[top(t, u0)].find(p => p !== shared(top(t, u0), c0)), rn: 0 });
  check(st(t).step === "spot" && !st(t).until, "a wrong tap wins nothing");
  await tapRight(t, 0);
  check(st(t).step === "spot" && st(t).until, "a right one: a moment for anyone as quick");
  await t.tick(450);
  check(st(t).step === "won" && st(t).win.uid === u0 && top(t, u0) === c0, "then it's won: the pile's card is the winner's new card");
  await t.tick(1800);
  check(st(t).step === "spot" && st(t).rn === 1 && st(t).centre !== c0 && Object.values(st(t).deck).length === 23, "a new card on the pile");
  // the rest of the pile (the card showing and the 23 under it): Mei wins most
  for (let n = 0; n < 24; n++) {
    await tapRight(t, n % 3 === 0 ? 2 : 1);
    await t.tick(450);
    await t.tick(1800);
  }
  const counts = [0, 1, 2].map(i => Object.values(st(t).hands[t.uid(i)]).length);
  check(st(t).step === "over" && Object.values(st(t).winners).join() === t.uid(1) && /wins, with/.test(t.branch.say.text), `the pile gone, the most cards wins (${counts.join(" ")})`);
}

// ---------- the well ----------
{
  const t = await partyTable(NAMES.slice(0, 3));
  await t.start("snap", { mode: "well" });
  const u1 = t.uid(1), before = Object.values(st(t).hands[u1]).length, mine = top(t, u1);
  check(before === 6 && [0, 2].every(i => Object.values(st(t).hands[t.uid(i)]).length === 6), "the well starts: six cards each (short)");
  await tapRight(t, 1);
  await t.tick(450);
  check(st(t).centre === mine && Object.values(st(t).hands[u1]).length === before - 1, "the winner's card goes onto the pile");
  for (let n = 0; n < 5; n++) { await t.tick(1800); await tapRight(t, 1); await t.tick(450); }
  await t.tick(1800);
  check(st(t).step === "over" && Object.values(st(t).winners).join() === u1 && /no cards left/.test(t.branch.say.text), "the first with no cards left wins");
}
{
  const t = await partyTable(NAMES.slice(0, 2));
  await t.start("snap", { mode: "tower", length: "long" });
  check(Object.values(st(t).deck).length === 54, "the long tower: every card left on the pile");
  await tapRight(t, 0);
  await t.tick(450);
  await t.leave(1);
  await t.tick(1800);
  check(st(t).step === "over", "a table left with one player: the game is over");
}
check(snap.min === 2 && snap.max === 12 && ["mode", "length"].every(id => snap.options.some(o => o.id === id)), "two to twelve players; the tower or the well, short or long");

console.log(bad ? `party-snap: ${bad} failed` : "party-snap: every check passed");
process.exit(bad ? 1 : 0);
