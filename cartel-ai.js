// Cartel's computer players.
//
// A Mind follows the game's events exactly as one seat sees them and keeps everything that seat could know:
// which dice everyone has, every face it has seen (public, peeked at or its own), every answer it got, every
// proof and caught bluff, every call verdict and Insider count, for as long as each stays true (a constraint on
// a hand lapses the moment that hand changes). It also keeps score of habits: how often each player has been
// caught bluffing and how often they challenge when they could. From all that it samples tables consistent with
// what it knows, weighting them by what bids suggest, and turns the samples into probabilities: that a bid
// holds, that a player really has the role they claim.
//
// A personality turns those probabilities into choices: how readily it calls, challenges and bluffs, how much
// it trusts its own reads, how much noise it adds. The Quant plays the probabilities straight.
import { POWERS, RULES, rng, answer } from "./cartel-engine.js";

export const PERSONAS = {
  quant: { name: "Quant", trait: "super rational", noise: 0.02, bidBluff: 0.12, bluffBias: -0.2, callBias: 0, challengeBias: 0.25,
    takeBias: 0, rerollBias: 0.1, askBias: 0.1, hitBias: 0.3, open: 0.62, raiseMin: 0.5 },
  wildcat: { name: "Wildcat", trait: "somewhat random", noise: 0.35, bidBluff: 0.3, bluffBias: 0.3, callBias: 0, challengeBias: 0,
    takeBias: 0, rerollBias: 0, askBias: 0, hitBias: 0, open: 0.5, raiseMin: 0.4 },
  gambler: { name: "Gambler", trait: "risk taker", noise: 0.08, bidBluff: 0.38, bluffBias: 0.7, callBias: 0.12, challengeBias: 0.45,
    takeBias: -0.2, rerollBias: -0.2, askBias: -0.2, hitBias: 0.6, open: 0.42, raiseMin: 0.34 },
  hedger: { name: "Hedger", trait: "conservative", noise: 0.04, bidBluff: 0.04, bluffBias: -1.2, callBias: -0.05, challengeBias: 0.7,
    takeBias: 0.45, rerollBias: 0.35, askBias: 0.1, hitBias: -0.2, open: 0.76, raiseMin: 0.63 },
  auditor: { name: "Auditor", trait: "suspicious", noise: 0.06, bidBluff: 0.1, bluffBias: -0.4, callBias: -0.1, challengeBias: -0.2,
    takeBias: 0, rerollBias: 0.1, askBias: 0.55, hitBias: 0.1, open: 0.6, raiseMin: 0.5 },
};

// ---------- what one seat knows ----------
export class Mind {
  /** me: the seat it watches for (null = only what's public). n: seats. */
  constructor(me, n) {
    this.me = me;
    this.n = n;
    this.dice = Array.from({ length: n }, () => new Map());   // per player: die id -> { kind, face | null, how }
    this.ver = Array(n).fill(0);                               // per player: bumped whenever their dice change
    this.table = 0;                                            // bumped whenever any die changes
    this.rules = [];                                           // constraints: { p (null: whole table), ver, test, text }
    this.ladder = [];                                          // bids since the last call: { p, q, f }
    this.caught = Array(n).fill(0);                            // claims each player was caught bluffing on
    this.honest = Array(n).fill(0);                            // claims challenged and proved true
    this.chances = Array(n).fill(0);                           // times each player could challenge
    this.challenged = Array(n).fill(0);                        // times they did
    this.out = Array(n).fill(false);
    this.exposure = Array(n).fill(0);                          // questions each hand has answered since it last changed
    this.bidsHeld = Array(n).fill(0);                          // each player's called bids that held
    this.bidsBroke = Array(n).fill(0);                         // and that didn't
    this.seenUpTo = 0;
  }

  /** Each player's chance of bluffing a claim, from what's been caught (a prior of about 30% until there's data). */
  bluffRate(p) { return (this.caught[p] + 1.2) / (this.caught[p] + this.honest[p] + 4); }
  /** How far each player's bids can be trusted to reflect their dice (from their bids that were called). */
  bidHonesty(p) { return (this.bidsHeld[p] + 3) / (this.bidsHeld[p] + this.bidsBroke[p] + 4); }
  /** How readily each player challenges when they can (a prior of about 25%). */
  challengeRate(p) { return (this.challenged[p] + 1) / (this.chances[p] + 4); }

