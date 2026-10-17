// Slipway's rules, pure (no page): a shipyard of six squares by five in front of a slipway. Each turn a part comes to
// hand (the next one shown), and you lay it on any empty square of the yard. Three or more alike (the same kind of part
// at the same stage) joined along their sides are put together into one part of the next stage, on the square the part
// was laid, and that one can make three with its own kind and go on up: three planks make a strake, three strakes a
// hull section. A part at the third stage is a component (a hull section, a rigged mast, a suit of sails, a gun…), and
// it's fitted to the ship on the slipway when she still needs one of its kind; otherwise it waits in the yard for a ship
// that will. A ship with all she needs is launched and the next laid down, bigger and later in history, from a Hanseatic
// cog to a VLCC, and a ship needing more kinds of part makes the yard harder to keep tidy. A hold keeps one part aside
// (swap the part in hand with it any time); now and then a blueprint comes, which becomes whatever part makes the
// biggest merge where it's laid. A yard with no empty square ends the game. The page (slipway.js) draws it;
// tests/slipway.mjs checks this.
//
// A game is one object, as saved: { v, seed, n (draws made), cells (a part's code, or -1 empty: row by row from the
// slipway forward, each from the left), hand, next, hold (a code, BLUEPRINT, or null), ship (how many laid down before
// this one), fitted (what she has of each kind), launched, turns, score, over }.

export const W = 6, H = 5, GROUP = 3, STAGES = 3, KINDS = 5, BLUEPRINT = 99, EMPTY = -1;
/** A part's code: its kind (0–4) and stage (1–3), and back. */
export const code = (kind, stage) => kind * 4 + stage;
export const kindOf = c => c >> 2;
export const stageOf = c => c & 3;
// what comes to hand: a stage-two part so often, a blueprint so often, else a stage-one part
export const DEAL = { stage2: .15, blueprint: .03 };

// The ships, in order, and what each needs of each kind of part. Under sail the kinds are the hull, masts, sails and
// guns; under power the hull, funnels, engines, deckhouses and screws (the yard's parts are the same five kinds, made
// in iron and steel from the screw steamer on). After the VLCC every ship is another VLCC.
export const SHIPS = [
  { id: "cog", name: "Cog", year: "c. 1300", needs: [1, 1, 1, 0, 0], note: "The Hanse's ship: one mast, one square sail, a castle at the stern" },
  { id: "hulk", name: "Hulk", year: "c. 1400", needs: [2, 1, 1, 0, 0], note: "The round-bellied ship that took over the Hanse's trade from the cog" },
  { id: "caravel", name: "Caravel", year: "c. 1450", needs: [1, 2, 1, 0, 0], note: "Portugal's explorer: lateen sails that could beat into the wind" },
  { id: "carrack", name: "Carrack", year: "c. 1500", needs: [1, 1, 2, 1, 0], note: "Three masts and high castles fore and aft, like the Santa María" },
  { id: "galleon", name: "Galleon", year: "c. 1580", needs: [1, 1, 1, 2, 0], note: "Longer and lower than a carrack, with a beak and decks of guns" },
  { id: "fluyt", name: "Fluyt", year: "c. 1600", needs: [2, 1, 2, 0, 0], note: "The Dutch carrier: a pear-shaped hull, its narrow deck paying less toll at the Sound" },
  { id: "indiaman", name: "East Indiaman", year: "c. 1750", needs: [2, 1, 1, 1, 0], note: "The VOC's and the East India Company's armed merchantman" },
  { id: "clipper", name: "Clipper", year: "c. 1860", needs: [1, 2, 2, 0, 0], note: "Built for speed in the tea trade, like the Cutty Sark" },
  { id: "steamer", name: "Screw steamer", year: "1843", needs: [2, 1, 1, 1, 1], note: "Iron hull, steam engine and a screw, like the SS Great Britain" },
  { id: "liner", name: "Liner", year: "c. 1910", needs: [2, 2, 1, 2, 1], note: "Four funnels and a city's worth of decks, like the Lusitania" },
  { id: "vlcc", name: "VLCC", year: "c. 1970", needs: [3, 1, 1, 1, 1], note: "A very large crude carrier: two million barrels in one hull" },
];
export const shipAt = i => SHIPS[Math.min(i, SHIPS.length - 1)];
const STEAM = SHIPS.findIndex(s => s.id === "steamer");
/** Under sail (the first eight ships) or under power. */
export const powered = i => i >= STEAM;
export const PARTS = {
  sail: [["plank", "strake", "hull section"], ["spar", "made mast", "rigged mast"], ["bolt of canvas", "sail", "suit of sails"], ["pig of iron", "barrel", "gun"], [null, null, null]],
  power: [["plate", "strake", "hull block"], ["ring", "funnel section", "funnel"], ["cylinder", "boiler", "engine"], ["panel", "cabin", "deckhouse"], ["blade", "propeller", "screw"]],
};
/** A part's name in the era of ship i. */
export const partName = (c, i) => (c === BLUEPRINT ? "blueprint" : PARTS[powered(i) ? "power" : "sail"][kindOf(c)][stageOf(c) - 1]);
/** The points for a merge, a component fitted and a ship launched. */
export const points = {
  merge: (parts, stage, step) => 10 * parts * stage * step,
  fit: 100,
  launch: ship => 250 * shipAt(ship).needs.reduce((a, b) => a + b, 0),
};

