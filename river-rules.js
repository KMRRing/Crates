// River's rules: Xiangqi (象棋) as the Asian Xiangqi Federation's laws have it and Chinese clubs play it, with its move
// generator (the board's referee; the engine only proposes moves and hints), the game's end, and its notations:
// Chinese (炮二平五) and WXF (C2=5). Pure and plain: a game is a JSON state, changed only by act().
//
// The board is 9 files by 10 ranks of points. A point is rank * 9 + file, rank 0 being Red's back rank and file 0 the
// a-file (Red's left, as Red sits), so "a1".."i10" name points as the engine does (Fairy-Stockfish's UCI). A piece is
// a number: 1 general, 2 advisor, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier; Red's positive, Black's negative.

export const START = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";
export const GENERAL = 1, ADVISOR = 2, ELEPHANT = 3, HORSE = 4, CHARIOT = 5, CANNON = 6, SOLDIER = 7;
const LETTER = ".kabnrcp";                                       // FEN's letters (Fairy-Stockfish's: b elephant, n horse)
const FROM_LETTER = { k: 1, a: 2, b: 3, e: 3, n: 4, h: 4, r: 5, c: 6, p: 7 };
const FILES = "abcdefghi";

export const pointOf = (file, rank) => rank * 9 + file;
export const fileOf = p => p % 9;
export const rankOf = p => (p / 9) | 0;
export const nameOf = p => FILES[p % 9] + (((p / 9) | 0) + 1);
export const pointNamed = s => { const f = FILES.indexOf(s[0]), r = Number(s.slice(1)) - 1; return f < 0 || !(r >= 0 && r <= 9) ? -1 : pointOf(f, r); };
/** A move in the engine's words ("h3e3"), from its two points. */
export const uciOf = (from, to) => nameOf(from) + nameOf(to);
/** A move in the engine's words as its two points, or null. */
export function parseUci(s) {
  const m = /^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))$/.exec(String(s || ""));
  return m ? { from: pointNamed(m[1]), to: pointNamed(m[2]) } : null;
}

// ---------- positions ----------
/** A position from FEN: { b: Int8Array(90), red: whose move }. */
export function parseFen(fen = START) {
  const [rows, side] = String(fen).trim().split(/\s+/), b = new Int8Array(90), ranks = rows.split("/");
  if (ranks.length !== 10) throw new Error(`not a Xiangqi position: ${fen}`);
  ranks.forEach((row, k) => {
    const rank = 9 - k;
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { file += Number(ch); continue; }
      const t = FROM_LETTER[ch.toLowerCase()];
      if (!t || file > 8) throw new Error(`not a Xiangqi position: ${fen}`);
      b[pointOf(file++, rank)] = ch === ch.toUpperCase() ? t : -t;
    }
  });
  return { b, red: side !== "b" };
}
/** FEN of a position, as the engine reads it. */
export function toFen(pos) {
  const rows = [];
  for (let rank = 9; rank >= 0; rank--) {
    let row = "", gap = 0;
    for (let file = 0; file < 9; file++) {
      const v = pos.b[pointOf(file, rank)];
      if (!v) { gap++; continue; }
      if (gap) { row += gap; gap = 0; }
      row += v > 0 ? LETTER[v].toUpperCase() : LETTER[-v];
    }
    rows.push(row + (gap || ""));
  }
  return `${rows.join("/")} ${pos.red ? "w" : "b"} - - 0 1`;
}
/** A key for repetition: the board and whose move. */
export const keyOf = pos => String.fromCharCode(...pos.b.map(v => v + 72)) + (pos.red ? "w" : "b");

