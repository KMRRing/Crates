// The game switcher: tapping a game's title opens a full screen of every game in the app, with an Update button
// that reloads the newest version (pwa.js). Going to another game carries the room code, so you stay in the same
// room (rooms.js).
import { hardUpdate } from "./pwa.js";
import { soloCode, duoCode, startSolo, chooseSolo, codesLink, link, unlink, cleanCode, bestOf, shareBests, watchBests, watchPartner, watchDuoRecords, ask, duoHref, soloHref, watchHref, DUO_GAMES, IN_FRAME } from "./suite.js";
import { choice, RETE } from "./menu.js";
// Every logo is its game's object at the instruments' level: navy, brass, parchment and the game's enamel, edged twice
// (a navy contour with a brass line inside) so it holds on the page and on the dial. Each contour's width is drawn
// times --wire, which style.css raises on the selected game; the engraved detail keeps its own fine weight.
// A slatted crate, its frame and brace darker, nailed in brass, for Crates.
const CRATES_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="11" y="15" width="78" height="70" rx="3" fill="#C9952F"/><path d="M22 32H78M22 50H78M22 68H78" stroke="#7b6531" stroke-width="1.6"/><path d="M11 15H89V26H11ZM11 74H89V85H11Z" fill="#8c7031"/><path d="M11 15H22V85H11ZM78 15H89V85H78Z" fill="#8c7031"/><path d="M24.5 71.5L75.5 28.5" stroke="#1C2A34" stroke-width="13" stroke-linecap="butt"/><path d="M24.5 71.5L75.5 28.5" stroke="#8c7031" stroke-width="9"/><rect x="11" y="15" width="78" height="70" rx="3" fill="none" stroke="#1C2A34" style="stroke-width: calc(3.6 * var(--wire, 1))"/><path d="M22 26H78V74H22Z" fill="none" stroke="#1C2A34" stroke-width="1.8"/><rect x="15.5" y="19.5" width="69" height="61" rx="1.5" fill="none" stroke="#E2B865" stroke-width="1.2" opacity=".55"/><g fill="#C8923A" stroke="#1C2A34" stroke-width=".8"><circle cx="16.5" cy="20.5" r="2.1"/><circle cx="83.5" cy="20.5" r="2.1"/><circle cx="16.5" cy="79.5" r="2.1"/><circle cx="83.5" cy="79.5" r="2.1"/><circle cx="16.5" cy="50" r="2.1"/><circle cx="83.5" cy="50" r="2.1"/><circle cx="50" cy="20.5" r="2.1"/><circle cx="50" cy="79.5" r="2.1"/></g></svg>`;
// A certificate of analysis: its table of results and a brass seal with ribbons, for Slate.
const SLATE_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M63 80L58 96L64 92L68 98L70 82Z M77 80L82 96L76 92L72 98L70 82Z" fill="#4A5D6E" stroke="#1C2A34" stroke-width="1.6" stroke-linejoin="round"/><rect x="14" y="5" width="60" height="82" rx="3" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))"/><rect x="19.5" y="10.5" width="49" height="71" rx="1" fill="none" stroke="#C8923A" stroke-width="1.5"/><rect x="25" y="16" width="30" height="5.5" rx="1" fill="#1C2A34"/><path d="M25 26.5H63" stroke="#C8923A" stroke-width="1.2"/><path d="M25 33H43M25 40H43M25 47H43M25 54H43" stroke="#1C2A34" stroke-width="2.3" stroke-linecap="round"/><path d="M49 33H62M49 40H58M49 47H63M49 54H56" stroke="#1C2A34" stroke-width="2.3" stroke-linecap="round" opacity=".55"/><path d="M83 72L80.44 73.84L82.22 76.45L79.18 77.3L79.96 80.36L76.81 80.12L76.5 83.26L73.63 81.96L72.26 84.8L70 82.6L67.74 84.8L66.37 81.96L63.5 83.26L63.19 80.12L60.04 80.36L60.82 77.3L57.78 76.45L59.56 73.84L57 72L59.56 70.16L57.78 67.55L60.82 66.7L60.04 63.64L63.19 63.88L63.5 60.74L66.37 62.04L67.74 59.2L70 61.4L72.26 59.2L73.63 62.04L76.5 60.74L76.81 63.88L79.96 63.64L79.18 66.7L82.22 67.55L80.44 70.16Z" fill="#C8923A" stroke="#1C2A34" stroke-width="1.4" stroke-linejoin="round"/><circle cx="70" cy="72" r="7.6" fill="#4A5D6E" stroke="#E2B865" stroke-width="1.2"/><path d="M66.6 72.2L69 74.6L73.6 69.6" fill="none" stroke="#F3E1BA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
// A riveted hex plate, a verdigris inlay and the delta, for Delta.
const DELTA_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 89.84,27 89.84,73 50,96 10.16,73 10.16,27" fill="#1C2A34" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><polygon points="50,13.5 81.61,31.75 81.61,68.25 50,86.5 18.39,68.25 18.39,31.75" fill="#1F6E66" stroke="#C8923A" stroke-width="2.6" stroke-linejoin="round"/><circle cx="50" cy="9.5" r="1.9" fill="#E2B865"/><circle cx="85.07" cy="29.75" r="1.9" fill="#E2B865"/><circle cx="85.07" cy="70.25" r="1.9" fill="#E2B865"/><circle cx="50" cy="90.5" r="1.9" fill="#E2B865"/><circle cx="14.93" cy="70.25" r="1.9" fill="#E2B865"/><circle cx="14.93" cy="29.75" r="1.9" fill="#E2B865"/><polygon points="50,28 70.5,64 29.5,64" fill="#F3E1BA" stroke="#1C2A34" stroke-width="2.8" stroke-linejoin="round"/><polygon points="50,39.5 61,58.5 39,58.5" fill="none" stroke="#C8923A" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
// A casino chip: its edge inserts, a brass ring and an engraved P, for Punt.
const PUNT_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="45" fill="#2F6B4F" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(0 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(45 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(90 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(135 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(180 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(225 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(270 50 50)"/><rect x="45.5" y="5.5" width="9" height="7" rx="1.2" fill="#F3E1BA" transform="rotate(315 50 50)"/><circle cx="50" cy="50" r="31.5" fill="none" stroke="#C8923A" stroke-width="2.4"/><circle cx="50" cy="50" r="27" fill="#FBF4E4" stroke="#1C2A34" stroke-width="1.6"/><circle cx="50" cy="50" r="22.5" fill="none" stroke="#C8923A" stroke-width="1.4" stroke-dasharray="3.2 2.6"/><path d="M44 63V37H52.5A7.6 7.6 0 0 1 52.5 52.2H44" fill="none" stroke="#1C2A34" stroke-width="5.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// A claret die showing five, a navy one behind it, for Cartel.
const CARTEL_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(14 66 36)"><rect x="47" y="15" width="40" height="40" rx="8" fill="#2B3D4A" stroke="#1C2A34" style="stroke-width: calc(2.8 * var(--wire, 1))"/><rect x="51" y="19" width="32" height="32" rx="5.5" fill="none" stroke="#C8923A" stroke-width="1.2" opacity=".75"/><g fill="#E2B865"><circle cx="57" cy="25" r="3.2"/><circle cx="67" cy="35" r="3.2"/><circle cx="77" cy="45" r="3.2"/></g></g><g transform="rotate(-9 40 60)"><rect x="15" y="35" width="50" height="50" rx="9" fill="#7A1E3A" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))"/><rect x="20" y="40" width="40" height="40" rx="6" fill="none" stroke="#E2B865" stroke-width="1.3" opacity=".7"/><g fill="#F3E1BA" stroke="#C8923A" stroke-width="1"><circle cx="28" cy="48" r="4.4"/><circle cx="52" cy="48" r="4.4"/><circle cx="40" cy="60" r="4.4"/><circle cx="28" cy="72" r="4.4"/><circle cx="52" cy="72" r="4.4"/></g></g></svg>`;

