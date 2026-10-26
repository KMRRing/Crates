// How common each way of routing a stream is across every optimal plan in the course: par for every level, crude and
// market (refinery-par.js). For a stream and a destination it can go to in a plan, par sends it the bulk of the stream
// (half or more), part of it, or none, and the share of plans that do the same is how standard that pattern is: every
// one of the 21 plans with alkylate sends it to gasoline, 53 of 56 send the bulk of the light gas oil to the diesel
// hydrotreater, 40 of 50 the bulk of the atmospheric residue to the vacuum unit, and only 3 of 67 the bulk of the
// kerosene to gas oil. The hint goes by it (Korbi, October 2026): of the ways a plan differs from par, the most
// standard first, so the obvious is put right before the fine-tuning.
import { LEVELS } from "./refinery-levels.js";
import { PAR } from "./refinery-par.js";
import { asPlayed, destinations, sharesOf, runs } from "./refinery-engine.js";

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
 * Where a plan differs from par, in the order a hint takes them: [{ s, d, mine, theirs, tier, same, count, n, p }].
 * Tier 0 is where the bulk of a stream goes: the shares fall in different classes (par sends the bulk somewhere and the
 * plan doesn't, or the reverse). Tier 1 is how much: one class, more than FINE apart. Tier 2 is a trim, closer than
 * that, which matters only where a plan sits on a limit (EPS). The first two tiers go by how common par's pattern is
 * (its class, or for how much its bucket), then by the gap; trims by the gap alone, since commonness can't tell them
 * apart.
 * `same`: the plan has par's bucket already and only the amount differs. Only the streams the plan makes (`flows`): one
 * it doesn't make yet comes up once the change upstream that makes it is in.
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
      out.push({ s, d, mine, theirs, tier, same: bucketOf(mine) === bucketOf(theirs), ...commonness(s, d, theirs, tier > 0) });
    }
  }
  const gap = x => Math.abs(x.theirs - x.mine);
  return out.sort((a, b) => a.tier - b.tier || (a.tier < 2 ? b.p - a.p : 0) || gap(b) - gap(a));
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

/** How standard a row of par's plan is: its main destination's (the largest share's) commonness. */
export function rowCommonness(s, row) {
  const [d, f] = Object.entries(row).sort((a, b) => b[1] - a[1])[0] || [];
  return d ? commonness(s, d, f) : { count: 0, n: 0, p: 0 };
}

/** A pattern's standing in words, by the share of optimal plans that follow it (as the hint rounds it, so a 90% shown is
 *  standard practice). */
export function standing(p) {
  const q = Math.round(100 * p);
  return q >= 90 ? "Standard practice" : q >= 70 ? "Very common" : q >= 50 ? "Common" : q >= 25 ? "Done in some plans" : "Particular to this plan";
}