// ---------- moves ----------
const inBoard = (f, r) => f >= 0 && f < 9 && r >= 0 && r < 10;
const inPalace = (f, r, red) => f >= 3 && f <= 5 && (red ? r >= 0 && r <= 2 : r >= 7 && r <= 9);
const ownSide = (r, red) => (red ? r <= 4 : r >= 5);
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const HORSE_STEPS = [[1, 2, 0, 1], [-1, 2, 0, 1], [1, -2, 0, -1], [-1, -2, 0, -1], [2, 1, 1, 0], [2, -1, 1, 0], [-2, 1, -1, 0], [-2, -1, -1, 0]];   // the jump and its leg

/** Every move the side to move could make by the pieces' paths, ignoring checks: [from, to] pairs. */
function pseudo(pos, out = []) {
  const b = pos.b, red = pos.red, sign = red ? 1 : -1;
  const mine = v => v * sign > 0, theirs = v => v * sign < 0;
  for (let p = 0; p < 90; p++) {
    const v = b[p];
    if (!mine(v)) continue;
    const t = v * sign, f = p % 9, r = (p / 9) | 0;
    const add = (tf, tr) => { const q = tr * 9 + tf; if (!mine(b[q])) out.push(p, q); };
    if (t === GENERAL) {
      for (const [df, dr] of ORTHO) if (inPalace(f + df, r + dr, red)) add(f + df, r + dr);
    } else if (t === ADVISOR) {
      for (const [df, dr] of DIAG) if (inPalace(f + df, r + dr, red)) add(f + df, r + dr);
    } else if (t === ELEPHANT) {
      for (const [df, dr] of DIAG) {
        const tf = f + 2 * df, tr = r + 2 * dr;
        if (inBoard(tf, tr) && ownSide(tr, red) && !b[(r + dr) * 9 + f + df]) add(tf, tr);   // the elephant's eye (象眼) free
      }
    } else if (t === HORSE) {
      for (const [df, dr, lf, lr] of HORSE_STEPS) {
        const tf = f + df, tr = r + dr;
        if (inBoard(tf, tr) && !b[(r + lr) * 9 + f + lf]) add(tf, tr);                       // the horse's leg (馬腿) free
      }
    } else if (t === CHARIOT || t === CANNON) {
      for (const [df, dr] of ORTHO) {
        let tf = f + df, tr = r + dr, screen = false;
        while (inBoard(tf, tr)) {
          const w = b[tr * 9 + tf];
          if (t === CHARIOT) {
            if (!w) out.push(p, tr * 9 + tf);
            else { if (theirs(w)) out.push(p, tr * 9 + tf); break; }
          } else if (!screen) {
            if (!w) out.push(p, tr * 9 + tf); else screen = true;                           // the cannon's screen (炮架)
          } else if (w) { if (theirs(w)) out.push(p, tr * 9 + tf); break; }
          tf += df; tr += dr;
        }
      }
    } else if (t === SOLDIER) {
      const fwd = red ? 1 : -1;
      if (inBoard(f, r + fwd)) add(f, r + fwd);
      if (!ownSide(r, red)) { if (f > 0) add(f - 1, r); if (f < 8) add(f + 1, r); }           // across the river: sideways too
    }
  }
  return out;
}

const generalOf = (b, red) => { const g = red ? GENERAL : -GENERAL; for (let p = 0; p < 90; p++) if (b[p] === g) return p; return -1; };
/**
 * Whether the general of `red`'s side stands attacked: by a chariot, a cannon over one screen, a horse whose leg is
 * free, a soldier, or the other general along an open file (the generals may never face each other: 將帥不能照面).
 */