// A target dial, brass ticks round a vermilion ring and the bull, for Spot.
const SPOT_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="#1C2A34" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><circle cx="50" cy="50" r="43" fill="none" stroke="#C8923A" stroke-width="2.2"/><path d="M84.5 50L92 50M87.19 59.96L90.57 60.87M83.34 69.25L86.37 71M77.22 77.22L79.7 79.7M69.25 83.34L71 86.37M59.96 87.19L60.87 90.57M50 84.5L50 92M40.04 87.19L39.13 90.57M30.75 83.34L29 86.37M22.78 77.22L20.3 79.7M16.66 69.25L13.63 71M12.81 59.96L9.43 60.87M15.5 50L8 50M12.81 40.04L9.43 39.13M16.66 30.75L13.63 29M22.78 22.78L20.3 20.3M30.75 16.66L29 13.63M40.04 12.81L39.13 9.43M50 15.5L50 8M59.96 12.81L60.87 9.43M69.25 16.66L71 13.63M77.22 22.78L79.7 20.3M83.34 30.75L86.37 29M87.19 40.04L90.57 39.13" stroke="#E2B865" stroke-width="1.6" stroke-linecap="round"/><circle cx="50" cy="50" r="31" fill="#FBF4E4"/><circle cx="50" cy="50" r="23.5" fill="#B8492A"/><circle cx="50" cy="50" r="16" fill="#FBF4E4"/><circle cx="50" cy="50" r="8.5" fill="#1C2A34"/><circle cx="50" cy="50" r="3.2" fill="#E2B865"/><circle cx="50" cy="50" r="27.2" fill="none" stroke="#1C2A34" stroke-width=".9" opacity=".5"/></svg>`;

// A price tag on its string holding a value inside its brackets (the market you make round the truth), a scale along
// its foot, for Quote.
const QUOTE_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M24 50C16 36 10 24 6 8" fill="none" stroke="#1C2A34" stroke-width="1.8" stroke-linecap="round"/><g transform="rotate(-16 54 52)"><path d="M32 31H84A6 6 0 0 1 90 37V67A6 6 0 0 1 84 73H32L13 52Z" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))" stroke-linejoin="round"/><path d="M34 36H83.5A2 2 0 0 1 85.5 38V66A2 2 0 0 1 83.5 68H34L19.5 52Z" fill="none" stroke="#C8923A" stroke-width="1.4" stroke-linejoin="round"/><circle cx="27" cy="52" r="5" fill="#2B3D4A" stroke="#C8923A" stroke-width="2.2"/><path d="M51 40H45V60H51M73 40H79V60H73" fill="none" stroke="#34478F" stroke-width="4.6" stroke-linejoin="miter"/><circle cx="62" cy="50" r="5" fill="#34478F" stroke="#E2B865" stroke-width="1.2"/><path d="M42 67V64.5M46.75 67V64.5M51.5 67V64.5M56.25 67V64.5M61 67V64.5M65.75 67V64.5M70.5 67V64.5M75.25 67V64.5M80 67V64.5" stroke="#C8923A" stroke-width="1.2"/></g></svg>`;

// A stack of corrugated containers, isometric, as they land on the stage, for Manifest.
const MANIFEST_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="translate(-10.62 -47.3) scale(1.21)"><path d="M50 57L84.64 77L67.32 87L32.68 67Z" fill="#728a9b"/><path d="M84.64 94L67.32 104L67.32 87L84.64 77Z" fill="#274c70"/><path d="M32.68 84L67.32 104L67.32 87L32.68 67Z" fill="#2C5B8A"/><path d="M35.57 84.47L35.57 69.87M38.45 86.13L38.45 71.53M41.34 87.8L41.34 73.2M44.23 89.47L44.23 74.87M47.11 91.13L47.11 76.53M50 92.8L50 78.2M52.89 94.47L52.89 79.87M55.77 96.13L55.77 81.53M58.66 97.8L58.66 83.2M61.55 99.47L61.55 84.87M64.43 101.13L64.43 86.53M81.75 94.47L81.75 79.87M78.87 96.13L78.87 81.53M75.98 97.8L75.98 83.2M73.09 99.47L73.09 84.87M70.21 101.13L70.21 86.53" stroke="#1C2A34" stroke-width="1" opacity=".45"/><path d="M50 57L84.64 77L67.32 87L32.68 67ZM84.64 94L67.32 104L67.32 87L84.64 77ZM32.68 84L67.32 104L67.32 87L32.68 67Z" fill="none" stroke="#1C2A34" style="stroke-width: calc(2.2 * var(--wire, 1))" stroke-linejoin="round"/><path d="M50 57L84.64 77L67.32 87" fill="none" stroke="#E2B865" stroke-width="1" opacity=".8"/><path d="M32.68 67L67.32 87L50 97L15.36 77Z" fill="#b2705b"/><path d="M67.32 104L50 114L50 97L67.32 87Z" fill="#6d302c"/><path d="M15.36 94L50 114L50 97L15.36 77Z" fill="#8F3328"/><path d="M18.25 94.47L18.25 79.87M21.13 96.13L21.13 81.53M24.02 97.8L24.02 83.2M26.91 99.47L26.91 84.87M29.79 101.13L29.79 86.53M32.68 102.8L32.68 88.2M35.57 104.47L35.57 89.87M38.45 106.13L38.45 91.53M41.34 107.8L41.34 93.2M44.23 109.47L44.23 94.87M47.11 111.13L47.11 96.53M64.43 104.47L64.43 89.87M61.55 106.13L61.55 91.53M58.66 107.8L58.66 93.2M55.77 109.47L55.77 94.87M52.89 111.13L52.89 96.53" stroke="#1C2A34" stroke-width="1" opacity=".45"/><path d="M32.68 67L67.32 87L50 97L15.36 77ZM67.32 104L50 114L50 97L67.32 87ZM15.36 94L50 114L50 97L15.36 77Z" fill="none" stroke="#1C2A34" style="stroke-width: calc(2.2 * var(--wire, 1))" stroke-linejoin="round"/><path d="M32.68 67L67.32 87L50 97" fill="none" stroke="#E2B865" stroke-width="1" opacity=".8"/><path d="M45.67 46.5L73.38 62.5L56.06 72.5L28.35 56.5Z" fill="#dfb357"/><path d="M73.38 79.5L56.06 89.5L56.06 72.5L73.38 62.5Z" fill="#9d7827"/><path d="M28.35 73.5L56.06 89.5L56.06 72.5L28.35 56.5Z" fill="#D49A22"/><path d="M31.24 73.97L31.24 59.37M34.12 75.63L34.12 61.03M37.01 77.3L37.01 62.7M39.9 78.97L39.9 64.37M42.78 80.63L42.78 66.03M45.67 82.3L45.67 67.7M48.56 83.97L48.56 69.37M51.44 85.63L51.44 71.03M54.33 87.3L54.33 72.7M70.5 79.97L70.5 65.37M67.61 81.63L67.61 67.03M64.72 83.3L64.72 68.7M61.84 84.97L61.84 70.37M58.95 86.63L58.95 72.03" stroke="#1C2A34" stroke-width="1" opacity=".45"/><path d="M45.67 46.5L73.38 62.5L56.06 72.5L28.35 56.5ZM73.38 79.5L56.06 89.5L56.06 72.5L73.38 62.5ZM28.35 73.5L56.06 89.5L56.06 72.5L28.35 56.5Z" fill="none" stroke="#1C2A34" style="stroke-width: calc(2.2 * var(--wire, 1))" stroke-linejoin="round"/><path d="M45.67 46.5L73.38 62.5L56.06 72.5" fill="none" stroke="#E2B865" stroke-width="1" opacity=".8"/></g></svg>`;

// A cobalt pin whose head is a globe, for Chart.
const CHART_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="94" rx="11" ry="3" fill="#1C2A34" opacity=".22"/><path d="M50 93C42 77 17 62 17 39A33 33 0 1 1 83 39C83 62 58 77 50 93Z" fill="#2C5B8A" stroke="#1C2A34" style="stroke-width: calc(3.2 * var(--wire, 1))" stroke-linejoin="round"/><path d="M50 85C44 73 22.5 60 22.5 39A27.5 27.5 0 1 1 77.5 39C77.5 60 56 73 50 85Z" fill="none" stroke="#C8923A" stroke-width="1.5" stroke-linejoin="round"/><circle cx="50" cy="39" r="19.5" fill="#FBF4E4" stroke="#1C2A34" stroke-width="2"/><g fill="none" stroke="#C8923A" stroke-width="1.4"><ellipse cx="50" cy="39" rx="9.6" ry="19.5"/><path d="M50 19.5V58.5M30.5 39H69.5"/><path d="M33.6 29H66.4M33.6 49H66.4" stroke-width="1"/></g><circle cx="50" cy="39" r="19.5" fill="none" stroke="#1C2A34" stroke-width="2"/></svg>`;

