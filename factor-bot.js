// Factor's computer players, from what their seat may see (its own hand and cards, the board, everyone's points without
// hidden patents, how many cards the others hold, and what a player counting cards would know of their hands).
// Medium plans by the numbers: where to build (pips, a resource it lacks, a harbour), the best thing its hand can pay for
// or reach with the bank, one offer to the table a turn, the blockade on the leader. Hard weighs every legal move by the
// position it leaves (below), trades with the table as a strong player does, and looks ahead at its setup posts. Every
// move is tried against the rules before it is given, and a refused one is replaced by a plain legal move, so a computer
// player never stops the table.
import { RES, HEXES, VERTS, EDGES, PORT_AT, pips, otherEnd, portVerts } from "./factor-board.js";
import { rules, COSTS, MAX_OFFERS, bankOf, cards, has, piecesLeft, postSpots, factorySpots, roadSpots, roadLength, pointsOf, playable, rates, victims, setupOrder } from "./factor-rules.js";

export const LEVEL_NAMES = [["medium", "Medium"], ["hard", "Hard"]];
const sum = a => a.reduce((t, x) => t + x, 0);
const ZERO = () => [0, 0, 0, 0, 0];

/** The pips of production a seat has in each resource (a factory counts twice). */
export function production(s, seat) {
  const out = ZERO();
  for (let v = 0; v < VERTS.length; v++) {
    if (s.vo[v] !== seat + 1) continue;
    for (const h of VERTS[v].hexes) if (s.kind[h] < 5) out[s.kind[h]] += pips(s.num[h]) * s.vl[v];
  }
  return out;
}
const vertexPips = (s, v) => VERTS[v].hexes.reduce((t, h) => t + (s.kind[h] < 5 ? pips(s.num[h]) : 0), 0);

/** How good a corner is for a post: its pips, a resource the seat doesn't make yet, a harbour it can use. */
export function spotScore(s, seat, v, owned = production(s, seat)) {
  let score = vertexPips(s, v);
  const kinds = new Set(VERTS[v].hexes.filter(h => s.kind[h] < 5 && pips(s.num[h])).map(h => s.kind[h]));
  score += [...kinds].filter(r => owned[r] === 0).length * 1.6;
  const pi = PORT_AT.findIndex((_, i) => portVerts(i).includes(v));
  if (pi >= 0) {
    const k = s.ports[pi];
    score += k === "any" ? 1.2 : 0.5 + (owned[k] + VERTS[v].hexes.filter(h => s.kind[h] === k).reduce((t, h) => t + pips(s.num[h]), 0)) * 0.25;
  }
  return score;
}

/** The best open post spot within four roads of a corner, its score less a quarter for each road to get there: walking over empty roads, never through another's building. */
function nearestSpot(s, seat, from, open, owned) {
  let best = 0, frontier = [from];
  const seen = new Set([from]);
  for (let d = 0; d <= 3 && frontier.length; d++) {
    const next = [];
    for (const v of frontier) {
      if (open.has(v)) best = Math.max(best, spotScore(s, seat, v, owned) * 0.75 ** d);
      if (s.vo[v] && s.vo[v] !== seat + 1) continue;
      for (const e of VERTS[v].edges) {
        const w = otherEnd(e, v);
        if (s.eo[e] && s.eo[e] !== seat + 1 || seen.has(w)) continue;
        seen.add(w); next.push(w);
      }
    }
    frontier = next;
  }
  return best;
}

const pickTop = (list, key, rng, top = 1) => {
  const sorted = list.map(x => ({ x, k: key(x) })).sort((a, b) => b.k - a.k);
  return sorted[Math.min(sorted.length - 1, Math.floor(rng() * top))].x;
};
const pick = (list, rng) => list[Math.floor(rng() * list.length)];

// ---------- what to work towards ----------
/** Things worth building, best first: { what, at, cost, value }. */
export function plans(s, seat) {
  const left = piecesLeft(s, seat), owned = production(s, seat), list = [];
  if (left.post > 0) {
    for (const v of postSpots(s, seat)) list.push({ what: "post", at: v, cost: COSTS.post, value: 10 + spotScore(s, seat, v, owned) * 0.5 });
  }
  if (left.factory > 0) {
    for (const v of factorySpots(s, seat)) list.push({ what: "factory", at: v, cost: COSTS.factory, value: 8.5 + vertexPips(s, v) * 0.7 });
  }
  if (s.deck.length) list.push({ what: "dev", at: -1, cost: COSTS.dev, value: 6 });
  if (left.road > 0) {
    const open = new Set(postSpots(s, seat, { setup: true }));            // corners a post could stand on if a road reached them
    const len = roadLength(s, seat);
    const net = new Set();                                                // corners already joined to this seat's roads or buildings
    for (let e = 0; e < EDGES.length; e++) if (s.eo[e] === seat + 1) { net.add(EDGES[e].a); net.add(EDGES[e].b); }
    for (let v = 0; v < VERTS.length; v++) if (s.vo[v] === seat + 1) net.add(v);
    for (const e of roadSpots(s, seat)) {
      const { a, b } = EDGES[e];
      let value = 2;
      for (const w of [a, b]) if (!net.has(w)) value = Math.max(value, 3 + nearestSpot(s, seat, w, open, owned) * 0.4);
      {                                                                   // a road that makes or takes the longest road
        s.eo[e] = seat + 1;
        const after = roadLength(s, seat);
        s.eo[e] = 0;
        if (after >= 5 && after > len && s.longest !== seat) value += 5 + (after - Math.max(4, s.longLen)) * 0.5;
        else if (after > len) value += 0.4;
      }
      list.push({ what: "road", at: e, cost: COSTS.road, value });
    }
  }
  return list.sort((p, q) => q.value - p.value);
}

