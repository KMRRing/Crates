// Company (id quest): the loyal and the Vitalians among them (the hidden-role mechanics of The Resistance and Avalon,
// with roles of its own), five to ten players on seats.js, the computer playing any seat nobody has. A Hanseatic trading
// house sends five voyages: in each, the Alderman (the leader, in turn round the table) names a crew; everyone votes on
// it, openly; a majority sends it, else the seal passes, and a fifth crew refused in a row hands the game to the
// Vitalians. On a voyage each member plays, unseen, deliver or spoil: loyal hands must deliver, a Vitalian may spoil
// the cargo. Three cargoes delivered win it for the Company, three lost for the Vitalians; but if the Company wins, the
// Vitalians name whom they think is the Lookout, and naming them wins it back.
//
// Only the words shown changed, twice. The ids in the state, the database, the saved keys and the tests keep the first
// words the game had: quest (voyage), party/team (crew), leader (Alderman), traitor and evil (Vitalian), success and
// fail (deliver and spoil), and the roles' first names (seer, guardian, assassin, impostor, veiled, hermit; shown
// since 2 November 2026 as Lookout, Pilot, Mutineer, Wrecker, Stowaway and Smuggler). So saved games and rooms in flight
// still read. The comments below keep to those first words.
//
// The roles: the Lookout (loyal) knows the traitors, all but the Stowaway; the Pilot (loyal) knows who the Lookout and the
// Wrecker are, but not which is which; the Wrecker (a traitor) looks like the Lookout to the Pilot; the Stowaway (a
// traitor) is hidden from the Lookout; the Smuggler (a traitor) neither knows the other traitors nor is known to them; the
// Mutineer (a traitor) has the traitors' last word on the Lookout. The other loyal and the other traitors know only
// themselves (the traitors know each other).
//
// Table talk: anyone may, at any time, accuse another of being a traitor, say they trust them, or take it back (no
// more accused than there are traitors, no more trusted than there are other loyal); a word isn't a move, so the game
// never waits for one (talk() makes it, the page puts it on the table). When the loyal have won three, the traitors
// confer: they know each other now, each may name whom they think is the Lookout, and the strike is theirs to agree on:
// the Mutineer's when a person plays it, else any traitor's a person plays (the first round the table from the
// Mutineer), else the computer's Mutineer's. Which seats people play is read from the moves (the computer's carry bot).

import { questBot } from "./quest-bot.js";

