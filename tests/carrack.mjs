// Carrack (carrack-map.js, carrack-rules.js, carrack-orders.js, carrack-bot.js): the map (36 ports, 9 regions, lanes
// symmetric and connected, west stays west and north stays north, no two names overlapping at 8px), the deal for two to six
// powers, the events (24, each in its era), the dice (exact odds against a simulation, ties to the defender), orders set
// together in any order giving the same round, enslavement and forced labour costing grievance and never paying,
// the state through the database, whole games of computer players at every strength, every order they set checked against a
// rulebook written out again here, that rulebook against the engine's on random orders, and the game's length. The
// balance of the nine powers over 200 games is tests/carrack-balance.mjs.
import { PORTS, N_PORTS, IDX, ADJ, LANES, GOODS, REGIONS, W, H, LABEL, labelBox, BY_REGION } from "../carrack-map.js";
import {
  rules, POWERS, POWER_IDX, EVENTS, ERAS, ROUNDS, CAP, checkOrders, exchange, attackOdds, applyEvent, resolveRound, monopolies,
  standing, held, closedTo, active, seatOfPower,
} from "../carrack-rules.js";
import { submit, take, nextSeat } from "../carrack-orders.js";
import { botOrders } from "../carrack-bot.js";
import { newRecord, applyMove, botMove, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const ok = (yes, what) => { console.log(`${yes ? "ok  " : "FAIL"} ${what}`); if (!yes) bad++; };
const P = id => IDX[id];
const R = (seats = 4, seed = 1, options = {}) => newRecord(rules, { seats, options, seed, now: 0 });

// ---------- the map ----------
{
  ok(N_PORTS === 36 && REGIONS.length === 9 && BY_REGION.every(r => r.length > 0), "36 ports in 9 regions, none empty");
  ok(new Set(PORTS.map(p => p.id)).size === 36 && new Set(PORTS.map(p => p.name)).size === 36, "every port has its own id and name");
  ok(LANES.every(l => l.days >= 1 && l.days <= 3 && l.a !== l.b), "every lane is one to three days between two ports");
  const key = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  ok(new Set(LANES.map(l => key(l.a, l.b))).size === LANES.length, "no lane is listed twice");
  let sym = true;
  for (let p = 0; p < N_PORTS; p++) for (const e of ADJ[p]) {
    const back = ADJ[e.to].find(x => x.to === p && x.lane === e.lane);
    if (!back || back.days !== e.days || back.f !== e.f || back.east === e.east) sym = false;
  }
  ok(sym, "adjacency is symmetric: every lane both ways, the same days and flags, opposite directions");
  const seen = new Set([0]), q = [0];
  while (q.length) { const p = q.pop(); for (const e of ADJ[p]) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }
  ok(seen.size === N_PORTS, "the map is one connected piece");
  ok(ADJ.every(a => a.length >= 1 && a.length <= 7), "no port is cut off or has more than seven lanes");
  ok(GOODS.length === 6 && GOODS.every(g => g.ports.length >= 3 && g.ports.length <= 4 && g.ports.every(p => p >= 0 && p < N_PORTS)), "six goods, each with three or four source ports on the map");
  // geography honest in order: far-apart ports keep their compass order
  let wrong = [];
  for (const a of PORTS) for (const b of PORTS) {
    if (b.lon - a.lon > 8 && b.x <= a.x) wrong.push(`${a.id} ${b.id} east`);
    if (a.lat - b.lat > 6 && b.y <= a.y) wrong.push(`${a.id} ${b.id} north`);
  }
  ok(wrong.length === 0, `west stays west and north stays north for any two ports far apart${wrong.length ? ": " + wrong.slice(0, 4).join(", ") : ""}`);
  // names don't overlap each other or another port's dot, and stay on the board
  const boxes = PORTS.map(labelBox), dots = PORTS.map(p => ({ x: p.x - LABEL.dot, y: p.y - LABEL.dot, w: 2 * LABEL.dot, h: 2 * LABEL.dot }));
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const clashes = [];
  for (let i = 0; i < N_PORTS; i++) {
    const b = boxes[i];
    if (b.x < 0 || b.y < 0 || b.x + b.w > W || b.y + b.h > H) clashes.push(`${PORTS[i].id} off the board`);
    for (let j = 0; j < N_PORTS; j++) {
      if (j > i && hit(b, boxes[j])) clashes.push(`${PORTS[i].id}/${PORTS[j].id} names`);
      if (j !== i && hit(b, dots[j])) clashes.push(`${PORTS[i].id} name on ${PORTS[j].id}`);
      if (j > i && hit(dots[i], dots[j])) clashes.push(`${PORTS[i].id}/${PORTS[j].id} dots`);
    }
  }
  ok(clashes.length === 0, `no two names, or a name and a dot, overlap at 390x664 (board ${W}x${H}, 8px type)${clashes.length ? ": " + clashes.slice(0, 4).join(", ") : ""}`);
  ok(PORTS.every(p => p.x > 0 && p.x < W && p.y > 0 && p.y < H), "every port is on the board");
}

// ---------- the powers and events ----------
{
  ok(POWERS.length === 9 && POWERS.filter(p => p.euro).length === 4, "nine powers, four of them European or Mediterranean");
  ok(POWERS.every(p => p.homes.every(h => P(h) != null) && Object.keys(p.fleets).every(h => P(h) != null) && p.factors.every(h => P(h) != null)), "every start port exists");
  ok(EVENTS.length === 24 && new Set(EVENTS.map(e => e.id)).size === 24, "24 events, each once");
  const dated = EVENTS.filter(e => e.year);
  ok(dated.length === 21 && dated.every(e => e.year >= ERAS[e.round - 1][0] && e.year <= ERAS[e.round - 1][1]), "21 dated events, each in the era of its round");
  ok(ERAS.length === ROUNDS && ERAS.every((e, i) => i === 0 ? e[0] === 1480 : e[0] === ERAS[i - 1][1] + 1) && ERAS[ROUNDS - 1][1] === 1650, "eight eras run from 1480 to 1650 without a gap");
  ok(EVENTS.every(e => e.note.length > 20 && e.name.length > 2), "every event has a name and a note");
  ok(!EVENTS.some(e => /conquer|trophy|loot|spoils|enslave[ds]? .*reward/i.test(e.note + e.name)), "no event is told in the words of conquest or trophy");
  ok(!EVENTS.some(e => e.year === 1433), "Zheng He's last voyage (1433) is before the game: not an event");
}

// ---------- the deal ----------
{
  let fine = true;
  for (let n = 2; n <= 6; n++) for (let seed = 1; seed <= 40; seed++) {
    const G = R(n, seed), s = G.state;
    const euro = s.pw.filter(i => POWERS[i].euro).length;
    if (s.n !== n || new Set(s.pw).size !== n || euro > 3 || s.round !== 1 || s.step !== "orders") fine = false;
    for (let k = 0; k < n; k++) {
      if (s.si[k] < 1 || s.fl[k].reduce((a, b) => a + b, 0) < 1) fine = false;
      for (const h of POWERS[s.pw[k]].homes) if (s.own[P(h)] !== k) fine = false;
    }
    if (s.fl.some(f => f.some(c => c > CAP))) fine = false;
  }
  ok(fine, "a deal for 2 to 6 powers: distinct, at most three European, homes held, fleets within the cap");
  const a = JSON.stringify(R(4, 9).state), b = JSON.stringify(R(4, 9).state);
  ok(a === b && a !== JSON.stringify(R(4, 10).state), "the same seed deals the same game, another seed another");
  const chosen = R(3, 5, { powers: ["ming", "portugal", "swahili"] }).state;
  ok(chosen.pw.join() === [POWER_IDX.ming, POWER_IDX.portugal, POWER_IDX.swahili].join(), "the powers can be named");
  const s4 = R(4, 3).state;
  ok(s4.mono.every(m => m >= -1) && s4.stand.length === 4, "the opening standing and monopolies are worked out");
  ok(rules.toMove(s4) === 0 && rules.anytime({ t: "orders" }) && !rules.anytime({ t: "move" }), "seat 0 is first to be asked, and any seat may set its orders at any time");
}

// ---------- the dice ----------
{
  const e = exchange(1, 0, 1, 0);
  ok(Math.abs(e.win - 15 / 36) < 1e-9, "one die each: the attacker wins 15 of 36, the tie going to the defender");
  const e2 = exchange(3, 0, 2, 0), e3 = exchange(3, 1, 2, 0);
  ok(e3.win > e2.win && e2.dist.reduce((a, b) => a + b, 0) > 0.999999, "a bonus helps, and the chances add up to one");
  // against a simulation
  const rng = seeded(7), roll = () => 1 + Math.floor(rng() * 6);
  const sim = (na, ma, nd, md, n = 40000) => {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const a = Array.from({ length: na }, roll).sort((x, y) => y - x), d = Array.from({ length: nd }, roll).sort((x, y) => y - x);
      let any = false;
      for (let j = 0; j < Math.min(na, nd); j++) if (a[j] + ma > d[j] + md) any = true;
      if (any) w++;
    }
    return w / n;
  };
  ok(Math.abs(sim(3, 1, 2, 1) - exchange(3, 1, 2, 1).win) < 0.01 && Math.abs(sim(2, 0, 3, 1) - exchange(2, 0, 3, 1).win) < 0.01, "the exact odds match a simulation of the dice");
  // a port with no fleets and a garrison falls to one lost comparison; with two fleets it takes more
  const s = R(2, 1, { powers: ["portugal", "malacca"] }).state;
  const lone = attackOdds(s, 0, P("MLC"), 1, 1), strong = attackOdds(s, 0, P("MLC"), 3, 1);
  ok(strong.take > lone.take && lone.take >= 0 && strong.take <= 1, "more fleets take a defended port more often");
}

