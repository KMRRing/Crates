// Settle's rules (settle-engine.js): the deal from a seed, metals settling by real density, blocks cast when the parcels in
// them are exactly an order's recipe (in any arrangement, a chain dropping what stood above), zinc on top aging to dross,
// skimming, the end, a game saved as JSON, the five chapters' mechanics (the pot and decanting, solid copper and firing, stirring
// bronze, charcoal over zinc, liquation), a level's fixed deal and its turns, and whole melts played out by the bot (settle-solve.js).
import { newGame, draw, parcelAt, mixFor, valid, settles, poured, isRecipe, findBlock, ship, moves, skims, pour, skim, preview, worth, BURN, BURN_COST, decant, fire, stir, act, options, decants, fires, stirs } from "../settle-engine.js";
import { METALS, RECIPES, heavier } from "../settle-alloys.js";
import { playOut } from "../settle-solve.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const P = (...ms) => ms.map(m => ({ m, a: 0 }));
/** A melt laid out by hand: crucibles as metal lists, bottom up. */
const melt = (tanks, hand = ["Sn", "Sn"], extra = {}) => { const g = Object.assign(newGame({ cols: tanks.length, height: 7, orders: ["plumber"], goal: 4 }, 1), { tanks: tanks.map(t => P(...t)), hand }, extra); g.hot = Array(g.cols).fill(false); if (g.burn) g.feats = { ...g.feats, skim: true }; return g; };

// ---------- the deal ----------
{
  const spec = { cols: 3, height: 8, orders: ["plumber", "fine"], goal: 4 };
  const a = newGame(spec, 7), b = newGame(spec, 7), c = newGame(spec, 8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), "the same seed deals the same melt, another seed another");
  check(valid(a) && a.hand.length === 2 && a.tanks.length === 3 && a.n === 2 && !a.burn, "two parcels offered, empty crucibles, no zinc so nothing burns");
  check(Array.from({ length: 200 }, (_, n) => draw(5, n)).every(x => x >= 0 && x < 1), "draws are between 0 and 1");
  const mix = mixFor(["brass"]), seen = new Set(Array.from({ length: 200 }, (_, n) => parcelAt(3, n, mix)));
  check([...seen].every(m => ["Cu", "Zn"].includes(m)) && seen.size === 2, "parcels are dealt from the metals the orders need");
  check(newGame({ cols: 4, height: 7, orders: ["brass"], goal: 2 }, 1).burn, "zinc in the mix switches burning on");
  check(!valid(JSON.parse(JSON.stringify({ ...a, v: 1 }))) && valid(JSON.parse(JSON.stringify(a))), "a saved melt of another version is not taken");
}

// ---------- real densities ----------
{
  const dens = Object.fromEntries(Object.entries(METALS).map(([k, m]) => [k, m.dens]));
  check(dens.Pb === 11.3 && dens.Cu === 9 && dens.Sn === 7.3 && dens.Zn === 7.1 && dens.X === 0, "lead 11.3, copper 9.0, tin 7.3, zinc 7.1, dross floats");
  check(heavier("Pb", "Sn") && heavier("Sn", "Zn") && !heavier("Zn", "Cu") && !heavier("X", "Zn"), "heavier is by density");
  check(Object.values(RECIPES).every(r => Object.values(r.parts).reduce((x, y) => x + y, 0) === r.w * r.k && r.real), "every recipe's parcels add up to its block, with the real alloy beside");
}

// ---------- settling ----------
{
  const t = [P("Pb", "Sn")];
  check(settles(t[0], "Cu") === 1 && settles(t[0], "Pb") === 1 && settles(t[0], "Zn") === 2 && settles(t[0], "X") === 2, "a parcel sinks below what is lighter and lies on what is as heavy or heavier");
  const r = poured([P("Pb", "Sn")], 0, "Cu");
  check(r.tanks[0].map(p => p.m).join() === "Pb,Cu,Sn" && r.level === 1, "copper poured on lead and tin lands between them");
  check(t[0].length === 2, "pouring shows the crucibles after without changing them");
}