/** Resources a hand lacks for a cost. */
const lack = (hand, cost) => cost.map((c, i) => Math.max(0, c - hand[i]));
/** What a hand has beyond a cost, for trading away. */
const spare = (hand, cost) => hand.map((h, i) => Math.max(0, h - cost[i]));

/** One bank trade that moves a hand towards a cost, or null. */
function bankStep(s, seat, cost) {
  const r = rates(s, seat), lacks = lack(s.hand[seat], cost), spares = spare(s.hand[seat], cost);
  const want = lacks.findIndex(n => n > 0);
  if (want < 0 || bankOf(s, want) < 1) return null;
  let give = -1;
  for (let g = 0; g < 5; g++) if (g !== want && spares[g] >= r[g] && (give < 0 || spares[g] - r[g] > spares[give] - r[give])) give = g;
  return give < 0 ? null : { t: "bank", give, get: want };
}
/** Whether the bank alone could cover a cost from this hand (so it's worth starting). */
function bankReach(s, seat, cost) {
  const r = rates(s, seat), lacks = lack(s.hand[seat], cost), spares = spare(s.hand[seat], cost);
  let rest = sum(lacks);
  const pool = spares.map((n, g) => Math.floor(n / r[g]));
  for (let i = 0; i < 5 && rest > 0; i++) { while (pool[i] > 0 && rest > 0) { pool[i]--; rest--; } }
  return rest === 0;
}

// ---------- the moves ----------
function setupPost(s, seat, rng) {
  const owned = production(s, seat), spots = postSpots(s, seat, { setup: true });
  const v = pickTop(spots, w => spotScore(s, seat, w, owned), rng);
  return { t: "build", what: "post", at: v };
}
function setupRoad(s, seat, rng) {
  const from = s.last, owned = production(s, seat);
  const open = new Set(postSpots(s, seat, { setup: true }));
  const edges = roadSpots(s, seat, from);
  const value = e => {
    const w = otherEnd(e, from);
    let best = 0;
    for (const u of [w, ...VERTS[w].adj]) if (u !== from && open.has(u) && !VERTS[from].adj.includes(u)) best = Math.max(best, spotScore(s, seat, u, owned) * (u === w ? 1 : 0.8));
    return best;
  };
  return { t: "build", what: "road", at: pickTop(edges, value, rng) };
}

/** The hex to put the blockade on: where it costs others most and the seat least. */
function blockadeHex(s, seat, rng) {
  const hexes = HEXES.map((_, h) => h).filter(h => h !== s.robber);
  const value = h => {
    let t = 0;
    const p = pips(s.num[h]);
    for (const v of HEXES[h].corners) {
      const o = s.vo[v] - 1;
      if (o < 0) continue;
      if (o === seat) t -= p * s.vl[v] * 1.6;
      else t += p * s.vl[v] * (1 + pointsOf(s, o, false) / 6) + (cards(s, o) > 0 ? 0.5 : 0);
    }
    return t + rng() * 0.1;
  };
  return pickTop(hexes, value, rng);
}
function whomToRob(s, seat, rng) {
  const who = victims(s, s.robber, seat);
  return pickTop(who, o => pointsOf(s, o, false) * 3 + cards(s, o), rng);
}

/** What to give up on a 7: what the best plan needs least. */
function discard(s, seat, rng) {
  const hand = [...s.hand[seat]], n = s.owe[seat], goal = plans(s, seat)[0]?.cost || ZERO(), out = ZERO();
  for (let i = 0; i < n; i++) {
    let r = 0, best = -Infinity;
    for (let k = 0; k < 5; k++) { const v = hand[k] > 0 ? hand[k] - goal[k] + rng() * 0.1 : -Infinity; if (v > best) { best = v; r = k; } }
    hand[r]--; out[r]++;
  }
  return { t: "discard", n: out };
}

/** Whether to take an offer: it must bring something the seat's plans need and cost it only what it can spare. */
function answer(s, seat) {
  const o = s.offer, hand = s.hand[seat];
  const mustGive = o.get, gets = o.give;                          // what this seat would give, and receive
  if (!has(hand, mustGive)) return { t: "answer", yes: false };
  const goal = plans(s, seat).find(p => bankReach(s, seat, p.cost) || has(hand, p.cost) || sum(lack(hand, p.cost)) <= 2) || plans(s, seat)[0];
  const cost = goal?.cost || ZERO();
  const spares = spare(hand, cost), lacks = lack(hand, cost);
  const costsNeeded = mustGive.some((n, i) => n > spares[i]);
  const helps = gets.some((n, i) => n > 0 && lacks[i] > 0);
  const lead = pointsOf(s, o.from, false);
  if (lead >= s.opts.vp - 3) return { t: "answer", yes: false };
  return { t: "answer", yes: helps && !costsNeeded && sum(gets) >= sum(mustGive) };
}

