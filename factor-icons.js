// The small pictures of Factor's seat plates and flying cards, drawn in the same -1..1 square and flat fill as the
// resources' marks (factor-draw.js): a hand of cards, a development card, a road, a Privateer, and a face for each
// development card. No emoji, no files; each carries its words as a title for a screen reader (the plate repeats them).
import { resIcon } from "./factor-draw.js";
import { CARD_NAMES } from "./factor-rules.js";

const svg = (cls, body, label = "") => `<svg class="fc-pi ${cls}" viewBox="-1 -1 2 2" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'} fill="currentColor">${label ? `<title>${label}</title>` : ""}${body}</svg>`;

const SAIL = `<path d="M.04 -.82V.4M.1 -.78L.7 .22H.1ZM-.04 -.5L-.6 .22H-.04Z"/><path d="M-.8 .5H.8L.5 .88H-.5Z"/>`;
const BODIES = {
  hand: `<rect x="-.82" y="-.74" width="1.08" height="1.5" rx=".15" transform="rotate(-16 -.28 .02)" opacity=".55"/><rect x="-.34" y="-.86" width="1.1" height="1.72" rx=".16"/><rect x="-.14" y="-.62" width=".7" height="1.24" rx=".08" fill="none" style="stroke:var(--sheet)" stroke-width=".09"/>`,
  dev: `<rect x="-.55" y="-.86" width="1.1" height="1.72" rx=".16" fill="none" stroke="currentColor" stroke-width=".17"/><path d="M0 -.46L.3 0L0 .46L-.3 0Z"/>`,
  road: `<path d="M-.9 .86L-.24 -.86M.9 .86L.24 -.86" fill="none" stroke="currentColor" stroke-width=".2" stroke-linecap="round"/><path d="M0 .78V.44M0 .12V-.22M0 -.52V-.8" fill="none" stroke="currentColor" stroke-width=".15" stroke-linecap="round"/>`,
  sail: SAIL,
};
/** A plate's pictures: the cards in a hand (a card back), development cards held, the road's length. */
export const handIcon = label => svg("hand", BODIES.hand, label);
export const devIcon = label => svg("dev", BODIES.dev, label);
export const roadIcon = label => svg("road", BODIES.road, label);

/** A Privateer played, shown as a small face-up card on its player's plate. */
export const fleetCard = () => `<span class="fc-mc">${svg("sail", SAIL)}</span>`;

// the development cards' faces: what each one is, drawn to the same square
const FACES = {
  privateer: SAIL,
  patent: `<path d="M0 -.9L.26 -.3L.9 -.24L.42 .2L.56 .86L0 .54L-.56 .86L-.42 .2L-.9 -.24L-.26 -.3Z"/>`,
  causeway: BODIES.road,
  windfall: `<circle cx="0" cy="0" r=".72" fill="none" stroke="currentColor" stroke-width=".18"/><path d="M0 -.34V.34M-.3 -.12Q0 -.4 .3 -.12M-.3 .12Q0 .4 .3 .12" fill="none" stroke="currentColor" stroke-width=".14" stroke-linecap="round"/>`,
  corner: `<path d="M-.8 -.8H-.2V-.62H-.62V-.2H-.8ZM.8 -.8V-.2H.62V-.62H.2V-.8ZM-.8 .8V.2H-.62V.62H-.2V.8ZM.8 .8H.2V.62H.62V.2H.8Z"/><circle cx="0" cy="0" r=".22"/>`,
};
/** A development card face up: its picture on a card. */
export const devFace = kind => `<span class="fc-card dev k-${kind}" title="${CARD_NAMES[kind] || kind}">${svg("face", FACES[kind] || FACES.patent)}</span>`;
/** A resource card face up. */
export const resFace = r => `<span class="fc-card res r${r}">${resIcon(r, "bare")}</span>`;
/** Any card from the back. */
export const cardBack = (cls = "") => `<span class="fc-card back${cls ? ` ${cls}` : ""}"></span>`;
