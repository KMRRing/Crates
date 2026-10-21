// Dandan's coach (dandan-coach.js, on dandan-think.js's weighing and dandan-eval.js's judge): its words for every kind
// of move, its advice legal and the same each time, nothing it can't see changing it, the judge's chances, the
// verdict's margin, its reasons on positions with one right answer, and what the deals showed.
import { DECK } from "../dandan-cards.js";
import { toMove, deal, restore } from "../dandan-engine.js";
import { T } from "../dandan-spells.js";
import { think, determinize, seedOf } from "../dandan-think.js";
import { moveSaid, moveName, adviceLine, verdict, reasons, sameMove, MARGIN, evidence } from "../dandan-coach.js";
import { winChance, features, FEATURES } from "../dandan-eval.js";
import { allAmong } from "../dandan-reads.js";
import { facts, holds } from "../dandan-policy.js";
import { isLandId } from "../dandan-core.js";
import { botMove } from "../dandan-bot.js";
import { seeded } from "../seats.js";
import { J, scene, islandsOf, go, refused, idIn, onBf, cast, pass, answer, resolveStack, sidOf } from "./dandan-scene.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const test = (what, fn) => {
  try { const r = fn(); check(r !== false && typeof r !== "string", typeof r === "string" ? `${what} — ${r}` : what); }
  catch (e) { console.log(`FAIL ${what}: ${e.message}`); bad++; }
};
const BUDGET = { deals: 32, wide: 9 };

// ---------- the positions ----------
const lone = () => scene({ turn: 2, active: 0, hand: [["Mind Bend", "Island", "Brainstorm"], ["Island"]], bf: [[0, "Island"], [1, "Island"]], step: "main1" });
const theirDandan = () => cast(scene({ active: 1, hand: [["Memory Lapse", "Brainstorm"], ["Dandân", "Island"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 3)] }), 1, "Dandân");
const keepOpen = () => scene({ active: 0, step: "main2", hand: [["Memory Lapse", "Take Inventory"], ["Island", "Island", "Island", "Dandân"]], bf: [...islandsOf(0, 3), ...islandsOf(1, 3)] });

