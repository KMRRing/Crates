// Carrack's course (Learn, in the menu): the round, the orders, movement, battles, founding and claiming, income and
// monopolies, events and grievance, each of the nine powers, and strategy, on the course's sheet (course.js) with a stage of
// its own: the ports of a lesson's scene on the schematic map, as the game draws them. Nothing a lesson says about a position
// is taken on trust: a scene is a real game state (carrack-rules.js's deal, then the scene's changes), and a step's answer is
// worked out from it by `calc` (the rules' own functions), which tests/carrack-course.mjs runs against the answer the lesson
// gives. A step is
//
//   { say, scene? }                        words over the scene
//   { say, scene, quiz, answer, calc?, why } a choice; calc(s) gives the right option's text, checked by the test
//   { say, scene, valid: [orders…], quiz }   a choice among orders: the one the rules accept is the answer
//   { say, scene, pick(s, port), also? }   tap a port on the map: pick says which ports are right
//   { say, play: true }                    the last step: a game
//
// A scene: { powers: ["portugal", …], seat (whose view, default 0), round, bare (clear the board first), fl: [{ LIS: 2 }, …]
// (a seat's fleets, replacing its own), own: { LIS: 0 } (-1: no power), fac: { CAL: [0, 1] }, fort: ["LIS"], si: { 0: 6 },
// gr: { 0: 3 }, oc: { 0: 1 }, F: { egypt: 1 }, show: ["LIS", …] (the ports drawn; by default all that have anything and
// their neighbours), mark: "LIS:pick" }.
import { PORTS, IDX, LANES, N_PORTS, ADJ, labelBox } from "./carrack-map.js";
import {
  rules, POWERS, POWER_IDX, COST, MAX_ORDERS, SILVER_PER_POINT, checkOrders, reach, attackOdds, standing, incomeOf, monopolies,
  copy, applyEvent, modifier, defence, hasFactor, resolveRound,
} from "./carrack-rules.js";
import { seeded } from "./seats.js";

const P = id => IDX[id];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const pct = x => `${Math.round(100 * x)}%`;

/** A scene's game state. */
export function stateOf(sc) {
  const s = rules.deal({ seats: sc.powers.length, options: { powers: sc.powers.map(id => POWER_IDX[id]) }, rng: seeded(11) });
  if (sc.bare) { s.own.fill(-1); s.fac.fill(0); s.fort.fill(0); s.fl.forEach(f => f.fill(0)); }
  if (sc.round) s.round = sc.round;
  sc.fl?.forEach((f, k) => { if (f) { s.fl[k].fill(0); for (const [id, n] of Object.entries(f)) s.fl[k][P(id)] = n; } });
  for (const [id, k] of Object.entries(sc.own || {})) s.own[P(id)] = k;
  for (const [id, ks] of Object.entries(sc.fac || {})) s.fac[P(id)] = ks.reduce((a, k) => a | (1 << k), 0);
  for (const id of sc.fort || []) s.fort[P(id)] = 1;
  for (const [k, v] of Object.entries(sc.si || {})) s.si[k] = v;
  for (const [k, v] of Object.entries(sc.gr || {})) s.gr[k] = v;
  for (const [k, v] of Object.entries(sc.oc || {})) s.oc[k] = v;
  Object.assign(s.F, sc.F || {});
  s.mono = monopolies(s);
  s.stand = Array.from({ length: s.n }, (_, k) => standing(s, k));
  return s;
}
/** s with seat 0's fleets as given (a copy). */
const stateWith = (s, { fl }) => { const w = copy(s); w.fl[0].fill(0); for (const [id, n] of Object.entries(fl)) w.fl[0][P(id)] = n; w.si[0] = 20; return w; };
const seatOf = sc => sc.seat ?? 0;
/** The ports a scene draws. */
export function shownPorts(sc, s = stateOf(sc)) {
  if (sc.show) return sc.show.map(P);
  const set = new Set();
  const k = seatOf(sc);
  for (let p = 0; p < N_PORTS; p++) if (s.own[p] === k || hasFactor(s, p, k) || s.fl[k][p]) set.add(p);
  if (!sc.alone) for (const p of [...set]) for (const e of ADJ[p]) set.add(e.to);
  return [...set];
}

// ---------- the lessons ----------
// one power with a second at the table (the rules need two seats); the view is the first
const V = (id, extra = {}) => ({ powers: [id, id === "venice" ? "hanse" : "venice"], ...extra });
/** A choice whose right option is worked out: `calc(s)` gives its text. */
const ask = (say, scene, quiz, answer, calc, why) => ({ say, scene, quiz, answer, calc, why });
const yes = b => (b ? "Yes" : "No");

