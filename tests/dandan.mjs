// Dandan (dandan-cards.js, -core, -spells, -engine, -bot, -rules): the 80 cards of the list, the opening hand and the
// mulligans, the turn and its stops, the stack with responses (a counter countered, a copy, a spell sent back to the
// library and drawn again), each card's effect, the lands, combat (a Dandân attacks only a player with an Island, is
// sacrificed with none, dies to +2/−1; Mind Bend changing what it looks for), the ends of a game (life, an empty
// library), the state through the database, the computer player's choices, and whole games of computer players.
import { DECK, CARDS, HALVES, NAMES, TOKEN_AT, parseCost, total } from "../dandan-cards.js";
import { deal, act, settle, restore, moves, toMove, nextDrawer, costOf, halfOf, unplayable } from "../dandan-engine.js";
import { RES, T } from "../dandan-spells.js";
import { nm, perm, islands, typesOf, topKnown, payPlan, canPay, canAttack } from "../dandan-core.js";
import { rules } from "../dandan-rules.js";
import { botMove, randomMove, randomAnswer } from "../dandan-bot.js";
import { newRecord, applyMove, botMove as seatBot, seeded, shuffle } from "../seats.js";
import { roundTrip, same } from "./rtdb.js";
import { J, scene, islandsOf, go, refused, idIn, onBf, names, cast, pass, answer, drive, resolveStack, stackNames, sidOf } from "./dandan-scene.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** A check that may throw (a move the engine refused): that is a failure with the reason; a string returned is one too. */
const test = (what, fn) => {
  try { const r = fn(); check(r !== false && typeof r !== "string", typeof r === "string" ? `${what} — ${r}` : what); }
  catch (e) { console.log(`FAIL ${what}: ${e.message}`); bad++; }
};

// ---------- the list ----------
{
  const count = n => DECK.filter(x => x === n).length;
  check(DECK.length === 80 && NAMES.length === 25, "80 cards, 25 different, as in the list");
  check(count("Island") === 16 && count("Memory Lapse") === 8 && count("Dandân") === 10 && count("Take Inventory") === 4 && count("Commit // Memory") === 2, "the numbers of the staples: 16 Islands, 8 Memory Lapse, 10 Dandân, 4 Take Inventory");
  const halves = Object.values(HALVES).flat();
  const spells = Object.keys(CARDS).filter(n => ["instant", "sorcery", "creature"].includes(CARDS[n].type));
  check(spells.every(n => RES[n]) && halves.every(n => RES[n]), "every spell has its effect written");
  check(DECK.every(n => CARDS[n] || HALVES[n]), "every card in the list has a definition");
  const c = parseCost("{3}{U}{U}");
  check(c.g === 3 && c.U === 2 && total(c) === 5, "a cost reads as its generic and blue parts");
  check(CARDS["Dandân"].pt.join("/") === "4/1" && CARDS["Dandân"].cost === "{U}{U}", "Dandân: 4/1 for UU");
  check(total(parseCost(CARDS.Memory.cost)) === 6 && CARDS.Memory.aftermath, "Memory: six mana, aftermath");
}

// ---------- the opening hand ----------
{
  const s = restore(J(deal({ rng: seeded(3) })));
  check(s.hand[0].length === 7 && s.hand[1].length === 7 && s.lib.length === 66 && s.turn === 0, "seven cards each from the one library of 80");
  check(s.pending?.t === "mull" && s.pending.seat === s.first, "the player to go first is asked first");
  check(JSON.stringify(deal({ rng: seeded(3) })) === JSON.stringify(deal({ rng: seeded(3) })), "the same seed deals the same game");
  const dealt = [...s.hand[0], ...s.hand[1], ...s.lib].sort((a, b) => a - b);
  check(dealt.every((x, i) => x === i), "every card is in the hands or the library, once");

  // a hand with fewer than two lands or fewer than two spells may be thrown back for nothing
  let free = null, fine = null;
  for (let seed = 1; seed < 300 && !(free && fine); seed++) {
    const g = restore(J(deal({ rng: seeded(seed) })));
    if (g.pending.free) free ??= seed; else fine ??= seed;
  }
  const f = restore(J(deal({ rng: seeded(free) })));
  check(unplayable(f, f.pending.seat) && f.pending.free, `a hand short of lands or spells is offered a free mulligan (seed ${free})`);
  const after = answer(f, { t: "mull" });
  check(after.reveal?.seat === f.pending.seat && after.reveal.cards.length === 7 && after.mull.n[f.pending.seat] === 0 && after.hand[f.pending.seat].length === 7, "a free one shows the hand to the other player, costs no card, and deals seven again");
  const g = restore(J(deal({ rng: seeded(fine) })));
  check(!g.pending.free && refused(g, g.pending.seat, { t: "keep", extra: 1 }) === null, "a playable hand has no free mulligan");
  const m1 = answer(g, { t: "mull" });
  check(m1.mull.n[g.pending.seat] === 1 && m1.reveal === null && m1.hand[g.pending.seat].length === 7, "a paid mulligan is dealt seven again and counted");
  const k1 = answer(m1, { t: "keep" });
  check(k1.pending?.t === "bottom" && k1.pending.n === 1, "keeping after one mulligan puts one card on the bottom");
  check(refused(k1, k1.pending.seat, { t: "bottom", cards: [] }) !== null, "…and it must be one");
  const seat = k1.pending.seat, put = k1.hand[seat][0];
  const k2 = answer(k1, { t: "bottom", cards: [put] });
  check(k2.hand[seat].length === 6 && k2.lib[k2.lib.length - 1] === put && topKnown(k2, seat) === null && k2.pending.seat !== seat, "the bottomed card is last in the library, and the other player is asked");
  const both = answer(k2, { t: "keep" });
  check(both.turn === 1 && both.active === both.first && both.step === "main1" && both.hand[both.first].length === (both.first === seat ? 6 : 7), "both kept: turn 1, the first player on the play with no draw");
  let h = g;
  for (let i = 0; i < 6; i++) h = h.pending.seat === g.pending.seat && h.pending.t === "mull" ? answer(h, { t: "mull" }) : h;
  check(h.mull.n[g.pending.seat] === 6 && refused(h, g.pending.seat, { t: "mull" }) === "Keep this hand", "no mulligan past the sixth");
}