/** A card worth playing now, or null. */
function cardMove(s, seat, roll) {
  const mine = playable(s, seat);
  if (!mine.length || s.playedDev) return null;
  const owned = production(s, seat);
  if (mine.includes("privateer")) {
    const onMine = HEXES[s.robber].corners.some(v => s.vo[v] === seat + 1) && pips(s.num[s.robber]) >= 4;     // it sits on one of ours, and not on a dud number
    const fleet = s.played[seat] + 1 >= 3 && s.played[seat] + 1 > s.armyN;
    if (onMine || fleet) return { t: "play", card: "privateer" };
  }
  if (roll) return null;
  const goal = plans(s, seat)[0];
  if (mine.includes("windfall") && goal) {
    const lacks = lack(s.hand[seat], goal.cost), n = sum(lacks);
    if (n >= 1 && n <= 2) {
      const res = [];
      lacks.forEach((c, r) => { for (let i = 0; i < c && res.length < 2; i++) res.push(r); });
      while (res.length < 2) res.push(lacks.findIndex(c => c > 0) >= 0 ? lacks.findIndex(c => c > 0) : 3);
      if (res.every((r, i) => bankOf(s, r) >= 1 + (res.indexOf(r) !== i ? 1 : 0))) return { t: "play", card: "windfall", res };
    }
  }
  if (mine.includes("corner")) {
    const others = s.hand.reduce((t, h, i) => (i === seat ? t : t + sum(h)), 0);
    const r = [0, 1, 2, 3, 4].map(k => ({ k, w: (goalNeed(s, seat, k)) })).sort((a, b) => b.w - a.w)[0];
    if (r.w >= 2 && others >= 7) return { t: "play", card: "corner", res: r.k };
  }
  if (mine.includes("causeway") && piecesLeft(s, seat).road >= 2) {
    const roads = plans(s, seat).filter(p => p.what === "road");
    if (roads[0] && roads[0].value >= 6) return { t: "play", card: "causeway" };
  }
  return null;
}
const goalNeed = (s, seat, r) => { const g = plans(s, seat)[0]; return g ? Math.max(0, g.cost[r] - s.hand[seat][r]) : 0; };

function mainMove(s, seat) {
  const hand = s.hand[seat];
  const card = cardMove(s, seat, false);
  if (card) return card;
  const list = plans(s, seat);
  // the best thing the hand can pay for, or reach by trading
  for (const p of list) {
    if (p.value < 3 && !(p.value >= 2 && cards(s, seat) >= 8)) break;      // a road to nowhere only to keep from holding cards a 7 would take
    if (has(hand, p.cost)) return p.what === "dev" ? { t: "buy" } : { t: "build", what: p.what, at: p.at };
    if (bankReach(s, seat, p.cost)) { const step = bankStep(s, seat, p.cost); if (step) return step; }
  }
  // one short of the best plan: ask the table (once a turn)
  const goal = list.find(p => p.value >= 6 && sum(lack(hand, p.cost)) <= 2);
  if (goal && s.offers === 0 && s.offers < MAX_OFFERS) {
    const lacks = lack(hand, goal.cost), spares = spare(hand, goal.cost);
    const want = lacks.findIndex(n => n > 0), give = spares.map((n, r) => ({ r, n })).filter(x => x.n > 0 && x.r !== want).sort((a, b) => b.n - a.n)[0];
    if (want >= 0 && give) {
      const g = ZERO(), w = ZERO();
      g[give.r] = 1; w[want] = 1;
      return { t: "offer", give: g, get: w };
    }
  }
  return { t: "end" };
}

/** A computer player's move for its seat at this state. */
export function botMove(s, seat, { level = "medium", rng = Math.random } = {}) {
  let move;
  try { move = level === "hard" ? think(s, seat, rng) : decide(s, seat, rng); } catch (e) { console.error(e); move = null; }
  const probe = () => { try { return move && typeof rules.act(JSON.parse(JSON.stringify(s)), seat, move, { rng: () => 0.5, now: 0 }) !== "string"; } catch { return false; } };
  return probe() ? move : plain(s, seat, rng);
}

function decide(s, seat, rng) {
  switch (s.step) {
    case "setup": return s.part === "post" ? setupPost(s, seat, rng) : setupRoad(s, seat, rng);
    case "roll": return cardMove(s, seat, true) || { t: "roll" };
    case "discard": return discard(s, seat, rng);
    case "blockade": return { t: "blockade", hex: blockadeHex(s, seat, rng) };
    case "steal": return { t: "steal", from: whomToRob(s, seat, rng) };
    case "causeway": {
      const road = plans(s, seat).find(p => p.what === "road");
      return road ? { t: "build", what: "road", at: road.at } : { t: "skip" };
    }
    case "offer": return answer(s, seat);
    case "pick": {
      const yes = s.offer.resp.map((r, i) => (r === 1 ? i : -1)).filter(i => i >= 0);
      return { t: "pick", with: pickTop(yes, i => -pointsOf(s, i, false), rng) };
    }
    default: return mainMove(s, seat);
  }
}

