// The Xiangqi openings River names: the systems a Chinese club player names at the board, each with the moves that
// reach it (in the engine's words), its name in traditional and simplified characters, its pinyin and an English name.
// A game is named by the latest of its positions the table has; each line counts in its mirror image too (炮八平五 is
// as much the central cannon as 炮二平五).
import { parseFen, START, parseUci, after, keyOf } from "./river-rules.js";

export const OPENINGS = [
  { line: "h3e3", tc: "中炮", sc: "中炮", py: "zhōng pào", en: "Central Cannon" },
  { line: "c1e3", tc: "飛相局", sc: "飞相局", py: "fēi xiàng jú", en: "Elephant Opening" },
  { line: "c4c5", tc: "仙人指路", sc: "仙人指路", py: "xiānrén zhǐ lù", en: "Pawn Opening (the immortal points the way)" },
  { line: "b1c3", tc: "起馬局", sc: "起马局", py: "qǐ mǎ jú", en: "Horse Opening" },
  { line: "h3d3", tc: "過宮炮", sc: "过宫炮", py: "guò gōng pào", en: "Palace-Crossing Cannon" },
  { line: "h3f3", tc: "士角炮", sc: "士角炮", py: "shì jiǎo pào", en: "Advisor's Corner Cannon" },
  { line: "h3e3 h10g8 h1g3 b10c8", tc: "中炮對屏風馬", sc: "中炮对屏风马", py: "zhōng pào duì píngfēng mǎ", en: "Central Cannon against Screen Horses" },
  { line: "h3e3 h8e8", tc: "順炮", sc: "顺炮", py: "shùn pào", en: "Same-Direction Cannons" },
  { line: "h3e3 b8e8", tc: "列炮", sc: "列炮", py: "liè pào", en: "Opposite-Direction Cannons" },
  { line: "h3e3 b10c8 h1g3 h8f8 i1h1 h10g8", tc: "中炮對反宮馬", sc: "中炮对反宫马", py: "zhōng pào duì fǎn gōng mǎ", en: "Central Cannon against the Reverse Palace Horse" },
  { line: "h3e3 h10g8 h1g3 h8i8", tc: "中炮對三步虎", sc: "中炮对三步虎", py: "zhōng pào duì sān bù hǔ", en: "Central Cannon against the Three-Step Tiger" },
  { line: "c4c5 b8c8", tc: "卒底炮", sc: "卒底炮", py: "zú dǐ pào", en: "Cannon under the Soldier" },
  { line: "c4c5 g7g6", tc: "對兵局", sc: "对兵局", py: "duì bīng jú", en: "Pawn against Pawn" },
  { line: "h3e3 h10g8 h1g3 g7g6 i1h1 i10h10 h1h7", tc: "中炮過河車", sc: "中炮过河车", py: "zhōng pào guò hé jū", en: "Central Cannon with the River-Crossing Chariot" },
  { line: "h3e3 h10g8 h1g3 b10c8 b3c3", tc: "五七炮對屏風馬", sc: "五七炮对屏风马", py: "wǔ qī pào duì píngfēng mǎ", en: "Five-Seven Cannons against Screen Horses" },
  { line: "h3e3 h10g8 h1g3 b10c8 b3d3", tc: "五六炮對屏風馬", sc: "五六炮对屏风马", py: "wǔ liù pào duì píngfēng mǎ", en: "Five-Six Cannons against Screen Horses" },
];

/** A move seen in a mirror: the a-file is the i-file. */
const mirrorMove = uci => uci.replace(/[a-i]/g, f => "abcdefghi"[8 - "abcdefghi".indexOf(f)]);
let index = null;
function byPosition() {
  if (index) return index;
  index = new Map();
  for (const o of OPENINGS) for (const moves of [o.line.split(" "), o.line.split(" ").map(mirrorMove)]) {
    let pos = parseFen(START);
    for (const m of moves) { const { from, to } = parseUci(m); pos = after(pos, from, to); }
    if (!index.has(keyOf(pos))) index.set(keyOf(pos), o);
  }
  return index;
}
/** The opening a game has reached, from its positions (the start first): an entry of OPENINGS, or null. */
export function openingOf(positions) {
  const map = byPosition();
  for (let i = positions.length - 1; i >= 1; i--) { const o = map.get(keyOf(positions[i])); if (o) return o; }
  return null;
}
