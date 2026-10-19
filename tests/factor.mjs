// Factor (factor-rules.js, factor-board.js, factor-bot.js): the island (nineteen hexes, 54 corners, 72 edges, nine
// harbours, 6 and 8 never touching), the setup's snake and what the second post pays, the roll and its payout with the
// bank running short, a 7 (discards by half, the blockade, a theft from one or from a choice), what building costs and
// where it may go, the longest road (exact lengths, a cut road, a tie), the largest fleet, every development card and the
// rule that today's can't be played today, the bank's rates with and without harbours, offers answered one by one, a
// win on your own turn at 8, 10 or 12, the database's changes to a state, and the computer players: always legal, never
// stalling a table, conserving the cards, and the harder winning more.
import { rules, fresh, COSTS, PIECES, SUPPLY, TARGETS, DEVS, MAX_OFFERS, bankOf, cards, piecesLeft, postSpots, roadSpots, factorySpots,
  roadLength, pointsOf, playable, rates, victims, setupOrder, toMove } from "../factor-rules.js";
import { HEXES, VERTS, EDGES, COAST, PORT_AT, makeBoard, pips, edgeBetween, otherEnd, portVerts, RES } from "../factor-board.js";
import { botMove as bot, plans, LEVEL_NAMES, LOOK } from "../factor-bot.js";
import { seeded, mix, newRecord, applyMove, botMove as seatBot } from "../seats.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const clone = v => JSON.parse(JSON.stringify(v));
const sum = a => a.reduce((t, x) => t + x, 0);
const seq = list => { let i = 0; return () => list[i++ % list.length]; };
const two = (a, b) => seq([(a - 1) / 6 + 0.01, (b - 1) / 6 + 0.01]);        // an rng that rolls a and b
const act = (s, seat, move, rng = seeded(1)) => rules.act(clone(s), seat, move, { rng, now: 0 });
const ok = (s, seat, move, rng) => { const r = act(s, seat, move, rng); if (typeof r === "string") throw new Error(`seat ${seat} ${JSON.stringify(move)}: ${r}`); return r; };
const refused = (s, seat, move, rng) => typeof act(s, seat, move, rng) === "string";

/** A game in the middle of play: nothing built, the turn yours, the dice thrown. */
function table(seats = 4, seed = 3) {
  const s = fresh({ seats, options: {}, rng: seeded(seed) });
  s.step = "main"; s.turn = 0; s.turnNo = 5; s.rolled = true;
  return s;
}
const hold = (s, seat, hand) => { s.hand[seat] = [...hand]; return s; };
const post = (s, seat, v, level = 1) => { s.vo[v] = seat + 1; s.vl[v] = level; return s; };
const road = (s, seat, e) => { s.eo[e] = seat + 1; return s; };
const RICH = [9, 9, 9, 9, 9];
/** A path of n roads avoiding the corners given: the edges in order, for laying a road of a known length. */
function chain(n, avoid = new Set()) {
  const walk = (v, used, path) => {
    if (path.length === n) return path;
    for (const e of VERTS[v].edges) {
      const w = otherEnd(e, v);
      if (used.has(e) || avoid.has(w) || path.length && w === path.at(-1).from) continue;
      const hit = walk(w, new Set([...used, e]), [...path, { e, from: v }]);
      if (hit) return hit;
    }
    return null;
  };
  for (let v = 0; v < VERTS.length; v++) { if (avoid.has(v)) continue; const p = walk(v, new Set(), []); if (p) return p.map(x => x.e); }
  return null;
}
const ends = es => new Set(es.flatMap(e => [EDGES[e].a, EDGES[e].b]));
const ring = Array.from({ length: 6 }, (_, i) => i).map(i => { const c = HEXES[9].corners; return [c[i], c[(i + 1) % 6]]; });   // the middle hex's six sides
const ringE = ring.map(([a, b]) => edgeBetween(a, b)), ringV = HEXES[9].corners;