// A brass magnifier over a concession grid, ore in the lens, for Survey.
const SURVEY_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><rect x="6" y="6" width="66" height="66" rx="3" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))"/><path d="M22.5 8V70M39 8V70M55.5 8V70M8 22.5H70M8 39H70M8 55.5H70" stroke="#1C2A34" stroke-width="1" opacity=".35"/><rect x="10" y="10" width="58" height="58" rx="1.5" fill="none" stroke="#C8923A" stroke-width="1.2"/><path d="M11.4 47L13.56 43.76L17.16 44.48L18.6 47.36L16.08 50.06L12.48 49.16Z" fill="#D49A22" stroke="#1C2A34" stroke-width="1"/><path d="M27.8 15L29.72 12.12L32.92 12.76L34.2 15.32L31.96 17.72L28.76 16.92Z" fill="#A2690F" stroke="#1C2A34" stroke-width="1"/><path d="M43.6 30L45.64 26.94L49.04 27.62L50.4 30.34L48.02 32.89L44.62 32.04Z" fill="#D49A22" stroke="#1C2A34" stroke-width="1"/><circle cx="58" cy="57" r="20" fill="#FBF4E4"/><path d="M47 40.3L47 73.7M69 40.3L69 73.7M40.14 48L75.86 48M42.8 70L73.2 70" stroke="#1C2A34" stroke-width="1.6" opacity=".35"/><path d="M49.5 58L54.6 50.35L63.1 52.05L66.5 58.85L60.55 65.22L52.05 63.1Z" fill="#D49A22" stroke="#1C2A34" stroke-width="1"/><path d="M54 54L59 52.5" stroke="#FBF4E4" stroke-width="1.6" stroke-linecap="round"/><path d="M73 72L91 90" stroke="#1C2A34" stroke-width="10" stroke-linecap="round"/><path d="M73 72L91 90" stroke="#2B3D4A" stroke-width="6" stroke-linecap="round"/><path d="M71.5 70.5L76.5 75.5" stroke="#C8923A" stroke-width="9" stroke-linecap="butt"/><circle cx="58" cy="57" r="22.5" fill="none" stroke="#1C2A34" style="stroke-width: calc(2.4 * var(--wire, 1))"/><circle cx="58" cy="57" r="20.4" fill="none" stroke="#C8923A" stroke-width="3.6"/><path d="M47 46A15 15 0 0 1 56 42" fill="none" stroke="#FBF4E4" stroke-width="2" stroke-linecap="round" opacity=".9"/></svg>`;

// A flask, olive inside, its meniscus and graduations in brass, stoppered, for Blend.
const BLEND_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M42 12H58V36L82 78Q86 88 76 88H24Q14 88 18 78L42 36Z" fill="#FBF4E4"/><path d="M29.43 58H70.57L82 78Q86 88 76 88H24Q14 88 18 78Z" fill="#5E7424"/><g fill="#FBF4E4" opacity=".85"><circle cx="38" cy="74" r="2.3"/><circle cx="51" cy="67" r="1.6"/><circle cx="61" cy="78" r="2.7"/><circle cx="45" cy="82" r="1.3"/></g><path d="M29.43 58H70.57" stroke="#E2B865" stroke-width="1.8"/><path d="M44 20H50M44 26H48M44 32H50" stroke="#C8923A" stroke-width="1.3"/><path d="M36.5 46L25.5 66" stroke="#C8923A" stroke-width="1.2" opacity=".7"/><path d="M42 12H58V36L82 78Q86 88 76 88H24Q14 88 18 78L42 36Z" fill="none" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><rect x="39" y="4" width="22" height="9" rx="2" fill="#7A5A36" stroke="#1C2A34" stroke-width="1.8"/><path d="M42 8.5H58" stroke="#E2B865" stroke-width="1" opacity=".6"/></svg>`;

// A copper elbow with bolted flanges and a pressure gauge, the flow running through, for Pipes.
const PIPES_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M14 66H38A26 26 0 0 0 64 40V14" fill="none" stroke="#1C2A34" stroke-width="25"/><path d="M14 66H38A26 26 0 0 0 64 40V14" fill="none" stroke="#A9542B" stroke-width="19"/><path d="M14 60H38A20 20 0 0 0 58 40V14" fill="none" stroke="#E2B865" stroke-width="2.6" opacity=".75"/><path d="M29 66L23 61.5V70.5Z M64 26L59.5 32H68.5Z" fill="#F3E1BA"/><rect x="6" y="50" width="9" height="32" rx="2" fill="#2B3D4A" stroke="#1C2A34" style="stroke-width: calc(2.4 * var(--wire, 1))"/><circle cx="10.5" cy="55" r="1.9" fill="#E2B865"/><circle cx="10.5" cy="77" r="1.9" fill="#E2B865"/><rect x="48" y="6" width="32" height="9" rx="2" fill="#2B3D4A" stroke="#1C2A34" style="stroke-width: calc(2.4 * var(--wire, 1))"/><circle cx="53" cy="10.5" r="1.9" fill="#E2B865"/><circle cx="75" cy="10.5" r="1.9" fill="#E2B865"/><path d="M60 60L69 69" stroke="#1C2A34" stroke-width="5"/><path d="M60 60L69 69" stroke="#C8923A" stroke-width="2.4"/><circle cx="76" cy="76" r="15" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><circle cx="76" cy="76" r="12.4" fill="none" stroke="#C8923A" stroke-width="1.4"/><path d="M68.64 80.25L66.47 81.5M67.63 74.52L65.17 74.09M70.54 69.49L68.93 67.57M76 67.5L76 65M81.46 69.49L83.07 67.57M84.37 74.52L86.83 74.09M83.36 80.25L85.53 81.5" stroke="#1C2A34" stroke-width="1.2" stroke-linecap="round"/><path d="M76 76L68.5 70" stroke="#8F3328" stroke-width="2.2" stroke-linecap="round"/><circle cx="76" cy="76" r="2.2" fill="#C8923A"/></svg>`;

// A distillation column: its trays, its side draws and its ladder, for Refinery.
const REFINERY_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M64 22H84V29" fill="none" stroke="#1C2A34" stroke-width="7.5" stroke-linejoin="round"/><path d="M64 22H84V29" fill="none" stroke="#D49A22" stroke-width="4" stroke-linejoin="round"/><rect x="80" y="28" width="8" height="3" rx="1" fill="#E2B865"/><path d="M64 44H84V51" fill="none" stroke="#1C2A34" stroke-width="7.5" stroke-linejoin="round"/><path d="M64 44H84V51" fill="none" stroke="#2C5B8A" stroke-width="4" stroke-linejoin="round"/><rect x="80" y="50" width="8" height="3" rx="1" fill="#E2B865"/><path d="M64 66H84V73" fill="none" stroke="#1C2A34" stroke-width="7.5" stroke-linejoin="round"/><path d="M64 66H84V73" fill="none" stroke="#7A5A36" stroke-width="4" stroke-linejoin="round"/><rect x="80" y="72" width="8" height="3" rx="1" fill="#E2B865"/><path d="M28 18V88M32 18V88M28 22H32M28 28H32M28 34H32M28 40H32M28 46H32M28 52H32M28 58H32M28 64H32M28 70H32M28 76H32M28 82H32" stroke="#C8923A" stroke-width="1.2"/><path d="M36 88V20A14 14 0 0 1 64 20V88Z" fill="#35607E" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M40 86V20.5A10 10 0 0 1 60 20.5V86" fill="none" stroke="#6e8790" stroke-width="1.2"/><path d="M44 22H61M41 32H58M44 42H61M41 52H58M44 62H61M41 72H58" stroke="#E2B865" stroke-width="1.8" stroke-linecap="round"/><rect x="30" y="86" width="40" height="8" rx="2" fill="#C8923A" stroke="#1C2A34" stroke-width="2"/></svg>`;

// An ivory knight at speed, for Rush.
const RUSH_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M74 30H94M78 42H97M74 54H92" stroke="#C8923A" stroke-width="3.2" stroke-linecap="round"/><path d="M30 72C28 60 34 51 41 46L34 44C28 47 23 48 19 46L16 39C19 30 27 21 35 17L36 9L42 15C56 13 67 23 68 38C69 50 64 60 66 72Z" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M46 20C55 22 61 30 62 42M48 27C54 30 57 35 57.5 42M50 34C53 37 54 40 54 44" fill="none" stroke="#C8923A" stroke-width="1.6" stroke-linecap="round"/><circle cx="33" cy="28" r="2.2" fill="#1C2A34"/><path d="M19.5 41.5L24 40" stroke="#1C2A34" stroke-width="1.6" stroke-linecap="round"/><rect x="26" y="70" width="44" height="8" rx="2" fill="#C8923A" stroke="#1C2A34" stroke-width="2"/><rect x="20" y="78" width="56" height="12" rx="3" fill="#2B3D4A" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><path d="M24 84H72" stroke="#C8923A" stroke-width="1.3"/></svg>`;

