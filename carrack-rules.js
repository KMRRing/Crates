// Carrack: a contest for trade from the Baltic to China, c. 1480 to 1650, for two to six powers drawn from nine (four
// European or Mediterranean, five not). Eight rounds, each a trading year in one era (ERAS), each power setting up to three
// secret orders at once (move a fleet up to three sailing days, found a factor, build a fleet or a fort, buy ocean ships,
// claim a port, pay down grievance), all carried out together: payments, moves, battles, then the rest, then income, then
// the era's events. The standing at the end is ports held + factors + 3 a monopoly + silver/4 - 2 a grievance token.
//
// Force, forced labour and enslavement are on the board as costs. Attacking a port is a bombardment: a grievance token
// for the attacker. The events that record enslavement or forced labour give the holders of the ports concerned grievance
// tokens, never silver or standing. No order earns anything from people's suffering; grievance is only paid down in
// silver (`redress`), never erased free. Dates and figures: docs/carrack.md.
//
// State (plain JSON, fixed-length arrays; the database keeps no empty lists): see deal(). Ports are the indices of
// carrack-map.js.
import { PORTS, N_PORTS, IDX, ADJ, GOODS } from "./carrack-map.js";
import { shuffle } from "./seats.js";
import { submit, take, nextSeat, waiting, isOrders } from "./carrack-orders.js";

export const ROUNDS = 8;
/** The years each round stands for. */
export const ERAS = [[1480, 1497], [1498, 1516], [1517, 1539], [1540, 1564], [1565, 1589], [1590, 1611], [1612, 1631], [1632, 1650]];
export const CAP = 3;                       // fleets of one power in one port
export const MAX_ORDERS = 3;
/** Silver that counts for one standing point at the end. */
export const SILVER_PER_POINT = 8;
export const COST = { factor: 2, build: 3, fort: 3, refit: 4, claim: 4, redress: 4 };
export const LEVELS = ["easy", "medium", "hard"];

const P = id => IDX[id];
/** Regions where ocean ships matter (the Atlantic, the Indian Ocean and its seas). */
const OCEAN_REGIONS = new Set([1, 3, 4, 5, 6]);
const RIM = new Set([4, 5, 6]);

// ---------- the nine powers ----------
// euro: counts toward the cap of three European or Mediterranean powers at a table. sea: the home seas (regions): +1 to
// every die there.
export const POWERS = [
  { id: "hanse", name: "Hanse", euro: 1, sea: [0, 1], homes: ["LUB", "REV"], fleets: { LUB: 1, REV: 1 }, factors: [], silver: 6, ocean: 0, base: -1, baseName: "league dues" },
  { id: "portugal", name: "Portugal", euro: 1, sea: [1, 3], homes: ["LIS", "ELM"], fleets: { LIS: 1, ELM: 1 }, factors: [], silver: 7, ocean: 1, base: -3, baseName: "the Estado's upkeep" },
  { id: "venice", name: "Venice", euro: 1, sea: [2], homes: ["VEN"], fleets: { VEN: 3 }, factors: ["ALE", "CON"], silver: 7, ocean: 0, base: 3, baseName: "the Republic's revenue" },
  { id: "ottomans", name: "Ottomans", euro: 1, sea: [2], homes: ["CON"], fleets: { CON: 3 }, factors: [], silver: 8, ocean: 0, base: 2, baseName: "the sultan's revenue" },
  { id: "ming", name: "Ming China", euro: 0, sea: [7, 8], homes: ["GUA", "NIN", "YUE"], fleets: { GUA: 1, NIN: 1 }, factors: ["NAH", "MNL"], silver: 2, ocean: 0, base: 0, baseName: "the empire's revenue" },
  { id: "gujarat", name: "Gujarat", euro: 0, sea: [5], homes: ["CAM"], fleets: { CAM: 1 }, factors: ["MLC", "CAL", "ADE"], silver: 8, ocean: 0, base: 0, baseName: "cloth exports" },
  { id: "malacca", name: "Malacca", euro: 0, sea: [6], homes: ["MLC"], fleets: { MLC: 2 }, factors: ["ACE", "BAN"], silver: 9, ocean: 0, base: 1, baseName: "harbour dues" },
  { id: "ryukyu", name: "Ryukyu", euro: 0, sea: [7], homes: ["NAH"], fleets: { NAH: 2 }, factors: ["GUA", "YUE", "NIN"], silver: 5, ocean: 0, base: 0, baseName: "tribute missions" },
  { id: "swahili", name: "Swahili coast", euro: 0, sea: [4], homes: ["KIL", "MOM", "MAL"], fleets: { KIL: 1, MOM: 1 }, factors: ["SOF"], silver: 8, ocean: 0, base: 3, baseName: "inland trade" },
];
export const POWER_IDX = Object.fromEntries(POWERS.map((p, i) => [p.id, i]));
const HANSE = 0, PORTUGAL = 1, VENICE = 2, OTTOMANS = 3, MING = 4, GUJARAT = 5, MALACCA = 6, RYUKYU = 7, SWAHILI = 8;

