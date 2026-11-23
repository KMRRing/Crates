// Spot: sums fly across the screen, a trader's working (spreads, premiums, percentages, FX, basis points).
//
// Alone, their answers sit on a shelf among fakes: tap an answer before its sum runs out. Each number comes onto the
// shelf at a moment of its own, up to a few seconds before its sum flies in, in a free slot picked at random, so
// neither when nor where a number appears gives away which sum it answers: you have to work the sum out.
//
// Co-op (two to six at a table) there's no shelf. Each player sees only their own sums, and most of them come in
// pairs: a sum on one screen and a different sum with the same result on another, appearing up to a few seconds
// apart. You call out what your sums make; whoever has the other taps the sum on their screen that makes the same,
// now or when it arrives. Some sums have no partner (decoys): tapping one costs a life. A pair that leaves both screens
// untapped costs a life. Versus, everyone plays the alone game on the same seed from the same start: the same map.
//
// Everything is worked out from a seed and the taps. The timeline (which sum appears when, with which fakes or which
// partner) comes from the seed alone; what happened is replayed from the taps by play(). Two devices with the same
// seed and the same taps see the same game, so only taps need sending.

export const LIVES = 3;
export const SHELF = 8;                       // answer slots per player
/** How long before its sum flies in a number comes onto the shelf (each its own, between these, in ms). */
export const LEAD = [300, 3500];

// ---------- random numbers ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
/** FNV-1a: a string's 32-bit hash, for choices that must come out the same on every replay. */
const hash = text => { let h = 0x811C9DC5; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193); return h >>> 0; };
const pickWeighted = (r, weights) => {
  let x = r() * weights.reduce((a, [, w]) => a + w, 0);
  for (const [v, w] of weights) { x -= w; if (x <= 0) return v; }
  return weights[weights.length - 1][0];
};

// ---------- the pace: a slowly rising budget of difficulty ----------
// Every sum has a cost (how hard it is: 1 for a spread or a premium, 2 for a percentage, 3 for an FX rate or basis points,
// +1 with bigger figures, +1 with a modifier), and the run has a budget of difficulty per second that rises slowly. A cheap
// sum is followed quickly by the next; an expensive one buys a few seconds. So you might get four spreads in a row, or one
// basis-point sum with time to think. Lifetimes scale with cost too, and shorten a little over time.
const rate = ms => 0.45 + 0.85 * Math.min(1, ms / 240000) + 0.12 * Math.max(0, ms - 240000) / 60000;   // difficulty points a second: 0.45, 1.3 at 4 min
const lifeFor = (cost, ms) => (3600 + 1700 * cost) * (1 - 0.22 * Math.min(1, ms / 240000));
const MAX_LIFE = 11000;
/** How far back a new sum's numbers must differ from the others': a sum's lifetime and a tenth, and the lead. */
export const NEAR = MAX_LIFE * 1.1 + LEAD[1];
/** The difficulty level shown to the player: up one every 30 seconds. */
export const levelAt = ms => 1 + Math.floor(ms / 30000);
const ramp = (ms, from, to) => Math.min(1, Math.max(0, (ms - from) / (to - from)));
/** What can come up, and how often, this far into the run: spreads and premiums, then percentages, then FX and basis points,
 *  then bigger figures. */
function mixAt(ms) {
  return {
    kinds: [["spread", 3], ["prem", 2], ["pct", 3 * ramp(ms, 12000, 72000)], ["fx", 1.3 * ramp(ms, 35000, 110000)], ["bp", 1 * ramp(ms, 50000, 140000)]].filter(([, w]) => w > 0),
    big: 0.7 * ramp(ms, 60000, 200000),                             // the chance of bigger numbers
    fakes: ms < 20000 ? [1, 1] : ms < 75000 ? [1, 2] : [2, 2],
  };
}
/** What each kind of sum costs, before bigger figures and a modifier. */
export const COST = { spread: 1, prem: 1, pct: 2, fx: 3, bp: 3 };
const cost = (kind, big) => COST[kind] + (big ? 1 : 0);