// ---------- a turn ----------
// A game stops only where a seat could act (wants), so a scene gives the seat it wants to stop at a land in hand.
{
  let s = scene({ hand: [["Island", "Island"], ["Island"]], hold: 0 });
  check(refused(s, 1, { t: "land", card: idIn(s, 1, "Island") }) === "You don't have priority", "a land out of turn is refused");
  const i1 = idIn(s, 0, "Island");
  s = go(s, 0, { t: "land", card: i1 });
  check(!!perm(s, i1) && s.played === 1, "a land is played in the main phase");
  check(refused(s, 0, { t: "land", card: idIn(s, 0, "Island") }) === "You've played a land this turn", "one land a turn");
  const late = scene({ hand: [["Island"], []], step: "end" });
  check(refused(late, 0, { t: "land", card: idIn(late, 0, "Island") })?.startsWith("Lands are played"), "never at the end step");
  // through the turn to the other player's draw
  s = scene({ hand: [["Island"], ["Island"]], lib: ["Remote Isle"], step: "end", passes: 1, prio: 0 });
  s = drive(s, c => c.turn === 6 && c.step === "main1");
  check(s.active === 1 && s.hand[1].length === 2 && names(s.hand[1]).includes("Remote Isle"), "the next turn: the draw is the top card of the library");
  s = scene({ hand: [["Island"], ["Island"]], step: "main1" });
  s = drive(s, c => c.step === "end" && c.active === 0);
  check(s.step === "end", "the turn goes main phase, attack (none), second main, end step");
  // the cleanup step
  s = scene({ hand: [Array(9).fill("Island"), []], step: "end", passes: 1, prio: 0 });
  s = pass(s, 0);
  check(s.pending?.t === "discard" && s.pending.n === 2 && s.pending.cleanup, "nine cards at the end of the turn: discard two");
  s = answer(s, { t: "discard", cards: s.hand[0].slice(0, 2) });
  check(s.turn > 5 && s.yard.length === 2 && s.hand[0].length >= 7, "…and the next turn begins");
  // untap
  s = scene({ bf: [[1, "Island", { tapped: true }], [0, "Island", { tapped: true }]], step: "end", passes: 1, prio: 0, hand: [[], ["Island"]] });
  s = drive(s, c => c.turn === 6 && c.step === "main1");
  check(perm(s, onBf(s, 1, "Island")).tapped === false && perm(s, onBf(s, 0, "Island")).tapped === true, "only the active player's permanents untap");
}

// ---------- the stack: responses ----------
test("a seat with nothing to answer with isn't asked: the spell resolves at once", () => {
  const s = cast(scene({ hand: [["Brainstorm"], []], bf: islandsOf(0, 1) }), 0, "Brainstorm");
  return s.pending?.t === "putback" && s.pending.seat === 0 && s.hand[0].length === 3;
});
test("a seat that could respond is asked, and a spell waits for it", () => {
  const s = cast(scene({ hand: [["Take Inventory"], ["Memory Lapse"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 2)] }), 0, "Take Inventory");
  return toMove(s) === 1 && stackNames(s).join() === "Take Inventory";
});
test("Memory Lapse: the spell goes on top of the library, and whoever draws next draws it", () => {
  let s = cast(scene({ hand: [["Take Inventory", "Island"], ["Memory Lapse"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 2)] }), 0, "Take Inventory");
  const ti = s.stack[0].card;
  s = cast(s, 1, "Memory Lapse", [T.s(s.stack[0].sid)]);
  if (s.stack.length || s.lib[0] !== ti || topKnown(s, 0) !== ti || topKnown(s, 1) !== ti) return "not on top of the library, in the open";
  if (nextDrawer(s) !== 1) return "it is the caster's turn: the other player draws next";
  const t = drive(s, c => c.turn === 6 && c.step === "main1");
  return t.active === 1 && t.hand[1].includes(ti);
});
test("…and on the other player's turn it comes back to us", () => {
  let s = cast(scene({ active: 1, hand: [["Memory Lapse"], ["Take Inventory", "Island"]], bf: [...islandsOf(0, 2), ...islandsOf(1, 3)] }), 1, "Take Inventory");
  const ti = s.stack[0].card;
  s = cast(s, 0, "Memory Lapse", [T.s(s.stack[0].sid)]);
  if (nextDrawer(s) !== 0 || s.lib[0] !== ti) return "not ours to draw";
  const t = drive(s, c => c.turn === 6 && c.step === "main1");
  return t.active === 0 && t.hand[0].includes(ti);
});
test("a counter countered: it lands on top of the library, and the spell resolves — drawing the very card that was put there", () => {
  let s = scene({ hand: [["Brainstorm", "Memory Lapse"], ["Memory Lapse"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 2)] });
  const theirs = idIn(s, 1, "Memory Lapse");
  s = cast(s, 0, "Brainstorm");
  s = cast(s, 1, "Memory Lapse", [T.s(sidOf(s, "Brainstorm"))]);
  if (toMove(s) !== 0) return "we weren't asked";
  s = cast(s, 0, "Memory Lapse", [T.s(sidOf(s, "Memory Lapse"))]);   // theirs is the one on the stack
  return s.pending?.t === "putback" && s.hand[0].includes(theirs);
});
test("Narset's Reversal: a copy for us, the original back to its owner's hand", () => {
  let s = scene({ hand: [["Brainstorm"], ["Narset's Reversal"]], bf: [...islandsOf(0, 1), ...islandsOf(1, 2)] });
  const bs = idIn(s, 0, "Brainstorm");
  s = cast(s, 0, "Brainstorm");
  s = cast(s, 1, "Narset's Reversal", [T.s(sidOf(s, "Brainstorm"))]);
  return s.pending?.t === "putback" && s.pending.seat === 1 && s.hand[0].includes(bs) && s.hand[1].length === 3;
});
test("…a copy chooses new targets: Reversal on a +2/−1 sent at their Dandân kills ours instead", () => {
  let s = scene({ hand: [["Piracy Charm"], ["Narset's Reversal"]], bf: [...islandsOf(0, 2), ...islandsOf(1, 3), [0, "Dandân"], [1, "Dandân"]] });
  const theirs = onBf(s, 1, "Dandân"), ours = onBf(s, 0, "Dandân");
  s = cast(s, 0, "Piracy Charm", [T.c(theirs)], 1);
  s = cast(s, 1, "Narset's Reversal", [T.s(sidOf(s, "Piracy Charm"))]);
  if (s.pending?.t !== "retarget" || s.pending.seat !== 1) return `no new target asked: ${JSON.stringify(s.pending)}`;
  s = resolveStack(answer(s, { t: "retarget", targets: [T.c(ours)] }));
  return !perm(s, ours) && !!perm(s, theirs) && s.yard.includes(ours);
});
test("a spell whose only target is gone fizzles and does nothing", () => {
  let s = scene({ hand: [["Repulse", "Island"], ["Repulse"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 3), [1, "Dandân"]] });
  const d = onBf(s, 1, "Dandân");
  s = cast(s, 0, "Repulse", [T.c(d)]);
  s = cast(s, 1, "Repulse", [T.c(d)]);                           // theirs saves the Dandân: back to its hand, and a card
  const first = s.stack.length === 0 && s.hand[1].includes(d) && s.hand[0].length === 1 && s.hand[1].length === 2;
  return first && s.log.some(l => l.t.includes("fizzles")) || `${s.hand.map(h => h.length)} ${s.log.map(l => l.t)}`;
});
test("the stack resolves last in, first out", () => {
  let s = scene({ hand: [["Brainstorm", "Predict"], ["Brainstorm", "Memory Lapse"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 3)] });
  s = cast(s, 0, "Predict");
  s = cast(s, 1, "Brainstorm");
  s = pass(s, 0);                                                 // theirs resolves first
  return s.pending?.t === "putback" && s.pending.seat === 1 && stackNames(s).join() === "Predict,Brainstorm";
});
test("Quicken: the next sorcery this turn can be cast with flash, once", () => {
  let s = scene({ hand: [["Quicken", "Take Inventory", "Take Inventory"], []], bf: islandsOf(0, 6), active: 1, step: "end", prio: 0, passes: 1, hold: 0 });
  const ti = () => ({ t: "cast", card: idIn(s, 0, "Take Inventory"), from: "hand", targets: [] });
  if (!/main phase/.test(refused(s, 0, ti()))) return "a sorcery at the end step without Quicken";
  s = cast(s, 0, "Quicken");
  if (!s.quick[0]) return "no flash granted";
  s = cast(s, 0, "Take Inventory");
  return !s.quick[0] && /main phase/.test(refused(s, 0, ti()));
});