// Three cards fanned, the back one enamelled, the front one due for review, for Deck.
const DECK_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-18 50 92)"><rect x="29" y="14" width="42" height="60" rx="4" fill="#6A3D78" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><rect x="33" y="18" width="34" height="52" rx="2" fill="none" stroke="#E2B865" stroke-width="1.2"/><path d="M50 26L60 44L50 62L40 44Z" fill="none" stroke="#E2B865" stroke-width="1.4"/><path d="M50 34L55 44L50 54L45 44Z" fill="#E2B865" opacity=".8"/></g><g transform="rotate(16 50 92)"><rect x="29" y="14" width="42" height="60" rx="4" fill="#F3E1BA" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><rect x="33" y="18" width="34" height="52" rx="2" fill="none" stroke="#C8923A" stroke-width="1.2"/></g><g transform="rotate(0 50 92)"><rect x="29" y="14" width="42" height="60" rx="4" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><rect x="33" y="18" width="34" height="52" rx="2" fill="none" stroke="#C8923A" stroke-width="1.2"/><path d="M38 30H58M38 37H62M38 44H52" stroke="#1C2A34" stroke-width="2.4" stroke-linecap="round"/><path d="M56.5 60A7 7 0 1 1 49.5 53" fill="none" stroke="#6A3D78" stroke-width="2.6" stroke-linecap="round"/><path d="M47 50L50.5 53L47 56.5" fill="none" stroke="#6A3D78" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

// A and 文 in two speech bubbles, for Parley's languages.
const PARLEY_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M16 8H50A10 10 0 0 1 60 18V40A10 10 0 0 1 50 50H24L13 60L15.5 49.5A10 10 0 0 1 6 40V18A10 10 0 0 1 16 8Z" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M16.5 12.5H49.5A6 6 0 0 1 55.5 18.5V39.5A6 6 0 0 1 49.5 45.5H22.8L18.4 49.6L19.4 45A6 6 0 0 1 10.5 39.5V18.5A6 6 0 0 1 16.5 12.5Z" fill="none" stroke="#C8923A" stroke-width="1.2" stroke-linejoin="round"/><path d="M23 40L33 16L43 40M26.6 31.5H39.4" fill="none" stroke="#1C2A34" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 40H84A10 10 0 0 1 94 50V72A10 10 0 0 1 84.5 82L87 92L76 82H50A10 10 0 0 1 40 72V50A10 10 0 0 1 50 40Z" fill="#22706A" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M50.5 44.5H83.5A6 6 0 0 1 89.5 50.5V71.5A6 6 0 0 1 83.5 77.5H50.5A6 6 0 0 1 44.5 71.5V50.5A6 6 0 0 1 50.5 44.5Z" fill="none" stroke="#E2B865" stroke-width="1.2" opacity=".85"/><path d="M67 46.5V50.5M55 54H79M59.5 58C63 67 70 73 80 76M74.5 58C71 67 64 73 54 76" fill="none" stroke="#F3E1BA" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// A gilt-rimmed glass of bordeaux, for Brut.
const BRUT_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M28 10H72C74 34 70 52 50 58C30 52 26 34 28 10Z" fill="#FBF4E4" opacity=".95"/><path d="M28.25 31H71.75L71.71 31.29L71.47 32.74L71.19 34.15L70.88 35.54L70.53 36.89L70.14 38.21L69.72 39.5L69.25 40.75L68.74 41.97L68.19 43.16L67.6 44.31L66.96 45.42L66.28 46.5L65.55 47.55L64.77 48.55L63.95 49.52L63.08 50.45L62.16 51.34L61.18 52.2L60.16 53.01L59.08 53.78L57.95 54.51L56.77 55.2L55.53 55.85L54.23 56.45L52.88 57.01L51.47 57.53L50 58L50 58L48.53 57.53L47.12 57.01L45.77 56.45L44.47 55.85L43.23 55.2L42.05 54.51L40.92 53.78L39.84 53.01L38.82 52.2L37.84 51.34L36.92 50.45L36.05 49.52L35.23 48.55L34.45 47.55L33.72 46.5L33.04 45.42L32.4 44.31L31.81 43.16L31.26 41.97L30.75 40.75L30.28 39.5L29.86 38.21L29.47 36.89L29.12 35.54L28.81 34.15L28.53 32.74L28.29 31.29Z" fill="#7A1E3A"/><ellipse cx="50" cy="31" rx="21.75" ry="2.6" fill="#984f5a"/><path d="M34 15C32 27 33 38 38 47" fill="none" stroke="#FBF4E4" stroke-width="2.4" stroke-linecap="round" opacity=".9"/><path d="M28 10H72C74 34 70 52 50 58C30 52 26 34 28 10Z" fill="none" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M28.5 10H71.5" stroke="#E2B865" stroke-width="2"/><path d="M50 58V84" stroke="#1C2A34" stroke-width="7"/><path d="M50 59V84" stroke="#FBF4E4" stroke-width="3"/><ellipse cx="50" cy="87" rx="21" ry="5.5" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(2.6 * var(--wire, 1))"/><ellipse cx="50" cy="87" rx="16" ry="3" fill="none" stroke="#C8923A" stroke-width="1.2"/></svg>`;
// An open ledger with brass corners: a column of figures, a rising line, a ribbon from the spine, for Ledger, the record of how
// well you learn.
const LEDGER_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M47.5 82V97L50 93.5L52.5 97V82Z" fill="#8F3328" stroke="#1C2A34" stroke-width="1.4" stroke-linejoin="round"/><path d="M50 21C41 16 25 15 10 18V80C25 77 41 78 50 83Z" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M50 21C59 16 75 15 90 18V80C75 77 59 78 50 83Z" fill="#FBF4E4" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M14.5 21.5V76.5M85.5 21.5V76.5" stroke="#C8923A" stroke-width="1.3"/><path d="M50 21V83" stroke="#1C2A34" stroke-width="1.8"/><path d="M18.5 31H31M18.5 38.5H31M18.5 46H31M18.5 53.5H31M18.5 61H31M18.5 68.5H31" stroke="#1C2A34" stroke-width="2.3" stroke-linecap="round"/><path d="M35 31H44M35 38.5H41M35 46H45M35 53.5H40M35 61H43M35 68.5H42" stroke="#1C2A34" stroke-width="2.3" stroke-linecap="round" opacity=".5"/><path d="M57 31V69H84" fill="none" stroke="#C8923A" stroke-width="1.5"/><path d="M57 50H84M70.5 31V69" stroke="#1C2A34" stroke-width=".9" opacity=".3"/><path d="M58 64L64 57L70 60L76 47L83 35" fill="none" stroke="#2C5B8A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/><g fill="#E2B865" stroke="#1C2A34" stroke-width=".9"><circle cx="58" cy="64" r="2.1"/><circle cx="64" cy="57" r="2.1"/><circle cx="70" cy="60" r="2.1"/><circle cx="76" cy="47" r="2.1"/><circle cx="83" cy="35" r="2.1"/></g><g fill="#C8923A" stroke="#1C2A34" stroke-width="1.1" stroke-linejoin="round"><path d="M10 18L19 17.2L10 26.5Z"/><path d="M90 18L81 17.2L90 26.5Z"/><path d="M10 80L19 78.6L10 71.5Z"/><path d="M90 80L81 78.6L90 71.5Z"/></g></svg>`;

