// Boast's computer players: probability, as Cartel's. Each sees its own five dice and everything said, and samples
// what could be under the other cups, weighting each sample by how likely its owner was to bid what they bid with it:
// a player calls the face they hold most more often than not, so three bids on fives from one seat make fives under
// that cup likelier (a softmax over the faces in the bid's own counting: under wild bids every face's count includes
// the ones, so a cup full of ones says nothing about which face its owner calls). From the samples, the chance any bid
// holds. It opens with the boldest bid it rates likely; on its turn it opens the last bid (开) when that is likelier to
// be false than a raise of its own is to get it through, chops (劈) when it's nearly sure, and answers a chop with a
// chop back (反劈) when it trusts its own bid. Medium doesn't read the others' bids and is noisier; Easy is noisier
// still and counts only its own dice against the average. tools/boast-arena.mjs measures them against each other.
import { bidsAfter, plain, opening, seen } from "./boast-rules.js";

export const LEVELS = {
  hard: { samples: 420, beta: 0.85, look: true, at: 0.42, soft: 0.09, gain: 0.35, base: 0.1, lean: 0, piAt: 0.16, fanpiAt: 0.7, noise: 0.03 },
  medium: { samples: 220, beta: 0, open: 0.56, fear: 0.58, base: 0.1, piAt: 0.1, fanpiAt: 0.78, bluff: 0.14, noise: 0.08 },
  easy: { samples: 90, beta: 0, open: 0.5, fear: 0.45, base: 0.12, piAt: 0.05, fanpiAt: 0.85, bluff: 0.25, noise: 0.18 },
};
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

const countsOf = hand => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of hand) c[d]++; return c; };

/** P(X ≥ k) for X ~ Binomial(n, p). */
export function atLeast(k, n, p) {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let term = (1 - p) ** n, cdf = 0;                       // P(X = 0)
  for (let i = 0; i < k; i++) { cdf += term; term *= ((n - i) / (i + 1)) * (p / (1 - p)); }
  return Math.max(0, 1 - cdf);
}
/** How readily the next player opens a bid that looks this likely. */
const opened = (p, at = 0.42, soft = 0.09) => 1 / (1 + Math.exp((p - at) / soft));

/** How likely a player was to make a bid with this cup: their faces' counts, softmax by beta, in the bid's counting. */
function likelihood(c, b, beta) {
  if (!beta) return 1;
  const z = plain(b), faces = z ? [1, 2, 3, 4, 5, 6] : [2, 3, 4, 5, 6];
  const m = f => c[f] + (z ? 0 : c[1]);
  let sum = 0;
  for (const f of faces) sum += Math.exp(beta * m(f));
  return Math.exp(beta * m(b.f)) / sum;
}

function rollHand(rng, san) {
  for (;;) {
    const h = Array.from({ length: 5 }, () => 1 + Math.floor(rng() * 6));
    if (!san || new Set(h).size < 5) return h;
  }
}

/**
 * Tables that could be under the cups, as one seat sees them: the seat's own dice as they are, the others' rolled,
 * each table weighted by the likelihood of the round's bids. Each sample keeps its face totals (and its cups, for the
 * leopards).
 */
export function sample(v, L, rng) {
  const out = [], others = [...Array(v.seats).keys()].filter(i => i !== v.me);
  const byWho = new Map();
  for (const b of v.bids) if (b.s !== v.me) (byWho.get(b.s) || byWho.set(b.s, []).get(b.s)).push(b);
  const mine = countsOf(v.mine);
  for (let k = 0; k < L.samples; k++) {
    const hands = [v.mine];
    const tot = [...mine];
    let w = 1;
    for (const o of others) {
      const h = rollHand(rng, v.opts.san), c = countsOf(h);
      for (const b of byWho.get(o) || []) w *= likelihood(c, b, L.beta);
      for (let f = 1; f <= 6; f++) tot[f] += c[f];
      hands.push(h);
    }
    out.push({ w, tot, hands });
  }
  return out;
}

/** The chance a bid holds over the samples. */
export function chance(samples, b, opts) {
  let yes = 0, all = 0;
  const z = plain(b);
  for (const x of samples) {
    let n = x.tot[b.f] + (z ? 0 : x.tot[1]);
    if (opts.bao) for (const h of x.hands) {
      if (h.every(d => d === b.f)) n += 2;
      else if (!z && h.every(d => d === b.f || d === 1) && h.some(d => d === b.f)) n += 1;
    }
    all += x.w;
    if (n >= b.n) yes += x.w;
  }
  return all ? yes / all : 0;
}

/** How many of a bid's dice are in this seat's own cup (the face, and the ones unless it's plain). */
const ownFor = (v, b) => v.mine.filter(d => d === b.f || (!plain(b) && d === 1)).length;