export function attacked(b, red) {
  const g = generalOf(b, red);
  if (g < 0) return true;
  const sign = red ? -1 : 1, f = g % 9, r = (g / 9) | 0;              // sign: the attackers' (the other side's)
  for (const [df, dr] of ORTHO) {
    let tf = f + df, tr = r + dr, seen = 0;
    while (inBoard(tf, tr)) {
      const w = b[tr * 9 + tf];
      if (w) {
        if (seen === 0 && (w === sign * CHARIOT || (w === sign * GENERAL && df === 0))) return true;
        if (seen === 1 && w === sign * CANNON) return true;
        if (++seen > 1) break;
      }
      tf += df; tr += dr;
    }
  }
  for (const [df, dr] of DIAG) {                                      // a horse two-and-one away, its leg beside the general's diagonal
    if (!inBoard(f + df, r + dr) || b[(r + dr) * 9 + f + df]) continue;
    for (const [hf, hr] of [[f + 2 * df, r + dr], [f + df, r + 2 * dr]]) if (inBoard(hf, hr) && b[hr * 9 + hf] === sign * HORSE) return true;
  }
  const ahead = red ? 1 : -1;                                          // a soldier comes at a general from its front or sides
  if (inBoard(f, r + ahead) && b[(r + ahead) * 9 + f] === sign * SOLDIER) return true;
  if (f > 0 && b[r * 9 + f - 1] === sign * SOLDIER) return true;
  if (f < 8 && b[r * 9 + f + 1] === sign * SOLDIER) return true;
  return false;
}
/** Whether the side to move is in check (將軍). */
export const inCheck = pos => attacked(pos.b, pos.red);

/** Every legal move of the side to move: { from, to } (a move may not leave one's own general attacked). */
export function legalMoves(pos) {
  const raw = pseudo(pos), out = [], b = pos.b;
  for (let k = 0; k < raw.length; k += 2) {
    const from = raw[k], to = raw[k + 1], was = b[to];
    b[to] = b[from]; b[from] = 0;
    if (!attacked(b, pos.red)) out.push({ from, to });
    b[from] = b[to]; b[to] = was;
  }
  return out;
}
/** The legal moves from one point. */
export const movesFrom = (pos, from) => legalMoves(pos).filter(m => m.from === from);
export const isLegal = (pos, from, to) => legalMoves(pos).some(m => m.from === from && m.to === to);
/** The position after a move (not checked for legality). */
export function after(pos, from, to) {
  const b = Int8Array.from(pos.b);
  b[to] = b[from]; b[from] = 0;
  return { b, red: !pos.red };
}
/** Leaf positions `depth` moves on: the move generator's check (from the start, 44, 1,920, 79,666, 3,290,240). */
export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  const b = pos.b;
  for (const { from, to } of moves) {
    const was = b[to];
    b[to] = b[from]; b[from] = 0; pos.red = !pos.red;
    n += perft(pos, depth - 1);
    pos.red = !pos.red; b[from] = b[to]; b[to] = was;
  }
  return n;
}

// ---------- the game ----------
// A game: { start (FEN), moves: "h3e3 h10g8 …" (the engine's words, space-separated: a string survives the database,
// which keeps no empty lists) }. replay() walks it; outcome() says whether it has ended and how.
export const movesOf = game => String(game?.moves || "").split(" ").filter(Boolean);
/**
 * Every position of a game, the move into each, and whether it gave check: { positions, moves: [{ from, to, uci,
 * capture, check }], ok } (ok false at the first move that isn't legal, which the replay stops before).
 */
export function replay(game) {
  let pos = parseFen(game?.start || START);
  const positions = [pos], moves = [];
  for (const uci of movesOf(game)) {
    const m = parseUci(uci);
    if (!m || !isLegal(pos, m.from, m.to)) return { positions, moves, ok: false };
    const capture = pos.b[m.to] !== 0;
    pos = after(pos, m.from, m.to);
    moves.push({ ...m, uci, capture, check: inCheck(pos) });
    positions.push(pos);
  }
  return { positions, moves, ok: true };
}
const ATTACKERS = [HORSE, CHARIOT, CANNON, SOLDIER];
/**
 * Whether the game has ended, and how: null, or { winner: "red" | "black" | null, why }. The side to move with no legal
 * move loses, in check (將死, checkmate) or not (困斃: no stalemate draw in Xiangqi). A position seen for the third
 * time ends the game: if one side gave check with every move of its own since the position first stood, it loses
 * (長將, perpetual check, is forbidden); otherwise a draw. Sixty moves each without a capture (自然限著) are a draw, as
 * is a board where neither side has a piece left that can cross the river.
 */
