// The offline party (October 2026): Party with no internet, for a plane or anywhere without a signal. Every phone is on
// the same Wi-Fi (on a plane a pocket travel router: a plane's own network rarely lets passengers' phones reach each
// other). One phone hosts and keeps the party's database (lan.js); each of the others links to it with two scans, its
// own of the host's code and the host's of the code that then shows on it (lan-link.js).
//
// This page holds the links, and the database on the host's phone, for as long as the party lasts, and runs Party and
// every game it plays in a frame over the whole screen: a page can't take a link with it to another page, so the pages
// move inside the frame while the links stay here (net.js hands each page in the frame its database from this one).
// It loads neither the games screen nor pwa.js: an update taking over would reload this page, and with it every link.
import { createHost, createClient } from "./lan.js";
import { hostLink, guestLink, decodeLink } from "./lan-link.js";
import { scanQr } from "./qr-scan.js";
import { qrSvg } from "./qr.js";
import { sextant } from "./loading.js";

document.documentElement.classList.add("ready");   // the page is drawn as it opens (pwa.js says so on the others)

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const read = (store, k) => { try { return JSON.parse(store.getItem(k)); } catch { return null; } };
const write = (store, k, v) => { try { if (v == null) store.removeItem(k); else store.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

// who this phone is: its name at the party, and an id of its own that a lost link brings back to the same seat (under
// suite:, so it isn't synced to this player's other devices: each device is a phone at the table)
const NAME = (() => { try { return (localStorage.getItem("crates:name") || "").trim(); } catch { return ""; } })() || "Player";
const UID = (() => {
  let u = null;
  try { u = localStorage.getItem("suite:lan-uid"); } catch { /* private mode */ }
  if (!u) { u = `lan${Math.random().toString(36).slice(2, 10)}`; try { localStorage.setItem("suite:lan-uid", u); } catch { /* private mode */ } }
  return u;
})();
// what a reload keeps (this tab only): the host's database and the party's code; a guest's host and where it was.
// Party opens this page for a new party (?host=new, ?join=new): what an earlier one left is dropped, and the address
// loses its "new", so a reload comes back to this one
const HOSTING = "lan:host", GUESTING = "lan:guest";
const KEEP_HOURS = 12;
const role = params.has("host") ? "host" : "guest";
if (params.get(role === "host" ? "host" : "join") === "new") {
  write(sessionStorage, role === "host" ? HOSTING : GUESTING, null);
  history.replaceState(null, "", role === "host" ? "lan.html?host" : "lan.html?join");
}

let host = null, client = null, partyCode = null, hostName = "", ended = false;

// ---------- the screen kept on ----------
// a phone that locks stops answering: the host's would stop the party, a guest's would lose its link
let lock = null;
async function awake() {
  if (lock || document.hidden || !navigator.wakeLock) return;
  try { lock = await navigator.wakeLock.request("screen"); lock.addEventListener("release", () => { lock = null; }); } catch { /* refused: battery saver */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) awake(); });

// ---------- the screens ----------
const panels = ["scanPanel", "replyPanel", "lostPanel"];
/** Shows one of this page's panels over the frame, or (null) the frame alone. */
function show(id) {
  for (const p of panels) $(p).hidden = p !== id;
  $("frame").hidden = !$("frame").getAttribute("src");
}
function note(id, text, waiting = false) {
  const n = $(id);
  n.replaceChildren();
  if (waiting) n.append(sextant());
  n.append(text);
}

// ---------- the frame ----------
const frame = $("frame");
const inParty = () => { try { return /[?&](table|room|party)=/.test(frame.contentWindow.location.search); } catch { return true; } };
frame.addEventListener("load", () => {
  // a page outside the party (the games screen, a game alone) gets the way back
  $("backToParty").hidden = inParty() || !partyCode;
  if (role === "guest" && partyCode) try { write(sessionStorage, GUESTING, { host: hostName, url: frame.contentWindow.location.href }); } catch { /* elsewhere */ }
});
$("backToParty").addEventListener("click", () => { if (partyCode) frame.src = `party.html?table=${partyCode}`; });
function enter(url) {
  if (frame.getAttribute("src") !== url) frame.src = url;
  show(null);
  awake();
}

// ---------- what the pages in the frame are given (net.js reads it as window.parent.__lan) ----------
window.__lan = {
  host: role === "host",
  /** A page's database: its own on this phone's link, gone (its presence, its sessions undone) when the page goes. */
  connect(win) {
    const page = client.page({ room: () => partyCode });
    win.addEventListener("pagehide", () => page.close(), { once: true });
    return Promise.resolve(page);
  },
  /** The host adds a player (Party's Invite players). */
  invite() { if (role === "host") pairing.open(); },
  /** Leaves the party: the host ends it for everyone, asked first. */
  leave: () => leave(),
  get hostName() { return role === "host" ? NAME : hostName; },
};

async function leave() {
  if (role === "host") {
    if (!ended && !confirm("End the offline party? Every phone leaves it.")) return;
    ended = true;
    try { host.db.set("lan/ended", true); } catch (e) { console.error(e); }
    await new Promise(r => setTimeout(r, 500));          // the others hear it before their links close
    host.close();
    write(sessionStorage, HOSTING, null);
  } else {
    client?.detach();
    write(sessionStorage, GUESTING, null);
  }
  location.replace("party.html");
}

// ---------- the host ----------
// at most once a second, however busy the table (a game of Spot changes it many times a second)
let keepTimer = 0;
function keep() {
  if (keepTimer) return;
  keepTimer = setTimeout(() => { keepTimer = 0; if (!ended) write(sessionStorage, HOSTING, { db: host.snapshot(), code: partyCode, at: Date.now() }); }, 1000);
}

function startHost() {
  const saved = read(sessionStorage, HOSTING);
  const resumed = !!saved && Date.now() - (saved.at || 0) < KEEP_HOURS * 3600e3;
  host = createHost({ snapshot: resumed ? saved.db : null, onPeers: list => pairing.peers(list), onChange: keep });
  client = createClient({ uid: UID, name: NAME });
  client.attachLocal(host);
  if (resumed && saved.code) partyCode = saved.code;
  // the party's code, once Party has opened it in the frame: told to the guests (lan/party), who go to it; then no
  // more watching every room (a busy game changes them many times a second)
  const stop = host.db.watch("crates/rooms", rooms => {
    const code = Object.keys(rooms || {}).find(c => rooms[c]?.party?.v === 1 && rooms[c].party.host === UID);
    if (!code) return;
    stop();
    partyCode = code;
    if (host.db.get("lan/party")?.code !== code) host.db.set("lan/party", { code, host: NAME });
    keep();
  });
  enter(partyCode ? `party.html?table=${partyCode}` : "party.html");
  if (resumed) {
    pairing.open();
    pairing.say("This phone reopened the party: each of the others scans your code again.");
  }
  keep();
}

/** The host's sheet: this phone's code for the next player, then theirs scanned; who's linked. */
const pairing = (() => {
  const dlg = $("pairDlg");
  let link = null, making = null, scanner = null;
  async function fresh() {
    link?.close();
    link = null;
    const box = $("pairQr");
    box.replaceChildren(sextant());
    $("pairScan").disabled = true;
    making = hostLink({ name: NAME });
    try { link = await making; } catch (e) { console.error(e); say("This phone can't make a code: try again in a moment."); return; } finally { making = null; }
    box.innerHTML = qrSvg(link.code, { label: "The code for the next player to scan" });
    box.dataset.link = link.id;                     // which code is showing (a reply answers it by this number)
    $("pairScan").disabled = false;
  }
  function say(text, waiting = false) { note("pairNote", text, waiting); }
  function view(camera) { $("pairShow").hidden = camera; $("pairCamera").hidden = !camera; }
  async function scan() {
    if (!link) return;
    view(true);
    say("Point the camera at the code on their screen.");
    const linking = link;
    // only a code answering this one: one answering an earlier code (a phone that scanned it twice, or the last
    // player's still in view) is passed over, and the camera keeps looking
    scanner = scanQr($("pairVideo"), {
      want: t => { const r = decodeLink(t); return r?.kind === "answer" && r.id === linking.id; },
      onOther: t => {
        const r = decodeLink(t);
        say(!r ? "That isn't a code from Almanac." : r.kind === "offer" ? "That's a host's code: scan the code their phone shows after scanning yours."
          : `That's ${r.name ? `${r.name}'s` : "a"} code for an earlier one of yours: they scan your code again.`);
      },
    });
    let text = null;
    try { text = await scanner.done; } catch { say("No camera: allow Almanac the camera, then try again."); view(false); return; } finally { scanner = null; }
    view(false);
    if (!text) { say(""); return; }
    const reply = decodeLink(text);
    link = null;
    say(`Linking ${reply.name || "their phone"}…`, true);
    try {
      host.attach(await linking.accept(reply));
      say(`${reply.name || "They"} joined. Next player: scan this code.`);
    } catch {
      linking.close();
      say(`Couldn't reach ${reply.name || "their phone"}. Are you both on the same Wi-Fi? If a phone asked to find devices on the local network, that has to be allowed. They scan this code again.`);
    }
    fresh();
  }
  $("pairScan").addEventListener("click", scan);
  $("pairCancel").addEventListener("click", () => scanner?.stop());
  $("pairClose").addEventListener("click", () => dlg.close());
  dlg.addEventListener("close", () => { scanner?.stop(); view(false); });
  return {
    open() {
      if (!link && !making) fresh();
      this.peers(host.peers);
      if (!dlg.open) dlg.showModal();
      awake();
    },
    say,
    peers(list) {
      const ul = $("pairPeers");
      ul.replaceChildren(...(list.length ? list.map(p => el("li", p.away ? "away" : "", p.name || "A phone")) : [el("li", "none", "Nobody yet")]));
    },
  };
})();

// ---------- a guest ----------
let shellPage = null;
function startGuest() {
  client = createClient({ uid: UID, name: NAME });
  const saved = read(sessionStorage, GUESTING);
  if (saved?.host) hostName = saved.host;
  scanHost(!!saved);
}

/** Scans the host's code, shows this phone's, and links once the host has scanned it. */
async function scanHost(again = false) {
  $("replyQr").replaceChildren();                    // the last code shown is no use to the host any more
  delete $("replyQr").dataset.link;
  show("scanPanel");
  $("scanHead").textContent = again && hostName ? `Scan ${hostName}'s code again` : "Scan the host's code";
  note("scanNote", again && hostName ? `On ${hostName}'s phone: Add a player, in Party's menu.` : "On the host's phone: Party › Offline party › Host, or Add a player in its menu.");
  const scanner = scanQr($("scanVideo"), {
    want: t => decodeLink(t)?.kind === "offer",
    onOther: t => note("scanNote", decodeLink(t) ? "That's another guest's code: scan the host's." : "That isn't a code from Almanac."),
  });
  $("scanLeave").onclick = () => { scanner.stop(); leave(); };
  let text = null;
  try { text = await scanner.done; }
  catch { note("scanNote", "No camera: allow Almanac the camera (Settings › Safari › Camera), then open the party again."); return; }
  if (!text) return;
  const offer = decodeLink(text);
  hostName = offer.name || "the host";
  show("replyPanel");
  $("replyHead").textContent = `Now ${hostName} scans this`;
  $("replyQr").replaceChildren(sextant());
  note("replyNote", "Making this phone's code…", true);
  let link = null;
  $("replyAgain").onclick = () => { link?.close(); scanHost(true); };
  try { link = await guestLink(offer, { name: NAME }); } catch (e) { console.error(e); note("replyNote", "This phone can't make a code: scan again in a moment."); return; }
  $("replyQr").innerHTML = qrSvg(link.code, { label: `This phone's code, for ${hostName} to scan` });
  $("replyQr").dataset.link = offer.id;
  note("replyNote", `${hostName} taps Scan their code and holds the camera to this. Waiting…`, true);
  try {
    const channel = await link.open;
    client.attach(channel, { onClose: lost });
    linked();
  } catch {
    link.close();
    note("replyNote", `Didn't link with ${hostName}'s phone. Are you both on the same Wi-Fi? If your phone asked to find devices on the local network, that has to be allowed. Then scan again.`);
  }
}

/** Linked: Party, in the frame, once the host's is open (the host's phone says which: lan/party). */
function linked() {
  awake();
  if (!shellPage) {
    shellPage = client.page({ shell: true });
    shellPage.watch("lan", v => {
      if (v?.ended) { over(`${hostName} ended the party`, "Thanks for playing."); return; }
      const code = v?.party?.code;
      if (!code) { if (!partyCode) { show("lostPanel"); $("lostHead").textContent = `Linked with ${hostName}`; note("lostNote", `Waiting for ${hostName}'s phone to open the party…`, true); $("lostScan").hidden = true; } return; }
      const fresh = code !== partyCode;
      partyCode = code;
      const saved = read(sessionStorage, GUESTING);
      enter(fresh && saved?.url && saved.url.includes(`=${code}`) ? saved.url : frame.getAttribute("src") || `party.html?table=${code}`);
    });
  } else if (partyCode) show(null);
}

/** The link to the host is gone: the frame waits under a panel until the host's code is scanned again. */
function lost() {
  if (ended) return;
  show("lostPanel");
  $("lostHead").textContent = `Lost ${hostName}'s phone`;
  note("lostNote", `It may have gone to sleep, or out of reach. On ${hostName}'s phone: Add a player, in Party's menu; then scan its code. Everything here stays as it was.`);
  $("lostScan").hidden = false;
  $("lostScan").textContent = `Scan ${hostName}'s code again`;
}
function over(head, text) {
  ended = true;
  client?.detach();
  write(sessionStorage, GUESTING, null);
  show("lostPanel");
  frame.hidden = true;
  $("lostHead").textContent = head;
  note("lostNote", text);
  $("lostScan").hidden = true;
  $("lostLeave").textContent = "Back to Party";
  $("lostLeave").classList.add("primary");
}
$("lostScan").addEventListener("click", () => scanHost(true));
$("lostLeave").addEventListener("click", () => leave());

// ---------- start ----------
if (role === "host") startHost();
else startGuest();
// for the tests, which link phones in a browser without cameras
window.__lanShell = { get host() { return host; }, get client() { return client; }, get partyCode() { return partyCode; }, pairing, role };