// ---------- modifiers: from 45 s in, an operation to apply to every result before anything else ----------
const MODS = [[null, 6], [{ op: "+", k: 1 }, 2], [{ op: "+", k: 2 }, 2], [{ op: "+", k: 3 }, 1], [{ op: "−", k: 1 }, 2], [{ op: "−", k: 2 }, 1],
  [{ op: "+", k: 10 }, 1], [{ op: "×", k: 2 }, 1]];                   // a bit over a third of the windows have none
const MOD_FROM = 45000, MOD_WINDOW = 20000;
/** The modifier a seat is under at a moment (changes every 20 s from 45 s in; none before), or null. */
export function modifierAt(seed, seat, ms) {
  if (ms < MOD_FROM) return null;
  const window = Math.floor((ms - MOD_FROM) / MOD_WINDOW);
  const r = rng((seed ^ Math.imul(window + 1, 0x85EBCA6B) ^ Math.imul(seat + 1, 0xC2B2AE35)) >>> 0);
  return pickWeighted(r, MODS);
}
/** A result after a modifier. */
export const applyMod = (m, v) => (!m ? v : m.op === "+" ? v + m.k : m.op === "−" ? v - m.k : v * m.k);
/** The result that a modifier turns into v, or null if none can (an odd v under ×2, or nothing positive). */
const unMod = (m, v) => { const r = !m ? v : m.op === "+" ? v - m.k : m.op === "−" ? v + m.k : v % m.k === 0 ? v / m.k : null; return r != null && r >= 2 ? r : null; };
export const modText = m => (!m ? "" : `${m.op}${m.k}`);

// Korbi, 24 November 2026: Spot's sums are a trader's working, "the trader one", in place of bare arithmetic; the game stays
// as it is. A spread (437 − 412), a premium on futures (412 + 18), a percentage (25% of 64), an FX rate (€40 × 1.25) and
// basis points of a sum in thousands (25bp of 40k: a basis point is a hundredth of a percent, so 25 bp of 40,000 is 100).
const PCT = [10, 20, 25, 50], PCT_BIG = [5, 15, 30, 40, 60, 75];
const FX = [1.1, 1.2, 1.5], FX_BIG = [1.05, 1.25, 1.3, 0.8, 0.9];
const BP = [10, 20, 25, 50], BP_BIG = [5, 15, 30, 40, 75];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** The whole numbers a rate can be applied to and stay whole: n × rate is whole when n is a multiple of this. */
const fxStep = x => { const h = Math.round(x * 100); return 100 / gcd(h, 100); };
const fxText = x => (Number.isInteger(x * 10) ? x.toFixed(1) : x.toFixed(2));

/** A sum of a kind: { text, answer, points, ... }. Results are whole and positive. */
function makeSum(r, kind, big) {
  switch (kind) {
    case "spread": { const b = big ? int(r, 500, 950) : int(r, 120, 480), d = big ? int(r, 11, 49) : int(r, 2, 15); return { a: b + d, b, text: `${b + d} − ${b}`, answer: d, points: big ? 2 : 1 }; }
    case "prem": { const f = big ? int(r, 500, 940) : int(r, 120, 480), p = big ? int(r, 11, 49) : int(r, 2, 15); return { a: f, b: p, text: `${f} + ${p}`, answer: f + p, points: big ? 2 : 1 }; }
    case "pct": { const p = (big ? PCT_BIG : PCT)[int(r, 0, (big ? PCT_BIG : PCT).length - 1)], step = 100 / gcd(p, 100), base = step * int(r, Math.ceil(10 / step), Math.floor((big ? 400 : 120) / step)); return { a: base, b: p, text: `${p}% of ${base}`, answer: base * p / 100, points: big ? 3 : 2 }; }
    case "fx": { const x = (big ? FX_BIG : FX)[int(r, 0, (big ? FX_BIG : FX).length - 1)], step = fxStep(x), a = step * int(r, Math.ceil(10 / step), Math.floor((big ? 160 : 80) / step)); return { a, b: x, text: `€${a} × ${fxText(x)}`, answer: Math.round(a * x), points: big ? 4 : 3 }; }
    case "bp": { const b = (big ? BP_BIG : BP)[int(r, 0, (big ? BP_BIG : BP).length - 1)], step = 10 / gcd(b, 10), k = step * int(r, Math.ceil(10 / step), Math.floor((big ? 300 : 120) / step)); return { a: k, b, text: `${b}bp of ${k}k`, answer: k * b / 10, points: big ? 4 : 3 }; }
  }
}