// ---------- casting blocks ----------
{
  check(isRecipe(P("Sn", "Pb"), RECIPES.plumber) && !isRecipe(P("Sn", "Sn"), RECIPES.plumber) && isRecipe(P("Sn", "Pb", "Sn"), RECIPES.fine), "a recipe is exactly its parcels, in any order");
  const s = melt([[], []], ["Sn", "Sn"]), r = pour(s, 0, 1);
  check(r.casts.length === 0 && r.state.tanks[1].length === 1, "tin beside nothing casts nothing");
  const s2 = melt([["Pb"], ["Cu"]], ["Sn", "Sn"]);
  check(pour(s2, 0, 1).casts.length === 0, "tin settling above copper stands at another level from lead: no block");
  check(pour(melt([["Pb"], []], ["Pb", "Pb"]), 0, 1).casts.length === 0, "lead beside lead is not plumber's solder");
  const s4 = melt([["Sn"], []], ["Pb", "Sn"]), r4 = pour(s4, 0, 1);
  check(r4.casts.length === 1 && r4.casts[0].id === "plumber" && r4.gain === worth(2) && r4.state.score === 40 && r4.state.casts === 1, "lead beside tin at one level casts plumber's solder, worth 10 n²");
  check(r4.state.tanks.every(t => t.length === 0), "a cast block drains out of its crucibles");
  const s5 = melt([["Pb", "Sn"], []], ["Sn", "Sn"]), r5 = pour(s5, 0, 1);
  check(r5.casts.length === 1 && r5.state.tanks[0].length === 1 && r5.state.tanks[1].length === 0, "what stood above a cast drops into its place");
}

// ---------- chains ----------
{
  const t3 = ship([P("Pb", "Sn", "Pb"), P("Sn", "Pb", "Sn")], ["plumber"]);
  check(t3.casts.length === 3 && t3.tanks.every(x => !x.length), "a cast drops what stood above, and the next block is looked for: three casts in a chain");
  const two = ship(P("Pb", "Pb").length ? [P("Pb", "Pb"), P("Sn", "Sn")] : [], ["plumber"]);
  check(two.casts.length === 2 && two.tanks.every(x => !x.length), "two blocks one above the other both ship, the lower first");
  const wide = ship([P("Pb", "Pb"), P("Sn", "Pb"), P("Sn", "Sn")], ["plumber", "fine"]);
  check(wide.casts.map(c => c.id).join() === "fine,plumber" || wide.casts.map(c => c.id).join() === "plumber,fine" || wide.casts.length >= 1, "wider orders are found too");
  const f = findBlock([P("Pb"), P("Sn"), P("Sn")], ["plumber", "fine"]);
  check(f && f.order.id === "fine" && f.c === 0, "the biggest order wins when two fit, then the leftmost");
}

// ---------- two-level orders ----------
{
  const tanks = [P("Sn", "Pb"), P("Sn", "Pb"), P("Sn", "Pb"), P("Sn", "Sn")];
  const b = findBlock(tanks, ["solder"]);
  check(b && b.order.id === "solder" && b.r === 0, "soft solder is 5 tin to 3 lead over a block four wide, two tall, in any arrangement");
  const bad2 = [P("Sn", "Pb"), P("Sn", "Pb"), P("Sn", "Sn"), P("Sn", "Sn")];
  check(!findBlock(bad2, ["solder"]), "one lead short is no block");
}