function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
/** What the ship on the slipway still needs of each kind. */
export const needs = s => shipAt(s.ship).needs.map((n, k) => n - s.fitted[k]);
// a part to hand: the kinds she's built of, those she still needs most more often (each at least now and then)
function dealOne(s) {
  if (draw(s.seed, s.n++) < DEAL.blueprint) return BLUEPRINT;
  const want = shipAt(s.ship).needs, left = needs(s), weights = want.map((n, k) => (n ? Math.max(1, left[k]) : 0));
  let r = draw(s.seed, s.n++) * weights.reduce((a, b) => a + b, 0), kind = 0;
  for (; kind < KINDS - 1; kind++) if ((r -= weights[kind]) < 0) break;
  while (!weights[kind]) kind--;
  return code(kind, draw(s.seed, s.n++) < DEAL.stage2 ? 2 : 1);
}

/** A new game from a seed: an empty yard, a cog laid down and a part in hand. */
export function newGame(seed) {
  const s = { v: 1, seed: seed >>> 0, n: 0, cells: new Array(W * H).fill(EMPTY), hand: 0, next: 0, hold: null, ship: 0, fitted: new Array(KINDS).fill(0), launched: 0, turns: 0, score: 0, over: false };
  s.hand = dealOne(s);
  s.next = dealOne(s);
  return s;
}

const NEIGHBOURS = Array.from({ length: W * H }, (_, i) => {
  const x = i % W, y = Math.floor(i / W), out = [];
  if (y > 0) out.push(i - W);
  if (x > 0) out.push(i - 1);
  if (x < W - 1) out.push(i + 1);
  if (y < H - 1) out.push(i + W);
  return out;
});
export const neighbours = i => NEIGHBOURS[i];
/** The squares joined to square i along their sides holding the same part as it, i first. */
export function group(cells, i) {
  const c = cells[i], out = [i], seen = new Set(out);
  for (let k = 0; k < out.length; k++) for (const n of NEIGHBOURS[out[k]]) if (!seen.has(n) && cells[n] === c) { seen.add(n); out.push(n); }
  return out;
}
/** What a blueprint laid on square i becomes: the part beside it that would make the biggest merge, the highest stage
 *  first, or a first-stage part of the kind the ship needs most. */
export function blueprintAt(s, i) {
  const cells = s.cells.slice(), tried = new Set();
  let best = null;
  for (const n of NEIGHBOURS[i]) {
    const c = cells[n];
    if (c === EMPTY || tried.has(c) || stageOf(c) >= STAGES) continue;
    tried.add(c);
    cells[i] = c;
    const size = group(cells, i).length;
    if (size >= GROUP && (!best || stageOf(c) > stageOf(best.c) || (stageOf(c) === stageOf(best.c) && size > best.size))) best = { c, size };
  }
  if (best) return best.c;
  const left = needs(s);
  let kind = 0;
  for (let k = 1; k < KINDS; k++) if (left[k] > left[kind]) kind = k;
  return code(kind, 1);
}

// fits every component in the yard the ship still needs, launching her (and the next, and so on) when she's complete
function fitFromYard(s, steps) {
  for (;;) {
    const left = needs(s);
    for (let i = 0; i < s.cells.length; i++) {
      const c = s.cells[i];
      if (c !== EMPTY && stageOf(c) === STAGES && left[kindOf(c)] > 0) {
        left[kindOf(c)]--;
        s.fitted[kindOf(c)]++;
        s.cells[i] = EMPTY;
        s.score += points.fit;
        steps.push({ type: "fit", at: i, part: c, ship: s.ship });
      }
    }
    if (needs(s).some(n => n > 0)) return;
    s.score += points.launch(s.ship);
    steps.push({ type: "launch", ship: s.ship, gain: points.launch(s.ship) });
    s.launched++;
    s.ship++;
    s.fitted = new Array(KINDS).fill(0);
    steps.push({ type: "lay", ship: s.ship });
  }
}

/**
 * Lays the part in hand on square i: the game after it, and what happened, in order, for the page to play out:
 * steps ({ type: "lay"… }: "place" { at, part }, "merge" { at, from, part, gain }, "fit" { at, part, ship },
 * "launch" { ship, gain }, "lay" { ship }), gain, over. Pure; throws if the square isn't empty or the game is over.
 */
export function place(game, i) {
  const s = structuredClone(game);
  if (s.over || !(i >= 0 && i < W * H) || s.cells[i] !== EMPTY) throw new Error("not there");
  const before = s.score, steps = [];
  const part = s.hand === BLUEPRINT ? blueprintAt(s, i) : s.hand;
  s.cells[i] = part;
  steps.push({ type: "place", at: i, part, blueprint: s.hand === BLUEPRINT });
  for (let step = 1; stageOf(s.cells[i]) < STAGES; step++) {
    const g = group(s.cells, i);
    if (g.length < GROUP) break;
    const made = s.cells[i] + 1, gain = points.merge(g.length, stageOf(made), step);
    for (const j of g) s.cells[j] = EMPTY;
    s.cells[i] = made;
    s.score += gain;
    steps.push({ type: "merge", at: i, from: g, part: made, gain });
  }
  fitFromYard(s, steps);
  s.turns++;
  s.hand = s.next;
  s.next = dealOne(s);
  s.over = !s.cells.includes(EMPTY);
  return { state: s, steps, gain: s.score - before, over: s.over };
}
/** Swaps the part in hand with the one in the hold (an empty hold takes it, and the next part comes to hand). Pure. */
export function swap(game) {
  const s = structuredClone(game);
  if (s.over) throw new Error("the game is over");
  if (s.hold === null) { s.hold = s.hand; s.hand = s.next; s.next = dealOne(s); }
  else [s.hand, s.hold] = [s.hold, s.hand];
  return s;
}
/** Every square a part can go: the empty ones. */
export const moves = s => s.cells.flatMap((c, i) => (c === EMPTY ? [i] : []));
/** How many squares are taken. */
export const taken = s => s.cells.filter(c => c !== EMPTY).length;