/** A sum of a kind that makes exactly n, or null if that kind can't (a premium for a small number, an FX rate for a prime). */
function sumMaking(r, kind, n, big) {
  const any = xs => (xs.length ? xs[Math.floor(r() * xs.length)] : null);
  switch (kind) {
    case "spread": { const b = big ? int(r, 500, 950) : int(r, 120, 480); return { text: `${n + b} − ${b}`, answer: n, points: big ? 2 : 1 }; }
    case "prem": { if (n < 110) return null; const p = int(r, 2, Math.min(big ? 49 : 15, n - 100)); return { text: `${n - p} + ${p}`, answer: n, points: big ? 2 : 1 }; }
    case "pct": { const p = any([...PCT, ...PCT_BIG].filter(q => (n * 100) % q === 0 && n * 100 / q <= 999)); return p == null ? null : { text: `${p}% of ${n * 100 / p}`, answer: n, points: big ? 3 : 2 }; }
    case "fx": { const x = any([...FX, ...FX_BIG].filter(q => Number.isInteger(Math.round(n / q * 1e6) / 1e6) && n / q <= 400)); return x == null ? null : { text: `€${Math.round(n / x)} × ${fxText(x)}`, answer: n, points: big ? 4 : 3 }; }
    case "bp": { const b = any([...BP, ...BP_BIG].filter(q => (n * 10) % q === 0 && n * 10 / q <= 999)); return b == null ? null : { text: `${b}bp of ${n * 10 / b}k`, answer: n, points: big ? 4 : 3 }; }
  }
  return null;
}

/**
 * A fake for a sum: an answer you'd get by slipping. A basis point taken for a tenth of a percent (ten times out), the
 * currency left unconverted or converted the wrong way, a neighbouring percentage, a carry dropped; off by one or ten, and
 * swapped digits, for anything. n is the value the fake should sit near (the answer as modified, when there's a modifier).
 */
function fakeFor(r, sum, kind, n) {
  const swapped = n >= 10 && n % 10 !== Math.floor(n / 10) % 10 ? Number(String(n).split("").reverse().join("")) : null;
  const options = [n + 1, n - 1, n + 2, n - 2, n + 10, n - 10, swapped];
  if (kind === "pct") options.push(sum.a * sum.b * 2 / 100, sum.a * sum.b / 200, sum.a / 10);
  if (kind === "fx") options.push(sum.a, Math.round(sum.a / sum.b), sum.a + 10);
  if (kind === "bp") options.push(n * 10, n / 10, sum.a * sum.b);
  if (kind === "prem") options.push(n - 100, n + 100);
  if (kind === "spread") options.push(n + 20);
  const ok = options.filter(v => v != null && Number.isInteger(v) && v > 0 && v !== n && v < 10000);
  return ok[Math.floor(r() * ok.length)];
}

// ---------- the timeline ----------
const timelines = new Map();
/**
 * Alone: the run's sums up to time t (ms from the start): { id, at, life, kind, text, answer, mod (the modifier it
 * came under, or null), value (the answer as modified: what the shelf shows), points, shown (when the answer comes
 * onto the shelf), fakes: [{ id, value, life, shown }] }. No two sums whose numbers can be on the shelf together show
 * the same value, and no fake equals a value on the shelf with it.
 */
