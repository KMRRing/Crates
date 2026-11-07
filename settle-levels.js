// Settle's levels: nine, three to a tier (settle-alloys.js's TIERS), each a fixed melt dealt from a seed, found by a search
// that knows the whole deal (settle-solve.js's search, over the seeds of each level, taking the one where a bot that sees only
// the two parcels offered most falls short of the best plan). par is the fewest turns that search found; plan is its turns,
// [slot, crucible] (slot -1: a skim), which tests/settle-levels.mjs replays. Three stars for par, two for a third more, one
// for any win. In a tier, the first level has one order, the second adds the next, the third has them all in a crucible one
// level shorter; a level opens when the one before has a star.
import { TIERS, RECIPES } from "./settle-alloys.js";
import { draw, newGame } from "./settle-engine.js";
import { playOut } from "./settle-solve.js";

export const LEVELS = [
{"id":1,"tier":1,"name":"Plumber's solder","note":"Pour a parcel into a crucible. Tin floats on lead: put a tin and a lead side by side at the same level and the solder is cast.","cols":3,"height":8,"orders":["plumber"],"goal":4,"seed":1102,"par":8,"plan":[[0,0],[0,1],[0,0],[0,1],[0,0],[0,1],[0,0],[1,1]]},
{"id":2,"tier":1,"name":"Fine solder","note":"A second order, three crucibles wide: two tin to one lead, all at one level.","cols":3,"height":8,"orders":["plumber","fine"],"goal":6,"seed":1221,"par":12,"plan":[[0,0],[1,1],[0,0],[0,1],[0,0],[1,1],[0,0],[0,1],[0,0],[0,1],[0,0],[0,1]]},
{"id":3,"tier":1,"name":"Both orders","note":"A shorter crucible and a goal of eight. What was above a cast drops, and can line up again.","cols":3,"height":7,"orders":["plumber","fine"],"goal":8,"seed":1316,"par":16,"plan":[[0,0],[0,1],[0,0],[0,0],[0,1],[0,1],[0,0],[0,1],[0,0],[0,1],[0,0],[0,1],[0,0],[0,1],[0,0],[0,1]]},
{"id":4,"tier":2,"name":"Soft solder","note":"Orders are two levels tall now: all eight parcels of the block, five tin to three lead, in any arrangement.","cols":4,"height":7,"orders":["solder"],"goal":2,"seed":2107,"par":25,"plan":[[0,0],[0,0],[0,1],[0,2],[0,2],[0,1],[0,1],[0,1],[0,1],[0,3],[0,3],[0,0],[0,0],[0,0],[0,2],[0,2],[0,3],[0,0],[0,3],[0,2],[0,3],[0,1],[0,2],[0,0],[0,3]]},
{"id":5,"tier":2,"name":"Lay pewter","note":"A second two-level order: seven tin to one lead.","cols":4,"height":7,"orders":["solder","lay"],"goal":3,"seed":2204,"par":24,"plan":[[0,0],[0,0],[0,1],[0,1],[0,2],[0,2],[0,3],[0,0],[0,3],[0,0],[0,1],[0,1],[0,2],[0,2],[0,3],[0,3],[0,0],[0,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3]]},
{"id":6,"tier":2,"name":"Both orders","note":"A shorter crucible and a goal of four. The block can stand at any two levels.","cols":4,"height":6,"orders":["solder","lay"],"goal":4,"seed":2304,"par":32,"plan":[[0,0],[0,0],[0,1],[0,1],[0,2],[0,2],[0,3],[0,3],[0,0],[0,0],[0,1],[0,1],[0,2],[0,2],[0,3],[0,3],[0,0],[0,0],[0,1],[0,1],[0,2],[0,2],[1,3],[1,3],[0,0],[1,0],[1,1],[1,1],[1,2],[1,2],[1,3],[1,3]]},
{"id":7,"tier":3,"name":"Brass","note":"Copper and zinc, two to one. Zinc is the lightest metal here, so it lies on top: left there six pours it burns to dross.","cols":4,"height":7,"orders":["brass"],"goal":4,"seed":3108,"par":13,"plan":[[0,0],[0,1],[0,0],[0,0],[0,0],[0,1],[0,2],[0,0],[0,1],[0,2],[0,1],[0,2],[0,2]]},
{"id":8,"tier":3,"name":"Prince's metal","note":"Dross floats and matches no order. Skim it off a crucible's top: that costs a turn.","cols":4,"height":7,"orders":["brass","prince"],"goal":6,"seed":3208,"par":18,"plan":[[0,0],[0,1],[0,2],[0,0],[0,1],[0,2],[0,0],[0,1],[1,2],[0,0],[0,1],[1,2],[0,0],[0,1],[0,0],[0,2],[0,1],[1,2]]},
{"id":9,"tier":3,"name":"Tombac","note":"Five copper to one zinc, two levels tall; a shorter crucible and a goal of eight.","cols":4,"height":6,"orders":["brass","prince","tombac"],"goal":8,"seed":3316,"par":25,"plan":[[0,0],[0,1],[0,0],[0,0],[0,0],[0,1],[0,1],[0,2],[0,2],[0,2],[0,1],[0,0],[0,0],[0,3],[0,1],[0,2],[0,2],[0,1],[0,2],[1,0],[0,1],[0,2],[0,0],[0,1],[0,2]]}
];

