// Patience for one: the rules of Klondike (draw one or three), FreeCell and Spider (one, two or four suits), apart from
// any page so the tests run them in Node. The state is plain JSON, a deal is a shuffled list of the cards (from a seed:
// the same deal on every device), and a game in play is the deal and the list of moves made, so undo is "play the list
// again without the last move" (replay) and the saved game is a few hundred numbers.
//
// A card is a number. Klondike and FreeCell: 0-51, `suit * 13 + rank` (rank 0 the ace to 12 the king; suits 0-3 are
// ♦ ♣ ♥ ♠ as cards.js has them, so red is an even suit). Spider has 104 cards: card `k` is rank `k % 13` of suit slot
// `floor(k / 13) % 4`, and the slot's suit depends on how many suits are in play, so a one-suit game is spades eight
// times over and a card is still one number.
//
// A place is `kind * 16 + index` (TAB a column, FND a foundation by suit, WST the waste, STK the stock, CEL a free
// cell); a move is { f (from), t (to), n (how many cards) }, and packs into one number for the saved list.
//
// Rules (Klondike and FreeCell as Microsoft's collection and Wikipedia's "Klondike (solitaire)", "FreeCell" and
// "Spider (solitaire)" give them): see docs/solitaire.md for the choices where sets differ.

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const SUIT_NAMES = ["diamonds", "clubs", "hearts", "spades"];
export const SUIT_MARKS = ["♦", "♣", "♥", "♠"];

/** The six games: id → what they are. `deal` is how many cards a draw turns (Klondike), `suits` the suits in play (Spider). */
export const VARIANTS = {
  klondike1: { game: "klondike", draw: 1, name: "Klondike", sub: "draw one", cards: 52, cols: 7 },
  klondike3: { game: "klondike", draw: 3, name: "Klondike", sub: "draw three", cards: 52, cols: 7 },
  freecell: { game: "freecell", name: "FreeCell", sub: "", cards: 52, cols: 8 },
  spider1: { game: "spider", suits: 1, name: "Spider", sub: "one suit", cards: 104, cols: 10 },
  spider2: { game: "spider", suits: 2, name: "Spider", sub: "two suits", cards: 104, cols: 10 },
  spider4: { game: "spider", suits: 4, name: "Spider", sub: "four suits", cards: 104, cols: 10 },
};
export const IDS = Object.keys(VARIANTS);
/** Whether a game's deals are checked by the solver, so each can be won (solitaire-solver.js `certifies`; tests/solitaire.mjs keeps the two alike). Four-suit Spider's are the shuffle as it falls. */
export const CHECKED = id => id !== "spider4";
export const titleOf = id => `${VARIANTS[id].name}${VARIANTS[id].sub ? ` · ${VARIANTS[id].sub}` : ""}`;

// ---------- cards ----------
const SPIDER_SUITS = { 1: [3, 3, 3, 3], 2: [3, 2, 3, 2], 4: [3, 2, 1, 0] };
const TABLES = {};
/** { rank, suit } by card number for a game (typed arrays; built once). */
export function tableOf(id) {
  if (TABLES[id]) return TABLES[id];
  const V = VARIANTS[id], rank = new Uint8Array(V.cards), suit = new Uint8Array(V.cards);
  for (let k = 0; k < V.cards; k++) {
    rank[k] = k % 13;
    const slot = Math.floor(k / 13) % 4;
    suit[k] = V.game === "spider" ? SPIDER_SUITS[V.suits][slot] : slot;
  }
  return (TABLES[id] = { rank, suit });
}
export const faceOf = (id, c) => { const T = tableOf(id); return { rank: RANKS[T.rank[c]], suit: T.suit[c] }; };
export const cardName = (id, c) => { const f = faceOf(id, c); return `${f.rank} of ${SUIT_NAMES[f.suit]}`; };
export const cardShort = (id, c) => { const f = faceOf(id, c); return `${f.rank}${SUIT_MARKS[f.suit]}`; };
const isRed = s => (s & 1) === 0;

// ---------- places and moves ----------
export const TAB = 0, FND = 1, WST = 2, STK = 3, CEL = 4;
export const place = (kind, i = 0) => kind * 16 + i;
export const kindOf = p => p >> 4;
export const indexOf = p => p & 15;
export const pack = (m, auto = false) => m.f | (m.t << 7) | (m.n << 14) | (auto ? 1 << 19 : 0);
export const unpack = x => ({ f: x & 127, t: (x >> 7) & 127, n: (x >> 14) & 31, auto: !!(x & (1 << 19)) });
const same = (a, b) => a.f === b.f && a.t === b.t && a.n === b.n;