export function timeline(seed, seats, t) {
  const key = `${seed}/${seats}`;
  let tl = timelines.get(key);
  if (!tl) { tl = { r: rng(seed), sums: [], next: 1500 }; timelines.set(key, tl); }
  while (tl.next <= t + MAX_LIFE) {
    const at = tl.next, r = tl.r, mix = mixAt(at), id = tl.sums.length, mod = modifierAt(seed, 0, at);
    // values that might be on the shelf at the same time: answers (as modified) and fakes from the last 11 seconds,
    // and the few before, whose numbers come early
    const near = tl.sums.filter(s => s.at > at - NEAR);
    const taken = new Set(near.flatMap(s => [s.value, ...s.fakes.map(f => f.value)]));
    let sum = null, kind = null, big = false;
    for (let tries = 0; tries < 40 && (!sum || taken.has(applyMod(mod, sum.answer))); tries++) { kind = pickWeighted(r, mix.kinds); big = r() < mix.big; sum = makeSum(r, kind, big); }
    const value = applyMod(mod, sum.answer);
    const values = new Set(near.map(s => s.value).concat(value));
    const life = lifeFor(cost(kind, big) + (mod ? 1 : 0), at);
    // with a modifier on, the unmodified answer is the obvious slip, so it's always among the fakes
    const wanted = [];
    if (mod && !values.has(sum.answer)) wanted.push(sum.answer);
    const nFakes = int(r, mix.fakes[0], mix.fakes[1]);
    for (let k = 0; k < nFakes; k++) {
      let v = null;
      for (let tries = 0; tries < 12 && (v == null || values.has(v) || wanted.includes(v)); tries++) v = fakeFor(r, sum, kind, value);
      if (v != null && !values.has(v) && !wanted.includes(v)) wanted.push(v);
    }
    // when each number comes onto the shelf: from a stream of the sum's own, so drawing them leaves the sums' stream be
    const lr = rng((seed ^ Math.imul(id + 1, 0x27D4EB2F)) >>> 0), shown = () => Math.max(0, Math.min(Math.floor(at - LEAD[0]), Math.max(Math.ceil(at - LEAD[1]), Math.round(at - LEAD[0] - lr() * (LEAD[1] - LEAD[0])))));
    const fakes = wanted.map((v, k) => ({ id: `f${id}.${k}`, value: v, life: life * (0.75 + 0.25 * r()), shown: shown() }));
    tl.sums.push({ id, at, life, kind, text: sum.text, answer: sum.answer, mod, value, points: sum.points + (mod ? 1 : 0), seat: 0, shelf: 0, shown: shown(), fakes });
    tl.next = at + 1000 * (cost(kind, big) + (mod ? 1 : 0)) / rate(at);
  }
  return tl.sums.filter(s => s.at <= t);
}

// ---------- the timeline together: pairs and decoys ----------
const duoTimelines = new Map();
/** How much faster sums come for a table of so many than for two: more ears to call to, so a little faster, not N/2. */
export const paceFor = seats => Math.sqrt(Math.max(2, seats) / 2);
/**
 * Co-op: the run's sums up to time t, each { id, at, life, seat (whose screen), kind, text, answer, mod (that
 * seat's modifier when it appeared), value (what it makes after the modifier: the number that gets called), points,
 * pair (the pair's id, or null for a decoy) }. A pair is two sums that make one value, on two different screens
 * (any two of the table's), the second appearing 0.6–4 s after the first, each under its own seat's modifier. Values
 * never repeat across sums that can be on screen at once, so a called number always means one thing. Two seats deal
 * exactly as they always have; more come a little faster (paceFor).
 */
