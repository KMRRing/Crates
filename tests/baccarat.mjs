// Baccarat's rules (baccarat-engine.js): what cards count and a hand's total, the tableau (every case of the Banker's
// third card against the standard table, written out here on its own), hands dealt (naturals, the Player's draw, the
// Banker's by the tableau, pairs), the odds and the house's edge worked out exactly, what each bet pays at both tables,
// which bets may go down, the shoe (eight decks, the burn, the cut card, the last hand), the roads (the bead plate, the big
// road with its ties and dragon's tails, the three derived roads and the ask road on a worked example), the counts, a game
// saved and opened again, and whole shoes dealt through.
import { DECKS, CUT_FROM_END, START, MIN, UNIT, rankOf, value, total, bankerDraws, dealHand, payout, settle, betsProblem, newGame, changeShoe, deal, beadPlate, bigColumns, layout, derived, runs, ask, counts, toCut } from "../baccarat-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
// a card by its rank's name ("A", "2" … "10", "J", "Q", "K"), in spades unless a suit is given
const R = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const c = (name, suit = 3) => R.indexOf(name) * 4 + suit;
const cards = text => text.split(" ").map(t => c(t));

// ---------- values and totals ----------
{
  check(value(c("A")) === 1 && value(c("9")) === 9 && ["10", "J", "Q", "K"].every(r => value(c(r)) === 0), "an ace counts 1, two to nine their pips, a ten or a court card nothing");
  check(total(cards("7 8")) === 5 && total(cards("K 9")) === 9 && total(cards("5 5")) === 0 && total(cards("9 9 9")) === 7, "a total is the last digit: 7 and 8 make 5, 5 and 5 make 0");
}

// ---------- the tableau ----------
{
  // the Banker's third card, as every casino's card prints it: on 3 draw except against an 8, on 4 against 2–7, on 5
  // against 4–7, on 6 against 6–7 (a Player's third card counted 0–9); 0–2 always, 7 never
  const TABLE = { 0: "0123456789", 1: "0123456789", 2: "0123456789", 3: "012345679", 4: "234567", 5: "4567", 6: "67", 7: "" };
  let ok = true;
  for (let bt = 0; bt <= 7; bt++) for (let v = 0; v <= 9; v++) {
    const third = v === 0 ? c("K") : c(R[v - 1]);
    if (bankerDraws(bt, third) !== TABLE[bt].includes(String(v))) ok = false;
  }
  check(ok, "the Banker's third card against the Player's, all eighty cases as the tableau prints them");
  check([0, 1, 2, 3, 4, 5].every(bt => bankerDraws(bt, null)) && !bankerDraws(6, null) && !bankerDraws(7, null), "when the Player stood, the Banker draws on 0–5 and stands on 6–7, as the Player does");
}

// ---------- hands ----------
{
  const nat = dealHand(cards("8 2 K 3 5 5"));
  check(nat.natural && nat.player.length === 2 && nat.banker.length === 2 && nat.pt === 8 && nat.winner === "P" && nat.used === 4, "a natural 8 ends the hand on two cards each: Player 8 beats Banker 5");
  const stand = dealHand(cards("6 3 K 2 4 4"));
  check(stand.player.length === 2 && stand.banker.length === 3 && stand.bt === 9 && stand.winner === "B", "the Player stands on 6; the Banker on 5, with the Player standing, draws, and makes 9");
  const both = dealHand(cards("2 3 2 3 7 A"));
  check(both.player.join() === cards("2 2 7").join() && both.banker.length === 3 && both.pt === 1 && both.bt === 7 && both.winner === "B", "the Player draws on 4; the Banker on 6 draws against a 7, and wins 7 to 1");
  const no = dealHand(cards("2 3 2 3 8 A"));
  check(no.banker.length === 2 && no.bt === 6 && no.pt === 2, "but on 3 never against an 8");
  check(dealHand(cards("Q 4 7 3")).winner === "T" && dealHand(cards("7 9 7 9")).ppair && dealHand(cards("7 9 7 9")).bpair, "equal totals tie (7 and 7, both standing); a hand's first two cards alike by rank are a pair");
  check(!dealHand(cards("10 2 K 3 2 2")).ppair, "a ten and a king count the same but aren't a pair");
}