// ---------- words ----------
test("every kind of move has words, with no gap in them", () => {
  const said = [];
  const say = (s, m) => { const w = moveSaid(m, s, toMove(s)); said.push(w); if (!w || /undefined|null|NaN/.test(w)) throw new Error(`${JSON.stringify(m)}: "${w}"`); };
  const s = lone();
  say(s, { t: "pass" });
  say(s, { t: "land", card: idIn(s, 0, "Island") });
  say(s, { t: "cast", card: idIn(s, 0, "Mind Bend"), from: "hand", targets: [T.c(onBf(s, 1, "Island"))] });
  say(s, { t: "cast", card: idIn(s, 0, "Brainstorm"), from: "hand", targets: [] });
  const d = theirDandan();
  say(d, { t: "cast", card: idIn(d, 0, "Memory Lapse"), from: "hand", targets: [T.s(sidOf(d, "Dandân"))] });
  say(d, { t: "pass" });
  const c = scene({ hand: [["Piracy Charm", "Lonely Sandbar"], []], bf: [...islandsOf(0, 3), [1, "Island"], [1, "Dandân"], [0, "Clue"]] });
  say(c, { t: "cast", card: idIn(c, 0, "Piracy Charm"), from: "hand", mode: 1, targets: [T.c(onBf(c, 1, "Dandân"))] });
  say(c, { t: "cast", card: idIn(c, 0, "Piracy Charm"), from: "hand", mode: 2, targets: [T.p(1)] });
  say(c, { t: "cycle", card: idIn(c, 0, "Lonely Sandbar") });
  say(c, { t: "ability", id: c.bf.find(p => p.id >= 100).id });
  const y = scene({ yard: ["Mystic Retrieval", "Memory Lapse"], bf: [...islandsOf(0, 2), [0, "Thundering Falls"]], hand: [["Island"], []] });
  say(y, { t: "cast", card: y.yard[0], from: "yard", targets: [T.g(y.yard[1])] });
  // the questions
  const m = scene({ hand: [["Island", "Island", "Dandân", "Memory Lapse", "Brainstorm", "Predict", "Repulse"], []] });
  m.pending = { t: "mull", seat: 0, free: false, taken: 0 }; say(m, { t: "keep" }); say(m, { t: "mull" });
  m.pending = { t: "bottom", seat: 0, n: 1 }; say(m, { t: "bottom", cards: [m.hand[0][0]] });
  m.pending = { t: "discard", seat: 0, n: 1 }; say(m, { t: "discard", cards: [m.hand[0][1]] });
  m.pending = { t: "putback", seat: 0, n: 2 }; say(m, { t: "putback", cards: m.hand[0].slice(0, 2) });
  m.pending = { t: "name", seat: 0 }; say(m, { t: "name", name: "Island" });
  const a = pass(scene({ bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [0, "Dandân"], [0, "Dandân"]], hand: [[], []] }), 0);
  say(a, { t: "attack", ids: a.pending.ids }); say(a, { t: "attack", ids: [] }); say(a, { t: "attack", ids: a.pending.ids.slice(0, 1) });
  const h0 = scene({ hand: [["Halimar Depths"], []], lib: ["Dandân", "Island", "Memory Lapse"], hold: 0 });
  const h = resolveStack(go(h0, 0, { t: "land", card: idIn(h0, 0, "Halimar Depths") }));
  say(h, { t: "order", cards: h.pending.cards });
  const b0 = scene({ hand: [["Mind Bend"], []], bf: [...islandsOf(0, 1), ...islandsOf(1, 2), [1, "Dandân"]] });
  const b = cast(b0, 0, "Mind Bend", [T.c(onBf(b0, 1, "Dandân"))]);
  say(b, { t: "bend", from: "Island", to: "Plains" });
  return said.length === 22 && said.every(w => /^[A-Z]/.test(w)) || `${said.length} said`;
});
test("moves the same but for a permanent's object number, the order of a set, or the hold flag are the same move", () =>
  sameMove({ t: "cast", card: 1, targets: [{ k: "c", id: 5, oid: 9 }] }, { t: "cast", card: 1, targets: [{ k: "c", id: 5 }], hold: true })
  && sameMove({ t: "bottom", cards: [3, 1] }, { t: "bottom", cards: [1, 3] }) && !sameMove({ t: "putback", cards: [3, 1] }, { t: "putback", cards: [1, 3] }));

// ---------- the advice ----------
test("the advice is legal, and the same every time it is asked", () => {
  for (const make of [lone, theirDandan, keepOpen]) {
    const s = make(), seat = toMove(s);
    const a = think(s, seat, BUDGET), b = think(J(s), seat, BUDGET);
    if (!sameMove(a.best, b.best) || a.list.map(c => c.mean).join() !== b.list.map(c => c.mean).join()) return "it changed";
    if (refused(s, seat, a.best) !== null) return `${JSON.stringify(a.best)} refused`;
  }
  return true;
});
test("the weighing leaves the game it weighs as it was, every count and tell included", () => {
  for (const make of [lone, theirDandan, keepOpen]) {
    const s = make(), seat = toMove(s), was = JSON.stringify(s);
    think(s, seat, { ...BUDGET, reply: 4 });
    if (JSON.stringify(s) !== was) return `${make.name}: the game changed`;
  }
  return true;
});
test("what the seat can't see (the other hand, the library's order) changes nothing", () => {
  const s = keepOpen(), seat = 0;
  const t = J(s);
  // swap a card of the other hand with one deep in the library, and turn the library over: all unseen by seat 0
  const k = t.lib.length - 1;
  [t.hand[1][0], t.lib[k]] = [t.lib[k], t.hand[1][0]];
  t.lib = t.lib.reverse();
  if (seedOf(s, seat) !== seedOf(t, seat)) return "the seed saw it";
  // (with the other player's answers tried, as the page asks: they're tried in the deals, never in the real hand)
  const a = think(s, seat, { ...BUDGET, reply: 4 }), b = think(t, seat, { ...BUDGET, reply: 4 });
  const d1 = determinize(s, seat, seeded(3)), d2 = determinize(t, seat, seeded(3));
  return sameMove(a.best, b.best) && a.list.map(c => c.mean.toFixed(6)).join() === b.list.map(c => c.mean.toFixed(6)).join()
    && JSON.stringify(d1.hand[1]) === JSON.stringify(d2.hand[1]) && JSON.stringify(d1.lib) === JSON.stringify(d2.lib) || "the deals or the advice differ";
});
test("a deal keeps what the seat knows where it is: its hand, the table, a top card it saw, a card it saw go into the other hand", () => {
  let s = keepOpen();
  s.kn = [[s.lib[0], 3]];
  s.kh = [[s.hand[1][2], 1]];
  const known = s.hand[1][2], top = s.lib[0];
  for (let i = 0; i < 20; i++) {
    const d = determinize(s, 0, seeded(i));
    if (JSON.stringify(d.hand[0]) !== JSON.stringify(s.hand[0]) || d.lib[0] !== top || !d.hand[1].includes(known)) return `deal ${i}`;
    if (d.hand[1].length !== s.hand[1].length || d.lib.length !== s.lib.length) return "the sizes changed";
    const all = [...d.hand[0], ...d.hand[1], ...d.lib].sort((a, b) => a - b), was = [...s.hand[0], ...s.hand[1], ...s.lib].sort((a, b) => a - b);
    if (all.join() !== was.join()) return "cards made or lost";
  }
  return true;
});

