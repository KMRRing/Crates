// Cards in flight, worked out from the game and nothing else: the difference between the state before a move and the state
// after it says which cards went where (a hand that lost a timber and a hand that gained one: a timber went between them;
// a hand that gained one nobody lost: it came from the bank). Pure, so a test can play it in Node; the page draws the
// flights (factor-fly.js). It never reads the engine's dice or the deck's order: a game reloaded mid-turn has no "before",
// so nothing is replayed (`mark`/`worth` below), and a move seen twice flies once.
//
// What a seat may see: the bank's payouts, trades and a played card are public and fly face up. A card stolen flies face
// down to everyone but the two involved; the cards given up on a 7 are face down to everyone but the one who gave them up;
// a bought development card is face down to everyone but its buyer.
export const MOST_FLIGHTS = 14;                                   // a roll that pays a whole table is a few cards each; more is noise

/** Where the page last drew from: the game's number and the move it had reached. */
export const markOf = G => (G ? { seq: G.seq, n: G.n } : null);
/**
 * Whether the move from the last drawn game to this one is one to show: the same game, a later move. A first view (a page
 * just opened, a table just joined), another game and a game that went backwards (a sync that rewound) show nothing.
 */
export const worth = (last, G) => !!(last && G && last.seq === G.seq && G.n > last.n);

const countKinds = list => { const m = {}; for (const c of list) m[c] = (m[c] || 0) + 1; return m; };
/** The kinds that are in `now` and not in `before` (multiset difference). */
function added(before, now) {
  const have = countKinds(before), out = [];
  for (const c of now) { if (have[c] > 0) have[c]--; else out.push(c); }
  return out;
}

/**
 * The flights from state `a` to state `b` (plain game states, `a` the earlier), as `viewer` (a seat, or null for a watcher)
 * may see them: [{ what: "res" | "dev", kind, from, to, up }], a point being { at: "bank" | "devs" | "seat" | "table" |
 * "fleet", seat }. One card each, in a settled order (resources by kind, then development cards).
 */
export function flightsBetween(a, b, viewer = null) {
  if (!a || !b || a.seats !== b.seats) return [];
  const out = [];
  const seats = b.seats;
  const step = a.step;
  const discard = step === "discard";
  const robbing = step === "blockade" || step === "steal";

  // ----- resources -----
  for (let r = 0; r < 5; r++) {
    const give = [], take = [];                                   // [seat, how many] that lost, that gained
    for (let i = 0; i < seats; i++) {
      const d = b.hand[i][r] - a.hand[i][r];
      if (d < 0) give.push([i, -d]); else if (d > 0) take.push([i, d]);
    }
    const pairs = [];
    for (const g of give) for (const t of take) {
      const n = Math.min(g[1], t[1]);
      for (let k = 0; k < n; k++) pairs.push({ from: { at: "seat", seat: g[0] }, to: { at: "seat", seat: t[0] } });
      g[1] -= n; t[1] -= n;
    }
    for (const g of give) for (let k = 0; k < g[1]; k++) pairs.push({ from: { at: "seat", seat: g[0] }, to: { at: "bank" } });
    for (const t of take) for (let k = 0; k < t[1]; k++) pairs.push({ from: { at: "bank" }, to: { at: "seat", seat: t[0] } });
    for (const p of pairs) {
      const seatToSeat = p.from.at === "seat" && p.to.at === "seat";
      let up = true;
      if (discard && p.to.at === "bank") up = viewer === p.from.seat;
      else if (robbing && seatToSeat) up = viewer === p.from.seat || viewer === p.to.seat;
      out.push({ what: "res", kind: r, ...p, up });
    }
  }

  // ----- development cards -----
  for (let i = 0; i < seats; i++) {
    const drawn = added(a.devs[i], b.devs[i]), gone = added(b.devs[i], a.devs[i]);
    for (const c of drawn) out.push({ what: "dev", kind: c, from: { at: "devs" }, to: { at: "seat", seat: i }, up: viewer === i });
    for (const c of gone) out.push({ what: "dev", kind: c, from: { at: "seat", seat: i }, to: c === "privateer" ? { at: "fleet", seat: i } : { at: "table" }, up: true });
  }
  return out.slice(0, MOST_FLIGHTS);
}
