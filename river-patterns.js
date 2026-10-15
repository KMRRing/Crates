// The patterns River's puzzles teach by name: the mates a Xiangqi player learns (杀法) and the tricks, found in a
// puzzle's line and the position it ends on by the board's own rules (river-rules.js). A puzzle can be several at once
// (a 马后炮 that is also a double check). The rush names them after each puzzle and has a run of them alone.
import * as X from "./river-rules.js";

const { GENERAL: K, HORSE: H, CHARIOT: R, CANNON: C, SOLDIER: P } = X;
/** The patterns, in the order a verdict names them: characters in both scripts ({traditional|simplified}), sound, sense. */
export const PATTERNS = {
  mahou: { zh: "{馬後炮|马后炮}", py: "mǎ hòu pào", en: "the cannon behind the horse", say: "the horse is the cannon's screen and holds the general's flight" },
  chong: { zh: "{重炮|重炮}", py: "chóng pào", en: "doubled cannons", say: "the front cannon is the rear one's screen: nothing can block it" },
  wocao: { zh: "{臥槽馬|卧槽马}", py: "wò cáo mǎ", en: "the horse in the trough", say: "the horse checks from beside the elephant's home" },
  guajiao: { zh: "{掛角馬|挂角马}", py: "guà jiǎo mǎ", en: "the horse on the palace corner", say: "the horse checks from a corner of the palace" },
  mengong: { zh: "{悶宮|闷宫}", py: "mèn gōng", en: "the smothered palace", say: "the general's own pieces fill every point it could step to" },
  tiandi: { zh: "{天地炮|天地炮}", py: "tiān dì pào", en: "heaven-and-earth cannons", say: "one cannon down the general's file, the other along its rank" },
  shuangche: { zh: "{雙車錯|双车错}", py: "shuāng jū cuò", en: "staggered chariots", say: "one chariot checks, the other holds the line beside it" },
  chuanxin: { zh: "{大膽穿心|大胆穿心}", py: "dà dǎn chuān xīn", en: "the bold heart-piercer", say: "a chariot given up in the palace's centre to break it open" },
  duimian: { zh: "{對面笑|对面笑}", py: "duì miàn xiào", en: "the generals face to face", say: "the general can't step onto its opponent's open file" },
  kunbi: { zh: "{困斃|困毙}", py: "kùn bì", en: "no move left", say: "not in check, but no legal move: in Xiangqi that loses" },
  shuangjiang: { zh: "{雙將|双将}", py: "shuāng jiàng", en: "double check", say: "two pieces check at once: only the general's own step can answer" },
  chou: { zh: "{抽將|抽将}", py: "chōu jiàng", en: "the discovered check", say: "a piece steps aside to uncover a check, and takes as it goes" },
  zhuoshuang: { zh: "{捉雙|捉双}", py: "zhuō shuāng", en: "the fork", say: "one move attacks two pieces, and only one can be saved" },
};

/** A pattern's characters in the reader's script ("traditional" or "simplified"). */
export const zhOf = (id, script = "traditional") => PATTERNS[id].zh.replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, t, sim) => (script === "simplified" ? sim : t));

const fileOf = p => p % 9, rankOf = p => (p / 9) | 0;
const at = (f, r) => (f >= 0 && f < 9 && r >= 0 && r < 10 ? r * 9 + f : -1);
const inPalace = (p, red) => { const f = fileOf(p), r = rankOf(p); return f >= 3 && f <= 5 && (red ? r <= 2 : r >= 7); };
const generalOf = (b, red) => b.findIndex(v => v === (red ? K : -K));
/**
 * The pieces of side `sign` (1 Red, −1 Black) attacking point g, as the board's attacked() counts them: [{ p, type,
 * screen }] (a cannon's screen, the point it jumps).
 */