  changed(p) { this.ver[p]++; this.table++; this.exposure[p] = 0; }
  add(p, list, how) { for (const d of list) this.dice[p].set(d.id, { kind: d.kind || "plain", face: d.face ?? null, how }); this.changed(p); }
  drop(p, ids) { for (const id of ids) this.dice[p].delete(id); this.changed(p); }
  /** My own faces, as the engine tells me after any change to my dice. */
  mine(faces) {
    if (!faces || this.me == null) return;
    for (const [id, face] of Object.entries(faces)) { const d = this.dice[this.me].get(Number(id)); if (d) { d.face = face; d.how = "own"; } }
  }
  forget(p, ids) { for (const id of ids) { const d = this.dice[p].get(id); if (d && d.how !== "own") { d.face = null; d.how = null; } } }

  /** Takes in one event as this seat sees it. */
  observe(e) {
    const me = this.me;
    switch (e.t) {
      case "start":
        e.dice.forEach((list, p) => list.forEach(d => this.dice[p].set(d.id, { kind: d.kind, face: null, how: null })));
        this.mine(e.faces);
        break;
      case "take": case "trader": case "receive":
        if (e.dice?.length) this.add(e.p, e.dice.map(d => ({ ...d, kind: "plain" })), "public");
        break;
      case "broker":
        if (e.none) break;
        this.drop(e.target, [].concat(e.lost));
        this.add(e.p, e.dice.map(d => ({ ...d, kind: "plain" })), "public");
        break;
      case "reroll": case "spend": case "enforcer": {
        const p = e.t === "enforcer" ? e.target : e.p, ids = e.dice || [e.die];
        this.forget(p, ids);
        this.changed(p);
        if (p === me) this.mine(e.faces);
        break;
      }
      case "ask": {
        this.exposure[e.p]++;
        this.exposure[e.target]++;
        // each side learns the answer about the other's whole hand, as it is now
        const about = e.p === me ? e.target : e.target === me ? e.p : null;
        if (about != null && e.answer != null) {
          const q = e.question, want = e.answer;
          this.rules.push({ p: about, ver: this.ver[about], test: faces => answer(q, faces) === want, text: describe(q, want) });
        }
        break;
      }
      case "claim":
        this.chances[e.challenger]++;
        break;
      case "challenge":
        this.challenged[e.p]++;
        if (e.held) {
          this.honest[e.claimant]++;
          const d = this.dice[e.claimant].get(e.die.id);
          if (d) { d.face = e.die.face; if (d.how !== "own") d.how = "public"; }
        } else {
          this.caught[e.claimant]++;
          const role = e.role, p = e.claimant;
          const goldIds = [...this.dice[p]].filter(([, d]) => d.kind === "gold").map(([id]) => id);
          this.rules.push({ p, ver: this.ver[p], test: (faces, ids) => !ids.some((id, k) => goldIds.includes(id) && faces[k] === role), text: `no ${POWERS[role].name} in gold` });
        }
        break;
      case "scout":
        if (e.p === me && e.face) { const d = this.dice[e.target].get(e.die); if (d) { d.face = e.face; d.how = "peek"; } }
        break;
      case "insider":
        if (e.p === me && e.count != null) {
          const f = e.face, c = e.count;
          this.rules.push({ p: null, ver: this.table, test: count => count(f) === c, text: `${c} dice show ${f}` });
        }
        break;
      case "bid":
        this.ladder.push({ p: e.p, q: e.q, f: e.f });
        break;
      case "call": {
        const { q, f } = e.bid, held = e.held;
        if (held) this.bidsHeld[e.bid.by]++; else this.bidsBroke[e.bid.by]++;
        this.rules.push({ p: null, ver: this.table, test: count => (count(f) >= q) === held, text: held ? `at least ${q} × ${f}` : `fewer than ${q} × ${f}` });
        this.ladder = [];
        break;
      }
      case "pay": case "loseGold":
        this.drop(e.p, (e.dice || [e.die]).map(d => d.id));
        break;
      case "out":
        this.out[e.p] = true;
        this.drop(e.p, [...this.dice[e.p].keys()]);
        this.ladder = this.ladder.filter(b => b.p !== e.p);
        break;
    }
  }

  /** Brings this mind up to date with a game's event log (as seat `me` sees it). */
  follow(game, view) {
    for (; this.seenUpTo < game.events.length; this.seenUpTo++) this.observe(view(game.events[this.seenUpTo]));
  }

