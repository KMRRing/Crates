// Cartel: computer players play whole games against each other. Every game must finish, nobody's move may be
// refused by the referee, and the rational player should win more than its share. Run: node tests/cartel.mjs [games]
const E = await import("../cartel-engine.js");
const A = await import("../cartel-ai.js");
const ids = Object.keys(A.PERSONAS), games = Number(process.argv[2] || 30);
let finished = 0, refused = 0, turns = 0;
const wins = {}, seats = {};
for (let g = 0; g < games; g++) {
  // four of the five, in a shuffled order: who sits after whom matters (the next player answers untargeted claims)
  const order = [...ids].map((id, k) => ({ id, key: Math.sin(g * 97.13 + k * 13.7) })).sort((a, b) => a.key - b.key).map(x => x.id);
  const personas = order.slice(0, 4);
  const s = E.newGame(5000 + g, personas.map(p => ({ name: A.PERSONAS[p].name, persona: p })));
  const ais = personas.map((p, i) => new A.Player(i, 4, p, 900 + g * 4 + i));
  let freeAsked = -1, askedAt = -1;
  for (let guard = 0; !s.over && guard < 4000; guard++) {
    for (const ai of ais) ai.sync(s, E.seen);
    try {
      if (s.pending?.type === "block") E.respondBlock(s, ais[s.pending.challenger].challengeBlock(s));
      else if (s.pending) E.respond(s, ais[s.pending.challenger].challenge(s));
      else if (s.step === "act" && !s.freeUsed && freeAsked !== s.moves) {
        freeAsked = s.moves;
        const d = ais[s.turn].free(s);
        if (d != null) E.freeReroll(s, d);
      }
      else if (s.step === "act" && !s.askUsed && askedAt !== s.moves) {
        askedAt = s.moves;
        const q = ais[s.turn].ask(s);
        if (q) E.freeAsk(s, q.target, q.question);
      }
      else if (s.step === "act") E.act(s, ais[s.turn].action(s));
      else E.bid(s, ais[s.turn].bid(s));
    } catch (e) { refused++; console.log(`game ${g}: refused (${e.message})`); break; }
  }
  if (!s.over) continue;
  finished++;
  turns += s.moves;
  wins[personas[s.over.winner]] = (wins[personas[s.over.winner]] || 0) + 1;
  personas.forEach(p => { seats[p] = (seats[p] || 0) + 1; });
}
const rate = id => (wins[id] || 0) / seats[id];
console.log(`${finished}/${games} games finished, ${refused} refused moves, ${(turns / finished).toFixed(1)} turns a game`);
console.log("win rates:", ids.map(id => `${id} ${Math.round(100 * rate(id))}%`).join(", "));
const bad = finished !== games || refused > 0 || rate("quant") < 0.2;
console.log(bad ? "problems" : "all games check out");
if (bad) process.exitCode = 1;