// A tanker seen from above, as the ships are on Harbour's map: bow up and to the right, the domes of its cargo tanks
// along the deck, the manifold across it, the bridge and funnel aft.
const HARBOUR_LOGO = `<svg viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(45 50 50)"><path d="M50 4C61 14 66 25 66 36V86Q66 95 57 95H43Q34 95 34 86V36C34 25 39 14 50 4Z" fill="#35607E" stroke="#1C2A34" style="stroke-width: calc(3 * var(--wire, 1))" stroke-linejoin="round"/><path d="M50 10C58.5 18.5 61 27 61 36V68H39V36C39 27 41.5 18.5 50 10Z" fill="#2c4d64" stroke="#C8923A" stroke-width="1.3"/><path d="M50 16V66" stroke="#E2B865" stroke-width="1.5"/><path d="M39.5 44H60.5" stroke="#E2B865" stroke-width="2.2"/><g fill="#F3E1BA" stroke="#C8923A" stroke-width="1"><circle cx="50" cy="24" r="3.3"/><circle cx="50" cy="33" r="3.3"/><circle cx="50" cy="53" r="3.3"/><circle cx="50" cy="61" r="3.3"/></g><rect x="40" y="71" width="20" height="13" rx="2" fill="#FBF4E4" stroke="#1C2A34" stroke-width="1.6"/><path d="M43 75.5H57M43 79.5H57" stroke="#1C2A34" stroke-width="1" opacity=".5"/><rect x="45.5" y="85.5" width="9" height="5.5" rx="1.5" fill="#8F3328" stroke="#1C2A34" stroke-width="1.2"/></g></svg>`;
// Each theme draws the games its own way: Almanac's instruments (above), Modern's logos as they were before Almanac,
// Kontor's technical line icons. theme.js has set the theme before this runs.
const MODERN_LOGOS = {
  crates: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.8" y="2.8" width="16.4" height="14.4" rx="2.6" fill="var(--cr-logo-tint)" stroke="var(--cr-logo-edge)" stroke-width="1.6"/>
  <path d="M2.6 6.6H17.4M2.6 13.4H17.4M5 13.4L15 6.6" fill="none" stroke="var(--cr-logo-edge)" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  slate: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="2.2" y="1.6" width="13.4" height="16.8" rx="1.8" fill="var(--sl-logo-tint)" stroke="var(--sl-logo-edge)" stroke-width="1.5"/>
  <path d="M5 5.4H12.8M5 8.2H12.8M5 11H9.6" fill="none" stroke="var(--sl-logo-edge)" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M13.2 16.4L12.4 19.4L14.4 18.4L16.4 19.4L15.6 16.4" fill="var(--sl-logo-edge)" stroke="var(--sl-logo-edge)" stroke-width=".6" stroke-linejoin="round"/>
  <circle cx="14.4" cy="14.2" r="3.1" fill="var(--sl-logo-tint)" stroke="var(--sl-logo-edge)" stroke-width="1.4"/>
  <circle cx="14.4" cy="14.2" r="1.4" fill="var(--sl-logo-edge)"/></svg>`,
  delta: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <polygon points="10,1.5 17.5,5.8 17.5,14.2 10,18.5 2.5,14.2 2.5,5.8" fill="var(--d-logo-tint)" stroke="var(--d-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M10 5.6 L14.2 13.6 H5.8 Z" fill="none" stroke="var(--d-logo-edge)" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  punt: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="8.6" fill="var(--pt-logo-tint)" stroke="var(--pt-logo-edge)" stroke-width="1.6"/>
  <circle cx="10" cy="10" r="5.2" fill="none" stroke="var(--pt-logo-edge)" stroke-width="1.3" stroke-dasharray="2.2 1.9"/>
  <text x="10" y="13.4" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="9" fill="var(--pt-logo-edge)">P</text></svg>`,
  cartel: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="2.2" y="2.2" width="15.6" height="15.6" rx="3.4" fill="var(--ct-logo-tint)" stroke="var(--ct-logo-edge)" stroke-width="1.6"/>
  <g fill="var(--ct-logo-edge)"><circle cx="6.4" cy="6.4" r="1.35"/><circle cx="13.6" cy="6.4" r="1.35"/><circle cx="10" cy="10" r="1.35"/>
  <circle cx="6.4" cy="13.6" r="1.35"/><circle cx="13.6" cy="13.6" r="1.35"/></g></svg>`,
  spot: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <circle cx="10" cy="10" r="8.4" fill="var(--sp-logo-tint)" stroke="var(--sp-logo-edge)" stroke-width="1.6"/>
  <circle cx="10" cy="10" r="4.6" fill="none" stroke="var(--sp-logo-edge)" stroke-width="1.5"/>
  <circle cx="10" cy="10" r="1.8" fill="var(--sp-logo-edge)"/></svg>`,
  quote: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M6.4 3.4H16.3a2.2 2.2 0 0 1 2.2 2.2v8.8a2.2 2.2 0 0 1-2.2 2.2H6.4L1.5 10z" fill="var(--qt-logo-tint)" stroke="var(--qt-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="5.3" cy="10" r="1.15" fill="none" stroke="var(--qt-logo-edge)" stroke-width="1.25"/>
  <path d="M10.2 6.6H9V13.4H10.2M15.3 6.6H16.5V13.4H15.3" fill="none" stroke="var(--qt-logo-edge)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="12.75" cy="10" r="1.7" fill="var(--qt-logo-edge)"/></svg>`,
  manifest: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 6.2 L13.98 8.5 L10 10.8 L6.02 8.5Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 8.5 L10 10.8 L10 15.4 L6.02 13.1Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 10.8 L13.98 8.5 L13.98 13.1 L10 15.4Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 1.6 L13.98 3.9 L10 6.2 L6.02 3.9Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 3.9 L10 6.2 L10 10.8 L6.02 8.5Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 6.2 L13.98 3.9 L13.98 8.5 L10 10.8Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M13.98 8.5 L17.97 10.8 L13.98 13.1 L10 10.8Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M10 10.8 L13.98 13.1 L13.98 17.7 L10 15.4Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M13.98 13.1 L17.97 10.8 L17.97 15.4 L13.98 17.7Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 8.5 L10 10.8 L6.02 13.1 L2.03 10.8Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M2.03 10.8 L6.02 13.1 L6.02 17.7 L2.03 15.4Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/>
  <path d="M6.02 13.1 L10 10.8 L10 15.4 L6.02 17.7Z" fill="var(--mf-logo-tint)" stroke="var(--mf-logo-edge)" stroke-width="1.25" stroke-linejoin="round"/></svg>`,
  chart: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M10 18.8L4.84 11.79A6.4 6.4 0 1 1 15.16 11.79Z" fill="var(--ch-logo-tint)" stroke="var(--ch-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <circle cx="10" cy="8" r="3.4" fill="none" stroke="var(--ch-logo-edge)" stroke-width="1.25"/>
  <ellipse cx="10" cy="8" rx="1.4" ry="3.4" fill="none" stroke="var(--ch-logo-edge)" stroke-width="1.05"/>
  <path d="M6.6 8h6.8" stroke="var(--ch-logo-edge)" stroke-width="1.05"/></svg>`,
  survey: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M13.3 13.3L17.8 17.8" stroke="var(--sv-logo-edge)" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="8.7" cy="8.7" r="6.7" fill="var(--sv-logo-tint)" stroke="var(--sv-logo-edge)" stroke-width="1.6"/>
  <path d="M6.9 3.6v10.2M10.5 3.6v10.2M3.6 6.9h10.2M3.6 10.5h10.2" stroke="var(--sv-logo-edge)" stroke-width="1" opacity=".45"/>
  <path d="M8.7 7.1L10.3 8.7 8.7 10.3 7.1 8.7Z" fill="var(--sv-logo-edge)"/></svg>`,
  blend: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--bl-logo-tint)" stroke="var(--bl-logo-edge)" stroke-width="1.6"/>
  <path d="M8.2 5h3.6v3.2l2.9 5.1a1.2 1.2 0 0 1-1 1.8H6.3a1.2 1.2 0 0 1-1-1.8l2.9-5.1z" fill="none" stroke="var(--bl-logo-edge)" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M6.6 12.2h6.8l.9 1.6a.6.6 0 0 1-.5.9H6.2a.6.6 0 0 1-.5-.9z" fill="var(--bl-logo-edge)"/></svg>`,
  pipes: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M2.4 4.2H9.6A7.4 7.4 0 0 1 17 11.6V17.4H10.6V11.6A1 1 0 0 0 9.6 10.6H2.4Z" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.6" stroke-linejoin="round"/>
  <rect x="1.2" y="2.9" width="2.4" height="9" rx=".7" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.4"/>
  <rect x="9.3" y="16.3" width="9" height="2.4" rx=".7" fill="var(--pi-logo-tint)" stroke="var(--pi-logo-edge)" stroke-width="1.4"/>
  <path d="M5.9 5.8L7.5 7.4 5.9 9M12.2 12.5L13.8 14.1 15.4 12.5" fill="none" stroke="var(--pi-logo-edge)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  refinery: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--rf-logo-tint)" stroke="var(--rf-logo-edge)" stroke-width="1.6"/>
  <rect x="8" y="4.5" width="4" height="11" rx="1.6" fill="none" stroke="var(--rf-logo-edge)" stroke-width="1.5"/>
  <path d="M8 8h4M8 11h4M12 6.5h2.5M12 9.5h2.5M12 12.5h2.5M5.5 15.5h9" stroke="var(--rf-logo-edge)" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  rush: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="4.2" y="15.8" width="11.6" height="2.4" rx=".9" fill="var(--ru-logo-tint)" stroke="var(--ru-logo-edge)" stroke-width="1.4"/>
  <path d="M5.6 15.8C5.6 13.4 6.9 12.2 8.6 11.3C7.6 11.6 6.4 11.9 5.4 11.6C4.4 11.3 3.7 10.4 4.1 9.4L6.3 6.4C7 5.4 8 4.9 8.9 4.6L9.6 2.6L10.9 4.5C13.9 5.2 15.6 8.2 15.6 11.6C15.6 13.4 15 14.8 14.4 15.8Z" fill="var(--ru-logo-tint)" stroke="var(--ru-logo-edge)" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="8.1" cy="7.3" r=".85" fill="var(--ru-logo-edge)"/>
  <path d="M11.6 5.6C13.5 6.8 14.2 9 14.1 11.4" fill="none" stroke="var(--ru-logo-edge)" stroke-width="1.1" stroke-linecap="round"/>
  <path d="M17 8.2h1.8M16.8 10.8h2.2M17 13.4h1.8" stroke="var(--ru-logo-edge)" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  deck: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="3" y="3.8" width="10" height="13.4" rx="1.8" transform="rotate(-13 8 17.2)" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.5"/>
  <rect x="7" y="3" width="10.2" height="13.6" rx="1.8" transform="rotate(5 12.1 16.6)" fill="var(--dk-logo-tint)" stroke="var(--dk-logo-edge)" stroke-width="1.5"/>
  <path d="M14.19 8.23A2.6 2.6 0 1 1 11.31 7.46" fill="none" stroke="var(--dk-logo-edge)" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M11.75 8.65 L12.75 6.93 L10.87 6.26Z" fill="var(--dk-logo-edge)" stroke="var(--dk-logo-edge)" stroke-width=".7" stroke-linejoin="round"/></svg>`,
  parley: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <path d="M4.2 2.2H10a2.6 2.6 0 0 1 2.6 2.6v3.4a2.6 2.6 0 0 1-2.6 2.6H5.2L2.4 13V10.6A2.6 2.6 0 0 1 1.6 8.2V4.8A2.6 2.6 0 0 1 4.2 2.2Z" fill="var(--pa-logo-edge)" stroke="var(--pa-logo-edge)" stroke-width="1.2" stroke-linejoin="round"/>
  <text x="7.1" y="9.1" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="800" font-size="6.6" fill="var(--pa-logo-tint)">A</text>
  <path d="M10 7.6H15.8a2.6 2.6 0 0 1 2.6 2.6v3.6a2.6 2.6 0 0 1-2.6 2.6H15.2v2.4L12.4 16.4H10a2.6 2.6 0 0 1-2.6-2.6V10.2A2.6 2.6 0 0 1 10 7.6Z" fill="var(--pa-logo-tint)" stroke="var(--pa-logo-edge)" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M12.9 9.4v.8M10.6 10.7h4.6M11.2 11.4C11.9 13.4 13.1 14.6 15 15.2M14.6 11.4C13.9 13.4 12.7 14.6 10.8 15.2" fill="none" stroke="var(--pa-logo-edge)" stroke-width="1.15" stroke-linecap="round"/></svg>`,
  brut: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--br-logo-tint)" stroke="var(--br-logo-edge)" stroke-width="1.6"/>
  <path d="M6.6 5.4h6.8c.2 3.4-1.2 5.6-3.4 5.8-2.2-.2-3.6-2.4-3.4-5.8z" fill="none" stroke="var(--br-logo-edge)" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M7 8h6c-.4 1.9-1.5 3-3 3.1-1.5-.1-2.6-1.2-3-3.1z" fill="var(--br-logo-edge)"/>
  <path d="M10 11.2v3.3M7.6 14.8h4.8" stroke="var(--br-logo-edge)" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  ledger: `<svg viewBox="0 0 20 20" aria-hidden="true">
  <rect x="1.5" y="2.5" width="17" height="15" rx="3.2" fill="var(--lg-logo-tint)" stroke="var(--lg-logo-edge)" stroke-width="1.6"/>
  <path d="M10 6.3C8.5 5.4 6.2 5.3 4.6 5.7V14.3C6.2 13.9 8.5 14 10 14.9C11.5 14 13.8 13.9 15.4 14.3V5.7C13.8 5.3 11.5 5.4 10 6.3Z" fill="none" stroke="var(--lg-logo-edge)" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M10 6.3V14.9M6.2 8.6H8.5M6.2 10.5H8.5M6.2 12.4H8" stroke="var(--lg-logo-edge)" stroke-width="1" stroke-linecap="round"/>
  <path d="M11.4 12.2L12.7 10.6L13.6 11.2L14.6 8.7" fill="none" stroke="var(--lg-logo-edge)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  harbour: `<svg viewBox="0 0 20 20" aria-hidden="true"><g transform="rotate(45 10 10)">
  <path d="M10 1.2C12.7 2.9 13.7 5.2 13.7 7.4V16.8Q13.7 18.6 11.9 18.6H8.1Q6.3 18.6 6.3 16.8V7.4C6.3 5.2 7.3 2.9 10 1.2Z" fill="var(--hb-logo-tint)" stroke="var(--hb-logo-edge)" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="7.6" y="14.3" width="4.8" height="2.7" rx=".6" fill="var(--hb-logo-edge)"/>
  <g fill="var(--hb-logo-edge)"><circle cx="10" cy="6.3" r="1"/><circle cx="10" cy="9" r="1"/><circle cx="10" cy="11.7" r="1"/></g></g></svg>`,
};
const KONTOR_LOGOS = {
  crates: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7"/><rect x="13.5" y="3.5" width="7" height="7"/><rect x="3.5" y="13.5" width="7" height="7"/><rect class="a" x="13.5" y="13.5" width="7" height="7"/></svg>`,
  slate: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17"/><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17"/><rect class="f" x="9.2" y="9.2" width="5.6" height="5.6"/></svg>`,
  delta: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8 20.6 19H3.4z"/><path class="a" d="M12 10.5 15.7 17H8.3z"/></svg>`,
  punt: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><circle class="a" cx="12" cy="12" r="4.2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/></svg>`,
  cartel: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><rect class="f" x="7" y="7" width="2.6" height="2.6"/><rect class="f" x="10.7" y="10.7" width="2.6" height="2.6"/><rect class="f" x="14.4" y="14.4" width="2.6" height="2.6"/></svg>`,
  spot: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><rect class="f" x="10.6" y="10.6" width="2.8" height="2.8"/></svg>`,
  quote: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 19V5M3.8 8.2 7 5l3.2 3.2"/><path class="a" d="M17 5v14M13.8 15.8 17 19l3.2-3.2"/></svg>`,
  manifest: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="13.5" width="8" height="6"/><rect x="12.5" y="13.5" width="8" height="6"/><rect class="a" x="8" y="6.5" width="8" height="6"/></svg>`,
  chart: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"/><rect class="f" x="10.5" y="8.5" width="3" height="3"/></svg>`,
  harbour: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 15.5h17l-2.5 4h-12z"/><path d="M7 15.5v-5h10v5"/><path class="a" d="M10 10.5v-4h4v4"/></svg>`,
  pipes: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7h9a5 5 0 0 1 5 5v8.5"/><path class="a" d="M3.5 12h8.5v8.5"/></svg>`,
  rush: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3 5 13.5h6l-1 7.5 8.5-10.5h-6z"/></svg>`,
  deck: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6.5" width="12" height="14"/><path class="a" d="M8 6.5V3.5h12v14h-4"/></svg>`,
  parley: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 4.5h11v8h-6l-3 3v-3h-2z"/><path class="a" d="M17.5 8.5h3v8h-2v3l-3-3h-5v-1.5"/></svg>`,
  survey: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="3.5" width="7" height="5"/><path d="M12 8.5v3.5M12 12l-5.5 8.5M12 12l5.5 8.5"/><path class="a" d="M12 12v8.5"/></svg>`,
  blend: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3.5v6l-5 10h16l-5-10v-6M7.5 3.5h9"/><path class="a" d="M6.3 15h11.4"/></svg>`,
  refinery: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="17"/><path d="M9 8h6M9 12.5h6M9 17h6"/><path class="a" d="M15 6h4.5M15 10.5h4.5M15 15h4.5"/></svg>`,
  brut: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5h8c0 5-1.5 8-4 8s-4-3-4-8z"/><path d="M12 11.5v8.5M8.5 20.5h7"/><path class="a" d="M8.4 7h7.2"/></svg>`,
  ledger: `<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5.3 6.5 5 4 5.6V18.4C6.5 17.8 10 18.1 12 19.3C14 18.1 17.5 17.8 20 18.4V5.6C17.5 5 14 5.3 12 6.5Z"/><path d="M12 6.5V19.3M6.5 9.5H9.5M6.5 12H9.5M6.5 14.5H9"/><path class="a" d="M13.8 15L15.6 12.6L16.8 13.5L18.4 9.8"/></svg>`,
};
const LOOK = document.documentElement.dataset.theme;
// the games screen's title mark: Almanac's sextant in brass on navy, Modern's flat on a rounded tile (logo-modern.svg),
// Kontor's in line, its scale and index arm in green: three versions of the same sextant
const BRAND = LOOK === "modern" ? '<img src="logo-modern.svg" alt="">'
  : LOOK === "kontor" ? '<svg class="k-ico k-brand" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.8L3.9 19.1A17.3 17.3 0 0 0 20.1 19.1Z"/><path d="M7.7 11.9A9.1 9.1 0 0 0 16.3 11.9"/><path class="a" d="M6.1 20.1L6.7 18.5M9 20.8L9.3 19.2M12 21.1V19.4M15 20.8L14.7 19.2M17.9 20.1L17.3 18.5M12 3.8L14.5 19.5"/><circle class="f" cx="12" cy="3.8" r="1.2"/></svg>'
  : '<img src="logo.svg" alt="">';