// ---------- the events (24): 21 in their era, 3 hazards ----------
// round: the era they fall in. Each has a plain one-line note; figures that are argued say so.
export const EVENTS = [
  { id: "elmina", year: 1482, round: 1, name: "São Jorge da Mina", note: "Portugal builds a fort at Elmina on the Gold Coast (1482) to hold the gold trade." },
  { id: "peterhof", year: 1494, round: 1, name: "The Peterhof closed", note: "Ivan III closes the Hanse's Peterhof at Novgorod and seizes its goods (1494); it reopens in 1514, but Novgorod's trade has begun to decline." },
  { id: "calicut", year: 1498, round: 2, name: "Da Gama at Calicut", note: "Vasco da Gama reaches Calicut (May 1498) by the Cape route; a Portuguese factor follows with Cabral (1500)." },
  { id: "kilwa", year: 1505, round: 2, name: "Kilwa and Mombasa", note: "A Portuguese fleet takes tribute from Kilwa and attacks Mombasa (1505), and demands more." },
  { id: "goa", year: 1510, round: 2, name: "Goa", note: "Albuquerque takes Goa (1510), the base of Portugal's Estado da Índia." },
  { id: "malacca", year: 1511, round: 2, name: "The fall of Malacca", note: "Portugal takes Malacca (1511); Tomé Pires wrote that whoever held it had his hand on Venice's throat." },
  { id: "egypt", year: 1517, round: 3, name: "Egypt falls to the Ottomans", note: "Selim I defeats the Mamluk sultanate (1516 to 1517); Egypt and Syria, with Alexandria, Aleppo and the Red Sea route, become Ottoman." },
  { id: "iwami", year: 1526, round: 3, name: "Iwami silver", note: "The Iwami mine in Japan opens (1526); Japanese silver soon flows to China through Hakata." },
  { id: "afonso", year: 1526, round: 3, name: "The Kongo letters", note: "King Afonso I of Kongo writes to Portugal (1526) that the slave trade is depopulating his kingdom; São Tomé, Elmina and Mpinda are where it is run." },
  { id: "potosi", year: 1545, round: 4, name: "Potosí", note: "Silver is found at Potosí (1545); it reaches the world through Seville." },
  { id: "eastafrica", year: 1550, round: 4, name: "Enslaved people from the east coast", note: "People are taken from the Swahili coast and Mozambique to Arabia, India and the Atlantic across the century; the totals over the centuries are argued, in the millions." },
  { id: "manila", year: 1565, round: 5, name: "The Manila galleons", note: "The Pacific route from Manila to Acapulco opens (1565 to 1571); American silver reaches China." },
  { id: "ban", year: 1567, round: 5, name: "Yuegang opened", note: "The Ming relax the sea ban at Yuegang (1567); Chinese merchants may trade abroad from there. Ningbo stays closed." },
  { id: "nagasaki", year: 1571, round: 5, name: "Nagasaki", note: "Nagasaki opens as a port for Portuguese ships (1571)." },
  { id: "mita", year: 1573, round: 5, name: "The mita", note: "The viceroy Toledo organises forced labour for Potosí's mines (1573); mortality is argued." },
  { id: "steelyard", year: 1598, round: 6, name: "The Steelyard closed", note: "Elizabeth I closes the Hanse's Steelyard in London (1598)." },
  { id: "voc", year: 1602, round: 6, name: "The VOC", note: "The Dutch East India Company is founded (1602); ocean ships are common and Portugal's lead in them ends." },
  { id: "satsuma", year: 1609, round: 6, name: "Satsuma and Ryukyu", note: "Satsuma invades the Ryukyu Kingdom (1609); it keeps its tribute trade with China under Satsuma's watch." },
  { id: "banda", year: 1621, round: 7, name: "Banda", note: "The VOC takes the Banda Islands by force (1621): of roughly 15,000 people, about 1,000 remained by one account, 90 percent killed, enslaved or driven out by another." },
  { id: "japan", year: 1635, round: 8, name: "Japan closes", note: "The shogunate bars foreign ships and Japanese travel abroad (edicts of 1633 to 1639); only the Dutch and Chinese, and Ryukyu and Korea by other doors, remain." },
  { id: "mingfall", year: 1644, round: 8, name: "The Ming fall", note: "Rebels take Beijing and the Qing follow (1644); the coast's trade is disrupted for years." },
  { id: "typhoon", year: 0, round: 0, name: "A typhoon", note: "A typhoon in the China Sea sinks a fleet." },
  { id: "monsoon", year: 0, round: 0, name: "A failed monsoon", note: "The monsoon fails: no one may sail a monsoon lane next round." },
  { id: "plague", year: 0, round: 0, name: "Plague in a port", note: "Plague empties a port: its holder loses silver and a fleet." },
];
const HAZARDS = ["typhoon", "monsoon", "plague"];

// ---------- helpers ----------
const ne = () => Array(N_PORTS).fill(0);
const sum = a => a.reduce((x, y) => x + y, 0);
const bit = seat => 1 << seat;
export const hasFactor = (s, p, seat) => (s.fac[p] & bit(seat)) !== 0;
export const powerOf = (s, seat) => POWERS[s.pw[seat]];
export const seatOfPower = (s, id) => s.pw.indexOf(POWER_IDX[id]);
const nm = (s, seat) => (seat >= 0 ? powerOf(s, seat).name : "the port's people");

/** Ports where the Hanse founds a factor without a fleet: the Baltic and the North Sea (London, Antwerp). */
export const kontorPort = p => PORTS[p].region === 0 || p === P("LON");
/** Is the port in play (Nagasaki only after 1571)? */
export const active = (s, p) => !(p === P("NAG") && !s.F.naga);
/** Is the port shut to this seat's fleets and factors? (the sea ban, Japan, Banda, the Peterhof) */
export function closedTo(s, seat, p) {
  const pi = s.pw[seat];
  if (!active(s, p)) return true;
  if (p === P("BDA") && s.F.banda) return true;
  if ((p === P("GUA") || p === P("YUE")) && s.F.ban && pi !== MING && pi !== RYUKYU) return true;
  if (p === P("NIN") && pi !== MING && pi !== RYUKYU) return true;
  if ((p === P("HAK") || p === P("NAG")) && s.F.japan && pi !== MING && pi !== RYUKYU) return true;
  if (p === P("NOV") && s.F.peter && pi === HANSE) return true;
  return false;
}
/** What a held port pays a round. */
export function portValue(s, p) {
  let v = PORTS[p].value;
  if (p === P("BDA") && s.F.banda) return 0;
  if (p === P("HAK") && s.F.iwami) v++;
  if (p === P("SEV") && s.F.potosi) v++;
  if (p === P("MNL") && s.F.manila) v++;
  return v;
}
export const fleetsAt = (s, p) => s.fl.reduce((a, f) => a + f[p], 0);
const totalFleets = (s, seat) => sum(s.fl[seat]);

// ---------- goods and monopolies ----------
/** The source ports of a good that are in play now. */
export function sourcesOf(s, g) {
  const G = GOODS[g];
  return G.ports.filter((p, i) => {
    const late = G.late?.[G.src[i]];
    if (late && !s.F[late]) return false;
    if (p === P("BDA") && s.F.banda) return false;
    return active(s, p);
  });
}
/** How many of a good's source ports a seat has a hand in (holds or has a factor at). */
export function presence(s, g, seat) {
  let c = 0;
  for (const p of sourcesOf(s, g)) if (s.own[p] === seat || hasFactor(s, p, seat)) c++;
  return c;
}
/** Who holds each good's monopoly: the most source ports, at least two, alone; a tie at the top keeps the old holder if tied. */
export function monopolies(s, prev = s.mono) {
  return GOODS.map((_, g) => {
    let best = 1, who = -1, tie = [];
    for (let k = 0; k < s.n; k++) {
      const c = presence(s, g, k);
      if (c > best) { best = c; who = k; tie = [k]; } else if (c === best && c >= 2) tie.push(k);
    }
    if (who < 0) return -1;
    if (tie.length > 1) return tie.includes(prev?.[g]) ? prev[g] : -1;
    return who;
  });
}

