// How common each way of routing a stream is across every optimal plan in the course: par for every level, crude and
// market (refinery-par.js). For a stream and a destination it can go to in a plan, par sends it the bulk of the stream
// (half or more), part of it, or none, and the share of plans that do the same is how common that pattern is in the
// course: every one of the 21 plans with alkylate sends it to gasoline, 53 of 56 send the bulk of the light gas oil to
// the diesel hydrotreater, 44 of 61 the bulk of the atmospheric residue to the vacuum unit, and only 3 of 78 the bulk
// of the kerosene to gas oil. The hint goes by it (Korbi, October 2026): of the ways a plan differs from par, the most
// standard first, so the obvious is put right before the fine-tuning.
//
// What counts as practice is refining's, not the course's (Korbi, October 2026: the statements must make sense in the
// real world). The course's counts follow its levels: 25 of its 78 plans sink most of the kerosene into fuel oil
// (cutter for a sour residue, or no treater to take it), where a refinery treats it for jet or diesel and cuts fuel oil
// with only a share; its alkylation units and coker fill up, so only 6 of 24 plans send the bulk of the FCC's C4s to
// alkylation and 3 of 8 the bulk of the vacuum residue to the coker, both their usual homes; and 2 plans of 2 leaving
// rapeseed oil unbought make no practice at all. So each way a stream can go has its standing in refining (ROLES), the
// hint's words come from that, and the course's count is the number beside it.
import { LEVELS } from "./refinery-levels.js";
import { PAR } from "./refinery-par.js";
import { asPlayed, destinations, sharesOf, runs } from "./refinery-engine.js";

/**
 * How refineries route each stream, where they can: "home", where it goes as a rule when the unit or market is there;
 * "alt", a common outlet for much of it; "trim", a share up to a limit (a cutter in fuel oil, butenes to a vapour
 * pressure); "rare", seldom right. A pair left out makes no claim either way (buying a renewable feed or not is the
 * market's call, not practice), and the hint gives the course's count alone.
 */