  /** Constraints still true: a hand's lapse when that hand changes; the table's when any die changes. */
  live() { return this.rules.filter(r => (r.p == null ? r.ver === this.table : r.ver === this.ver[r.p])); }

  /**
   * Tables consistent with what this seat knows: every player's dice, known faces fixed, unknown ones rolled,
   * redrawn until each hand meets the constraints on it, then the table until it meets the table's. Each comes
   * with a weight: bids lean towards faces the bidder holds.
   */
  sample(r, count = 300) {
    const rules = this.live(), handRules = Array.from({ length: this.n }, (_, p) => rules.filter(x => x.p === p)), tableRules = rules.filter(x => x.p == null);
    const players = [...Array(this.n).keys()].filter(p => !this.out[p]);
    const out = [];
    for (let k = 0; k < count; k++) {
      let hands;
      for (let tries = 0; tries < 25; tries++) {
        hands = players.map(p => this.sampleHand(r, p, handRules[p]));
        const counter = f => hands.reduce((n, h) => n + h.faces.filter(x => x === f || x === 1).length, 0);
        if (tableRules.every(x => x.test(counter))) break;
      }
      let w = 1;
      for (const b of this.ladder) {
        if (b.p === this.me) continue;
        const h = hands.find(x => x.p === b.p);
        if (h) w *= (1 + 0.3 * this.bidHonesty(b.p)) ** h.faces.filter(x => x === b.f || x === 1).length;
      }
      out.push({ hands, w });
    }
    return out;
  }
  sampleHand(r, p, rules) {
    const entries = [...this.dice[p]], ids = entries.map(([id]) => id), kinds = entries.map(([, d]) => d.kind);
    let faces;
    for (let tries = 0; tries < 60; tries++) {
      faces = entries.map(([, d]) => d.face ?? 1 + Math.floor(r() * 6));
      if (rules.every(x => x.test(faces, ids))) break;
    }
    return { p, ids, kinds, faces };
  }

  /** What's known for sure about a player's dice: [{ id, kind, face | null, how }]. */
  known(p) { return [...this.dice[p]].map(([id, d]) => ({ id, ...d })); }
  /** The constraints that still hold, in words (for the table's notes). */
  notes() { return this.live().map(x => ({ p: x.p, text: x.text })); }
}

function describe(q, a) {
  switch (q.type) {
    case "odd": return a ? "total is odd" : "total is even";
    case "atLeast": return a ? `total at least ${q.n}` : `total under ${q.n}`;
    case "any": return a ? `has a ${q.f}` : `no ${q.f}s`;
    case "count": return `${a} × ${q.f}`;
    default: return "";
  }
}

// ---------- probabilities from samples ----------
const weightOf = samples => samples.reduce((t, x) => t + x.w, 0);
const countOn = (hands, f) => hands.reduce((n, h) => n + h.faces.filter(x => x === f || x === 1).length, 0);
/** The chance a bid of q × f holds, by this seat's samples. */
export function chanceBid(samples, q, f) {
  const total = weightOf(samples);
  return samples.reduce((t, x) => t + (countOn(x.hands, f) >= q ? x.w : 0), 0) / total;
}
/** The chance a player has a role on a gold die, by this seat's samples, before any claim. */
function chanceHolds(samples, p, role) {
  const total = weightOf(samples);
  return samples.reduce((t, x) => {
    const h = x.hands.find(y => y.p === p);
    return t + (h && h.faces.some((f, k) => f === role && h.kinds[k] === "gold") ? x.w : 0);
  }, 0) / total;
}

// ---------- decisions ----------
/** A computer player: a personality, a mind and its own random stream. */
export class Player {
  constructor(seat, n, personaId, seed) {
    this.seat = seat;
    this.persona = PERSONAS[personaId];
    this.mind = new Mind(seat, n);
    this.publicMind = new Mind(null, n);     // what everyone can know, to judge how believable its own claims are
    this.r = rng(seed);
  }
  noisy(x) { return x + (this.r() - 0.5) * 2 * this.persona.noise; }
  sync(game, see) {
    this.mind.follow(game, e => see(e, this.seat));
    this.publicMind.follow(game, e => ({ ...e, priv: undefined }));
  }

