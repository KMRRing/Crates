// Quest's computer players: each reasons from what its role lets it know and what the table has shown (who led which
// party, who voted how, how each quest went, what's been said), never from the roles it can't see.
//
// They weigh every way the traitors could be seated (at most 210 ways at ten players) by how well it explains the
// play: a quest's fails need that many traitors in its party (a traitor fails a quest more often than not, two seldom
// fail together); every vote, by how often a loyal player and a traitor, on the party or off it, approve a party clean
// or foul (measured from their own play: a traitor refuses clean parties far more often than the loyal, and on Sharp
// votes on foul ones much as they do, on Easy for them nearly always); a traitor leading takes no other traitor along. What the role knows rules ways out: the
// Seer knows the traitors (but the Veiled); the Guardian knows one of two is the Impostor; a traitor knows the others
// (but the Hermit). From those weights, each player's chance of being a traitor and each party's chance of being clean.
//
// The loyal name the cleanest party with themselves in it, approve one nearly as clean as the best they could name, and
// always their own and the fifth in a row, which the loyal can't afford to refuse; besides, at five, one with nobody on
// it they suspect more than most (on the first quest, then, any party), and from six, one as clean as the next leader
// is likely to name instead (measured: each plays best at its sizes). The Seer plays as a loyal player would on what
// everyone can see, nudged by what it knows (too sure a hand gives it away to the strike). The Guardian hears its two:
// in each seating the loyal one of them is the Seer, whose words are true and whose votes follow what it knows; once
// they've spoken, it votes for a party only if it's more likely clean than not.
//
// Traitors vote as a loyal player in their seat would, no more readily for a party with one of their own (that would
// tie them together), against a clean one now and then once the loyal have won two, and against the fourth clean party
// in a row when the next leader is one of them, since the loyal must send the fifth. They lead with themselves (and one
// more of their own when the quest needs two fails) and the players the table trusts most; on a quest, the one of them
// the table suspects most fails it, having least to lose, and the others keep clean; now and then they let the first
// pass, to be trusted. An Easy player knows only its own side and chooses and votes loosely; an Easy traitor fails
// every quest it can and now and then takes another traitor along.
//
// The table's talk weighs in too: a loyal player's accusation doubles the odds against its target (the Seer's is always
// true); a traitor's says nothing, since it accuses the loyal and, once the table suspects one of its own as much as
// most, that one too; a loyal player's trust counts a little for its target, a traitor's covers its own a little. With
// no Seer in the game, only the first few to accuse each player and to trust them count (two at five or six, three at
// seven, six from eight), since those who join in mostly repeat what the first saw; with the Seer, everyone's.
//
// They talk as they think (questChat), each with a temper of its own: a knight accuses the players it's fairly sure of,
// trusts the ones it's surest are loyal once a quest has been played, and takes back what it no longer thinks; the Seer
// only accuses traitors and never trusts one, and waits for the play to give it some cover, less with a Guardian
// listening for it. A traitor blames the loyal player beside it on a failed quest, joins in against the loyal the table
// doubts more than their share and trusts the ones it trusts; on Sharp it accuses one of its own the table suspects as
// much as most already, on Easy it now and then defends one. Accused, a player answers: back at the accuser when it
// doubts them (a traitor, mostly anyway), else not me, or lets it pass. When the traitors confer, each names the loyal
// player whose votes, parties and words best fit someone who knew the traitors, and agrees with another's pick it nearly
// made; the computer's strike goes to the one most of them named. An Easy traitor half guesses.
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
// how often a player approves a party, by [voter a traitor][party foul][voter on it], measured from their own play at
// each level (a traitor on a party makes it foul, so [1][0][1] never comes up): on Sharp a traitor's votes are much like
// the loyal's, on Easy it approves a party with its own on it nearly every time
const VOTE = { medium: [[[0.72, 0.87], [0.48, 0.75]], [[0.38, 0.5], [0.45, 0.78]]], easy: [[[0.47, 0.87], [0.37, 0.72]], [[0.08, 0.5], [0.82, 0.97]]] };
// the Seer's, as the Guardian reads its two: [party foul]
const SEER_VOTE = [0.81, 0.42];
// how likely a word is in a seating, by who says it of whom: [speaker a traitor][target a traitor]
const SAY = { accuse: [[1, 2], [1, 1]], trust: [[1, 0.7], [1, 1.05]] };
// a word of the Seer's, as the Guardian hears its two: [target a traitor]
const SEER_SAY = { accuse: [0.1, 10], trust: [10, 0.1] };
/**
 * Of each player, how many of the first to accuse them, and of the first to trust them, a seat weighs: with no Seer in
 * the game, those who join in mostly repeat what the first saw (two at five or six, three at seven, six from eight);
 * with the Seer, any of them may be the one who knows.
 */