// ---------- the island ----------
{
  check(HEXES.length === 19 && VERTS.length === 54 && EDGES.length === 72, "nineteen hexes, 54 corners and 72 edges");
  check(VERTS.every(v => [2, 3].includes(v.adj.length)) && VERTS.every(v => v.hexes.length >= 1 && v.hexes.length <= 3), "every corner has two or three neighbours and touches one to three hexes");
  check(COAST.length === 30 && new Set(COAST).size === 30, "thirty coast edges");
  const used = new Set(); let clash = false;
  for (let i = 0; i < 9; i++) for (const v of portVerts(i)) { if (used.has(v)) clash = true; used.add(v); }
  check(PORT_AT.length === 9 && !clash && PORT_AT.every(e => COAST.includes(e)), "nine harbours on the shore, no two sharing a corner");
  let counts = true, hot = true, dunes = true, ports = true;
  for (let seed = 1; seed <= 300; seed++) {
    const b = makeBoard(seeded(seed));
    const kinds = [0, 1, 2, 3, 4, 5].map(k => b.kind.filter(x => x === k).length);
    if (kinds.join() !== "4,3,4,4,3,1") counts = false;
    const nums = b.num.filter(Boolean).sort((a, c) => a - c).join();
    if (nums !== "2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12") counts = false;
    HEXES.forEach((h, i) => { if ([6, 8].includes(b.num[i])) for (const j of h.nb) if ([6, 8].includes(b.num[j])) hot = false; });
    if (b.kind[b.robber] !== 5 || b.num[b.robber] !== 0) dunes = false;
    if ([...b.ports].map(String).sort().join() !== ["any", "any", "any", "any", "0", "1", "2", "3", "4"].sort().join()) ports = false;
  }
  check(counts, "every coast has 4 forest, 3 clay pits, 4 pasture, 4 fields, 3 hills, 1 dunes and the eighteen numbers (300 seeds)");
  check(hot, "the 6s and 8s never touch (300 seeds)");
  check(dunes && ports, "the blockade starts on the dunes, which carry no number; four harbours for anything and one for each resource");
  check([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(pips).join() === "1,2,3,4,5,5,4,3,2,1" && pips(7) === 0, "pips count the ways two dice make a number");
  const a = makeBoard(seeded(9)), b = makeBoard(seeded(9));
  check(JSON.stringify(a) === JSON.stringify(b), "the same seed makes the same coast");
}

// ---------- the deal and the setup ----------
{
  check(rules.id === "factor" && rules.seats.min === 3 && rules.seats.max === 4, "three or four at the table");
  check(TARGETS.join() === "8,10,12" && Object.values(DEVS).reduce((t, n) => t + n, 0) === 25, "a game to 8, 10 or 12 points; a deck of 25 development cards");
  const s = rules.deal({ seats: 4, options: {}, rng: seeded(11) });
  check(s.step === "setup" && s.part === "post" && s.turn === s.first && s.opts.vp === 10, "the game opens in the setup, the first seat to place a post, ten points to win");
  check(s.deck.length === 25 && s.hand.every(h => sum(h) === 0), "a full deck, empty hands");
  const order = setupOrder(s);
  check(order.length === 8 && order.slice(0, 4).join() === order.slice(4).reverse().join(), "the setup snakes: each seat in turn, then back the other way");

  // placing: the distance rule, the road beside the post, the second post paying out
  let g = s;
  const first = postSpots(g, g.turn, { setup: true })[0];
  check(refused(g, (g.turn + 1) % 4, { t: "build", what: "post", at: first }), "only the seat to place may");
  check(refused(g, g.turn, { t: "build", what: "road", at: 0 }), "a post first, not a road");
  g = ok(g, g.turn, { t: "build", what: "post", at: first });
  check(g.part === "road" && g.last === first && g.vo[first] === s.first + 1, "the post is down, a road next");
  const far = EDGES.findIndex((e, i) => e.a !== first && e.b !== first);
  check(refused(g, g.turn, { t: "build", what: "road", at: far }), "the setup's road must touch the post just placed");
  g = ok(g, g.turn, { t: "build", what: "road", at: VERTS[first].edges[0] });
  check(g.turn === order[1] && g.part === "post" && sum(g.hand[s.first]) === 0, "the next seat places; the first post pays nothing");
  check(refused(g, g.turn, { t: "build", what: "post", at: VERTS[first].adj[0] }), "no post beside another: the corner between must stay empty (the distance rule)");
  check(!postSpots(g, g.turn, { setup: true }).some(v => v === first || VERTS[first].adj.includes(v)), "postSpots leaves out the post and every corner beside it");

  // a whole setup played by the computer: second posts pay one card for each land hex round them
  let G = newRecord(rules, { seats: 4, seed: 21, now: 0 });
  let paid = true;
  for (let i = 0; i < 16; i++) {
    const seat = rules.toMove(G.state), st = G.state;
    const mv = seatBot(rules, G, seat, "hard");
    const before = sum(st.hand[seat]);
    G = applyMove(rules, G, seat, mv, 0).G;
    if (mv.what === "post" && st.si >= 4) {
      const land = VERTS[mv.at].hexes.filter(h => st.kind[h] < 5).length;
      if (sum(G.state.hand[seat]) - before !== land) paid = false;
    } else if (sum(G.state.hand[seat]) !== before) paid = false;
  }
  check(G.state.step === "roll" && G.state.turn === G.state.first && G.state.turnNo === 1, "after the snake the first seat rolls");
  check(paid, "the second post pays one card for each land hex it touches, and nothing else is paid in the setup");
  check(G.state.vo.filter(Boolean).length === 8 && G.state.eo.filter(Boolean).length === 8, "two posts and two roads for each of the four");
}

// ---------- the roll and the payout ----------
{
  const s = table();
  const h = 9, corners = HEXES[h].corners;
  s.kind[h] = 3; s.num[h] = 8; s.robber = 0;
  post(s, 1, corners[0]); post(s, 2, corners[2], 2); post(s, 3, corners[4]);
  s.step = "roll"; s.rolled = false;
  const r = ok(s, 0, { t: "roll" }, two(3, 5));
  check(r.roll.join() === "3,5" && r.step === "main", "the dice are thrown and the turn goes to its main step");
  check(r.hand[1][3] === 1 && r.hand[2][3] === 2 && r.hand[3][3] === 1 && r.hand[0][3] === 0, "a post is paid one, a factory two, whoever stands at the hex and no one else");
  check(r.got[2][3] === 2 && r.got[0][3] === 0, "what each was paid is kept for the page");
  check(refused(r, 0, { t: "roll" }), "no second roll");
  const blocked = clone(s); blocked.robber = h;
  const b = ok(blocked, 0, { t: "roll" }, two(3, 5));
  check(sum(b.hand.flat()) === 0, "the blockade's hex pays nothing");
  // the bank runs short: one taker gets what is left, several get nothing
  const short = clone(s); hold(short, 0, [0, 0, 0, 18, 0]);
  const none = ok(short, 0, { t: "roll" }, two(3, 5));
  check(none.hand[1][3] === 0 && none.hand[2][3] === 0 && none.hand[3][3] === 0 && bankOf(none, 3) === 1, "short in the bank with several owed: nobody is paid");
  const one = clone(short); one.vo[corners[0]] = 0; one.vo[corners[4]] = 0; one.vl[corners[0]] = 0; one.vl[corners[4]] = 0;
  const lone = ok(one, 0, { t: "roll" }, two(3, 5));
  check(lone.hand[2][3] === 1 && bankOf(lone, 3) === 0, "short with one owed: they take what is left (one of the two owed)");
}

// ---------- a 7 ----------
{
  const s = table();
  s.step = "roll"; s.rolled = false;
  hold(s, 1, [3, 2, 2, 1, 1]); hold(s, 2, [2, 2, 2, 1, 0]); hold(s, 3, [2, 2, 2, 1, 1]);        // nine cards, seven, eight
  const r = ok(s, 0, { t: "roll" }, two(3, 4));
  check(r.step === "discard" && r.owe.join() === "0,4,0,4", "a 7: eight cards or more give up half, rounded down (nine owes four); seven keep them all");
  check(toMove(r) === 1, "the discards go in seat order");
  check(refused(r, 1, { t: "discard", n: [1, 1, 0, 0, 0] }), "giving up the wrong number is refused");
  check(refused(r, 1, { t: "discard", n: [0, 0, 0, 0, 4] }), "so is giving up what you don't hold");
  const d1 = ok(r, 1, { t: "discard", n: [2, 1, 1, 0, 0] });
  check(d1.step === "discard" && toMove(d1) === 3 && sum(d1.hand[1]) === 5, "a discard is made, the next owes");
  const d2 = ok(d1, 3, { t: "discard", n: [0, 0, 2, 1, 1] });
  check(d2.step === "blockade" && toMove(d2) === 0, "the last discard hands the move to the roller, to move the blockade");
  // no one has eight: straight to the blockade
  const q = table(); q.step = "roll"; q.rolled = false;
  check(ok(q, 0, { t: "roll" }, two(6, 1)).step === "blockade", "a 7 with no one over seven goes straight to the blockade");

  // the blockade and the theft
  const m = clone(d2);
  const hx = 4, c = HEXES[hx].corners;
  post(m, 1, c[0]); post(m, 2, c[2]);
  hold(m, 1, [1, 0, 0, 0, 0]); hold(m, 2, [0, 0, 0, 0, 2]); hold(m, 3, [0, 0, 0, 0, 0]);
  check(refused(m, 0, { t: "blockade", hex: m.robber }), "the blockade must move to another hex");
  const two2 = ok(m, 0, { t: "blockade", hex: hx });
  check(two2.step === "steal" && victims(m, hx, 0).join() === "1,2" && two2.robber === hx, "two seats beside the new hex: the roller chooses");
  check(refused(two2, 0, { t: "steal", from: 3 }), "a theft from someone not beside it is refused");
  const stolen = ok(two2, 0, { t: "steal", from: 2 }, seq([0.9]));
  check(stolen.step === "main" && stolen.hand[2][4] === 1 && stolen.hand[0][4] === 1, "a card taken from the chosen seat; the turn goes on");
  const solo1 = clone(m); solo1.vo[c[2]] = 0; solo1.vl[c[2]] = 0;
  const one1 = ok(solo1, 0, { t: "blockade", hex: hx }, seq([0.1]));
  check(one1.step === "main" && one1.hand[1][0] === 0 && one1.hand[0][0] === 1, "one seat beside it: the card is taken at once");
  const empty = clone(m); hold(empty, 1, [0, 0, 0, 0, 0]); hold(empty, 2, [0, 0, 0, 0, 0]);
  check(ok(empty, 0, { t: "blockade", hex: hx }).step === "main", "a seat with no cards can't be robbed: the turn goes on");
  const own = clone(m); own.vo[c[0]] = 1; own.vl[c[0]] = 1; own.vo[c[2]] = 0;
  check(ok(own, 0, { t: "blockade", hex: hx }).step === "main" && victims(own, hx, 0).length === 0, "your own building is never a victim");
}

// ---------- building ----------
{
  const s = table();
  hold(s, 0, [...COSTS.road]);
  const start = postSpots(s, 0, { setup: true })[0];
  post(s, 0, start);
  const e = VERTS[start].edges[0];
  check(refused(table(), 0, { t: "build", what: "road", at: e }), "a road costs timber and clay, and goes beside a building or road of yours");
  const r = ok(s, 0, { t: "build", what: "road", at: e });
  check(r.eo[e] === 1 && sum(r.hand[0]) === 0, "a road is laid and paid for");
  check(refused(r, 0, { t: "build", what: "road", at: e }), "one road to an edge");
  const far = EDGES.findIndex((x, i) => !r.eo[i] && x.a !== start && x.b !== start && !VERTS[start].adj.includes(x.a) && !VERTS[start].adj.includes(x.b));
  hold(r, 0, RICH);
  check(refused(r, 0, { t: "build", what: "road", at: far }), "a road must join your own road or building");
  // a road reaches on from a road
  const next = VERTS[otherEnd(e, start)].edges.find(x => x !== e);
  check(roadSpots(r, 0).includes(next), "a road may run on from another of yours");
  // another's building cuts the way
  const mid = otherEnd(e, start), cut = clone(r);
  post(cut, 1, mid);
  check(!roadSpots(cut, 0).includes(next) && !refused(r, 0, { t: "build", what: "road", at: next }) && refused(cut, 0, { t: "build", what: "road", at: next }), "another's building at the end of your road stops it going on");

  // posts: on your road, off the distance rule, paid for
  const p = clone(r); road(p, 0, next); hold(p, 0, [...COSTS.post]);
  const spot = postSpots(p, 0)[0];
  check(postSpots(p, 0).every(v => VERTS[v].edges.some(x => p.eo[x] === 1)) && spot != null, "after the setup a post goes only at the end of one of your roads");
  const built = ok(p, 0, { t: "build", what: "post", at: spot });
  check(built.vo[spot] === 1 && built.vl[spot] === 1 && sum(built.hand[0]) === 0, "a post costs timber, clay, wool and grain");
  check(refused(p, 0, { t: "build", what: "post", at: start }), "not where one stands, nor beside one");
  // factories
  const f = clone(built); hold(f, 0, [...COSTS.factory]);
  check(factorySpots(f, 0).includes(spot) && factorySpots(f, 0).includes(start), "a factory may replace any post of yours");
  const upgraded = ok(f, 0, { t: "build", what: "factory", at: spot });
  check(upgraded.vl[spot] === 2 && sum(upgraded.hand[0]) === 0 && pointsOf(upgraded, 0) === 3, "a factory costs two grain and three iron; a post is one point, a factory two");
  check(refused(upgraded, 0, { t: "build", what: "factory", at: spot }), "a factory can't be built on a factory");
  check(refused(table(), 0, { t: "build", what: "factory", at: 0 }), "or where there is no post of yours");
  // piece limits
  const lim = table(); hold(lim, 0, RICH);
  chain(15).forEach(x => road(lim, 0, x));
  post(lim, 0, EDGES[chain(15)[0]].a);
  const spare = EDGES.findIndex((x, i) => !lim.eo[i] && (x.a === EDGES[chain(15)[0]].a || x.b === EDGES[chain(15)[0]].a));
  check(piecesLeft(lim, 0).road === 0 && (spare < 0 || refused(lim, 0, { t: "build", what: "road", at: spare })), "fifteen roads and no more");
  const posts = table(); hold(posts, 0, RICH);
  check(piecesLeft(posts, 0).post === 5 && piecesLeft(posts, 0).factory === 4 && PIECES.road === 15, "five posts, four factories, fifteen roads");
  // only on your own turn, and in the main step
  check(refused(table(), 1, { t: "build", what: "road", at: 0 }), "only the seat whose turn it is builds");
}

// ---------- the longest road ----------
{
  const s = table(); hold(s, 0, RICH);
  const path5 = [0, 1, 2, 3, 4].map(i => ringE[i]);              // five sides of the middle hex: a line c0..c5
  path5.slice(0, 4).forEach(e => road(s, 0, e));
  check(roadLength(s, 0) === 4 && s.longest === -1, "four roads are not yet the longest road");
  const five = ok(s, 0, { t: "build", what: "road", at: path5[4] });
  check(roadLength(five, 0) === 5 && five.longest === 0 && five.longLen === 5 && pointsOf(five, 0) === 2, "five in a row take the longest road: two points");
  const sixth = clone(five); road(sixth, 0, ringE[5]);
  check(roadLength(sixth, 0) === 6, "the sixth side closes a ring of six");
  // a branch counts only the longer arm
  const fork = clone(five), out = VERTS[ringV[2]].edges.find(x => !ringE.includes(x));
  road(fork, 0, out);
  check(roadLength(fork, 0) === 5, "a branch is not added to the line: the longest run counts");
  // another's post in the middle cuts it
  const cutter = clone(five); hold(cutter, 1, RICH); cutter.turn = 1;
  const spur = VERTS[ringV[2]].edges.find(x => !ringE.includes(x));
  road(cutter, 1, spur);
  const split = ok(cutter, 1, { t: "build", what: "post", at: ringV[2] });
  check(roadLength(split, 0) === 3 && split.longest === -1, "another's post at a corner in the middle cuts the road: 2 and 3, so no longest road");
  // a cut at the end doesn't
  const endcut = clone(five); hold(endcut, 1, RICH); endcut.turn = 1;
  road(endcut, 1, VERTS[ringV[0]].edges.find(x => !ringE.includes(x)));
  check(roadLength(ok(endcut, 1, { t: "build", what: "post", at: ringV[0] }), 0) === 5, "a post at the end of the road leaves it whole");
  // a tie leaves it; the longer takes it
  const used = ends(five.eo.map((o, i) => (o ? i : -1)).filter(i => i >= 0));
  const other = chain(6, new Set([...used, ...ringV]));
  const t2 = clone(five); hold(t2, 1, RICH); t2.turn = 1;
  other.slice(0, 4).forEach(e => road(t2, 1, e));
  const tie = ok(t2, 1, { t: "build", what: "road", at: other[4] });
  check(roadLength(tie, 1) === 5 && tie.longest === 0, "a tie at five leaves the longest road with its holder");
  const six = ok(tie, 1, { t: "build", what: "road", at: other[5] });
  check(six.longest === 1 && six.longLen === 6 && pointsOf(six, 0) === 0 && pointsOf(six, 1) === 2, "one more takes it: the points move with it");
}

// ---------- development cards ----------
{
  const s = table(); hold(s, 0, [0, 0, 1, 1, 1]);
  s.deck = ["corner", "privateer"];
  check(refused(hold(clone(s), 0, [0, 0, 1, 1, 0]), 0, { t: "buy" }), "a card costs wool, grain and iron");
  const b = ok(s, 0, { t: "buy" });
  check(b.devs[0].join() === "privateer" && b.fresh.join() === "privateer" && b.deck.length === 1 && sum(b.hand[0]) === 0, "a card drawn from the top and paid for");
  check(playable(b, 0).length === 0 && refused(b, 0, { t: "play", card: "privateer" }), "today's purchase can't be played today");
  const tomorrow = ok(b, 0, { t: "end" }); tomorrow.turn = 0; tomorrow.step = "main";
  check(playable(tomorrow, 0).join() === "privateer", "but on the next turn it can");
  const dry = table(); hold(dry, 0, RICH); dry.deck = [];
  check(refused(dry, 0, { t: "buy" }), "an empty deck can't be bought from");

  // the privateer: before the roll too, then back to where it was
  const pv = table(); pv.devs[0] = ["privateer"]; pv.step = "roll"; pv.rolled = false;
  const p1 = ok(pv, 0, { t: "play", card: "privateer" });
  check(p1.step === "blockade" && p1.back === "roll" && p1.played[0] === 1 && p1.playedDev, "a Privateer before the roll moves the blockade");
  const p2 = ok(p1, 0, { t: "blockade", hex: (p1.robber + 1) % 19 });
  check(p2.step === "roll", "and the turn goes back to the roll");
  check(refused(p2, 0, { t: "play", card: "privateer" }), "one development card a turn");
  const early = table(); early.devs[0] = ["windfall"]; early.step = "roll";
  check(refused(early, 0, { t: "play", card: "windfall", res: [0, 1] }), "before the roll only a Privateer may be played");
  // the largest fleet
  const lf = table(); lf.devs[0] = ["privateer"]; lf.played[0] = 2;
  const f1 = ok(lf, 0, { t: "play", card: "privateer" });
  check(f1.army === 0 && f1.armyN === 3 && pointsOf(f1, 0) === 2, "three Privateers played take the largest fleet: two points");
  const rival = clone(f1); rival.turn = 1; rival.step = "main"; rival.playedDev = false; rival.devs[1] = ["privateer"]; rival.played[1] = 2; rival.fresh = [];
  const tieF = ok(rival, 1, { t: "play", card: "privateer" });
  check(tieF.army === 0 && tieF.armyN === 3, "a tie at three leaves it with its holder");
  const over = clone(tieF); over.step = "main"; over.playedDev = false; over.devs[1] = ["privateer"];
  check(ok(over, 1, { t: "play", card: "privateer" }).army === 1, "a fourth takes it");
  // a causeway
  const cw = table(); cw.devs[0] = ["causeway"];
  const st = postSpots(cw, 0, { setup: true })[0]; post(cw, 0, st);
  const w1 = ok(cw, 0, { t: "play", card: "causeway" });
  check(w1.step === "causeway" && w1.free === 2, "a Causeway: two roads for nothing");
  const e1 = roadSpots(w1, 0)[0], w2 = ok(w1, 0, { t: "build", what: "road", at: e1 });
  check(w2.step === "causeway" && w2.free === 1 && sum(w2.hand[0]) === 0, "the first is laid, free");
  const w3 = ok(w2, 0, { t: "build", what: "road", at: roadSpots(w2, 0)[0] });
  check(w3.step === "main" && w3.eo.filter(Boolean).length === 2, "the second ends it, back to the turn");
  check(ok(w1, 0, { t: "skip" }).step === "main", "or the rest is given up");
  const none = table(); none.devs[0] = ["causeway"];
  check(refused(none, 0, { t: "play", card: "causeway" }), "with no road to build it can't be played");
  // a windfall, a corner
  const wf = table(); wf.devs[0] = ["windfall"];
  const wr = ok(wf, 0, { t: "play", card: "windfall", res: [4, 4] });
  check(wr.hand[0][4] === 2 && wr.playedDev, "a Windfall: any two resources from the bank");
  const wb = clone(wf); hold(wb, 1, [0, 0, 0, 0, 18]);
  check(refused(wb, 0, { t: "play", card: "windfall", res: [4, 4] }), "not what the bank doesn't hold");
  const co = table(); co.devs[0] = ["corner"]; hold(co, 1, [0, 3, 0, 0, 0]); hold(co, 2, [0, 2, 0, 1, 0]); hold(co, 3, [0, 0, 0, 0, 0]); hold(co, 0, [0, 1, 0, 0, 0]);
  const cr = ok(co, 0, { t: "play", card: "corner", res: 1 });
  check(cr.hand[0][1] === 6 && cr.hand[1][1] === 0 && cr.hand[2][1] === 0 && cr.hand[2][3] === 1, "a Corner: every other player gives you all they hold of the one resource, and only that");
  // patents are hidden points, and win
  const pt = table(); pt.devs[0] = ["patent", "patent"];
  check(pointsOf(pt, 0) === 2 && pointsOf(pt, 0, false) === 0, "a patent is a hidden point");
  check(refused(pt, 0, { t: "play", card: "patent" }), "and is not played");
  const win = table(); hold(win, 0, [0, 0, 1, 1, 1]); win.deck = ["patent"];
  [0, 1, 2, 3, 4, 5, 6, 7, 8].forEach(i => { win.devs[0].push("patent"); });
  const done = ok(win, 0, { t: "buy" });
  check(done.step === "over" && done.winner === 0, "the tenth point, a patent just bought, wins at once");
}

// ---------- the bank and the table ----------
{
  const s = table(); hold(s, 0, [4, 0, 0, 0, 0]);
  check(rates(s, 0).join() === "4,4,4,4,4", "four to one at the bank");
  const b = ok(s, 0, { t: "bank", give: 0, get: 3 });
  check(b.hand[0].join() === "0,0,0,1,0", "four timber buy one grain");
  check(refused(hold(clone(s), 0, [3, 0, 0, 0, 0]), 0, { t: "bank", give: 0, get: 3 }) && refused(s, 0, { t: "bank", give: 0, get: 0 }), "not with too few, nor for the same kind");
  const gen = table(); post(gen, 0, portVerts(0)[0]); gen.ports[0] = "any"; hold(gen, 0, [3, 0, 0, 0, 0]);
  check(rates(gen, 0).join() === "3,3,3,3,3" && ok(gen, 0, { t: "bank", give: 0, get: 1 }).hand[0][1] === 1, "a harbour for anything: three to one");
  const spec = table(); post(spec, 0, portVerts(1)[1]); spec.ports[1] = 3; hold(spec, 0, [0, 0, 0, 2, 0]);
  check(rates(spec, 0).join() === "4,4,4,2,4" && ok(spec, 0, { t: "bank", give: 3, get: 4 }).hand[0][4] === 1, "a harbour for one resource: two to one for that one");
  const mix2 = table(); post(mix2, 0, portVerts(0)[0]); mix2.ports[0] = "any"; post(mix2, 0, portVerts(4)[0]); mix2.ports[4] = 2;
  check(rates(mix2, 0).join() === "3,3,2,3,3", "both: the better rate for each");
  const empty = table(); hold(empty, 0, [8, 0, 0, 0, 0]); hold(empty, 1, [0, 0, 0, 0, 0]); hold(empty, 2, [0, 0, 0, 19, 0]);
  check(refused(empty, 0, { t: "bank", give: 0, get: 3 }), "not for what the bank has none of");

  // offers
  const o = table(); hold(o, 0, [1, 0, 0, 0, 0]); hold(o, 1, [0, 1, 0, 0, 0]); hold(o, 2, [0, 2, 0, 0, 0]); hold(o, 3, [5, 0, 0, 0, 0]);
  const give = [1, 0, 0, 0, 0], get = [0, 1, 0, 0, 0];
  check(refused(o, 0, { t: "offer", give: [1, 0, 0, 0, 0], get: [1, 0, 0, 0, 0] }), "you can't ask for the kind you give");
  check(refused(o, 0, { t: "offer", give: [2, 0, 0, 0, 0], get }) && refused(o, 0, { t: "offer", give: [0, 0, 0, 0, 0], get }), "an offer must be of what you hold, and give something");
  const off = ok(o, 0, { t: "offer", give, get });
  check(off.step === "offer" && off.offer.resp.join() === "2,-1,-1,0" && toMove(off) === 1, "an offer goes to each seat in turn; one who lacks what's asked has said no");
  const y1 = ok(off, 1, { t: "answer", yes: true });
  check(y1.step === "offer" && toMove(y1) === 2, "the next answers");
  const n2 = ok(y1, 2, { t: "answer", yes: false });
  check(n2.step === "main" && n2.hand[0].join() === "0,1,0,0,0" && n2.hand[1].join() === "1,0,0,0,0", "one yes settles at once: cards change hands");
  const y2 = ok(y1, 2, { t: "answer", yes: true });
  check(y2.step === "pick" && toMove(y2) === 0, "two yeses: the proposer picks");
  check(refused(y2, 0, { t: "pick", with: 3 }), "only one of those who said yes");
  const pk = ok(y2, 0, { t: "pick", with: 2 });
  check(pk.step === "main" && pk.hand[2].join() === "1,1,0,0,0" && pk.hand[1].join() === "0,1,0,0,0", "the proposer's pick trades");
  check(ok(y2, 0, { t: "pick", with: -1 }).step === "main" && ok(y2, 0, { t: "pick", with: -1 }).hand[0].join() === "1,0,0,0,0", "or turns them all down");
  const no = ok(ok(off, 1, { t: "answer", yes: false }), 2, { t: "answer", yes: false });
  check(no.step === "main" && no.hand[0].join() === "1,0,0,0,0", "everyone no: nothing happens");
  const lone = table(); hold(lone, 0, [1, 0, 0, 0, 0]);
  check(ok(lone, 0, { t: "offer", give, get }).step === "main", "an offer no one can meet ends at once");
  let c = o; for (let i = 0; i < MAX_OFFERS; i++) { c = ok(c, 0, { t: "offer", give, get: [0, 0, 0, 0, 1] }); }
  check(refused(c, 0, { t: "offer", give, get: [0, 0, 0, 0, 1] }), `${MAX_OFFERS} offers a turn, no more`);
  check(refused(o, 1, { t: "answer", yes: true }), "an answer to no offer is refused");
}

// ---------- the turn and the win ----------
{
  const s = table();
  const e = ok(s, 0, { t: "end" });
  check(e.turn === 1 && e.step === "roll" && !e.rolled && e.fresh.length === 0, "ending the turn passes the dice on, clockwise");
  check(refused(e, 0, { t: "end" }) && refused(e, 1, { t: "end" }), "the dice come before anything else");
  const w = table(); w.devs[1] = Array(10).fill("patent");
  const nxt = ok(w, 0, { t: "end" });
  check(nxt.step === "over" && nxt.winner === 1, "ten points reached off your own turn win at the start of it");
  for (const vp of [8, 12]) {
    const t = fresh({ seats: 3, options: { vp }, rng: seeded(2) });
    check(t.opts.vp === vp, `a game to ${vp}`);
  }
  check(fresh({ seats: 3, options: { vp: 9 }, rng: seeded(2) }).opts.vp === 10, "an odd target is made ten");
  const o8 = table(); o8.opts.vp = 8; o8.devs[0] = Array(6).fill("patent"); post(o8, 0, 0); hold(o8, 0, [...COSTS.post]);
  const e0 = VERTS[0].edges[0], mid = otherEnd(e0, 0);
  road(o8, 0, e0); road(o8, 0, VERTS[mid].edges.find(x => x !== e0));
  const spot = postSpots(o8, 0)[0];
  check(spot != null && ok(o8, 0, { t: "build", what: "post", at: spot }).step === "over", "the target counts the points you hold: six patents and two posts are eight");
  check(refused(ok(o8, 0, { t: "build", what: "post", at: spot }), 0, { t: "end" }), "nothing is played once it's over");
}

// ---------- what the database does ----------
{
  let G = newRecord(rules, { seats: 4, seed: 33, now: 0 });
  let n = 0, rt = true;
  while (!rules.over(G.state) && n < 700) {
    const seat = rules.toMove(G.state);
    G = applyMove(rules, G, seat, seatBot(rules, G, seat, "hard"), 0).G;
    n++;
    if (n % 7 === 0) {
      if (!same(rules.restore(clone(G.state)), rules.restore(roundTrip(G.state)))) { rt = false; break; }
      G = { ...G, state: roundTrip(G.state) };                    // play on from what came back
    }
  }
  check(rt, `a state that went through the database and came back is whole: ${n} moves played on from them`);
  check(rules.over(G.state), "and the game played on that way finishes");
  const s = rules.restore(roundTrip(fresh({ seats: 3, options: {}, rng: seeded(4) })));
  check(s.devs.length === 3 && s.devs.every(d => Array.isArray(d)) && Array.isArray(s.fresh) && s.offer === null, "empty lists come back as lists");
}

// ---------- the computer players ----------
{
  check(LEVEL_NAMES.map(x => x[0]).join() === "medium,hard", "two strengths: Medium and Hard");
  // Hard against Medium players, its look-ahead at the setup off here for speed (a few games below have it on)
  LOOK.setup = LOOK.robber = false;
  let illegal = 0, stalled = 0, lost = 0, finished = 0, games = 0;
  const wins = { medium: 0, hard: 0 }, played = { medium: 0, hard: 0 };
  const run = (seats, g, order) => {
    let G = newRecord(rules, { seats, seed: 500 + g + seats * 100, now: 0 }), moves = 0;
    while (!rules.over(G.state) && moves < 6000) {
      const seat = rules.toMove(G.state);
      if (seat == null) { stalled++; break; }
      const mv = seatBot(rules, G, seat, order[seat]);
      const r = applyMove(rules, G, seat, mv, 0);
      if (r.error) { illegal++; break; }
      G = r.G; moves++;
      for (let k = 0; k < 5; k++) if (bankOf(G.state, k) < 0 || bankOf(G.state, k) > SUPPLY) lost++;
    }
    games++;
    if (rules.over(G.state)) {
      finished++;
      wins[order[G.state.winner]]++;
      if (pointsOf(G.state, G.state.winner) < 10) lost++;
    } else stalled++;
    order.forEach(l => played[l]++);
  };
  for (const seats of [3, 4]) for (let g = 0; g < 60; g++) run(seats, g, Array.from({ length: seats }, (_, i) => (i === g % seats ? "hard" : "medium")));
  LOOK.setup = LOOK.robber = true;
  for (let g = 0; g < 4; g++) run(4, 900 + g, ["hard", "hard", "medium", "hard"]);
  check(illegal === 0, `the computer's move is never refused (${games} games, 3 and 4 seats, Hard looking ahead in some)`);
  check(stalled === 0 && finished === games, `every game finishes: no one is left with nothing to do (${finished} of ${games})`);
  check(lost === 0, "the cards are conserved (never more than 19 of a resource in play, none below 0) and a winner has the points");
  console.log(`     wins per seat played: medium ${(wins.medium / played.medium).toFixed(2)}, hard ${(wins.hard / played.hard).toFixed(2)}`);
  check(wins.hard / played.hard > 1.3 * wins.medium / played.medium, "Hard wins clearly more often than Medium");
  // the same seed and the same players make the same game
  const play = () => { let G = newRecord(rules, { seats: 4, seed: 77, now: 0 }); while (!rules.over(G.state)) { const seat = rules.toMove(G.state); G = applyMove(rules, G, seat, seatBot(rules, G, seat, "hard"), 0).G; } return JSON.stringify(G.state); };
  check(play() === play(), "a game from a seed is the same game every time");
  // a computer player given nonsense still moves legally
  const s = table();
  check(typeof bot(s, 0, { level: "nonsense", rng: seeded(1) }) === "object", "an unknown strength plays as Medium");
  // it plays only what its seat may do: the plain fallback for each step is legal
  const steps = [];
  let G = newRecord(rules, { seats: 4, seed: 91, now: 0 });
  while (!rules.over(G.state) && steps.length < 2000) {
    const seat = rules.toMove(G.state);
    steps.push(G.state.step);
    G = applyMove(rules, G, seat, seatBot(rules, G, seat, "medium"), 0).G;
  }
  const seen = new Set(steps);
  check(["setup", "roll", "main", "discard", "blockade", "offer"].every(x => seen.has(x)), `one game visits the setup, roll, main, discard, blockade and offer steps (${[...seen].join(", ")})`);
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
