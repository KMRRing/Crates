// Picks Settle's levels and writes settle-book.js: `node settle-plan.mjs` (all), `node settle-plan.mjs 2,4` (only those chapters, the
// others kept as they are in the file), `node settle-plan.mjs survey 3 [tries]` (how each recipe of chapter 3 fares on a few seeds).
// 13 November 2026, Korbi: "settle is more like topple... maybe 5 different chapters and they each have different mechanics (these are
// the different metal combinations). the problem is that the starting ones aren't great currently!" and "early levels way too easy
// ('everything in this column, then the rest')". So each level is a fixed puzzle: crucibles already part filled and a fixed deal. It is
// kept only where
//  - the search that knows the deal (settle-solve.js `search`) wins it: its par and its plan, which the tests replay;
//  - the chapter's mechanic is needed: the same search with it taken away does not win, or takes two turns more;
//  - from the second level of a chapter on (the first only teaches its idea), "everything in this column, then the rest"
//    (settle-solve.js `columns`) does not win within the level's turns (half as many again as its par), nor do three players at random;
//  - from the third level of a chapter on, the move that looks best at once (`greedy`) does not win either, and in the last two, nor
//    does the bot that looks two moves ahead (`think`).
// Of the seeds that pass, the one whose par is nearest the slot's is kept. Every level says its trick (its tip).
import fs from "fs";
const here = new URL("./", import.meta.url);
const { CHAPTERS, RECIPES } = await import(new URL("settle-alloys.js", here));
const { newGame, draw, mixFor, parcelAt, placed, findBlock } = await import(new URL("settle-engine.js", here));
const { search, playOut, columns, greedy, think, randomly } = await import(new URL("settle-solve.js", here));