const heard = s => (s.roles.includes("seer") ? Infinity : s.seats <= 6 ? 2 : s.seats === 7 ? 3 : 6);

/**
 * The words standing that a seat weighs, [speaker, target, weights]: everyone's but its own (which tell it nothing; the
 * table hears its words too), and of each player only the first few to accuse them and to trust them (heard).
 */
function standing(s, seat, view) {
  const now = new Map(), count = new Map(), out = [], cap = heard(s);
  (s.talk || []).forEach((l, i) => {
    if (l.t === "accuse" || l.t === "trust") now.set(`${l.by}:${l.seat}`, [l.by, l.seat, l.t, i]);
    else if (l.t === "drop") now.delete(`${l.by}:${l.seat}`);
  });
  for (const [a, x, t] of [...now.values()].sort((p, q) => p[3] - q[3])) {
    if (a === seat && view !== "table") continue;
    const key = `${x}:${t}`, c = count.get(key) || 0;
    if (c >= cap) continue;
    count.set(key, c + 1);
    out.push([a, x, SAY[t]]);
  }
  return out;
}

/**
 * The ways the traitors could be seated, as this seat sees them, each weighed by the play: { sets: [Set], w: [weight] }.
 * The view is "own" (all the role knows), "loyal" (as a plain loyal player in this seat would: only that they're loyal
 * themselves; a traitor's or the Seer's cover) or "table" (what everyone can see; what the table trusts). `easy`: the
 * table plays Easy, and votes so.
 */
