// Cabal's 3D table, the part with no picture in it (party-coup-3d.js draws): what the table shows as plain data, where each
// seat stands on an oval table, and which view the player has chosen. Node loads it (tests/party-coup-3d.mjs).
import { defaultIs3D } from "./mode3d.js";

const KEY = "party:coup-view";
const lasts = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
/** The view a pick in the menu saved, else the suite's default (Settings, "2D mode (battery saver)"). A watching frame always draws flat. */
export function wants3D() {
  try { const p = new URLSearchParams(location.search); if (p.has("watch") && p.has("frame")) return false; } catch { /* no address in Node */ }
  const v = lasts();
  return v === "3d" ? true : v === "flat" ? false : defaultIs3D();
}
/** Only an explicit pick is written: the default must stay the setting's to change. */
export function pick3D(on) { try { localStorage.setItem(KEY, on ? "3d" : "flat"); } catch { /* private mode */ } }

/**
 * What the table shows, from the game's state and the seat looking at it. `hidden`: this player has tapped their cards face
 * down. Seats come in play order from your own (the next one on your left, as at a real table); a player watching, not seated,
 * sees the first seat at the foot.
 */
export function sceneOf(s, meUid, { hidden = false, names = {} } = {}) {
  const hand = u => s.hand?.[u] || [], dead = u => s.dead?.[u] || [];
  const i0 = Math.max(0, s.seats.indexOf(meUid)), n = s.seats.length;
  const order = Array.from({ length: n }, (_, k) => s.seats[(i0 + k) % n]);
  const over = s.phase === "over";
  return {
    over,
    seats: order.map(u => ({
      uid: u, name: names[u] || s.names?.[u] || "Someone", me: u === meUid, coins: s.coins?.[u] ?? 0, cards: hand(u).length,
      dead: [...dead(u)], mine: u === meUid && !hidden ? [...hand(u)] : null,
      out: hand(u).length === 0, turn: !over && hand(u).length > 0 && u === s.turn, target: !over && s.act?.target === u, won: over && s.won === u,
    })),
    deck: s.deck?.length ?? 0,
    claim: !over && s.claim ? { by: s.claim.by, card: s.claim.card, block: s.claim.on === "block" } : null,
  };
}

/** A signature of everything the picture draws, so an unchanged table is not rebuilt. */
export const signature = t => JSON.stringify([t.over, t.deck, t.claim, t.seats.map(p => [p.uid, p.name, p.coins, p.cards, p.dead, p.mine, p.turn, p.target, p.won])]);

/**
 * Where each seat stands, from the foot (slot 0: you), going round to the left. The table is an oval as wide as the room
 * allows (`aspect`, the picture's width over its height). `out` is the way a player faces the middle's opposite: the angle to
 * turn a seat by, so its cards' tops point to the centre.
 */
export const RZ = 1.95;
export function seatSpots(n, aspect = 1.6) {
  const rz = RZ, rx = Math.max(2.7, Math.min(6.4, rz * aspect * 0.8));
  return Array.from({ length: n }, (_, k) => {
    const th = (2 * Math.PI * k) / n, x = -Math.sin(th) * rx, z = Math.cos(th) * rz;
    return { x, z, turn: Math.atan2(x / (rx * rx), z / (rz * rz)), rx, rz };
  });
}

/** How many coin stacks n coins make (six to a stack) and where stack j stands in a seat's own frame: two columns. */
export const STACK = 6;
export const stacks = n => Math.ceil(Math.max(0, n) / STACK);
export const stackAt = j => ({ x: 1.02 + (j % 2) * 0.38, z: -0.2 + Math.floor(j / 2) * 0.38 });