// ---------- standing and income ----------
export const held = (s, seat) => { let c = 0; for (let p = 0; p < N_PORTS; p++) if (s.own[p] === seat) c++; return c; };
export const factors = (s, seat) => { let c = 0; for (let p = 0; p < N_PORTS; p++) if (hasFactor(s, p, seat) && active(s, p)) c++; return c; };
/** Standing now (as it would count if the game ended). */
export function standing(s, seat, mono = s.mono) {
  return 2 * held(s, seat) + factors(s, seat) + 3 * mono.filter(m => m === seat).length + Math.floor(s.si[seat] / SILVER_PER_POINT) - 2 * s.gr[seat];
}
/** Silver a round: [total, lines]. */
export function incomeOf(s, seat, mono = s.mono) {
  const pi = s.pw[seat], parts = [];
  const add = (n, what) => { if (n) parts.push([n, what]); };
  let ports = 0, fac = 0;
  for (let p = 0; p < N_PORTS; p++) {
    if (s.own[p] === seat) ports += portValue(s, p);
    else if (hasFactor(s, p, seat) && active(s, p) && !(p === P("BDA") && s.F.banda)) fac++;
  }
  add(ports, "ports"); add(Math.floor(fac / 2), "factors");
  let goods = 0;
  for (let g = 0; g < GOODS.length; g++) goods += Math.min(1, presence(s, g, seat));
  add(goods, "goods");
  add(3 * mono.filter(m => m === seat).length, "monopolies");
  const H = i => s.own[P(i)] === seat, F = i => hasFactor(s, P(i), seat);
  const other = (p, k) => { let c = 0; for (let j = 0; j < s.n; j++) if (j !== k && hasFactor(s, p, j)) c++; return c; };
    const ptk = seatOfPower(s, "portugal");
  if (pi === VENICE && (ptk < 0 || mono[0] !== ptk)) add(["ALE", "CON", "ALP"].filter(i => F(i) && !(i === "ALE" && s.F.egypt && seatOfPower(s, "ottomans") >= 0)).length, "Levant premium");
  if (pi === OTTOMANS) add((H("CON") ? 1 : 0) + (H("ALE") ? 1 : 0) + (H("ADE") ? 1 : 0) + (H("ALP") ? 1 : 0), "straits and Red Sea");
  if (pi === MING && !s.F.mingfall) { add(3 * ((H("GUA") ? 1 : 0) + (H("NIN") ? 1 : 0)), "the great market"); if (s.F.ban) add(-1, "the sea ban"); }
  if (pi === GUJARAT) add(Math.min(2, ["MLC", "CAL", "ADE", "HOR", "CAM"].reduce((a, i) => a + (F(i) ? other(P(i), seat) : 0), 0)), "carrying for others");
  if (pi === MALACCA && H("MLC")) add(1 + Math.min(3, other(P("MLC"), seat)), "the strait");
  if (pi === RYUKYU) add(["GUA", "YUE", "NIN"].filter(F).length * (s.F.ban ? 2 : 1), "the go-between");
  if (pi === SWAHILI) add(2 * ["SOF", "KIL"].filter(i => H(i)).length, "gold");
  add(POWERS[pi].base, POWERS[pi].baseName);
  add(-Math.floor(totalFleets(s, seat) / 2), "upkeep");
  return [parts.reduce((a, b) => a + b[0], 0), parts];
}

// ---------- routes ----------
/**
 * Where a seat's fleets at `from` can sail this round: Map port → { days, tolls: [[holder seat, 1]…], pir (pirate lanes),
 * path (ports after from), closed (a port shut to them: only an attack may end there) }. At most three sailing days.
 */
export function reach(s, seat, from) {
  const pi = s.pw[seat], res = new Map();
  const east = s.round % 2 === 1;
  const ott = seatOfPower(s, "ottomans");
  const own = pi === OTTOMANS || pi === GUJARAT;
  const mlcHolder = s.own[P("MLC")];
  const freeMalacca = pi === MALACCA || pi === GUJARAT || pi === RYUKYU;
  function sail(a, e) {
    if (!active(s, e.to)) return false;
    if (e.f.includes("o") && !s.oc[seat]) return false;
    if (e.f.includes("m")) {
      const rim = pi === GUJARAT && RIM.has(PORTS[a].region) && RIM.has(PORTS[e.to].region);
      if (!rim) { if (s.F.nomon) return false; if (e.east !== east) return false; }
    }
    if (pi === MING && s.F.ban && PORTS[e.to].region !== 7 && PORTS[e.to].region !== 8) return false;
    return true;
  }
  const consider = (to, days, path, ottoll, malToll, pir, closed) => {
    const key = days * 1000 + (ottoll ? 100 : 0) + (malToll ? 100 : 0) + pir * 10 + path.length;
    const old = res.get(to);
    if (old && old.key <= key) return;
    const tolls = [];
    if (ottoll) tolls.push([ott, 1]);
    if (malToll) tolls.push([mlcHolder, 1]);
    res.set(to, { days, tolls, pir, path: path.slice(), closed, key });
  };
  (function dfs(p, days, path, ottoll, malToll, pir) {
    for (const e of ADJ[p]) {
      const d = days + e.days;
      if (d > 3 || !sail(p, e)) continue;
      const q = e.to;
      if (q === from || path.includes(q)) continue;
      const ot = ottoll || (!own && ott >= 0 && ott !== seat && ((e.f.includes("r") && s.F.egypt) || p === P("CON") || q === P("CON")));
      const mt = malToll || (!freeMalacca && mlcHolder >= 0 && mlcHolder !== seat && q === P("MLC"));
      const pr = pir + (e.f.includes("p") ? 1 : 0);
      const closed = closedTo(s, seat, q);
      path.push(q);
      consider(q, d, path, ot, mt, pr, closed);
      if (!closed) dfs(q, d, path, ot, mt, pr);
      path.pop();
    }
  })(from, 0, [], false, false, 0);
  for (const v of res.values()) delete v.key;
  return res;
}

// ---------- orders ----------
const key = o => `${o.t}:${o.port ?? ""}`;
const isInt = v => Number.isInteger(v);
const buildCost = (s, seat, p) => {
  const pi = s.pw[seat];
  if (pi === GUJARAT) return COST.build + 1;
  if (pi === OTTOMANS && PORTS[p].region !== 2 && p !== P("ADE")) return 2 * COST.build;
  return COST.build;
};
const refitCost = s => (s.F.voc ? 2 : COST.refit);
/** What an order costs its seat in silver (tolls on the way not counted). */
export const orderCost = (s, seat, o) => ({ factor: COST.factor, build: o.t === "build" ? buildCost(s, seat, o.port) : 0, fort: COST.fort, claim: COST.claim, refit: refitCost(s), redress: COST.redress })[o.t] || 0;
const fleetCap = (s, seat) => (s.pw[seat] === GUJARAT ? 1 : CAP);

