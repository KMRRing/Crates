// Factor's flying cards (factor-flights.js): every kind of card move, worked out from the game before and after it and nothing
// else: a roll's payout from the bank, a bank trade, a trade between players, a theft (face down to everyone but its two),
// a discard on a 7 (face down but to the one who gave it up), a development card bought (face down but to its buyer), played
// (a Privateer to its player's fleet), the Windfall and the Corner, a build. Which moves are shown at all: not a first view,
// not another game, not the same move twice.
import { rules, fresh, COSTS } from "../factor-rules.js";
import { flightsBetween, markOf, worth, MOST_FLIGHTS } from "../factor-flights.js";
import { seeded, newRecord, applyMove, botMove } from "../seats.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const table = () => { const s = fresh({ seats: 4, options: {}, rng: seeded(3) }); s.step = "main"; s.turn = 0; s.turnNo = 5; s.rolled = true; return s; };
const move = (s, seat, m, rng = seeded(1)) => { const r = rules.act(clone(s), seat, m, { rng, now: 0 }); if (typeof r === "string") throw new Error(`${JSON.stringify(m)}: ${r}`); return r; };
const hold = (s, seat, hand) => { s.hand[seat] = [...hand]; return s; };
const flat = list => list.map(f => `${f.what}${f.kind}:${f.from.at}${f.from.seat ?? ""}>${f.to.at}${f.to.seat ?? ""}${f.up ? "" : "~"}`).join(" ");

// ---------- the resources ----------
{
  const s = table();
  check(flightsBetween(s, clone(s), 0).length === 0, "nothing moved, nothing flies");
  check(flightsBetween(null, s, 0).length === 0 && flightsBetween(s, null, 0).length === 0, "no game before or after: nothing");

  // a roll pays from the bank, face up to everyone
  const roll = clone(s); roll.step = "roll";
  const after = clone(roll); after.step = "main"; after.hand[1][3] = 2; after.hand[2][0] = 1;
  const f = flightsBetween(roll, after, 0);
  check(f.length === 3 && f.every(x => x.from.at === "bank" && x.to.at === "seat" && x.up), "a roll's payout: each card from the bank to the seat paid, face up");
  check(f.filter(x => x.to.seat === 1 && x.kind === 3).length === 2 && f.some(x => x.to.seat === 2 && x.kind === 0), "…the kind and the seat of each card are the ones paid");
  check(flat(flightsBetween(roll, after, 2)) === flat(f) && flat(flightsBetween(roll, after, null)) === flat(f), "a payout looks the same from every seat, and to a watcher");

  // the bank: four timber for a grain
  hold(s, 0, [4, 0, 0, 0, 0]);
  const bank = move(s, 0, { t: "bank", give: 0, get: 3 });
  const g = flightsBetween(s, bank, 0);
  check(g.length === 5 && g.filter(x => x.to.at === "bank" && x.kind === 0 && x.from.seat === 0).length === 4 && g.filter(x => x.from.at === "bank" && x.kind === 3 && x.to.seat === 0).length === 1, "a bank trade: four timber to the bank, one grain from it");
  check(g.every(x => x.up), "…all of it public");

  // a trade between players: cards cross, kind by kind
  const t = table(); hold(t, 0, [1, 0, 0, 0, 0]); hold(t, 1, [0, 1, 0, 0, 0]);
  t.step = "offer"; t.offer = { from: 0, give: [1, 0, 0, 0, 0], get: [0, 1, 0, 0, 0], resp: [2, 1, 0, 0] };
  const t2 = clone(t); t2.step = "main"; t2.hand[0] = [0, 1, 0, 0, 0]; t2.hand[1] = [1, 0, 0, 0, 0];
  const tf = flightsBetween(t, t2, 3);
  check(tf.length === 2 && tf.some(x => x.kind === 0 && x.from.seat === 0 && x.to.seat === 1) && tf.some(x => x.kind === 1 && x.from.seat === 1 && x.to.seat === 0), "a trade: the timber goes from the one to the other and the clay back");
  check(tf.every(x => x.up && x.from.at === "seat" && x.to.at === "seat"), "…face up to a third player: a trade is public");

  // a build pays the bank
  const b = table(); hold(b, 0, [1, 1, 0, 0, 0]);
  const built = clone(b); built.hand[0] = [0, 0, 0, 0, 0];
  const bf = flightsBetween(b, built, 0);
  check(bf.length === 2 && bf.every(x => x.to.at === "bank" && x.from.seat === 0), "what a road costs goes to the bank");
}