// cols, height; orders; goal (casts); deal (parcels dealt); start (parcels already in, spread by the seed); carts (the deal comes in runs
// of so many of one metal); fuel; par (the turns aimed at)
const S = (name, rec) => ({ name, ...rec });
const BOOK = {
  1: [
    S("Plumber's solder", { cols: 3, height: 4, orders: ["plumber"], goal: 2, deal: 2, start: 2, par: 4, tip: "Everything goes into the melting pot, where tin floats on lead. Tip the tin into a mould and the lead beside it is a row: cast." }),
    S("Fine solder", { cols: 3, height: 5, orders: ["fine"], goal: 2, deal: 4, start: 2, par: 8, tip: "Two tin and a lead in one row, across all three crucibles: the lead stays in the pot, the tin goes out to the moulds." }),
    S("Three across", { cols: 3, height: 5, orders: ["fine"], goal: 3, deal: 7, start: 2, carts: 3, par: 12, tip: "The tin comes by the cartload: tip it out before the lead is buried under it." }),
    S("Both solders", { cols: 4, height: 4, orders: ["plumber", "fine"], goal: 4, deal: 7, start: 3, par: 10, tip: "Four crucibles: a row of four can be two plumber's solders, or a fine solder and a spare." }),
    S("Low moulds", { cols: 4, height: 3, orders: ["plumber", "fine"], goal: 4, deal: 8, start: 2, par: 11, tip: "The moulds are only three high: a tin tipped too early has nowhere to go." }),
    S("Soft solder", { cols: 4, height: 5, orders: ["solder"], goal: 2, deal: 13, start: 3, par: 25, tip: "Five tin and three lead in a block two high and four wide: count what each mould will hold before you tip." }),
  ],
  2: [
    S("Hard metal", { cols: 3, height: 5, orders: ["hard"], goal: 3, deal: 7, start: 4, fuel: 2, par: 9, tip: "Copper stays where it lands until its crucible is fired, then sinks under the tin. Fire only where the copper should be lower." }),
    S("Cold copper", { cols: 3, height: 5, orders: ["hard"], goal: 3, deal: 8, start: 5, fuel: 2, par: 10, tip: "Solid copper is a floor: tin poured after lies on it. Build the row on the copper, not under it." }),
    S("Fine pewter", { cols: 3, height: 5, orders: ["finepewter"], goal: 3, deal: 9, start: 4, fuel: 2, par: 11, tip: "Three tin to one copper in a square two by two: the copper can stand high or low, so fire only what must drop." }),
    S("Short of fuel", { cols: 3, height: 5, orders: ["hard", "finepewter"], goal: 4, deal: 10, start: 6, fuel: 1, par: 13, tip: "One firing for the whole melt: save it for the crucible where the copper is buried wrong." }),
    S("Hot and cold", { cols: 4, height: 5, orders: ["hard", "finepewter"], goal: 4, deal: 10, start: 7, fuel: 2, par: 13, tip: "Two crucibles to fire and two to leave cold: decide which before the copper comes." }),
    S("The pewterer", { cols: 4, height: 5, orders: ["hard", "finepewter"], goal: 5, deal: 12, start: 7, fuel: 2, par: 16, tip: "Every rule at once and fuel for two firings: a fire too early melts copper where it has to stay." }),
  ],
  3: [
    S("Bronze", { cols: 3, height: 6, orders: ["bar"], goal: 2, deal: 8, start: 4, par: 10, tip: "Stir a crucible of three copper to one tin and it all turns to bronze. Count before you stir: any other measure spoils it." }),
    S("The measure", { cols: 3, height: 6, orders: ["bar"], goal: 2, deal: 9, start: 5, par: 11, tip: "A crucible with too much tin can't be stirred right: pour the copper it lacks, or start another." }),
    S("Bell metal", { cols: 3, height: 6, orders: ["bell"], goal: 2, deal: 10, start: 5, par: 12, tip: "A bell is four bronze, two by two: stir two crucibles that stand side by side." }),
    S("Spoiled", { cols: 3, height: 6, orders: ["bar", "bell"], goal: 3, deal: 11, start: 6, par: 14, tip: "A spoiled stir leaves dross: skim it, a turn, or bury it under the next bronze." }),
    S("Two at once", { cols: 4, height: 5, orders: ["bar", "bell"], goal: 3, deal: 12, start: 7, par: 15, tip: "Bronze settles between copper and tin: a crucible stirred under a tin keeps its tin on top." }),
    S("The bell founder", { cols: 4, height: 6, orders: ["bar", "bell"], goal: 4, deal: 14, start: 8, par: 18, tip: "Every measure counted: stir each crucible once, at the right moment, and cast as you go." }),
  ],
  4: [
    S("Brass", { cols: 3, height: 5, orders: ["brass"], goal: 3, deal: 9, start: 3, par: 10, tip: "Zinc is the lightest metal: on top it boils off in a few turns. Charcoal floats on everything, so zinc under it is safe." }),
    S("Under cover", { cols: 3, height: 5, orders: ["brass"], goal: 3, deal: 10, start: 4, par: 11, tip: "Keep a charcoal on the crucible the zinc goes into, and skim it off when the row is ready." }),
    S("Prince's metal", { cols: 4, height: 5, orders: ["prince"], goal: 3, deal: 11, start: 4, par: 12, tip: "Three copper to one zinc across four crucibles: one of the four holds the zinc, under its cover." }),
    S("Smoke", { cols: 4, height: 5, orders: ["brass", "prince"], goal: 4, deal: 12, start: 5, par: 14, tip: "Two kinds of brass and one charcoal at a time: the zinc you can't cover goes where it casts next turn." }),
    S("Tombac", { cols: 3, height: 6, orders: ["tombac"], goal: 2, deal: 12, start: 5, par: 14, tip: "Five copper to one zinc, two high: the zinc can sit under copper, where it is safe without charcoal." }),
    S("The brass founder", { cols: 4, height: 5, orders: ["brass", "prince", "tombac"], goal: 4, deal: 14, start: 6, par: 17, tip: "Every brass at once: plan where the zinc lies before it comes, or it burns." }),
  ],
  5: [
    S("Liquation", { cols: 3, height: 5, orders: ["saiger"], goal: 2, deal: 6, start: 4, par: 7, tip: "Lead sinking through black copper takes its silver: the lead turns rich, the copper plain. Two rich lead side by side are cast." }),
    S("Garkupfer", { cols: 3, height: 5, orders: ["gar"], goal: 2, deal: 7, start: 5, par: 8, tip: "Plain copper three across is cast; black copper is not. Send lead down through it first." }),
    S("The Saiger hut", { cols: 3, height: 5, orders: ["saiger", "gar"], goal: 3, deal: 8, start: 6, par: 10, tip: "One lead can clean a whole crucible of black copper, but only the crucible it sinks in." }),
    S("Tipping lead", { cols: 4, height: 5, orders: ["saiger", "gar"], goal: 3, deal: 9, start: 7, par: 11, tip: "Lead on top of a crucible can be tipped into another full of black copper: decant it through." }),
    S("Silver rows", { cols: 4, height: 5, orders: ["saiger", "gar"], goal: 4, deal: 10, start: 8, par: 13, tip: "Rich lead lies at the foot: the silver row is the bottom row, so clean the copper above it last." }),
    S("Grünthal", { cols: 4, height: 6, orders: ["saiger", "gar"], goal: 5, deal: 12, start: 9, par: 16, tip: "The whole liquation: every black copper cleaned, every lead made rich, and nothing left to spare." }),
  ],
};
const idOf = (ch, n) => `${ch}-${n + 1}`;