export const ROLES = {
  gas: { gasPool: "home" },
  lpg: { lpg: "home" },
  butane: { lpg: "alt", gasoline: "alt" },                      // blended into petrol to its vapour pressure, the rest sold
  c4: { alky: "home", mtbeUnit: "home", lpg: "alt", gasoline: "trim" },
  raff: { alky: "home", lpg: "alt", gasoline: "trim" },
  propylene: { propylene: "home", cumeneUnit: "home" },
  lsr: { isom: "home", naphtha: "alt", gasoline: "alt", slops: "rare" },   // no isomerisation: petrochemicals or petrol
  hsr: { nht: "home", naphtha: "alt", gasoline: "rare", slops: "rare" },   // untreated, unreformed: far too low in octane
  hsrT: { reformer: "home", srReformer: "home", naphtha: "alt", gasoline: "rare" },
  reformate: { gasoline: "home", bzhc: "home" },
  bzCut: { naphtha: "home", gasoline: "trim" },                 // a quarter benzene: petrol takes 1%
  heavyReformate: { gasoline: "home" },
  isomerate: { gasoline: "home", naphtha: "rare" },
  alkylate: { gasoline: "home" },
  mtbe: { gasoline: "home" },
  etbe: { gasoline: "home" },
  ethanol: { gasoline: "home" },
  catNaphtha: { cnht: "home", gasoline: "alt" },                // straight in only off a hydrotreated feed
  catNaphthaT: { gasoline: "home" },
  lcn: { gasoline: "home", cnht: "alt" },
  lcnT: { gasoline: "home" },
  icn: { nht: "home" },
  hcn: { kht: "home" },
  hcNaphtha: { nht: "home", naphtha: "alt", gasoline: "trim" }, // reformer feed or a prized cracker feed; octane in the sixties
  cokerNaphtha: { nht: "home", gasoline: "rare" },              // olefinic and sour: never untreated into petrol
  kero: { merox: "home", kht: "home", lpHt: "alt", dht: "alt", dht2: "alt", gasoil: "alt", diesel: "trim", fuelOil: "trim", hsfo: "trim", jet: "rare", slops: "rare" },
  jet: { jet: "home", diesel: "alt", gasoil: "rare" },
  hcJet: { jet: "home", diesel: "alt", gasoil: "rare" },
  spk: { jet: "home" },
  lgo: { dht: "home", dht2: "home", lpHt: "home", hds: "home", hght: "alt", gasoil: "alt", fuelOil: "trim", hsfo: "trim", diesel: "rare", slops: "rare" },
  hgo: { dht: "alt", dht2: "alt", hght: "alt", hds: "alt", hcu: "alt", fcc: "alt", gasoil: "alt", fuelOil: "alt", hsfo: "trim", diesel: "rare", slops: "rare" },
  ulsd: { diesel: "home", fuelOil: "trim", gasoil: "rare", hsfo: "rare" },
  hcDiesel: { diesel: "home", gasoil: "rare" },
  goT: { gasoil: "home", dht: "home", diesel: "rare", fuelOil: "rare", hsfo: "rare" },
  mhcGo: { gasoil: "alt", hght: "alt", diesel: "rare", fuelOil: "rare", hsfo: "rare" },
  lco: { dht: "alt", lpHt: "alt", hght: "alt", gasoil: "alt", fuelOil: "alt", hsfo: "alt", diesel: "rare" },   // cetane in the 20s: as much diesel as that allows, the rest heating oil or cutter
  lcgo: { dht: "alt", hds: "alt", gasoil: "alt", fuelOil: "trim", hsfo: "trim", diesel: "rare" },
  hcgo: { fuelOil: "home", hsfo: "home" },
  slurry: { fuelOil: "home", hsfo: "home" },
  fuelOilCutter: { hght: "home", dht: "home", hsfo: "alt", fuelOil: "trim", diesel: "rare" },
  cokerGo: { dht: "home", hcu: "home", fcc: "alt", hsfo: "alt", diesel: "rare", gasoil: "rare" },
  lvgo: { fcc: "home", hcu: "home", vgoHt: "home", vgoHt2: "home", lpHt: "alt", hds: "alt", fuelOil: "alt", vgoExport: "alt" },
  hvgo: { fcc: "home", hcu: "home", vgoHt: "home", vgoHt2: "home", fuelOil: "alt", vgoExport: "alt" },
  vgoT: { fcc: "home", fuelOil: "alt", vgoExport: "alt", hsfo: "rare" },
  importVgo: { hcu: "home", fuelOil: "rare", hsfo: "rare" },
  importVgoT: { fcc: "home" },
  dao: { vgoHt: "home", vgoHt2: "home", fuelOil: "rare", hsfo: "rare" },
  atmResid: { vdu: "home", fuelOil: "alt", hsfo: "alt", slops: "rare" },   // sweet residue is a VLSFO stock; a hydroskimmer sells it as fuel oil
  vacResid: { visbreaker: "home", coker: "home", blowing: "home", igcc: "alt", hsfo: "alt", fuelOil: "alt" },
  visResid: { sda: "home", hsfo: "home", igcc: "alt" },
  asphalt: { igcc: "home", hsfo: "alt", fuelOil: "rare" },
  coke: { coke: "home" },
  bitumen: { bitumen: "home" },
  cumene: { cumene: "home" },
  power: { power: "home" },
  fame: { diesel: "home" },
  hvo: { diesel: "home", hvo100: "home", safUnit: "alt", gasoil: "rare" },
  vegOil: { hvoUnit: "home" },
  // co-processing fats, tall oil or pyrolysis oil in a fossil unit is done by some refineries, practice in none: no claim
};
/** A pair's standing in refining, or null where it makes no claim. */
export const roleOf = (s, d) => ROLES[s]?.[d] || null;
/** The destination a row sends the most to. */
export const mainOf = row => Object.entries(row || {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
/**
 * What refining makes of sending `share` of a stream to a destination, par's whole row beside it and the stream's
 * destinations in the level (`here`): "standard" (its home, or none to where it rarely goes), "common", "usual" (none to
 * its home, the bulk going somewhere that isn't one), "share" (the bulk where only a share usually goes, with a home in
 * reach: a topping plant has nowhere better for its gas oils than fuel oil), "rare", or null (no claim, as when par
 * leaves a feed unbought: that's the market's call). Its tier orders a hint: the standard first, then the common, the
 * unclaimed, and what refining wouldn't do last.
 */
export function practiceOf(s, d, share, parRow, here = null) {
  const role = roleOf(s, d), cls = classOf(share), main = mainOf(parRow);
  if (!role || (cls === "none" && main === "notBought")) return { kind: null, tier: 2 };
  const homeHere = !here || here.some(x => x !== d && roleOf(s, x) === "home");
  const kind = role === "home" ? (cls === "bulk" ? "standard" : cls === "part" ? "common" : roleOf(s, main) === "home" ? "common" : "usual")
    : role === "alt" ? "common"
    : role === "trim" ? (cls !== "bulk" ? "common" : homeHere ? "share" : null)
    : cls === "none" ? "standard" : "rare";
  return { kind, tier: kind ? { standard: 0, common: 1, usual: 3, share: 3, rare: 3 }[kind] : 2 };
}

/** A share's class: the bulk of a stream (half or more), part of it, or none of it. */
export const classOf = f => (f >= 0.5 ? "bulk" : f > 0.005 ? "part" : "none");
/** Finer: all of it, most, part or none (for the fine-tuning once the classes agree). */
export const bucketOf = f => (f >= 0.995 ? "all" : f >= 0.5 ? "most" : f > 0.005 ? "part" : "none");
/** Shares this close in one class differ by a trim, not by how much: a slider's nudge. */
export const FINE = 0.05;
/** Shares this close are the same. Anything wider can matter: par blends to its limits and fills its units, and a plan a
 *  few thousandths of a point off it can spill a full unit's excess into fuel oil (8.1's hydrocracker), and three
 *  hundredths of a point more butane lift petrol's vapour pressure over its limit (12.1). */
export const EPS = 1e-9;

let table = null;
/** { stream: { destination: { n, all, most, part, none } } }: of the optimal plans in which the stream flows and can go
 *  to the destination, how many send it all, most, part or none of it. */
export function practice() {
  if (table) return table;
  table = {};
  for (const lv of LEVELS) for (const [key, p] of Object.entries(PAR[lv.id] || {})) {
    const [crude, deck = null] = key.split("/"), L = asPlayed(lv, crude, deck);
    for (const [s, r] of Object.entries(p.routing)) for (const d of destinations(L, s)) {
      const t = ((table[s] ||= {})[d] ||= { n: 0, all: 0, most: 0, part: 0, none: 0 });
      t.n++;
      t[bucketOf(r[d] || 0)]++;
    }
  }
  return table;
}

/** How common it is for an optimal plan to send this share of a stream to a destination, by the share's class (or its
 *  finer bucket): { count, n, p } over the plans in which the stream can go there. */
export function commonness(s, d, f, fine = false) {
  const t = practice()[s]?.[d];
  if (!t) return { count: 0, n: 0, p: 0 };
  const count = fine ? t[bucketOf(f)] : { bulk: t.all + t.most, part: t.part, none: t.none }[classOf(f)];
  return { count, n: t.n, p: count / t.n };
}

/**
 * Where a plan differs from par, in the order a hint takes them: [{ s, d, mine, theirs, tier, same, practice, count, n,
 * p }]. Tier 0 is where the bulk of a stream goes: the shares fall in different classes (par sends the bulk somewhere
 * and the plan doesn't, or the reverse); these go by what refining makes of par's pattern (`practice`: the standard
 * first, what refining wouldn't do last), then by how common it is in the course. Tier 1 is how much: one class, more
 * than FINE apart, by how common par's bucket is in the course. Tier 2 is a trim, closer than that, which matters only
 * where a plan sits on a limit (EPS), by the gap alone, since commonness can't tell trims apart. Ties go to the bigger
 * gap. `same`: the plan has par's bucket already and only the amount differs. Only the streams the plan makes
 * (`flows`): one it doesn't make yet comes up once the change upstream that makes it is in.
 */
export function differences(level, routing, parRouting, flows = () => true) {
  const out = [];
  for (const s of Object.keys(parRouting)) {
    if (!flows(s)) continue;
    const mineRow = Object.fromEntries(sharesOf(level, routing, s)), theirsRow = Object.fromEntries(sharesOf(level, parRouting, s));
    for (const d of destinations(level, s)) {
      const mine = mineRow[d] || 0, theirs = theirsRow[d] || 0, gap = Math.abs(mine - theirs);
      if (gap <= EPS) continue;
      const tier = classOf(mine) !== classOf(theirs) ? 0 : gap > FINE ? 1 : 2;
      out.push({ s, d, mine, theirs, tier, same: bucketOf(mine) === bucketOf(theirs), practice: tier ? null : practiceOf(s, d, theirs, theirsRow, destinations(level, s)), ...commonness(s, d, theirs, tier > 0) });
    }
  }
  const gap = x => Math.abs(x.theirs - x.mine);
  return out.sort((a, b) => a.tier - b.tier || (a.tier ? 0 : a.practice.tier - b.practice.tier) || (a.tier < 2 ? b.p - a.p : 0) || gap(b) - gap(a));
}

/** A plan that runs this near par's margin is at par (three stars). */
export const AT_PAR = 0.1;

/**
 * What a hint points at from a plan (`run` its evaluation): the crude, where the level's choice of crude has one whose
 * par is better (`best`: { crude, margin }), since no routing of a worse one reaches the level's par; nothing once the
 * plan runs at par; else the first of the differences ({ x }, null when there's none left to name).
 */
export function nextHint(level, routing, run, par, best = null) {
  if (best && best.crude !== level.crude && best.margin - par.margin > AT_PAR) return { crude: best.crude };
  if (runs(run) && run.margin >= par.margin - AT_PAR) return { atPar: true };
  return { x: differences(level, routing, par.routing, s => run.streams[s]?.vol > 1e-6)[0] || null };
}

/** How standard a row of par's plan is, by its main destination (the largest share): what refining makes of it
 *  (`tier`, as differences orders them; `here` the stream's destinations in the level) and how common it is in the
 *  course ({ count, n, p }). */
export function rowCommonness(s, row, here = null) {
  const d = mainOf(row);
  return d ? { ...commonness(s, d, row[d]), tier: practiceOf(s, d, row[d], row, here).tier } : { count: 0, n: 0, p: 0, tier: 2 };
}