export function duoTimeline(seed, t, seats = 2) {
  const key = `${seed}/${seats}`;
  let tl = duoTimelines.get(key);
  if (!tl) { tl = { r: rng(seed ^ 0x5bd1e995), sums: [], next: 1500, pairs: 0 }; duoTimelines.set(key, tl); }
  const window = MAX_LIFE + 4000, pace = paceFor(seats);
  while (tl.next <= t + MAX_LIFE + 4000) {
    const at = tl.next, r = tl.r, mix = mixAt(at);
    // the value that gets called out: what each seat's sum makes after that seat's own modifier
    const taken = new Set(tl.sums.filter(s => Math.abs(s.at - at) < window * 1.2).map(s => s.value));
    const decoy = r() < 0.3;
    // two screens: for a pair, one and the other (one draw, as it always was); for more, any other than the first
    const first = Math.floor(r() * seats), second = seats === 2 ? 1 - first : (first + 1 + Math.floor(r() * (seats - 1))) % seats;
    const modFirst = modifierAt(seed, first, at), later = at + 600 + r() * 3400, modSecond = modifierAt(seed, second, later);
    let made = null, kind = null, big = false, value = null, raw = null;
    for (let tries = 0; tries < 60 && (!made || taken.has(value) || (!decoy && raw == null)); tries++) {
      kind = pickWeighted(r, mix.kinds); big = r() < mix.big; made = makeSum(r, kind, big);
      value = applyMod(modFirst, made.answer);
      raw = unMod(modSecond, value);                                 // what the partner's sum must make
    }
    const push = (when, seat, s, mod, pair) => tl.sums.push({ id: tl.sums.length, at: when, life: lifeFor(cost(kind, big) + (mod ? 1 : 0), when), seat,
      kind, text: s.text, answer: s.answer, mod, value, points: s.points + (mod ? 1 : 0), pair });
    if (decoy || raw == null) push(at, first, made, modFirst, null);
    else {
      // the partner sum: a different way to that value, after the partner's own modifier, preferably a different kind
      let other = null;
      for (let tries = 0; tries < 30 && (!other || (other.text === made.text && modSecond === modFirst)); tries++) other = sumMaking(r, pickWeighted(r, mix.kinds), raw, big);
      if (!other) other = sumMaking(r, "spread", raw, big);                       // a spread makes anything
      const pair = tl.pairs++;
      push(at, first, made, modFirst, pair);
      push(later, second, other, modSecond, pair);
    }
    tl.next = at + 1350 * (cost(kind, big) + (modFirst ? 1 : 0)) / rate(at) / pace;
  }
  return tl.sums.filter(s => s.at <= t).sort((a, b) => a.at - b.at);
}

/**
 * Co-op, the run at time t given the taps ([{ id, t, seat, sum }]): { sums: those on screen (with progress),
 * lives, score, streak, multiplier, cleared (pairs), missed (pairs), wrong, best, over, recent }. A tap on a sum
 * that has a partner clears the pair (both sums go, the partner's even before it appears); a tap on a decoy costs a
 * life; a pair that leaves both screens untapped costs a life.
 */
