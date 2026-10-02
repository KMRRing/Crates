// Cartel's referee: Coup and Liar's Dice built from dice.
//
// Everyone has gold dice (their lives and their roles) and plain dice (money and weight in the bidding), all
// rolled secretly. A face is both a number and a role: 1 Wild, 2 Trader, 3 Broker, 4 Scout, 5 Enforcer,
// 6 Insider. Only gold dice give powers; every die counts in bids, with Wilds counting as any face.
//
// A turn is one action, then a bid. Actions: take a die from the bank (it lands face up, for everyone to see),
// reroll any of your dice (secretly), ask a player a question (answered both ways), hit (pay dice so a player
// loses a gold die), or claim a role that one of your gold dice shows (true or not). The bid raises the standing
// "at least N dice show face F" or calls it. Penalties are paid in plain dice to the winner; if you can't pay, you
// lose a gold die; with no gold dice left you're out. A player with a full hand of plain dice (8) has to hit.
// The last player in wins.
//
// The engine holds the truth and records events. Each event says what everyone sees and what only some see, so
// the table, the log and the AIs each learn exactly what a player at a real table would.

export const ROLES = { 1: "Wild", 2: "Trader", 3: "Broker", 4: "Scout", 5: "Enforcer", 6: "Insider" };
export const POWERS = {
  2: { name: "Trader", target: false, says: "takes 3 dice from the bank" },
  3: { name: "Broker", target: true, says: "steals 2 dice from" },
  4: { name: "Scout", target: true, says: "looks at a die of" },
  5: { name: "Enforcer", target: true, says: "makes a die reroll for" },
  6: { name: "Insider", target: false, says: "learns how many dice show a face" },
};
export const RULES = { gold: 2, plain: 3, cap: 8, hit: 6, stake: 2, callStake: 1 };
// Questions about one player's whole hand (gold and plain), answered both ways. A "face" here means the face
// itself: Wilds count only when the question is about 1s.
export const QUESTIONS = {
  odd: { label: "Is the total odd?", param: null },
  atLeast: { label: "Is the total at least …?", param: "total" },
  any: { label: "Any …?", param: "face" },
  count: { label: "How many …?", param: "face" },
};

// ---------- random numbers (deterministic per game) ----------
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = () => a;
  return next;
}
const roll = r => 1 + Math.floor(r() * 6);

// ---------- setup ----------
/** A new game: seats are [{ name, persona }] (persona null = a human). */
export function newGame(seed, seats) {
  const r = rng(seed);
  const s = { seed, r, players: [], turn: 0, step: "act", bid: null, pending: null, events: [], nextDie: 0, over: null, moves: 0 };
  seats.forEach((seat, i) => {
    const dice = [];
    for (let k = 0; k < RULES.gold; k++) dice.push(die(s, "gold"));
    for (let k = 0; k < RULES.plain; k++) dice.push(die(s, "plain"));
    s.players.push({ i, name: seat.name, persona: seat.persona || null, out: false, dice });
  });
  s.turn = Math.floor(r() * seats.length);
  emit(s, { t: "start", turn: s.turn, dice: s.players.map(p => p.dice.map(d => ({ id: d.id, kind: d.kind }))) },
    Object.fromEntries(s.players.map(p => [p.i, { faces: facesOf(p) }])));
  return s;
}
function die(s, kind, open = false) { return { id: s.nextDie++, kind, face: roll(s.r), open }; }
export const facesOf = p => Object.fromEntries(p.dice.map(d => [d.id, d.face]));

// ---------- events ----------
/** Records an event: pub is what everyone sees; priv[playerIndex] is what only that player sees. */
function emit(s, pub, priv = {}) { s.events.push({ n: s.events.length, ...pub, priv }); }
/** An event as one player sees it (their private part merged in). */
export const seen = (e, i) => ({ ...e, ...(e.priv?.[i] || {}), priv: undefined });

// ---------- queries ----------
export const alive = s => s.players.filter(p => !p.out);
export const gold = p => p.dice.filter(d => d.kind === "gold");
export const plain = p => p.dice.filter(d => d.kind === "plain");
export const tableCount = (s, f) => s.players.flatMap(p => p.dice).filter(d => d.face === f || d.face === 1).length;
export const totalDice = s => s.players.reduce((n, p) => n + p.dice.length, 0);
const nextAlive = (s, i) => { let j = i; do { j = (j + 1) % s.players.length; } while (s.players[j].out); return j; };