// Settings' tile: in Almanac the rete, the device every game's options button wears; in Kontor the sliders in line
const K_SETTINGS = '<svg class="k-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><path class="a" d="M14 5h4v4h-4zM8 15h4v4H8z"/></svg>';
const LOGO = (id, almanac) => (LOOK === "modern" ? MODERN_LOGOS[id] : LOOK === "kontor" ? KONTOR_LOGOS[id] : null) || almanac;

export const APPS = [
  { id: "crates", name: "Crates", href: "./crates.html", logo: LOGO("crates", CRATES_LOGO) },
  { id: "glyph", name: "Slate", href: "./slate.html", logo: LOGO("slate", SLATE_LOGO) },
  { id: "delta", name: "Delta", href: "./delta.html", logo: LOGO("delta", DELTA_LOGO) },
  { id: "punt", name: "Punt", href: "./punt.html", logo: LOGO("punt", PUNT_LOGO) },
  { id: "cartel", name: "Cartel", href: "./cartel.html", logo: LOGO("cartel", CARTEL_LOGO) },
  { id: "spot", name: "Spot", href: "./spot.html", logo: LOGO("spot", SPOT_LOGO) },
  { id: "quote", name: "Quote", href: "./quote.html", logo: LOGO("quote", QUOTE_LOGO) },
  { id: "manifest", name: "Manifest", href: "./manifest.html", logo: LOGO("manifest", MANIFEST_LOGO) },
  { id: "chart", name: "Chart", href: "./chart.html", logo: LOGO("chart", CHART_LOGO) },
  { id: "harbour", name: "Harbour", href: "./harbour.html", logo: LOGO("harbour", HARBOUR_LOGO) },
  { id: "survey", name: "Survey", href: "./survey.html", logo: LOGO("survey", SURVEY_LOGO), more: true },
  { id: "blend", name: "Blend", href: "./blend.html", logo: LOGO("blend", BLEND_LOGO), more: true },
  { id: "pipes", name: "Pipes", href: "./pipes.html", logo: LOGO("pipes", PIPES_LOGO) },
  { id: "refinery", name: "Refinery", href: "./refinery.html", logo: LOGO("refinery", REFINERY_LOGO), more: true },
  { id: "rush", name: "Rush", href: "./rush.html", logo: LOGO("rush", RUSH_LOGO) },
  { id: "deck", name: "Deck", href: "./deck.html", logo: LOGO("deck", DECK_LOGO) },
  { id: "parley", name: "Parley", href: "./parley.html", logo: LOGO("parley", PARLEY_LOGO) },
  { id: "brut", name: "Brut", href: "./brut.html", logo: LOGO("brut", BRUT_LOGO), more: true },
  { id: "ledger", name: "Ledger", href: "./ledger.html", logo: LOGO("ledger", LEDGER_LOGO), more: true },
];

