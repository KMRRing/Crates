// Quote: make a market on a number you don't know. You quote a bid and an ask. Each question carries documented
// tiers (q.tiers): the radius a market may have around the truth, both edges within it, for an SS, S, A and B;
// wider is a miss. A market's radius is the distance from the truth to its farther edge, plus the miss again
// when the truth lies outside, so a confident wrong market is judged harder than a wide right one. The payoff is stepwise by grade with a continuous
// run between the steps (so a market a touch tighter earns a touch more), scaled by the question's difficulty;
// past twice the B radius a loss grows in its place, as a market maker loses when the one who knows the number
// hits the bid or lifts the offer.
//
// Widths and distances are in the question's units: for a magnitude, doublings (log2 of the ratio), with the
// tiers converted the same way; for a year, a count or a percentage, plain units.

export const START = 1000;                 // the book you start with
export const PER_SET = 10;
const LOSS = 300;                          // the most a market can lose, approached as the miss grows

/** Width of a market, in the question's units. */
export const widthOf = (q, bid, ask) => (q.scale === "log" ? Math.log2(ask / bid) : ask - bid);
/** How far the truth lies outside a market, in the question's units (0 when inside). */
export function beyondOf(q, bid, ask) {
  const t = q.truth;
  if (t >= bid && t <= ask) return 0;
  if (q.scale === "log") return t > ask ? Math.log2(t / ask) : Math.log2(bid / t);
  return t > ask ? t - ask : bid - t;
}
/** The question's range for "close", in its units: a ratio becomes doublings. (The A tier's radius.) */
export const rangeOf = q => toUnits(q, tiersOf(q).A);
const toUnits = (q, r) => (q.scale === "log" ? Math.log2(1 + r) : r);
/** The question's tiers, from the bank or derived from its range when it has none. */
export function tiersOf(q) {
  if (q.tiers) return q.tiers;
  const t = q.tol, clean = x => Number(x.toPrecision(12));       // 0.1 × 3 is 0.30000000000000004; the width is 0.3
  const T = q.scale === "log" ? { SS: t / 5, S: t, A: t * 2.5, B: t * 5 } : { SS: t <= 2 ? 0 : t / 4, S: t, A: t * 2.5, B: t * 5 };
  return Object.fromEntries(Object.entries(T).map(([g, r]) => [g, clean(r)]));
}
export const GRADES = ["SS", "S", "A", "B", "C"];
/** The payoff at each grade's edge, before difficulty: exact 300, then the steps. */
const STEP = { top: 300, SS: 300, S: 250, A: 180, B: 100 };
/** The difficulty weight: a 1 pays 0.7 of the curve, a 3 pays it, a 5 pays 1.3. */
export const weight = q => 0.7 + 0.15 * ((q.d ?? 3) - 1);
/**
 * A market's radius, in the question's units: how far the truth is from the market's farther edge, plus, when
 * the truth lies outside, the miss again, so a confident wrong market is judged harder than a wide right one.
 */
export function radiusOf(q, bid, ask) {
  const far = q.scale === "log" ? Math.max(Math.log2(q.truth / bid), Math.log2(ask / q.truth)) : Math.max(q.truth - bid, ask - q.truth);
  return far + beyondOf(q, bid, ask);
}
/** The grade of a market: the first tier whose radius holds it, else C. */
export function gradeOf(q, bid, ask) {
  const r = radiusOf(q, bid, ask), T = tiersOf(q);
  for (const g of ["SS", "S", "A", "B"]) { if (T[g] == null || (g === "SS" && T.SS === 0 && r > 0)) continue; if (r <= toUnits(q, T[g]) + 1e-9) return g; }
  return r <= 1e-9 && T.SS === 0 ? "SS" : "C";
}
/**
 * The payoff before difficulty, continuous in the radius through the steps: 300 at exact, the tier payoffs at
 * each tier's edge, 0 at twice the B radius, then a loss that grows towards −300.
 */
export function curve(q, r) {
  const T = tiersOf(q), u = g => toUnits(q, T[g]);
  const knots = [[0, STEP.top]];
  if (T.SS) knots.push([u("SS"), STEP.SS]);
  knots.push([u("S"), STEP.S], [u("A"), STEP.A], [u("B"), STEP.B], [2 * u("B"), 0]);
  for (let i = 1; i < knots.length; i++) {
    const [x0, y0] = knots[i - 1], [x1, y1] = knots[i];
    if (r <= x1) return x1 === x0 ? y1 : y0 + (y1 - y0) * (r - x0) / (x1 - x0);
  }
  const over = r - 2 * u("B");
  return -LOSS * (1 - Math.exp(-over / u("B")));
}
/**
 * What a market earns or loses on a question: { inside, width, beyond, delta }. v = width in ranges, u = miss
 * in ranges: delta = GAIN·e^(−v/2)·e^(−u) − LOSS·(1 − e^(−u/3)). Continuous across the market's edge: a miss by
 * a third of a range on a tight market still pays about 60% of exact, a miss by a whole range about breaks even,
 * three ranges out loses about 190, far out 300.
 */