/** Whether a bid of q × f beats the standing bid (higher quantity, or the same quantity of a higher face). */
export function beats(bid, q, f) {
  if (f < 2 || f > 6 || q < 1) return false;
  if (!bid) return true;
  return q > bid.q || (q === bid.q && f > bid.f);
}

/** The answer to a question about a hand of faces. */
export function answer(question, faces) {
  const sum = faces.reduce((a, b) => a + b, 0);
  switch (question.type) {
    case "odd": return sum % 2 === 1;
    case "atLeast": return sum >= question.n;
    case "any": return faces.includes(question.f);
    case "count": return faces.filter(x => x === question.f).length;
    default: return null;
  }
}

// ---------- the turn: an action ----------
/**
 * The actions open to the player whose turn it is. Each is { type, ... } as act() takes it; a claim lists the
 * role it claims, and the target when the role has one.
 */
export function actions(s) {
  const me = s.players[s.turn], others = alive(s).filter(p => p !== me);
  if (mustHit(s)) return others.map(p => ({ type: "hit", target: p.i }));
  const out = [{ type: "pass" }];
  if (plain(me).length < RULES.cap) out.push({ type: "take" });
  out.push({ type: "reroll" });
  for (const p of others) out.push({ type: "ask", target: p.i });
  if (plain(me).length >= RULES.hit) for (const p of others) out.push({ type: "hit", target: p.i });
  for (const [f, power] of Object.entries(POWERS)) {
    if (power.target) for (const p of others) out.push({ type: "claim", role: Number(f), target: p.i });
    else out.push({ type: "claim", role: Number(f) });
  }
  return out;
}

/**
 * Takes the current player's action. Claims don't resolve at once: they wait for the player entitled to
 * challenge (the target, or the next player for powers without one), via s.pending. Returns s.
 */
/** A player whose plain dice are at the cap has to hit (as Coup forces a coup): it keeps games from stalling. */
export const mustHit = s => plain(s.players[s.turn]).length >= RULES.cap;

export function act(s, a) {
  if (s.over || s.step !== "act" || s.pending) throw new Error("not time to act");
  const me = s.players[s.turn];
  if (mustHit(s) && a.type !== "hit") throw new Error("with a full hand you have to hit");
  switch (a.type) {
    case "pass":
      emit(s, { t: "pass", p: me.i });
      break;
    case "take": {
      if (plain(me).length >= RULES.cap) throw new Error("at the cap");
      const d = die(s, "plain", true);
      me.dice.push(d);
      emit(s, { t: "take", p: me.i, dice: [{ id: d.id, face: d.face }] });
      break;
    }
    case "reroll": {
      const ids = (a.dice || []).filter(id => me.dice.some(d => d.id === id));
      if (!ids.length) throw new Error("choose dice to reroll");
      for (const d of me.dice) if (ids.includes(d.id)) { d.face = roll(s.r); d.open = false; }
      emit(s, { t: "reroll", p: me.i, dice: ids }, { [me.i]: { faces: facesOf(me) } });
      break;
    }
    case "ask": {
      const them = s.players[a.target];
      const q = cleanQuestion(a.question);
      const aboutThem = answer(q, them.dice.map(d => d.face)), aboutMe = answer(q, me.dice.map(d => d.face));
      emit(s, { t: "ask", p: me.i, target: them.i, question: q },
        { [me.i]: { answer: aboutThem }, [them.i]: { answer: aboutMe } });
      break;
    }
    case "hit": {
      if (plain(me).length < RULES.hit) throw new Error("not enough dice");
      payToBank(s, me, RULES.hit);
      emit(s, { t: "hit", p: me.i, target: a.target });
      loseGold(s, s.players[a.target], "hit");
      break;
    }
    case "claim": {
      const power = POWERS[a.role];
      if (!power) throw new Error("no such role");
      if (power.target && (a.target == null || s.players[a.target].out || a.target === me.i)) throw new Error("choose a player");
      const challenger = power.target ? a.target : nextAlive(s, me.i);
      s.pending = { type: "challenge", claimant: me.i, role: a.role, target: a.target ?? null, challenger, picks: a.picks || {} };
      emit(s, { t: "claim", p: me.i, role: a.role, target: a.target ?? null, challenger });
      return s;
    }
    default: throw new Error("unknown action");
  }
  return afterAction(s);
}

