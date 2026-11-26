// Cabal's five characters drawn once, as SVG paths in a 100-unit square, so the 3D table's cards (party-coup-3d.js paints them
// on a canvas with Path2D) and the page's own cards and tiles (party-coup.js, inline SVG in the character's enamel) show the same
// picture: the Syndic's scales, the Saboteur's bomb with its fuse alight, the Privateer's ship under sail, the Astronomer's
// telescope on its tripod under a star, the Kontor's key. Replaced the emoji on 26 November 2026 (Korbi: "Cabal is ugly make it
// pretty"). Each part is filled unless it says `w` (a stroke that wide); `hi` marks a highlight, drawn lighter.
/** The characters' names as the players see them (ids kept from the game this one follows; party-coup.js says why). */
export const NAMES = { duke: "Syndic", assassin: "Saboteur", captain: "Privateer", ambassador: "Astronomer", contessa: "Kontor" };

export const EMBLEM = {
  duke: [
    { d: "M48 21h4v53h-4z" }, { d: "M50 13a5 5 0 1 0 .01 0z" }, { d: "M33 82h34l-5-8H38z" },
    { d: "M16 29.5h68v4H16z" },
    { d: "M23 33L13 57M23 33L33 57M77 33L67 57M77 33L87 57", w: 1.8 },
    { d: "M9 57h28a14 8 0 0 1-28 0z" }, { d: "M63 57h28a14 8 0 0 1-28 0z" },
  ],
  assassin: [
    { d: "M44 36a24 24 0 1 0 .01 0z" },
    { d: "M56 31l9-9 8 8-9 9z" },
    { d: "M69 26q5-9 13-8", w: 3 },
    { d: "M84 9l2 6 6-2-4 5 5 4-6 1 1 6-4-5-4 5v-6l-6-1 5-4-4-5 6 2z" },
    { d: "M30 52a16 16 0 0 1 12-12", w: 3.5, hi: true },
  ],
  captain: [
    { d: "M12 63h76l-11 15H24z" },
    { d: "M48.5 14h3v49h-3z" },
    { d: "M53 19q24 15 0 40z" },
    { d: "M47 25q-20 13 0 33z" },
    { d: "M51.5 14l13 4-13 4z" },
    { d: "M8 86q7-5 14 0t14 0 14 0 14 0 14 0 14 0", w: 2.4 },
  ],
  ambassador: [
    { d: "M19 63L73 31l5 8.5-54 32z" },
    { d: "M73 27.5l7-4 6.5 11-7 4z" },
    { d: "M14 63l7-4 3.5 6-7 4z" },
    { d: "M47 51L34 88M47 51L49 88M47 51L62 88", w: 2.6 },
    { d: "M84 4l2.4 6.6 7 .3-5.5 4.3 1.9 6.8-5.8-4-5.8 4 1.9-6.8-5.5-4.3 7-.3z" },
  ],
  contessa: [
    { d: "M50 11a16 16 0 1 0 .01 0zM50 19a8 8 0 1 1-.01 0z", rule: "evenodd" },
    { d: "M42 41h16v5H42z" },
    { d: "M46.5 46h7v42h-7z" },
    { d: "M53.5 70h13v6h-13zM53.5 81h9v6h-9z" },
  ],
};

const NS = "http://www.w3.org/2000/svg";
/** The character's picture as an inline SVG in currentColor (its highlights paler), for a page. */
export function emblemNode(card, cls = "cp-glyph") {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", cls);
  svg.setAttribute("aria-hidden", "true");
  for (const p of EMBLEM[card] || []) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", p.d);
    if (p.w) { path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor"); path.setAttribute("stroke-width", p.w); path.setAttribute("stroke-linecap", "round"); }
    else { path.setAttribute("fill", "currentColor"); if (p.rule) path.setAttribute("fill-rule", p.rule); }
    if (p.hi) path.setAttribute("opacity", ".45");
    svg.append(path);
  }
  return svg;
}

/** The character's picture on a canvas, `size` units square at (x, y): its ink, and its highlights in `hi`. */
export function paintEmblem(ctx, card, x, y, size, ink, hi) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = "round";
  for (const p of EMBLEM[card] || []) {
    const path = new Path2D(p.d), colour = p.hi ? hi : ink;
    if (p.w) { ctx.strokeStyle = colour; ctx.lineWidth = p.w; ctx.stroke(path); } else { ctx.fillStyle = colour; ctx.fill(path, p.rule || "nonzero"); }
  }
  ctx.restore();
}