// ---------- the odds, exactly ----------
{
  // every hand of six cards weighed by how likely its values are (an endless shoe: a 0 four times as likely as any other),
  // which is what eight decks come to within a few thousandths
  const P = [4 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13, 1 / 13];
  const card = v => (v === 0 ? c("K") : c(R[v - 1]));
  const out = { B: 0, P: 0, T: 0, B6: 0 };
  const go = (vals, p) => {
    if (vals.length === 6) { const h = dealHand(vals.map(card)); out[h.winner] += p; if (h.winner === "B" && h.bt === 6) out.B6 += p; return; }
    for (let v = 0; v < 10; v++) go([...vals, v], p * P[v]);
  };
  go([], 1);
  const near = (a, b, d = 0.002) => Math.abs(a - b) < d;
  check(near(out.B, 0.4586) && near(out.P, 0.4462) && near(out.T, 0.0952), `the Banker wins ${(out.B * 100).toFixed(2)}%, the Player ${(out.P * 100).toFixed(2)}%, a tie ${(out.T * 100).toFixed(2)}% (eight decks: 45.86, 44.62, 9.52)`);
  const banker = out.B * 0.95 - out.P, player = out.P - out.B, tie = out.T * 8 - (1 - out.T), free = (out.B - out.B6) + out.B6 / 2 - out.P;
  check(near(banker, -0.0106, 0.001) && near(player, -0.0124, 0.001) && near(tie, -0.1436, 0.003) && near(free, -0.0146, 0.001), `the house's edge: Banker ${(-banker * 100).toFixed(2)}%, Player ${(-player * 100).toFixed(2)}%, Tie ${(-tie * 100).toFixed(1)}%, no-commission Banker ${(-free * 100).toFixed(2)}%`);
}

// ---------- what bets pay ----------
{
  const b6 = dealHand(cards("2 3 2 3 8 A")), b7 = dealHand(cards("2 3 2 3 7 A")), tie = dealHand(cards("Q 4 7 3"));
  check(payout("banker", 1000, b7, "commission") === 950 && payout("banker", 1000, b7, "nocommission") === 1000 && payout("banker", 1000, b6, "nocommission") === 500, "the Banker pays 0.95 at a commission table; 1 to 1 without, but half when it wins with six");
  check(payout("player", 1000, tie, "commission") === 0 && payout("banker", 1000, tie, "commission") === 0 && payout("tie", 1000, tie, "commission") === 8000, "a tie pushes Player and Banker, and pays the Tie 8 to 1");
  check(payout("super6", 500, b6, "nocommission") === 6000 && payout("super6", 500, b7, "nocommission") === -500, "Super 6 pays 12 to 1 on the Banker winning with six");
  const s = settle({ banker: 1000, bpair: 100 }, dealHand(cards("7 9 7 9 2 2")), "commission");
  check(s.net === 950 + 1100 && s.back === 1950 + 1200, "everything on the table settled together: what it won, and what comes back with the stakes");
  check(betsProblem({}, START) && betsProblem({ player: 300 }, START) && betsProblem({ player: 550 }, START) && betsProblem({ player: 500, banker: 500 }, START) && betsProblem({ banker: 600 }, 500) && betsProblem({ tie: 20000 }, START) && !betsProblem({ banker: MIN, tie: UNIT }, START),
    `Player and Banker from HK$${MIN}, in HK$${UNIT}s, never both, the side bets up to their own limit, never more than you hold`);
}

// ---------- the shoe ----------
{
  const s = newGame(7), each = new Map();
  for (const id of s.shoe) each.set(id, (each.get(id) || 0) + 1);
  check(s.shoe.length === 52 * DECKS && each.size === 52 && [...each.values()].every(n => n === DECKS), "eight decks: every card eight times");
  check(s.pos === 1 + s.burn.count && s.burn.shown === s.shoe[0] && s.burn.count === (value(s.shoe[0]) || 10), "the first card turned, and as many burned as it counts (a ten or a court card ten)");
  check(s.cut === s.shoe.length - CUT_FROM_END && toCut(s) === s.cut - s.pos && JSON.stringify(newGame(7)) === JSON.stringify(s) && JSON.stringify(newGame(8).shoe) !== JSON.stringify(s.shoe), `the cut card ${CUT_FROM_END} from the back; the same seed shuffles the same shoe, another another`);
  let g = newGame(11), cut = -1, done = -1, k = 0;
  while (done < 0) {
    g = { ...g, bets: { banker: MIN } };
    const r = deal(g);
    if (r.cutCame) cut = k;
    if (r.shoeDone) done = k;
    g = r.state;
    k++;
  }
  check(cut >= 0 && done === cut + 1 && g.pos <= g.shoe.length && g.results.length === k, `the cut card comes out in hand ${cut + 1}; one more hand, and the shoe is done (${k} hands)`);
  const fresh = changeShoe(g);
  check(fresh.shoeNo === 2 && fresh.results.length === 0 && !fresh.last && fresh.balance === g.balance, "a new shoe: the roads start again, the bankroll goes on");
}