// the rules, one by one, on games set up by hand
{
  const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) process.exitCode = 1; };
  const setup = (faces0, faces1) => {
    const s = E.newGame(1, [{ name: "A", persona: "quant" }, { name: "B", persona: "quant" }, { name: "C", persona: "quant" }]);
    const [a, b] = s.players;
    a.dice.forEach((d, k) => { d.face = faces0[k] ?? 2; d.open = false; });
    b.dice.forEach((d, k) => { d.face = faces1[k] ?? 2; d.open = false; });
    s.turn = 0; s.step = "act"; s.bid = null; s.pending = null; s.freeUsed = false;
    return s;
  };
  const plainOf = p => E.plain(p).length;
  // a steal blocked honestly (B's gold shows Trader), challenged by the thief: the thief pays 3, nothing is stolen
  let s = setup([3, 1], [3, 1]);
  E.act(s, { type: "claim", ability: "steal", target: 1 });
  E.respond(s, { block: 3 });
  E.respondBlock(s, true);
  check(plainOf(s.players[0]) === 0 && plainOf(s.players[1]) === 6 && E.gold(s.players[0]).length === 2, "a true block, challenged: the thief pays the blocker 3 and steals nothing");
  // a bluffed block, challenged: the blocker pays 2, then the steal goes ahead
  s = setup([3, 1], [2, 1]);
  E.act(s, { type: "claim", ability: "steal", target: 1 });
  E.respond(s, { block: 3 });
  E.respondBlock(s, true);
  check(plainOf(s.players[1]) === 0 && plainOf(s.players[0]) === 6 && E.gold(s.players[1]).length === 2, "a bluffed block, challenged: the blocker pays 3, and the steal finds nothing left");
  // a block accepted: nothing changes hands
  s = setup([3, 1], [2, 1]);
  E.act(s, { type: "claim", ability: "steal", target: 1 });
  E.respond(s, { block: 3 });
  E.respondBlock(s, false);
  check(plainOf(s.players[0]) === 3 && plainOf(s.players[1]) === 3 && s.step === "bid", "an accepted block: nothing moves, and the thief goes on to bid");
  // using a role doesn't reroll the gold die any more
  s = setup([2, 6], [2, 1]);
  const goldBefore = E.gold(s.players[0]).map(d => d.face).join();
  E.act(s, { type: "claim", ability: "bank" });
  E.respond(s, "allow");
  check(E.gold(s.players[0]).map(d => d.face).join() === goldBefore && plainOf(s.players[0]) === 6, "Banker takes 3 and the gold dice stay as they were");
  // a sanction: 4 dice paid up front, and the target loses a gold die
  s = setup([6, 1, 2, 2, 2], [2, 2]);
  E.plain(s.players[0]).length;                                   // A has 3 plain: give A a fourth
  E.act(s, { type: "take" }); s.turn = 0; s.step = "act";
  E.act(s, { type: "claim", ability: "sanction", target: 1 });
  check(plainOf(s.players[0]) === 0, "a sanction is paid for up front: 4 dice to the bank");
  E.respond(s, "allow");
  check(E.gold(s.players[1]).length === 1, "an unblocked sanction takes a gold die");
  // blocked by a true Legal: the dice are spent, no gold is lost
  s = setup([6, 1], [5, 2]);
  E.act(s, { type: "take" }); s.turn = 0; s.step = "act";
  E.act(s, { type: "claim", ability: "sanction", target: 1 });
  E.respond(s, { block: 5 });
  E.respondBlock(s, false);
  check(E.gold(s.players[1]).length === 2 && plainOf(s.players[0]) === 0, "a sanction blocked by Legal: the 4 dice are gone and nobody loses gold");
  // a bluffed sanction, challenged: no gold lost, and the bluffer pays 2 on top of the 4
  s = setup([2, 1], [2, 2]);
  for (let k = 0; k < 3; k++) { E.act(s, { type: "take" }); s.turn = 0; s.step = "act"; }   // 6 plain: 4 for the sanction
  E.act(s, { type: "claim", ability: "sanction", target: 1 });
  E.respond(s, "challenge");
  check(E.gold(s.players[1]).length === 2 && plainOf(s.players[0]) === 0 && E.gold(s.players[0]).length === 1, "a bluffed sanction caught: the target keeps its gold; the bluffer, 2 dice short of the 3, pays them and loses a gold die");
  let blockedWrong = false;
  s = setup([6, 1], [3, 2]);
  E.act(s, { type: "take" }); s.turn = 0; s.step = "act";
  E.act(s, { type: "claim", ability: "sanction", target: 1 });
  try { E.respond(s, { block: 3 }); } catch { blockedWrong = true; }
  check(blockedWrong, "only Legal blocks a sanction");
  // only Trader blocks a steal (Auditor and Legal don't)
  for (const role of [4, 5]) {
    s = setup([3, 1], [role, 1]);
    E.act(s, { type: "claim", ability: "steal", target: 1 });
    let refusedBlock = false;
    try { E.respond(s, { block: role }); } catch { refusedBlock = true; }
    check(refusedBlock, `${role === 4 ? "Auditor" : "Legal"} doesn't block a steal`);
  }
  // the free question: answered both ways, once a turn, and the turn's action is still to come
  s = setup([2, 2, 4, 4, 4], [2, 2, 4, 3, 3]);
  E.freeAsk(s, 1, { type: "count", f: 4 });
  const asked = s.events[s.events.length - 1];
  check(asked.priv[0].answer === 1 && asked.priv[1].answer === 3 && s.step === "act", "a free question: each side learns the other's answer, and the action is still to come");
  let twice = false;
  try { E.freeAsk(s, 1, { type: "odd" }); } catch { twice = true; }
  check(twice, "one free question a turn");
  // Legal's reroll is a free move: the turn stays where it was
  s = setup([5, 1], [2, 1]);
  E.act(s, { type: "take" });
  const seenDie = E.plain(s.players[0]).find(d => d.open);
  E.freeReroll(s, seenDie.id);
  E.respond(s, "allow");
  check(s.step === "bid" && s.turn === 0 && !E.plain(s.players[0]).find(d => d.id === seenDie.id).open, "Legal rerolls a face-up die and the turn carries on to the bid");
  let refused = false;
  try { E.freeReroll(s, seenDie.id); } catch { refused = true; }
  check(refused, "the free reroll only once a turn");
  // a lost call costs 3; short of 3, a gold die goes too
  s = setup([2, 2], [2, 2]);
  s.step = "bid";
  E.bid(s, { q: 30, f: 6 });           // A bids something impossible
  s.step = "bid";
  E.bid(s, { call: true });            // B calls
  check(plainOf(s.players[0]) === 0 && plainOf(s.players[1]) === 6, "a lost call: the bidder pays the caller 3 dice");
  s.turn = 0; s.step = "bid"; s.bid = null;
  E.bid(s, { q: 30, f: 6 });
  s.turn = 1; s.step = "bid";
  E.bid(s, { call: true });
  check(E.gold(s.players[0]).length === 1, "short of 3 dice to pay, a gold die goes too");
}
