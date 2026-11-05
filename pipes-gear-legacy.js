// Gears: Book I, the forty old levels, read through the new rules unchanged (4 November 2026). The old engine (pipes-train.js) and its
// level file stay as the source of Book I: each level keeps its id, name and listed answers, so stars and unfinished runs survive.
// An old piece is a new one turned: the old table is in OLD_KIND. Also here: the eight symmetries of a plate (transformLevel), for the
// daily and Random levels that are drawn from a pool of solved plates.
import * as Old from "./pipes-train.js";
import { LEVELS as OLD_LEVELS, CHAPTERS as OLD_CHAPTERS } from "./pipes-train-levels.js";
import { pieceStr, SIDE } from "./pipes-gear-engine.js";
import { mirrorPiece, canonRot } from "./pipes-gear-shapes.js";

/** The old kind -> the new kind and its turn. */
export const OLD_KIND = {
  g: ["S5.1", 0], dh: ["D5.1:6+6", 0], dv: ["D5.1:6+6", 1],
  dne: ["D5.1:5>5e", 0], dse: ["D5.1:5>5e", 1], dsw: ["D5.1:5>5e", 2], dnw: ["D5.1:5>5e", 3],
  th: ["T5.1:5-4-5", 0], tv: ["T5.1:5-4-5", 1],
  tne: ["T5.1:4-5-4e", 0], tse: ["T5.1:4-5-4e", 1], tsw: ["T5.1:4-5-4e", 2], tnw: ["T5.1:4-5-4e", 3],
};
export const newPiece = old => pieceStr(...OLD_KIND[old]);

/** An old level (its text) as new level data. */
export function legacySpec(spec) {
  const O = Old.parseLevel(spec), cols = O.cols, rows = O.rows;
  const map = [], pins = [], clicks = [];
  for (let y = 0; y < rows; y++) {
    let row = "";
    for (let x = 0; x < cols; x++) {
      const c = y * cols + x, f = O.cells[c];
      row += f?.k === "rock" ? "#" : ".";
      if (f?.k === "old") { const [kind, rot] = OLD_KIND[f.piece]; pins.push({ c, kind, rot, train: 0 }); }
      if (O.load[c] >= 0) clicks.push({ c, dir: O.load[c] ? "ccw" : "cw" });
    }
    map.push(row);
  }
  const hand = Object.entries(O.hand).map(([k, n]) => `${newPiece(k)}:${n}`).join(" ");
  const sols = O.sols.map(route => {
    const laid = Old.layRoute(O, route), s = {};
    laid.forEach((p, c) => { if (p) s[c] = newPiece(p); });
    return s;
  });
  return {
    id: spec.id, name: spec.name, chapter: spec.chapter, cols, rows, rotate: false, map, hand, sols, pins, clicks, sig: `${spec.map.join("/")}|${spec.hand}|${spec.out}${spec.inlet}${spec.spin}`,
    trains: [{ id: "A", barrel: { c: O.source.c, side: SIDE[O.source.d], m: 5, l: 1, n: 9 }, sink: { c: O.terminal.c, side: SIDE[O.terminal.d], m: 5, l: 1, n: 9, goal: { type: "dial", dir: O.spin ? "ccw" : "cw" } } }],
  };
}
export const LEGACY = OLD_LEVELS.map(legacySpec);
export const LEGACY_CHAPTERS = OLD_CHAPTERS.map(c => ({ ...c, book: "I" }));
/** An old unfinished run ({ square: oldKind }) as laid data. */
export const legacyLaid = saved => Object.fromEntries(Object.entries(saved || {}).filter(([, p]) => OLD_KIND[p]).map(([c, p]) => [c, newPiece(p)]));

// ---------- the eight symmetries of a plate ----------
/**
 * Level data turned and mirrored: k = 0..3 turns k quarter turns clockwise, 4..7 the same after a mirror left to right. The ratios are
 * the same, and so are the directions relative to the barrel (which always turns clockwise, so a mirror turns nothing round), hence a
 * solved plate stays solved. Squares, sides, pieces' turns, the hand and the answers move; a mirrored piece is the catalogue piece that
 * is its mirror image (`mirrorPiece`). Only for levels that turn (Book I never does).
 */
export function transformLevel(spec, k) {
  const { cols, rows } = spec, q = k % 4, mir = k >= 4;
  const at = c => {
    let x = c % cols, y = Math.floor(c / cols), w = cols, h = rows;
    if (mir) x = w - 1 - x;
    for (let i = 0; i < q; i++) { [x, y] = [h - 1 - y, x]; [w, h] = [h, w]; }
    return y * w + x;
  };
  let w = cols, h = rows;
  for (let i = 0; i < q; i++) [w, h] = [h, w];
  const grid = Array.from({ length: h }, () => Array(w).fill("."));
  [...spec.map.join("")].forEach((ch, c) => { const t = at(c); grid[Math.floor(t / w)][t % w] = ch; });
  const side = s => { let d = typeof s === "number" ? s : SIDE.indexOf(s); if (mir) d = d === 1 ? 3 : d === 3 ? 1 : d; return SIDE[(d + q) % 4]; };
  const piece = (kind, rot) => { if (mir) [kind, rot] = mirrorPiece(kind, rot); return [kind, canonRot(kind, (rot + q) % 4)]; };
  const hand = {};
  for (const item of (spec.hand || "").split(/\s+/).filter(Boolean)) {
    const i = item.lastIndexOf(":"), kind = item.slice(0, i), n = Number(item.slice(i + 1)), mk = mir ? mirrorPiece(kind, 0)[0] : kind;
    hand[mk] = (hand[mk] || 0) + n;
  }
  return {
    ...spec, cols: w, rows: h, map: grid.map(r => r.join("")),
    trains: spec.trains.map(t => ({ ...t, barrel: { ...t.barrel, c: at(t.barrel.c), side: side(t.barrel.side) }, sink: { ...t.sink, c: at(t.sink.c), side: side(t.sink.side) } })),
    pins: (spec.pins || []).map(p => { const [kind, rot] = piece(p.kind, p.rot || 0); return { ...p, c: at(p.c), kind, rot }; }),
    clicks: (spec.clicks || []).map(c => ({ ...c, c: at(c.c) })),
    sols: (spec.sols || []).map(s => Object.fromEntries(Object.entries(s).map(([c, p]) => {
      const i = p.lastIndexOf("@"), [kind, rot] = piece(p.slice(0, i), Number(p.slice(i + 1)));
      return [at(Number(c)), pieceStr(kind, rot)];
    }))),
    hand: Object.entries(hand).map(([kd, n]) => `${kd}:${n}`).join(" "),
  };
}