const lisbon = { powers: ["portugal", "hanse"], bare: true, own: { LIS: 0, LUB: 1 }, fl: [{ LIS: 2 }, { LUB: 1 }], show: ["LON", "ANT", "LIS", "SEV", "ELM", "LUB", "REV"] };
const baltic = { powers: ["hanse", "venice"], bare: true, own: { LUB: 0, VEN: 1 }, fl: [{ LUB: 2 }, { VEN: 3 }], si: { 0: 6, 1: 7 }, show: ["LUB", "REV", "NOV", "LON", "ANT"] };

export const COURSE = {
  title: "Learn Carrack", zh: "",
  chapters: [
    { id: "round", title: "The round", zh: "", lessons: [
      { id: "year", title: "The year", zh: "", steps: [
        { say: "Carrack is a contest for trade from the Baltic to China, 1480 to 1650. Two to six of nine powers; eight rounds, each a trading year in one era. You are one power.", scene: V("venice", { bare: false, show: ["VEN", "CON", "ALE", "ALP"] }) },
        { say: "Every power sets up to three orders in secret, all at the same time. Nobody sees another's until the year is played: you must guess what they will do. How many orders can you set in a year?", quiz: ["1", "2", "3", "5"], answer: 2, calc: () => String(MAX_ORDERS), why: "Up to three, and passing is allowed." },
        { say: "Then the year is carried out together, in this order: payments (ocean ships, fleets built, compensation), moves, battles, factors, forts and claims, income, the era's events. A fleet you build is not there to sail until next year. Venice has three fleets at home. Which orders will the game take?", scene: V("venice", { show: ["VEN", "CON", "ALE"] }),
          valid: [[{ t: "build", port: P("VEN") }, { t: "move", from: P("VEN"), to: P("CON"), n: 3 }, { t: "move", from: P("VEN"), to: P("ALE"), n: 1 }], [{ t: "build", port: P("VEN") }, { t: "move", from: P("VEN"), to: P("CON"), n: 2 }, { t: "move", from: P("VEN"), to: P("ALE"), n: 1 }]], quiz: ["Build, sail 3 to Constantinople and 1 to Alexandria", "Build, sail 2 to Constantinople and 1 to Alexandria"], answer: 1, why: "Orders are checked against the fleets standing in port now: the first sends four out of three, because the new fleet is not yet there." },
      ] },
      { id: "standing", title: "Standing and the end", zh: "", steps: [
        { say: "Most standing at the end wins. A port you hold is worth 2, a factor 1, a monopoly 3, every 8 silver 1, and every grievance token costs 2. Portugal holds two ports, has two factors, one monopoly, 17 silver and one token.",
          scene: { powers: ["portugal", "venice"], bare: true, own: { LIS: 0, ELM: 0, VEN: 1 }, fac: { SEV: [0], CAL: [0, 1], ACE: [0], BAN: [0] }, gr: { 0: 1 }, si: { 0: 17 }, show: ["LIS", "ELM", "SEV", "CAL", "ACE", "BAN"] },
          quiz: ["8", "9", "10", "11"], answer: 3, calc: s => String(standing(s, 0)), why: "Ports 2 x 2 = 4, four factors (Seville, Calicut, Aceh, Banten) 4, the pepper monopoly 3 (Portugal is in all three sources, Venice in one), silver 17 / 8 = 2, less 2 for the token: 11." },
        ask("Silver counts too: how much silver is one standing point?", { powers: ["hanse", "venice"] }, ["4", "8", "10", "16"], 1, () => String(SILVER_PER_POINT), "Eight. Silver pays for orders, so it matters more as income than as points."),
        { say: "The game runs eight rounds. It ends at once if a power holds twelve ports and two monopolies. Ties go to the power with more monopolies." },
      ] },
    ] },
    { id: "orders", title: "The orders", zh: "", lessons: [
      { id: "kinds", title: "The seven orders", zh: "", steps: [
        { say: "Sail one to three fleets; found a factor (a counting-house, in a port where you have a fleet); build a fleet or a fort in a port you hold; buy ocean ships; claim a port nobody holds; pay compensation to remove a grievance token. Which of these costs the least?", quiz: ["Sail", "Found a factor", "Build a fleet", "Claim a port"], answer: 0, why: "Sailing costs nothing but the tolls on the way; a factor costs 2, a fleet or fort 3, a claim, ocean ships and compensation 4." },
        ask("What does it cost to found a factor?", V("hanse"), ["1", "2", "3", "4"], 1, () => String(COST.factor), "Two silver."),
        ask("A claim?", V("hanse"), ["2", "3", "4", "6"], 2, () => String(COST.claim), "Four: the dearest ordinary order, since it turns a factor into a port you hold."),
      ] },
      { id: "silver", title: "Silver", zh: "", steps: [
        { say: "Orders are paid from the silver you have when the year starts; income comes after. The Hanse has 6 silver. Which orders can it send?", scene: baltic,
          valid: [[{ t: "build", port: P("LUB") }, { t: "fort", port: P("LUB") }, { t: "factor", port: P("REV") }], [{ t: "build", port: P("LUB") }, { t: "fort", port: P("LUB") }], [{ t: "build", port: P("LUB") }, { t: "refit" }]],
          quiz: ["A fleet, a fort and a factor (8)", "A fleet and a fort (6)", "A fleet and ocean ships (7)"], answer: 1, why: "Three and three make six; the other two cost more than the Hanse has." },
        { say: "Upkeep takes half a silver a fleet, rounded down, from the year's income, so a large fleet is not free. Five fleets cost how much a year?", scene: V("hanse", { fl: [{ LUB: 3, REV: 2 }] }), quiz: ["1", "2", "3", "5"], answer: 1, calc: s => String(Math.floor(5 / 2)), why: "Half a silver each, rounded down: two." },
      ] },
    ] },
    { id: "move", title: "Movement and lanes", zh: "", lessons: [
      { id: "reach", title: "How far a fleet sails", zh: "", steps: [
        { say: "A fleet sails up to three days along the lanes (the numbers are days: Lübeck to Reval is two). Tap a port the Hanse fleet at Lübeck can reach this year.", scene: { ...baltic, show: ["LUB", "REV", "NOV", "LON", "ANT", "LIS"], mark: "LUB:pick" }, pick: (s, p) => reach(s, 0, P("LUB")).has(p), why: "Reval is two days, Novgorod three through Reval, London and Antwerp three each. Lisbon is six." },
        ask("How many ports can it reach in all?", baltic, ["2", "3", "4", "6"], 2, s => String(reach(s, 0, P("LUB")).size), "Reval, Novgorod, London and Antwerp."),
        { say: "A port is shut to some powers: the Hanse may not sail to Novgorod once the Peterhof is closed (1494 to 1514), and the Ming sea ban keeps Ming in its own seas. Shut ports can still be attacked." },
      ] },
      { id: "monsoon", title: "Monsoon and ocean ships", zh: "", steps: [
        { say: "A dashed lane is the monsoon: a fleet can sail it one way a year, east in odd years and west in even years. A fleet at Mombasa wants Cambay, to the east. When can it go?", scene: V("portugal", { round: 1, bare: true, fl: [{ MAL: 1 }], own: { MAL: -1 }, show: ["MAL", "CAM", "CAL", "ADE"] }),
          quiz: ["Odd years", "Even years", "Every year", "Never"], answer: 0, calc: s => { const a = reach({ ...s, round: 1 }, 0, P("MAL")).has(P("CAM")), b = reach({ ...s, round: 2 }, 0, P("MAL")).has(P("CAM")); return a && b ? "Every year" : a ? "Odd years" : b ? "Even years" : "Never"; }, why: "East is odd years (1, 3, 5, 7), west even; the only free passage is Gujarat's." },
        { say: "A lane marked as open ocean needs ocean ships (4 silver, 2 after the VOC in 1602). Lisbon to Elmina is one. A Venetian fleet in Lisbon, without them: can it sail to Elmina?", scene: { powers: ["venice", "portugal"], bare: true, own: { VEN: 0, LIS: 1 }, fl: [{ LIS: 1 }, { LIS: 1 }], show: ["LIS", "ELM", "SEV"] }, quiz: ["Yes", "No"], answer: 1, calc: s => yes(reach(s, 0, P("LIS")).has(P("ELM"))), why: "No: the lane is the open sea. Portugal starts with ocean ships; everyone else buys them." },
      ] },
      { id: "tolls", title: "Tolls and pirates", zh: "", steps: [
        { say: "The Ottomans take 1 silver from anyone who sails to or from Constantinople, and, after Egypt falls in 1517, on the Red Sea lane. A Venetian fleet sails from Venice to Constantinople. What does the trip cost?", scene: { powers: ["venice", "ottomans"], bare: false, fl: [{ VEN: 3 }], show: ["VEN", "CON", "ALE"] }, quiz: ["Nothing", "1 silver", "2 silver", "3 silver"], answer: 1, calc: s => `${reach(s, 0, P("VEN")).get(P("CON")).tolls.length ? reach(s, 0, P("VEN")).get(P("CON")).tolls.length + " silver" : "Nothing"}`, why: "One silver, paid to the Ottomans. The Ottomans themselves, Gujarat and (for Malacca) the strait's own pay none." },
        { say: "A cross marks pirates. Each crossing risks a fleet on a 1; with three or more grievance tokens, on a 1 or 2. Venice to Alexandria is a pirate lane. With three tokens, how many in six does a crossing lose?", scene: V("venice", { gr: { 0: 3 }, show: ["VEN", "ALE", "CON"] }), quiz: ["1 in 6", "2 in 6", "3 in 6"], answer: 1, calc: s => `${s.gr[0] >= 3 ? 2 : 1} in 6`, why: "Grievance makes pirates bolder: two faces of the die." },
      ] },
    ] },
    { id: "battle", title: "Battles", zh: "", lessons: [
      { id: "dice", title: "The dice", zh: "", steps: [
        { say: "A fleet can attack the holder of a port, another power's fleets there, or a port no power holds (its people defend it). Each side rolls a die per fleet, up to three, and the defender of its own port adds a garrison die. Dice are paired highest to highest; the attacker wins a pair when die plus modifier is higher. Portugal attacks Elmina's holder, Hanse, with two fleets. How many dice does the Hanse roll?", scene: { powers: ["portugal", "hanse"], bare: true, own: { ELM: 1, LIS: 0 }, fl: [{ ELM: 2 }, { ELM: 1 }], show: ["LIS", "ELM", "SAO"] }, quiz: ["1", "2", "3"], answer: 1, calc: s => String(defence(s, 1, P("ELM")).nd), why: "One fleet and the garrison: two dice." },
        { say: "Modifiers add to each die: +1 in a power's home seas, +1 for an attacker with ocean ships in the ocean seas, +1 for a defender behind a fort, and Portugal +1 defending in the ocean seas until the VOC. The Hanse without ocean ships is 1 down beyond its home seas. Portugal defends Elmina behind a fort. What is its modifier?", scene: { powers: ["portugal", "hanse"], bare: true, own: { ELM: 0, LUB: 1 }, fl: [{ ELM: 1 }, { ELM: 2 }], fort: ["ELM"], show: ["ELM", "LIS", "SAO"] }, quiz: ["+1", "+2", "+3"], answer: 2, calc: s => `+${modifier(s, 0, P("ELM"), false, true)}`, why: "Home seas +1, the ocean seas +1 for Portugal, the fort +1." },
      ] },
      { id: "odds", title: "Odds", zh: "", steps: [
        { say: "The game shows the odds of an attack before you send it. Portugal's three fleets attack Goa, which no power holds, defended by its people alone. What is the chance to take it?", scene: V("portugal", { bare: true, own: { LIS: 0 }, fl: [{ GOA: 3 }], show: ["GOA", "CAL", "CAM"] }), quiz: ["About 54%", "About 68%", "About 83%", "Certain"], answer: 2, calc: s => `About ${pct(attackOdds(s, 0, P("GOA"), 3, -2).take)}`, why: "The people of the port roll one die, and its garrison die, against three fleets with +1 for ocean ships: five in six, near enough, still not certain." },
        { say: "A lone fleet attacks a port with one defender and a garrison, no fort. What is its chance to take it?", scene: { powers: ["venice", "ottomans"], bare: true, own: { CON: 1, VEN: 0 }, fl: [{ CON: 1 }, { CON: 1 }], show: ["CON", "VEN", "ALE"] }, quiz: ["Under 10%", "About a quarter", "About a half", "Over 70%"], answer: 0, calc: s => { const t = attackOdds(s, 0, P("CON"), 1, 1).take; return t < 0.1 ? "Under 10%" : t < 0.4 ? "About a quarter" : t < 0.7 ? "About a half" : "Over 70%"; }, why: "One die against two, no better modifier: the dice rarely run that way." },
      ] },
      { id: "price", title: "The price of force", zh: "", steps: [
        { say: "Attacking a port is a bombardment of the people who live there: one grievance token for the attacker, win or lose. A token is minus 2 standing at the end, and you pay it down only with 4 silver. What does a successful attack on a port cost in standing, before the port is counted?", quiz: ["Nothing", "1", "2", "4"], answer: 2, calc: () => "2", why: "Two points a token; the port is worth 2 itself, so a conquest barely breaks even unless the port is rich." },
        { say: "Attacking a fleet of another power in a port is a battle, not a bombardment: no token. A Venetian fleet sits in Portugal's own port of Lisbon. Portugal sends its fleet from Seville to clear it. What does the attack cost in grievance?", scene: { powers: ["portugal", "venice"], bare: true, own: { LIS: 0, VEN: 1 }, fl: [{ SEV: 1 }, { LIS: 1 }], show: ["LIS", "SEV", "LON"] }, quiz: ["None", "1 token", "2 tokens"], answer: 0, calc: s => { const w = copy(s); resolveRound(w, [[{ t: "move", from: P("SEV"), to: P("LIS"), n: 1, atk: 1 }], [{ t: "pass" }]], seeded(3), { events: false }); return w.gr[0] === s.gr[0] ? "None" : `${w.gr[0] - s.gr[0]} token${w.gr[0] - s.gr[0] > 1 ? "s" : ""}`; }, why: "Clearing a visitor from your own port takes no token; a token comes only when you attack a port's holder or its people." },
        { say: "Four tokens bring unrest at home: a fort or a fleet is lost. Compensation (4 silver) removes a token. At what number of tokens does unrest begin?", quiz: ["2", "3", "4", "6"], answer: 2, why: "Four." },
      ] },
    ] },
    { id: "found", title: "Founding and claiming", zh: "", lessons: [
      { id: "factors", title: "Factors", zh: "", steps: [
        { say: "A factor is a counting-house in a port you do not hold. It needs a fleet in the port (or, for the Hanse, the Baltic and London). It scores 1, counts toward the goods whose sources it stands in, and two factors pay 1 silver a year. Portugal's fleet is at Calicut. Which order is right?", scene: V("portugal", { bare: true, own: { LIS: 0 }, fl: [{ CAL: 1 }], si: { 0: 7 }, show: ["CAL", "GOA", "COL"] }),
          valid: [[{ t: "factor", port: P("CAL") }], [{ t: "factor", port: P("GOA") }], [{ t: "claim", port: P("CAL") }]], quiz: ["A factor at Calicut", "A factor at Goa", "A claim on Calicut"], answer: 0, why: "A factor needs your fleet in the port, and a claim needs a factor already." },
      ] },
      { id: "claims", title: "Claiming a port", zh: "", steps: [
        { say: "A claim (4 silver) turns your factor into a port you hold, in a port no power holds, with your fleet there. Portugal has a factor and a fleet at Calicut. Another power has a fleet there too. Who wins a claim?", scene: { powers: ["portugal", "gujarat"], bare: true, own: { LIS: 0, CAM: 1 }, fac: { CAL: [0] }, fl: [{ CAL: 2 }, { CAL: 1 }], si: { 0: 7 }, show: ["CAL", "GOA", "CAM"] }, quiz: ["Portugal, with more fleets there", "Gujarat", "Nobody"], answer: 0, calc: s => { const w = copy(s); resolveRound(w, [[{ t: "claim", port: P("CAL") }], [{ t: "pass" }]], seeded(3), { events: false }); return w.own[P("CAL")] === 0 ? "Portugal, with more fleets there" : w.own[P("CAL")] === 1 ? "Gujarat" : "Nobody"; }, why: "More fleets in the port wins; with a tie, nobody gets it, and the claim is not paid." },
      ] },
    ] },
    { id: "income", title: "Income and monopolies", zh: "", lessons: [
      { id: "income", title: "Income", zh: "", steps: [
        { say: "Each year pays: the value of the ports you hold, half the number of your factors, 1 for each good you have a hand in, 3 for each monopoly, your power's own line, less upkeep. Venice holds Venice (worth 3), with factors at Alexandria and Constantinople. What is its income in the first year?", scene: V("venice", { show: ["VEN", "CON", "ALE"] }), quiz: ["5", "7", "9", "11"], answer: 2, calc: s => String(incomeOf(s, 0)[0]), why: "Ports 3, factors 1 (two factors), goods 1 (silk, from Venice), the Levant premium 2, the Republic's own revenue 3, less 1 for the upkeep of three fleets: 9. The year's tab lists the parts." },
      ] },
      { id: "monopolies", title: "Monopolies", zh: "", steps: [
        { say: "A good comes from three or four source ports. A monopoly is the most of them held or with your factor in, at least two, alone. It pays 3 a year and 3 standing. Pepper comes from Calicut, Aceh and Banten. Portugal has two, Gujarat one. Who has the pepper monopoly?", scene: { powers: ["portugal", "gujarat"], bare: true, own: { LIS: 0, CAM: 1 }, fac: { CAL: [0, 1], ACE: [0] }, show: ["CAL", "ACE", "BAN", "COL"] }, quiz: ["Portugal", "Gujarat", "Nobody"], answer: 0, calc: s => (s.mono[0] === 0 ? "Portugal" : s.mono[0] === 1 ? "Gujarat" : "Nobody"), why: "Two of the three sources against one." },
        { say: "Gujarat now founds a factor at Aceh. Both have two. Who has the monopoly?", scene: { powers: ["portugal", "gujarat"], bare: true, own: { LIS: 0, CAM: 1 }, fac: { CAL: [0, 1], ACE: [0, 1] }, show: ["CAL", "ACE", "BAN", "COL"] }, quiz: ["Portugal", "Gujarat", "Nobody"], answer: 2, calc: s => (s.mono[0] === 0 ? "Portugal" : s.mono[0] === 1 ? "Gujarat" : "Nobody"), why: "A tie at the top gives the monopoly to nobody, unless the old holder is among the tied." },
      ] },
    ] },
    { id: "history", title: "Events and grievance", zh: "", lessons: [
      { id: "events", title: "The era's events", zh: "", steps: [
        { say: "After income each round, the era's events from history happen. In 1517 the Ottomans take Egypt. If the Ottomans are at the table, who holds Alexandria afterwards, when nobody held it before?", scene: { powers: ["ottomans", "venice"], bare: true, own: { CON: 0, VEN: 1 }, fac: { ALE: [1] }, show: ["CON", "ALE", "ALP", "VEN"] }, quiz: ["The Ottomans", "Venice", "Nobody"], answer: 0, calc: s => { const w = copy(s); applyEvent(w, "egypt", seeded(1)); return w.own[P("ALE")] === 0 ? "The Ottomans" : w.own[P("ALE")] === 1 ? "Venice" : "Nobody"; }, why: "Alexandria and Aleppo become Ottoman; and the toll on the Red Sea lane begins." },
        { say: "Three hazards can strike any year: a typhoon in the China Sea, a failed monsoon, plague in a port. The bot, and the coach, do not count on them. How many events does a year hold?", quiz: ["One dated event at most", "One dated and a hazard", "Only hazards"], answer: 1, why: "Each era's dated events, and one random hazard each year." },
      ] },
      { id: "grievance", title: "Grievance", zh: "", steps: [
        { say: "Enslavement and forced labour are in the game as costs, never as rewards. The Kongo letters (1526) give the holders of São Tomé, Elmina and Mpinda a token each, and take nothing else. Portugal holds Elmina. What does the event change for it?", scene: V("portugal", { round: 3, show: ["LIS", "ELM", "SAO"] }), quiz: ["Plus 1 token and nothing else", "Plus 2 silver", "A port"], answer: 0, calc: s => { const w = copy(s); const si = w.si[0], f = w.fl[0].slice(), g = w.gr[0]; applyEvent(w, "afonso", seeded(1)); return w.gr[0] === g + 1 && w.si[0] === si ? "Plus 1 token and nothing else" : "other"; }, why: "A token, minus 2 standing, and no gain." },
        { say: "How is a token removed?", quiz: ["It fades in time", "4 silver for one (compensation)", "Winning a battle", "Selling a port"], answer: 1, why: "Only silver pays one down; nothing else erases it." },
      ] },
    ] },
    { id: "powers", title: "The nine powers", zh: "", lessons: [
      ...[
        ["hanse", "The Hanse founds factors in the Baltic and at London and Antwerp without a fleet there, and its home seas give +1. It starts with 6 silver and pays dues of 1 a year.", "How many silver does the Hanse start with?"],
        ["portugal", "Portugal starts with ocean ships, defends the ocean seas at +1 until the VOC (1602), and can raise a fort where it has a factor and hold it, for a token. It pays 3 a year for the Estado.", "How many silver does Portugal start with?"],
        ["venice", "Venice starts with three fleets and factors at Alexandria and Constantinople, and earns 1 for each factor at Alexandria, Constantinople or Aleppo.", "How many fleets does Venice start with?"],
        ["ottomans", "The Ottomans take a toll at Constantinople and, after 1517, on the Red Sea lane, and earn from their four great ports. Ships built outside the Mediterranean cost double.", "How many silver does the Ottomans start with?"],
        ["ming", "Ming earns 3 a year from each of Guangzhou and Ningbo and is held to its seas by the sea ban until 1567.", "How many silver does Ming start with?"],
        ["gujarat", "Gujarat sails the monsoon lanes of the rim at any time and carries for others. One fleet a port, a die weaker, ships cost 1 more.", "How many fleets can Gujarat have in one port?"],
        ["malacca", "Malacca earns 1 at home plus 1 for each rival factor in the strait (up to 3), and pays no toll there.", "How many silver does Malacca start with?"],
        ["ryukyu", "Ryukyu is the go-between: it earns for each factor it keeps at Guangzhou, Yuegang and Ningbo, double during the sea ban, and does not fight Ming.", "How many ports do Ryukyu's starting factors stand in?"],
        ["swahili", "The Swahili city-states earn 2 for each of Sofala and Kilwa they hold (gold). The east-coast enslavement event lands on the coast's holders as grievance.", "How many fleets does the Swahili coast start with?"],
      ].map(([id, say, qs]) => {
        const i = POWER_IDX[id], pw = POWERS[i];
        const ans = { hanse: [String(pw.silver), ["4", "6", "8", "9"]], portugal: [String(pw.silver), ["5", "7", "8", "10"]], venice: [String(Object.values(pw.fleets).reduce((a, b) => a + b, 0)), ["1", "2", "3", "4"]], ottomans: [String(pw.silver), ["6", "8", "9", "12"]], ming: [String(pw.silver), ["0", "2", "6", "8"]], gujarat: ["1", ["1", "2", "3", "4"]], malacca: [String(pw.silver), ["5", "7", "9", "11"]], ryukyu: [String(pw.factors.length), ["1", "2", "3", "4"]], swahili: [String(Object.values(pw.fleets).reduce((a, b) => a + b, 0)), ["1", "2", "3", "4"]] }[id];
        return { id: `p-${id}`, title: pw.name, zh: "", steps: [
          { say, scene: V(id, { alone: true }) },
          { say: qs, scene: V(id, { alone: true }), quiz: ans[1], answer: ans[1].indexOf(ans[0]), calc: s => {
            const pwr = POWERS[s.pw[0]];
            if (id === "gujarat") return checkOrders(stateWith(s, { fl: { CAM: 1 } }), 0, [{ t: "build", port: P("CAM") }]) ? "1" : "more";
            if (id === "ryukyu") return String(pwr.factors.length);
            if (id === "venice" || id === "swahili") return String(s.fl[0].reduce((a, b) => a + b, 0));
            return String(s.si[0]);
          }, why: "From the start position." },
        ] };
      }),
    ] },
    { id: "strategy", title: "Strategy", zh: "", lessons: [
      { id: "tempo", title: "Early is worth more", zh: "", steps: [
        { say: "A port pays every round it is held; a factor starts a good's count. Taking Calicut in round 2 instead of round 6 pays four more years. A port worth 1 held from round 2 to round 8 pays how much in all (income only)?", quiz: ["5", "6", "7", "8"], answer: 2, calc: () => String(8 - 2 + 1), why: "Seven rounds of one silver, and the port itself is two standing. That is why the coach favours a quick foothold over a late rich prize." },
        { say: "Silver unspent is only an eighth of a point a unit. Silver that buys a factor in the first rounds earns more than it costs. So spend early; save in the last round only for the order that counts." },
      ] },
      { id: "fight", title: "Contesting a monopoly", zh: "", steps: [
        { say: "A monopoly is worth 3 standing and 3 silver a year, so the rival who has one is your best target: a single factor of yours in one of its source ports can break a tie, or tie it. Portugal has factors in Calicut and Aceh, and so do you (Gujarat) in Calicut, with a fleet at Banten. What breaks Portugal's monopoly this year?", scene: { powers: ["portugal", "gujarat"], seat: 1, bare: true, own: { LIS: 0, CAM: 1 }, fac: { CAL: [0, 1], ACE: [0] }, fl: [{ CAL: 1 }, { BAN: 1 }], si: { 0: 7, 1: 8 }, show: ["CAL", "ACE", "BAN"] },
          valid: [[{ t: "factor", port: P("ACE") }], [{ t: "factor", port: P("BAN") }], [{ t: "claim", port: P("CAL") }]], quiz: ["A factor at Aceh", "A factor at Banten, where your fleet is", "A claim on Calicut"], answer: 1, why: "You are Gujarat. Aceh has none of your fleets, and a claim needs a port nobody holds and four silver for a smaller gain. At Banten you reach two of pepper's three sources, as Portugal has, and a tie leaves nobody the monopoly." },
      ] },
      { id: "defence", title: "Defence", zh: "", steps: [
        { say: "A port with a fleet and a fort is hard to take: the defender gets a die more, and a +1 on each. A held port with no fleet is open to any attack. What is cheaper to hold a rich port than to retake it?", quiz: ["A fleet and a fort", "Nothing", "A second factor"], answer: 0, why: "Three silver for each, against the 4 silver and the token a reconquest costs." },
      ] },
      { id: "end", title: "The last round", zh: "", steps: [
        { say: "In the last round income still counts, but an order that pays later does not. Factors and claims still count at once: a factor (2 silver) is 1 standing, and 2 silver is a quarter of a point. So in round 8, found factors and claims, not fleets." },
        { say: "Now play a game. The coach can be set to Hints or Check in the menu.", play: true },
      ] },
    ] },
  ],
};