export function attackersOf(b, g, sign) {
  const out = [], f = fileOf(g), r = rankOf(g);
  for (const [df, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const seen = [];
    for (let tf = f + df, tr = r + dr; tf >= 0 && tf < 9 && tr >= 0 && tr < 10; tf += df, tr += dr) {
      const q = tr * 9 + tf, w = b[q];
      if (!w) continue;
      if (!seen.length && (w === sign * R || (w === sign * K && df === 0))) out.push({ p: q, type: Math.abs(w) });
      if (seen.length === 1 && w === sign * C) out.push({ p: q, type: C, screen: seen[0] });
      seen.push(q);
      if (seen.length > 1) break;
    }
  }
  for (const [df, dr] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const leg = at(f + df, r + dr);                                   // the horse's leg, beside the general's diagonal
    if (leg < 0 || b[leg]) continue;
    for (const hp of [at(f + 2 * df, r + dr), at(f + df, r + 2 * dr)]) if (hp >= 0 && b[hp] === sign * H) out.push({ p: hp, type: H });
  }
  const behind = sign > 0 ? -1 : 1;                                   // a soldier attacks forward and sideways
  for (const q of [at(f, r + behind), at(f - 1, r), at(f + 1, r)]) if (q >= 0 && b[q] === sign * P) out.push({ p: q, type: P });
  return out;
}

/** The patterns of a position the side to move has lost (no legal move): ids, mates by what mates. */
function endPatterns(pos) {
  const b = pos.b, red = pos.red, sign = red ? -1 : 1, g = generalOf(b, red), out = [];
  if (!X.inCheck(pos)) return ["kunbi"];
  const checkers = attackersOf(b, g, sign), own = q => b[q] !== 0 && (b[q] > 0) === red;
  const flights = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([df, dr]) => at(fileOf(g) + df, rankOf(g) + dr)).filter(q => q >= 0 && inPalace(q, red));
  const ranks = red ? [0, 1, 2] : [9, 8, 7];                          // the general's back rank, second, third
  for (const a of checkers) {
    if (a.type === C && b[a.screen] === sign * H) out.push("mahou");
    if (a.type === C && b[a.screen] === sign * C) out.push("chong");
    if (a.type === H && (fileOf(a.p) === 2 || fileOf(a.p) === 6) && rankOf(a.p) === ranks[1]) out.push("wocao");
    if (a.type === H && (fileOf(a.p) === 3 || fileOf(a.p) === 5) && (rankOf(a.p) === ranks[0] || rankOf(a.p) === ranks[2])) out.push("guajiao");
  }
  if (checkers.some(a => a.type === C) && flights.every(own)) out.push("mengong");
  const cannons = b.reduce((l, v, p) => (v === sign * C ? [...l, p] : l), []);
  if (checkers.some(a => a.type === C) && cannons.some(c => fileOf(c) === fileOf(g)) && cannons.some(c => rankOf(c) === rankOf(g))) out.push("tiandi");
  const chariots = b.reduce((l, v, p) => (v === sign * R ? [...l, p] : l), []);
  for (const a of checkers.filter(x => x.type === R)) {
    const alongRank = rankOf(a.p) === rankOf(g);
    if (chariots.some(c => c !== a.p && (alongRank ? Math.abs(rankOf(c) - rankOf(g)) === 1 : Math.abs(fileOf(c) - fileOf(g)) === 1))) { out.push("shuangche"); break; }
  }
  // a point the general could step to, held only by the other general down an open file
  const mg = generalOf(b, !red);
  for (const q of flights.filter(x => !own(x))) {
    const t = Int8Array.from(b);
    t[q] = t[g]; t[g] = 0;
    if (!X.attacked(t, red)) continue;
    t[mg] = 0;
    if (!X.attacked(t, red)) { out.push("duimian"); break; }
  }
  if (checkers.length >= 2) out.push("shuangjiang");
  return out;
}

/** The patterns of a puzzle ({ fen, moves }: the other side's mistake first, the solver's moves and the replies after): ids. */
export function patternsOf(p) {
  let pos = X.parseFen(p.fen);
  const found = new Set(), solverRed = !pos.red;
  const steps = [];
  for (const u of p.moves) { const m = X.parseUci(u); steps.push({ pos, m }); pos = X.after(pos, m.from, m.to); }
  // the solver's moves: a chariot into the palace's centre, a double or discovered check, a fork
  steps.forEach(({ pos: before, m }, i) => {
    if (i % 2 === 0) return;
    const b0 = before.b, piece = b0[m.from], afterPos = X.after(before, m.from, m.to), b1 = afterPos.b, sign = solverRed ? 1 : -1;
    const centre = solverRed ? X.pointOf(4, 8) : X.pointOf(4, 1);
    if (Math.abs(piece) === R && m.to === centre && b0[m.to]) found.add("chuanxin");
    const g = generalOf(b1, !solverRed), checkers = g < 0 ? [] : attackersOf(b1, g, sign), next = steps[i + 2];
    if (checkers.length >= 2) found.add("shuangjiang");
    else if (checkers.length === 1 && checkers[0].p !== m.to && next && (next.pos.b[next.m.to] || !X.legalMoves(X.after(next.pos, next.m.from, next.m.to)).length)) found.add("chou");
    // a fork: the moved piece attacks two of theirs (not the general), and the line takes one of them next
    if (next && next.m.from === m.to && next.pos.b[next.m.to]) {
      const targets = X.movesFrom({ b: b1, red: solverRed }, m.to).map(x => x.to).filter(q => b1[q] && Math.abs(b1[q]) !== K);
      if (targets.length >= 2 && targets.includes(next.m.to)) found.add("zhuoshuang");
    }
  });
  if (!X.legalMoves(pos).length) for (const id of endPatterns(pos)) found.add(id);
  return Object.keys(PATTERNS).filter(id => found.has(id));
}