export function settle(q, bid, ask) {
  const width = widthOf(q, bid, ask), beyond = beyondOf(q, bid, ask), inside = beyond === 0;
  const radius = radiusOf(q, bid, ask), grade = gradeOf(q, bid, ask);
  // a range that holds the answer never loses: however wide, it at worst breaks even (it still banks the question)
  const delta = Math.round((inside ? Math.max(0, curve(q, radius)) : curve(q, radius)) * weight(q));
  return { inside, width, beyond, radius, grade, delta };
}
/** Whether a grade shows adequate knowledge: A or better. B and below bank the question. */
export const adequate = grade => ["SS", "S", "A"].includes(grade);
/** Why a market can't be quoted, or null. */
export function fault(q, bid, ask) {
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return "Give a bid and an ask.";
  if (q.scale === "log" && bid <= 0) return "The bid has to be above zero.";
  if (ask <= bid) return "The ask has to be above the bid.";
  return null;
}

/**
 * Two players: the maker quoted bid–ask; the taker chose "hit" (sold to the maker at the bid), "lift" (bought
 * from the maker at the ask) or "pass". A trade settles between the two by how far the traded price was off the
 * truth, in the question's ranges, on the same smooth curve as a loss alone (up to 300 each way): hitting a bid
 * above the truth pays the taker, hitting one below pays the maker. A pass settles the maker against the house as
 * when playing alone. Returns { maker, taker, edge }.
 */
export function trade(q, bid, ask, take) {
  if (take === "pass") return { maker: settle(q, bid, ask).delta, taker: 0, edge: 0 };
  const price = take === "hit" ? bid : ask;
  const edge = (q.scale === "log" ? Math.log2(take === "hit" ? price / q.truth : q.truth / price) : take === "hit" ? price - q.truth : q.truth - price) / rangeOf(q);
  const taker = Math.round(Math.sign(edge) * LOSS * (1 - Math.exp(-Math.abs(edge) / 3)) * weight(q));
  return { maker: -taker, taker, edge };
}

// ---------- which questions ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The set for a seed: PER_SET questions from the bank in a seeded order, at most two from any category. */
export function pickSet(seed, bank, perSet = PER_SET, perCat = 2) {
  const r = rng(seed), order = [...bank];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const used = {}, out = [];
  for (const q of order) {
    if ((used[q.cat] || 0) >= perCat) continue;
    used[q.cat] = (used[q.cat] || 0) + 1;
    out.push(q);
    if (out.length === perSet) break;
  }
  return out;
}

// ---------- words ----------
/** The question's range for "close", as shown on the card: the A tier, "±15%", "±3 years", "±1". */
export function rangeText(q) { return tierText(q, "A"); }
/** One tier's radius as text: "±15%", "±5 years", "exact". */
export function tierText(q, g) {
  const r = tiersOf(q)[g];
  if (r == null) return "–";
  if (r === 0) return "exact";
  if (q.scale === "log") return `±${Math.round(r * 100)}%`;
  const unit = q.unit === "year" ? (r === 1 ? "year" : "years") : q.unit === "years" ? "years" : q.unit;
  return `±${r} ${unit}`.replace(/ $/, "");
}
/** The tiers in one line: "S ±5 years · A ±15 · B ±30". */
export function tiersText(q) {
  const T = tiersOf(q);
  const short = g => { const t = tierText(q, g); return q.scale === "log" || t === "exact" ? t : t.replace(/ .*$/, ""); };
  return [T.SS ? `SS ${short("SS")}` : null, `S ${tierText(q, "S")}`, `A ${short("A")}`, `B ${short("B")}`].filter(Boolean).join(" · ");
}
/** A number with its unit: "37 million", "$450.3 million", "1937", "£11.44 an hour". */
export function withUnit(v, q) {
  const n = fmt(v, q);
  if (q.unit === "year") return n;
  if (/^[$£€]/.test(q.unit)) { const [cur, ...rest] = q.unit.split(" "); return `${cur}${n}${rest.length ? ` ${rest.join(" ")}` : ""}`; }
  return `${n} ${q.unit}`;
}
export function fmt(v, q) {
  if (q.unit === "year") return String(Math.round(v));
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : 2;
  return v.toLocaleString("en-GB", { maximumFractionDigits: digits });
}