/** The plainest legal move for the step, for when the one chosen is refused. */
function plain(s, seat, rng) {
  switch (s.step) {
    case "setup": {
      if (s.part === "post") return { t: "build", what: "post", at: pick(postSpots(s, seat, { setup: true }), rng) };
      return { t: "build", what: "road", at: pick(roadSpots(s, seat, s.last), rng) };
    }
    case "roll": return { t: "roll" };
    case "discard": return discardAny(s, seat);
    case "blockade": return { t: "blockade", hex: HEXES.findIndex((_, h) => h !== s.robber) };
    case "steal": return { t: "steal", from: victims(s, s.robber, seat)[0] };
    case "causeway": return { t: "skip" };
    case "offer": return { t: "answer", yes: false };
    case "pick": return { t: "pick", with: -1 };
    default: return { t: "end" };
  }
}
function discardAny(s, seat) {
  const n = [0, 0, 0, 0, 0];
  let left = s.owe[seat];
  for (let r = 0; r < 5 && left > 0; r++) { const k = Math.min(left, s.hand[seat][r]); n[r] = k; left -= k; }
  return { t: "discard", n };
}

// ---------- Hard: every move weighed by the position it leaves ----------
// A position is worth, to a seat: its points first and far above all else; then what its land makes a turn (each
// resource's pips, the scarcer on this island the dearer, more for a new kind than another of the same), less what the
// others make (the leaders' most); the best corners it could build on soon (one road away, two); how near its hand is
// to a post or a factory; its harbours, its road, its fleet and its cards; less the risk of holding more than seven.
// Every legal move this turn (each build, each bank trade, each card it could play) is tried on a copy and the best
// position taken, ending the turn when nothing beats standing still. It counts the cards, as a strong player does, so it
// knows what a Corner would bring in and whom a Privateer should rob.
/** How far it looks ahead: candidates weighed, turns played on, futures for each. */
/** How it trades with the table: the least gain worth asking for, the least worth accepting, and how much more it must gain than they do. */
export const TRADE = { ask: 3, take: 2, edge: 0 };
export const LOOK = { setup: true, robber: true, setupWidth: 6, robberWidth: 4, setupTurns: 14, turns: 8, tries: 24 };
export const W = { vp: 1000, prod: 2.6, kinds: 6, enemy: -0.43, reach1: 4, reach2: 1.6, spot: 12.4, synergy: -25, hand: 1.1, over: -1.56, road: 1.6, fleet: 3, dev: 8, port: 4, roadRace: 25, fleetRace: 25, lose: -9 };
const clone = v => JSON.parse(JSON.stringify(v));
/** What each resource is worth on this island: the scarcer its land's pips, the more (between 0.75 and 1.5 of the mean). */
function scarcity(s) {
  const total = ZERO();
  HEXES.forEach((_, h) => { if (s.kind[h] < 5) total[s.kind[h]] += pips(s.num[h]); });
  const mean = sum(total) / 5;
  return total.map(t => Math.max(0.75, Math.min(1.5, mean / Math.max(1, t))));
}
/** What a seat's land makes a turn, in pips by resource, the blockaded hex not counted. */
function makes(s, seat) {
  const out = ZERO();
  for (let v = 0; v < VERTS.length; v++) {
    if (s.vo[v] !== seat + 1) continue;
    for (const h of VERTS[v].hexes) if (s.kind[h] < 5 && h !== s.robber) out[s.kind[h]] += pips(s.num[h]) * s.vl[v];
  }
  return out;
}
/** A seat's making as a value: resource by resource, the first pips of each kind worth more than the tenth. */
function makingValue(prod, sc, late) {
  // early the roads and posts (timber, clay, wool, grain) count for more, late the factories' grain and iron
  const phase = late ? [0.85, 0.85, 0.9, 1.15, 1.25] : [1.1, 1.1, 0.95, 1.0, 0.9];
  let v = 0, kinds = 0;
  prod.forEach((p, r) => { if (p > 0) kinds++; v += sc[r] * phase[r] * (Math.min(p, 8) + Math.max(0, p - 8) * 0.55); });
  return v * W.prod + kinds * W.kinds;
}
/** A corner's worth as a post for a seat: what it would make (more for a kind the seat lacks), and its harbour. */
function cornerValue(s, v, sc, have) {
  let t = 0;
  for (const h of VERTS[v].hexes) if (s.kind[h] < 5) { const k = s.kind[h]; t += pips(s.num[h]) * sc[k] * (have[k] < 3 ? 1.35 : 1); }
  const pi = PORT_AT.findIndex((_, i) => portVerts(i).includes(v));
  if (pi >= 0) t += s.ports[pi] === "any" ? 1.5 : 0.6 + have[s.ports[pi]] * 0.3;
  return t;
}
/** The best corners a seat could build on: now (on its roads), one road away, two roads away. */
function reach(s, seat, sc, have) {
  const free = v => !s.vo[v] && !VERTS[v].adj.some(w => s.vo[w]);
  const net = new Set();
  for (let e = 0; e < EDGES.length; e++) if (s.eo[e] === seat + 1) { net.add(EDGES[e].a); net.add(EDGES[e].b); }
  for (let v = 0; v < VERTS.length; v++) if (s.vo[v] === seat + 1) net.add(v);
  const best = [0, 0, 0];
  let frontier = [...net].filter(v => !s.vo[v] || s.vo[v] === seat + 1);
  const seen = new Set(frontier);
  for (let d = 0; d <= 2 && frontier.length; d++) {
    const next = [];
    for (const v of frontier) {
      if (free(v)) best[d] = Math.max(best[d], cornerValue(s, v, sc, have));
      if (s.vo[v] && s.vo[v] !== seat + 1) continue;
      for (const e of VERTS[v].edges) {
        if (s.eo[e] && s.eo[e] !== seat + 1) continue;
        const w = otherEnd(e, v);
        if (seen.has(w)) continue;
        seen.add(w); next.push(w);
      }
    }
    frontier = next;
  }
  return best;
}
/**
 * How far a hand is from the nearest of a post (somewhere to put it), a factory (a post to put it on), a card and a road:
 * the cards it lacks, each counted by how long the land takes to make it (a kind it barely makes, or not at all, counts
 * for more: it must come from a trade), or, with SHORT.rounds off, simply how many.
 */
