// Quest's computer players: each reasons from what its role lets it know and what the table has shown (who led which
// party, who voted how, how each quest went), never from the roles it can't see.
//
// They weigh every way the traitors could be seated (at most 210 ways at ten players) by how well it explains the
// play: a quest's fails need that many traitors in its party (a traitor fails a quest more often than not, two seldom
// fail together); traitors nearly always approve a party with a traitor in it and approve clean ones less often than
// the loyal do, and lead parties with no other traitor on them; the loyal's votes and parties say little. What the role knows
// rules ways out: the Seer knows the traitors (but the Veiled); the Guardian knows one of two is the Impostor; a
// traitor knows the others (but the Hermit). From those weights, each player's chance of being a traitor and each
// party's chance of being clean.
//
// The loyal name the cleanest party with themselves in it, and approve a party nearly as clean as the best they could
// name or with nobody on it they suspect more than most (on the first quest, then, any party), and always the fifth in
// a row, which the loyal can't afford to refuse. The Seer plays as a loyal player would on what everyone can see,
// nudged by what it knows (too sure a hand gives it away to the Assassin). Traitors vote as a loyal player would too,
// but for a party with one of their own more often and against a clean one when it counts; they lead a party with one
// of their own (two, when the quest needs two fails) and the players the table trusts most, and fail a quest with one
// of them on it (the first round the table, so two fails don't show two traitors), now and then letting the first
// pass to be trusted. An Easy player knows only its own side and chooses and votes loosely; an Easy traitor fails every
// quest it can and now and then takes another traitor along.
//
// The table's talk weighs in too: a loyal player's accusation leans true (the Seer's always is), a traitor accuses
// another traitor less often and its trust covers its own a little, so an accusation from someone under suspicion
// counts for its target. They talk as they think (questChat): a knight accuses the players it's fairly sure of, trusts the
// ones it's surest are loyal once a quest has been played, and takes back what it no longer thinks; the Seer only
// accuses traitors and never trusts one, and on Sharp waits for the play to give it cover; a traitor joins in against
// the loyal the table already doubts, trusts the ones it trusts, now and then defends one of its own and, on Sharp,
// gives up one the table has all but caught. Accused, a player answers: back at the accuser when it doubts them (a
// traitor, mostly anyway), else not me, or lets it pass. When the traitors confer, each names the loyal player whose votes, parties and
// words best fit someone who knew the traitors, and agrees with another's pick it nearly made; the computer's strike
// goes to the one most of them named. An Easy traitor half guesses.
import { isEvil, knowledge, EVIL_COUNT, stances, named } from "./quest-rules.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Sharp"]];

/** Every choice of k seats out of a list. */
function choose(list, k) {
  const out = [], pick = [];
  const rec = start => {
    if (pick.length === k) { out.push(pick.slice()); return; }
    for (let i = start; i <= list.length - (k - pick.length); i++) { pick.push(list[i]); rec(i + 1); pick.pop(); }
  };
  rec(0);
  return out;
}
/** How likely a quest's fails are with this many traitors in its party. */
function questOdds(quest, fails, inParty) {
  if (fails > inParty) return 0;
  if (!inParty) return 1;
  if (quest.two) return inParty === 1 ? (fails ? 0.15 : 0.85) : fails >= 2 ? 0.75 : fails ? 0.05 : 0.2;
  return fails === 0 ? 0.2 : fails === 1 ? 0.75 : 0.05;
}
/**
 * The words standing that a seat weighs, [speaker, target, weights]: everyone's but its own (which tell it nothing; the
 * table hears its words too), and of each player only the first two to accuse them and the first two to trust them,
 * since those who join in mostly repeat what the first saw.
 */
function standing(s, seat, view) {
  const now = new Map(), count = new Map(), out = [];
  (s.talk || []).forEach((l, i) => {
    if (l.t === "accuse" || l.t === "trust") now.set(`${l.by}:${l.seat}`, [l.by, l.seat, l.t, i]);
    else if (l.t === "drop") now.delete(`${l.by}:${l.seat}`);
  });
  for (const [a, x, t] of [...now.values()].sort((p, q) => p[3] - q[3])) {
    if (a === seat && view !== "table") continue;
    const key = `${x}:${t}`, c = count.get(key) || 0;
    if (c >= 2) continue;
    count.set(key, c + 1);
    out.push([a, x, SAY[t]]);
  }
  return out;
}
// how likely a word is in a seating, by who says it of whom: [speaker a traitor][target a traitor]
const SAY = { accuse: [[1, 1.25], [1, 0.8]], trust: [[1, 0.85], [1, 1.05]] };