/** Makes the title button open the switcher; current is the id of the game on screen. */
// Settings, behind More: the theme (Deco, Modern or Kontor; each with a day and a night that follow the system).
// The choice lives on this device and applies at once, here and on every page (theme.js reads it before drawing).
const THEMES = [["deco", "Almanac"], ["modern", "Modern"], ["kontor", "Kontor"]];
const MODES = [["auto", "Auto"], ["day", "Day"], ["night", "Night"]];
export const theme = () => document.documentElement.dataset.theme || "deco";
const mode = () => document.documentElement.dataset.mode || "auto";
/** Keeps a look on this device and redraws the page in it (the logos and the menu button are the theme's own). */
function keep(key, value, fallback) {
  try { if (value === fallback) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* private mode */ }
  try { sessionStorage.setItem("crates:games", "1"); } catch { /* private mode */ }   // come back to the games screen
  location.reload();
}
function openSettings(host) {
  let sheet = host.querySelector("dialog.apps-settings");
  if (!sheet) {
    sheet = document.createElement("dialog");
    sheet.className = "apps-pop apps-settings";
    sheet.setAttribute("aria-label", "Settings");
    sheet.innerHTML = `<div class="pick-head"><h2>Settings</h2><button class="icon-btn" type="button" data-close aria-label="Close">${ICON.close}</button></div><div class="settings-body"></div>`;
    sheet.querySelector("[data-close]").addEventListener("click", () => sheet.close());
    sheet.addEventListener("click", e => { if (e.target === sheet) sheet.close(); });
    host.appendChild(sheet);
  }
  sheet.querySelector(".settings-body").replaceChildren(
    choice("Theme", THEMES, theme(), t => keep("suite:theme", t, "deco")),
    choice("Appearance", MODES, mode(), m => keep("suite:mode", m, "auto")));
  sheet.showModal();
}

const tiles = (apps, current) => apps.map(a => `<li><a class="app-row${a.id === current ? " cur" : ""}" href="${a.href}"${a.id === current ? ' aria-current="page"' : ""}>
      <span class="app-logo">${a.logo}</span><b class="app-name${a.name.length >= 8 ? " long" : ""}">${a.name}</b>${a.id === current ? '<small class="app-now">Playing</small>' : ""}<small class="app-best" data-best="${a.id}"></small></a></li>`).join("");