export const SHORT = { rounds: true, card: 2, road: 1.5 };
function shortOf(s, seat) {
  const hand = s.hand[seat], left = piecesLeft(s, seat), have = makes(s, seat);
  const away = cost => {
    const l = lack(hand, cost);
    if (!SHORT.rounds) return sum(l);
    // a kind made at p pips comes p/36 a roll, four rolls a round; a trade stands in for the land that's missing
    return l.reduce((t, n, r) => t + n * Math.min(2.5, 1 / (have[r] * s.seats / 36 + 0.35)), 0);
  };
  const post = left.post > 0 && postSpots(s, seat).length ? away(COSTS.post) : 9;
  const works = left.factory > 0 && factorySpots(s, seat).length ? away(COSTS.factory) : 9;
  const card = s.deck.length ? away(COSTS.dev) + SHORT.card : 9;
  const road = left.road > 0 ? away(COSTS.road) + SHORT.road : 9;           // a road on the way to a post, a little behind
  return Math.min(post, works, card, road + 1.5);
}
/** The position's worth to a seat. */
export function worth(s, seat, sc = scarcity(s)) {
  const vp = pointsOf(s, seat), have = makes(s, seat), late = vp >= 5;
  let v = vp * W.vp + makingValue(have, sc, late);
  // the others' making, the nearer to winning the more it matters
  let enemy = 0;
  for (let o = 0; o < s.seats; o++) if (o !== seat) enemy = Math.max(enemy, makingValue(makes(s, o), sc, late) * (1 + pointsOf(s, o, false) / 6));
  v += enemy * W.enemy;
  const [now, one, two] = reach(s, seat, sc, have);
  v += (piecesLeft(s, seat).post > 0 ? (now * W.spot / 3 + Math.max(now, one) * W.reach1 + two * W.reach2) : 0);
  v += shortOf(s, seat) * W.synergy;
  const n = cards(s, seat);
  // a hand of more than seven loses half of it to a 7, which comes before our next turn about two times in five
  v += Math.min(n, 7) * W.hand + Math.max(0, n - 7) * W.over + (n > 7 ? Math.floor(n / 2) * 0.42 * W.lose : 0);
  const r = rates(s, seat);
  r.forEach((rate, k) => { if (rate === 2) v += W.port * Math.min(1, have[k] / 5); });
  if (r.some(x => x === 3)) v += W.port * 0.5;
  const len = roadLength(s, seat);
  v += Math.min(len, 8) * W.road;
  // the races for the two-point prizes: the nearer to taking (or the safer in keeping) the longest road and the largest fleet, the more
  if (s.longest !== seat) v += W.roadRace * Math.max(0, 3 - (Math.max(5, s.longLen + 1) - len)) / 3;
  else v += W.roadRace * Math.min(2, len - Math.max(...Array.from({ length: s.seats }, (_, o) => (o === seat ? 0 : roadLength(s, o))))) / 2;
  const fleet = s.played[seat] + s.devs[seat].filter(c => c === "privateer").length * 0.8;
  if (s.army !== seat) v += W.fleetRace * Math.max(0, 2 - (Math.max(3, s.armyN + 1) - fleet)) / 2;
  v += s.played[seat] * W.fleet + s.devs[seat].filter(c => c !== "patent").length * W.dev;
  return v;
}

/** The position after a move, on a copy (or null if the rules refuse it). Buying a card isn't tried: the deck is face down. */
function after(s, seat, m) {
  const c = clone(s), out = rules.act(c, seat, m, { rng: () => 0.5, now: 0 });
  return typeof out === "string" ? null : out;
}
/** A card bought, valued without looking at the deck: its cost paid, a card in hand, a patent's point at the odds. */
function buyWorth(s, seat, sc) {
  const c = clone(s);
  COSTS.dev.forEach((n, i) => { c.hand[seat][i] -= n; });
  const unseen = c.deck.length;
  if (!unseen) return -Infinity;
  const patents = c.deck.filter(x => x === "patent").length;          // the deck's make-up is public: so many of each were printed
  return worth(c, seat, sc) + W.dev + (patents / unseen) * W.vp * 0.9;
}

