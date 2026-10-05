// Quote: make a market on a number you don't know. You quote a bid and an ask. The payout is continuous and set
// by each question's own range for "close" (q.tol): inside the market, it falls off smoothly with the market's
// width measured in ranges, so a point market exactly right pays the most and a wide one little; outside, the
// payout fades with how far the truth lies beyond your market, in ranges, and a loss grows in its place, as a
// market maker loses when the one who knows the number hits the bid or lifts the offer.
//
// Widths and distances are in the question's units: for a magnitude, doublings (log2 of the ratio), with the
// range converted the same way; for a year, a count or a percentage, plain units.

export const START = 1000;                 // the book you start with
export const PER_SET = 10;
const GAIN = 300;                          // a point market exactly right
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
/** The question's range for "close", in its units: a ratio becomes doublings. */
export const rangeOf = q => (q.scale === "log" ? Math.log2(1 + q.tol) : q.tol);
/**
 * What a market earns or loses on a question: { inside, width, beyond, delta }. v = width in ranges, u = miss
 * in ranges: delta = GAIN·e^(−v/2)·e^(−u) − LOSS·(1 − e^(−u/3)). Continuous across the market's edge: a miss by
 * a third of a range on a tight market still pays about 60% of exact, a miss by a whole range about breaks even,
 * three ranges out loses about 190, far out 300.
 */
export function settle(q, bid, ask) {
  const width = widthOf(q, bid, ask), beyond = beyondOf(q, bid, ask), inside = beyond === 0;
  const v = width / rangeOf(q), u = beyond / rangeOf(q);
  const delta = Math.round(GAIN * Math.exp(-v / 2) * Math.exp(-u) - LOSS * (1 - Math.exp(-u / 3)));
  return { inside, width, beyond, delta };
}
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
  const taker = Math.round(Math.sign(edge) * LOSS * (1 - Math.exp(-Math.abs(edge) / 3)));
  return { maker: -taker, taker, edge };
}

// ---------- which questions ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The set for a seed: PER_SET questions from the bank in a seeded order, at most two from any category. */
export function pickSet(seed, bank, perSet = PER_SET) {
  const r = rng(seed), order = [...bank];
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const used = {}, out = [];
  for (const q of order) {
    if ((used[q.cat] || 0) >= 2) continue;
    used[q.cat] = (used[q.cat] || 0) + 1;
    out.push(q);
    if (out.length === perSet) break;
  }
  return out;
}

// ---------- words ----------
/** The question's range for "close", as shown on the card: "±15%", "±3 years", "±1". */
export function rangeText(q) {
  if (q.scale === "log") return `±${Math.round(q.tol * 100)}%`;
  const unit = q.unit === "year" ? (q.tol === 1 ? "year" : "years") : q.unit === "years" ? "years" : q.unit;
  return `±${q.tol} ${unit}`.replace(/ $/, "");
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