function cleanQuestion(q) {
  if (!q || !QUESTIONS[q.type]) throw new Error("no such question");
  if (q.type === "atLeast") return { type: "atLeast", n: Math.max(1, Math.round(q.n)) };
  if (q.type === "any" || q.type === "count") return { type: q.type, f: Math.min(6, Math.max(1, q.f)) };
  return { type: "odd" };
}

/**
 * The entitled player's answer to a pending claim: challenge or not. A true claim costs a wrong challenger
 * 2 dice, paid to the claimant, and shows the gold die that proves it; a caught bluff costs the claimant 2 dice
 * paid to the challenger, and the power doesn't happen.
 */
export function respond(s, challenge) {
  const c = s.pending;
  if (!c || c.type !== "challenge") throw new Error("nothing to answer");
  s.pending = null;
  const claimant = s.players[c.claimant], challenger = s.players[c.challenger];
  if (challenge) {
    const proof = gold(claimant).find(d => d.face === c.role);
    if (proof) {
      emit(s, { t: "challenge", p: challenger.i, claimant: claimant.i, held: true, die: { id: proof.id, face: proof.face } });
      pay(s, challenger, claimant, RULES.stake);
      if (s.over || claimant.out) return afterAction(s);
    } else {
      emit(s, { t: "challenge", p: challenger.i, claimant: claimant.i, held: false, role: c.role });
      pay(s, claimant, challenger, RULES.stake);
      return afterAction(s);
    }
  } else emit(s, { t: "allow", p: challenger.i, claimant: claimant.i });
  if (!claimant.out && (c.target == null || !s.players[c.target].out)) power(s, claimant, c, c.picks);
  if (!claimant.out) spend(s, claimant, c.picks.spend);
  return afterAction(s);
}

/** A power takes effect. choice holds the claimant's picks (which die to steal, look at or reroll; which face). */
function power(s, me, c, choice = {}) {
  const them = c.target != null ? s.players[c.target] : null;
  switch (c.role) {
    case 2: {                                   // Trader: three dice from the bank, face up
      const got = [];
      for (let k = 0; k < 3 && plain(me).length < RULES.cap; k++) { const d = die(s, "plain", true); me.dice.push(d); got.push({ id: d.id, face: d.face }); }
      emit(s, { t: "trader", p: me.i, dice: got });
      break;
    }
    case 3: {                                   // Broker: two of their plain dice come to you, rerolled face up
      const lost = [], got = [];
      for (let k = 0; k < 2; k++) {
        const pool = plain(them);
        if (!pool.length || plain(me).length >= RULES.cap) break;
        const taken = (k === 0 && pool.find(d => d.id === choice.die)) || pool[Math.floor(s.r() * pool.length)];
        them.dice = them.dice.filter(d => d !== taken);
        const d = die(s, "plain", true);
        me.dice.push(d);
        lost.push(taken.id);
        got.push({ id: d.id, face: d.face });
      }
      emit(s, { t: "broker", p: me.i, target: them.i, lost, dice: got, none: !lost.length });
      break;
    }
    case 4: {                                   // Scout: look at one of their dice
      const look = them.dice.find(d => d.id === choice.die) || them.dice[Math.floor(s.r() * them.dice.length)];
      emit(s, { t: "scout", p: me.i, target: them.i, die: look.id }, { [me.i]: { face: look.face } });
      break;
    }
    case 5: {                                   // Enforcer: one of their dice is rerolled; they see the result
      const hit = them.dice.find(d => d.id === choice.die) || them.dice[Math.floor(s.r() * them.dice.length)];
      hit.face = roll(s.r);
      hit.open = false;
      emit(s, { t: "enforcer", p: me.i, target: them.i, die: hit.id }, { [them.i]: { faces: facesOf(them) } });
      break;
    }
    case 6: {                                   // Insider: how many dice on the table show a face (Wilds counted)
      const f = choice.face >= 2 && choice.face <= 6 ? choice.face : (s.bid?.f || 2 + Math.floor(s.r() * 5));
      emit(s, { t: "insider", p: me.i, face: f }, { [me.i]: { count: tableCount(s, f) } });
      break;
    }
  }
}

