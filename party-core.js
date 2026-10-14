// Party's engine room: the games, and how one is started and moved on, with no page in it (party.js draws), so the
// tests can play a whole evening in Node. A party game is a module (party-<id>.js) whose default export is
//
//   { id, name, zh?, min, max, blurb, rules: [paragraphs], options: [{ id, label, choices: [[value, text]…], value }],
//     css?: "party-<id>.css" (its own styles, linked by party.js before themes.css),
//     need?(players, options) → what stops it starting, in words, or "" (min and max are checked otherwise),
//     start({ players, options, rng, now }) → state,
//     advance(state, { players, inputs, now, rng }) → { state, say } | null,
//     wakeAt(state) → a time (the database's, ms) to call advance again, or null,
//     view(stage, ctx) }
//
// start and advance are pure: advance runs inside the table's transaction on the device that runs the table (the
// host's phone), on the freshest copy, and may run more than once, so its randomness comes from rng (seeded by the
// game and the table's move number, the same every time). It gathers what the players sent (inputs: their votes,
// clues, guesses, each tagged with the step it was for) and moves the game on, or says nothing changed (null). What
// a player does on their own turn (I've said mine) can instead go straight into the state (ctx.act in party.js).
// players: [{ uid, pid, name, seat }] in seat order, the people at the table now.
import undercover from "./party-undercover.js";
import whoami from "./party-whoami.js";

/** The games, in the order the lobby lists them. */
export const GAMES = [undercover, whoami];
export const gameById = id => GAMES.find(g => g.id === id) || null;

/** A seeded generator (mulberry32): the same seed gives the same numbers, on every device and every retry. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A list shuffled by rng (Fisher–Yates: every order equally likely). */
export function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** The people at the table as a game sees them. */
export const playersOf = branch => Object.entries(branch?.players || {}).filter(([, p]) => p && Number.isInteger(p.seat))
  .map(([uid, p]) => ({ uid, pid: p.pid || uid, name: p.name, seat: p.seat, online: p.online !== false }))
  .sort((a, b) => a.seat - b.seat);

/** What the players sent for this step of this game: { uid: input }, the stale ones (an earlier step) left out. */
export function inputsFor(branch, step) {
  const out = {}, seq = branch?.game?.seq;
  for (const [uid, v] of Object.entries(branch?.inputs || {})) if (v && v.seq === seq && v.step === step) out[uid] = v;
  return out;
}

/** A game's options as chosen, each one it has filled in with its default. */
export const optionsOf = (game, options = {}) => Object.fromEntries((game.options || []).map(o => [o.id, options[o.id] ?? o.value]));

/**
 * What stops a game starting with these players and options, in words ("Undercover needs 3 players: 1 more to
 * join"), or "" when it can start. A game with computer players to fill its seats says so with its own need().
 */
export function needOf(game, players, options = {}) {
  if (!game) return "That game isn't in this version";
  if (game.need) return game.need(players, optionsOf(game, options)) || "";
  const n = players.length;
  if (n < game.min) return `${game.name} needs ${game.min} players: ${game.min - n} more to join`;
  if (n > game.max) return `${game.name} takes at most ${game.max}`;
  return "";
}

/** Starts a game at the table (inside a transaction on the branch): false if it can't start (too few players). */
export function startGame(branch, id, options = {}, now = Date.now()) {
  const game = gameById(id), players = playersOf(branch);
  if (!game || needOf(game, players, options)) return false;
  const seq = (branch.game?.seq || branch.played || 0) + 1, seed = (Math.random() * 2 ** 32) >>> 0;
  const opts = optionsOf(game, options);
  const state = game.start({ players, options: opts, rng: seeded(seed), now });
  if (!state) return false;
  branch.game = { id, seq, seed, options: opts, state, started: now };
  branch.played = seq;
  delete branch.inputs;
  if (state.say) { branch.say = { n: (branch.say?.n || 0) + 1, text: state.say, lang: "en-GB", at: now }; delete state.say; }
  return true;
}

/**
 * Moves the game on (inside a transaction on the branch, on the device that runs the table): the game's advance on the
 * freshest copy; false when there's nothing to do. Inputs it has used are cleared with the step they were for.
 */
export function advanceGame(branch, now = Date.now()) {
  const g = branch?.game, game = gameById(g?.id);
  if (!g || !game) return false;
  const step = g.state?.step;
  const inputs = inputsFor(branch, step);
  const r = game.advance(g.state, { players: playersOf(branch), inputs, now, rng: seeded((g.seed ^ Math.imul(branch.rev || 0, 2654435761)) >>> 0) });
  if (!r || !r.state) return false;
  g.state = r.state;
  if (r.state.step !== step) delete branch.inputs;               // what was sent for the step just closed
  if (r.say) branch.say = { n: (branch.say?.n || 0) + 1, text: r.say, lang: r.lang || "en-GB", at: now };
  // a game over: its winners' wins counted for the evening, by player (a player's other device is the same player)
  if (r.state.step === "over" && Array.isArray(r.state.winners) && !g.tallied) {
    const pidOf = Object.fromEntries(playersOf(branch).map(p => [p.uid, p.pid]));
    branch.tally ||= {};
    for (const u of r.state.winners) { const pid = pidOf[u] || u; branch.tally[pid] = (branch.tally[pid] || 0) + 1; }
    g.tallied = true;
  }
  return true;
}

/** Ends the game in progress, back to the lobby (the host's "Choose another game"). */
export function endGame(branch) {
  if (!branch.game) return false;
  delete branch.game;
  delete branch.inputs;
  return true;
}