/** Why a seat's orders can't be set now, or "" when they can. */
export function checkOrders(s, seat, orders) {
  if (s.step === "over") return "The game is over";
  if (!Array.isArray(orders) || orders.length < 1 || orders.length > MAX_ORDERS) return "Give one to three orders";
  if (orders.some(o => o?.t === "pass")) return orders.length === 1 ? "" : "Pass stands alone";
  const pi = s.pw[seat];
  let silver = s.si[seat];
  const leave = ne(), arrive = ne(), built = ne(), dest = new Set(), seen = new Set(), rc = new Map();
  for (const o of orders) {
    if (!o || typeof o !== "object") return "Not an order";
    const k = key(o);
    if (seen.has(k) && o.t !== "move") return "The same order twice";
    seen.add(k);
    if (o.t === "move") {
      if (!isInt(o.from) || !isInt(o.to) || !isInt(o.n) || o.from < 0 || o.to < 0 || o.from >= N_PORTS || o.to >= N_PORTS) return "A move needs from, to and how many";
      if (o.n < 1 || o.n > CAP) return "Move one to three fleets";
      leave[o.from] += o.n;
      if (leave[o.from] > s.fl[seat][o.from]) return `You haven't that many fleets at ${PORTS[o.from].name}`;
      if (o.from === o.to) return "That fleet is already there";
      if (!rc.has(o.from)) rc.set(o.from, reach(s, seat, o.from));
      const r = rc.get(o.from).get(o.to);
      if (!r) return `${PORTS[o.to].name} is out of reach this round`;
      if (o.atk != null) {
        if (!isInt(o.atk) || o.atk < -2 || o.atk >= s.n || o.atk === seat) return "Attack whom?";
        const owner = s.own[o.to];
        if (o.atk === -2) { if (owner !== -1) return "Natives hold no port there"; }
        else if (o.atk !== owner && s.fl[o.atk][o.to] < 1) return `${nm(s, o.atk)} has nothing at ${PORTS[o.to].name}`;
        if ((pi === MING && s.pw[o.atk] === RYUKYU) || (pi === RYUKYU && s.pw[o.atk] === MING)) return "Ryukyu and Ming do not fight";
        if (!active(s, o.to)) return "That port isn't open yet";
        if (o.to === P("BDA") && s.F.banda) return "Banda is closed to all";
      } else if (r.closed) return `${PORTS[o.to].name} is shut to your ships`;
      for (const [holder, n] of r.tolls) { silver -= n; void holder; }
      arrive[o.to] += o.n;
      dest.add(o.to);
    } else if (o.t === "factor") {
      if (!isInt(o.port) || o.port < 0 || o.port >= N_PORTS) return "Which port?";
      if (s.own[o.port] === seat) return "You hold that port: no factor needed";
      if (hasFactor(s, o.port, seat)) return "You already have a factor there";
      if (closedTo(s, seat, o.port)) return `${PORTS[o.port].name} is shut to you`;
      const kontor = pi === HANSE && kontorPort(o.port) && !(o.port === P("LON") && s.F.steel);
      if (!kontor && s.fl[seat][o.port] < 1 && !dest.has(o.port) && !orders.some(m => m.t === "move" && m.to === o.port)) return "A factor needs a fleet in the port";
      silver -= COST.factor;
    } else if (o.t === "build") {
      if (!isInt(o.port) || o.port < 0 || o.port >= N_PORTS || s.own[o.port] !== seat) return "Build at a port you hold";
      built[o.port]++;
      silver -= buildCost(s, seat, o.port);
    } else if (o.t === "fort") {
      if (!isInt(o.port) || o.port < 0 || o.port >= N_PORTS) return "Which port?";
      if (s.fort[o.port]) return "There is a fort already";
      if (s.own[o.port] !== seat) {
        if (pi !== PORTUGAL || !hasFactor(s, o.port, seat)) return "Fort a port you hold";
        if (closedTo(s, seat, o.port)) return "That port is shut to you";
      }
      silver -= COST.fort;
    } else if (o.t === "claim") {
      if (!isInt(o.port) || o.port < 0 || o.port >= N_PORTS) return "Which port?";
      if (s.own[o.port] !== -1 || !active(s, o.port)) return "Only a port no power holds can be claimed";
      if (!hasFactor(s, o.port, seat)) return "A claim needs your factor there";
      if (closedTo(s, seat, o.port)) return "That port is shut to you";
      if (s.fl[seat][o.port] < 1 && !dest.has(o.port) && !orders.some(m => m.t === "move" && m.to === o.port)) return "A claim needs a fleet in the port";
      silver -= COST.claim;
    } else if (o.t === "refit") {
      if (s.oc[seat]) return "You have ocean ships";
      silver -= refitCost(s);
    } else if (o.t === "redress") {
      if (s.gr[seat] < 1) return "You have no grievance to pay down";
      silver -= COST.redress;
    } else return "Not an order";
  }
  for (let p = 0; p < N_PORTS; p++) {
    if (built[p] > 1) return "One fleet a port a round";
    if (s.fl[seat][p] - leave[p] + arrive[p] + built[p] > fleetCap(s, seat)) return `${PORTS[p].name} holds at most ${fleetCap(s, seat)} of your fleets`;
  }
  if (silver < 0) return "You haven't the silver";
  return "";
}

// ---------- battles ----------
const dice = (rng, n) => Array.from({ length: n }, () => 1 + Math.floor(rng() * 6)).sort((a, b) => b - a);
/** The die modifiers for a fleet fighting at port p: attacker (atk true) or defender. */
export function modifier(s, seat, p, atk, defOwner = false) {
  const pi = s.pw[seat], region = PORTS[p].region;
  let m = 0;
  if (POWERS[pi].sea.includes(region)) m++;
  if (atk && s.oc[seat] && OCEAN_REGIONS.has(region)) m++;
  if (!atk && pi === PORTUGAL && !s.F.voc && OCEAN_REGIONS.has(region)) m++;
  if (!atk && defOwner && s.fort[p]) m++;
  if (pi === HANSE && !s.oc[seat] && region > 1) m--;
  if (pi === MING && s.F.ban) m--;
  if (pi === GUJARAT) m--;
  return m;
}
const oddsCache = new Map();
/**
 * Exact odds of one exchange: attacker na dice (+ma) against nd dice (+md): { win (attacker wins at least one pair),
 * aLoss, dLoss (expected fleets lost), dist[k] (chance the defender loses k) }.
 */