// ---------- the seed ----------
/** A string as a 32-bit number (xmur3), then a stream of numbers in [0, 1) from it (mulberry32). */
export function rngOf(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) { h = Math.imul(h ^ text.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16;
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** The cards of a game in a shuffled order: the same for the same game, key (a day, a seed) and try. */
export function shuffled(id, key, tryNo = 0) {
  const rnd = rngOf(`${id}|${key}|${tryNo}`), a = Array.from({ length: VARIANTS[id].cards }, (_, k) => k);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- a new game ----------
/**
 * The game dealt from an order of the cards (all of them, once each). Klondike: columns of 1 to 7 with the last face
 * up, the rest the stock. FreeCell: eight columns (four of seven, four of six), all face up. Spider: ten columns (four
 * of six, six of five), the last face up, the rest the stock (five deals of ten).
 * { v, cols (bottom to top), down (cards face down at the foot of each), stock (the end is its top), waste, cells, found,
 * runs (Spider: the thirteen cards of each run taken off, king first) }.
 */
export function newGame(id, order) {
  const V = VARIANTS[id], s = { v: id, cols: [], down: [], stock: [], waste: [], cells: [], found: [], runs: [] };
  let at = 0;
  const take = n => { const out = order.slice(at, at + n); at += n; return out; };
  if (V.game === "klondike") {
    for (let i = 0; i < 7; i++) { s.cols.push(take(i + 1)); s.down.push(i); }
    s.stock = take(24).reverse();                              // the first dealt is on top
    s.found = [0, 0, 0, 0];
  } else if (V.game === "freecell") {
    for (let i = 0; i < 8; i++) { s.cols.push(take(i < 4 ? 7 : 6)); s.down.push(0); }
    s.cells = [-1, -1, -1, -1];
    s.found = [0, 0, 0, 0];
  } else {
    for (let i = 0; i < 10; i++) { const n = i < 4 ? 6 : 5; s.cols.push(take(n)); s.down.push(n - 1); }
    s.stock = take(50).reverse();
  }
  return s;
}
export const cloneGame = s => ({ v: s.v, cols: s.cols.map(c => c.slice()), down: s.down.slice(), stock: s.stock.slice(), waste: s.waste.slice(), cells: s.cells.slice(), found: s.found.slice(), runs: s.runs.slice() });   // a run taken off is never changed again, so the lists can be shared
/** Whether the card at index k of column i is face up. */
export const faceUp = (s, i, k) => k >= s.down[i];
export const won = s => (VARIANTS[s.v].game === "spider" ? s.runs.length === 8 : s.found[0] + s.found[1] + s.found[2] + s.found[3] === 52);
export const onFoundation = s => (VARIANTS[s.v].game === "spider" ? s.runs.length * 13 : s.found[0] + s.found[1] + s.found[2] + s.found[3]);

// ---------- the rules ----------
/** The longest run (cards that move together) at the top of a column: face up, each one lower than the one below it, alternating colours (Klondike, FreeCell) or the same suit (Spider). */
export function maxRun(s, i) {
  const col = s.cols[i], T = tableOf(s.v), spider = VARIANTS[s.v].game === "spider";
  let n = 0;
  for (let k = col.length - 1; k >= s.down[i]; k--) {
    if (n) {
      const above = col[k + 1], c = col[k];
      if (T.rank[c] !== T.rank[above] + 1) break;
      if (spider ? T.suit[c] !== T.suit[above] : isRed(T.suit[c]) === isRed(T.suit[above])) break;
    }
    n++;
  }
  return n;
}
const emptyCols = s => s.cols.reduce((n, c) => n + (c.length ? 0 : 1), 0);
const freeCells = s => s.cells.reduce((n, c) => n + (c < 0 ? 1 : 0), 0);
/** How many cards FreeCell can carry to a column at once, through the free cells and empty columns (an empty column it's going to doesn't help). */
export function capacity(s, toEmpty) {
  return (freeCells(s) + 1) * 2 ** (emptyCols(s) - (toEmpty ? 1 : 0));
}

/** The cards a move would carry (bottom to top), or null if there is no such source. */
export function cardsAt(s, f, n) {
  const k = kindOf(f), i = indexOf(f);
  if (k === TAB) { const col = s.cols[i]; return col && n >= 1 && n <= col.length ? col.slice(col.length - n) : null; }
  if (n !== 1) return null;
  if (k === WST) return s.waste.length ? [s.waste[s.waste.length - 1]] : null;
  if (k === CEL) return s.cells[i] >= 0 ? [s.cells[i]] : null;
  if (k === FND) return s.found[i] ? [i * 13 + s.found[i] - 1] : null;
  return null;
}
/** Why a move can't be made (a sentence for the player), or null if it can. Draws, recycles and deals are moves too. */
export function whyNot(s, m) {
  const V = VARIANTS[s.v], T = tableOf(s.v), fk = kindOf(m.f), tk = kindOf(m.t), fi = indexOf(m.f), ti = indexOf(m.t);
  if (V.game === "klondike" && fk === STK && tk === WST) return s.stock.length && m.n === Math.min(V.draw, s.stock.length) ? null : "The stock is empty.";
  if (V.game === "klondike" && fk === WST && tk === STK) return !s.stock.length && s.waste.length && m.n === s.waste.length ? null : "The stock isn't empty.";
  if (V.game === "spider" && fk === STK && tk === STK) {
    if (s.stock.length < 10) return "The stock is empty.";
    return s.cols.some(c => !c.length) ? "Fill every column before you deal." : null;
  }
  if (fk === STK || tk === STK || tk === WST) return "That isn't a move.";
  if (fk === FND && V.game !== "klondike") return "A card on the foundation stays there.";
  const cards = cardsAt(s, m.f, m.n);
  if (!cards) return "There is nothing there to move.";
  if (fk === TAB) {
    if (m.n > maxRun(s, fi)) return V.game === "spider" ? "Only a run of one suit, each a rank below the last, moves together." : "Only a run, each card a rank below the last and the other colour, moves together.";
  }
  const lead = cards[0];
  if (tk === FND) {
    if (V.game === "spider") return "That isn't a move.";
    if (m.n !== 1) return "Only one card goes up at a time.";
    if (T.suit[lead] !== ti) return `The ${SUIT_NAMES[ti]} foundation takes ${SUIT_NAMES[ti]} only.`;
    return s.found[ti] === T.rank[lead] ? null : s.found[ti] === 0 ? "A foundation starts with an ace." : `The ${SUIT_NAMES[ti]} foundation wants the ${RANKS[s.found[ti]]} next.`;
  }
  if (tk === CEL) {
    if (m.n !== 1) return "A free cell holds one card.";
    return s.cells[ti] < 0 && !(fk === CEL && fi === ti) ? null : "That free cell is taken.";
  }
  if (tk !== TAB || !s.cols[ti]) return "That isn't a move.";
  if (fk === TAB && fi === ti) return "That is where it is.";
  const col = s.cols[ti];
  if (V.game === "freecell" && m.n > capacity(s, !col.length)) return `With ${freeCells(s)} free cell${freeCells(s) === 1 ? "" : "s"} and ${emptyCols(s) - (col.length ? 0 : 1)} empty column${emptyCols(s) - (col.length ? 0 : 1) === 1 ? "" : "s"} you can carry ${capacity(s, !col.length)} at a time.`;
  if (!col.length) return V.game === "klondike" && T.rank[lead] !== 12 ? "Only a king goes in an empty column." : null;
  const top = col[col.length - 1];
  if (T.rank[lead] === 12) return "A king goes only in an empty column.";
  if (T.rank[top] !== T.rank[lead] + 1) return `It needs ${/^[A8]/.test(RANKS[T.rank[lead] + 1]) ? "an" : "a"} ${RANKS[T.rank[lead] + 1]} to go on.`;
  if (V.game !== "spider" && isRed(T.suit[top]) === isRed(T.suit[lead])) return "It goes on the other colour.";
  return null;
}
export const legal = (s, m) => whyNot(s, m) === null;

/** Every move there is, in a plain order: the stock, the waste, the free cells, the columns, the foundations. */
export function moves(s) {
  const V = VARIANTS[s.v], out = [], seen = [];
  const add = (f, t, n) => { const m = { f, t, n }; if (legal(s, m)) out.push(m); };
  if (V.game === "klondike") {
    if (s.stock.length) add(place(STK), place(WST), Math.min(V.draw, s.stock.length));
    else if (s.waste.length) add(place(WST), place(STK), s.waste.length);
  } else if (V.game === "spider") add(place(STK), place(STK), 10);
  const sources = [];
  if (V.game === "klondike" && s.waste.length) sources.push([place(WST), 1]);
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] >= 0) sources.push([place(CEL, i), 1]);
  for (let i = 0; i < s.cols.length; i++) for (let n = 1; n <= maxRun(s, i); n++) sources.push([place(TAB, i), n]);
  if (V.game === "klondike") for (let su = 0; su < 4; su++) if (s.found[su]) sources.push([place(FND, su), 1]);
  for (const [f, n] of sources) {
    for (let i = 0; i < s.cols.length; i++) add(f, place(TAB, i), n);
    if (V.game !== "spider" && n === 1) for (let su = 0; su < 4; su++) add(f, place(FND, su), 1);
    if (V.game === "freecell" && n === 1) for (let i = 0; i < 4; i++) add(f, place(CEL, i), 1);
  }
  return out;
}
/** Where the card (or run) at a place can go. */
export const destinations = (s, f, n) => moves(s).filter(m => m.f === f && m.n === n);

/** Takes a move and changes the game. The move must be legal (check with whyNot): nothing here looks. */
export function applyMut(s, m) {
  const V = VARIANTS[s.v], fk = kindOf(m.f), tk = kindOf(m.t), fi = indexOf(m.f), ti = indexOf(m.t);
  if (V.game === "klondike" && fk === STK) { for (let k = 0; k < m.n; k++) s.waste.push(s.stock.pop()); return s; }
  if (V.game === "klondike" && fk === WST && tk === STK) { s.stock = s.waste.reverse(); s.waste = []; return s; }
  if (V.game === "spider" && fk === STK) {
    for (let i = 0; i < 10; i++) s.cols[i].push(s.stock.pop());
    for (let i = 0; i < 10; i++) takeRuns(s, i);
    return s;
  }
  let cards;
  if (fk === TAB) { const col = s.cols[fi]; cards = col.splice(col.length - m.n, m.n); if (col.length && s.down[fi] >= col.length) s.down[fi] = col.length - 1; if (!col.length) s.down[fi] = 0; }
  else if (fk === WST) cards = [s.waste.pop()];
  else if (fk === CEL) { cards = [s.cells[fi]]; s.cells[fi] = -1; }
  else { cards = [fi * 13 + s.found[fi] - 1]; s.found[fi]--; }
  if (tk === TAB) { s.cols[ti].push(...cards); if (V.game === "spider") takeRuns(s, ti); }
  else if (tk === CEL) s.cells[ti] = cards[0];
  else s.found[ti]++;
  return s;
}
export const apply = (s, m) => applyMut(cloneGame(s), m);
/** Spider: a column ending in king to ace of one suit sends the run to the foundation (and turns up what it covered). */
function takeRuns(s, i) {
  const col = s.cols[i], T = tableOf(s.v);
  for (;;) {
    const n = col.length;
    if (n < 13 || n - 13 < s.down[i]) return;
    const suit = T.suit[col[n - 1]];
    for (let k = 0; k < 13; k++) { const c = col[n - 1 - k]; if (T.rank[c] !== k || T.suit[c] !== suit) return; }
    s.runs.push(col.splice(n - 13, 13));
    if (col.length && s.down[i] >= col.length) s.down[i] = col.length - 1;
    if (!col.length) s.down[i] = 0;
  }
}

// ---------- the moves to the foundation that need no thought ----------
/**
 * A card that can go up to its foundation, if one can (the first, from the free cells, the waste, then the columns left to
 * right). mode "safe": only a card no other can ever need on the tableau, which is an ace or a two, or one whose two
 * cards of the other colour one rank lower are already up (so nothing can want to be built on it). "all": any.
 * FreeCell and Klondike only; Spider has no such move.
 */
export function autoStep(s, mode = "safe") {
  const V = VARIANTS[s.v];
  if (V.game === "spider") return null;
  const T = tableOf(s.v), ok = c => {
    const su = T.suit[c], r = T.rank[c];
    if (s.found[su] !== r) return false;
    if (mode === "all" || r <= 1) return true;
    return s.found[isRed(su) ? 1 : 0] >= r && s.found[isRed(su) ? 3 : 2] >= r;     // the other colour's two cards of rank r-1 (counts r - 1 + 1)
  };
  for (let i = 0; i < s.cells.length; i++) if (s.cells[i] >= 0 && ok(s.cells[i])) return { f: place(CEL, i), t: place(FND, T.suit[s.cells[i]]), n: 1 };
  if (s.waste.length && ok(s.waste[s.waste.length - 1])) return { f: place(WST), t: place(FND, T.suit[s.waste[s.waste.length - 1]]), n: 1 };
  for (let i = 0; i < s.cols.length; i++) {
    const col = s.cols[i];
    if (col.length && ok(col[col.length - 1])) return { f: place(TAB, i), t: place(FND, T.suit[col[col.length - 1]]), n: 1 };
  }
  return null;
}

// ---------- the game in play: the deal and the moves made ----------
/** Plays a list of packed moves on a fresh deal; stops at the first one that isn't legal and says how many went in. */
export function replay(id, order, log) {
  const s = newGame(id, order);
  let done = 0;
  for (const x of log) {
    const m = unpack(x);
    if (whyNot(s, m)) break;
    applyMut(s, m);
    done++;
  }
  return { s, done };
}

// ---------- where a tap sends a card ----------
/**
 * The move a tap on a card (or run) should make, or null if it can't move: up to its foundation if it can; else onto a
 * column (the one with the fewest cards face down, then the shortest, so the column that's hard to dig out stays open;
 * Spider: one of its own suit first); else, into an empty column or a free cell only when that does something: a run
 * that isn't already the whole of its column, a card out of a free cell, a column's last card into a free cell.
 */
export function bestMove(s, f, n) {
  const V = VARIANTS[s.v], T = tableOf(s.v), cards = cardsAt(s, f, n);
  if (!cards) return null;
  const all = destinations(s, f, n);
  const toFnd = all.find(m => kindOf(m.t) === FND);
  if (toFnd) return toFnd;
  const fromCol = kindOf(f) === TAB ? s.cols[indexOf(f)] : null;
  const toTab = all.filter(m => kindOf(m.t) === TAB && (s.cols[indexOf(m.t)].length || !(fromCol && fromCol.length === n)));
  const rate = m => {
    const col = s.cols[indexOf(m.t)], top = col.length ? col[col.length - 1] : -1;
    const sameSuit = V.game === "spider" && top >= 0 && T.suit[top] === T.suit[cards[0]] ? 0 : 1;
    return [col.length ? 0 : 1, sameSuit, s.down[indexOf(m.t)], col.length, indexOf(m.t)];
  };
  if (toTab.length) {
    return toTab.map(m => [rate(m), m]).sort((a, b) => { for (let i = 0; i < 5; i++) if (a[0][i] !== b[0][i]) return a[0][i] - b[0][i]; return 0; })[0][1];
  }
  return all.find(m => kindOf(m.t) === CEL) || null;
}

/** The move a tap on the stock makes: turn a card (or three) onto the waste, turn the waste over, or deal a row (Spider); null if there is none. */
export function stockMove(s) {
  const V = VARIANTS[s.v];
  if (V.game === "klondike") return s.stock.length ? { f: place(STK), t: place(WST), n: Math.min(V.draw, s.stock.length) } : s.waste.length ? { f: place(WST), t: place(STK), n: s.waste.length } : null;
  return V.game === "spider" ? { f: place(STK), t: place(STK), n: 10 } : null;
}

/** The move number x of a packed list, as { f, t, n }. */
export const moveOf = x => { const m = unpack(x); return { f: m.f, t: m.t, n: m.n }; };
export const sameMove = same;

/** A move in words, for a hint: "Move the 7♥ onto the 8♠". */
export function sayMove(s, m) {
  const V = VARIANTS[s.v], fk = kindOf(m.f), tk = kindOf(m.t), cards = cardsAt(s, m.f, m.n);
  if (fk === STK && tk === WST) return `Turn ${m.n === 1 ? "a card" : `${m.n} cards`} from the stock.`;
  if (fk === WST && tk === STK) return "Turn the waste over to make the stock again.";
  if (fk === STK) return "Deal a row from the stock.";
  if (!cards) return "";
  const what = m.n === 1 ? `the ${cardShort(s.v, cards[0])}` : `the ${cardShort(s.v, cards[0])} and the ${m.n - 1} on it`;
  if (tk === FND) return `Move ${what} up to the foundation.`;
  if (tk === CEL) return `Put ${what} in a free cell.`;
  const col = s.cols[indexOf(m.t)];
  if (!col.length) return `Move ${what} to the empty column.`;
  return `Move ${what} onto the ${cardShort(s.v, col[col.length - 1])}.`;
}

/** The kind of game that a save holds, or null if it isn't one. */
export function validOrder(id, order) {
  if (!VARIANTS[id] || !Array.isArray(order) || order.length !== VARIANTS[id].cards) return false;
  const seen = new Uint8Array(order.length);
  for (const c of order) { if (!Number.isInteger(c) || c < 0 || c >= order.length || seen[c]) return false; seen[c] = 1; }
  return true;
}