// ---------- the roads ----------
{
  const res = s => [...s].map(ch => ({ w: ch.toUpperCase(), pp: false, bp: false }));
  check(beadPlate(res("BPTBBBP")).map(b => `${b.x}${b.y}`).join() === "00,01,02,03,04,05,10", "the bead plate: every hand in order, six down a column then the next");
  const { cols, leading } = bigColumns(res("TTBBTBPTTPB"));
  check(cols.length === 3 && cols[0].length === 3 && cols[0][0].ties === 2 && cols[0][1].ties === 1 && cols[1][0].ties === 2 && cols[1][1].ties === 0 && cols[2][0].w === "B" && leading === 0, "the big road: a column for each run, ties marked on the win before them, the shoe's first ties on its first win");
  check(bigColumns(res("TT")).leading === 2 && bigColumns(res("TT")).cols.length === 0, "a shoe of ties so far: no column yet, the ties waiting");
  const dragon = layout([[..."BBBBBBBB"], [..."PPPPPP"], ["B"]]);
  const at = (col, row) => { const m = dragon.find(d => d.col === col && d.row === row); return `${m.x},${m.y}`; };
  check(at(0, 5) === "0,5" && at(0, 6) === "1,5" && at(0, 7) === "2,5", "a run of eight: down the column, then along the foot (the dragon's tail)");
  check(at(1, 0) === "1,0" && at(1, 4) === "1,4" && at(1, 5) === "2,4" && at(2, 0) === "2,0", "the next column turns above the tail it meets; the one after starts at the next column's top");
  // a worked example: B B B | P P | B | P P P | B B, each road's marks worked out by hand from its rules
  const ex = bigColumns(res("BBBPPBPPPBB")).cols;
  check(derived(ex, 1).join(" ") === "red blue blue blue red blue red", "the big eye boy: one column back, from the second row of column two");
  check(derived(ex, 2).join(" ") === "blue red blue blue blue", "the small road: two columns back");
  check(derived(ex, 3).join(" ") === "red red red red", "the cockroach road: three columns back");
  check(runs(derived(ex, 1)).map(r => r.length).join() === "1,3,1,1,1", "a derived road laid out in columns by colour");
  const a = ask(res("BBBPPBPPPBB"));
  check(a.B.join() === "red,red,blue" && a.P.join() === "blue,blue,red", "the ask road: what each would show next, a Banker or a Player (always opposite colours)");
  check([...ask(res("B")).B, ...ask(res("B")).P].every(m => m === null) && ask(res("BP")).B[0] === "red" && ask(res("BP")).B[1] === null, "a road that hasn't started has nothing to say (the big eye boy starts at the top of the third column)");
  const n = counts([...res("BBPT"), { w: "B", pp: true, bp: true, nat: true }]);
  check(n.hands === 5 && n.B === 3 && n.P === 1 && n.T === 1 && n.pp === 1 && n.bp === 1 && n.nat === 1, "the counts: hands, wins each way, ties, pairs, naturals");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 6; k++) s = deal({ ...s, bets: { player: 500 } }).state;
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(deal({ ...s, bets: { banker: 1000 } })) === JSON.stringify(deal({ ...again, bets: { banker: 1000 } })), "a game saved and opened again goes on as it would have");
}

// ---------- whole shoes ----------
{
  // flat Banker bets through twenty shoes: about the edge, and every card where it should be
  let g = newGame(3), staked = 0, ok = true;
  const before = g.balance;
  for (let shoe = 0; shoe < 20; shoe++) {
    for (;;) {
      g = { ...g, bets: { banker: 1000 } };
      const r = deal(g);
      staked += 1000;
      if (r.hand.player.length < 2 || r.hand.banker.length < 2 || r.state.pos > r.state.shoe.length) ok = false;
      g = r.state;
      if (r.shoeDone) break;
    }
    g = changeShoe(g);
  }
  const edge = (before - g.balance) / staked;
  check(ok && Math.abs(edge) < 0.04, `twenty shoes of HK$1,000 on the Banker: ${(edge * 100).toFixed(1)}% of the stakes lost (the edge is 1.06%; a few thousand hands swing a few points either way)`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("baccarat: values, the tableau, hands, the odds, payouts, the shoe, the roads, saving, whole shoes");