/**
 * The ways the traitors could be seated, as this seat sees them, each weighed by the play: { sets: [Set], w: [weight] }.
 * The view is "own" (all the role knows), "loyal" (as a plain loyal player in this seat would: only that they're loyal
 * themselves; a traitor's or the Seer's cover) or "table" (what everyone can see; what the table trusts).
 */
function worlds(s, seat, view = "own") {
  const n = s.seats, k = EVIL_COUNT[n], me = s.roles[seat];
  const said = standing(s, seat, view);
  const known = view === "own" ? knowledge(s.roles, seat) : {};
  const sure = new Set(Object.keys(known).filter(p => known[p] === "evil").map(Number));
  const pair = Object.keys(known).filter(p => known[p] === "seer?").map(Number);
  const meEvil = view === "own" && isEvil(me);
  if (meEvil) sure.add(seat);
  // the Seer and the traitors who know each other know all of them but the Veiled or the Hermit
  const hidden = view !== "own" ? null : me === "seer" ? +s.roles.includes("veiled") : meEvil && me !== "hermit" ? +s.roles.includes("hermit") : null;
  const free = [...Array(n).keys()].filter(p => !sure.has(p) && (view === "table" || p !== seat));
  const sets = [], w = [];
  for (const add of choose(free, Math.max(0, k - sure.size))) {
    if (hidden !== null && add.length !== hidden) continue;
    const E = new Set([...sure, ...add]);
    if (pair.length === 2 && s.roles.includes("impostor") && E.has(pair[0]) === E.has(pair[1])) continue;
    let weight = 1;
    for (const l of s.log) {
      const dirty = l.team.some(p => E.has(p));
      // a traitor leading takes none of the others along (one, when the quest needs two fails)
      if (E.has(l.leader)) weight *= l.team.filter(p => p !== l.leader && E.has(p)).length === (s.quests[l.q].two ? 1 : 0) ? 0.6 : 0.3;
      else weight *= 0.5;
      // a traitor nearly always approves a party with a traitor in it, and a clean one less often than the loyal
      l.votes.forEach((v, p) => { if (E.has(p)) weight *= dirty ? (v ? 0.75 : 0.25) : (v ? 0.45 : 0.55); });
      if (l.fails !== undefined) weight *= questOdds(s.quests[l.q], l.fails, l.team.filter(p => E.has(p)).length);
    }
    for (const [a, x, f] of said) weight *= f[+E.has(a)][+E.has(x)];
    if (weight > 0) { sets.push(E); w.push(weight); }
  }
  if (!sets.length) for (const add of choose(free, Math.max(0, k - sure.size))) { sets.push(new Set([...sure, ...add])); w.push(1); }
  return { sets, w };
}
const cleanOdds = (W, team) => { let c = 0, t = 0; W.sets.forEach((E, i) => { t += W.w[i]; if (!team.some(p => E.has(p))) c += W.w[i]; }); return t ? c / t : 0; };
const evilOdds = (W, p) => { let c = 0, t = 0; W.sets.forEach((E, i) => { t += W.w[i]; if (E.has(p)) c += W.w[i]; }); return t ? c / t : 0; };
/** The cleanest party of this size with this seat in it; `slack` lets a looser player settle for one nearly as clean. */
function bestTeam(W, s, seat, size, rng, slack = 0) {
  const others = [...Array(s.seats).keys()].filter(p => p !== seat);
  let best = null, bestV = -1;
  for (const rest of choose(others, size - 1)) {
    const team = [seat, ...rest], v = cleanOdds(W, team) * (1 + slack * rng()) + rng() * 1e-3;
    if (v > bestV) { bestV = v; best = team; }
  }
  return { team: best, clean: cleanOdds(W, best) };
}
/** Would a loyal player seeing the table as W approve this party? */
function approves(W, s, seat, team, rng, strict = 0.78) {
  const odds = cleanOdds(W, team), best = bestTeam(W, s, seat, team.length, rng).clean;
  if (odds >= Math.max(0.12, best * strict)) return true;
  // nobody on it under more suspicion than most: there's nothing yet to hold against it
  const others = [...Array(s.seats).keys()].filter(p => p !== seat), avg = others.reduce((a, p) => a + evilOdds(W, p), 0) / others.length;
  return team.every(p => p === seat || evilOdds(W, p) <= avg + 0.02);
}
/** The traitors this seat knows, itself included (the Hermit knows only itself). */
const ourSide = (s, seat) => new Set([seat, ...Object.keys(knowledge(s.roles, seat)).filter(() => isEvil(s.roles[seat])).map(Number)]);