// ---------- a level from a recipe ----------
/** The parcels a level's casts are made of, with what is made (bronze, rich lead) as what it is made from: the goal's casts, the orders
 *  taken in turn. */
function needs(rec, ch) {
  const made = { Bz: { Cu: 0.75, Sn: 0.25 }, Pr: { Pb: 1, Bk: 1 } }, out = {};
  for (let i = 0; i < rec.goal; i++) {
    const r = RECIPES[rec.orders[i % rec.orders.length]];
    for (const [m, k] of Object.entries(r.parts)) for (const [d, f] of Object.entries(made[m] || { [m]: 1 })) out[d] = (out[d] || 0) + (m === "Pr" ? f * k / 2 + (d === "Pb" ? k / 2 : 0) : f * k);
  }
  if (ch === 5 && out.Cu) { out.Bk = (out.Bk || 0) + out.Cu; out.Pb = (out.Pb || 0) + Math.ceil(out.Cu / 3); delete out.Cu; }   // the copper comes black: its lead too
  return Object.entries(out).flatMap(([m, k]) => Array(Math.round(k)).fill(m));
}
/** The level for a seed: the parcels its casts need and a few more (the chapter's metals, as the orders favour them), shuffled; the
 *  first `start` poured into the crucibles at random (settled as they would be, copper solid more often than not where it is), the rest
 *  the deal. */