// ---------- what their play has shown ----------
/** In how many of 200 deals for seat 0 the other hand holds a card that passes `is`. */
const dealtWith = (t, is) => { let n = 0; for (let i = 0; i < 200; i++) if (determinize(t, 0, seeded(i)).hand[1].some(is)) n++; return n; };
const named = (...ns) => id => ns.includes(DECK[id]);
test("a player who let our Dandân resolve with a Lapse's mana open is mostly dealt no Memory Lapse, until they draw", () => {
  const s = keepOpen(), before = dealtWith(s, named("Memory Lapse"));
  const t = J(s);
  t.tells[1].lapse = t.draws[1];
  const after = dealtWith(t, named("Memory Lapse"));
  t.draws[1] += 2;
  const drawn = dealtWith(t, named("Memory Lapse"));
  return before > 60 && after < before / 3 && drawn > after * 1.5 || `${before}, then ${after}, then ${drawn} of 200 deals`;
});
test("a player who just ended a turn with no land played is mostly dealt no land", () => {
  const s = keepOpen(), before = dealtWith(s, isLandId), t = J(s);
  t.tells[1].land = t.draws[1];
  const after = dealtWith(t, isLandId);
  return before > 150 && after < before * 0.45 || `${before} then ${after} of 200 deals`;
});
test("a player who let our Dandân hit them with one blue open is mostly dealt no Piracy Charm or Mind Bend, though a Repulse still", () => {
  const s = keepOpen(), t = J(s);
  t.tells[1].kill = t.draws[1];
  t.tells[1].mana = 1;
  const one = named("Piracy Charm", "Mind Bend"), rep = named("Repulse");
  const [b1, a1, b2, a2] = [dealtWith(s, one), dealtWith(t, one), dealtWith(s, rep), dealtWith(t, rep)];
  return a1 < b1 / 2 && a2 > b2 * 0.7 || `charm and bend ${b1} then ${a1}; repulse ${b2} then ${a2}`;
});
test("early on, the other hand fits the seven they kept: with no land played, two or more lands in it", () => {
  const s = keepOpen(), t = J(s);
  Object.assign(t.tells[1], { keep: t.draws[1], lands: 0 });
  t.turn = 1;
  const short = (x) => { let n = 0; for (let i = 0; i < 200; i++) if (determinize(x, 0, seeded(i)).hand[1].filter(isLandId).length < 2) n++; return n; };
  const [before, after] = [short(s), short(t)];
  return after < before / 3 || `${before} then ${after} of 200 deals short of lands`;
});
test("Medium's odds read the same: a Lapse after the pass, and an answer after the unanswered attack, come back with the draws", () => {
  const s = keepOpen(), t = J(s);
  Object.assign(t.tells[1], { lapse: t.draws[1], kill: t.draws[1], mana: 1 });
  const [p0, p1] = [holds(facts(s, 0), "Memory Lapse"), holds(facts(t, 0), "Memory Lapse")];
  const [c0, c1] = [holds(facts(s, 0), "Piracy Charm"), holds(facts(t, 0), "Piracy Charm")];
  t.draws[1] += 3;
  const p2 = holds(facts(t, 0), "Memory Lapse");
  return p1 < p0 / 3 && c1 < c0 / 2 && p2 > p1 * 2 && p2 < p0 || [p0, p1, p2, c0, c1].map(x => x.toFixed(3)).join(" ");
});
test("a hand's chance under the reads: what a read rules out is only likely among the cards drawn since", () => {
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  return close(allAmong(0, 5, 0), 1) && close(allAmong(1, 5, 0), 0) && close(allAmong(1, 5, 2), 2 / 5) && close(allAmong(2, 5, 2), 1 / 10) && close(allAmong(2, 5, 9), 1);
});