export function questBot(s, seat, level = "medium", rng = Math.random) {
  const bad = isEvil(s.roles[seat]), easy = level === "easy";
  if (s.step === "assassin") return { t: "kill", seat: strike(s, seat, easy, rng) };
  if (s.step === "quest") return { t: "card", success: !bad || !shouldFail(s, seat, easy, rng) };
  if (s.step === "propose") return { t: "team", team: propose(s, seat, s.quests[s.q], easy, rng) };
  return { t: "vote", yes: vote(s, seat, easy, rng) };
}

/** The party a leader names. */
function propose(s, seat, quest, easy, rng) {
  const me = s.roles[seat];
  if (isEvil(me)) {
    // one of ours (two when it takes two fails), and the players the table trusts most, who aren't ours
    const T = worlds(s, seat, "table"), ours = ourSide(s, seat), key = new Map();
    for (let p = 0; p < s.seats; p++) key.set(p, evilOdds(T, p) + rng() * 0.05);
    const byTrust = list => list.sort((a, b) => key.get(a) - key.get(b));
    const team = [seat];
    if (quest.two || (easy && rng() < 0.4)) team.push(...byTrust([...ours].filter(p => p !== seat)).slice(0, 1));
    const rest = byTrust([...Array(s.seats).keys()].filter(p => !ours.has(p)));
    return [...team, ...rest].slice(0, quest.size);
  }
  if (easy) return bestTeam(worlds(s, seat, "loyal"), s, seat, quest.size, rng, 0.6).team;
  if (me === "seer") {
    // the party a plain loyal player would name, unless that takes a traitor along, and then mostly a clean one
    const known = new Set(Object.keys(knowledge(s.roles, seat)).map(Number));
    const cover = bestTeam(worlds(s, seat, "loyal"), s, seat, quest.size, rng).team;
    return cover.some(p => known.has(p)) && rng() < 0.4 ? bestTeam(worlds(s, seat), s, seat, quest.size, rng).team : cover;
  }
  return bestTeam(worlds(s, seat), s, seat, quest.size, rng).team;
}

/** Approve the party named, or refuse it. */
function vote(s, seat, easy, rng) {
  const me = s.roles[seat], team = s.team, won = s.quests.filter(q => q.result === "success").length;
  if (isEvil(me)) {
    const ours = team.filter(p => ourSide(s, seat).has(p)).length;
    if (s.rejects === 4) return ours > 0;                                   // the fifth: refusing it wins the game
    // as a loyal player would vote, but for one of ours more readily, and against a clean party when it counts
    const looks = approves(worlds(s, seat, "loyal"), s, seat, team, rng);
    if (ours) return looks || rng() < (easy ? 0.8 : 0.6);
    return looks && rng() < (won >= 2 ? 0.4 : 0.9);
  }
  if (s.rejects === 4) return true;
  if (easy) return rng() < (approves(worlds(s, seat, "loyal"), s, seat, team, rng, 0.5) ? 0.85 : 0.3);
  if (me === "seer") {
    // what the table can see says one thing; what the Seer knows may say otherwise, but not every time
    const known = new Set(Object.keys(knowledge(s.roles, seat)).map(Number)), dirty = team.some(p => known.has(p));
    const cover = approves(worlds(s, seat, "loyal"), s, seat, team, rng);
    return dirty ? cover && rng() < 0.7 : cover || rng() < 0.25;
  }
  return approves(worlds(s, seat), s, seat, team, rng);
}