  /** Chooses this turn's action. */
  action(game) {
    const P = this.persona, me = game.players[this.seat], m = this.mind;
    const myPlain = me.dice.filter(d => d.kind === "plain").length;
    const myGold = me.dice.filter(d => d.kind === "gold").map(d => d.face);
    const others = game.players.filter(p => !p.out && p.i !== this.seat);
    const samples = m.sample(this.r, 200);
    const ladder = !!game.bid, doubt = game.bid ? chanceBid(samples, game.bid.q, game.bid.f) : 0.5;
    const unsure = ladder && doubt > 0.25 && doubt < 0.75;
    const options = [];
    const push = (u, a) => options.push({ u: this.noisy(u), a });

    push(0, { type: "pass" });
    if (myPlain < RULES.cap) push(1 + P.takeBias - 0.15, { type: "take" });

    // reroll: worth it once the table knows a lot about this hand, or the gold dice give nothing
    const exposed = this.publicMind.known(this.seat).filter(d => d.face != null);
    const asked = m.exposure[this.seat];
    const weakGold = myGold.every(f => f === 1) || exposed.some(d => d.kind === "gold");
    const rerollIds = [...exposed.map(d => d.id), ...me.dice.filter(d => d.kind === "gold" && (d.face === 1 || exposed.some(x => x.id === d.id))).map(d => d.id)];
    push(0.28 * (exposed.length + asked) + (weakGold ? 0.6 : 0) + P.rerollBias, { type: "reroll", dice: [...new Set(rerollIds.length ? rerollIds : me.dice.map(d => d.id))] });

    // ask: most useful while a bid is in doubt; about the player whose dice it knows least
    const target = [...others].sort((a, b) => unknownCount(m, b.i) - unknownCount(m, a.i))[0];
    if (target) {
      const f = game.bid?.f || bestFace(me);
      const leak = me.dice.filter(d => d.face === f || d.face === 1).length * 0.08;
      push(0.35 + (unsure ? 0.45 : 0) + P.askBias - leak, { type: "ask", target: target.i, question: { type: "count", f } });
    }

    // hit: decisive when someone is down to one gold die
    if (myPlain >= RULES.hit) {
      const weakest = [...others].sort((a, b) => goldCount(a) - goldCount(b) || plainCount(b) - plainCount(a))[0];
      push((goldCount(weakest) === 1 ? 2.6 : 1.4) + P.hitBias, { type: "hit", target: weakest.i });
      if (myPlain >= RULES.cap) return { type: "hit", target: weakest.i };     // a full hand has to hit
    }

    // claims: true ones are safe (a challenge pays), bluffs risk paying 2 if challenged
    for (const role of [2, 3, 4, 5, 6]) {
      const power = POWERS[role], has = myGold.includes(role);
      const victim = power.target ? pickVictim(role, others, m, game) : null;
      if (power.target && !victim) continue;
      let value = { 2: Math.min(3, RULES.cap - myPlain) || 0.2, 3: Math.min(2, plainCount(victim || me)) + 0.5, 4: 0.5 + (ladder ? 0.4 : 0), 5: 0.7 + (victim && game.bid?.by === victim.i ? 0.4 : 0), 6: 0.6 + (unsure ? 0.7 : 0) }[role];
      const challenger = power.target ? victim.i : nextSeat(game, this.seat);
      const believable = chanceHolds(this.publicMind.sample(this.r, 80), this.seat, role);
      const pc = Math.min(0.95, m.challengeRate(challenger) * (1.3 - believable));
      const fatal = myPlain < RULES.stake && myGold.length === 1;
      const u = has ? value + pc * 1.5 : (1 - pc) * value - pc * (fatal ? 8 : 2) + P.bluffBias;
      push(u, { type: "claim", role, target: victim?.i, picks: this.picks(role, victim, game, samples) });
    }
    options.sort((a, b) => b.u - a.u);
    return options[0].a;
  }

  /** The claimant's picks for a power: which die to steal, look at or reroll, which face to ask about, which gold die to spend. */
  picks(role, victim, game, samples) {
    const me = game.players[this.seat], m = this.mind;
    const picks = {};
    if (victim) {
      const theirs = m.known(victim.i);
      if (role === 3) picks.die = (theirs.find(d => d.kind === "plain" && d.face == null) || theirs.find(d => d.kind === "plain"))?.id;
      if (role === 4) picks.die = (theirs.find(d => d.kind === "gold" && d.face == null) || theirs.find(d => d.face == null) || theirs[0])?.id;
      if (role === 5) {
        const f = game.bid?.f;
        picks.die = (theirs.find(d => d.kind === "gold" && d.face != null && d.face !== 1) || theirs.find(d => f && (d.face === f || d.face === 1)) || theirs.find(d => d.kind === "gold") || theirs[0])?.id;
      }
    }
    if (role === 6) picks.face = game.bid?.f || bestFace(me);
    // spend the gold die it would miss least: a Wild, one the table has seen, or else the one it just claimed with
    const gold = me.dice.filter(d => d.kind === "gold");
    const seen = this.publicMind.known(this.seat).filter(d => d.face != null).map(d => d.id);
    picks.spend = (gold.find(d => d.face === 1) || gold.find(d => seen.includes(d.id)) || gold.find(d => d.face === role) || gold[0])?.id;
    return picks;
  }