// ---------- hidden moves ----------
{
  // a theft: face down to a seat that is neither
  const s = table(); s.step = "blockade";
  hold(s, 0, [0, 0, 0, 0, 0]); hold(s, 2, [0, 0, 0, 0, 1]);
  const after = clone(s); after.step = "main"; after.hand[2] = [0, 0, 0, 0, 0]; after.hand[0] = [0, 0, 0, 0, 1];
  const one = [0, 1, 2, 3].map(v => flightsBetween(s, after, v)[0]);
  check(one.every(x => x.from.seat === 2 && x.to.seat === 0 && x.kind === 4), "a theft goes from the victim to the thief");
  check(one[0].up && one[2].up && !one[1].up && !one[3].up, "…face up to the two involved, face down to the other two");
  check(!flightsBetween(s, after, null)[0].up, "…and face down to a watcher");

  // a discard on a 7: to the bank, seen only by the one who gave it up
  const d = table(); d.step = "discard"; d.owe = [0, 2, 0, 0]; hold(d, 1, [3, 3, 2, 0, 0]);
  const da = clone(d); da.hand[1] = [2, 2, 2, 0, 0]; da.owe = [0, 0, 0, 0];
  const df = [0, 1, 2].map(v => flightsBetween(d, da, v));
  check(df[0].length === 2 && df[0].every(x => x.from.seat === 1 && x.to.at === "bank"), "a discard: the cards go to the bank");
  check(df[0].every(x => !x.up) && df[1].every(x => x.up), "…face down but to the one who gave them up");

  // a development card bought: face down to all but its buyer; the cost goes to the bank
  const p = table(); hold(p, 0, [0, 0, 1, 1, 1]); p.deck = ["corner", "privateer"];
  const bought = move(p, 0, { t: "buy" });
  const bf = [0, 1].map(v => flightsBetween(p, bought, v));
  const dev = v => bf[v].filter(x => x.what === "dev");
  check(dev(0).length === 1 && dev(0)[0].from.at === "devs" && dev(0)[0].to.seat === 0 && dev(0)[0].kind === "privateer", "a development card bought comes from the deck to its buyer, and is the card the engine drew");
  check(dev(0)[0].up && !dev(1)[0].up, "…face up to its buyer, face down to the others");
  check(bf[0].filter(x => x.what === "res").length === 3 && bf[0].filter(x => x.what === "res").every(x => x.to.at === "bank"), "…and the three cards it costs go to the bank");
  check(COSTS.dev.reduce((a, b2) => a + b2, 0) === 3, "(a card costs three)");
}

// ---------- cards played ----------
{
  const s = table(); s.devs[0] = ["privateer", "patent"];
  const pv = move(s, 0, { t: "play", card: "privateer" });
  const f = flightsBetween(s, pv, 1);
  check(f.length === 1 && f[0].what === "dev" && f[0].kind === "privateer" && f[0].from.seat === 0 && f[0].to.at === "fleet" && f[0].to.seat === 0 && f[0].up, "a Privateer played flies, face up, from its player to its fleet");
  const w = table(); w.devs[0] = ["windfall"];
  const wf = move(w, 0, { t: "play", card: "windfall", res: [4, 4] });
  const wl = flightsBetween(w, wf, 2);
  check(wl.filter(x => x.what === "res").length === 2 && wl.filter(x => x.what === "res").every(x => x.from.at === "bank" && x.to.seat === 0 && x.kind === 4 && x.up), "a Windfall: two iron from the bank, face up");
  check(wl.some(x => x.what === "dev" && x.kind === "windfall" && x.to.at === "table"), "…and the card itself laid on the table");
  const c = table(); c.devs[0] = ["corner"]; hold(c, 1, [0, 3, 0, 0, 0]); hold(c, 2, [0, 2, 0, 0, 0]);
  const cr = move(c, 0, { t: "play", card: "corner", res: 1 });
  const cl = flightsBetween(c, cr, 3).filter(x => x.what === "res");
  check(cl.length === 5 && cl.every(x => x.kind === 1 && x.to.seat === 0 && x.from.at === "seat" && x.up), "a Corner: every card of the kind goes from whoever held it to the player, face up");
  const big = table(); hold(big, 1, [9, 9, 9, 9, 9]);
  const empty = clone(big); empty.hand[1] = [0, 0, 0, 0, 0];
  check(flightsBetween(big, empty, 0).length === MOST_FLIGHTS, `a huge change shows at most ${MOST_FLIGHTS} cards`);
}

// ---------- the same on a played game: counts balance ----------
{
  let G = newRecord(rules, { seats: 4, seed: 41, now: 0 }), moves = 0, flights = 0, off = 0;
  while (!rules.over(G.state) && moves < 500) {
    const seat = rules.toMove(G.state), before = G.state;
    G = applyMove(rules, G, seat, botMove(rules, G, seat, "medium"), 0).G;
    const f = flightsBetween(before, G.state, 0).filter(x => x.what === "res");
    // every card that left a hand or came into one is one flight (up to the cap), and the bank's count is what is left over
    let delta = 0;
    for (let i = 0; i < 4; i++) delta += G.state.hand[i].reduce((a, b) => a + b, 0) - before.hand[i].reduce((a, b) => a + b, 0);
    const toBank = f.filter(x => x.to.at === "bank").length, fromBank = f.filter(x => x.from.at === "bank").length;
    if (f.length < MOST_FLIGHTS && fromBank - toBank !== delta) off++;
    flights += f.length; moves++;
  }
  check(moves > 100 && flights > 50, `a played game flew ${flights} cards over ${moves} moves`);
  check(off === 0, "…and for every move the bank paid out the difference between what the hands held before and after");
}

// ---------- which moves are shown ----------
{
  const G = { seq: 3, n: 10 };
  check(markOf(G).seq === 3 && markOf(G).n === 10 && markOf(null) === null, "the page notes the game's number and its move");
  check(!worth(null, G), "a page just opened has no move before it: nothing replays");
  check(worth({ seq: 3, n: 9 }, G), "the next move of the same game is shown");
  check(!worth({ seq: 3, n: 10 }, G), "the same move twice flies once");
  check(!worth({ seq: 2, n: 4 }, G), "another game's last move isn't this one's before");
  check(!worth({ seq: 3, n: 11 }, G), "a game that went backwards (a table that rewound) shows nothing");
  check(!worth({ seq: 3, n: 9 }, null), "no game, nothing");
  // a reload mid-turn: the page's first view is of the saved state, with nothing before it
  const saved = newRecord(rules, { seats: 4, seed: 5, now: 0 });
  check(!worth(null, saved) && flightsBetween(null, saved.state, 0).length === 0, "reloading mid-game replays nothing");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
