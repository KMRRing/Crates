// Shoe (shoe-core.js): a deck with no rules. The cards are conserved through every move, an emptied pile or hand vanishes
// (the database keeps no empty lists), and the whole thing plays through a table on the database in memory: one device
// the table, two hands, moves racing, the state read back as the database returns it.
import { createTable } from "../table.js";
import { fakeDb } from "./fake-db.js";
import { roundTrip } from "./rtdb.js";
import * as S from "../shoe-core.js";

let bad = 0;
const ok = (yes, what) => { console.log(`${yes ? "ok  " : "FAIL"} ${what}`); if (!yes) bad++; };
const seeded = (s = 7) => () => (s = (s * 16807) % 2147483647) / 2147483647;
const every = G => [...Object.values(G.piles || {}).flat().map(S.idOf), ...Object.values(G.hands || {}).flat()].sort((a, b) => a - b);
const A = { uid: "a", name: "Ana" }, B = { uid: "b", name: "Bo" };

// ---------- the shoe ----------
{
  const G = S.fresh({ decks: 1 }, null, seeded());
  ok(S.pile(G, "stock").length === 52 && S.pile(G, "stock").every(S.downC), "a deck is 52 cards, face down");
  ok(new Set(S.pile(G, "stock").map(S.idOf)).size === 52, "every card once");
  ok(S.nameOf(0) === "A♦" && S.nameOf(25) === "K♣" && S.nameOf(39) === "A♠", "ids name their cards");
  ok(S.fresh({ decks: 2, jokers: true }, null, seeded()).piles.stock.length === 108, "two decks with jokers are 108");
  ok(S.fresh({ decks: 9 }).decks === 4, "at most four decks");
  ok(S.faceOf(53).joker === "big" && S.faceOf(54 + 52).joker === "small", "jokers, in any deck");
}

// ---------- moves ----------
{
  const G = S.fresh({ decks: 1, jokers: true }, null, seeded()), all = every(G);
  ok(S.deal(G, 5, ["a", "b"]) && S.hand(G, "a").length === 5 && S.hand(G, "b").length === 5 && S.pile(G, "stock").length === 44, "deal 5 to each");
  ok(JSON.stringify(every(G)) === JSON.stringify(all), "dealing loses and makes no card");
  S.draw(G, A, "stock", 2);
  ok(S.hand(G, "a").length === 7, "draw two");
  const h = S.hand(G, "a");
  ok(S.play(G, A, [h[0], h[1]], { to: "discard", up: false }) && S.pile(G, "discard").every(c => !S.downC(c)), "the discard is always face up");
  ok(S.play(G, A, [h[2]], { to: "new", up: false }) && S.pile(G, "p1").length === 1 && S.downC(S.pile(G, "p1")[0]), "a card played face down starts a pile");
  ok(!S.play(G, A, [h[2]], { to: "new" }) && !S.play(G, A, [S.hand(G, "b")[0]], { to: "new" }), "only cards in your own hand can be played");
  ok(S.play(G, A, [h[3]], { to: "p1", up: true }) && S.pile(G, "p1").length === 2 && !S.downC(S.pile(G, "p1")[1]), "onto a pile, face up");
  ok(!S.play(G, A, [S.hand(G, "a")[0]], { to: "p9" }), "not onto a pile that isn't there");
  S.flipPile(G, "p1");
  ok(S.pile(G, "p1")[0] === S.signed(h[3], false) && S.pile(G, "p1")[1] === h[2], "flipping a pile reverses it and turns every card");
  S.flipCard(G, "p1");
  ok(!S.downC(S.pile(G, "p1")[1]) === false, "a card can be turned where it lies");
  ok(S.toggleSpread(G, "p1") && G.spread.p1 === 1 && S.toggleSpread(G, "p1") && !G.spread.p1, "spread and close");
  S.take(G, B, "discard");
  ok(!G.piles.discard && S.hand(G, "b").length === 7, "taking a pile empties it away");
  const n = S.pile(G, "p1").length;
  S.take(G, B, "p1", 0);
  ok(S.pile(G, "p1").length === n - 1 && S.hand(G, "b").length === 8, "taking one card from a spread");
  const give = S.hand(G, "b").slice(0, 2);
  ok(S.pass(G, B, "a", give) === 2 && S.hand(G, "a").slice(-2).join() === give.join() && S.hand(G, "b").length === 6, "passing cards to a player");
  ok(!S.pass(G, B, "b", [S.hand(G, "b")[0]]) && !S.pass(G, B, "a", [9999]), "not to yourself, not cards you lack");
  ok(S.reveal(G, A, true) && G.open.a === 1 && S.reveal(G, A, false) && !G.open, "show the hand, hide it again");
  ok(JSON.stringify(every(G)) === JSON.stringify(all), "after all that, the same 54 cards");
  const stock = S.pile(G, "stock").length;
  S.move(G, "stock", 3, "new", true);
  ok(S.pile(G, "p2").length === 3 && S.pile(G, "p2").every(c => !S.downC(c)) && S.pile(G, "stock").length === stock - 3, "lay the top cards of the draw pile out face up");
  ok(S.merge(G, "p2", "p1") && !G.piles.p2, "a pile put on another");
  const before = S.pile(G, "stock").join();
  S.shuffle(G, "stock", seeded(3));
  ok(S.pile(G, "stock").join() !== before && S.pile(G, "stock").length === before.split(",").length, "shuffle");
  S.collect(G, seeded(5));
  ok(S.pile(G, "stock").length === 54 && !G.hands && Object.keys(G.piles).join() === "stock" && !G.open, "collect puts every card back, shuffled");
}