/** Hard's own move without looking ahead, for its futures. */
function quick(s, seat, rng) {
  const keep = { ...LOOK };
  LOOK.setup = LOOK.robber = false;
  try { return think(s, seat, rng); } finally { Object.assign(LOOK, keep); }
}
function think(s, seat, rng) {
  const sc = scarcity(s);
  switch (s.step) {
    case "setup": {
      if (s.part !== "post") return firstRoad(s, seat, sc);
      const ranked = firstPosts(s, seat, sc).slice(0, LOOK.setupWidth).map(v => ({ t: "build", what: "post", at: v }));
      return LOOK.setup ? lookAhead(s, seat, ranked, { turns: LOOK.setupTurns, tries: LOOK.tries, rng }) : ranked[0];
    }
    case "roll": {
      // a Privateer before the roll when the blockade sits on our land
      if (playable(s, seat).includes("privateer") && !s.playedDev && HEXES[s.robber].corners.some(v => s.vo[v] === seat + 1) && pips(s.num[s.robber]) >= 3) return { t: "play", card: "privateer" };
      return { t: "roll" };
    }
    case "discard": return shedCards(s, seat, sc);
    case "blockade": {
      const ranked = blockades(s, seat, sc).slice(0, LOOK.robberWidth).map(h => ({ t: "blockade", hex: h }));
      return LOOK.robber ? lookAhead(s, seat, ranked, { turns: LOOK.turns, tries: LOOK.tries, rng }) : ranked[0];
    }
    case "steal": return { t: "steal", from: victims(s, s.robber, seat).sort((a, b) => robWorth(s, b) - robWorth(s, a))[0] };
    case "causeway": return bestOf(s, seat, sc, roadSpots(s, seat).map(e => ({ t: "build", what: "road", at: e })), { t: "skip" });
    case "offer": return weighOffer(s, seat, sc);
    case "pick": {
      const yes = s.offer.resp.map((r, i) => (r === 1 ? i : -1)).filter(i => i >= 0);
      return { t: "pick", with: yes.sort((a, b) => pointsOf(s, a, false) - pointsOf(s, b, false))[0] };
    }
    default: return turnMove(s, seat, sc, rng);
  }
}
/** The best of some moves by the position each leaves, or `stay` when none beats it. */
function bestOf(s, seat, sc, moves, stay, base = worth(s, seat, sc)) {
  let best = stay, top = base + 0.01;
  for (const m of moves) {
    const t = after(s, seat, m);
    if (!t) continue;
    const v = worth(t, seat, sc);
    if (v > top) { top = v; best = m; }
  }
  return best;
}
/** A turn's move: every build, card and bank trade (and buying a card) by the position it leaves; failing all, an offer to the table. */
function turnMove(s, seat, sc, rng) {
  const base = worth(s, seat, sc), hand = s.hand[seat], moves = [];
  for (const e of roadSpots(s, seat)) moves.push({ t: "build", what: "road", at: e });
  for (const v of postSpots(s, seat)) moves.push({ t: "build", what: "post", at: v });
  for (const v of factorySpots(s, seat)) moves.push({ t: "build", what: "factory", at: v });
  const r = rates(s, seat);
  for (let g = 0; g < 5; g++) if (hand[g] >= r[g]) for (let k = 0; k < 5; k++) if (k !== g) moves.push({ t: "bank", give: g, get: k });
  if (!s.playedDev) {
    const mine = playable(s, seat);
    // a Privateer whenever it can be played: it moves the blockade off us or onto the leader, robs, and builds the fleet
    if (mine.includes("privateer")) return { t: "play", card: "privateer" };
    if (mine.includes("windfall")) for (let a = 0; a < 5; a++) for (let b = a; b < 5; b++) moves.push({ t: "play", card: "windfall", res: [a, b] });
    if (mine.includes("corner")) for (let k = 0; k < 5; k++) moves.push({ t: "play", card: "corner", res: k });
    if (mine.includes("causeway") && piecesLeft(s, seat).road >= 2) moves.push({ t: "play", card: "causeway" });
  }
  const ranked = [];
  for (const m of moves) {
    const t = after(s, seat, m);
    if (!t) continue;
    let v = worth(t, seat, sc);
    if (m.card === "causeway") v += 2 * W.road + W.reach1 * 2;          // two roads to come
    if (m.card === "corner" || m.card === "windfall") v -= W.dev;          // the card itself was worth keeping
    ranked.push({ m, v });
  }
  if (has(hand, COSTS.dev) && s.deck.length) ranked.push({ m: { t: "buy" }, v: buyWorth(s, seat, sc) });
  ranked.sort((a, b) => b.v - a.v);
  // (playing the best few out a few turns, as the setup does, chose worse: too noisy to tell building now from building next turn)
  const best = ranked[0] && ranked[0].v > base + 0.01 ? ranked[0].m : { t: "end" };
  if (best.t !== "end") return best;
  // nothing more to do alone: a trade with the table that someone will take and that leaves us better off
  if (s.offers < MAX_OFFERS) {
    const offer = tableOffer(s, seat, sc, base);
    if (offer) return offer;
  }
  return best;
}
/**
 * The table trade worth most to this seat that one of the others would take: one or two of a kind for one of another,
 * each tried on a copy of the others' minds (how they answer, by Medium's rules: so it offers what someone wants), and
 * kept only if it leaves this seat better off. A person may well answer otherwise; the next offer tries something else.
 */
