// The suite's codes, shown on the games screen.
// Solo: one 8-letter code for you. Every device that has it keeps every game in the same state: each game's saved
// state, the review pile and your settings go up to Firebase a moment after they change, and come down when a page
// opens or comes back into view, the newer winning key by key (each change carries its time). Crates' run follows the
// same code through its own sync (run.js), which already guards boards and banks of different versions.
// Duo: the four-letter room you play in with someone, remembered after you leave it, so the games screen shows
// whether they're online and where, and both of your bests.
// Loaded by every page (through pwa.js), so the sync runs whichever game you open.
import { getSync } from "./net.js";
import { otherHere, roomInAddress } from "./rooms.js";

const SOLO = "suite:solo", DUO = "suite:duo", META = "suite:meta", PULLED = "suite:pulled";
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const PUSH_DELAY = 1500;
// what stays on this device: the suite's bookkeeping, Crates' run (synced by run.js), Firebase's own sign-in
const LOCAL = /^(suite:|crates:run|crates:updated|crates:v2|firebase:)/;
// the store sits beside Crates' run under crates/runs (where 8-letter codes may write), at the code moved on seven letters
const storePath = code => `crates/runs/${[...code].map(ch => LETTERS[(LETTERS.indexOf(ch) + 7) % LETTERS.length]).join("")}`;
const enc = k => encodeURIComponent(k).replace(/\./g, "%2E");     // a database key can't hold . # $ [ ] /
const raw = { get: k => Storage.prototype.getItem.call(localStorage, k), set: Storage.prototype.setItem, remove: Storage.prototype.removeItem };
const json = (k, fallback) => { try { return JSON.parse(raw.get(k)) ?? fallback; } catch { return fallback; } };
const put = (k, v) => { try { raw.set.call(localStorage, k, typeof v === "string" ? v : JSON.stringify(v)); } catch { /* private mode */ } };

export const cleanCode = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "");
export const soloCode = () => { const c = raw.get(SOLO); return c && c.length === 8 ? c : null; };
export const duoCode = () => { const c = raw.get(DUO); return c && c.length === 4 ? c : null; };
const newCode = () => Array.from({ length: 8 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
/** The game this page is (its file's name), for whether a change from elsewhere is this page's own. */
const page = () => (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
const own = k => k.startsWith("pile:") || k.startsWith(`${page() === "index" ? "crates" : page()}:`);

let meta = json(META, {}), dirty = new Map(), timer = null;
const syncing = () => !!soloCode();

/** Starts a solo code on this device: everything here goes up, as of now. */
export function startSolo() {
  const code = newCode();
  meta = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!LOCAL.test(k)) meta[k] = Date.now(); }
  put(META, meta);
  put(SOLO, code);
  linkCrates(code);
  return code;
}
/** Joins a code started elsewhere: what's there wins over what's here (this device's progress so far stays only where the code has none). */
export function joinSolo(code) {
  meta = {};
  put(META, meta);
  put(SOLO, code);
  sessionStorage.removeItem(PULLED);
  linkCrates(code);
}
export function stopSolo() { raw.remove.call(localStorage, SOLO); }
/** Crates' run follows the same code through run.js; rev 0 means whatever the code holds is newer. */
function linkCrates(code) { put("crates:run", { code, rev: 0, dirty: true }); }
export function setDuo(code) { if (code) put(DUO, code); else raw.remove.call(localStorage, DUO); }

// every write to this device's storage is noted with its time, and goes up a moment later
function touched(k, v) {
  if (!syncing() || LOCAL.test(k)) return;
  meta[k] = Date.now();
  put(META, meta);
  dirty.set(k, { v, t: meta[k] });
  clearTimeout(timer);
  timer = setTimeout(push, PUSH_DELAY);
}
Storage.prototype.setItem = function (k, v) { raw.set.call(this, k, v); if (this === localStorage) touched(k, String(v)); };
Storage.prototype.removeItem = function (k) { raw.remove.call(this, k); if (this === localStorage) touched(k, null); };

async function push() {
  const code = soloCode();
  if (!code || !dirty.size) return;
  const batch = Object.fromEntries([...dirty].map(([k, x]) => [enc(k), x]));
  dirty = new Map();
  try { await (await getSync()).update(storePath(code), batch); } catch (e) { console.error(e); for (const [ek, x] of Object.entries(batch)) dirty.set(decodeURIComponent(ek), x); }
}
const once = (sync, path) => new Promise(resolve => { const stop = sync.watch(path, v => { resolve(v); setTimeout(() => stop?.(), 0); }, () => resolve(null)); });

/** Takes what's newer on the code than here; sends up what's newer here. A change to this page's own game reloads it (once a visit). */
export async function pull() {
  const code = soloCode();
  if (!code) return;
  let remote;
  try { remote = await once(await getSync(), storePath(code)); } catch (e) { console.error(e); return; }
  let mine = false;
  for (const [ek, x] of Object.entries(remote || {})) {
    const k = decodeURIComponent(ek);
    if (LOCAL.test(k) || !x || (meta[k] || 0) >= x.t) continue;
    if (x.v == null) raw.remove.call(localStorage, k); else raw.set.call(localStorage, k, x.v);
    meta[k] = x.t;
    if (own(k)) mine = true;
  }
  for (const [k, t] of Object.entries(meta)) if (!(remote?.[enc(k)]?.t >= t)) dirty.set(k, { v: raw.get(k), t });
  put(META, meta);
  if (dirty.size) push();
  if (mine && !sessionStorage.getItem(PULLED)) { sessionStorage.setItem(PULLED, "1"); location.reload(); }
}

// ---------- bests ----------
/** A game's best, from what it keeps: a number, a { score }, or its bests by level (the highest). */
export function bestOf(app) {
  const v = json(`${app}:best`, null);
  const num = x => (typeof x === "number" ? x : typeof x?.score === "number" ? x.score : null);
  if (num(v) != null) return num(v);
  const xs = v && typeof v === "object" ? Object.values(v).map(num).filter(x => x != null) : [];
  return xs.length ? Math.max(...xs) : null;
}
/** Shares your bests with the duo room, under your name. */
export async function shareBests(apps) {
  const code = duoCode();
  if (!code) return;
  const sync = await getSync();
  const bests = Object.fromEntries(apps.map(a => [a, bestOf(a)]).filter(([, v]) => v != null));
  await sync.update(`crates/rooms/${code}/best/${sync.uid}`, { name: raw.get("crates:name") || "", at: Date.now(), bests });
}
/** Watches the duo room: cb({ partner: { name, game, online } | null, bests: { app: value } }) on every change. */
export async function watchDuo(cb) {
  const code = duoCode();
  if (!code) return () => {};
  const sync = await getSync();
  let here = null, best = null;
  const send = () => {
    const partner = here ? otherHere(here, sync.uid) : null;
    const theirs = Object.entries(best || {}).filter(([uid]) => uid !== sync.uid).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0]?.[1];
    cb({ partner, bests: theirs?.bests || {}, name: theirs?.name || partner?.name || "" });
  };
  const a = sync.watch(`crates/rooms/${code}/here`, v => { here = v; send(); });
  const b = sync.watch(`crates/rooms/${code}/best`, v => { best = v; send(); });
  return () => { a?.(); b?.(); };
}

// a page in a room remembers it as the duo room; a page that opens catches up, and again when it comes back into view
{
  const r = roomInAddress();
  if (r) put(DUO, r);
  if (syncing()) {
    pull();
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") pull(); else push(); });
  }
}