export function exchange(na, ma, nd, md) {
  const k = `${na}|${ma}|${nd}|${md}`;
  let r = oddsCache.get(k);
  if (r) return r;
  const dist = [0, 0, 0, 0], aDist = [0, 0, 0, 0];
  const total = 6 ** (na + nd), pairs = Math.min(na, nd);
  for (let i = 0; i < total; i++) {
    let x = i; const a = [], d = [];
    for (let j = 0; j < na; j++) { a.push(x % 6); x = (x - (x % 6)) / 6; }
    for (let j = 0; j < nd; j++) { d.push(x % 6); x = (x - (x % 6)) / 6; }
    a.sort((u, v) => v - u); d.sort((u, v) => v - u);
    let w = 0;
    for (let j = 0; j < pairs; j++) if (a[j] + ma > d[j] + md) w++;
    dist[w]++; aDist[pairs - w]++;
  }
  r = { dist: dist.map(v => v / total), aDist: aDist.map(v => v / total) };
  r.dLoss = r.dist.reduce((acc, v, i) => acc + v * i, 0);
  r.aLoss = r.aDist.reduce((acc, v, i) => acc + v * i, 0);
  r.win = 1 - r.dist[0];
  oddsCache.set(k, r);
  return r;
}
/** The defender's dice at p against an attack by `target`'s holder: { nd, md, fleets }. */
export function defence(s, target, p) {
  const owner = s.own[p];
  const fleets = target >= 0 ? s.fl[target][p] : 0;
  const garrison = target === -2 || target === owner ? 1 : 0;
  const md = target >= 0 ? modifier(s, target, p, false, target === owner) : 0;
  return { nd: Math.min(3, fleets + garrison), md, fleets, garrison };
}
/** Chance an attack of n fleets (atk seat) on target at p takes the port or clears the fleets, in one exchange. */
export function attackOdds(s, seat, p, n, target) {
  const d = defence(s, target, p);
  if (d.nd < 1) return { take: 1, win: 1, aLoss: 0, d };
  const x = exchange(Math.min(3, n), modifier(s, seat, p, true), d.nd, d.md);
  const takes = target === s.own[p] || target === -2;
  let take = 0;
  for (let k = 0; k < x.dist.length; k++) if (takes ? k > d.fleets : k >= d.fleets && d.fleets > 0) take += x.dist[k];
  return { take, win: x.win, aLoss: x.aLoss, dLoss: x.dLoss, d };
}

function battle(s, rng, log, p, seat, n, target) {
  const d = defence(s, target, p);
  const na = Math.min(3, n);
  const a = dice(rng, na), ma = modifier(s, seat, p, true);
  const df = dice(rng, d.nd), md = d.md;
  const pairs = Math.min(a.length, df.length);
  let aw = 0;
  for (let j = 0; j < pairs; j++) if (a[j] + ma > df[j] + md) aw++;
  const dl = aw, al = pairs - aw;
  const owner = s.own[p];
  const takes = target === owner || target === -2;
  s.fl[seat][p] = Math.max(0, s.fl[seat][p] - al);
  let breach = false;
  if (target >= 0) { const gone = Math.min(dl, s.fl[target][p]); s.fl[target][p] -= gone; breach = dl > gone; }
  else breach = dl > 0;
  if (takes) s.gr[seat]++;
  const where = PORTS[p].name;
  const who = nm(s, target);
  // the dice are in the line, so the page can show what was rolled: "dice 6·5 (+1) against 4·3 (+0)"
  const rolled = `dice ${a.join("·")} (${ma >= 0 ? "+" : ""}${ma}) against ${df.length ? df.join("·") : "none"} (${md >= 0 ? "+" : ""}${md})`;
  if (takes && breach && s.fl[seat][p] > 0 && (target < 0 || s.fl[target][p] === 0)) {
    s.own[p] = seat; s.fort[p] = 0;
    log.push(`${nm(s, seat)} takes ${where} from ${who}: ${rolled}; a bombardment, one grievance token.`);
  } else {
    log.push(`${nm(s, seat)} attacks ${who} at ${where}: ${rolled}; ${al ? `loses ${al}` : "loses none"}, ${dl ? `${who} loses ${dl}` : "no losses for them"}${takes ? "; a bombardment, one grievance token" : ""}.`);
  }
}

// ---------- the round ----------
function copyState(s) {
  return {
    ...s, opts: s.opts, pw: s.pw.slice(), own: s.own.slice(), fl: s.fl.map(f => f.slice()), fac: s.fac.slice(), fort: s.fort.slice(),
    si: s.si.slice(), gr: s.gr.slice(), oc: s.oc.slice(), pend: s.pend.slice(), F: { ...s.F }, mono: s.mono.slice(),
    stand: s.stand.slice(), log: [], hist: s.hist, res: s.res,
  };
}
export const copy = copyState;

/**
 * Carries out every seat's orders together. opt.hazard false leaves out the random event (a bot looking one round ahead);
 * opt.events false leaves out every event.
 */