export const levelOf = id => LEVELS.find(L => L.id === id);
/** A level's melt, as newGame takes it. */
export const specOf = L => ({ cols: L.cols, height: L.height, orders: L.orders, goal: L.goal, lv: L.id });
export const starsFor = (L, turns) => (turns <= L.par ? 3 : turns <= Math.ceil(L.par * 4 / 3) ? 2 : 1);
/** Whether a level is open, given what is done ({ id: { stars, turns } }): the first, and any after one with a star. */
export const isOpen = (id, done) => id === 1 || (done[id - 1]?.stars || 0) > 0;

const pick = (list, seed, n) => list[Math.floor(draw(seed, n) * list.length)];
/** The recipes of a metal family: the pewterers' (tin and lead) or the brass founders' (copper and zinc). One melt keeps to one family, so the crucibles are not clogged with a metal no standing order wants. */
const familyOf = id => (RECIPES[id].parts.Sn ? "pewter" : "brass");
/** A goal of casts for orders of the sizes given, so a melt is about `parcels` parcels long. */
const goalFor = (orders, parcels) => Math.max(2, Math.min(8, Math.round(parcels / (orders.reduce((a, id) => a + RECIPES[id].n, 0) / orders.length))));
/** Some of a pool as standing orders, drawn by a seed (from draw number `from`). */
function drawOrders(pool, want, seed, from) {
  const orders = [];
  for (let k = 0; orders.length < Math.min(want, pool.length) && k < 60; k++) { const id = pick(pool, seed, from + k); if (!orders.includes(id)) orders.push(id); }
  return orders;
}
/** The spec with its goal lowered until the bot (two parcels in sight, two pours ahead) wins it, so a good planner always can. */
function winnable(spec, seed) {
  for (let goal = spec.goal; goal > 2; goal--) if (playOut(newGame({ ...spec, goal }, seed), 150).won) return { ...spec, goal };
  return { ...spec, goal: 2 };
}
/**
 * A random melt at a level of the hidden ramp (the level's id): two or three standing orders of one metal family, drawn from
 * the recipes of the tiers up to its own whose block fits its crucibles, a goal of casts in proportion, the parcels dealt to
 * favour what the orders need.
 */
export function randomSpec(levelId, seed) {
  const L = levelOf(levelId) ?? LEVELS[0], pool = TIERS.filter(t => t.id <= L.tier).flatMap(t => t.orders).filter(id => RECIPES[id].w <= L.cols);
  const family = pick([...new Set(pool.map(familyOf))], seed, 0), orders = drawOrders(pool.filter(id => familyOf(id) === family), L.orders.length === 1 ? 2 : L.orders.length, seed, 1);
  return winnable({ cols: L.cols, height: L.height, orders, goal: goalFor(orders, 24 + 2 * (L.tier - 1)), lv: 0 }, seed);
}
/** Today's melt: the same on every device (the day is the seed), three standing orders of one family, from every recipe that fits four crucibles. */
export function dailySpec(day) {
  const seed = Number(day) * 7 + 13, pool = TIERS.flatMap(t => t.orders).filter(id => RECIPES[id].w <= 4), family = pick(["pewter", "brass"], seed, 99);
  const orders = drawOrders(pool.filter(id => familyOf(id) === family), 3, seed, 100);
  return { spec: winnable({ cols: 4, height: 7, orders, goal: goalFor(orders, 30), lv: 0 }, seed), seed };
}