// ---------- orders together ----------
{
  const G0 = R(3, 11, { powers: ["portugal", "venice", "ming"] });
  const of = (G, seat) => botOrders(G.state, seat, { level: "medium", rng: seeded(3) });
  const orders = [0, 1, 2].map(k => of(G0, k));
  // in seat order
  let A = G0;
  for (const k of [0, 1, 2]) A = applyMove(rules, A, k, { t: "orders", orders: orders[k] }, 0).G;
  // in the opposite order, each out of turn
  let B = G0;
  for (const k of [2, 1, 0]) { const r = applyMove(rules, B, k, { t: "orders", orders: orders[k] }, 0); if (r.error) { ok(false, `out-of-order orders refused: ${r.error}`); break; } B = r.G; }
  ok(A.state.round === 2 && JSON.stringify(A.state) === JSON.stringify(B.state), "orders set in any order give the same round");
  const mid = applyMove(rules, G0, 1, { t: "orders", orders: orders[1] }, 0).G;
  ok(mid.state.round === 1 && mid.state.pend[1] !== 0 && mid.state.pend[0] === 0 && rules.toMove(mid.state) === 0, "orders wait for the others, and the first seat still to set is asked");
  ok(/in/i.test(applyMove(rules, mid, 1, { t: "orders", orders: orders[1] }, 0).error || ""), "a seat can't set its orders twice");
  ok(/orders/i.test(applyMove(rules, G0, 0, { t: "move" }, 0).error || ""), "anything but orders is refused");
  ok(!!applyMove(rules, G0, 0, { t: "orders", orders: [] }, 0).error && !!applyMove(rules, G0, 0, { t: "orders", orders: [{ t: "pass" }, { t: "pass" }] }, 0).error, "no orders, or a pass with others, is refused");
  ok(!applyMove(rules, G0, 0, { t: "orders", orders: [{ t: "pass" }] }, 0).error, "a pass is an order");
  const again = [0, 1, 2].reduce((G, k) => applyMove(rules, G, k, { t: "orders", orders: orders[k] }, 0).G, G0);
  ok(JSON.stringify(again.state) === JSON.stringify(A.state), "the same orders on the same game give the same round (dice from the game's seed)");
}