// ---------- the spells ----------
// (a card in hand or a hold keeps the game stopped at the seat; see scene)
test("Brainstorm: draw three, then put two back, the first on top — known to us alone", () => {
  let s = scene({ hand: [["Brainstorm", "Island"], []], bf: islandsOf(0, 1), lib: ["Dandân", "Island", "Memory Lapse"] });
  s = cast(s, 0, "Brainstorm");
  if (s.pending?.t !== "putback" || s.hand[0].length !== 4) return "no question after drawing three";
  const [a, b] = s.hand[0].slice(1, 3);                           // two of the three drawn
  s = answer(s, { t: "putback", cards: [a, b] });
  return s.lib[0] === a && s.lib[1] === b && s.hand[0].length === 2 && topKnown(s, 0) === a && topKnown(s, 1) === null;
});
test("Predict: a right name draws two, a wrong one draws one; the top card is milled either way", () => {
  const run = name => {
    let s = scene({ hand: [["Predict", "Island"], []], bf: islandsOf(0, 2), lib: ["Island", "Dandân", "Dandân", "Dandân"] });
    s = cast(s, 0, "Predict");
    return s.pending?.t === "name" ? answer(s, { t: "name", name }) : null;
  };
  const hit = run("Island"), miss = run("Memory Lapse");
  return hit.hand[0].length === 3 && hit.yard.some(i => DECK[i] === "Island") && miss.hand[0].length === 2 && miss.yard.some(i => DECK[i] === "Island");
});
test("Repulse: a creature back to its owner's hand, and we draw", () => {
  const s0 = scene({ hand: [["Repulse", "Island"], []], bf: [...islandsOf(0, 3), [1, "Island"], [1, "Dandân"]] });
  const d = onBf(s0, 1, "Dandân");
  const s = cast(s0, 0, "Repulse", [T.c(d)]);
  return s.hand[1].includes(d) && s.hand[0].length === 2 && !perm(s, d);
});
test("Commit: a spell, or a nonland permanent, goes second from the top of the library", () => {
  let s = scene({ hand: [["Brainstorm", "Island"], ["Commit // Memory"]], bf: [...islandsOf(0, 1), ...islandsOf(1, 4)] });
  const bs = idIn(s, 0, "Brainstorm");
  s = cast(s, 0, "Brainstorm");
  s = cast(s, 1, "Commit // Memory", [T.s(sidOf(s, "Brainstorm"))]);
  const spell = s.lib[1] === bs && s.stack.length === 0;
  let t = scene({ active: 1, hand: [[], ["Commit // Memory", "Island"]], bf: [...islandsOf(1, 4), [0, "Island"], [0, "Dandân"]] });
  const d = onBf(t, 0, "Dandân");
  t = cast(t, 1, "Commit // Memory", [T.c(d)]);
  return spell && t.lib[1] === d && !perm(t, d);
});
test("Memory (aftermath): only from the graveyard, six mana, everyone shuffles hand and graveyard in and draws seven; then it is exiled", () => {
  let s = scene({ hand: [["Island", "Island"], ["Brainstorm"]], yard: ["Commit // Memory", "Take Inventory"], bf: islandsOf(0, 6) });
  const card = s.yard.find(i => DECK[i] === "Commit // Memory");
  const fromHand = halfOf(card, "hand") === "Commit" && halfOf(card, "yard") === "Memory";
  s = go(s, 0, { t: "cast", card, from: "yard", targets: [] });
  return fromHand && s.hand[0].length === 7 && s.hand[1].length === 7 && s.yard.length === 0 && s.exile.includes(card) && !s.lib.includes(card);
});
test("Metamorphose: their permanent goes on top of the library, and they may put a creature or land from their hand onto the battlefield", () => {
  let s = scene({ hand: [["Metamorphose", "Island"], ["Dandân", "Island"]], bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [1, "Dandân"]] });
  const old = onBf(s, 1, "Dandân"), spare = idIn(s, 1, "Dandân");
  s = cast(s, 0, "Metamorphose", [T.c(old)]);
  if (s.pending?.t !== "pick" || s.pending.seat !== 1 || s.pending.for !== "drop") return "they weren't asked";
  s = answer(s, { t: "pick", card: spare });
  return s.lib[0] === old && onBf(s, 1, "Dandân") === spare && !s.hand[1].includes(spare);
});
test("Piracy Charm: islandwalk makes an attacker unblockable against a player with an Island", () => {
  let s = scene({ hand: [["Piracy Charm"], []], bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"], [1, "Dandân"]] });
  s = pass(s, 0);                                                 // to the attack
  s = answer(s, { t: "attack", ids: [onBf(s, 0, "Dandân")] });
  s = cast(s, 0, "Piracy Charm", [T.c(onBf(s, 0, "Dandân"))], 0);
  s = drive(s, c => c.step === "main2");
  return s.life[1] === 16 && !!onBf(s, 1, "Dandân");
});
test("Piracy Charm: +2/−1 kills a Dandân (toughness 1) at once", () => {
  let s = scene({ hand: [["Piracy Charm"], []], bf: [...islandsOf(0, 2), [1, "Dandân"]] });
  const d = onBf(s, 1, "Dandân");
  s = cast(s, 0, "Piracy Charm", [T.c(d)], 1);
  return !perm(s, d) && s.yard.includes(d);
});
test("Piracy Charm: a player discards a card of their choice", () => {
  let s = scene({ hand: [["Piracy Charm", "Island"], ["Island", "Brainstorm"]], bf: islandsOf(0, 2) });
  s = cast(s, 0, "Piracy Charm", [T.p(1)], 2);
  if (s.pending?.t !== "discard" || s.pending.seat !== 1) return "they weren't asked";
  const gone = idIn(s, 1, "Island");
  s = answer(s, { t: "discard", cards: [gone] });
  return s.hand[1].length === 1 && s.yard.includes(gone);
});
test("Chart a Course: draw two, then discard a card unless we attacked this turn", () => {
  const s = cast(scene({ hand: [["Chart a Course", "Island"], []], bf: islandsOf(0, 2) }), 0, "Chart a Course");
  const asks = s.pending?.t === "discard" && s.pending.seat === 0 && s.hand[0].length === 3;
  let t = scene({ hand: [["Chart a Course", "Island"], []], bf: islandsOf(0, 2), step: "main2" });
  t.attacked = true;
  t = cast(t, 0, "Chart a Course");
  return asks && !t.pending && t.hand[0].length === 3;
});
test("Deem Inferior: costs {1} less for each card drawn this turn; the owner puts the permanent second from the top or on the bottom", () => {
  const s0 = scene({ hand: [["Deem Inferior", "Island"], []], bf: [...islandsOf(0, 4), [1, "Island"], [1, "Dandân"]] });
  const c = n => total(costOf({ ...s0, drawn: [n, 0] }, 0, "Deem Inferior", "hand"));
  if (!(c(0) === 4 && c(1) === 3 && c(3) === 1 && c(5) === 1)) return "the cost doesn't fall with the draws";
  const s = cast(s0, 0, "Deem Inferior", [T.c(onBf(s0, 1, "Dandân"))]);
  const d = s.pending?.target;
  if (s.pending?.t !== "owner" || s.pending.seat !== 1) return "the owner wasn't asked";
  const second = answer(s, { t: "owner", bottom: false }), bottom = answer(s, { t: "owner", bottom: true });
  return second.lib[1] === d && bottom.lib[bottom.lib.length - 1] === d && !perm(second, d);
});
test("Gone Missing: a permanent on top of its owner's library, and a Clue for us; a Clue costs {2} and a sacrifice to draw", () => {
  let s = scene({ hand: [["Gone Missing", "Island"], []], bf: [...islandsOf(0, 5), [1, "Island"], [1, "Dandân"]] });
  const d = onBf(s, 1, "Dandân");
  s = cast(s, 0, "Gone Missing", [T.c(d)]);
  if (s.lib[0] !== d || !s.bf.some(p => p.id >= TOKEN_AT && p.ctl === 0)) return "no Dandân on top, or no Clue";
  const u = scene({ bf: [...islandsOf(0, 2), [0, "Clue"]], hand: [["Island"], []] });
  const c2 = go(u, 0, { t: "ability", id: u.bf.find(p => p.id >= TOKEN_AT).id });
  return c2.hand[0].length === 2 && !c2.bf.some(p => p.id >= TOKEN_AT) && c2.bf.every(p => p.tapped);
});
test("Lórien Revealed: draw three; or {1}: islandcycling, discard it to fetch an Island card into hand", () => {
  const a = cast(scene({ hand: [["Lórien Revealed", "Island"], []], bf: islandsOf(0, 5) }), 0, "Lórien Revealed");
  let s = scene({ hand: [["Lórien Revealed"], []], bf: islandsOf(0, 1), lib: ["Dandân"] });
  s = go(s, 0, { t: "cycle", card: idIn(s, 0, "Lórien Revealed") });
  if (s.pending?.t !== "search" || s.pending.to !== "hand" || !s.pending.ids.every(i => (CARDS[DECK[i]].subs || []).includes("Island"))) return "no search for an Island card";
  const pick = s.pending.ids[0];
  s = answer(s, { t: "search", card: pick });
  return a.hand[0].length === 4 && s.hand[0].includes(pick) && s.yard.some(i => DECK[i] === "Lórien Revealed");
});
test("Mystic Retrieval: an instant or sorcery card back from the graveyard; flashback {2}{R} from there, then exiled", () => {
  let s = scene({ hand: [["Mystic Retrieval"], []], yard: ["Memory Lapse", "Dandân"], bf: islandsOf(0, 4) });
  const lapse = s.yard.find(i => DECK[i] === "Memory Lapse"), dandan = s.yard.find(i => DECK[i] === "Dandân");
  if (!moves(s, 0).some(m => m.t === "cast" && m.targets[0]?.id === lapse) || moves(s, 0).some(m => m.targets?.[0]?.id === dandan)) return "it should aim at the Lapse and not the Dandân";
  s = cast(s, 0, "Mystic Retrieval", [T.g(lapse)]);
  const got = s.hand[0].includes(lapse) && !s.yard.includes(lapse);
  let f = scene({ yard: ["Mystic Retrieval", "Brainstorm"], bf: [...islandsOf(0, 2), [0, "Thundering Falls"]], hand: [["Island"], []] });
  const mr = f.yard.find(i => DECK[i] === "Mystic Retrieval"), bs = f.yard.find(i => DECK[i] === "Brainstorm");
  f = go(f, 0, { t: "cast", card: mr, from: "yard", targets: [T.g(bs)] });
  return got && f.hand[0].includes(bs) && f.exile.includes(mr) && !f.yard.includes(mr);
});
test("Take Inventory: draws one, and one more for each in the graveyard", () => {
  const s = cast(scene({ hand: [["Take Inventory", "Island"], []], yard: ["Take Inventory", "Take Inventory"], bf: islandsOf(0, 2) }), 0, "Take Inventory");
  return s.hand[0].length === 4;
});

// ---------- the lands ----------
test("Flood Plain: enters tapped; tap and sacrifice it to fetch an Island or Plains card onto the battlefield", () => {
  let s = scene({ hand: [["Flood Plain"], []], hold: 0 });
  s = go(s, 0, { t: "land", card: idIn(s, 0, "Flood Plain") });
  const fp = onBf(s, 0, "Flood Plain");
  return perm(s, fp).tapped && refused(s, 0, { t: "ability", id: fp }) === "It's tapped";
});
test("Flood Plain: the search finds Islands (and Island-typed lands), not other lands", () => {
  let s = scene({ bf: [[0, "Flood Plain"]], hand: [[], []] });
  s = go(s, 0, { t: "ability", id: onBf(s, 0, "Flood Plain") });
  if (s.pending?.t !== "search" || s.pending.to !== "bf") return "no search";
  const ok = s.pending.ids.every(i => ["Island", "Mystic Sanctuary", "Thundering Falls"].includes(DECK[i]));
  const pick = s.pending.ids.find(i => DECK[i] === "Island");
  s = answer(s, { t: "search", card: pick });
  return ok && !onBf(s, 0, "Flood Plain") && onBf(s, 0, "Island") === pick && !perm(s, pick).tapped && s.yard.some(i => DECK[i] === "Flood Plain");
});
test("Halimar Depths: enters tapped; look at the top three and put them back in any order", () => {
  let s = scene({ hand: [["Halimar Depths"], []], lib: ["Dandân", "Island", "Memory Lapse"], hold: 0 });
  const [a, b, c] = s.lib.slice(0, 3);
  s = resolveStack(go(s, 0, { t: "land", card: idIn(s, 0, "Halimar Depths") }));
  if (s.pending?.t !== "order" || s.pending.cards.length !== 3) return "no question about the top three";
  s = answer(s, { t: "order", cards: [c, a, b] });
  return s.lib.slice(0, 3).join() === [c, a, b].join() && topKnown(s, 0) === c && topKnown(s, 1) === null;
});
test("Izzet Boilerworks: enters tapped and returns a land we control to hand; taps for {U}{R} together", () => {
  let s = scene({ hand: [["Izzet Boilerworks"], []], bf: [[0, "Island"], [0, "Island", { tapped: true }]] });
  s = go(s, 0, { t: "land", card: idIn(s, 0, "Izzet Boilerworks") });
  if (s.pending?.t !== "pick" || s.pending.for !== "boil") return "no land to return";
  const back = s.pending.ids.find(i => perm(s, i).tapped && nm(i) === "Island");
  s = answer(s, { t: "pick", card: back });
  const t = scene({ bf: [[0, "Izzet Boilerworks"], [0, "Island"]], hand: [[], []] });
  const plan = payPlan(t, 0, parseCost("{2}{R}"));
  return s.hand[0].includes(back) && !!plan && plan.taps.length === 2 && !canPay(scene({ bf: islandsOf(0, 3), hand: [[], []] }), 0, parseCost("{2}{R}"));
});
test("Lonely Sandbar and Remote Isle: tapped lands that tap for blue, and cycle for {U} and {2}", () => {
  let s = scene({ hand: [["Lonely Sandbar", "Remote Isle"], []], bf: islandsOf(0, 3) });
  s = go(s, 0, { t: "cycle", card: idIn(s, 0, "Lonely Sandbar") });
  s = go(s, 0, { t: "cycle", card: idIn(s, 0, "Remote Isle") });
  const t = scene({ hand: [["Lonely Sandbar"], []], hold: 0 });
  const sandbar = idIn(t, 0, "Lonely Sandbar");
  const tapped = perm(go(t, 0, { t: "land", card: sandbar }), sandbar).tapped;
  const poor = scene({ hand: [["Remote Isle"], []], bf: islandsOf(0, 1) });
  return s.hand[0].length === 2 && s.bf.filter(p => p.tapped).length === 3 && tapped && refused(poor, 0, { t: "cycle", card: idIn(poor, 0, "Remote Isle") }) === "Not enough mana";
});
test("Mystic Sanctuary: an Island, tapped unless we control three other Islands; untapped it may put an instant or sorcery from the graveyard on top", () => {
  let s = scene({ hand: [["Mystic Sanctuary"], []], bf: islandsOf(0, 1), yard: ["Memory Lapse"], hold: 0 });   // two Islands with the hold's
  s = go(s, 0, { t: "land", card: idIn(s, 0, "Mystic Sanctuary") });
  const slow = perm(s, onBf(s, 0, "Mystic Sanctuary")).tapped && !s.pending;
  let t = scene({ hand: [["Mystic Sanctuary"], []], bf: islandsOf(0, 2), yard: ["Memory Lapse", "Dandân"], hold: 0 });
  const lapse = t.yard.find(i => DECK[i] === "Memory Lapse");
  t = resolveStack(go(t, 0, { t: "land", card: idIn(t, 0, "Mystic Sanctuary") }));
  if (t.pending?.t !== "pick" || t.pending.for !== "sanct" || t.pending.ids.length !== 1) return "no choice from the graveyard";
  t = answer(t, { t: "pick", card: lapse });
  const sanct = perm(t, onBf(t, 0, "Mystic Sanctuary"));
  return slow && !sanct.tapped && t.lib[0] === lapse && typesOf(sanct).includes("Island");
});
test("Thundering Falls: enters tapped, an Island and a Mountain (blue or red), surveil 1", () => {
  let s = scene({ hand: [["Thundering Falls"], []], lib: ["Dandân"], hold: 0 });
  const top = s.lib[0];
  s = resolveStack(go(s, 0, { t: "land", card: idIn(s, 0, "Thundering Falls") }));
  if (s.pending?.t !== "surveil" || s.pending.card !== top) return "no look at the top card";
  const yard = answer(s, { t: "surveil", yard: true }), keep = answer(s, { t: "surveil", yard: false });
  const f = perm(s, onBf(s, 0, "Thundering Falls"));
  return yard.yard.includes(top) && keep.lib[0] === top && f.tapped && typesOf(f).join() === "Island,Mountain";
});

// ---------- Dandân and combat ----------
test("a Dandân can't attack the turn it comes in", () => {
  let s = scene({ hand: [["Dandân"], []], bf: [...islandsOf(0, 2), ...islandsOf(1, 1)], hold: 0 });
  s = cast(s, 0, "Dandân");
  const d = onBf(s, 0, "Dandân");
  s = pass(s, 0);
  return !!d && s.step === "main2" && !s.pending;
});
test("it attacks only a player who controls an Island", () => {
  const none = pass(scene({ bf: [...islandsOf(0, 2), [0, "Dandân"], [1, "Remote Isle"]], hand: [[], []], hold: 0 }), 0);
  const some = pass(scene({ bf: [...islandsOf(0, 2), [0, "Dandân"], [1, "Island"]], hand: [[], []], hold: 0 }), 0);
  return none.step === "main2" && !none.pending && some.pending?.t === "attack" && some.pending.ids.length === 1;
});
test("an unblocked Dandân deals 4; a blocking Dandân trades with it", () => {
  let s = scene({ bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"]], hand: [[], []] });
  s = answer(pass(s, 0), { t: "attack", ids: [onBf(s, 0, "Dandân")] });
  s = drive(s, c => c.step === "main2");
  let t = scene({ bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"], [1, "Dandân"]], hand: [[], []] });
  const a = onBf(t, 0, "Dandân"), b = onBf(t, 1, "Dandân");
  t = answer(pass(t, 0), { t: "attack", ids: [a] });
  if (t.pending?.t !== "block" || t.pending.seat !== 1) return "they weren't asked to block";
  t = answer(t, { t: "block", pairs: [[b, a]] });
  t = drive(t, c => c.step === "main2");
  return s.life[1] === 16 && t.life[1] === 20 && !perm(t, a) && !perm(t, b) && t.yard.includes(a) && t.yard.includes(b);
});
test("attackers tap, and declining to block takes the damage", () => {
  let t = scene({ bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"], [1, "Dandân"]], hand: [[], []] });
  const a = onBf(t, 0, "Dandân");
  t = answer(pass(t, 0), { t: "attack", ids: [a] });
  const tapped = perm(t, a).tapped;
  t = answer(t, { t: "block", pairs: [] });
  t = drive(t, c => c.step === "main2");
  return tapped && t.life[1] === 16 && !!perm(t, a);
});
test("with no Island under it, a Dandân is sacrificed", () => {
  const s = scene({ bf: [[0, "Remote Isle"], [0, "Dandân"], [1, "Island"]], hand: [[], []], hold: 1 });
  const t = drive(pass(s, 0), c => !onBf(c, 0, "Dandân"));
  return !onBf(t, 0, "Dandân") && t.yard.some(i => DECK[i] === "Dandân");
});
test("…and one whose last Island is taken away by Mind Bend (an Island turned into a Swamp) is too", () => {
  let s = scene({ hand: [["Mind Bend"], []], bf: [...islandsOf(0, 1), [1, "Island"], [1, "Dandân"]] });
  const isle = onBf(s, 1, "Island");
  s = cast(s, 0, "Mind Bend", [T.c(isle)]);
  if (s.pending?.t !== "bend" || !s.pending.froms.includes("Island")) return "no choice of land type";
  s = answer(s, { t: "bend", from: "Island", to: "Swamp" });
  s = drive(s, c => !c.stack.length);
  return !onBf(s, 1, "Dandân") && typesOf(perm(s, isle)).join() === "Swamp";
});
test("Mind Bend on a Dandân: its text looks for another land type — a Plains it doesn't control, and it is sacrificed", () => {
  let s = scene({ hand: [["Mind Bend"], []], bf: [...islandsOf(0, 1), ...islandsOf(1, 2), [1, "Dandân"]] });
  const d = onBf(s, 1, "Dandân");
  s = cast(s, 0, "Mind Bend", [T.c(d)]);
  if (s.pending?.t !== "bend" || s.pending.froms.join() !== "Island") return "a Dandân's text names only the Island";
  s = answer(s, { t: "bend", from: "Island", to: "Plains" });
  s = drive(s, c => !c.stack.length);
  return !perm(s, d) && s.yard.includes(d);
});
test("…to a Mountain their Thundering Falls is: it lives, and attacks only a player who controls a Mountain", () => {
  let s = scene({ hand: [["Mind Bend", "Island"], []], bf: [[1, "Thundering Falls"], [1, "Dandân"], ...islandsOf(0, 1)] });
  const d = onBf(s, 1, "Dandân");
  s = cast(s, 0, "Mind Bend", [T.c(d)]);
  s = answer(s, { t: "bend", from: "Island", to: "Mountain" });
  s = drive(s, c => !c.stack.length);
  // on its owner's turn: it can attack a player with a Mountain (their Thundering Falls), not one with only an Island
  const bent = [["Island", "Mountain"]];
  const turn = other => scene({ active: 1, hand: [[], []], bf: [[1, "Thundering Falls"], [1, "Dandân", { tc: bent }], other] });
  const plain = turn([0, "Island"]), mountain = turn([0, "Thundering Falls"]);
  return !!perm(s, d) && JSON.stringify(perm(s, d).tc) === JSON.stringify(bent)
    && !canAttack(plain, perm(plain, onBf(plain, 1, "Dandân"))) && canAttack(mountain, perm(mountain, onBf(mountain, 1, "Dandân")));
});
test("Mind Bend: an Island turned into a Mountain taps for red", () => {
  let s = scene({ hand: [["Mind Bend"], []], bf: [...islandsOf(0, 1), ...islandsOf(1, 3)] });
  const isle = onBf(s, 1, "Island");
  s = cast(s, 0, "Mind Bend", [T.c(isle)]);
  s = answer(s, { t: "bend", from: "Island", to: "Mountain" });
  return canPay(s, 1, parseCost("{R}")) && typesOf(perm(s, isle)).join() === "Mountain" && islands(s, 1).length === 2;
});
test("losing the last life point loses the game", () => {
  let s = scene({ bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"]], hand: [[], []], life: [20, 4] });
  s = answer(pass(s, 0), { t: "attack", ids: [onBf(s, 0, "Dandân")] });
  s = drive(s, c => c.over);
  return s.over && s.winner === 0 && s.why === "life" && toMove(s) === null;
});
test("drawing from an empty library loses the game", () => {
  let s = scene({ hand: [[], []], bf: [...islandsOf(0, 1), ...islandsOf(1, 1)], bare: true, lib: [], step: "end", passes: 1, prio: 0 });
  s = drive(s, c => c.over);
  return s.over && s.winner === 0 && s.why === "library";
});
test("a draw spell on an empty library loses too — once it has finished resolving", () => {
  let s = scene({ hand: [["Brainstorm"], []], bf: islandsOf(0, 1), bare: true, lib: ["Island", "Island"] });
  s = cast(s, 0, "Brainstorm");
  if (s.over || s.pending?.t !== "putback") return "the game ended before Brainstorm finished";
  s = answer(s, { t: "putback", cards: s.hand[0] });
  return s.over && s.winner === 1 && s.why === "library";
});

// ---------- moves ----------
test("every move moves() offers is one the game accepts", () => {
  let n = 0;
  for (let seed = 1; seed <= 8; seed++) {
    let s = restore(J(deal({ rng: seeded(seed) })));
    for (let i = 0; i < 400 && !s.over; i++) {
      const who = toMove(s);
      if (!s.pending) for (const m of moves(s, who)) { if (refused(s, who, m) !== null) throw new Error(`seed ${seed}: ${JSON.stringify(m)} offered but refused`); n++; }
      s = go(s, who, botMove(s, who, { rng: seeded(seed * 1000 + i) }));
    }
  }
  return n > 500;
});

// ---------- the state through the database ----------
test("a game survives the database at every move (empty lists dropped, holes, nulls)", () => {
  let G = newRecord(rules, { seats: 2, seed: 77, now: 0 });
  for (let i = 0; i < 600 && !rules.over(G.state); i++) {
    const back = roundTrip(G);
    if (!same(rules.restore(J(back.state)), rules.restore(J(G.state)))) throw new Error(`move ${i}: the state changed through the database`);
    const who = rules.toMove(back.state);
    G = applyMove(rules, back, who, botMove(rules.restore(J(back.state)), who, { rng: seeded(i) }), 0).G;
  }
  return true;
});

// ---------- the computer player ----------
const seatRng = n => seeded(n);
test("it takes a free mulligan on a hand short of lands, keeps a good one, and keeps a poor one it has already paid for", () => {
  const asked = (hand, pending) => { const s = scene({ hand: [hand, []] }); s.pending = { t: "mull", seat: 0, ...pending }; return botMove(s, 0, { rng: seatRng(1) }).t; };
  const spells = ["Memory Lapse", "Dandân", "Brainstorm", "Predict", "Repulse", "Mind Bend"];
  return asked(["Island", ...spells], { free: true, taken: 0 }) === "mull"
    && asked(["Island", "Remote Isle", "Island", ...spells.slice(0, 4)], { free: false, taken: 0 }) === "keep"
    && asked(["Island", ...spells], { free: false, taken: 2 }) === "keep"
    && asked(["Island", ...spells], { free: false, taken: 0 }) === "mull";
});
test("it holds two mana for its Memory Lapse and counters a Dandân", () => {
  let s = scene({ active: 0, hand: [["Dandân"], ["Memory Lapse"]], bf: [...islandsOf(0, 2), ...islandsOf(1, 2)] });
  s = cast(s, 0, "Dandân");
  const m = botMove(s, 1, { rng: seatRng(2), level: "hard" });
  return m.t === "cast" && m.targets[0].k === "s";
});
test("it doesn't spend a Memory Lapse on a Quicken", () => {
  let s = scene({ active: 0, hand: [["Quicken"], ["Memory Lapse"]], bf: [...islandsOf(0, 2), ...islandsOf(1, 2)] });
  s = cast(s, 0, "Quicken");
  return botMove(s, 1, { rng: seatRng(2), level: "hard" }).t === "pass";
});
test("it casts a Dandân when it has Islands, and not when it has none", () => {
  const withIsle = scene({ hand: [["Dandân"], []], bf: islandsOf(0, 2) });
  const none = scene({ hand: [["Dandân"], []], bf: [[0, "Remote Isle"], [0, "Lonely Sandbar"]] });
  return botMove(withIsle, 0, { rng: seatRng(1) }).t === "cast" && botMove(none, 0, { rng: seatRng(1) }).t === "pass";
});
test("it kills an attacking Dandân with Piracy Charm", () => {
  let s = scene({ active: 1, hand: [["Piracy Charm"], []], bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [1, "Dandân"]] });
  s = answer(pass(s, 1), { t: "attack", ids: [onBf(s, 1, "Dandân")] });
  const m = botMove(s, 0, { rng: seatRng(1) });
  return m.t === "cast" && m.mode === 1 && m.targets[0].id === onBf(s, 1, "Dandân");
});
test("it keeps its Dandân home when the swing back would be lethal", () => {
  const s = pass(scene({ active: 0, life: [4, 20], bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"], [1, "Dandân"]], hand: [[], []] }), 0);
  const m = botMove(s, 0, { rng: seatRng(1) });
  return s.pending?.t === "attack" && m.t === "attack" && m.ids.length === 0;
});
test("it blocks a Dandân that would kill it", () => {
  let s = scene({ active: 1, life: [4, 20], bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"], [1, "Dandân"]], hand: [[], []] });
  s = pass(s, 1);
  s = answer(s, { t: "attack", ids: [onBf(s, 1, "Dandân")] });
  const m = botMove(s, 0, { rng: seatRng(1) });
  return m.t === "block" && m.pairs.length === 1;
});
test("its answers are always legal ones, for every kind of question and at every level", () => {
  // a game played at random reaches every question; the computer is asked each one, at each level, and the answer tried
  const kinds = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    let s = restore(J(deal({ rng: seeded(seed) })));
    const rng = seeded(seed);
    for (let i = 0; i < 500 && !s.over; i++) {
      const who = toMove(s);
      if (s.pending) kinds.add(s.pending.t);
      for (const level of ["easy", "medium", "hard"]) go(s, who, botMove(s, who, { rng: seeded(i), level }));   // throws if refused
      s = go(s, who, randomMove(s, who, rng));
    }
  }
  const all = ["mull", "bottom", "attack", "block", "discard", "putback", "order", "surveil", "search", "pick", "owner", "bend", "name", "retarget"];
  const missing = all.filter(k => !kinds.has(k));
  if (missing.length) throw new Error(`never asked: ${missing}`);
  return true;
});

// ---------- whole games ----------
{
  let refusedAt = null, unfinished = 0, lengths = [], bySeat = [0, 0];
  const t0 = Date.now();
  for (let g = 0; g < 100; g++) {
    let G = newRecord(rules, { seats: 2, seed: 9000 + g, now: 0 });
    const rng = seeded(31 + g);
    let n = 0;
    while (!rules.over(G.state) && n < 6000) {
      const who = rules.toMove(G.state);
      const r = applyMove(rules, G, who, botMove(rules.restore(J(G.state)), who, { rng, level: "hard" }), 0);
      if (r.error) { refusedAt = `game ${g} move ${n}: ${r.error}`; break; }
      G = r.G; n++;
      if (n % 25 === 0) {
        const s = rules.restore(J(G.state)), all = [...s.lib, ...s.yard, ...s.exile, ...s.hand[0], ...s.hand[1], ...s.bf.filter(p => p.id < TOKEN_AT).map(p => p.id), ...s.stack.filter(i => i.kind === "spell" && !i.copy).map(i => i.card)];
        if (new Set(all).size !== 80 || all.length !== 80) { refusedAt = `game ${g}: cards ${all.length}, ${new Set(all).size} different`; break; }
      }
    }
    if (refusedAt) break;
    if (!rules.over(G.state)) unfinished++;
    else { lengths.push(G.state.turn); bySeat[G.state.winner]++; }
  }
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  check(!refusedAt, `100 games of computer players, no illegal move and no card lost or made${refusedAt ? ` (${refusedAt})` : ""} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  check(!unfinished && Math.min(...lengths) >= 6 && Math.max(...lengths) < 150 && mean > 14 && mean < 60, `…every one finished, in ${Math.min(...lengths)}–${Math.max(...lengths)} turns, ${mean.toFixed(1)} on average`);
  check(Math.min(...bySeat) >= 25, `…neither seat has the game (${bySeat.join(" and ")} wins)`);
}
test("a seeded game is played the same way twice", () => {
  const play = () => {
    let G = newRecord(rules, { seats: 2, seed: 123, now: 0 });
    for (let i = 0; i < 6000 && !rules.over(G.state); i++) { const who = rules.toMove(G.state); G = applyMove(rules, G, who, seatBot(rules, G, who, "hard"), 0).G; }
    return JSON.stringify(G);
  };
  const a = play();
  return a === play() && JSON.parse(a).state.over;
});
{
  /** `a`'s wins in `n` games of a against b, a taking each seat in turn. */
  const versus = (a, b, n, from) => {
    let wins = 0;
    for (let g = 0; g < n; g++) {
      let G = newRecord(rules, { seats: 2, seed: from + g, now: 0 });
      const rng = seeded(7 + g), mine = g % 2;
      const pick = (lvl, s, who) => (lvl === "random" ? randomMove(s, who, rng) : botMove(s, who, { rng, level: lvl }));
      for (let i = 0; i < 6000 && !rules.over(G.state); i++) {
        const who = rules.toMove(G.state);
        G = applyMove(rules, G, who, pick(who === mine ? a : b, rules.restore(J(G.state)), who), 0).G;
      }
      if (G.state.winner === mine) wins++;
    }
    return wins;
  };
  const r = versus("hard", "random", 60, 4000);
  check(r >= 54, `Hard beats a player who moves at random in ${r} of 60 games`);
  const e = versus("hard", "easy", 100, 6000);
  check(e >= 60, `…and Easy in ${e} of 100`);
  const m = versus("medium", "random", 40, 8000);
  check(m >= 34, `Medium beats random in ${m} of 40`);
}

console.log(bad ? `dandan: ${bad} failed` : "dandan: every check passed");
process.exit(bad ? 1 : 0);
