// Cartel's computer players.
//
// A Mind follows the game's events exactly as one seat sees them and keeps everything that seat could know:
// which dice everyone has, every face it has seen (public, peeked at or its own), every answer it got, every
// proof and caught bluff, every call verdict and inquiry count, for as long as each stays true (a constraint on
// a hand lapses the moment that hand changes). It also keeps score of habits: how often each player has been
// caught bluffing and how often they challenge when they could. From all that it samples tables consistent with
// what it knows, weighting them by what bids suggest, and turns the samples into probabilities: that a bid
// holds, that a player really has the role they claim.
//
// A personality turns those probabilities into choices: how readily it calls, challenges and bluffs, how much
// it trusts its own reads, how much noise it adds. The Quant plays the probabilities straight.
import { ABILITIES, RULES, rng, answer } from "./cartel-engine.js";

export const PERSONAS = {
  quant: { name: "Quant", trait: "super rational", noise: 0.02, bidBluff: 0.05, bluffBias: -1, callBias: -0.04, challengeBias: 0.6,
    takeBias: 0.45, rerollBias: 0.35, askBias: 0.15, hitBias: -0.15, open: 0.75, raiseMin: 0.62 },
  wildcat: { name: "Wildcat", trait: "somewhat random", noise: 0.35, bidBluff: 0.3, bluffBias: 0.3, callBias: 0, challengeBias: 0,
    takeBias: 0, rerollBias: 0, askBias: 0, hitBias: 0, open: 0.5, raiseMin: 0.4 },
  gambler: { name: "Gambler", trait: "risk taker", noise: 0.08, bidBluff: 0.38, bluffBias: 0.7, callBias: 0.12, challengeBias: 0.45,
    takeBias: -0.2, rerollBias: -0.2, askBias: -0.2, hitBias: 0.6, open: 0.42, raiseMin: 0.34 },
  hedger: { name: "Hedger", trait: "conservative", noise: 0.04, bidBluff: 0.04, bluffBias: -1.2, callBias: -0.05, challengeBias: 0.7,
    takeBias: 0.45, rerollBias: 0.35, askBias: 0.1, hitBias: -0.2, open: 0.76, raiseMin: 0.63 },
  sceptic: { name: "Sceptic", trait: "suspicious", noise: 0.06, bidBluff: 0.1, bluffBias: -0.4, callBias: -0.1, challengeBias: -0.2,
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

  /**
   * The share of a player's claims that are bluffs, from their own challenged claims, leaning on the whole table's
   * record until they have one of their own (tables differ: under stiff stakes everyone bluffs less).
   */
  bluffRate(p) {
    const caught = this.caught.reduce((a, b) => a + b, 0), honest = this.honest.reduce((a, b) => a + b, 0);
    const table = (caught + 1.2) / (caught + honest + 4);
    return (this.caught[p] + 3 * table) / (this.caught[p] + this.honest[p] + 3);
  }

  /**
   * How likely a player's claim of a role is true. prior is the chance they hold it from what's known of their gold
   * dice alone; a claim is evidence on top: if a share q of claims are bluffs, while by dice alone only h0 of players
   * would hold the role, claiming multiplies the odds by (1 − q)/q × (1 − h0)/h0. So a claim from a player whose
   * dice are unknown is as trustworthy as claims usually are, and one from a player whose gold dice were seen to
   * be other faces is still suspect.
   */
  holds(prior, p, challenger) {
    const g = [...this.dice[p].values()].filter(d => d.kind === "gold").length || 1;
    const h0 = 1 - (5 / 6) ** g;
    const q = Math.min(0.9, Math.max(0.03, this.bluffRate(p) * (1.25 - this.challengeRate(challenger))));
    const odds = (Math.min(0.999, Math.max(0.001, prior)) / (1 - Math.min(0.999, Math.max(0.001, prior)))) * ((1 - q) / q) * ((1 - h0) / h0);
    return odds / (1 + odds);
  }
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
      case "take": case "banker": case "receive":
        if (e.dice?.length) this.add(e.p, e.dice.map(d => ({ ...d, kind: "plain" })), "public");
        break;
      case "trader":
        if (e.none) break;
        this.drop(e.target, [].concat(e.lost));
        this.add(e.p, e.dice.map(d => ({ ...d, kind: "plain" })), "public");
        break;
      case "reroll": case "legal": {
        const ids = e.dice || [e.die];
        this.forget(e.p, ids);
        this.changed(e.p);
        if (e.p === me) this.mine(e.faces);
        break;
      }
      case "audit":
        if (e.p === me && e.faces) for (const [id, face] of Object.entries(e.faces)) { const d = this.dice[e.target].get(Number(id)); if (d && d.how !== "public") { d.face = face; d.how = "peek"; } }
        break;
      case "block":
        this.chances[e.claimant]++;                // the thief may challenge the block
        break;
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
          this.rules.push({ p, ver: this.ver[p], test: (faces, ids) => !ids.some((id, k) => goldIds.includes(id) && faces[k] === role), text: `no gold ${role}` });
        }
        break;
      case "inquiry":
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
    const weakGold = myGold.every(f => f === 1) || exposed.some(d => d.kind === "gold");
    const rerollIds = [...exposed.map(d => d.id), ...me.dice.filter(d => d.kind === "gold" && (d.face === 1 || exposed.some(x => x.id === d.id))).map(d => d.id)];
    push(0.28 * (exposed.length + m.exposure[this.seat]) + (weakGold ? 0.6 : 0) + P.rerollBias, { type: "reroll", dice: [...new Set(rerollIds.length ? rerollIds : me.dice.map(d => d.id))] });

    // ask (when it's an action rather than a free move): most useful while a bid is in doubt; about the player whose
    // dice it knows least
    const target = [...others].sort((x, y) => unknownCount(m, y.i) - unknownCount(m, x.i))[0];
    if (target && !RULES.freeAsk) {
      const f = game.bid?.f || bestFace(me);
      const leak = me.dice.filter(d => d.face === f || d.face === 1).length * 0.08;
      push(0.35 + (unsure ? 0.45 : 0) + P.askBias - leak, { type: "ask", target: target.i, question: { type: "count", f } });
    }

    // hit: a gold die for 7 dice, certain; worth it mostly to finish someone off
    if (myPlain >= RULES.hit) {
      const weakest = [...others].sort((x, y) => goldCount(x) - goldCount(y) || plainCount(y) - plainCount(x))[0];
      push(goldValue(weakest) - RULES.hit + 1 + P.hitBias, { type: "hit", target: weakest.i });
      if (myPlain >= RULES.cap) return { type: "hit", target: weakest.i };     // a full hand has to hit
    }

    // claims: true ones are safe (a challenge pays), bluffs risk paying 2 if challenged; a steal or a sanction may
    // be blocked. Dice are worth about 1 each, a gold die about 5 (all of them, if it's someone's last).
    for (const [ability, x] of Object.entries(ABILITIES)) {
      if (x.free || (x.cost && myPlain < x.cost)) continue;
      const has = myGold.includes(x.role);
      const victim = x.target ? pickVictim(ability, others, m) : null;
      if (x.target && !victim) continue;
      // whoever answers the claim (its target, or the next player) may block it, if it can be blocked
      const answerer = x.target ? victim.i : nextSeat(game, this.seat);
      const blocked = x.blockers ? chanceHoldsAny(samples, answerer, x.blockers) * 0.9 + 0.1 : 0;
      let value;
      if (ability === "bank") value = (Math.min(RULES.banker, RULES.cap - myPlain) || 0.2) * (1 - 0.75 * blocked);
      if (ability === "steal") value = (Math.min(RULES.steal, plainCount(victim)) + 0.4) * (1 - 0.75 * blocked);
      if (ability === "audit") value = 0.6 + 0.07 * unknownCount(m, victim.i) + (unsure ? 0.5 : 0);
      // an inquiry on the standing bid's face settles this turn's bid: call it if it's false (+3 dice), or raise to
      // the true count and leave the next player stuck. Worth most when the bid is a coin flip; a sure bid gains little.
      if (ability === "inquiry") value = ladder ? 0.4 + 2 * RULES.callStake * Math.min(doubt, 1 - doubt) : 0.3;
      if (ability === "inquiry" && !has) continue;                    // the referee answers only a real Regulator
      if (ability === "sanction") value = goldValue(victim) * (1 - blocked) - x.cost + P.hitBias;
      const challenger = x.target ? victim.i : nextSeat(game, this.seat);
      const believable = chanceHolds(this.publicMind.sample(this.r, 80), this.seat, x.role);
      // a target about to lose a gold die challenges far more readily than one about to lose a peek
      const stakes = ability === "sanction" ? 1.8 : 1;
      const pc = Math.min(0.95, m.challengeRate(challenger) * (1.3 - believable) * stakes);
      const u = has ? value + pc * wrongCost(game.players[challenger]) * 0.75 : (1 - pc) * value - pc * caughtCost(afterPaying(me, x.cost || 0)) + P.bluffBias;
      push(u, { type: "claim", ability, target: victim?.i, picks: this.picks(ability, victim, game) });
    }
    options.sort((x, y) => y.u - x.u);
    return options[0].a;
  }

  /** The claimant's picks for an ability: which die to steal, which face to inquire about. */
  picks(ability, victim, game) {
    const me = game.players[this.seat], picks = {};
    if (ability === "steal" && victim) picks.die = (this.mind.known(victim.i).find(d => d.kind === "plain" && d.face == null) || this.mind.known(victim.i).find(d => d.kind === "plain"))?.id;
    if (ability === "inquiry") picks.face = game.bid?.f || bestFace(me);
    return picks;
  }

  /**
   * The free move: whether to claim Legal's reroll this turn, and on which die. Worth it to hide a die the table
   * has seen (one that landed face up, or a gold die someone proved), more so when it matters to the bid.
   * Returns a die id, or null.
   */
  free(game) {
    const P = this.persona, me = game.players[this.seat], m = this.mind;
    const seen = this.publicMind.known(this.seat).filter(d => d.face != null);
    if (!seen.length) return null;
    const f = game.bid?.f;
    const worst = [...seen].sort((x, y) => worth(y, f) - worth(x, f))[0];
    const has = me.dice.some(d => d.kind === "gold" && d.face === 5);
    const challenger = nextSeat(game, this.seat);
    const believable = chanceHolds(this.publicMind.sample(this.r, 80), this.seat, 5);
    const pc = Math.min(0.95, m.challengeRate(challenger) * (1.3 - believable));
    const value = 0.35 + 0.25 * seen.length + worth(worst, f);
    const u = has ? value : (1 - pc) * value - pc * caughtCost(me) + P.bluffBias;
    return this.noisy(u) > 0.55 ? worst.id : null;
  }

  /**
   * Its answer to a claim it's entitled to answer: "challenge", "allow", or (to a steal or sanction aimed at it)
   * a block, { block: role }: honest if it holds a blocking role, a bluff when the claimant seldom challenges.
   */
  challenge(game) {
    const c = game.pending, P = this.persona, m = this.mind, me = game.players[this.seat], x = ABILITIES[c.ability];
    const myGold = me.dice.filter(d => d.kind === "gold");
    const aimedAtMe = c.target === this.seat;
    const canBlock = x.blockers?.length && (aimedAtMe || !x.target);
    if (canBlock) {
      const honest = myGold.find(d => x.blockers.includes(d.face));
      if (honest) return { block: honest.face };
    }
    const holds = m.holds(chanceHolds(m.sample(this.r, 250), c.claimant, c.role), c.claimant, this.seat);
    const harm = lossFrom(c.ability, me, aimedAtMe);
    const gain = (caughtCost(game.players[c.claimant]) + harm) * (1 - holds) - wrongCost(me) * holds;
    if (this.noisy(gain) > P.challengeBias) return "challenge";
    // aimed at it and no honest block: bluff one if the claimant is unlikely to call it
    if (canBlock) {
      const pc = Math.min(0.95, m.challengeRate(c.claimant) * 1.1);
      const u = (1 - pc) * harm - pc * (caughtCost(me) + (c.ability === "sanction" ? harm : 0)) + P.bluffBias;
      if (this.noisy(u) > 0.2) return { block: x.blockers[Math.floor(this.r() * x.blockers.length)] };
    }
    return "allow";
  }

  /** As the player blocked: whether to challenge the block. */
  challengeBlock(game) {
    const b = game.pending, P = this.persona, m = this.mind, me = game.players[this.seat];
    const holds = m.holds(chanceHolds(m.sample(this.r, 250), b.claimant, b.role), b.claimant, this.seat);
    const blocker = game.players[b.claimant];
    const worth = b.base.ability === "sanction" ? goldValue(blocker) : Math.min(RULES.steal, plainCount(blocker));
    const gain = (caughtCost(blocker) + worth) * (1 - holds) - wrongCost(me) * holds;
    return this.noisy(gain) > P.challengeBias;
  }

  /**
   * The free question (when asking is a free move): whether to ask, whom and what. It asks how many of the face
   * that matters (the standing bid's, or its own best) a player has, choosing the player whose count it's least
   * sure of, unless its own answer would give away too much. Returns { target, question } or null.
   */
  ask(game) {
    const P = this.persona, me = game.players[this.seat], m = this.mind;
    const others = game.players.filter(p => !p.out && p.i !== this.seat);
    if (!others.length) return null;
    const f = game.bid?.f || bestFace(me);
    const samples = m.sample(this.r, 150);
    const spread = p => {
      const counts = samples.map(x => (x.hands.find(h => h.p === p.i)?.faces || []).filter(v => v === f).length);
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      return counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
    };
    const target = [...others].sort((a, b) => spread(b) - spread(a))[0];
    const leak = me.dice.filter(d => d.face === f).length * 0.12;
    const u = spread(target) * 0.6 - leak + P.askBias + (game.bid ? 0.2 : 0);
    if (this.noisy(u) < 0.25) return null;
    return { target: target.i, question: { type: leak > 0.3 ? "any" : "count", f } };
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
/** What taking one of a player's gold dice is worth, in dice: about 6, and 10 if it's their last (they're out). */
const goldValue = p => (goldCount(p) === 1 ? 10 : 6);
/** A player as they'd be after paying n plain dice (for a claim's cost), to price what they'd risk next. */
const afterPaying = (p, n) => (n ? { ...p, dice: [...p.dice.filter(d => d.kind === "gold"), ...p.dice.filter(d => d.kind === "plain").slice(n)] } : p);
/** What paying n plain dice costs a player, in dice: n, or, short of n, what they have plus a gold die. */
const payCost = (p, n) => (plainCount(p) >= n ? n : plainCount(p) + goldValue(p));
/** What catching someone's bluff takes from them, in dice. */
const caughtCost = p => (RULES.goldStakes ? goldValue(p) : payCost(p, RULES.bluffStake));
/** What a wrong challenge costs the challenger, in dice. */
const wrongCost = p => (RULES.goldStakes ? goldValue(p) : payCost(p, RULES.challengeStake));
/** What letting a claim through costs this player, in dice: a gold die is worth about 5, all of it if it's the last. */
function lossFrom(ability, me, aimedAtMe) {
  const plainLeft = me.dice.filter(d => d.kind === "plain").length, goldLeft = me.dice.filter(d => d.kind === "gold").length;
  switch (ability) {
    case "steal": return aimedAtMe ? Math.min(2, plainLeft) + 0.3 : 0.3;
    case "sanction": return aimedAtMe ? (goldLeft === 1 ? 20 : 6) : 0.5;
    case "bank": return 0.5;
    case "audit": return aimedAtMe ? 0.6 : 0.2;
    case "inquiry": return 0.5;
    case "legal": return 0.3;
    default: return 0.4;
  }
}
/** How much hiding a seen die is worth: more if it's gold (a role) or counts towards the standing bid's face. */
const worth = (d, f) => (d.kind === "gold" ? 0.5 : 0.2) + (f && (d.face === f || d.face === 1) ? 0.3 : 0);
/** The chance a player holds any of these roles on a gold die. */
function chanceHoldsAny(samples, p, roles) {
  const total = samples.reduce((t, x) => t + x.w, 0);
  return samples.reduce((t, x) => {
    const h = x.hands.find(y => y.p === p);
    return t + (h && h.faces.some((f, k) => roles.includes(f) && h.kinds[k] === "gold") ? x.w : 0);
  }, 0) / total;
}
const goldCount = p => p.dice.filter(d => d.kind === "gold").length;
const plainCount = p => p.dice.filter(d => d.kind === "plain").length;
const unknownCount = (m, p) => m.known(p).filter(d => d.face == null).length;
const nextSeat = (game, i) => { let j = i; do { j = (j + 1) % game.players.length; } while (game.players[j].out); return j; };
function bestFace(p) {
  let best = 2, n = -1;
  for (let f = 2; f <= 6; f++) { const c = p.dice.filter(d => d.face === f || d.face === 1).length; if (c > n) { n = c; best = f; } }
  return best;
}
function pickVictim(ability, others, m) {
  if (!others.length) return null;
  if (ability === "steal") return [...others].sort((a, b) => plainCount(b) - plainCount(a))[0];   // the richest
  if (ability === "sanction") return [...others].sort((a, b) => goldCount(a) - goldCount(b) || plainCount(b) - plainCount(a))[0];   // the weakest
  return [...others].sort((a, b) => unknownCount(m, b.i) - unknownCount(m, a.i))[0];             // the least known
}