// ---------- grievance is a cost, never a reward ----------
{
  const base = () => R(4, 21, { powers: ["portugal", "swahili", "venice", "gujarat"] }).state;
  for (const [id, ports] of [["afonso", ["SAO", "ELM", "MPI"]], ["eastafrica", ["SOF", "KIL", "MOM", "MAL"]]]) {
    const s = base();
    for (const p of ports) s.own[P(p)] = 0;
    s.si[0] = 20;
    const before = { si: s.si.slice(), own: s.own.slice(), gr: s.gr.slice(), st: standing(s, 0), fl: s.fl.map(f => f.slice()), fort: s.fort.slice() };
    applyEvent(s, id, seeded(1), []);
    const after = standing(s, 0);
    ok(s.gr[0] === before.gr[0] + ports.length && s.si.join() === before.si.join() && s.own.join() === before.own.join() && s.fort.join() === before.fort.join() && after < before.st,
      `${id}: the holder takes ${ports.length} grievance tokens, loses standing, gains no silver, port or fort`);
  }
  {
    const s = base();
    s.F.potosi = 1; s.fac[P("SEV")] |= 1 << 2; s.own[P("SEV")] = 0;
    const gr = s.gr.slice(), si = s.si.slice();
    applyEvent(s, "mita", seeded(1), []);
    ok(s.gr[0] === gr[0] + 1 && s.gr[2] === gr[2] + 1 && s.gr[1] === gr[1] && s.si.join() === si.join(), "mita: everyone with a hand in Seville's silver takes a token, and no one gains silver");
  }
  {
    // an attack on a port is a bombardment: one token for the attacker, win or lose
    const s = R(2, 1, { powers: ["portugal", "malacca"] }).state;
    s.fl[0][P("MLC")] = 3; s.fl[0][P("LIS")] = 0;
    const gr0 = s.gr[0];
    s.pend = [0, 0];
    resolveRound(s, [[{ t: "pass" }], [{ t: "pass" }]], seeded(5), { events: false, hazard: false });
    ok(s.gr[0] === gr0, "(no attack, no token)");
    const t = R(2, 1, { powers: ["portugal", "malacca"] }).state;
    t.fl[0][P("MLC")] = 3;
    resolveRound(t, [[{ t: "move", from: P("MLC"), to: P("MLC"), n: 1 }], [{ t: "pass" }]], seeded(5), { events: false });
    ok(t.gr[0] === 0, "(an order that can't be carried out costs nothing)");
    const u = R(2, 1, { powers: ["portugal", "malacca"] }).state;
    u.fl[0][P("ACE")] = 2; u.fac[P("ACE")] = 0;
    // Portugal at Aceh (natives) attacks Malacca's port one lane away
    const mv = { t: "move", from: P("ACE"), to: P("MLC"), n: 2, atk: 1 };
    ok(checkOrders(u, 0, [mv]) === "", "an attack on a port one lane away is a legal order");
    resolveRound(u, [[mv], [{ t: "pass" }]], seeded(5), { events: false, hazard: false });
    ok(u.gr[0] === 1, "an attack on a port costs the attacker one grievance token");
    const v = R(2, 1, { powers: ["portugal", "malacca"] }).state;
    v.gr[0] = 1; v.si[0] = 10;
    resolveRound(v, [[{ t: "redress" }], [{ t: "pass" }]], seeded(5), { events: false, hazard: false });
    ok(v.gr[0] === 0 && v.si[0] < 10 + 8, "a token is paid down only in silver (redress), 4 silver for one");
  }
}

