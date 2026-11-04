// King and pawn against king, solved completely (for tests/chess-course.mjs, never loaded by a page): every position of a White king, a
// White pawn and a Black king, with either side to move, marked won for White or not, by working backwards from the pawn's promotion.
// The lessons on the opposition and on keeping the king in front of the pawn state positions and the moves that keep the win; the
// test holds each to this table, so nothing the course says about these endings rests on a rule of thumb.
const NEI = Array.from({ length: 64 }, (_, s) => {
  const f = s & 7, r = s >> 3, out = [];
  for (let df = -1; df <= 1; df++) for (let dr = -1; dr <= 1; dr++) {
    if (!df && !dr) continue;
    const g = f + df, q = r + dr;
    if (g >= 0 && g < 8 && q >= 0 && q < 8) out.push(g + 8 * q);
  }
  return out;
});
const near = (a, b) => a === b || NEI[a].includes(b);
const pawnHits = (p, s) => { const f = p & 7, r = p >> 3; return (s >> 3) === r + 1 && Math.abs((s & 7) - f) === 1; };     // White pawn p attacks s
export const sqOf = name => "abcdefgh".indexOf(name[0]) + 8 * (Number(name[1]) - 1);
export const nameOf = s => "abcdefgh"[s & 7] + ((s >> 3) + 1);
/** The new queen on q (White king w, Black king b to move): does Black capture it, or stand stalemated with it? Otherwise White wins. */
function queenWins(w, b, q) {
  if (near(b, q) && !near(w, q)) return false;
  const between = (a, c) => {                                    // squares strictly between a and c on a line, or null
    const df = Math.sign((c & 7) - (a & 7)), dr = Math.sign((c >> 3) - (a >> 3));
    if ((c & 7) - (a & 7) && (c >> 3) - (a >> 3) && Math.abs((c & 7) - (a & 7)) !== Math.abs((c >> 3) - (a >> 3))) return null;
    const out = [];
    for (let x = a + df + 8 * dr; x !== c; x += df + 8 * dr) out.push(x);
    return out;
  };
  const hit = s => {                                            // the queen attacks s (the Black king counts as no blocker)
    if (s === q) return false;
    const line = between(q, s);
    return line !== null && !line.includes(w);
  };
  return hit(b) || NEI[b].some(s => !near(w, s) && s !== q && !hit(s));       // in check (mated or not) or with a square to go to: not a stalemate
}
/** The whole table: Uint8Array won[((wk * 64 + bk) * 48 + pawn) * 2 + turn], turn 0 White to move; pawn = (rank - 2) * 8 + file for ranks 2 to 7. */
export function solve() {
  const N = 64 * 64 * 48 * 2, won = new Uint8Array(N), key = (w, b, p, t) => ((w * 64 + b) * 48 + p) * 2 + t;
  const valid = (w, b, p, t) => {
    const ps = 8 + p;                                            // the pawn's square
    if (w === b || w === ps || b === ps || near(w, b)) return false;
    return !(t === 0 && pawnHits(ps, b));                        // White to move: Black's king cannot be in check
  };
  let changed = true;
  while (changed) {
    changed = false;
    for (let w = 0; w < 64; w++) for (let b = 0; b < 64; b++) for (let p = 0; p < 48; p++) for (let t = 0; t < 2; t++) {
      const k = key(w, b, p, t);
      if (won[k] || !valid(w, b, p, t)) continue;
      const ps = 8 + p;
      let win = false;
      if (t === 0) {
        for (const s of NEI[w]) { if (s === ps || near(s, b)) continue; if (won[key(s, b, p, 1)]) { win = true; break; } }
        if (!win) {
          const up = ps + 8;
          if (up !== w && up !== b) {
            if (up >> 3 === 7) win = queenWins(w, b, up);
            else if (won[key(w, b, p + 8, 1)]) win = true;
            if (!win && (ps >> 3) === 1 && up + 8 !== w && up + 8 !== b && won[key(w, b, p + 16, 1)]) win = true;
          }
        }
      } else {
        let any = false, all = true;
        for (const s of NEI[b]) {
          if (near(s, w) || s === w || pawnHits(ps, s)) continue;
          any = true;
          if (s === ps) { all = false; break; }                 // the pawn is taken (it is guarded when the White king is next to it, which near(s, w) above has excluded)
          if (!won[key(w, s, p, 0)]) { all = false; break; }
        }
        win = any ? all : pawnHits(ps, b);                        // no move: mate if checked, a draw if not
      }
      if (win) { won[k] = 1; changed = true; }
    }
  }
  return { won, key };
}
let cached = null;
/** Positions as { w: "e6", b: "e8", p: "e5" } (the pawn on its file and rank, 2 to 7): is it a win for White with `turn` ("w" or "b") to move? */
export function isWon({ w, b, p }, turn) {
  cached ||= solve();
  return !!cached.won[cached.key(sqOf(w), sqOf(b), sqOf(p) - 8, turn === "w" ? 0 : 1)];
}
