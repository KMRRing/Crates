// Gammon's board drawn (a 360 × 300 drawing), for the page and the course alike: the points, the checkers (yours
// ivory, theirs ink, five to a stack and the count beyond), the bar, the tray of those borne off, the dice, the cube,
// where a picked-up checker may go, and the tap areas (each point's column, the bar, the tray, as data-pt).
const W = 24, R = 11, TOP = 8, BOT_Y = 292, LEFT = 8, RIGHT = 172, BAR_X = 162, TRAY_X = 335;
/** Where my point i is: its column's middle, and whether it's on the top row. */
function spot(i) {
  if (i <= 6) return { x: RIGHT + (6 - i) * W + W / 2, top: false };
  if (i <= 12) return { x: LEFT + (12 - i) * W + W / 2, top: false };
  if (i <= 18) return { x: LEFT + (i - 13) * W + W / 2, top: true };
  return { x: RIGHT + (i - 19) * W + W / 2, top: true };
}
const checkerY = (top, k) => (top ? TOP + R + k * 2 * R : BOT_Y - R - k * 2 * R);
const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function dieSvg(x, y, n, cls) {
  return `<g class="gm-die ${cls}" transform="translate(${x} ${y})"><rect x="-12" y="-12" width="24" height="24" rx="4.5"/>${PIPS[n].map(([a, b]) => `<circle cx="${a * 6}" cy="${b * 6}" r="2.3"/>`).join("")}</g>`;
}

/** The board, from my side (me: my checkers; op: theirs, in their numbering), with what may be tapped and shown. */
export function boardSvg({ me, op, dice = [], used = 0, myDice = true, sel = null, targets = [], from = [], cube = null, owner = -1, seat = 0, numbers = false }) {
  const out = [];
  out.push(`<rect class="gm-frame" x="1" y="1" width="358" height="298" rx="6"/>`);
  out.push(`<rect class="gm-field" x="${LEFT - 2}" y="${TOP - 2}" width="${6 * W + 4}" height="${BOT_Y - TOP + 4}"/><rect class="gm-field" x="${RIGHT - 2}" y="${TOP - 2}" width="${6 * W + 4}" height="${BOT_Y - TOP + 4}"/>`);
  out.push(`<rect class="gm-bar" x="${BAR_X - 9}" y="${TOP - 2}" width="18" height="${BOT_Y - TOP + 4}"/><rect class="gm-tray" x="${TRAY_X - 15}" y="${TOP - 2}" width="30" height="${BOT_Y - TOP + 4}" rx="3"/>`);
  for (let i = 1; i <= 24; i++) {
    const { x, top } = spot(i), tip = top ? TOP + 118 : BOT_Y - 118, base = top ? TOP : BOT_Y;
    out.push(`<path class="gm-point ${i % 2 ? "a" : "b"}${from.includes(i) ? " from" : ""}" d="M${x - W / 2 + 1} ${base}L${x} ${tip}L${x + W / 2 - 1} ${base}Z"/>`);
  }
  // the points' numbers, yours, by their tips (the course's board: "your 8 point")
  if (numbers) for (let i = 1; i <= 24; i++) { const { x, top } = spot(i); out.push(`<text class="gm-num" x="${x}" y="${top ? 135 : 171}" font-size="8">${i}</text>`); }
  // the checkers: mine ivory, theirs dark; five to a stack, the number on the fifth beyond
  const stack = (i, n, cls) => {
    const { x, top } = spot(i);
    for (let k = 0; k < Math.min(n, 5); k++) out.push(`<circle class="gm-ck ${cls}${cls === "mine" && i === sel && k === Math.min(n, 5) - 1 ? " sel" : ""}" cx="${x}" cy="${checkerY(top, k)}" r="${R - 0.5}"/>`);
    if (n > 5) out.push(`<text class="gm-count ${cls}" x="${x}" y="${checkerY(top, 4) + 4}" font-size="11">${n}</text>`);
  };
  for (let i = 1; i <= 24; i++) { if (me[i]) stack(i, me[i], "mine"); if (op[25 - i]) stack(i, op[25 - i], "theirs"); }
  // the bar: theirs above the middle, mine below
  for (let k = 0; k < op[25]; k++) out.push(`<circle class="gm-ck theirs" cx="${BAR_X}" cy="${126 - k * 2 * R - R}" r="${R - 0.5}"/>`);
  for (let k = 0; k < me[25]; k++) out.push(`<circle class="gm-ck mine${sel === 25 && k === me[25] - 1 ? " sel" : ""}" cx="${BAR_X}" cy="${174 + k * 2 * R + R}" r="${R - 0.5}"/>`);
  // borne off: slabs in the tray, mine at the foot, theirs at the head
  for (let k = 0; k < me[0]; k++) out.push(`<rect class="gm-off mine" x="${TRAY_X - 11}" y="${BOT_Y - 8 - k * 7.4}" width="22" height="6.4" rx="1.5"/>`);
  for (let k = 0; k < op[0]; k++) out.push(`<rect class="gm-off theirs" x="${TRAY_X - 11}" y="${TOP + 1.5 + k * 7.4}" width="22" height="6.4" rx="1.5"/>`);
  // the dice: on the right of the bar when they're mine, the left when theirs; spent ones faded
  if (dice.length) {
    const many = dice.length === 2 && dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : dice;
    const mid = (myDice ? RIGHT : LEFT) + 3 * W;
    many.forEach((d, k) => out.push(dieSvg(mid + (k - (many.length - 1) / 2) * 29, 150, d, k < used ? "used" : "")));
  }
  if (cube) out.push(`<g class="gm-cube${owner === -1 ? "" : owner === seat ? " mine" : " theirs"}" transform="translate(${owner === -1 ? 30 : owner === seat ? BAR_X : BAR_X} ${owner === -1 ? 150 : owner === seat ? 274 : 26})"><rect x="-11" y="-11" width="22" height="22" rx="3"/><text y="4.5" font-size="11">${cube === 1 && owner === -1 ? 64 : cube}</text></g>`);
  // where the selected checker may go
  for (const t of targets) {
    if (t === 0) { out.push(`<rect class="gm-target" x="${TRAY_X - 13}" y="170" width="26" height="${BOT_Y - 170}" rx="3"/>`); continue; }
    // the ring where the checker would stand: on top of yours, or on the blot it hits
    const { x, top } = spot(t);
    out.push(`<circle class="gm-target" cx="${x}" cy="${checkerY(top, Math.min(me[t] || 0, 4))}" r="${R - 2.5}"/>`);
  }
  // tap areas: each point's whole column, the bar and the tray
  for (let i = 1; i <= 24; i++) { const { x, top } = spot(i); out.push(`<rect class="gm-hit" data-pt="${i}" x="${x - W / 2}" y="${top ? TOP - 4 : 150}" width="${W}" height="146"/>`); }
  out.push(`<rect class="gm-hit" data-pt="25" x="${BAR_X - 10}" y="150" width="20" height="146"/><rect class="gm-hit" data-pt="0" x="${TRAY_X - 15}" y="150" width="30" height="146"/>`);
  return `<svg class="gm-svg" viewBox="0 0 360 300" role="img" aria-label="The board">${out.join("")}</svg>`;
}