export function resolveRound(s, all, rng, opt = {}) {
  const log = [];
  const ord = (seat, t) => all[seat].filter(o => o.t === t);
  // 1. payments that change the books before anything moves
  for (let k = 0; k < s.n; k++) {
    for (const o of ord(k, "redress")) if (s.gr[k] > 0 && s.si[k] >= COST.redress) { s.si[k] -= COST.redress; s.gr[k]--; log.push(`${nm(s, k)} pays ${COST.redress} silver in compensation: one grievance token less.`); }
    for (const o of ord(k, "refit")) { void o; const c = refitCost(s); if (!s.oc[k] && s.si[k] >= c) { s.si[k] -= c; s.oc[k] = 1; log.push(`${nm(s, k)} buys ocean ships.`); } }
    for (const o of ord(k, "build")) { const c = buildCost(s, k, o.port); if (s.own[o.port] === k && s.si[k] >= c && s.fl[k][o.port] < fleetCap(s, k)) { s.si[k] -= c; s.fl[k][o.port]++; log.push(`${nm(s, k)} builds a fleet at ${PORTS[o.port].name}.`); } }
  }
  // 2. moves: all leave, then all arrive; tolls and pirates on the way
  const arrivals = [];
  for (let k = 0; k < s.n; k++) {
    const rc = new Map();
    for (const o of ord(k, "move")) {
      const present = s.fl[k][o.from];
      let n = Math.min(o.n, present);
      if (n < 1) continue;
      if (!rc.has(o.from)) rc.set(o.from, reach(s, k, o.from));
      const r = rc.get(o.from).get(o.to);
      if (!r) continue;
      s.fl[k][o.from] -= n;
      for (const [holder, t] of r.tolls) { if (s.si[k] >= t) { s.si[k] -= t; s.si[holder] += t; } }
      for (let i = 0; i < r.pir; i++) {
        const roll = 1 + Math.floor(rng() * 6);
        if (roll <= (s.gr[k] >= 3 ? 2 : 1) && n > 0) { n--; log.push(`Pirates take a ${nm(s, k)} fleet on the way to ${PORTS[o.to].name}.`); }
      }
      if (n > 0) { arrivals.push({ seat: k, to: o.to, n, atk: o.atk ?? null }); log.push(`${nm(s, k)} ${o.atk != null ? "sends" : "sails"} ${n} fleet${n > 1 ? "s" : ""} from ${PORTS[o.from].name} to ${PORTS[o.to].name}.`); }
    }
  }
  for (const a of arrivals) s.fl[a.seat][a.to] = Math.min(fleetCap(s, a.seat), s.fl[a.seat][a.to] + a.n);
  // 3. battles, port by port; the larger attacker first
  const byPort = new Map();
  for (const a of arrivals) if (a.atk != null) { if (!byPort.has(a.to)) byPort.set(a.to, []); byPort.get(a.to).push(a); }
  for (const p of [...byPort.keys()].sort((x, y) => x - y)) {
    const list = byPort.get(p).sort((x, y) => y.n - x.n || x.seat - y.seat);
    for (const a of list) {
      const still = a.atk === -2 ? s.own[p] === -1 : (a.atk === s.own[p] || s.fl[a.atk][p] > 0);
      // the attackers already stand in the port (above): a battle takes its losses from the fleets standing there
      if (still) battle(s, rng, log, p, a.seat, a.n, a.atk);
    }
  }
  // 4. factors, forts, claims
  for (let k = 0; k < s.n; k++) {
    const pi = s.pw[k];
    for (const o of ord(k, "factor")) {
      const kontor = pi === HANSE && kontorPort(o.port) && !(o.port === P("LON") && s.F.steel);
      const there = s.fl[k][o.port] > 0;
      if (s.own[o.port] === k || hasFactor(s, o.port, k) || closedTo(s, k, o.port) || (!there && !kontor)) continue;
      const c = COST.factor;
      if (s.si[k] < c) continue;
      s.si[k] -= c; s.fac[o.port] |= bit(k);
      log.push(`${nm(s, k)} founds a factor at ${PORTS[o.port].name}.`);
    }
    for (const o of ord(k, "fort")) {
      if (s.fort[o.port] || s.si[k] < COST.fort) continue;
      if (s.own[o.port] === k) { s.si[k] -= COST.fort; s.fort[o.port] = 1; log.push(`${nm(s, k)} builds a fort at ${PORTS[o.port].name}.`); }
      else if (pi === PORTUGAL && hasFactor(s, o.port, k) && !closedTo(s, k, o.port)) {
        const owner = s.own[o.port];
        if (owner >= 0 && s.fl[owner][o.port] > 0) continue;
        s.si[k] -= COST.fort; s.fort[o.port] = 1; s.own[o.port] = k; s.gr[k]++; s.fac[o.port] &= ~bit(k);
        log.push(`${nm(s, k)} raises a fort at ${PORTS[o.port].name} and holds it: one grievance token.`);
      }
    }
  }
  const claims = new Map();
  for (let k = 0; k < s.n; k++) for (const o of ord(k, "claim")) { if (!claims.has(o.port)) claims.set(o.port, []); claims.get(o.port).push(k); }
  for (const p of [...claims.keys()].sort((x, y) => x - y)) {
    if (s.own[p] !== -1) continue;
    const mine = claims.get(p).filter(k => s.fl[k][p] > 0 && hasFactor(s, p, k) && s.si[k] >= COST.claim && !closedTo(s, k, p));
    const power = k => s.fl[k][p];
    const top = Math.max(0, ...mine.map(power));
    const winners = mine.filter(k => power(k) === top);
    const others = Math.max(0, ...s.fl.map((f, k) => (mine.includes(k) ? 0 : f[p])));
    if (winners.length === 1 && top > others) {
      const k = winners[0];
      s.si[k] -= COST.claim; s.own[p] = k; s.fac[p] &= ~bit(k);
      log.push(`${nm(s, k)} claims ${PORTS[p].name} by treaty.`);
    }
  }
  // 5. income, then the era's events
  s.mono = monopolies(s);
  const gain = [];
  for (let k = 0; k < s.n; k++) { const [inc] = incomeOf(s, k); gain.push(inc); s.si[k] = Math.max(0, s.si[k] + inc); }
  log.push(`Income: ${gain.map((g, k) => `${nm(s, k)} ${g >= 0 ? "+" : ""}${g}`).join(", ")}.`);
  if (s.F.ban) {
    const mk = seatOfPower(s, "ming");
    if (mk >= 0 && 1 + Math.floor(rng() * 6) <= 2) {
      const ports = [...Array(N_PORTS).keys()].filter(p => s.own[p] === mk && s.fl[mk][p] > 0);
      if (ports.length) { const p = ports[Math.floor(rng() * ports.length)]; s.fl[mk][p]--; log.push(`Wokou raiders (pirate-smugglers) hit the coast at ${PORTS[p].name}: a Ming fleet is lost.`); }
      else s.si[mk] = Math.max(0, s.si[mk] - 1);
    }
  }
  if (opt.events !== false) events(s, rng, log, opt);
  s.mono = monopolies(s);
  // unrest in the power with the most grievance
  const worst = s.gr.reduce((b, g, k) => (g > (s.gr[b] ?? -1) ? k : b), 0);
  if (opt.events !== false && s.gr[worst] >= 4) {
    const ports = [...Array(N_PORTS).keys()].filter(p => s.own[p] === worst && (s.fort[p] || s.fl[worst][p] > 0));
    if (ports.length) {
      const p = ports[Math.floor(rng() * ports.length)];
      if (s.fort[p]) { s.fort[p] = 0; log.push(`Unrest: ${nm(s, worst)} loses the fort at ${PORTS[p].name}.`); }
      else { s.fl[worst][p]--; log.push(`Unrest: ${nm(s, worst)} loses a fleet at ${PORTS[p].name}.`); }
    }
  }
  s.stand = Array.from({ length: s.n }, (_, k) => standing(s, k));
  s.hist = [...s.hist, s.stand.slice()];
  s.log = log;
  s.F.nomon = s.F.nomonNext; s.F.nomonNext = 0;
  const heldN = k => held(s, k), monoN = k => s.mono.filter(m => m === k).length;
  const early = Array.from({ length: s.n }, (_, k) => k).filter(k => heldN(k) >= 12 && monoN(k) >= 2);
  if (s.round >= s.opts.rounds || early.length) endGame(s, early.length ? "early" : "rounds");
  else s.round++;
}