/** Does a traitor on a quest fail it? (An Easy one fails nearly every quest it's on, whoever else is.) */
function shouldFail(s, seat, easy, rng) {
  const quest = s.quests[s.q], me = s.roles[seat], lost = s.quests.filter(q => q.result === "fail").length;
  if (easy) return rng() < 0.9;
  // the traitors on it that this one knows, in order round the table (the Hermit knows none)
  const ours = s.team.filter(p => ourSide(s, seat).has(p));
  if (quest.two) return me === "hermit" ? lost >= 2 || rng() < 0.4 : ours.length >= 2 && ours.slice(0, 2).includes(seat);
  if (me !== "hermit" && ours[0] !== seat) return false;                    // one fail does it: the first of us fails it
  if (lost >= 2) return true;
  return rng() < (s.q === 0 ? 0.7 : 0.92);                                  // now and then pass, to be trusted
}

// ---------- the strike ----------
const failed = (s, l) => l.fails !== undefined && l.fails >= (s.quests[l.q].two ? 2 : 1);

/**
 * The traitors' read of the loyal (they know each other now): how well each one's votes, parties and words fit someone
 * who knew the traitors. A vote against a party with a traitor on it, or for a clean one, fits; leading a clean party
 * fits; accusing a traitor fits, the more before a failed quest showed them; accusing a loyal player or trusting a
 * traitor doesn't. { pick, why, score(p) }.
 */
function seerGuess(s, seat, easy, rng) {
  const evil = new Set(s.roles.map((r, i) => (isEvil(r) ? i : -1)).filter(i => i >= 0));
  const cands = [...Array(s.seats).keys()].filter(p => !evil.has(p));
  const tell = new Map(cands.map(p => [p, { votes: 0, talk: 0, noise: rng() * (easy ? 3 : 0.3) }]));
  for (const l of s.log) {
    const dirty = l.team.some(x => evil.has(x));
    for (const [p, t] of tell) {
      t.votes += Math.log(l.votes[p] === !dirty ? 0.75 / 0.5 : 0.25 / 0.5);
      if (l.leader === p) t.votes += Math.log(dirty ? 0.3 / 0.5 : 0.7 / 0.5);
    }
  }
  for (const l of s.talk || []) {
    const t = tell.get(l.by);
    if (!t || l.seat == null) continue;
    const bad = evil.has(l.seat);
    if (l.t === "accuse") t.talk += Math.log(bad ? (s.log.slice(0, l.k).some(x => failed(s, x) && x.team.includes(l.seat)) ? 1.3 : 2.2) : 0.35);
    else if (l.t === "trust") t.talk += Math.log(bad ? 0.3 : 1.15);
  }
  const score = p => { const t = tell.get(p); return t ? t.votes + t.talk + t.noise : -Infinity; };
  const pick = cands.slice().sort((a, b) => score(b) - score(a))[0];
  const t = tell.get(pick);
  return { pick, score, why: t.talk > 0.4 && t.talk >= t.votes ? "talk" : t.votes > 0.4 ? "votes" : "gut" };
}

/** While the traitors confer: its pick for the Seer, said once; then agreement, once, with another's it nearly made. */
function confer(s, seat, easy, rng) {
  const lines = s.talk || [], guess = seerGuess(s, seat, easy, rng);
  const at = lines.findLastIndex(l => l.by === seat && l.t === "name");
  if (at < 0) return { t: "name", seat: guess.pick, why: guess.why };
  if (lines.some(l => l.by === seat && l.t === "name" && l.why === "agree")) return null;
  const mine = lines[at].seat, other = lines.slice(at + 1).findLast(l => l.t === "name" && l.by !== seat && l.seat !== mine);
  return other && guess.score(other.seat) >= guess.score(mine) - 1 ? { t: "name", seat: other.seat, why: "agree" } : null;
}

/** The computer's strike: the one most of the traitors named, the closest call its own read; nobody named, its own. */
function strike(s, seat, easy, rng) {
  const guess = seerGuess(s, seat, easy, rng), count = new Map();
  for (const p of Object.values(named(s))) if (!isEvil(s.roles[p])) count.set(p, (count.get(p) || 0) + 1);
  if (!count.size) return guess.pick;
  const top = Math.max(...count.values());
  return [...count].filter(([, c]) => c === top).map(([p]) => p).sort((a, b) => guess.score(b) - guess.score(a))[0];
}