// ---------- the judge ----------
test("the judge: the two seats' chances add up to one, a Dandân on the table counts, a finished game is certain", () => {
  let worst = 0;
  for (const seed of [1, 2]) {
    let s = restore(J(deal({ rng: seeded(seed) })));
    const rng = seeded(seed);
    for (let i = 0; i < 300 && !s.over; i++) {
      const x = features(s, 0);
      if (x.length !== FEATURES.length || ![...x].every(Number.isFinite)) return `move ${i}: the features`;
      worst = Math.max(worst, Math.abs(winChance(s, 0) + winChance(s, 1) - 1));
      s = go(s, toMove(s), botMove(s, toMove(s), { rng, level: "medium" }));
    }
  }
  const base = { turn: 8, hand: [["Island", "Brainstorm", "Memory Lapse"], ["Island", "Predict", "Memory Lapse"]], bf: [...islandsOf(0, 4), ...islandsOf(1, 4)] };
  const even = winChance(scene(base), 0), ours = winChance(scene({ ...base, bf: [...base.bf, [0, "Dandân"]] }), 0), theirs = winChance(scene({ ...base, bf: [...base.bf, [1, "Dandân"]] }), 0);
  const won = scene(base); Object.assign(won, { over: true, winner: 0 });
  return worst < 1e-6 && ours > even + 0.1 && theirs < even - 0.1 && winChance(won, 0) === 1 && winChance(won, 1) === 0 || `${worst} ${even} ${ours} ${theirs}`;
});

// ---------- the verdict ----------
test("the coach's own move, and one as good, get no word; a clearly worse one gets how much and why", () => {
  const s = theirDandan(), seat = 0;
  const r = think(s, seat, { ...BUDGET, must: { t: "pass" } });
  const lapse = r.list.find(c => c.move.t === "cast");
  const v = verdict(r, { t: "pass" }, s, seat);
  return sameMove(r.best, lapse.move) && verdict(r, r.best, s, seat) === null && v && v.gap > MARGIN && /points worse/.test(v.words) && /you draw it/.test(v.words) || JSON.stringify(v);
});
test("a gap within the margin isn't called a mistake", () => {
  const r = { only: false, deals: 32, best: { t: "pass" }, list: [{ move: { t: "pass" }, mean: 0.5, se: 0.004, n: 32 }, { move: { t: "land", card: 30 }, mean: 0.5 - MARGIN / 2, se: 0.004, n: 32 }] };
  return verdict(r, { t: "land", card: 30 }, lone(), 0) === null;
});