function worlds(s, seat, view = "own", easy = false) {
  const n = s.seats, k = EVIL_COUNT[n], me = s.roles[seat];
  const said = standing(s, seat, view);
  const known = view === "own" ? knowledge(s.roles, seat) : {};
  const sure = new Set(Object.keys(known).filter(p => known[p] === "evil").map(Number));
  // the Guardian's two, the Seer and the Impostor, and what they've said
  const pair = Object.keys(known).filter(p => known[p] === "seer?").map(Number);
  const pairSaid = pair.length === 2 ? stances(s).flatMap((st, a) => (pair.includes(a) ? Object.entries(st).map(([x, t]) => [a, Number(x), t]) : [])) : [];
  const meEvil = view === "own" && isEvil(me);
  if (meEvil) sure.add(seat);
  // the Seer and the traitors who know each other know all of them but the Veiled or the Hermit
  const hidden = view !== "own" ? null : me === "seer" ? +s.roles.includes("veiled") : meEvil && me !== "hermit" ? +s.roles.includes("hermit") : null;
  const free = [...Array(n).keys()].filter(p => !sure.has(p) && (view === "table" || p !== seat));
  const sets = [], w = [], vote = VOTE[easy ? "easy" : "medium"];
  for (const add of choose(free, Math.max(0, k - sure.size))) {
    if (hidden !== null && add.length !== hidden) continue;
    const E = new Set([...sure, ...add]);
    if (pair.length === 2 && E.has(pair[0]) === E.has(pair[1])) continue;
    // in this seating, the loyal one of the Guardian's two is the Seer
    const seer = pair.find(p => !E.has(p));
    let weight = 1;
    for (const l of s.log) {
      const foul = l.team.some(p => E.has(p));
      // a traitor leading takes none of the others along (one, when the quest needs two fails)
      if (E.has(l.leader)) weight *= l.team.filter(p => p !== l.leader && E.has(p)).length === (s.quests[l.q].two ? 1 : 0) ? 0.6 : 0.3;
      else weight *= 0.5;
      l.votes.forEach((v, p) => {
        const a = p === seer ? SEER_VOTE[+foul] : vote[+E.has(p)][+foul][+l.team.includes(p)];
        weight *= v ? a : 1 - a;
      });
      if (l.fails !== undefined) weight *= questOdds(s.quests[l.q], l.fails, l.team.filter(p => E.has(p)).length);
    }
    for (const [a, x, f] of said) weight *= f[+E.has(a)][+E.has(x)];
    for (const [a, x, t] of pairSaid) if (a === seer) weight *= SEER_SAY[t][+E.has(x)];
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
/**
 * Would a loyal player seeing the table as W approve this party? One nearly as clean as the best it could name; at five,
 * one with nobody on it it suspects more than most too (there's nothing yet to hold against it); from six, one as clean
 * as the next leader is likely to name if it's refused: the best there is if they're loyal, a foul one if not.
 */
function approves(W, s, seat, team, rng, strict = 0.78) {
  const odds = cleanOdds(W, team), best = bestTeam(W, s, seat, team.length, rng).clean;
  if (odds >= Math.max(0.12, best * strict)) return true;
  if (s.seats >= 6) {
    const after = (s.leader + 1) % s.seats;
    return after !== seat && odds >= Math.max(0.12, (1 - evilOdds(W, after)) * best);
  }
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
    const T = worlds(s, seat, "table", easy), ours = ourSide(s, seat), key = new Map();
    for (let p = 0; p < s.seats; p++) key.set(p, evilOdds(T, p) + rng() * 0.05);
    const byTrust = list => list.sort((a, b) => key.get(a) - key.get(b));
    const team = [seat];
    if (quest.two || (easy && rng() < 0.4)) team.push(...byTrust([...ours].filter(p => p !== seat)).slice(0, 1));
    return [...team, ...byTrust([...Array(s.seats).keys()].filter(p => !ours.has(p)))].slice(0, quest.size);
  }
  if (easy) return bestTeam(worlds(s, seat, "loyal", true), s, seat, quest.size, rng, 0.6).team;
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
  if (s.leader === seat) return true;                                       // anyone sends their own party
  if (isEvil(me)) {
    const side = ourSide(s, seat), ours = team.filter(p => side.has(p)).length;
    if (s.rejects === 4) return ours > 0;                                   // the fifth: refusing it wins the game
    // the fourth: refused, the fifth is the next leader's, which the loyal must send
    if (!easy && s.rejects === 3 && !ours && side.has((s.leader + 1) % s.seats)) return false;
    // as a loyal player in its seat would vote, and against a clean party now and then once the loyal have two; an
    // Easy one for its own more readily, which ties them together
    const looks = approves(worlds(s, seat, "loyal", easy), s, seat, team, rng);
    if (ours) return looks || (easy && rng() < 0.8);
    if (!looks) return false;
    return won >= 2 ? rng() < 0.4 : !easy || rng() < 0.9;
  }
  if (s.rejects === 4) return true;
  if (easy) return rng() < (approves(worlds(s, seat, "loyal", true), s, seat, team, rng, 0.5) ? 0.85 : 0.3);
  if (me === "seer") {
    const known = new Set(Object.keys(knowledge(s.roles, seat)).map(Number)), foul = team.some(p => known.has(p));
    // what the table can see says one thing; what the Seer knows may say otherwise, but not every time
    const cover = approves(worlds(s, seat, "loyal"), s, seat, team, rng);
    return foul ? cover && rng() < 0.7 : cover || rng() < 0.25;
  }
  if (me === "guardian") {
    // once its two have spoken, it votes by what it heard
    const pair = Object.keys(knowledge(s.roles, seat)).map(Number);
    if (stances(s).some((st, a) => pair.includes(a) && Object.keys(st).length)) return cleanOdds(worlds(s, seat), team) >= 0.5;
  }
  return approves(worlds(s, seat), s, seat, team, rng);
}

/** Does a traitor on a quest fail it? (An Easy one fails nearly every quest it's on, whoever else is.) */
function shouldFail(s, seat, easy, rng) {
  const quest = s.quests[s.q], me = s.roles[seat], lost = s.quests.filter(q => q.result === "fail").length;
  if (easy) return rng() < 0.9;
  // the traitors on it that this one knows (the Hermit knows none), the one the table suspects most first: a fail costs
  // it least; the others keep clean
  const T = worlds(s, seat, "table"), side = ourSide(s, seat);
  const ours = s.team.filter(p => side.has(p)).sort((a, b) => evilOdds(T, b) - evilOdds(T, a) || a - b);
  if (quest.two) return me === "hermit" ? lost >= 2 || rng() < 0.4 : ours.length >= 2 && ours.slice(0, 2).includes(seat);
  if (me !== "hermit" && ours[0] !== seat) return false;                    // one fail does it
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
  if (isEvil(me)) return { odds: odds(worlds(s, seat, "table", easy)), ours: ourSide(s, seat) };
  if (easy) return { odds: odds(worlds(s, seat, "loyal", true)), ours: new Set() };
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
  // not every time: less often on Easy, and from a Seer with no Guardian listening for it
  if (rng() > (easy || (me === "seer" && !s.roles.includes("guardian")) ? 0.6 : 0.8)) return null;
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
  // a temper of its own, the same all game, some quicker to speak than others: a table doesn't move as one, and the
  // game doesn't hang on a hair (with one threshold for all, a little either way swung whole games)
  const temper = stable(s, seat, "temper") * 2 - 1;
  const accuseAt = Math.max(0.6, base + 0.2) + temper * 0.05 - (easy ? 0.1 : 0), trustAt = Math.min(0.2, base - 0.2) + (easy ? 0.05 : 0);
  if (!isEvil(me)) {
    // the Seer accuses only traitors (or, with the Veiled about, those it can't see), and trusts none of them; it waits
    // for the play to give it some cover, less with a Guardian to follow its lead
    const known = me === "seer" ? knowledge(s.roles, seat) : {}, veiled = s.roles.includes("veiled");
    const may = x => me !== "seer" || known[x] === "evil" || (veiled && !known[x]);
    const sure = x => (me === "seer" && known[x] === "evil" ? Math.min(1, odds[x] + (easy || !s.roles.includes("guardian") ? 0.3 : 0.5)) : odds[x]);
    for (const x of others) if (may(x) && sure(x) >= accuseAt && mine[x] !== "accuse" && held("accuse") < 2) return { t: "accuse", seat: x, why: whyAccuse(s, seat, x) };
    for (const x of others) {
      if (mine[x] === "accuse" && sure(x) < accuseAt - 0.15) return { t: "drop", seat: x, why: "doubt" };
      if (mine[x] === "trust" && odds[x] > trustAt + 0.2) return { t: "drop", seat: x, why: "doubt" };
    }
    if (played) for (const x of others.slice().reverse()) if (known[x] !== "evil" && odds[x] <= trustAt && mine[x] !== "trust" && held("trust") < 2) return { t: "trust", seat: x, why: whyTrust(s, seat, x) };
    return null;
  }
  // a traitor: doubt for the loyal the table doubts more than their share, trust for the ones it trusts
  const ours = read.ours, loyal = others.filter(p => !ours.has(p)), fellows = others.filter(p => ours.has(p));
  const share = k / n, pile = share + 0.05 + temper * 0.04 - (easy ? 0.15 : 0);
  // a quest failed with it on the party: it was the loyal one beside it, of course (Sharp)
  const lastFail = s.quests.findLast(q => q.result === "fail" && q.team?.includes(seat));
  if (!easy && lastFail && held("accuse") < 2) {
    const blame = loyal.find(x => lastFail.team.includes(x) && mine[x] !== "accuse");
    if (blame != null && !(s.talk || []).some(l => l.by === seat && l.t === "accuse" && l.seat === blame)) return { t: "accuse", seat: blame, why: whyAccuse(s, seat, blame) };
  }
  for (const x of loyal) if (odds[x] >= pile && mine[x] !== "accuse" && held("accuse") < 2) return { t: "accuse", seat: x, why: whyAccuse(s, seat, x) };
  // on Sharp, one of its own the table suspects as much as most already it doubts aloud too: a word against them costs
  // them little, and it keeps clear of them
  if (!easy) for (const x of fellows) if (odds[x] >= share + 0.02 + temper * 0.04 && mine[x] !== "accuse" && held("accuse") < 2) return { t: "accuse", seat: x, why: whyAccuse(s, seat, x) };
  for (const x of others) {
    if (mine[x] === "accuse" && !ours.has(x) && odds[x] < pile - 0.2) return { t: "drop", seat: x, why: "doubt" };
    if (mine[x] === "trust" && odds[x] >= (ours.has(x) ? 0.8 : trustAt + 0.25)) return { t: "drop", seat: x, why: "doubt" };
  }
  if (!played) return null;
  // on Easy, now and then a word for one of its own under fire
  const doubted = x => stances(s).some((st, a) => a !== seat && st[x] === "accuse");
  if (easy) for (const x of fellows) if (odds[x] >= 0.4 && odds[x] < 0.8 && doubted(x) && !mine[x] && held("trust") < 2 && stable(s, seat, x) < 0.6) return { t: "trust", seat: x, why: "defend" };
  for (const x of loyal.slice().reverse()) if (odds[x] <= trustAt + 0.05 && mine[x] !== "trust" && held("trust") < 1) return { t: "trust", seat: x, why: whyTrust(s, seat, x) };
  return null;
}
