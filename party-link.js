// A game played by a party (its address carries ?party=CODE&at=…): every phone follows the host. The page watches the
// party (crates/rooms/CODE/party): when the host goes back to the lobby, or starts another game, it goes there too.
// The menu gets the party's part (menu.js asks for it with menuPart): Back to the party for the host, who chooses for
// the others, and Leave the party. Loaded only on a page in a party, so no other page connects for it.
import { getSync } from "./net.js";
import { standUp } from "./table.js";
import { joins, playHref } from "./party-href.js";
import { action, line } from "./menu.js";
import { IN_FRAME } from "./suite.js";

const q = new URLSearchParams(location.search);
/** The party this page is playing for, from its address, or null. */
export const partyCode = (() => {
  const c = (q.get("party") || "").toUpperCase().replace(/[^A-Z]/g, "");
  return c.length === 4 ? c : null;
})();
// which of the host's choices this page is (its file and the choice's time): read once, as the page opens
const here = { page: location.pathname.split("/").pop() || "index.html", at: q.get("at") };
const path = () => `crates/rooms/${partyCode}/party`;
let sync = null, state = null, moving = false;
const boxes = new Set();

/** Leaves this page for another, once (a later change of the party's mind waits for that page to read it). */
function go(href) {
  if (moving || IN_FRAME) return;
  moving = true;
  location.replace(href);
}

async function follow() {
  sync = await getSync();
  try { sessionStorage.setItem("party:here", partyCode); } catch { /* private mode */ }
  sync.watch(path(), b => {
    if (!b || b.v !== 1) { state = null; fill(); return; }        // the party has closed: this game carries on as it is
    const host = b.players?.[b.host];
    state = { host: b.host === sync.uid, hostName: host?.name || "The host", n: Object.values(b.players || {}).filter(p => p && Number.isInteger(p.seat)).length };
    const p = b.playing || null;
    if (!p || p.page !== here.page || String(p.at) !== here.at) { go(joins(p, sync.uid) ? playHref(p, partyCode) : playHref(null, partyCode)); return; }
    fill();
  }, e => console.error(e));
}

/** The host's choice: back to the party's lobby, where every phone follows. */
async function backToParty() {
  if (!sync) return;
  try { await sync.update(path(), { playing: null }); } catch (e) { console.error(e); }
  go(playHref(null, partyCode));
}
/** Leaves the party for good: your place freed, and this phone back to the games. */
async function leaveParty() {
  if (sync) try { await sync.tx(path(), cur => (cur === null ? null : standUp(cur, sync.uid) ?? undefined)); } catch (e) { console.error(e); }
  try { sessionStorage.removeItem("party:here"); } catch { /* private mode */ }
  go("index.html");
}

function fill(box = null) {
  for (const b of box ? [box] : [...boxes]) {
    if (!b.isConnected && !box) { boxes.delete(b); continue; }
    const kids = [];
    if (!state) kids.push(line(`Party ${partyCode}`));
    else if (state.host) kids.push(line(`Party ${partyCode}: ${state.n} of you, and you choose the games.`), action("Back to the party", backToParty));
    else kids.push(line(`Party ${partyCode}: ${state.hostName} chooses the games.`));
    kids.push(action("Leave the party", leaveParty, "link"));
    b.replaceChildren(...kids);
  }
}
/** Whether this phone is the party's host, who sets the rules at its tables, and the host's name; null until known. */
export const partyHost = () => (state ? { me: state.host, name: state.hostName } : null);
/** The party's part of the menu, at its top: filled now, and again as the party changes. */
export function menuPart() {
  const box = document.createElement("div");
  box.className = "menu-party";
  box.dataset.party = "1";
  boxes.add(box);
  fill(box);
  return box;
}

if (partyCode && !IN_FRAME) follow().catch(e => console.error(e));