function playDuo(seed, taps, t, seats = 2) {
  const sums = duoTimeline(seed, t + 5000, seats);               // partners due soon, so a tap can clear them early
  const byId = new Map(sums.map(s => [s.id, s]));
  // each sum's partner, found through its pair (every frame replays the run: no search of the whole run per sum)
  const pairs = new Map(), partner = new Map();
  for (const s of sums) if (s.pair != null) pairs.set(s.pair, [...(pairs.get(s.pair) || []), s]);
  for (const s of sums) if (s.pair != null) partner.set(s.id, pairs.get(s.pair).find(o => o.id !== s.id));
  const happenings = [];
  for (const s of sums) {
    if (s.at <= t) happenings.push({ at: s.at, order: 0, type: "spawn", s });
    if (s.at + s.life <= t) happenings.push({ at: s.at + s.life, order: 2, type: "expire", s });
  }
  for (const tap of taps) if (tap.t <= t) happenings.push({ at: tap.t, order: 1, type: "tap", tap });
  happenings.sort((x, y) => x.at - y.at || x.order - y.order || String(x.tap?.id ?? x.s?.id).localeCompare(String(y.tap?.id ?? y.s?.id)));

  const st = { lives: LIVES, score: 0, streak: 0, best: 0, cleared: 0, missed: 0, wrong: 0, over: null, recent: [] };
  const status = new Map();                                      // sum id -> "on" | "gone" | "cleared"
  const lose = (at, what) => { st.lives--; st.streak = 0; st.recent.push({ ...what, at }); if (st.lives <= 0 && !st.over) st.over = { at }; };
  for (const h of happenings) {
    if (st.over && h.at > st.over.at) break;
    const s = h.s;
    if (h.type === "spawn") { if (!status.has(s.id)) status.set(s.id, "on"); continue; }
    if (h.type === "expire") {
      if (status.get(s.id) !== "on") continue;
      status.set(s.id, "gone");
      const p = partner.get(s.id);
      // a pair is missed once both its sums have gone untapped
      if (p && (status.get(p.id) === "gone")) { st.missed++; lose(h.at, { type: "miss", sum: s.id, pair: s.pair }); }
      continue;
    }
    const { seat, sum } = h.tap, x = byId.get(sum);
    if (!x || x.seat !== seat || status.get(sum) !== "on") continue;      // gone already, or a double tap
    status.set(sum, "cleared");
    if (x.pair == null) { st.wrong++; lose(h.at, { type: "wrong", sum, seat }); continue; }
    const p = partner.get(sum);
    status.set(p.id, "cleared");
    st.streak++;
    st.best = Math.max(st.best, st.streak);
    st.score += Math.round(Math.max(x.points, p.points) * 2 * multiplier(st.streak - 1) * 10);
    st.cleared++;
    st.recent.push({ type: "clear", sum, partner: p.id, seat, at: h.at });
  }
  const until = st.over ? st.over.at : t;
  return {
    ...st,
    multiplier: multiplier(st.streak),
    sums: sums.filter(s => s.at <= t && status.get(s.id) === "on").map(s => ({ ...s, progress: Math.min(1, (until - s.at) / s.life) })),
    recent: st.recent.filter(x => x.at > t - 1500),
  };
}

// ---------- replaying a run ----------
/**
 * Alone (and each player's own run Versus, seats 1): the run as it stands at time t (ms from the start), given the
 * taps so far: [{ id, t (ms from the start), seat, token }]. Returns { sums: those on screen (with progress 0–1),
 * shelves: per player, SHELF slots of tokens or null, lives, score, streak, multiplier, cleared, missed, wrong, best
 * (longest streak), over: { at } or null, recent: what happened lately, for the animations }. Two seats or more is
 * co-op (playDuo).
 */
