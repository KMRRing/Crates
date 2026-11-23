// L'Attaque's Hard computer: Ataraxos's trained policy (attaque-net.js) choosing among the side's moves from what the side knows
// (attaque-sight.js replays the game from where the armies stood when play began, the state's at0). It plays as it was trained to:
// a move drawn from the policy's odds, the long shots (under one in a hundred) left out, as Ataraxos's own ThresholdModel does
// (pyengine/networks/wrappers.py); a policy that mixes its moves can't be read. The coach takes the likeliest move instead.
import { createSight } from "./attaque-sight.js";
import { KCH, positionOf, movesOf, bannedOf } from "./attaque-board.js";

const LONG_SHOT = 0.01;

/** The game so far as the network reads it, or null for a game begun before the state kept at0. */
export function sightOf(s) {
  if (!s.at0 || s.phase !== "play") return null;
  const kinds = [...s.pk].map(c => KCH.indexOf(c));
  const start = Array.from({ length: s.pk.length }, (_, i) => { const v = s.at0.slice(2 * i, 2 * i + 2); return v === "--" ? -1 : Number(v); });
  const sight = createSight(kinds, start);
  for (const m of s.moves) sight.play(Math.floor(m / 100), m % 100);
  return sight;
}

/**
 * The move for the side to move: { code, odds (of each legal move, in movesOf's order), legal, value ([lose, draw, win] for the
 * side) }, or null when the network can't read this game. best: the likeliest move rather than a draw from the odds.
 */
export function deepMove(net, s, { rng = Math.random, best = false } = {}) {
  const sight = sightOf(s);
  if (!sight) return null;
  const p = positionOf(s), legal = movesOf(p, s.t, bannedOf(s.moves));
  if (!legal.length) return null;
  const { logits, value } = net.forward(sight.features());
  const ls = legal.map(m => { const [a, b] = sight.cells(Math.floor(m / 100), m % 100); return logits[a * 92 + b]; });
  const top = Math.max(...ls), w = ls.map(l => Math.exp(l - top)), sum = w.reduce((a, b) => a + b, 0), odds = w.map(x => x / sum);
  const out = { odds, legal, value: value.map(Math.exp) };
  if (best) return { ...out, code: legal[odds.indexOf(Math.max(...odds))] };
  const kept = odds.map(o => (o >= LONG_SHOT ? o : 0)), total = kept.reduce((a, b) => a + b, 0);
  let x = rng() * total;
  for (let i = 0; i < legal.length; i++) if (kept[i] > 0 && (x -= kept[i]) <= 0) return { ...out, code: legal[i] };
  return { ...out, code: legal[odds.indexOf(Math.max(...odds))] };
}