function endGame(s, how) {
  s.step = "over";
  const stand = s.stand.slice();
  const monoN = k => s.mono.filter(m => m === k).length;
  const order = stand.map((v, k) => k).sort((a, b) => stand[b] - stand[a] || monoN(b) - monoN(a));
  const top = order[0];
  const winners = order.filter(k => stand[k] === stand[top] && monoN(k) === monoN(top));
  s.res = { how, stand, winners, order };
  s.log = [...s.log, how === "early" ? `${winners.map(k => nm(s, k)).join(" and ")} hold twelve ports and two monopolies: the game ends at once.` : "The eighth round is done."];
}

function events(s, rng, log, opt) {
  const round = s.round;
  const ids = EVENTS.filter(e => e.round === round).map(e => e.id);
  if (round >= 2) s.F.peter = 0;
  for (const id of ids) apply(s, id, rng, log);
  if (round === 1 && ids.includes("peterhof")) s.F.peter = 1;
  if (opt.hazard !== false) {
    const id = HAZARDS[Math.floor(rng() * HAZARDS.length)];
    apply(s, id, rng, log);
  }
}

function setOwnerIfFree(s, seat, id) { const p = P(id); if (s.own[p] === -1) s.own[p] = seat; return s.own[p] === seat; }

/** One event applied to a state (the round's events, and the tests, which check each in turn). */
export function applyEvent(s, id, rng, log = []) { apply(s, id, rng, log); return s; }
function apply(s, id, rng, log) {
  const ev = EVENTS.find(e => e.id === id);
  const say = text => log.push(`${ev.year ? ev.year : "Hazard"}: ${text}`);
  const pt = seatOfPower(s, "portugal"), ott = seatOfPower(s, "ottomans"), han = seatOfPower(s, "hanse"), ming = seatOfPower(s, "ming"),
    ryu = seatOfPower(s, "ryukyu");
  switch (id) {
    case "elmina": if (pt >= 0 && s.own[P("ELM")] === pt && !s.fort[P("ELM")]) { s.fort[P("ELM")] = 1; say("Portugal builds the fort of São Jorge da Mina at Elmina."); } else say(ev.name + ": no one raises it."); break;
    case "peterhof": s.F.peter = 1; if (han >= 0) s.fac[P("NOV")] &= ~bit(han); say("Ivan III closes the Hanse's Peterhof at Novgorod; its factor is lost until 1514."); break;
    case "calicut": if (pt >= 0 && s.own[P("CAL")] !== pt && !hasFactor(s, P("CAL"), pt)) { s.fac[P("CAL")] |= bit(pt); say("Portugal founds a factor at Calicut."); } break;
    case "kilwa": if (pt >= 0) {
      for (const id2 of ["KIL", "MOM"]) {
        const o = s.own[P(id2)];
        if (o >= 0 && o !== pt) { const pay = Math.min(2, s.si[o]); s.si[o] -= pay; s.si[pt] += pay; if (s.fl[o][P(id2)] > 0) s.fl[o][P(id2)]--; s.gr[pt]++; say(`Portugal demands tribute from ${PORTS[P(id2)].name} (${pay} silver) and attacks it: one grievance token for Portugal.`); }
      }
    } break;
    case "goa": if (pt >= 0 && s.own[P("GOA")] === -1) { s.own[P("GOA")] = pt; s.gr[pt]++; say("Portugal takes Goa: one grievance token."); } break;
    case "malacca": if (pt >= 0) {
      const o = s.own[P("MLC")];
      const mk = seatOfPower(s, "malacca");
      if (o >= 0 && o === mk && factors(s, mk) < 3) { s.own[P("MLC")] = pt; s.fort[P("MLC")] = 1; s.gr[pt]++; say("Malacca falls to Portugal, which fortifies it: one grievance token."); }
      else if (o === -1) { s.own[P("MLC")] = pt; s.gr[pt]++; say("Portugal takes Malacca: one grievance token."); }
      else say("Portugal does not take Malacca.");
    } break;
    case "egypt": s.F.egypt = 1; if (ott >= 0) { setOwnerIfFree(s, ott, "ALE"); setOwnerIfFree(s, ott, "ALP"); say("The Ottomans take Egypt and Syria: Alexandria and Aleppo are theirs, and their toll runs on the Red Sea lane."); } else say("The Mamluks fall; Egypt changes hands."); break;
    case "iwami": s.F.iwami = 1; say("Hakata becomes a silver source."); break;
    case "afonso": for (const id2 of ["SAO", "ELM", "MPI"]) { const o = s.own[P(id2)]; if (o >= 0) { s.gr[o]++; say(`${nm(s, o)} runs the trade at ${PORTS[P(id2)].name}: one grievance token.`); } } break;
    case "potosi": s.F.potosi = 1; say("Seville becomes a silver source."); break;
    case "eastafrica": for (const id2 of ["SOF", "KIL", "MOM", "MAL"]) { const o = s.own[P(id2)]; if (o >= 0) { s.gr[o]++; say(`${nm(s, o)} holds ${PORTS[P(id2)].name}, where people are shipped: one grievance token.`); } } break;
    case "manila": s.F.manila = 1; for (let k = 0; k < s.n; k++) if (s.own[P("MNL")] === k || hasFactor(s, P("MNL"), k)) { s.si[k] += 3; say(`${nm(s, k)} shares in the galleon silver: 3 silver.`); } break;
    case "ban": s.F.ban = 0; say("Yuegang opens to Chinese merchants; the sea ban no longer binds Ming."); break;
    case "nagasaki": s.F.naga = 1; say("Nagasaki opens."); break;
    case "mita": if (s.F.potosi) for (let k = 0; k < s.n; k++) if (s.own[P("SEV")] === k || hasFactor(s, P("SEV"), k)) { s.gr[k]++; say(`${nm(s, k)} takes silver from Potosí: forced labour, one grievance token.`); } break;
    case "steelyard": s.F.steel = 1; if (han >= 0) s.fac[P("LON")] &= ~bit(han); say("The Steelyard is closed; the Hanse loses London."); break;
    case "voc": s.F.voc = 1; say("Ocean ships are cheap (1 silver) and Portugal's lead ends."); break;
    case "satsuma": if (ryu >= 0) { s.si[ryu] = Math.max(0, s.si[ryu] - 2); say("Ryukyu pays Satsuma: 2 silver."); } break;
    case "banda": s.F.banda = 1; for (let k = 0; k < s.n; k++) { s.fac[P("BDA")] &= ~bit(k); if (s.fl[k][P("BDA")]) s.fl[k][P("BDA")] = 0; } if (s.own[P("BDA")] >= 0) { s.own[P("BDA")] = -1; s.fort[P("BDA")] = 0; } say("Banda is closed to all, and its holders lose it."); break;
    case "japan": s.F.japan = 1; for (const id2 of ["HAK", "NAG"]) { const p = P(id2); for (let k = 0; k < s.n; k++) { const pi = s.pw[k]; if (pi === MING || pi === RYUKYU) continue; s.fac[p] &= ~bit(k); s.fl[k][p] = 0; if (s.own[p] === k) { s.own[p] = -1; s.fort[p] = 0; } } } say("Japan closes to all but the Chinese and Ryukyu."); break;
    case "mingfall": s.F.mingfall = 1; if (ming >= 0) { s.si[ming] = Math.max(0, s.si[ming] - 3); say("Ming loses its great market and 3 silver."); } break;
    case "typhoon": {
      const ports = [...Array(N_PORTS).keys()].filter(p => PORTS[p].region >= 7 && fleetsAt(s, p) > 0);
      if (ports.length) { const p = ports[Math.floor(rng() * ports.length)]; const ks = s.fl.map((f, k) => k).filter(k => s.fl[k][p] > 0); const k = ks[Math.floor(rng() * ks.length)]; s.fl[k][p]--; say(`A typhoon sinks a ${nm(s, k)} fleet at ${PORTS[p].name}.`); } else say("A typhoon passes without a fleet to lose.");
      break;
    }
    case "monsoon": s.F.nomonNext = 1; say("The monsoon fails: monsoon lanes are shut next round."); break;
    case "plague": {
      const ports = [...Array(N_PORTS).keys()].filter(p => s.own[p] >= 0 && active(s, p));
      if (ports.length) { const p = ports[Math.floor(rng() * ports.length)]; const o = s.own[p]; s.si[o] = Math.max(0, s.si[o] - 2); if (s.fl[o][p] > 0) s.fl[o][p]--; say(`Plague empties ${PORTS[p].name}: ${nm(s, o)} loses 2 silver and a fleet there.`); }
      break;
    }
    default: break;
  }
}