function levelFor(ch, rec, seed) {
  const C = CHAPTERS.find(c => c.id === ch), mix = mixFor(rec.orders).filter(([m]) => C.metals.includes(m));
  if (ch === 4) mix.push(["C", 0.35]);
  const all = needs(rec, ch);
  for (let k = 0; all.length < rec.start + rec.deal; k++) all.push(parcelAt(seed * 31 + 5, k, mix));
  if (ch === 4) for (let k = 0, z = all.filter(m => m === "Zn").length; k < Math.ceil(z / 2); k++) all.push("C");
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(draw(seed * 31 + 6, i) * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  let tanks = Array.from({ length: rec.cols }, () => []), k = 0;
  const startN = Math.min(rec.start, all.length - 2);
  let deal = all.slice(startN);
  if (rec.carts) {                                               // the deal comes by the cart: a few of one metal, then a few of another
    const by = {};
    for (const m of deal) (by[m] ??= []).push(m);
    const carts = Object.values(by).flatMap(list => { const out = []; for (let i = 0; i < list.length; i += rec.carts) out.push(list.slice(i, i + rec.carts)); return out; });
    for (let i = carts.length - 1; i > 0; i--) { const j = Math.floor(draw(seed * 31 + 12, i) * (i + 1)); [carts[i], carts[j]] = [carts[j], carts[i]]; }
    deal = carts.flat();
  }
  for (let i = 0; i < startN && k < 400; k++) {
    const m = all[i], c = C.feats.pot ? 0 : Math.floor(draw(seed * 31 + 8, k) * rec.cols);     // the moulds start empty: only the pot holds metal
    if (tanks[c].length >= rec.height - (C.feats.pot ? 0 : 1)) continue;
    const t = placed(tanks, c, { m, a: 0, ...(C.solid && m === "Cu" && draw(seed * 31 + 9, k) < 0.6 ? { s: 1 } : {}) }).tanks;
    if (findBlock(t, rec.orders)) continue;                       // nothing ready to cast before the first turn
    tanks = t;
    i++;
  }
  return { ch, cols: rec.cols, height: rec.height, orders: rec.orders, goal: rec.goal, fuel: rec.fuel ?? 0, feats: { ...C.feats }, solid: !!C.solid, burn: !!C.burn, ...(C.burnAt ? { burnAt: C.burnAt } : {}),
    start: tanks.map(t => t.map(p => p.m + (p.s ? "!" : ""))), deal };
}
/** The level without its chapter's mechanic: no decant, no fire (copper stays solid), no stir, no charcoal's cover,
 *  no silver to draw out (black copper dealt as plain). */
function without(ch, L) {
  if (ch === 1 || ch === 5) return { ...L, feats: { ...L.feats, decant: false } };
  if (ch === 2) return { ...L, fuel: 0 };
  if (ch === 3) return { ...L, feats: { ...L.feats, stir: false } };
  if (ch === 5) return { ...L, deal: L.deal.map(m => (m === "Bk" ? "Cu" : m)), start: L.start.map(t => t.map(m => (m === "Bk" ? "Cu" : m))) };
  return { ...L, deal: L.deal.filter(m => m !== "C"), start: L.start.map(t => t.filter(m => m !== "C")) };
}
const turns = L => L.deal.length * (L.feats.pot ? 3 : 1) + 12;
/** The turns a level gives: half as many again as its par, and three more at least. */
const limitOf = par => Math.max(par + 3, Math.ceil(par * 1.5));
/** A level rated: null where it fails a rule above, else its par and plan, and what the bots do (within the level's turns). */
function rate(ch, rec, n, L0) {
  const s0 = newGame(L0), sr = search(L0, 0, { width: 160, limit: turns(L0) });
  if (findBlock(s0.tanks, L0.orders)) return { why: "ready" };
  if (!sr) return null;
  const L = { ...L0, limit: limitOf(sr.turns) };
  const bare = search(without(ch, L), 0, { width: 160, limit: turns(L) });
  if (bare && bare.turns < sr.turns + 2) return { why: "needless" };   // the mechanic wins it, or at least two turns
  if (n > 0 && playOut(newGame(L), turns(L), columns).won) return { why: "columns" };       // a chapter's first level only teaches its idea
  if (n > 0) for (let k = 1; k <= 3; k++) if (playOut(newGame(L), turns(L), randomly(k)).won) return { why: "random" };
  const g = playOut(newGame(L), turns(L), greedy).won, t = playOut(newGame(L), turns(L), think).won;
  const last = n >= BOOK[ch].length - 2;
  if (n >= 2 && g) return { why: "greedy" };
  if (last && t) return { why: "think" };
  return { par: sr.turns, plan: sr.plan, limit: L.limit, greedy: g, think: t };
}
function pick(ch, rec, n, tries = 60) {
  let best = null;
  for (let k = 0; k < tries; k++) {
    const seed = ch * 1000 + n * 97 + k * 13, L = levelFor(ch, rec, seed), r = rate(ch, rec, n, L);
    if (!r || r.why) continue;
    const off = Math.abs(r.par - rec.par);
    if (!best || off < best.off) best = { L, r, off, seed };
    if (off <= 1) break;
  }
  return best;
}

// ---------- the file ----------
const what = process.argv[2] || "all";
if (what === "survey" || what === "try") {
  const ch = +process.argv[3], tries = +(process.argv[what === "try" ? 5 : 4] || 12), list = what === "try" ? JSON.parse(process.argv[4]).map((r, i) => ({ name: `#${i + 1} ${JSON.stringify(r)}`, ...r })) : BOOK[ch];
  list.forEach((rec, n) => {
    const t0 = Date.now(), why = {};
    let ok = 0;
    const pars = [];
    for (let k = 0; k < tries; k++) { const L = levelFor(ch, rec, ch * 1000 + n * 97 + k * 13), r = rate(ch, rec, n, L); const w = !r ? "unsolved" : r.why || "ok"; why[w] = (why[w] || 0) + 1; if (r && !r.why) { ok++; pars.push(r.par); } }
    console.log(`${idOf(ch, n)} ${rec.name}: ${ok}/${tries} kept (pars ${pars.join(" ")}), ${JSON.stringify(why)} [${Math.round((Date.now() - t0) / tries)} ms each]`);
  });
  process.exit(0);
}
const file = new URL("settle-book.js", here), was = fs.existsSync(file) ? (await import(file.href + "?" + Date.now())).BOOK : [];
const only = what === "all" ? Object.keys(BOOK).map(Number) : what.split(",").map(Number);
const out = was.filter(L => !only.includes(L.ch)), missing = [];
for (const ch of only) BOOK[ch].forEach((rec, n) => {
  const got = pick(ch, rec, n);
  if (!got) { console.log(`${idOf(ch, n)} ${rec.name}: NONE`); missing.push(idOf(ch, n)); return; }
  out.push({ id: idOf(ch, n), name: rec.name, tip: rec.tip, ...got.L, limit: got.r.limit, par: got.r.par, plan: got.r.plan });
  console.log(`${idOf(ch, n)} ${rec.name}: par ${got.r.par} (aimed at ${rec.par}), greedy ${got.r.greedy ? "wins" : "loses"}, think ${got.r.think ? "wins" : "loses"}`);
});
out.sort((a, b) => a.ch - b.ch || +a.id.split("-")[1] - +b.id.split("-")[1]);
fs.writeFileSync(file, `// Settle's levels: made by settle-plan.mjs, never by hand (tests/settle-levels.mjs replays every plan at its par). A level is
// { id, name, tip, ch, cols, height, orders, goal, fuel, feats, solid, burn, burnAt?, start (stacks, bottom up; "Cu!" a solid copper),
// deal, limit (the turns it gives), par, plan }.
export const BOOK = [
${out.map(L => JSON.stringify(L)).join(",\n")},
];
`);
console.log(`written: ${out.length} levels${missing.length ? `; none found for ${missing.join(", ")}` : ""}`);
