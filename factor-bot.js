// Factor's computer players: from what their seat may see (its own hand and cards, the board, everyone's points without
// hidden patents, how many cards others hold). Easy builds what it can afford and answers offers by chance; Medium
// weighs where to build by the numbers and pays its way with the bank and the table; Hard also plays the cards for what
// they win, keeps a leader from the trades it would profit by, and puts the blockade where it costs the leader most. Every
// move is tried against the rules before it is given, and a refused one is replaced by a plain legal move, so a computer
// player never stops the table.
import { RES, HEXES, VERTS, EDGES, PORT_AT, pips, otherEnd, portVerts } from "./factor-board.js";
import { rules, COSTS, MAX_OFFERS, bankOf, cards, has, piecesLeft, postSpots, factorySpots, roadSpots, roadLength, pointsOf, playable, rates, victims, setupOrder } from "./factor-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
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
export function plans(s, seat, level = "hard") {
  const left = piecesLeft(s, seat), owned = production(s, seat), list = [];
  const hard = level === "hard";
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
      if (hard) {                                                         // a road that makes or takes the longest road
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
function setupPost(s, seat, level, rng) {
  const owned = production(s, seat), spots = postSpots(s, seat, { setup: true });
  const v = pickTop(spots, w => spotScore(s, seat, w, owned) + (level === "easy" ? rng() * 6 : level === "medium" ? rng() * 0.6 : 0), rng, level === "easy" ? 3 : 1);
  return { t: "build", what: "post", at: v };
}
function setupRoad(s, seat, level, rng) {
  const from = s.last, owned = production(s, seat);
  const open = new Set(postSpots(s, seat, { setup: true }));
  const edges = roadSpots(s, seat, from);
  const value = e => {
    const w = otherEnd(e, from);
    let best = 0;
    for (const u of [w, ...VERTS[w].adj]) if (u !== from && open.has(u) && !VERTS[from].adj.includes(u)) best = Math.max(best, spotScore(s, seat, u, owned) * (u === w ? 1 : 0.8));
    return best;
  };
  return { t: "build", what: "road", at: pickTop(edges, e => value(e) + (level === "easy" ? rng() * 4 : 0), rng) };
}

/** The hex to put the blockade on: where it costs others most and the seat least. */
function blockadeHex(s, seat, level, rng) {
  const hexes = HEXES.map((_, h) => h).filter(h => h !== s.robber);
  if (level === "easy") return pick(hexes.filter(h => victims(s, h, seat).length) .concat(hexes), rng);
  const value = h => {
    let t = 0;
    const p = pips(s.num[h]);
    for (const v of HEXES[h].corners) {
      const o = s.vo[v] - 1;
      if (o < 0) continue;
      if (o === seat) t -= p * s.vl[v] * 1.6;
      else t += p * s.vl[v] * (level === "hard" ? 1 + pointsOf(s, o, false) / 6 : 1) + (cards(s, o) > 0 ? 0.5 : 0);
    }
    return t + rng() * 0.1;
  };
  return pickTop(hexes, value, rng);
}
function whomToRob(s, seat, level, rng) {
  const who = victims(s, s.robber, seat);
  if (level === "easy") return pick(who, rng);
  return pickTop(who, o => (level === "hard" ? pointsOf(s, o, false) * 3 : 0) + cards(s, o), rng);
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
function answer(s, seat, level, rng) {
  const o = s.offer, hand = s.hand[seat];
  const mustGive = o.get, gets = o.give;                          // what this seat would give, and receive
  if (!has(hand, mustGive)) return { t: "answer", yes: false };
  if (level === "easy") return { t: "answer", yes: rng() < 0.4 };
  const goal = plans(s, seat, level).find(p => bankReach(s, seat, p.cost) || has(hand, p.cost) || sum(lack(hand, p.cost)) <= 2) || plans(s, seat, level)[0];
  const cost = goal?.cost || ZERO();
  const spares = spare(hand, cost), lacks = lack(hand, cost);
  const costsNeeded = mustGive.some((n, i) => n > spares[i]);
  const helps = gets.some((n, i) => n > 0 && lacks[i] > 0);
  const lead = pointsOf(s, o.from, false);
  if (level === "hard" && lead >= s.opts.vp - 3) return { t: "answer", yes: false };
  return { t: "answer", yes: helps && !costsNeeded && sum(gets) >= sum(mustGive) };
}

/** A card worth playing now, or null. */
function cardMove(s, seat, level, rng, roll) {
  const mine = playable(s, seat);
  if (!mine.length || s.playedDev) return null;
  const owned = production(s, seat);
  if (mine.includes("privateer")) {
    const onMine = HEXES[s.robber].corners.some(v => s.vo[v] === seat + 1) && pips(s.num[s.robber]) >= 4;     // it sits on one of ours, and not on a dud number
    const fleet = s.played[seat] + 1 >= 3 && s.played[seat] + 1 > s.armyN;
    if (onMine || (level !== "easy" && fleet)) return { t: "play", card: "privateer" };
    if (level === "easy" && rng() < 0.3) return { t: "play", card: "privateer" };
  }
  if (roll || level === "easy") return null;
  const goal = plans(s, seat, level)[0];
  if (mine.includes("windfall") && goal) {
    const lacks = lack(s.hand[seat], goal.cost), n = sum(lacks);
    if (n >= 1 && n <= 2) {
      const res = [];
      lacks.forEach((c, r) => { for (let i = 0; i < c && res.length < 2; i++) res.push(r); });
      while (res.length < 2) res.push(lacks.findIndex(c => c > 0) >= 0 ? lacks.findIndex(c => c > 0) : 3);
      if (res.every((r, i) => bankOf(s, r) >= 1 + (res.indexOf(r) !== i ? 1 : 0))) return { t: "play", card: "windfall", res };
    }
  }
  if (mine.includes("corner") && level === "hard") {
    const others = s.hand.reduce((t, h, i) => (i === seat ? t : t + sum(h)), 0);
    const r = [0, 1, 2, 3, 4].map(k => ({ k, w: (goalNeed(s, seat, k)) })).sort((a, b) => b.w - a.w)[0];
    if (r.w >= 2 && others >= 7) return { t: "play", card: "corner", res: r.k };
  }
  if (mine.includes("causeway") && level !== "easy" && piecesLeft(s, seat).road >= 2) {
    const roads = plans(s, seat, level).filter(p => p.what === "road");
    if (roads[0] && roads[0].value >= 6) return { t: "play", card: "causeway" };
  }
  return null;
}
const goalNeed = (s, seat, r) => { const g = plans(s, seat)[0]; return g ? Math.max(0, g.cost[r] - s.hand[seat][r]) : 0; };

function mainMove(s, seat, level, rng) {
  const hand = s.hand[seat];
  const card = cardMove(s, seat, level, rng, false);
  if (card) return card;
  const list = plans(s, seat, level);
  if (level === "easy") {
    const doable = list.filter(p => has(hand, p.cost));
    if (doable.length && rng() < 0.85) { const p = pick(doable.slice(0, 4), rng); return p.what === "dev" ? { t: "buy" } : { t: "build", what: p.what, at: p.at }; }
    return { t: "end" };
  }
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
  level = ["easy", "medium", "hard"].includes(level) ? level : "medium";
  let move;
  try { move = decide(s, seat, level, rng); } catch (e) { console.error(e); move = null; }
  const probe = () => { try { return move && typeof rules.act(JSON.parse(JSON.stringify(s)), seat, move, { rng: () => 0.5, now: 0 }) !== "string"; } catch { return false; } };
  return probe() ? move : plain(s, seat, rng);
}

function decide(s, seat, level, rng) {
  switch (s.step) {
    case "setup": return s.part === "post" ? setupPost(s, seat, level, rng) : setupRoad(s, seat, level, rng);
    case "roll": return cardMove(s, seat, level, rng, true) || { t: "roll" };
    case "discard": return discard(s, seat, rng);
    case "blockade": return { t: "blockade", hex: blockadeHex(s, seat, level, rng) };
    case "steal": return { t: "steal", from: whomToRob(s, seat, level, rng) };
    case "causeway": {
      const road = plans(s, seat, level).find(p => p.what === "road");
      return road ? { t: "build", what: "road", at: road.at } : { t: "skip" };
    }
    case "offer": return answer(s, seat, level, rng);
    case "pick": {
      const yes = s.offer.resp.map((r, i) => (r === 1 ? i : -1)).filter(i => i >= 0);
      return { t: "pick", with: pickTop(yes, i => -pointsOf(s, i, false), rng) };
    }
    default: return mainMove(s, seat, level, rng);
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