for (const c of COURSE.chapters) for (const l of c.lessons) { let last = V("venice", { show: ["VEN", "CON", "ALE", "ALP"] }); for (const st of l.steps) { if (st.scene) last = st.scene; else if (!st.play) st.scene = last; } }

/** Every step with its lesson: [{ step, where, lesson }]. */
export const STEPS = COURSE.chapters.flatMap(c => c.lessons.flatMap(l => l.steps.map((step, i) => ({ step, where: `${l.id} ${i + 1}`, lesson: l }))));

// ---------- the stage ----------
const cache = new WeakMap();
const sceneState = step => { if (!cache.has(step)) cache.set(step, step.scene ? stateOf(step.scene) : null); return cache.get(step); };
export const isTask = step => !!step.pick;

/** The right option of a quiz step: its calc's text, or (valid) the one choice the rules accept. */
export function rightOf(step) {
  const s = sceneState(step);
  if (step.valid) return step.valid.map((os, i) => (checkOrders(s, seatOf(step.scene), os) === "" ? i : -1)).filter(i => i >= 0);
  if (step.calc) return [step.quiz.indexOf(step.calc(s))];
  return null;
}

/** The stage for course.js: the scene's ports on the schematic map; a pick step takes a tap on a port. */
export function mapStage() {
  let ctx = null, box = null, cur = null;
  const tap = p => {
    if (!cur || cur.st.done || !isTask(cur.step)) return;
    const { step, st } = cur, s = sceneState(step);
    if (p === P(step.scene.mark?.split(":")[0] ?? "")) return;
    if (step.pick(s, p)) { st.at = p; ctx.answer({ ok: true, msg: step.why || "Right." }); } else { st.bad = p; ctx.answer({ ok: false, why: `${PORTS[p].name} is not it.` }); }
    cur.redraw();
  };
  return {
    mount(el, c) {
      ctx = c; box = el;
      el.innerHTML = `<div class="cl-map"></div>`;
      el.addEventListener("click", e => { const g = e.target.closest("[data-port]"); if (g) tap(Number(g.dataset.port)); });
    },
    task: step => isTask(step),
    hint(step, st) { st.hint = true; },
    draw(step, st) {
      cur = { step, st, redraw: () => this.draw(step, st) };
      const host = box.querySelector(".cl-map");
      if (!step.scene) { host.innerHTML = ""; host.hidden = true; return; }
      host.hidden = false;
      host.innerHTML = mapSvg(step, st);
    },
  };
}
function mapSvg(step, st) {
  const sc = step.scene, s = sceneState(step), ports = shownPorts(sc, s), set = new Set(ports);
  const xs = ports.map(p => PORTS[p].x), ys = ports.map(p => PORTS[p].y);
  // at least 220 by 120 units, so a small scene's type stays the size of the game's own map
  let x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30, y0 = Math.min(...ys) - 24, y1 = Math.max(...ys) + 26;
  if (x1 - x0 < 220) { const m = (x0 + x1) / 2; x0 = m - 110; x1 = m + 110; }
  if (y1 - y0 < 120) { const m = (y0 + y1) / 2; y0 = m - 60; y1 = m + 60; }
  const marks = Object.fromEntries((sc.mark || "").split(/\s+/).filter(Boolean).map(m => m.split(":")).map(([id, k]) => [P(id), k]));
  const task = isTask(step) && !st.done, right = task && st.hint ? ports.filter(p => step.pick(s, p)) : [];
  let g = "";
  for (const l of LANES) if (set.has(l.a) && set.has(l.b)) {
    const a = PORTS[l.a], b = PORTS[l.b];
    g += `<line class="cl-lane${l.f.includes("m") ? " m" : ""}${l.f.includes("c") ? " c" : ""}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
    g += `<text class="cl-days" x="${(a.x + b.x) / 2}" y="${(a.y + b.y) / 2 - 2}">${l.days}${l.f.includes("p") ? "×" : ""}</text>`;
  }
  for (const p of ports) {
    const o = PORTS[p], owner = s.own[p], boxed = marks[p] === "pick" ? " pick" : "";
    const cls = `cl-port${owner >= 0 ? " held" : ""}${task ? " tap" : ""}${st.bad === p ? " bad" : ""}${st.at === p ? " good" : ""}${right.includes(p) ? " hint" : ""}${boxed}`;
    const fill = owner >= 0 ? `style="fill:var(--p${owner})"` : "";
    g += `<g class="${cls}" data-port="${p}"><circle cx="${o.x}" cy="${o.y}" r="${task ? 9 : 5}" class="hit"/><circle cx="${o.x}" cy="${o.y}" r="4" ${fill}/>`;
    if (s.fort[p]) g += `<rect x="${o.x - 6}" y="${o.y - 6}" width="12" height="12" class="cl-fort"/>`;
    const lb = labelBox(o);   // where the map puts the name, so no two overlap
    g += `<text class="cl-name" x="${lb.x}" y="${lb.y + lb.h - 1.5}">${esc(o.name)}</text>`;
    // fleets and factors in a row above the dot (below it when the name is above)
    const marks2 = [];
    for (let seat = 0; seat < s.n; seat++) {
      if (s.fl[seat][p]) marks2.push(`<rect width="9" height="9" style="fill:var(--p${seat})"/><text x="4.5" y="7.2" class="cl-n" text-anchor="middle">${s.fl[seat][p]}</text>`);
      if (s.own[p] !== seat && hasFactor(s, p, seat)) marks2.push(`<path class="cl-dia" d="M4.5 0 l4.5 4.5 l-4.5 4.5 l-4.5 -4.5z" style="fill:var(--p${seat})"/>`);
    }
    const row = o.lab === "n" || o.lab === "ne" || o.lab === "nw" ? o.y + 6 : o.y - 15;
    marks2.forEach((m, i) => { g += `<g transform="translate(${o.x - 5 * marks2.length + 10 * i},${row})">${m}</g>`; });
  }
  return `<svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" role="img" aria-label="${esc(ports.map(p => PORTS[p].name).join(", "))}">${g}</svg>${legend(s, step.scene)}`;
}
function legend(s, sc) {
  return `<p class="cl-key">${s.pw.map((pi, k) => `<span><i style="background:var(--p${k})"></i>${esc(POWERS[pi].name)}${k === seatOf(sc) ? " (you)" : ""}</span>`).join("")}</p>`;
}
