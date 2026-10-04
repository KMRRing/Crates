// Quote: make a market on a number you don't know. You quote a bid and an ask; if the truth lies inside, you
// earn more the tighter your market was; if it lies outside, you lose more the further out it is, as a market
// maker would when the one who knows the number hits the bid or lifts the offer.
//
// Widths and distances are measured in doublings: for a magnitude, log2 of the ratio; for a year or a
// percentage, the gap divided by the question's step. So a market of 10 to 20 million on a city, and one of
// 1850 to 1875 on a year with a 25-year step, are judged alike.

export const START = 1000;                 // the book you start with
export const PER_SET = 10;
const GAIN = 200, ZERO_AT = 2;             // a point market earns 200; a market 4× wide (two doublings, or two steps) earns nothing
const LOSS = 150, LOSS_CAP = 600;          // each doubling outside costs 150, up to 600

/** Width of a market in doublings, for a question. */
export const widthOf = (q, bid, ask) => (q.scale === "log" ? Math.log2(ask / bid) : (ask - bid) / q.scale);
/** How far the truth lies outside a market, in doublings (0 when inside). */
export function beyondOf(q, bid, ask) {
  const t = q.truth;
  if (t >= bid && t <= ask) return 0;
  if (q.scale === "log") return t > ask ? Math.log2(t / ask) : Math.log2(bid / t);
  return (t > ask ? t - ask : bid - t) / q.scale;
}
/** What a market earns or loses on a question: { inside, width, beyond, delta }. */
export function settle(q, bid, ask) {
  const width = widthOf(q, bid, ask), beyond = beyondOf(q, bid, ask), inside = beyond === 0;
  const delta = inside ? Math.round(GAIN * Math.max(0, 1 - width / ZERO_AT)) : -Math.round(Math.min(LOSS_CAP, LOSS * beyond));
  return { inside, width, beyond, delta };
}
/** Why a market can't be quoted, or null. */
export function fault(q, bid, ask) {
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) return "Give a bid and an ask.";
  if (q.scale === "log" && bid <= 0) return "The bid has to be above zero.";
  if (ask <= bid) return "The ask has to be above the bid.";
  return null;
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