export const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
/** Each quest's party size by players; the fourth quest needs two fails from seven players up. */
export const SIZES = { 5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4], 8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5] };
export const EVIL = new Set(["assassin", "impostor", "veiled", "hermit", "traitor"]);
export const ROLE_NAMES = { seer: "the Lookout", guardian: "the Pilot", loyal: "a loyal hand", assassin: "the Mutineer", impostor: "the Wrecker", veiled: "the Stowaway", hermit: "the Smuggler", traitor: "a Vitalian" };
export const SHOW_MS = 2600;
/** A game's talk is kept to this many lines (a table that says more has said enough). */
export const TALK_MAX = 400;
/** What a computer player gives as its reason for a word (the page words it): see quest-bot.js. */
const WHY = new Set(["fail", "fails", "lead", "votes", "agree", "back", "gut", "clean", "defend", "doubt", "talk"]);
export const isEvil = role => EVIL.has(role);
const next = (s, seat) => (seat + 1) % s.seats;
/** Seats as the narrator says them, each by who sits there: "{s1}, {s2} and {s4}". */
const names = seats => { const l = seats.map(p => `{s${p}}`); return l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} and ${l.at(-1)}`; };

/** The roles dealt for a table: the specials chosen, filled with plain loyal and traitors to the counts. */
export function dealRoles(n, opts, rng) {
  const evil = [], good = [];
  if (opts.seer !== false) { good.push("seer"); evil.push("assassin"); }
  if (opts.guardian && opts.seer !== false) { good.push("guardian"); evil.push("impostor"); }
  if (opts.veiled && opts.seer !== false) evil.push("veiled");
  if (opts.hermit) evil.push("hermit");
  const nEvil = EVIL_COUNT[n];
  while (evil.length > nEvil) evil.pop();
  while (evil.length < nEvil) evil.push("traitor");
  while (good.length < n - nEvil) good.push("loyal");
  const all = [...good, ...evil];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

/** What a seat knows at the start: each other seat it knows something of, and what ("evil", or "seer?" for the Pilot). */
export function knowledge(roles, seat) {
  const me = roles[seat], out = {};
  roles.forEach((r, i) => {
    if (i === seat) return;
    if (me === "seer" && isEvil(r) && r !== "veiled") out[i] = "evil";
    if (me === "guardian" && (r === "seer" || r === "impostor")) out[i] = "seer?";
    if (isEvil(me) && me !== "hermit" && isEvil(r) && r !== "hermit") out[i] = "evil";
  });
  return out;
}

/** Where each player stands now: for each, the players they accuse or trust (their last word on each). */
export function stances(s) {
  const out = Array.from({ length: s.seats }, () => ({}));
  for (const l of s.talk || []) {
    if (l.t === "accuse" || l.t === "trust") out[l.by][l.seat] = l.t;
    else if (l.t === "drop") delete out[l.by][l.seat];
  }
  return out;
}
/** While the traitors confer: whom each traitor has named as the Lookout (their last word). */
export function named(s) {
  const out = {};
  for (const l of s.talk || []) if (l.t === "name") out[l.by] = l.seat;
  return out;
}
/** Whose the strike is: the Mutineer's when a person plays it, else the first traitor a person plays round the table
 *  from the Mutineer, else the computer's Mutineer's. */
export function striker(s) {
  const a = s.roles.indexOf("assassin");
  if (s.people?.[a]) return a;
  for (let k = 1; k < s.seats; k++) { const p = (a + k) % s.seats; if (isEvil(s.roles[p]) && s.people?.[p]) return p; }
  return a;
}

/**
 * A word at the table, said by the player in `seat` whenever they like (it isn't a move): { t: "accuse" | "trust" |
 * "drop", seat } of another player, { t: "deny", seat? } (not me: to whoever accused them), or, while the traitors
 * confer, a traitor's { t: "name", seat } of the one they think is the Lookout. A computer player's carries why (its
 * reason, worded by the page). The state with the line added (on a copy, as act's), or why it can't be said.
 */
export function talk(s, seat, m) {
  if (s.step === "over") return "The game is over";
  if (!(seat >= 0 && seat < s.seats)) return "You're watching this game";
  const lines = s.talk || (s.talk = []), t = m?.t, target = m?.seat == null ? null : Number(m.seat);
  if (lines.length >= TALK_MAX) return "The table has said enough for one game";
  if (target !== null && !(Number.isInteger(target) && target >= 0 && target < s.seats && target !== seat)) return "Choose another player";
  if (s.step === "assassin") {
    if (!isEvil(s.roles[seat])) return "The Vitalians are choosing whom to strike";
    if (t !== "name" || target === null) return "Name the one you think is the Lookout";
    if (isEvil(s.roles[target])) return "Name one of the loyal hands";
    if (named(s)[seat] === target) return "You've named them";
  } else if (t === "deny") {
    if (lines.at(-1)?.by === seat && lines.at(-1).t === "deny") return "You've said so";
  } else {
    if (target === null || !["accuse", "trust", "drop"].includes(t)) return "Accuse a player, or say you trust them";
    const mine = stances(s)[seat], k = EVIL_COUNT[s.seats];
    if (t === "drop" && !mine[target]) return "You've said nothing of them";
    if (t !== "drop" && mine[target] === t) return t === "accuse" ? "You accuse them already" : "You trust them already";
    const held = Object.entries(mine).filter(([p, v]) => v === t && Number(p) !== target).length;
    if (t === "accuse" && held >= k) return `You accuse ${held} already, as many as there are Vitalians: take one back first`;
    if (t === "trust" && held >= s.seats - k - 1) return `You trust ${held} already, all the others who can be loyal: take one back first`;
  }
  const line = { by: seat, t, k: s.log.length };
  if (target !== null) line.seat = target;
  if (WHY.has(m?.why)) line.why = m.why;
  lines.push(line);
  return s;
}

const fresh = votes => Array.from({ length: votes }, () => null);

export const rules = {
  id: "quest",
  seats: { min: 5, max: 10 },

  deal({ seats, options = {}, rng }) {
    const n = Math.max(5, Math.min(10, seats));
    const s = { seats: n, roles: dealRoles(n, options, rng), opts: { seer: options.seer !== false, guardian: !!options.guardian, veiled: !!options.veiled, hermit: !!options.hermit },
      quests: SIZES[n].map((size, i) => ({ size, two: i === 3 && n >= 7 })), q: 0, leader: Math.floor(rng() * n), rejects: 0, step: "propose", team: [], log: [],
      talk: [], people: Array.from({ length: n }, () => false) };
    s.say = `Company: ${n} at the table, ${EVIL_COUNT[n]} of them Vitalians. Look at your role. The first voyage: a crew of ${s.quests[0].size}. Alderman: {s${s.leader}}.`;
    return s;
  },

  toMove(s) {
    if (s.step === "propose") return s.leader;
    if (s.step === "vote") { for (let k = 1; k <= s.seats; k++) { const p = (s.leader + k) % s.seats; if (s.votes[p] === null) return p; } return null; }
    if (s.step === "quest") return s.team.find(p => s.cards[p] === null) ?? null;
    if (s.step === "assassin") return striker(s);
    return null;
  },

  act(s, seat, m, { now = 0 } = {}) {
    if (rules.toMove(s) !== seat) return "It isn't your turn";
    // whose hands the seat is in: a person's move, or the computer's (playing a seat nobody has, or someone away)
    if (s.people) s.people[seat] = !m?.bot;
    if (s.step === "propose") {
      const team = [...new Set((m?.team || []).map(Number))];
      if (m?.t !== "team" || team.length !== s.quests[s.q].size || team.some(p => !(p >= 0 && p < s.seats))) return `Name a crew of ${s.quests[s.q].size}`;
      s.team = team.sort((a, b) => a - b);
      s.votes = fresh(s.seats);
      s.step = "vote";
      s.say = `The crew: ${names(s.team)}. Vote.`;
      return s;
    }
    if (s.step === "vote") {
      if (m?.t !== "vote" || typeof m.yes !== "boolean") return "Approve or refuse";
      s.votes[seat] = m.yes;
      delete s.say;
      if (s.votes.some(v => v === null)) return s;
      const yes = s.votes.filter(Boolean).length, approved = yes * 2 > s.seats;
      s.log.push({ q: s.q, leader: s.leader, team: s.team.slice(), votes: s.votes.slice(), approved });
      s.step = "shown";
      s.show = "vote";
      s.until = now + SHOW_MS;
      s.say = approved ? `Carried, ${yes} to ${s.seats - yes}: the crew sets sail.` : `Refused, ${yes} to ${s.seats - yes}.${s.rejects === 3 ? " One more refusal and the season closes: the Vitalians win." : ""}`;
      return s;
    }
    if (s.step === "quest") {
      if (m?.t !== "card" || typeof m.success !== "boolean") return "Deliver or spoil";
      if (!m.success && !isEvil(s.roles[seat])) return "Loyal hands can only deliver";
      s.cards[seat] = m.success;
      delete s.say;
      if (s.team.some(p => s.cards[p] === null)) return s;
      const fails = s.team.filter(p => s.cards[p] === false).length, quest = s.quests[s.q];
      quest.fails = fails;
      quest.result = fails >= (quest.two ? 2 : 1) ? "fail" : "success";
      quest.team = s.team.slice();
      s.log.at(-1).fails = fails;
      s.step = "shown";
      s.show = "quest";
      s.until = now + SHOW_MS;
      s.say = quest.result === "success" ? `The cargo is delivered${fails ? ", though one hand spoiled their share" : ""}.` : `The cargo is lost: ${fails === 1 ? "one hand" : `${fails} hands`} spoiled it.`;
      return s;
    }
    if (s.step === "assassin") {
      const target = Number(m?.seat);
      if (m?.t !== "kill" || !(target >= 0 && target < s.seats) || target === seat) return "Name the one you think is the Lookout";
      if (isEvil(s.roles[target])) return "Name one of the loyal hands";
      s.target = target;
      s.striker = seat;
      const hit = s.roles[target] === "seer";
      return end(s, hit ? "evil" : "good", hit ? "assassin" : "safe");
    }
    return "Wait for the table";
  },

  bot: (s, seat, { level, rng }) => ({ ...questBot(s, seat, level, rng), bot: true }),
  over: s => s.step === "over",
  wakeAt: s => (s.step === "shown" ? s.until : null),

  wake(s) {
    if (s.step !== "shown") return null;
    delete s.until;
    if (s.show === "vote") {
      const last = s.log.at(-1);
      if (last.approved) {
        s.step = "quest";
        s.cards = Object.fromEntries(s.team.map(p => [p, null]));
        s.say = `${names(s.team)}: deliver or spoil, unseen.`;
        return s;
      }
      s.rejects++;
      if (s.rejects >= 5) return end(s, "evil", "rejects");
      s.leader = next(s, s.leader);
      s.step = "propose";
      s.team = [];
      s.say = `The seal passes to {s${s.leader}}: a crew of ${s.quests[s.q].size}.`;
      return s;
    }
    // a quest's end: three either way, or the next
    const won = s.quests.filter(q => q.result === "success").length, lost = s.quests.filter(q => q.result === "fail").length;
    if (lost >= 3) return end(s, "evil", "quests");
    if (won >= 3) {
      if (s.roles.includes("seer") && s.roles.includes("assassin")) {
        s.step = "assassin";
        s.say = "Three cargoes delivered for the Company. But the Vitalians may yet name the Lookout: they confer.";
        return s;
      }
      return end(s, "good", "quests");
    }
    s.q++;
    s.rejects = 0;
    s.leader = next(s, s.leader);
    s.step = "propose";
    s.team = [];
    s.say = `Voyage ${s.q + 1}: a crew of ${s.quests[s.q].size}${s.quests[s.q].two ? " (two spoiled shares lose it)" : ""}. Alderman: {s${s.leader}}.`;
    return s;
  },

  restore(s) {
    const list = v => (v ? Object.values(v) : []);
    s.roles = list(s.roles);
    s.quests = list(s.quests).map(q => ({ ...q, ...(q.team ? { team: list(q.team) } : {}) }));
    s.team = list(s.team);
    s.log = list(s.log).map(l => ({ ...l, team: list(l.team), votes: Array.from({ length: s.seats }, (_, i) => l.votes?.[i] ?? null) }));
    // a vote or a quest with nobody's in yet comes back as nothing at all
    if (s.votes || s.step === "vote") s.votes = Array.from({ length: s.seats }, (_, i) => s.votes?.[i] ?? null);
    if (s.cards || s.step === "quest") s.cards = Object.fromEntries(s.team.map(p => [p, s.cards?.[p] ?? null]));
    if (s.winners) s.winners = list(s.winners);
    s.talk = list(s.talk);
    s.people = Array.from({ length: s.seats }, (_, i) => !!s.people?.[i]);
    return s;
  },
};

/** The game over: the side that won, and why. */
function end(s, side, why) {
  s.step = "over";
  s.side = side;
  s.why = why;
  s.winners = s.roles.map((r, i) => ((side === "evil") === isEvil(r) ? i : -1)).filter(i => i >= 0);
  const seer = s.roles.indexOf("seer");
  s.say = why === "rejects" ? "Five crews refused in a row: the council fails, the season closes and the Vitalians win."
    : why === "quests" ? (side === "evil" ? "Three cargoes lost: the Vitalians win." : "Three cargoes delivered: the Company wins.")
      : why === "assassin" ? `The Vitalians name {s${s.target}}: the Lookout. The Vitalians win.`
        : `The Vitalians name {s${s.target}}, but the Lookout was {s${seer}}. The Company wins.`;
  delete s.until;
  return s;
}