const short = n => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}m` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toFixed(2));
// the head's icons: one person (your solo code), two (your partner code), refresh (update), and close
const ICON = {
  solo: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.6-4 3.6-6.2 7.5-6.2s6.9 2.2 7.5 6.2"/></svg>',
  duo: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8.5" cy="8.5" r="3.1"/><path d="M2.5 19.5c.5-3.4 2.9-5.3 6-5.3s5.5 1.9 6 5.3"/><circle cx="16.5" cy="8" r="2.7"/><path d="M15.2 13.9c3.3-.3 5.7 1.5 6.3 5.1"/></svg>',
  update: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.2v4.6h-4.6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/></svg>',
  tick: '<svg class="code-tick" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};
/**
 * The games screen's head, in one line: your solo code (one person: every device with it is in the same state in every
 * game) and your partner code (two people), then what your partner is playing. Tapping a code copies this page's link
 * with it (solo: both codes, for your other devices; partner: the partner code, for your partner); holding a code (or
 * tapping it while there's none) lets you type one: one nobody has yet starts fresh, so you can pick your own. Tapping
 * your partner's line opens the partner sheet. Each tile shows its best, your partner's, and your duo record.
 */
const GAME_NAME = id => APPS.find(a => a.id === (id === "slate" ? "glyph" : id))?.name || id;
function bindCodes(dlg) {
  const head = dlg.querySelector("[data-codes]");
  let partner = null, theirs = {}, theirName = "", duoRecords = {};
  const here = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "").replace(/^index$|^$/, "");   // "" at home: no game open
  const status = p => (p ? `${(p.name || "Partner").split(" ")[0]} · ${!p.online ? "offline" : !p.game ? "choosing a game" : `${GAME_NAME(p.game)}${p.mode === "duo" ? " together" : p.mode === "watch" ? " (watching)" : ""}`}` : "not here yet");
  const draw = () => {
    const solo = soloCode(), duo = duoCode();
    // a tick: syncing (solo) or linked (partner); the codes themselves are in the links a tap copies, and in the box a hold opens
    head.innerHTML = `<button class="code-chip${solo ? " set" : ""}" type="button" data-solo aria-label="Your solo code${solo ? ` ${solo}, syncing: tap to copy its link, hold to change it` : ": tap to set it"}">${ICON.solo}${solo ? ICON.tick : "<b>+</b>"}</button>
      <button class="code-chip${duo ? " set" : ""}" type="button" data-duo aria-label="Your partner code${duo ? ` ${duo}, linked: tap to copy its link, hold to change it` : ": tap to set it"}">${ICON.duo}${duo ? ICON.tick : "<b>+</b>"}</button>
      ${duo ? `<button class="partner-line${partner?.online ? " on" : ""}" type="button" data-pair></button>` : ""}`;
    if (duo) head.querySelector("[data-pair]").textContent = status(partner);
    for (const el of dlg.querySelectorAll("[data-best]")) {
      const id = el.dataset.best, mine = bestOf(id), them = theirs[id];
      // three scores: your solo best, your partner's (by initial), and the pair's duo record (team best, or wins each way)
      const d = duo && duoRecords[id === "glyph" ? "slate" : id], time = n => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
      const duoText = !d?.n ? "" : d.coop ? `Duo ${d.best == null ? `${d.wins}/${d.n}` : d.lower ? time(d.best) : short(d.best)}` : `Duo ${d.mine}–${d.theirs}`;
      el.textContent = [mine != null ? `Best ${short(mine)}` : "", duo && them != null ? `${(theirName || "P")[0]} ${short(them)}` : "", duoText].filter(Boolean).join(" · ");
    }
  };
  // typing a code: an existing one is followed (solo) or joined (partner); a new one starts fresh, from here
  const editSolo = async () => {
    const now = soloCode();
    const typed = prompt(`Your solo code${now ? ` is ${now}` : ""}. Type 8 letters: a code you use on another device, or a new one of your own to start here${now ? "" : " (empty: a random one)"}:`, "");
    if (typed === null) return;
    const code = cleanCode(typed);
    if (!code && !now) startSolo();
    else if (code.length === 8 && code !== now) await chooseSolo(code);
    else { if (code) alert("A solo code is 8 letters."); return; }
    location.reload();
  };
  const editDuo = () => {
    const now = duoCode();
    const typed = prompt(`Your partner code${now ? ` is ${now}` : ""}. Type 4 letters: your partner's, or a new one of your own for them to type${now ? "" : " (empty: a random one)"}:`, "");
    if (typed === null) return;
    const code = cleanCode(typed);
    if (!code && !now) link();
    else if (code.length === 4 && code !== now) link(code);
    else { if (code) alert("A partner code is 4 letters."); return; }
    location.reload();
  };
  const copy = async (kind, chip) => {
    const url = codesLink(kind), was = chip.innerHTML;
    try { await navigator.clipboard.writeText(url); chip.innerHTML = `${ICON[kind]}<b>Copied</b>`; } catch { prompt("Copy this link:", url); return; }
    setTimeout(() => { chip.innerHTML = was; }, 1200);
  };
  // tap copies the link, hold types a code (a code that isn't set yet is typed on a tap)
  let held = null, heldFired = false;
  head.addEventListener("pointerdown", e => {
    const chip = e.target.closest("[data-solo], [data-duo]");
    if (!chip) return;
    heldFired = false;
    held = setTimeout(() => { heldFired = true; (chip.matches("[data-solo]") ? editSolo : editDuo)(); }, 550);
  });
  const release = () => clearTimeout(held);
  head.addEventListener("pointerup", release);
  head.addEventListener("pointerleave", release);
  head.addEventListener("contextmenu", e => { if (e.target.closest("[data-solo], [data-duo]")) e.preventDefault(); });
  // the partner sheet: link, ask to play together, back to solo, unlink
  const sheet = document.createElement("dialog");
  sheet.className = "pair-sheet";
  dlg.appendChild(sheet);
  const openSheet = () => {
    const duo = duoCode(), inDuo = new URLSearchParams(location.search).has("room");
    sheet.replaceChildren();
    const x = document.createElement("button");
    x.className = "icon-btn sheet-x"; x.type = "button"; x.setAttribute("aria-label", "Close"); x.innerHTML = ICON.close;
    x.addEventListener("click", () => sheet.close());
    sheet.appendChild(x);
    const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; sheet.appendChild(n); return n; };
    const button = (text, fn, cls = "btn wide") => { const b = add("button", cls, text); b.type = "button"; b.addEventListener("click", fn); return b; };
    add("h3", null, "Your partner");
    {
      const said = status(partner);
      add("p", "stats", `Code ${duo}. ${said[0].toUpperCase()}${said.slice(1)}.`);
      const them = partner?.online && partner.game, mine = here;
      const askFor = game => async () => {
        sheet.close();
        const b = head.querySelector("[data-pair] em");
        if (b) b.textContent = `Asking to play ${GAME_NAME(game)}…`;
        const answer = await ask(game);
        if (answer === "yes") location.href = duoHref(game);
        else { draw(); alert(answer === "no" ? "Not now, they said." : "No answer."); }
      };
      if (them && partner.mode === "solo") button(`Watch ${(partner.name || "them").split(" ")[0]}'s ${GAME_NAME(them)}`, () => { location.href = watchHref(them); }, "btn primary wide");
      if (them && DUO_GAMES[them] && partner.mode === "solo") button(`Ask to play ${GAME_NAME(them)} together`, askFor(them));
      if (partner?.online && DUO_GAMES[mine] && mine !== them && !inDuo) button(`Ask to play ${GAME_NAME(mine)} together`, askFor(mine));   // only someone who's here can say Play
      if (inDuo) button("Back to solo", () => { location.href = soloHref(); });
      button("Unlink", () => { if (confirm("Unlink from your partner on all your devices?")) { unlink(); location.reload(); } }, "link");
    }
    sheet.showModal();
  };
  head.addEventListener("click", e => {
    if (heldFired) { heldFired = false; return; }
    const solo = e.target.closest("[data-solo]"), duo = e.target.closest("[data-duo]");
    if (solo) { if (soloCode()) copy("solo", solo); else editSolo(); }
    if (duo) { if (duoCode()) copy("duo", duo); else editDuo(); }
    if (e.target.closest("[data-pair]")) openSheet();
  });
  draw();
  if (duoCode() && !IN_FRAME) {
    shareBests(APPS.map(a => a.id)).catch(() => {});
    watchPartner(p => { partner = p; draw(); }).catch(() => {});
    watchBests((bests, name) => { theirs = bests; theirName = name; draw(); }).catch(() => {});
    watchDuoRecords(r => { duoRecords = r; draw(); }).catch(() => {});
  }
  return draw;
}

export function bindSwitcher(button, current) {
  const dlg = document.createElement("dialog");
  // A full screen of games, a tile each with its logo and name (room for six or seven), not a sheet from the bottom.
  dlg.className = "apps";
  dlg.setAttribute("aria-label", "Games");
  dlg.innerHTML = `<div class="apps-inner"><h2 class="apps-brand">${BRAND}Almanac</h2><div class="pick-head"><div class="codes" data-codes></div><span class="apps-actions">
      <button class="icon-btn" type="button" data-update title="Load the newest version (keeps your progress)" aria-label="Update">${ICON.update}</button>
      <button class="icon-btn" type="button" data-close aria-label="Close">${ICON.close}</button></span></div>
    <ul class="apps-list">${tiles(APPS.filter(a => !a.more), current)}<li><button class="app-row app-more${APPS.find(x => x.id === current)?.more ? " cur" : ""}" type="button" data-more aria-haspopup="dialog" aria-label="More games"><span class="app-logo app-dots" aria-hidden="true">…</span><b class="app-name">More</b></button></li></ul></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector("[data-close]").addEventListener("click", () => dlg.close());
  // "…": the other games, in a popup over the screen of games (it scrolls inside itself if it must; the screen of
  // games never does). Tapping outside it, or Close, puts it away.
  const pop = document.createElement("dialog");
  pop.className = "apps-pop";
  pop.setAttribute("aria-label", "More games");
  pop.innerHTML = `<div class="pick-head"><h2>More games</h2><button class="icon-btn" type="button" data-close aria-label="Close">${ICON.close}</button></div>
    <ul class="apps-list apps-pop-list">${tiles(APPS.filter(a => a.more), current)}<li><button class="app-row app-settings" type="button" data-settings>
      <span class="app-logo">${LOOK === "modern" ? ICON.settings : LOOK === "kontor" ? K_SETTINGS : RETE}</span><b class="app-name">Settings</b></button></li></ul>`;
  dlg.appendChild(pop);
  pop.querySelector("[data-close]").addEventListener("click", () => pop.close());
  pop.addEventListener("click", e => { if (e.target === pop) pop.close(); });    // a tap on the backdrop
  dlg.querySelector("[data-more]").addEventListener("click", () => pop.showModal());
  pop.querySelector("[data-settings]").addEventListener("click", () => openSettings(dlg));
  // after an update the app reloads: open the games screen again, where Update was pressed
  try { if (sessionStorage.getItem("crates:games")) { sessionStorage.removeItem("crates:games"); dlg.showModal(); } } catch { /* private mode */ }
  const update = dlg.querySelector("[data-update]");
  update.addEventListener("click", async () => {
    update.disabled = true;
    update.classList.add("spin");                      // turning while it fetches
    if (await hardUpdate()) return;                    // the page reloads
    update.classList.remove("spin");
    update.title = "Offline: try later";
    setTimeout(() => { update.title = "Load the newest version (keeps your progress)"; update.disabled = false; }, 2500);
  });
  // the game you're in: its tile just closes the screen of games (and the popup, if it's one of the more games)
  dlg.querySelectorAll("a.app-row.cur").forEach(row => row.addEventListener("click", e => { e.preventDefault(); pop.close(); dlg.close(); }));
  APPS.forEach(a => {
    if (a.id === current) return;
    // a tile always opens the game solo: a duo match only starts when your partner says Play
    dlg.querySelectorAll(`.app-row[href="${a.href}"]`).forEach(row => row.addEventListener("click", e => { e.preventDefault(); location.href = a.href; }));
  });
  const redraw = bindCodes(dlg);
  button.addEventListener("click", () => { redraw(); dlg.showModal(); });
  // inside every game, a small line in the title: what your partner is playing (green while they're online)
  if (duoCode() && !IN_FRAME) {
    const pill = document.createElement("small");
    pill.className = "partner-pill";
    button.appendChild(pill);
    watchPartner(p => {
      pill.textContent = p ? `${(p.name || "Partner").split(" ")[0]} · ${p.online ? `${GAME_NAME(p.game)}${p.mode === "duo" ? " ×2" : ""}` : "away"}` : "";
      pill.classList.toggle("on", !!p?.online);
    }).catch(() => {});
  }
}