/** After a power, one of the claimant's gold dice is rerolled (their pick), so no role can be milked turn after turn. */
function spend(s, me, which) {
  const g = gold(me);
  if (!g.length) return;
  const d = g.find(x => x.id === which) || g[Math.floor(s.r() * g.length)];
  d.face = roll(s.r);
  d.open = false;
  emit(s, { t: "spend", p: me.i, die: d.id }, { [me.i]: { faces: facesOf(me) } });
}

function afterAction(s) {
  if (s.over) return s;
  if (s.players[s.turn].out) return nextTurn(s);
  s.step = "bid";
  return s;
}

// ---------- the turn: the bid ----------
/** Raises the standing bid to q × f, or calls it (call: true). Opening a new ladder has to be a raise. */
export function bid(s, move) {
  if (s.over || s.step !== "bid" || s.pending) throw new Error("not time to bid");
  const me = s.players[s.turn];
  if (move.call) {
    if (!s.bid) throw new Error("nothing to call");
    const n = tableCount(s, s.bid.f), held = n >= s.bid.q;
    const bidder = s.players[s.bid.by];
    emit(s, { t: "call", p: me.i, bid: s.bid, held });
    const loser = held ? me : bidder, winner = held ? bidder : me;
    s.bid = null;
    if (!loser.out && !winner.out) pay(s, loser, winner, RULES.callStake);
    else if (!loser.out) payToBank(s, loser, RULES.callStake);
    return nextTurn(s);
  }
  if (!beats(s.bid, move.q, move.f)) throw new Error("a bid has to beat the standing one");
  s.bid = { q: move.q, f: move.f, by: me.i };
  emit(s, { t: "bid", p: me.i, q: move.q, f: move.f });
  return nextTurn(s);
}

function nextTurn(s) {
  if (s.over) return s;
  s.turn = nextAlive(s, s.turn);
  s.step = "act";
  s.moves++;
  return s;
}

// ---------- paying, losing gold, going out ----------
/**
 * Pays n plain dice from one player to another: the payer's dice go to the bank (face-up ones first, as they
 * hide nothing) and the winner takes as many new dice from the bank, face up, up to the cap. A payer who can't
 * cover it loses a gold die instead.
 */
function pay(s, from, to, n) {
  const paid = payToBank(s, from, n);
  const got = [];
  for (let k = 0; k < paid && plain(to).length < RULES.cap && !to.out; k++) { const d = die(s, "plain", true); to.dice.push(d); got.push({ id: d.id, face: d.face }); }
  if (got.length) emit(s, { t: "receive", p: to.i, from: from.i, dice: got });
}
function payToBank(s, p, n) {
  const order = plain(p).sort((a, b) => (b.open ? 1 : 0) - (a.open ? 1 : 0));
  const paid = order.slice(0, n);
  if (paid.length) {
    p.dice = p.dice.filter(d => !paid.includes(d));
    emit(s, { t: "pay", p: p.i, dice: paid.map(d => ({ id: d.id, face: d.face })) });
  }
  if (paid.length < n) loseGold(s, p, "broke");
  return paid.length;
}

/** A player loses a gold die (the one they'd miss least, unless told which); it's shown as it goes. */
function loseGold(s, p, why) {
  const g = gold(p);
  if (!g.length) return;
  const d = [...g].sort((a, b) => goldWorth(a) - goldWorth(b))[0];
  p.dice = p.dice.filter(x => x !== d);
  emit(s, { t: "loseGold", p: p.i, why, die: { id: d.id, face: d.face } });
  if (!gold(p).length) {
    p.out = true;
    p.dice = [];
    s.bid = s.bid && s.bid.by === p.i ? null : s.bid;
    emit(s, { t: "out", p: p.i });
    const left = alive(s);
    if (left.length === 1) { s.over = { winner: left[0].i }; emit(s, { t: "win", p: left[0].i }); }
  }
}
/** How much a gold die is worth keeping: Wild gives no power, so it goes first. */
const goldWorth = d => (d.face === 1 ? 0 : 1);