/** A computer player's move for a seat: a bid, 开, 劈, or the answer to a chop. */
export function botMove(state, seat, { level = "hard", rng = Math.random } = {}) {
  const v = seen(state, seat), L = LEVELS[level] || LEVELS.hard;
  const prev = v.bids.length ? v.bids[v.bids.length - 1] : null;
  const noisy = p => Math.min(1, Math.max(0, p + (rng() - 0.5) * 2 * L.noise));
  const samples = sample(v, L, rng);
  if (v.step === "pi") return { t: noisy(chance(samples, prev, v.opts)) > L.fanpiAt ? "fanpi" : "take" };

  // the bids worth weighing: from the least that follows up to a few dice more
  const from = prev ? prev.n : opening(v.seats);
  const choices = bidsAfter(prev, v.seats, v.opts, from + 4).map(b => ({ b, p: noisy(chance(samples, b, v.opts)), own: ownFor(v, b) }));
  if (!choices.length) return { t: "kai" };

  if (!prev && !L.look) {
    // opening: the boldest bid still likely, on a face this cup holds well
    const good = choices.filter(c => c.p >= L.open && !plain(c.b));
    const pool = good.length ? good : choices.filter(c => !plain(c.b));
    const top = Math.max(...pool.map(c => c.b.n));
    const at = pool.filter(c => c.b.n >= top - (rng() < 0.35 ? 1 : 0));
    at.sort((a, b) => b.own - a.own || b.p - a.p);
    const pickBluff = rng() < L.bluff && at.length > 1;
    const c = pickBluff ? at[1 + Math.floor(rng() * (at.length - 1))] : at[0];
    return { t: "bid", n: c.b.n, f: c.b.f, z: c.b.z };
  }

  const pLast = prev ? noisy(chance(samples, prev, v.opts)) : 1;
  if (L.look) {
    // a look ahead to the next player: in each sample they see their own cup and reckon the bid on it (the rest by
    // the average), opening it when it looks unlikely to them. Opened, a raise costs me a cup if it's false and them
    // one if it's true; raised past, the round goes on. So a true bid that looks false to them (a plain bid on a face
    // this cup holds, a face they lack) draws a wrong 开, and a false one that looks likely passes.
    const nxt = (v.me + 1) % v.seats, rest = 5 * (v.seats - 1);
    for (const c of choices) {
      const z = plain(c.b), p = z ? 1 / 6 : 1 / 3;
      let u = 0, all = 0;
      for (const x of samples) {
        const h = x.hands[nxt <= v.me ? nxt + 1 : nxt];
        const theirs = h.filter(d => d === c.b.f || (!z && d === 1)).length;
        const o = opened(atLeast(c.b.n - theirs, rest, p), L.at, L.soft);
        let n = x.tot[c.b.f] + (z ? 0 : x.tot[1]);
        if (v.opts.bao) for (const hh of x.hands) {
          if (hh.every(d => d === c.b.f)) n += 2;
          else if (!z && hh.every(d => d === c.b.f || d === 1) && hh.some(d => d === c.b.f)) n += 1;
        }
        u += x.w * (o * (n >= c.b.n ? L.gain : -1) - (1 - o) * L.base);
        all += x.w;
      }
      c.u = all ? u / all : -1;
    }
    choices.sort((a, b) => b.u - a.u || a.b.n - b.b.n);
    const best = choices[0];
    const openU = (1 - pLast) * L.gain - pLast;
    if (prev && openU > best.u + L.lean) return { t: v.opts.pi && pLast < L.piAt ? "pi" : "kai" };
    return { t: "bid", n: best.b.n, f: best.b.f, z: best.b.z };
  }
  choices.sort((a, b) => b.p - a.p || a.b.n - b.b.n || b.own - a.own);
  let best = choices[0];
  // now and then a bid nearly as likely on a face this cup doesn't hold, so the bids don't give the cup away
  if (rng() < L.bluff) {
    const alt = choices.filter(c => c.p >= best.p - 0.08 && c !== best);
    if (alt.length) best = alt[Math.floor(rng() * alt.length)];
  }
  // open when the last bid is likelier false than a raise is to be caught: a raise loses if it's opened and false
  const lossIfRaise = (1 - best.p) * L.fear + L.base;
  if (pLast < lossIfRaise) return { t: v.opts.pi && pLast < L.piAt ? "pi" : "kai" };
  return { t: "bid", n: best.b.n, f: best.b.f, z: best.b.z };
}

/** The chance the last bid holds, as this seat would reckon it at its strongest: the odds the page may show. */
export function oddsFor(state, seat, rng = Math.random) {
  const v = seen(state, seat), b = v.bids[v.bids.length - 1];
  if (!b) return null;
  return chance(sample(v, { ...LEVELS.hard, samples: 600 }, rng), b, v.opts);
}