// ---------- the game as seats.js sees it ----------
function drawPowers(n, rng, wanted) {
  if (Array.isArray(wanted) && wanted.length >= n) return wanted.slice(0, n).map(w => (typeof w === "string" ? POWER_IDX[w] : w));
  const order = shuffle(POWERS.map((_, i) => i), rng), out = [];
  let euro = 0;
  for (const i of order) {
    if (out.length === n) break;
    if (POWERS[i].euro) { if (euro >= 3) continue; euro++; }
    out.push(i);
  }
  return out;
}

export function deal({ seats, options = {}, rng }) {
  const n = Math.max(2, Math.min(6, seats));
  const pw = drawPowers(n, rng, options.powers);
  const s = {
    n, opts: { rounds: options.rounds === 6 || options.rounds === 10 ? options.rounds : ROUNDS }, pw, round: 1, step: "orders",
    own: Array(N_PORTS).fill(-1), fl: Array.from({ length: n }, ne), fac: ne(), fort: ne(), si: [], gr: Array(n).fill(0), oc: [],
    pend: Array(n).fill(0), F: { ban: 1, peter: 0, iwami: 0, potosi: 0, manila: 0, naga: 0, egypt: 0, voc: 0, steel: 0, banda: 0, japan: 0, mingfall: 0, nomon: 0, nomonNext: 0 },
    mono: Array(GOODS.length).fill(-1), stand: [], log: [], hist: [], res: null,
  };
  pw.forEach((pi, k) => {
    const d = POWERS[pi];
    for (const h of d.homes) s.own[P(h)] = k;
    for (const [id, c] of Object.entries(d.fleets)) s.fl[k][P(id)] = c;
    for (const id of d.factors) if (s.own[P(id)] !== k) s.fac[P(id)] |= bit(k);
    s.si.push(d.silver); s.oc.push(d.ocean);
  });
  s.mono = monopolies(s);
  s.stand = Array.from({ length: n }, (_, k) => standing(s, k));
  s.log = [`1480: ${pw.map(i => POWERS[i].name).join(", ")} set out.`];
  return s;
}

/** A state read back from the database made whole. */
export function restore(s) {
  const arr = (a, len, v = 0) => Array.from({ length: len }, (_, i) => (a && a[i] != null ? a[i] : v));
  s.own = arr(s.own, N_PORTS, -1); s.fac = arr(s.fac, N_PORTS); s.fort = arr(s.fort, N_PORTS);
  s.fl = Array.from({ length: s.n }, (_, k) => arr(s.fl?.[k], N_PORTS));
  s.pw = arr(s.pw, s.n); s.si = arr(s.si, s.n); s.gr = arr(s.gr, s.n); s.oc = arr(s.oc, s.n); s.stand = arr(s.stand, s.n);
  s.pend = Array.from({ length: s.n }, (_, k) => {
    const p = s.pend?.[k];
    return p ? Object.values(p).map(o => ({ ...o })) : 0;
  });
  s.mono = arr(s.mono, GOODS.length, -1);
  s.log = s.log ? Object.values(s.log) : [];
  s.hist = s.hist ? Object.values(s.hist).map(h => arr(h, s.n)) : [];
  s.res ??= null;
  if (s.res) { s.res.stand = arr(s.res.stand, s.n); s.res.winners = Object.values(s.res.winners || {}); s.res.order = Object.values(s.res.order || {}); }
  return s;
}

import { botOrders } from "./carrack-bot.js";

export const rules = {
  id: "carrack",
  seats: { min: 2, max: 6 },
  deal,
  toMove: s => (s.step === "over" ? null : nextSeat(s)),
  toMoveAll: s => (s.step === "over" ? [] : waiting(s)),
  anytime: isOrders,
  act(s, seat, m, { rng }) {
    if (!isOrders(m)) return "Set your orders";
    const r = submit(s, seat, m.orders, checkOrders);
    if (r.error) return r.error;
    if (r.last) resolveRound(s, take(s), rng);
    return s;
  },
  bot: (s, seat, ctx) => ({ t: "orders", orders: botOrders(s, seat, ctx) }),
  over: s => s.step === "over",
  restore,
};