function tableOffer(s, seat, sc, base) {
  const hand = s.hand[seat];
  let best = null, top = base + TRADE.ask;
  for (let g = 0; g < 5; g++) for (const n of [1, 2]) {
    if (hand[g] < n) continue;
    for (let w = 0; w < 5; w++) {
      if (w === g) continue;
      const give = ZERO(), get = ZERO();
      give[g] = n; get[w] = 1;
      // would anyone take it?
      const yes = [];
      for (let o = 0; o < s.seats; o++) {
        if (o === seat || s.hand[o][w] < 1) continue;
        const c = clone(s);
        c.step = "offer"; c.offer = { from: seat, give, get, resp: [] };
        if (answer(c, o).yes) yes.push(o);
      }
      if (!yes.length || yes.every(o => pointsOf(s, o, false) >= s.opts.vp - 2)) continue;
      const c = clone(s);
      c.hand[seat][g] -= n; c.hand[seat][w]++;
      const v = worth(c, seat, sc);
      if (v > top) { top = v; best = { t: "offer", give, get }; }
    }
  }
  return best;
}
/** Answering an offer: yes when it leaves this seat better off and the one offering isn't near winning. */
function weighOffer(s, seat, sc) {
  const o = s.offer;
  if (!has(s.hand[seat], o.get) || pointsOf(s, o.from, false) >= s.opts.vp - 2) return { t: "answer", yes: false };
  const c = clone(s);
  o.get.forEach((n, i) => { c.hand[seat][i] -= n; c.hand[o.from][i] += n; });
  o.give.forEach((n, i) => { c.hand[seat][i] += n; c.hand[o.from][i] -= n; });
  const mine = worth(c, seat, sc) - worth(s, seat, sc);
  // and it must do us more good than it does them
  const theirs = worth(c, o.from, sc) - worth(s, o.from, sc);
  return { t: "answer", yes: mine > TRADE.take && mine > theirs * TRADE.edge };
}
/** Giving up half on a 7: one card at a time, each the one whose loss costs the position least. */
function shedCards(s, seat, sc) {
  const c = clone(s), out = ZERO();
  for (let n = 0; n < s.owe[seat]; n++) {
    let r = -1, top = -Infinity;
    for (let k = 0; k < 5; k++) {
      if (c.hand[seat][k] < 1) continue;
      c.hand[seat][k]--;
      const v = worth(c, seat, sc);
      c.hand[seat][k]++;
      if (v > top) { top = v; r = k; }
    }
    c.hand[seat][r]--; out[r]++;
  }
  return { t: "discard", n: out };
}
/** How much a victim is worth robbing: their points and how many cards they hold. */
const robWorth = (s, o) => pointsOf(s, o, false) * 2 + cards(s, o) * 0.6;
/** The blockade's hexes, best first: where it costs the others most (the leaders most), never our own, with someone to rob. */
function blockades(s, seat, sc) {
  const scored = [];
  for (let h = 0; h < HEXES.length; h++) {
    if (h === s.robber) continue;
    const p = s.kind[h] < 5 ? pips(s.num[h]) * sc[s.kind[h]] : 0;
    let v = 0;
    for (const c of HEXES[h].corners) {
      const o = s.vo[c] - 1;
      if (o < 0) continue;
      if (o === seat) v -= p * s.vl[c] * 3;
      else v += p * s.vl[c] * (1 + pointsOf(s, o, false) / 4);
    }
    const who = victims(s, h, seat);
    if (who.length) v += Math.max(...who.map(o => robWorth(s, o))) * 0.6;
    scored.push({ h, v });
  }
  return scored.sort((a, b) => b.v - a.v).map(x => x.h);
}
/** The setup's posts: the corner whose land, with what's already held, makes most, the kinds spread and a harbour of use. */
function firstPosts(s, seat, sc) {
  const have = makes(s, seat), spots = postSpots(s, seat, { setup: true });
  const second = have.some(n => n > 0), scored = [];
  for (const v of spots) {
    const add = ZERO();
    for (const h of VERTS[v].hexes) if (s.kind[h] < 5) add[s.kind[h]] += pips(s.num[h]);
    const prod = have.map((n, r) => n + add[r]);
    let val = makingValue(prod, sc, false);
    // timber and clay together build roads and posts from the first turn; grain and iron build factories
    if (prod[0] > 0 && prod[1] > 0) val += 6;
    if (prod[3] > 0 && prod[4] > 0) val += 5;
    const pi = PORT_AT.findIndex((_, i) => portVerts(i).includes(v));
    if (pi >= 0) val += s.ports[pi] === "any" ? 3 : prod[s.ports[pi]] >= 5 ? 6 : 1;
    // the first post looks ahead to room for a second nearby
    if (!second) val += Math.max(0, ...VERTS[v].adj.flatMap(w => VERTS[w].adj).filter(u => u !== v && !VERTS[v].adj.includes(u) && !s.vo[u] && !VERTS[u].adj.some(x => s.vo[x])).map(u => cornerValue(s, u, sc, prod))) * 0.5;
    scored.push({ v, val });
  }
  return scored.sort((a, b) => b.val - a.val).map(x => x.v);
}
/** The setup's road: towards the best corner it opens, one or two roads on. */
function firstRoad(s, seat, sc) {
  const have = makes(s, seat), edges = roadSpots(s, seat, s.last);
  let best = edges[0], top = -Infinity;
  for (const e of edges) {
    const w = otherEnd(e, s.last);
    let val = 0;
    for (const u of [w, ...VERTS[w].adj]) {
      if (u === s.last || VERTS[s.last].adj.includes(u) || s.vo[u] || VERTS[u].adj.some(x => s.vo[x])) continue;
      val = Math.max(val, cornerValue(s, u, sc, have) * (u === w ? 1 : 0.85));
    }
    if (val > top) { top = val; best = e; }
  }
  return { t: "build", what: "road", at: best };
}