// ---------- the talk ----------
/** A coin that stays put for the game: the same each time this seat thinks of that one. */
function stable(s, a, b) {
  let h = 2166136261;
  for (const c of `${s.roles.join()}|${a}|${b}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
const seatList = s => [...Array(s.seats).keys()];

/** What a computer player in this seat makes of everyone now: each one's odds of being a traitor, as it talks of them. */
export const suspicion = (s, seat, level = "medium") => readOf(s, seat, level === "easy").odds;

/** What this seat makes of everyone now, as it would talk of them: each one's odds of being a traitor; its own side. */
function readOf(s, seat, easy) {
  const me = s.roles[seat], odds = W => seatList(s).map(p => evilOdds(W, p));
  // a traitor talks to what the table thinks (it knows the truth); an Easy player, to what a plain knight would think
  if (isEvil(me)) return { odds: odds(worlds(s, seat, "table")), ours: ourSide(s, seat) };
  if (easy) return { odds: odds(worlds(s, seat, "loyal")), ours: new Set() };
  return { odds: odds(worlds(s, seat, me === "seer" ? "loyal" : "own")), ours: new Set() };
}

/** Why it says what it says of x (the page words it). */
function whyAccuse(s, seat, x) {
  const fails = s.quests.filter(q => q.result === "fail" && q.team?.includes(x)).length;
  if (fails) return fails > 1 ? "fails" : "fail";
  if (s.log.some(l => l.leader === x && failed(s, l))) return "lead";
  if ((s.talk || []).some(l => l.t === "accuse" && l.seat === x && l.by !== seat)) return "agree";
  return s.log.some(l => failed(s, l) && l.votes[x]) ? "votes" : "gut";
}
function whyTrust(s, seat, x) {
  const on = s.quests.filter(q => q.result && q.team?.includes(x));
  if (on.length && on.every(q => q.result === "success")) return "clean";
  if ((s.talk || []).some(l => l.t === "accuse" && l.seat === x && l.by !== seat)) return "defend";
  return s.log.some(l => failed(s, l) && l.votes[x] === false) ? "votes" : "gut";
}

/**
 * What a computer player says now, if anything: { t, seat, why } for talk() (quest-rules.js), or null. Accused since
 * it last spoke, it answers; else, at most one word of its own a party (none before the first), and not every time:
 * the strongest change in what it thinks of someone. `quiet`: the table has heard enough for now, only an answer.
 * While the traitors confer, a traitor names its pick for the Seer.
 */
export function questChat(s, seat, level = "medium", rng = Math.random, { quiet = false } = {}) {
  if (s.step === "over") return null;
  const easy = level === "easy", me = s.roles[seat], lines = s.talk || [];
  if (s.step === "assassin") return isEvil(me) ? confer(s, seat, easy, rng) : null;
  // the latest accusation of it since it last spoke
  let hit = -1;
  for (let i = lines.length - 1; i >= 0 && lines[i].by !== seat; i--) if (lines[i].t === "accuse" && lines[i].seat === seat) { hit = i; break; }
  const reply = hit >= 0 ? answer(s, seat, hit, readOf(s, seat, easy)) : null;
  if (reply) return reply;
  if (quiet || !s.log.length) return null;
  if (lines.some(l => l.by === seat && l.k === s.log.length && l.t !== "deny" && l.why !== "back")) return null;
  // the Seer on Sharp keeps its counsel more than most
  if (rng() > (easy ? 0.6 : me === "seer" ? 0.45 : 0.8)) return null;
  return opinion(s, seat, readOf(s, seat, easy), easy);
}

/**
 * A word back to the accusation at s.talk[at]: an accusation in return when it doubts the accuser (a traitor, mostly
 * anyway), else, half the time, not me; the other half it lets pass. Decided once: the same each time it looks.
 */
function answer(s, seat, at, read) {
  const accuser = s.talk[at].by, mine = stances(s)[seat], held = Object.values(mine).filter(v => v === "accuse").length;
  const base = EVIL_COUNT[s.seats] / (s.seats - 1);
  const back = mine[accuser] !== "accuse" && held < 2 && (isEvil(s.roles[seat]) ? !read.ours.has(accuser) && stable(s, seat, `back${at}`) < 0.7 : read.odds[accuser] >= base + 0.05);
  if (back) return { t: "accuse", seat: accuser, why: "back" };
  return stable(s, seat, `deny${at}`) < 0.5 ? { t: "deny", seat: accuser, why: "back" } : null;
}

/** A word of its own: the strongest change in what it thinks of someone, or null. */
function opinion(s, seat, read, easy) {
  const n = s.seats, k = EVIL_COUNT[n], base = k / (n - 1), me = s.roles[seat], odds = read.odds;
  const mine = stances(s)[seat], held = t => Object.values(mine).filter(v => v === t).length;
  const others = seatList(s).filter(p => p !== seat).sort((a, b) => odds[b] - odds[a]);
  const played = s.quests.some(q => q.result);
  const accuseAt = Math.max(0.6, base + 0.2) - (easy ? 0.1 : 0), trustAt = Math.min(0.2, base - 0.2) + (easy ? 0.05 : 0);
  if (!isEvil(me)) {
    // the Seer accuses only traitors (or, with the Veiled about, those it can't see), and trusts none of them; on
    // Sharp it waits for the play to give it cover
    const known = me === "seer" ? knowledge(s.roles, seat) : {}, veiled = s.roles.includes("veiled");
    const may = x => me !== "seer" || known[x] === "evil" || (veiled && !known[x]);
    const sure = x => (me === "seer" && known[x] === "evil" ? Math.min(1, odds[x] + (easy ? 0.3 : 0.12)) : odds[x]);
    for (const x of others) if (may(x) && sure(x) >= accuseAt && mine[x] !== "accuse" && held("accuse") < 2) return { t: "accuse", seat: x, why: whyAccuse(s, seat, x) };
    for (const x of others) {
      if (mine[x] === "accuse" && sure(x) < accuseAt - 0.15) return { t: "drop", seat: x, why: "doubt" };
      if (mine[x] === "trust" && odds[x] > trustAt + 0.2) return { t: "drop", seat: x, why: "doubt" };
    }
    if (played) for (const x of others.slice().reverse()) if (known[x] !== "evil" && odds[x] <= trustAt && mine[x] !== "trust" && held("trust") < 2) return { t: "trust", seat: x, why: whyTrust(s, seat, x) };
    return null;
  }
  // a traitor: doubt for the loyal the table doubts, trust for the ones it trusts; one of its own all but caught given
  // up (Sharp), one under fire now and then defended
  const ours = read.ours, loyal = others.filter(p => !ours.has(p)), fellows = others.filter(p => ours.has(p));
  const pile = Math.max(0.35, base - 0.02) - (easy ? 0.15 : 0);
  // a quest failed with it on the party: it was the loyal one beside it, of course (Sharp)
  const lastFail = s.quests.findLast(q => q.result === "fail" && q.team?.includes(seat));
  if (!easy && lastFail && held("accuse") < 2) {
    const blame = loyal.find(x => lastFail.team.includes(x) && mine[x] !== "accuse");
    if (blame != null && !(s.talk || []).some(l => l.by === seat && l.t === "accuse" && l.seat === blame)) return { t: "accuse", seat: blame, why: whyAccuse(s, seat, blame) };
  }
  for (const x of loyal) if (odds[x] >= pile && mine[x] !== "accuse" && held("accuse") < 2) return { t: "accuse", seat: x, why: whyAccuse(s, seat, x) };
  if (!easy) for (const x of fellows) if (odds[x] >= 0.9 && mine[x] !== "accuse" && held("accuse") < 2) return { t: "accuse", seat: x, why: whyAccuse(s, seat, x) };
  for (const x of others) {
    if (mine[x] === "accuse" && !ours.has(x) && odds[x] < pile - 0.2) return { t: "drop", seat: x, why: "doubt" };
    if (mine[x] === "trust" && odds[x] >= (ours.has(x) ? 0.8 : trustAt + 0.25)) return { t: "drop", seat: x, why: "doubt" };
  }
  if (!played) return null;
  const doubted = x => stances(s).some((st, a) => a !== seat && st[x] === "accuse");
  for (const x of fellows) if (odds[x] >= 0.4 && odds[x] < 0.8 && doubted(x) && mine[x] !== "trust" && held("trust") < 2 && stable(s, seat, x) < (easy ? 0.6 : 0.3)) return { t: "trust", seat: x, why: "defend" };
  for (const x of loyal.slice().reverse()) if (odds[x] <= trustAt + 0.05 && mine[x] !== "trust" && held("trust") < 1) return { t: "trust", seat: x, why: whyTrust(s, seat, x) };
  return null;
}
