// A card played to the cloth, slid there as itself (Bigtwo, Hearts): see slide().
/** Korbi, 7 Nov 2026: a card played to the middle is the very element that stays on the cloth (as in Guandan): it is slid from the
 *  plate to where it lies, in the cloth's own plane, so what flies and what lies there are one card, and nothing flickers. The plane
 *  is in perspective, so the start is corrected by measuring where the card really lands. */
export function slide(el, from, delay) {
  const r = el.getBoundingClientRect(), kx = r.width / (el.offsetWidth || 1) || 1, ky = r.height / (el.offsetHeight || 1) || 1;
  const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, d = { x: (from.x - at.x) / kx, y: (from.y - at.y) / ky };
  for (let i = 0; i < 5; i++) {
    el.style.transform = `translate(${d.x}px, ${d.y}px)`;
    const m = el.getBoundingClientRect(), ex = from.x - (m.left + m.width / 2), ey = from.y - (m.top + m.height / 2);
    if (Math.abs(ex) < 1 && Math.abs(ey) < 1) break;
    d.x += ex / kx; d.y += ey / ky;
  }
  el.style.transform = "";
  // one plain slide and nothing else (no overshoot, no flip): the card is flat on the cloth the whole way
  el.animate([{ transform: `translate(${d.x}px, ${d.y}px) scale(${Math.max(0.2, Math.min(1, from.h / (r.height || 1))).toFixed(3)})` }, { transform: "none" }],
    { duration: 360, delay, easing: "cubic-bezier(.3, .7, .2, 1)", fill: "backwards" });
}

/** Whether anything should move: not for a watching frame (`quiet`), a hidden page or reduced motion. */
export const mayMove = quiet => !quiet() && !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches;