// ---------- looking ahead: each candidate played out a few turns, many times ----------
// From the position each candidate move leaves, the game is played on for a few turns, every seat by Medium's rules,
// with fresh dice each time and the cards nobody at the table can see (the deck, the others' unplayed cards) dealt anew,
// so it never knows more than the seat does; the candidate whose futures end best is played. A future is judged by the
// seat's points and making against the best of the others', and a win or a loss inside it counts for most.
const shuffleIn = (a, rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function redeal(c, seat, rng) {
  const pool = [...c.deck];
  for (let o = 0; o < c.seats; o++) if (o !== seat) pool.push(...c.devs[o]);
  shuffleIn(pool, rng);
  for (let o = 0; o < c.seats; o++) if (o !== seat) c.devs[o] = pool.splice(0, c.devs[o].length);
  c.deck = pool;
  c.fresh = c.fresh.filter(() => true);
}
/** How a future ends for a seat: its standing against the best of the others. */
function standing(c, seat) {
  if (c.step === "over") return c.winner === seat ? 30 : -30;
  const sc = scarcity(c), mine = pointsOf(c, seat) + sum(makes(c, seat).map((p, r) => p * sc[r])) / 22 + cards(c, seat) * 0.04;
  let other = -Infinity;
  for (let o = 0; o < c.seats; o++) if (o !== seat) other = Math.max(other, pointsOf(c, o) + sum(makes(c, o).map((p, r) => p * sc[r])) / 22);
  return mine - other * 0.7;
}
/** Plays a position on `turns` turns, the others by Medium's rules and the seat itself as it would, without looking ahead. */
function playOn(c, turns, rng, seat) {
  const stop = c.turnNo + turns;
  for (let n = 0; n < 900 && c.step !== "over" && c.turnNo < stop; n++) {
    const who = rules.toMove(c);
    if (who == null) break;
    let m = who === seat ? quick(c, who, rng) : decide(c, who, rng), out = rules.act(c, who, m, { rng, now: 0 });
    if (typeof out === "string") { m = plain(c, who, rng); out = rules.act(c, who, m, { rng, now: 0 }); }
    if (typeof out === "string") break;
  }
  return c;
}
/** The best of some candidate moves by playing each out: `tries` futures each, the weaker half dropped as it goes. */
// Every candidate meets the same futures (the same dice, the same deal: common random numbers), so the difference
// between two candidates is the move's and not the luck's.
const seededRng = seed => { let x = (seed >>> 0) || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; };
export function lookAhead(s, seat, moves, { turns = 8, tries = 24, rng = Math.random } = {}) {
  let live = moves.map(m => ({ m, total: 0, n: 0 }));
  if (live.length === 1) return live[0].m;
  const seeds = Array.from({ length: tries }, () => (rng() * 4294967296) >>> 0);
  const rounds = [Math.ceil(tries / 3), Math.ceil(tries / 3), tries - 2 * Math.ceil(tries / 3)];
  let at = 0;
  for (const k of rounds) {
    for (const cand of live) for (let i = at; i < at + k; i++) {
      const c = clone(s), rng = seededRng(seeds[i]);
      redeal(c, seat, rng);
      const out = cand.m.t === "buy" || rules.act(c, seat, cand.m, { rng, now: 0 });
      if (cand.m.t === "buy") rules.act(c, seat, cand.m, { rng, now: 0 });
      if (typeof out === "string") { cand.total = -Infinity; cand.n = 1; break; }
      cand.total += standing(playOn(c, turns, rng, seat), seat);
      cand.n++;
    }
    at += k;
    live.sort((a, b) => b.total / b.n - a.total / a.n);
    if (live.length > 2) live = live.slice(0, Math.max(2, Math.ceil(live.length / 2)));
  }
  return live[0].m;
}