export function play({ seed, seats }, taps, t) {
  if (seats >= 2) return playDuo(seed, taps, t, seats);
  const sums = timeline(seed, seats, t + LEAD[1]);              // with the sums still to come whose numbers are out
  const happenings = [];
  for (const s of sums) {
    happenings.push({ at: s.at, order: 0, type: "spawn", s });
    happenings.push({ at: s.at + s.life, order: 2, type: "expire", s });
    happenings.push({ at: s.shown, order: 0, type: "show", s, tok: { id: `s${s.id}`, value: s.value, real: true, sum: s.id } });
    for (const f of s.fakes) {
      happenings.push({ at: f.shown, order: 0, type: "show", s, tok: { id: f.id, value: f.value, real: false, sum: s.id } });
      happenings.push({ at: s.at + f.life, order: 2, type: "fade", s, f });
    }
  }
  for (const tap of taps) happenings.push({ at: tap.t, order: 1, type: "tap", tap });
  const due = happenings.filter(h => h.at <= t);                  // only what has happened by now
  const key = h => String(h.tap?.id ?? h.tok?.id ?? h.f?.id ?? h.s?.id);
  due.sort((x, y) => x.at - y.at || x.order - y.order || key(x).localeCompare(key(y)));

  const st = { lives: LIVES, score: 0, streak: 0, best: 0, cleared: 0, missed: 0, wrong: 0, over: null, recent: [] };
  const shelves = Array.from({ length: seats }, () => Array(SHELF).fill(null));
  const status = new Map();                                  // sum id -> "on" | "cleared" | "missed" (none: still to come)
  const tappedEarly = new Map();                             // an answer tapped before its sum came -> when
  const place = (seat, token) => {
    const shelf = shelves[seat], free = shelf.flatMap((x, k) => (x ? [] : [k]));
    // a free slot picked at random (the same on every replay), so where a number lands says nothing
    let slot = free.length ? free[hash(`${seed}/${token.id}`) % free.length] : -1;
    if (slot < 0 && token.real) {                            // full: an answer always gets a place, a fake makes room
      const fakes = shelf.map((x, k) => [x, k]).filter(([x]) => x && !x.real).sort((a, b) => a[0].born - b[0].born);
      if (fakes.length) slot = fakes[0][1];
    }
    if (slot >= 0) shelf[slot] = token;
  };
  const remove = (seat, id) => { const k = shelves[seat].findIndex(x => x && x.id === id); if (k >= 0) shelves[seat][k] = null; };
  const lose = (at, what) => {
    st.lives--;
    st.streak = 0;
    st.recent.push({ ...what, at });
    if (st.lives <= 0 && !st.over) st.over = { at };
  };

  for (const h of due) {
    if (st.over && h.at > st.over.at) break;
    const s = h.s;
    switch (h.type) {
      case "show":
        if (!h.tok.real && shelves[s.shelf].some(x => x && x.value === h.tok.value)) break;   // no number twice on a shelf
        place(s.shelf, { ...h.tok, born: h.at });
        break;
      case "spawn":
        status.set(s.id, "on");
        break;
      case "expire":
        if (status.get(s.id) !== "on") break;
        status.set(s.id, "missed");
        remove(s.shelf, `s${s.id}`);
        st.missed++;
        lose(h.at, { type: "miss", sum: s.id });
        break;
      case "fade":
        remove(s.shelf, h.f.id);
        break;
      case "tap": {
        const { seat, token } = h.tap;
        const k = shelves[seat]?.findIndex(x => x && x.id === token);
        if (k == null || k < 0) break;                       // already gone (a double tap, or it faded)
        const tok = shelves[seat][k];
        if (tok.real && status.get(tok.sum) === "on") {
          shelves[seat][k] = null;
          status.set(tok.sum, "cleared");
          const sum = sums[tok.sum];
          st.streak++;
          st.best = Math.max(st.best, st.streak);
          st.score += Math.round(sum.points * multiplier(st.streak - 1) * 10);
          st.cleared++;
          st.recent.push({ type: "clear", sum: tok.sum, token, seat, at: h.at });
        } else if (tok.real) {
          // an answer whose sum hasn't come yet answers nothing on screen: a wrong tap (once, however fast the taps
          // come), and the number stays for when its sum arrives
          if (h.at - (tappedEarly.get(token) ?? -Infinity) < 500) break;
          tappedEarly.set(token, h.at);
          st.wrong++;
          lose(h.at, { type: "wrong", token, seat, value: tok.value });
        } else {
          shelves[seat][k] = null;
          st.wrong++;
          lose(h.at, { type: "wrong", token, seat, value: tok.value });
        }
        break;
      }
    }
  }
  const until = st.over ? st.over.at : t;
  return {
    ...st,
    multiplier: multiplier(st.streak),
    sums: sums.filter(s => status.get(s.id) === "on").map(s => ({ ...s, progress: Math.min(1, (until - s.at) / s.life) })),
    shelves,
    recent: st.recent.filter(x => x.at > t - 1500),
  };
}

/** The score multiplier for a streak: ×1, then up by a half every 5 in a row, to ×3. */
export const multiplier = streak => Math.min(3, 1 + 0.5 * Math.floor(streak / 5));