  /** Whether to challenge a claim it's entitled to challenge. */
  challenge(game) {
    const c = game.pending, P = this.persona, m = this.mind, me = game.players[this.seat];
    const prior = chanceHolds(m.sample(this.r, 250), c.claimant, c.role);
    // claims are made more often by those who have the role; and players bluff less at someone known to challenge
    const bluff = m.bluffRate(c.claimant) * (1.25 - m.challengeRate(this.seat));
    const holds = prior / (prior + (1 - prior) * bluff);
    const harm = { 2: 0.5, 3: 1.5, 4: 0.4, 5: 0.7, 6: 0.5 }[c.role];
    const myPlain = me.dice.filter(d => d.kind === "plain").length, myGold = me.dice.filter(d => d.kind === "gold").length;
    const ruin = myPlain < RULES.stake && myGold === 1 ? 3 : 0;   // a wrong challenge would knock it out
    const gain = (2 + harm) * (1 - holds) - (2 + ruin) * holds;
    return this.noisy(gain) > P.challengeBias;
  }

  /** Raises or calls: { q, f } or { call: true }. */
  bid(game) {
    const P = this.persona, samples = this.mind.sample(this.r, 400), b = game.bid;
    const options = [], dice = game.players.reduce((n, p) => n + p.dice.length, 0);
    for (let f = 2; f <= 6; f++) {
      const q0 = !b ? 1 : f > b.f ? b.q : b.q + 1;
      for (let q = q0; q <= (b ? q0 + 3 : dice); q++) options.push({ q, f, p: chanceBid(samples, q, f) });
    }
    if (!b) {
      // opening: the biggest bid it believes in, on a face it holds
      const good = options.filter(o => o.p >= P.open).sort((x, y) => y.q - x.q || y.p - x.p);
      const pick = good[0] || options.sort((x, y) => y.p - x.p)[0];
      return { q: pick.q, f: pick.f };
    }
    const standing = this.noisy(chanceBid(samples, b.q, b.f));
    const minimal = options.filter(o => o.q === (o.f > b.f ? b.q : b.q + 1));
    const safe = minimal.filter(o => o.p >= P.raiseMin).sort((x, y) => y.p - x.p);
    let raise = safe[0] || [...minimal].sort((x, y) => y.p - x.p)[0];
    // now and then a bluff: a raise it doesn't believe in, to push the next player into a bad call
    if (this.r() < P.bidBluff) {
      const pushy = minimal.filter(o => o.p >= 0.25 && o.p < P.raiseMin);
      if (pushy.length) raise = pushy[Math.floor(this.r() * pushy.length)];
    }
    if (1 - standing > this.noisy(raise.p) + P.callBias) return { call: true };
    return { q: raise.q, f: raise.f };
  }
}

// ---------- small helpers ----------
const goldCount = p => p.dice.filter(d => d.kind === "gold").length;
const plainCount = p => p.dice.filter(d => d.kind === "plain").length;
const unknownCount = (m, p) => m.known(p).filter(d => d.face == null).length;
const nextSeat = (game, i) => { let j = i; do { j = (j + 1) % game.players.length; } while (game.players[j].out); return j; };
function bestFace(p) {
  let best = 2, n = -1;
  for (let f = 2; f <= 6; f++) { const c = p.dice.filter(d => d.face === f || d.face === 1).length; if (c > n) { n = c; best = f; } }
  return best;
}
function pickVictim(role, others, m, game) {
  if (!others.length) return null;
  if (role === 3) return [...others].sort((a, b) => plainCount(b) - plainCount(a))[0];          // the richest
  if (role === 5) return others.find(o => o.i === game.bid?.by) || [...others].sort((a, b) => goldCount(a) - goldCount(b))[0];
  return [...others].sort((a, b) => unknownCount(m, b.i) - unknownCount(m, a.i))[0];           // the least known
}