// ---------- the state through the database ----------
{
  const G = R(5, 17);
  const S = roundTrip(JSON.parse(JSON.stringify(G)));
  ok(S && JSON.stringify(rules.restore(S.state)) === JSON.stringify(rules.restore(JSON.parse(JSON.stringify(G.state)))), "a fresh state comes back whole from the database");
  let A = R(4, 31), B = R(4, 31);
  while (!rules.over(A.state)) {
    const seat = rules.toMove(A.state);
    A = applyMove(rules, A, seat, botMove(rules, A, seat, "medium"), 0).G;
    const seatB = rules.toMove(B.state);
    B = roundTrip(applyMove(rules, B, seatB, botMove(rules, B, seatB, "medium"), 0).G);
  }
  ok(JSON.stringify(rules.restore(B.state)) === JSON.stringify(A.state), "a whole game with the state through the database after every move ends the same");
}

// ---------- a second rulebook ----------
// Written again from the rules (docs/carrack.md), reading the map's lanes and not the engine's adjacency or reach.
function second(s, seat, orders) {
  if (!Array.isArray(orders) || orders.length < 1 || orders.length > 3) return "count";
  if (orders.some(o => o && o.t === "pass")) return orders.length === 1 ? "" : "pass";
  const pid = POWERS[s.pw[seat]].id;
  const N = s.n, ott = s.pw.indexOf(POWER_IDX.ottomans), holder = s.own[P("MLC")];
  const shut = q => {
    if (q === P("NAG") && !s.F.naga) return true;
    if (q === P("BDA") && s.F.banda) return true;
    if ((q === P("GUA") || q === P("YUE")) && s.F.ban && pid !== "ming" && pid !== "ryukyu") return true;
    if (q === P("NIN") && pid !== "ming" && pid !== "ryukyu") return true;
    if ((q === P("HAK") || q === P("NAG")) && s.F.japan && pid !== "ming" && pid !== "ryukyu") return true;
    if (q === P("NOV") && s.F.peter && pid === "hanse") return true;
    return false;
  };
  const sailable = (lane, a, b) => {
    if (b === P("NAG") && !s.F.naga) return false;
    if (lane.f.includes("o") && !s.oc[seat]) return false;
    if (lane.f.includes("m")) {
      const rim = pid === "gujarat" && [4, 5, 6].includes(PORTS[a].region) && [4, 5, 6].includes(PORTS[b].region);
      if (!rim) {
        if (s.F.nomon) return false;
        if ((PORTS[b].x > PORTS[a].x) !== (s.round % 2 === 1)) return false;
      }
    }
    if (pid === "ming" && s.F.ban && ![7, 8].includes(PORTS[b].region)) return false;
    return true;
  };
  const best = from => {
    const out = new Map();
    const walk = (at, days, path, laneUsed) => {
      for (const lane of LANES) {
        let b;
        if (lane.a === at) b = lane.b; else if (lane.b === at) b = lane.a; else continue;
        if (days + lane.days > 3 || b === from || path.includes(b) || !sailable(lane, at, b)) continue;
        const used = [...laneUsed, { lane, a: at, b }];
        const p2 = [...path, b], d2 = days + lane.days;
        let toll = 0;
        const ottToll = ott >= 0 && ott !== seat && pid !== "ottomans" && pid !== "gujarat" && used.some(u => (u.lane.f.includes("r") && s.F.egypt) || u.a === P("CON") || u.b === P("CON"));
        const malToll = holder >= 0 && holder !== seat && !["malacca", "gujarat", "ryukyu"].includes(pid) && used.some(u => u.b === P("MLC"));
        toll = (ottToll ? 1 : 0) + (malToll ? 1 : 0);
        const pir = used.filter(u => u.lane.f.includes("p")).length;
        const rank = [d2, toll, pir, p2.length];
        const cur = out.get(b);
        const less = (x, y) => { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
        if (!cur || less(rank, cur.rank)) out.set(b, { rank, toll, closed: shut(b) });
        if (!shut(b)) walk(b, d2, p2, used);
      }
    };
    walk(from, 0, [], []);
    return out;
  };
  let silver = s.si[seat];
  const leave = Array(N_PORTS).fill(0), arrive = Array(N_PORTS).fill(0), built = Array(N_PORTS).fill(0), seen = new Set();
  const dests = new Set(orders.filter(o => o && o.t === "move").map(o => o.to));
  const cap = pid === "gujarat" ? 1 : 3;
  const buildCost = p => (pid === "gujarat" ? 4 : pid === "ottomans" && PORTS[p].region !== 2 && p !== P("ADE") ? 6 : 3);
  const port = o => Number.isInteger(o.port) && o.port >= 0 && o.port < N_PORTS;
  for (const o of orders) {
    if (!o || typeof o !== "object") return "shape";
    if (o.t !== "move") { const k = `${o.t}:${o.port ?? ""}`; if (seen.has(k)) return "dup"; seen.add(k); }
    switch (o.t) {
      case "move": {
        if (![o.from, o.to, o.n].every(Number.isInteger) || o.from < 0 || o.from >= N_PORTS || o.to < 0 || o.to >= N_PORTS || o.n < 1 || o.n > 3) return "move shape";
        leave[o.from] += o.n;
        if (leave[o.from] > s.fl[seat][o.from] || o.from === o.to) return "fleets";
        const r = best(o.from).get(o.to);
        if (!r) return "unreachable";
        if (o.atk != null) {
          if (!Number.isInteger(o.atk) || o.atk < -2 || o.atk >= N || o.atk === seat) return "atk shape";
          const owner = s.own[o.to];
          if (o.atk === -2 ? owner !== -1 : (o.atk !== owner && s.fl[o.atk][o.to] < 1)) return "atk target";
          const tp = o.atk >= 0 ? POWERS[s.pw[o.atk]].id : "";
          if ((pid === "ming" && tp === "ryukyu") || (pid === "ryukyu" && tp === "ming")) return "tribute";
          if (o.to === P("NAG") && !s.F.naga) return "inactive";
          if (o.to === P("BDA") && s.F.banda) return "Banda closed";
        } else if (r.closed) return "shut";
        silver -= r.toll; arrive[o.to] += o.n;
        break;
      }
      case "factor": {
        if (!port(o) || s.own[o.port] === seat || ((s.fac[o.port] >> seat) & 1) || shut(o.port)) return "factor";
        const kontor = pid === "hanse" && (PORTS[o.port].region === 0 || o.port === P("LON")) && !(o.port === P("LON") && s.F.steel);
        if (!kontor && s.fl[seat][o.port] < 1 && !dests.has(o.port)) return "factor needs a fleet";
        silver -= 2; break;
      }
      case "build": if (!port(o) || s.own[o.port] !== seat) return "build"; built[o.port]++; silver -= buildCost(o.port); break;
      case "fort": {
        if (!port(o) || s.fort[o.port]) return "fort";
        if (s.own[o.port] !== seat && !(pid === "portugal" && ((s.fac[o.port] >> seat) & 1) && !shut(o.port))) return "fort rights";
        silver -= 3; break;
      }
      case "claim": {
        if (!port(o) || s.own[o.port] !== -1 || (o.port === P("NAG") && !s.F.naga) || !((s.fac[o.port] >> seat) & 1) || shut(o.port)) return "claim";
        if (s.fl[seat][o.port] < 1 && !dests.has(o.port)) return "claim needs a fleet";
        silver -= 4; break;
      }
      case "refit": if (s.oc[seat]) return "refit"; silver -= s.F.voc ? 2 : 4; break;
      case "redress": if (s.gr[seat] < 1) return "redress"; silver -= 4; break;
      default: return "kind";
    }
  }
  for (let p = 0; p < N_PORTS; p++) {
    if (built[p] > 1) return "two builds";
    if (s.fl[seat][p] - leave[p] + arrive[p] + built[p] > cap) return "cap";
  }
  return silver < 0 ? "silver" : "";
}

// ---------- whole games ----------
const states = [];
function playGame(level, seats, seed, { watch = false, options } = {}) {
  let G = R(seats, seed, options);
  let acts = 0, problems = [];
  const check = (st, tag) => {
    for (let k = 0; k < st.n; k++) {
      if (!(st.si[k] >= 0) || !(st.gr[k] >= 0) || st.fl[k].some(c => !(c >= 0) || c > 3)) problems.push(`${tag}: seat ${k} silver/grievance/fleets out of range`);
      if (!Number.isFinite(st.stand[k])) problems.push(`${tag}: standing is not a number`);
    }
    for (let p = 0; p < N_PORTS; p++) if (st.own[p] < -1 || st.own[p] >= st.n) problems.push(`${tag}: port ${p} has owner ${st.own[p]}`);
    if (st.round < 1 || st.round > ROUNDS) problems.push(`${tag}: round ${st.round}`);
  };
  while (!rules.over(G.state) && acts < 400) {
    const seat = rules.toMove(G.state);
    const mv = botMove(rules, G, seat, level);
    const sec = second(G.state, seat, mv.orders);
    if (sec) problems.push(`R${G.state.round} seat ${seat} ${level}: the second rulebook refuses what the bot set (${sec}): ${JSON.stringify(mv.orders)}`);
    if (watch && seat === 0) states.push(JSON.parse(JSON.stringify(G.state)));
    const r = applyMove(rules, G, seat, mv, 0);
    if (r.error) { problems.push(`R${G.state.round} seat ${seat}: ${r.error}`); break; }
    G = r.G; acts++;
    check(G.state, `act ${acts}`);
  }
  const s = G.state;
  return { G, s, acts, problems, over: rules.over(s) };
}

for (const [level, games] of [["easy", 12], ["medium", 12], ["hard", 6]]) {
  let allOver = true, caps = true, problems = [], lens = [];
  for (let i = 0; i < games; i++) {
    const seats = 2 + (i % 5);
    const r = playGame(level, seats, 100 + i * 7, { watch: level === "medium" });
    if (!r.over) allOver = false;
    if (r.acts > ROUNDS * seats) caps = false;
    lens.push(r.s.round);
    problems.push(...r.problems);
  }
  ok(allOver, `${level}: ${games} games of 2 to 6 powers all play to the end`);
  ok(caps && lens.every(l => l <= ROUNDS), `${level}: no game runs past ${ROUNDS} rounds (${ROUNDS * 2}..${ROUNDS * 6} sets of orders at most)`);
  ok(problems.length === 0, `${level}: every order set was legal by the second rulebook, and silver, fleets, owners and rounds stayed in range${problems.length ? "\n  " + problems.slice(0, 3).join("\n  ") : ""}`);
}
{
  const r = playGame("medium", 4, 5);
  const s = r.s;
  ok(s.res && s.res.order.length === 4 && s.res.winners.length >= 1 && s.res.winners.every(w => s.stand[w] === Math.max(...s.stand)), "the winner has the highest standing");
  ok(s.hist.length === s.round && s.hist.every(h => h.length === 4), "a standing is kept for every round");
  ok(s.log.length > 0 && s.log.every(l => typeof l === "string" && !/undefined|NaN/.test(l)), "the last round's story is plain text");
}

// ---------- the rulebooks against each other ----------
{
  const rng = seeded(2024), pick = a => a[Math.floor(rng() * a.length)], int = n => Math.floor(rng() * n);
  let legal = 0, illegal = 0, differ = [];
  const sample = states.slice(0, 120);
  for (const s of sample) {
    for (let t = 0; t < 24; t++) {
      const seat = int(s.n), mine = []; for (let p = 0; p < N_PORTS; p++) if (s.fl[seat][p] > 0) mine.push(p);
      const list = [];
      const n = 1 + int(3);
      for (let i = 0; i < n; i++) {
        const kind = pick(["move", "move", "move", "factor", "factor", "build", "fort", "claim", "refit", "redress", "pass"]);
        const anyPort = () => (rng() < 0.6 && mine.length ? pick(mine) : int(N_PORTS));
        const o = { t: kind };
        if (kind === "move") {
          o.from = mine.length && rng() < 0.9 ? pick(mine) : int(N_PORTS); o.n = 1 + int(3);
          const adj = ADJ[o.from].map(e => e.to);
          o.to = rng() < 0.6 ? pick(adj) : int(N_PORTS);
          if (rng() < 0.3) { const two = pick(ADJ[o.to]); if (rng() < 0.5) o.to = two.to; }
          if (rng() < 0.35) o.atk = rng() < 0.3 ? -2 : int(s.n);
        } else if (["factor", "build", "fort", "claim"].includes(kind)) o.port = anyPort();
        list.push(o);
      }
      const a = checkOrders(s, seat, list) === "", b = second(s, seat, list) === "";
      if (a) legal++; else illegal++;
      if (a !== b) differ.push(`${a ? "engine" : "second"} allows ${JSON.stringify(list)} (R${s.round} seat ${seat})`);
    }
  }
  ok(legal >= 120 && illegal >= 300, `random orders cover both sides: ${legal} legal, ${illegal} not`);
  ok(differ.length === 0, `the engine and the second rulebook agree on every random set of orders${differ.length ? "\n  " + differ.slice(0, 3).join("\n  ") : ""}`);
}

// ---------- speed ----------
{
  const s = R(4, 77).state;
  const t0 = performance.now();
  for (let i = 0; i < 4; i++) botOrders(s, i, { level: "hard", rng: seeded(i) });
  const hard = (performance.now() - t0) / 4;
  const t1 = performance.now();
  for (let i = 0; i < 4; i++) botOrders(s, i, { level: "medium", rng: seeded(i) });
  const med = (performance.now() - t1) / 4;
  ok(hard < 250 && med < 60, `a bot sets its orders fast enough for a phone (Hard ${hard.toFixed(0)} ms, Medium ${med.toFixed(0)} ms here)`);
}

// ---------- unused helpers kept honest ----------
ok(typeof monopolies === "function" && typeof held === "function" && typeof closedTo === "function" && typeof active === "function" && typeof seatOfPower === "function" && typeof take === "function" && typeof nextSeat === "function" && typeof submit === "function" && GOODS.length === 6, "the helpers the page will use are exported");

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
