// Banquet's hands, drawn in ink on the page's paper (no skin), for the table (banquet.js) and the course
// (banquet-course.js): fingers raised from the thumb, as 划拳 counts (one is the thumb, two the thumb and the forefinger:
// pointing a finger at someone is rude); 十五二十's two hands, open or a fist.
const FINGERS = [{ x: 22, w: 8.5, top: 9 }, { x: 31.5, w: 8.5, top: 5 }, { x: 41, w: 8, top: 8 }, { x: 50, w: 7, top: 15 }];
/** A hand showing n fingers (0 a fist, 5 open), mirrored for the other side of the table. */
export function hand(n, { flip = false, cls = "" } = {}) {
  const up = k => n >= k + 2;                 // index (k 0) up from two, middle from three…
  const fingers = FINGERS.map((f, k) => up(k)
    ? `<rect x="${f.x}" y="${f.top}" width="${f.w}" height="${44 - f.top}" rx="${f.w / 2}"/>`
    : `<rect x="${f.x}" y="31" width="${f.w}" height="13" rx="${f.w / 2}"/>`).join("");
  // the thumb's root inside the palm, so it grows from it; the fingers drawn first, the palm over their roots
  const thumb = n >= 1 ? `<rect x="14" y="27" width="10.5" height="33" rx="5.2" transform="rotate(-32 19.5 58)"/>` : `<rect x="21" y="47" width="25" height="10" rx="5"/>`;
  return `<svg class="bq-hand${cls ? ` ${cls}` : ""}" viewBox="0 0 64 82" role="img" aria-label="${n} ${n === 1 ? "finger" : "fingers"}"><g${flip ? ` transform="translate(64 0) scale(-1 1)"` : ""}>
    ${fingers}<rect class="palm" x="19" y="36" width="38" height="38" rx="10"/>${thumb}<path class="cuff" d="M23 74h30"/></g></svg>`;
}
/** 十五二十's two hands: five or nothing each. */
export const pair = (total, flip = false) => `<span class="bq-pair">${hand(total >= 5 ? 5 : 0, { flip })}${hand(total >= 10 ? 5 : 0, { flip })}</span>`;
/** A throw as its game shows it: one hand of fingers, or 十五二十's two. */
export const handOf = (mode, n, flip) => (mode === "shiwu" ? pair(n, flip) : hand(n, { flip }));