export function outcome(game, played = replay(game)) {
  const { positions, moves } = played, pos = positions[positions.length - 1], other = pos.red ? "black" : "red";
  if (!legalMoves(pos).length) return { winner: other, why: inCheck(pos) ? "checkmate" : "stalemate" };
  const keys = positions.map(keyOf), now = keys[keys.length - 1];
  const seen = keys.reduce((n, k, i) => n + (k === now && i < keys.length - 1 ? 1 : 0), 0);
  if (seen >= 2) {
    const first = keys.indexOf(now), span = moves.slice(first);            // the moves since the position first stood
    const startRed = positions[first].red;
    const checks = side => span.filter((m, i) => (i % 2 === 0) === (startRed === (side === "red"))).every(m => m.check);
    const red = checks("red"), black = checks("black");
    if (red !== black) return { winner: red ? "black" : "red", why: "perpetual" };
    return { winner: null, why: "repetition" };
  }
  let quiet = 0;
  for (let i = moves.length - 1; i >= 0 && !moves[i].capture; i--) quiet++;
  if (quiet >= 120) return { winner: null, why: "sixty" };
  if (!pos.b.some(v => ATTACKERS.includes(Math.abs(v)))) return { winner: null, why: "material" };
  return null;
}

// ---------- names ----------
// The pieces' characters: red's 帥仕相傌俥炮兵 and black's 將士象馬車砲卒 (traditional, as on the discs), or as a
// mainland set prints them in simplified characters (帅仕相马车炮兵, 将士象马车炮卒).
export const CHARS = {
  traditional: { red: ["", "帥", "仕", "相", "傌", "俥", "炮", "兵"], black: ["", "將", "士", "象", "馬", "車", "砲", "卒"], fwd: "進", back: "退", across: "平", front: "前", rear: "後", middle: "中" },
  simplified: { red: ["", "帅", "仕", "相", "马", "车", "炮", "兵"], black: ["", "将", "士", "象", "马", "车", "炮", "卒"], fwd: "进", back: "退", across: "平", front: "前", rear: "后", middle: "中" },
};
export const charOf = (v, script = "traditional") => CHARS[script][v > 0 ? "red" : "black"][Math.abs(v)];
const RED_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
const BLACK_NUM = ["", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const WXF_LETTER = ["", "K", "A", "E", "H", "R", "C", "P"];
/** A file as its player counts it: 1 to 9 from that player's right (Red's 一 is the i-file, Black's 1 the a-file). */
const fileNo = (file, red) => (red ? 9 - file : file + 1);
/** How far toward the other side a rank lies, for `red`'s pieces. */
const ahead = (rank, red) => (red ? rank : 9 - rank);

/**
 * A move in both notations, from the position it's made in: { cn: "炮二平五", wxf: "C2=5" }. The piece, the file it
 * stands on (counted from its player's right), then forward (進, +), back (退, −) or across (平, =), and the file it
 * goes to, or for a piece moving straight along its file, how many ranks. Two like pieces on one file are told apart
 * as front and rear (前/後; WXF + and −), three soldiers as front, middle and rear, and more by their order from the
 * front (一兵, 二兵…); an advisor or an elephant needs neither, its direction telling them apart.
 */
export function notate(pos, from, to, script = "traditional") {
  const v = pos.b[from], red = v > 0, t = Math.abs(v), C = CHARS[script];
  const ff = from % 9, fr = (from / 9) | 0, tf = to % 9, tr = (to / 9) | 0;
  const num = n => (red ? RED_NUM[n] : BLACK_NUM[n]);
  const dir = ahead(tr, red) > ahead(fr, red) ? "fwd" : ahead(tr, red) < ahead(fr, red) ? "back" : "across";
  const straight = t === CHARIOT || t === CANNON || t === SOLDIER || t === GENERAL;
  const target = dir === "across" || !straight ? fileNo(tf, red) : Math.abs(tr - fr);
  const op = { fwd: [C.fwd, "+"], back: [C.back, "-"], across: [C.across, "="] }[dir];
  let cnHead = C[red ? "red" : "black"][t] + num(fileNo(ff, red)), wxfHead = WXF_LETTER[t] + fileNo(ff, red);
  if (t !== ADVISOR && t !== ELEPHANT) {
    // like pieces on the same file, ordered from the front (the one furthest toward the other side)
    const sameFile = [];
    for (let r = 0; r < 10; r++) if (pos.b[r * 9 + ff] === v) sameFile.push(r);
    if (sameFile.length > 1) {
      sameFile.sort((a, b) => ahead(b, red) - ahead(a, red));
      const at = sameFile.indexOf(fr), n = sameFile.length;
      const word = n === 2 ? [C.front, C.rear][at] : n === 3 ? [C.front, C.middle, C.rear][at] : RED_NUM[at + 1];
      // soldiers doubled on more than one file keep their file's number as well (前兵七進一)
      const otherFiles = t === SOLDIER && [...Array(9).keys()].some(f => f !== ff && [...Array(10).keys()].filter(r => pos.b[r * 9 + f] === v).length > 1);
      cnHead = word + C[red ? "red" : "black"][t] + (otherFiles ? num(fileNo(ff, red)) : "");
      wxfHead = WXF_LETTER[t] + (n === 2 ? ["+", "-"][at] : String(at + 1)) + (otherFiles ? fileNo(ff, red) : "");
    }
  }
  return { cn: cnHead + op[0] + num(target), wxf: wxfHead + op[1] + target };
}

// ---------- the state of a match ----------
/**
 * A game as the page and the room keep it: { v, start, moves, result, red (the seat playing Red: 0 or 1) }, plain
 * JSON. act() is the only way it changes: { move: "h3e3" } from the seat to move, { undo: n } (taking back the last n
 * moves), { resign: true } from either seat; it returns the new state, or null when the action isn't allowed.
 */
export function newGame({ red = 0, start = START } = {}) {
  return { v: 1, start, moves: "", result: null, red };
}
/** The seat whose move it is now, or null once the game is over. */
export function waitingOn(state) {
  if (state.result) return null;
  const red = movesOf(state).length % 2 === 0 === parseFen(state.start).red;
  return red ? state.red : 1 - state.red;
}
export function act(state, seat, action) {
  if (action.move) {
    if (state.result || waitingOn(state) !== seat) return null;
    const played = replay(state), pos = played.positions[played.positions.length - 1], m = parseUci(action.move);
    if (!m || !isLegal(pos, m.from, m.to)) return null;
    const next = { ...state, moves: state.moves ? `${state.moves} ${action.move}` : action.move };
    next.result = outcome(next);
    return next;
  }
  if (action.undo) {
    const all = movesOf(state), n = Math.min(action.undo, all.length);
    if (!n) return null;
    return { ...state, moves: all.slice(0, all.length - n).join(" "), result: null };
  }
  if (action.resign) {
    if (state.result) return null;
    return { ...state, result: { winner: seat === state.red ? "black" : "red", why: "resigned" } };
  }
  return null;
}
/** A state read back from the room (or the device), tidied: the database may drop an empty string or a null. */
// a drawn game's winner is null, which the database doesn't keep: it's put back, so a game reads back as it was written
export function fromRoom(stored) {
  if (!stored || typeof stored !== "object") return null;
  return { ...stored, v: 1, start: stored.start || START, moves: typeof stored.moves === "string" ? stored.moves : "", result: stored.result ? { winner: null, ...stored.result } : null, red: stored.red === 1 ? 1 : 0 };
}