// ---------- the reasons ----------
test("its reasons on positions with one right answer", () => {
  const out = [];
  const s1 = lone();
  const bend = { t: "cast", card: idIn(s1, 0, "Mind Bend"), from: "hand", targets: [T.c(onBf(s1, 1, "Island"))] };
  out.push([reasons(s1, 0, { t: "land", card: idIn(s1, 0, "Island") }, bend, { againstFirst: true })[0], /still makes mana/]);
  const s2 = theirDandan();
  out.push([reasons(s2, 0, { t: "cast", card: idIn(s2, 0, "Memory Lapse"), from: "hand", targets: [T.s(sidOf(s2, "Dandân"))] }, { t: "pass" })[0], /you draw it/]);
  const s3 = keepOpen();
  out.push([reasons(s3, 0, { t: "pass" }, { t: "cast", card: idIn(s3, 0, "Take Inventory"), from: "hand", targets: [] })[0], /Memory Lapse/]);
  const a0 = scene({ active: 1, hand: [["Piracy Charm"], []], bf: [...islandsOf(0, 2), ...islandsOf(1, 2), [1, "Dandân"]] });
  const att = answer(pass(a0, 1), { t: "attack", ids: [onBf(a0, 1, "Dandân")] });
  out.push([reasons(att, 0, { t: "cast", card: idIn(att, 0, "Piracy Charm"), from: "hand", mode: 1, targets: [T.c(onBf(att, 1, "Dandân"))] }, { t: "pass" })[0], /attacking you/]);
  const bad = out.filter(([w, re]) => !re.test(w || ""));
  return !bad.length || bad.map(([w]) => w).join(" | ");
});
test("the advice line: the move, why, and its chance of winning", () => {
  const s = theirDandan(), r = think(s, 0, BUDGET), line = adviceLine(r, s, 0);
  return /^Cast Memory Lapse on their Dandân · .* · \d+% to win$/.test(line) || line;
});
test("what the deals showed: where each move left the game, and the biggest difference in the better one's favour in words", () => {
  const s = theirDandan(), r = think(s, 0, { ...BUDGET, must: { t: "pass" } });
  const lapse = r.list.find(c => c.move.t === "cast"), pass_ = r.list.find(c => c.move.t === "pass");
  const keys = Object.keys(lapse.seen).sort().join();
  // countered, their Dandân is gone two turns on far more often than let through
  const said = evidence(lapse, pass_, s, 0).join(" ");
  const made = { seen: { d: 0.5, D: 0.2, l: 20, L: 20, h: 4, H: 4 }, move: { t: "pass" } }, other = { seen: { d: 0.5, D: 0.2, l: 12, L: 20, h: 4, H: 4 }, move: { t: "land", card: idIn(lone(), 0, "Island") } };
  const life = evidence(made, other, lone(), 0).join(" "), none = evidence(made, made, lone(), 0), yours = evidence(made, other, lone(), 0, { yours: true }).join(" ");
  return keys === "D,H,L,a,an,d,h,l" && /they have a Dandân on the table in .* after letting it resolve; after casting Memory Lapse on their Dandân, in/.test(said)
    && /you're at 12 life on average after playing Island; after passing, at 20/.test(life) && /after yours; after passing/.test(yours) && !none.length || `${keys} | ${said} | ${life}`;
});
test("the shared graveyard: a Mystic Retrieval cast from the hand while they have red and a Piracy Charm lies there is called out, and why", () => {
  const s = scene({ turn: 9, active: 0, step: "main1", hand: [["Mystic Retrieval", "Island", "Brainstorm"], ["Island", "Predict"]],
    bf: [...islandsOf(0, 4), [0, "Dandân"], [1, "Thundering Falls"], ...islandsOf(1, 3)], yard: ["Piracy Charm", "Memory Lapse", "Chart a Course"] });
  const lapse = s.yard.find(id => DECK[id] === "Memory Lapse");
  const mine = { t: "cast", card: idIn(s, 0, "Mystic Retrieval"), from: "hand", targets: [T.g(lapse)] };
  // (the other player's answers tried, as the page asks)
  const v = verdict(think(s, 0, { ...BUDGET, reply: 4, must: mine }), mine, s, 0);
  return !!v && /flashes it back for the Piracy Charm, and your Dandân dies/.test(v.words) && /Their best answer to yours, in \d+ of the \d+ deals: they cast Mystic Retrieval for Piracy Charm with flashback/.test(v.words)
    && /you have a Dandân on the table in .* after yours/.test(v.words) || v?.words || "no word";
});
test("a move the coach's weighing never saw (a refused one) has no verdict rather than a wrong one", () => {
  const s = lone(), r = think(s, 0, BUDGET);
  return verdict(r, { t: "cast", card: 999, from: "hand", targets: [] }, s, 0) === null && moveName({ t: "pass" }, s, 0) === "pass";
});

console.log(bad ? `dandan coach: ${bad} failed` : "dandan coach: every check passed");
process.exit(bad ? 1 : 0);