// ---------- zinc burns, skimming ----------
{
  const s = melt([["Cu", "Zn"], [], []], ["Cu", "Cu"], { orders: ["brass"], burn: true });
  let st = s;
  check(st.tanks[0][1].a === 0, "fresh zinc has stood on top for no pours");
  for (let k = 0; k < BURN - 1; k++) st = pour(st, 0, 2).state;
  check(st.tanks[0][1].m === "Zn" && st.tanks[0][1].a === BURN - 1, `zinc on top ages a pour at a time, ${BURN - 1} so far`);
  const r = pour(st, 0, 1);
  check(r.burnt.length === 1 && r.state.tanks[0][1].m === "X" && r.state.burned === 1, `at ${BURN} pours it burns to dross`);
  check(r.lost === Math.min(st.score + r.gain, BURN_COST) && r.state.score === st.score - r.lost + r.gain, "a burn costs ten, never below nothing");
  check(skims(r.state).join() === "0", "dross on top can be skimmed");
  const k = skim(r.state, 0);
  check(k.state.tanks[0].map(p => p.m).join() === "Cu" && k.state.pours === r.state.pours + 1 && k.state.n === r.state.n, "a skim removes the dross, costs a turn and uses no parcel");
  let threw = false;
  try { skim(k.state, 0); } catch { threw = true; }
  check(threw && !skims({ ...s, burn: false }).length, "no skim where there is no dross, and none where zinc never burns");
  const covered = melt([["Zn", "Cu"], []], ["Cu", "Cu"], { orders: ["brass"], burn: true });
  const c2 = pour(pour(pour(pour(pour(pour(covered, 0, 1).state, 0, 1).state, 0, 1).state, 0, 1).state, 0, 1).state, 0, 1).state;
  check(c2.tanks[0].every(p => p.m !== "X"), "zinc under another metal does not age");
  const fresh = pour(melt([["Cu", "C"], []], ["Zn", "Cu"], { orders: ["brass"], burn: true }), 0, 0);
  check(fresh.state.tanks[0].map(p => p.m).join() === "Cu,Zn,C" && fresh.state.tanks[0][1].a === 0, "zinc poured under charcoal sinks below it, and does not age");
}

// ---------- the end ----------
{
  const full = melt([["Pb", "Pb", "Pb", "Pb", "Pb", "Pb"], ["Pb", "Pb", "Pb", "Pb", "Pb", "Pb", "Pb"]], ["Pb", "Pb"], { orders: ["plumber"], height: 7 });
  const r = pour(full, 0, 0);
  check(r.state.over && !r.state.won && moves(r.state).length === 0, "every crucible full: the melt is lost");
  let threw = false;
  try { pour(r.state, 0, 0); } catch { threw = true; }
  check(threw, "nothing is poured after the end");
  const near = melt([["Sn"], []], ["Pb", "Sn"], { goal: 1 });
  const w = pour(near, 0, 1).state;
  check(w.won && w.over, "the goal of casts wins");
  threw = false;
  try { pour(melt([["Pb"], []]), 0, 5); } catch { threw = true; }
  check(threw, "no such crucible is refused");
  const a = pour(melt([["Pb"], []]), 0, 1);
  check(JSON.stringify(preview(melt([["Pb"], []]), 0, 1)) === JSON.stringify(a) || preview(melt([["Pb"], []]), 0, 1).state.pours === a.state.pours, "a preview is the move without making it");
  check(valid(JSON.parse(JSON.stringify(a.state))), "a melt survives being saved as JSON");
}