// ---------- running out, and the table ----------
{
  const G = S.fresh({ decks: 1 }, null, seeded());
  ok(S.deal(G, 20, ["a", "b", "c"]) && !G.piles?.stock, "a pile that runs out mid-deal stops, and is gone");
  ok(S.hand(G, "a").length + S.hand(G, "b").length + S.hand(G, "c").length === 52, "all 52 dealt out");
  ok(!S.draw(G, A, "stock"), "nothing to draw from an empty pile");
  S.setTable(G, "a", true);
  ok(G.tv.a === 1 && !S.hand(G, "a").length && S.pile(G, "stock").length === 18, "a device becoming the table gives its cards back to the draw pile");
  ok(S.playersOf(G, [{ uid: "a" }, { uid: "b" }]).map(p => p.uid).join() === "b", "the table isn't a player");
  ok(S.fresh({ decks: 1 }, G.tv).tv.a === 1, "a new shoe keeps who is the table");
  const mine = S.hand(G, "b").length;
  S.sortHand(G, "b", "suit");
  const order = [3, 2, 1, 0], f = S.hand(G, "b").map(S.faceOf);
  ok(S.hand(G, "b").length === mine && f.every((c, i) => !i || order.indexOf(c.suit) >= order.indexOf(f[i - 1].suit)), "sorted by suit, spades first");
  S.sortHand(G, "b", "rank");
  const r = S.hand(G, "b").map(id => (S.faceOf(id).rank === "A" ? 13 : S.RANKS.indexOf(S.faceOf(id).rank)));
  ok(r.every((x, i) => !i || x >= r[i - 1]), "sorted by rank, ace high");
  const first = S.hand(G, "b")[0];
  S.shift(G, "b", [first], 1);
  ok(S.hand(G, "b")[1] === first, "a card moved one place right");
  S.shift(G, "b", [first], -2);
  ok(S.hand(G, "b")[0] === first, "and sent to the start");
}

// ---------- on the database ----------
{
  const G = S.fresh({ decks: 2, jokers: true }, null, seeded()), want = every(G);
  S.deal(G, 7, ["a", "b", "c"]); S.play(G, A, [S.hand(G, "a")[0]], { to: "new", up: false }); S.toggleSpread(G, "p1"); S.reveal(G, B, true);
  const back = roundTrip({ game: G }).game;
  ok(JSON.stringify(every(back)) === JSON.stringify(want), "the state read back from the database holds every card");
  ok(S.hand(back, "a").length === 6 && S.pile(back, "p1").length === 1 && back.open.b === 1, "hands, piles and revealed hands survive it");
  const empty = S.fresh({ decks: 1 }, null, seeded());
  S.deal(empty, 52, ["a"]);
  const e = roundTrip({ game: empty }).game;
  ok(S.pile(e, "stock").length === 0 && S.hand(e, "a").length === 52, "a draw pile dealt out entirely is simply absent");
}

// ---------- a table: one device the table, two hands ----------
{
  const db = fakeDb();
  const mk = uid => createTable({ game: "shoe", app: 1, max: 8, sync: db.device(uid), backupMs: 60, onState: () => {} });
  const tv = mk("tv"), ana = mk("an"), bo = mk("bo");
  const code = await tv.open({ name: "Table", pid: "pt" });
  await ana.join(code, { name: "Ana", pid: "pa" });
  await bo.join(code, { name: "Bo", pid: "pb" });
  await db.settle();
  ok(await tv.act(b => { b.game = S.fresh({ decks: 1 }, null, seeded()); S.setTable(b.game, "tv", true); }), "the host's phone sets the table out");
  await db.settle();
  ok(S.playersOf(ana.data.game, ana.players).map(p => p.name).join() === "Ana,Bo", "the table phone isn't dealt to");
  await tv.act(b => { S.deal(b.game, 5, S.playersOf(b.game, tv.players).map(p => p.uid)); });
  await db.settle();
  ok(S.hand(ana.data.game, ana.uid).length === 5 && S.hand(bo.data.game, bo.uid).length === 5, "five each");
  // both play at once; the loser's transaction is retried on the new state, so neither is lost
  const a1 = S.hand(ana.data.game, ana.uid)[0], b1 = S.hand(bo.data.game, bo.uid)[0];
  const [r1, r2] = await Promise.all([ana.act(b => S.play(b.game, { uid: ana.uid, name: "Ana" }, [a1], { to: "discard" })), bo.act(b => S.play(b.game, { uid: bo.uid, name: "Bo" }, [b1], { to: "discard" }))]);
  await db.settle();
  ok(r1 && r2 && S.pile(tv.data.game, "discard").length === 2, "two plays at once both land");
  ok(JSON.stringify(every(tv.data.game)) === JSON.stringify(every(S.fresh({ decks: 1 }))), "the table still holds all 52");
  ok(tv.data.game.log.some(t => /^Ana plays/.test(t)) && tv.data.game.log.length <= 8, "the table's log names who played what");
  // Ana's other device takes her seat, and her hand with it
  const ana2 = createTable({ game: "shoe", app: 1, max: 8, sync: db.device("an2"), onState: () => {} });
  await ana2.join(code, { name: "Ana", pid: "pa" });
  await db.settle();
  ok(S.hand(ana2.data.game, "an2").length === 4 && !S.hand(ana2.data.game, "an").length, "a player's other device takes the hand with the seat");
  await tv.act(b => S.collect(b.game, seeded(2)));
  await db.settle();
  ok(S.pile(bo.data.game, "stock").length === 52 && !bo.data.game.hands, "collect and reshuffle, seen by every phone");
}

console.log(bad ? `shoe: ${bad} failed` : "shoe: every check passed");
process.exit(bad ? 1 : 0);
