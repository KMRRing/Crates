// Which sounds a move calls for, worked out (like the flights, factor-flights.js) from the game before it and after it and
// nothing else, so a page opened mid-turn plays nothing and a move seen twice sounds once. Pure, so a test can play it in
// Node; the voices are factor-sound.js's. `mine` says whether the move is the viewer's own (a computer's or a rival's sounds
// are played softer than yours).
import { toMove } from "./factor-rules.js";

export const SOUND_KEY = "suite:factor-sound";                    // a suite: key: whether sound plays is this device's (a phone in a pocket, a laptop in a library)
export const MOST_CUES = 4;                                        // a move sounds at most this many things at once

/** Whether sound is on: the saved choice, on when nothing is saved. `storage` is localStorage (or a stand-in that may throw). */
export function readOn(storage) { try { return JSON.parse(storage.getItem(SOUND_KEY)) !== false; } catch { return true; } }
export function keepOn(storage, on) { try { storage.setItem(SOUND_KEY, JSON.stringify(!!on)); } catch { /* private mode */ } }

/**
 * The sounds from game state `a` to state `b` (a the earlier), as `viewer` (a seat, or null for a watcher) hears them:
 * [{ name, mine, ... }] in the order they should sound. Names: dice (total), road, post, factory, blockade, steal, card,
 * trade, title, turn, win, lose, and bell (an offer to you: `ask`; the answers to yours: not `ask`).
 */
export function cuesBetween(a, b, viewer = null) {
  if (!a || !b || a.seats !== b.seats) return [];
  const out = [], mover = b.turn === viewer, add = (name, extra = {}) => out.push({ name, mine: mover, ...extra });

  if (a.step === "roll" && b.step !== "roll" && !(b.step === "blockade" && b.back === "roll")) add("dice", { total: b.roll[0] + b.roll[1] });
  for (let i = 0; i < b.eo.length; i++) if (!a.eo[i] && b.eo[i]) out.push({ name: "road", mine: b.eo[i] - 1 === viewer });
  for (let i = 0; i < b.vo.length; i++) {
    if (!a.vo[i] && b.vo[i]) out.push({ name: "post", mine: b.vo[i] - 1 === viewer });
    else if (a.vl[i] === 1 && b.vl[i] === 2) out.push({ name: "factory", mine: b.vo[i] - 1 === viewer });
  }
  if (a.robber !== b.robber) add("blockade");
  if (b.say !== a.say && /took a card from/.test(b.say)) add("steal");
  if (a.deck.length > b.deck.length || (b.playedDev && !a.playedDev)) add("card");
  if (b.say !== a.say && /\btraded\b/.test(b.say)) add("trade");
  if (b.longest !== a.longest && b.longest >= 0) out.push({ name: "title", mine: b.longest === viewer });
  if (b.army !== a.army && b.army >= 0) out.push({ name: "title", mine: b.army === viewer });
  if (b.step === "over" && a.step !== "over") out.push({ name: b.winner === viewer ? "win" : "lose", mine: true });
  else if (viewer != null && b.turn === viewer && a.turn !== viewer) out.push({ name: "turn", mine: true });

  // a bell for an offer that has come to you, and for the answers to yours
  if (viewer != null) {
    if (b.step === "offer" && toMove(b) === viewer && !(a.step === "offer" && toMove(a) === viewer)) out.push({ name: "bell", mine: true, ask: true });
    else if (b.step === "pick" && a.step !== "pick" && b.offer?.from === viewer) out.push({ name: "bell", mine: true });
  }
  const end = out.filter(c => c.name === "win" || c.name === "lose");           // the game's end is never the one cut
  return [...out.filter(c => !end.includes(c)).slice(0, MOST_CUES - end.length), ...end];
}