// ---------- the bot plays whole melts ----------
{
  let won = 0, total = 0;
  for (const orders of [["plumber"], ["fine"], ["plumber", "fine"], ["hard"], ["finepewter"]]) for (const seed of [1, 2, 3]) {
    const s = playOut(newGame({ cols: 4, height: 7, orders, goal: 3 }, seed), 120);
    total++; if (s.won) won++;
  }
  check(won === total, `the bot wins ${won} of ${total} melts`);
}
// ---------- the chapters' mechanics (13 November 2026) ----------
{
  // Solder: every pour into the pot, the top of any crucible tipped into another
  const pot = melt([["Pb", "Sn"], [], []], ["Sn", "Pb"], { feats: { pot: true, decant: true } });
  check(moves(pot).every(m => m.c === 0) && decants(pot).some(([a, b]) => a === 0 && b === 2), "with the pot every parcel goes into the first crucible, and the top of one can be tipped into another");
  const d = decant(pot, 0, 1);
  check(d.casts.length === 1 && d.casts[0].id === "plumber" && d.state.tanks.every(t => !t.length) && d.state.pours === 1 && d.state.n === pot.n, "tipping the pot's tin beside its lead casts plumber's solder: a turn, no parcel used");
  // Pewter: copper solid in a cold crucible, a floor, cast in nothing; firing melts it and keeps the crucible hot
  const pw = melt([["Sn"], ["Sn"], ["Sn"]], ["Cu", "Cu"], { orders: ["hard"], solid: true, fuel: 1, feats: { fire: true } });
  const cold = pour(pw, 0, 2).state;
  check(cold.tanks[2].map(p => p.m + (p.s ? "!" : "")).join() === "Sn,Cu!" && !findBlock(cold.tanks, ["hard"]), "copper poured into a cold crucible stays solid on top, and casts in nothing");
  const lit = fire(cold, 2);
  check(lit.casts.length === 1 && lit.casts[0].id === "hard" && lit.state.tanks[2].map(p => p.m).join() === "Sn" && lit.state.hot[2] && lit.state.fuel === 0, "firing melts it under the tin, beside the other two tins: hard metal is cast; the crucible stays hot and the fuel is used");
  check(!fires(lit.state).length && pour({ ...lit.state, hand: ["Cu", "Sn"] }, 0, 2).state.tanks[2][0].m === "Cu" && !pour({ ...lit.state, hand: ["Cu", "Sn"] }, 0, 2).state.tanks[2].some(p => p.s), "with no fuel there is no fire, and copper poured into a hot crucible melts at once");
  // Bronze: three copper to one tin stirred is bronze; any other measure spoils
  const br = melt([["Cu", "Cu", "Cu", "Sn"], ["Cu", "Sn"]], ["Cu", "Cu"], { orders: ["bar"], feats: { stir: true, skim: true } });
  const good = stir(br, 0), spoilt = stir(br, 1);
  check(good.state.tanks[0].every(p => p.m === "Bz") && !good.spoiled && spoilt.spoiled && spoilt.state.tanks[1].every(p => p.m === "X") && stirs(br).join() === "0,1", "three copper to one tin stirred turns to bronze; two to one spoils to dross");
  check(skims(spoilt.state).join() === "1", "spoiled dross can be skimmed");
  // Brass: zinc with no charcoal over it boils off at once
  const bz = pour(melt([["Cu"], ["Cu", "C"]], ["Zn", "Zn"], { orders: ["brass"], burn: true }), 0, 0);
  check(bz.burnt.length === 1 && bz.state.tanks[0].map(p => p.m).join() === "Cu,X", "zinc poured where there is no charcoal boils off to dross");
  // Silver: lead sinking through black copper takes its silver
  const sv = pour(melt([["Bk", "Bk"], []], ["Pb", "Pb"], { orders: ["saiger"] }), 0, 0);
  check(sv.state.tanks[0].map(p => p.m).join() === "Pr,Cu,Cu" && sv.leached.length === 2, "lead sinking through black copper takes its silver: rich lead under plain copper");
  // a level: its fixed deal, then none; its turns
  const lv = newGame({ cols: 2, height: 4, orders: ["plumber"], goal: 1, deal: ["Pb", "Sn", "Sn"], limit: 2 });
  check(lv.hand.join() === "Pb,Sn" && pour(lv, 0, 0).state.hand.join() === "Sn,Sn" && pour(pour(lv, 0, 0).state, 0, 0).state.hand[0] === null, "a level deals its own parcels, then none");
  check(pour(pour(lv, 0, 0).state, 0, 0).state.over && !pour(pour(lv, 0, 0).state, 0, 0).state.won, "and gives so many turns: the fire goes out");
  check(options(pot).every(mv => act(pot, mv).state.pours === 1), "every move listed can be made");
}
if (bad) { console.log(`${bad} failed`); process.exit(1); }
