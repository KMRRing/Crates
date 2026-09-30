// Keeps a solo run in step across devices. The whole solo store (current board, history, settings,
// learning cards) lives at crates/runs/{CODE} in Firebase as one JSON string with a revision number,
// and every device that opens the run's link follows that run. A write only lands if nobody has moved
// the run on since this device last saw it, so a device holding stale progress can't overwrite newer
// progress made elsewhere: it takes the newer run instead.
// Each write carries the size of the writer's word bank and the app version. A device on an older build
// can't read boards dealt from newer words (or runs saved in a newer shape), so instead of dealing boards
// of its own it fetches the new build and reloads.
import { getSync } from "./net.js";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;
const PUSH_DELAY = 1500;                       // batch quick successive changes into one write
const LINK_KEY = "crates:run";                 // { code, rev, dirty } of the run this device follows
const UPDATE_KEY = "crates:updated";           // sessionStorage: when this tab last reloaded to catch up
const UPDATE_GAP = 5 * 60 * 1000;
const DEVICE = Math.random().toString(36).slice(2, 10);   // tells our own writes apart from others'
const runPath = code => `crates/runs/${code}`;

export const cleanCode = s => String(s || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, CODE_LENGTH);
export const validCode = s => s.length === CODE_LENGTH && [...s].every(ch => LETTERS.includes(ch));
const newCode = () => Array.from({ length: CODE_LENGTH }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");

/**
 * snapshot() → the store to upload; adopt(store) takes over a newer run; notice(text) tells the player;
 * version = this build's bank size, app = its APP_VERSION; usable(store) says whether this build can show
 * that store's board.
 */
export function createRun({ snapshot, adopt, notice, version, app, usable }) {
  let link = (() => { try { return JSON.parse(localStorage.getItem(LINK_KEY)) || null; } catch { return null; } })();
  let sync = null, unwatch = null, timer = null, first = true;
  let stale = false;                           // another device runs a newer build: stop syncing, reload
  let warnedOld = false;
  const keepLink = () => {
    try { if (link) localStorage.setItem(LINK_KEY, JSON.stringify(link)); else localStorage.removeItem(LINK_KEY); } catch { /* private mode */ }
  };
  const doc = rev => ({ v: 1, rev, by: DEVICE, at: Date.now(), bank: version, app, data: JSON.stringify(snapshot()) });
  const parse = val => { try { return JSON.parse(val.data); } catch (e) { console.error(e); return null; } };
  const newer = (val, data) => (val.bank || 0) > version || (val.app || 0) > app || !data || !usable(data);

  /** Another device is on a newer build: fetch the new files past the browser cache and reload, once. */
  async function catchUpBuild() {
    stale = true;
    clearTimeout(timer);
    let last = 0;
    try { last = Number(sessionStorage.getItem(UPDATE_KEY)) || 0; } catch { /* private mode */ }
    if (Date.now() - last < UPDATE_GAP) {
      notice("Your other device has a newer version of Crates. Close and reopen it here to catch up");
      return;
    }
    try { sessionStorage.setItem(UPDATE_KEY, String(Date.now())); } catch { /* private mode */ }
    notice("Updating to the newest version…");
    const own = performance.getEntriesByType("resource").map(e => e.name).filter(u => u.startsWith(location.origin));
    await Promise.all([location.href, ...own].map(u => fetch(u, { cache: "reload" }).catch(() => null)));
    location.reload();
  }

  function onRemote(val) {
    if (!link || stale) return;
    if (!val) { notice("That synced run no longer exists, so this device keeps its own copy"); unlink(); return; }
    const wasFirst = first;
    first = false;
    if (val.rev > link.rev) {
      if (val.by === DEVICE) { link.rev = val.rev; keepLink(); return; }   // our own write coming back
      const data = parse(val);
      if (newer(val, data)) { catchUpBuild(); return; }
      if (!val.bank && !wasFirst) {
        // Written just now by a device still on a build from before these stamps. It can't read new
        // boards and deals its own instead, so don't follow it: our next change overwrites it.
        link.rev = val.rev;
        keepLink();
        if (!warnedOld) { warnedOld = true; notice("Your other device runs an old version of Crates. Reload it there to keep the two in step"); }
        return;
      }
      link.rev = val.rev;
      link.dirty = false;                                    // newer progress elsewhere wins,
      clearTimeout(timer);                                   // so a write still waiting here is dropped
      timer = null;
      keepLink();
      try { adopt(data); } catch (e) { console.error(e); }
    } else if (wasFirst && link.dirty) {
      push();                                                // changes made here while offline
    }
  }

  async function follow() {
    sync = await getSync();
    unwatch?.();
    first = true;
    unwatch = sync.watch(runPath(link.code), onRemote, e => console.error(e));
  }

  async function push() {
    clearTimeout(timer);
    timer = null;
    if (!link || !sync || stale) return;
    const base = link.rev;
    try {
      const r = await sync.tx(runPath(link.code), cur => {
        if (cur === null) return null;                        // cold cache: let the server hand us the real run
        if (cur.rev !== base || (cur.bank || 0) > version || (cur.app || 0) > app) return undefined;   // moved on elsewhere: the watcher brings it in
        return doc(base + 1);
      });
      if (r.committed && r.value?.by === DEVICE && link) { link.rev = r.value.rev; link.dirty = false; keepLink(); }
    } catch (e) { console.error(e); }
  }

  function unlink() {
    unwatch?.();
    unwatch = null;
    clearTimeout(timer);
    link = null;
    keepLink();
  }

  return {
    code: () => link?.code || null,
    /** Follow the linked run, if any. */
    async start() { if (link) { try { await follow(); } catch (e) { console.error(e); } } },
    /** The store changed: upload it shortly. */
    changed() {
      if (!link || stale) return;
      if (!link.dirty) { link.dirty = true; keepLink(); }
      clearTimeout(timer);
      timer = setTimeout(push, PUSH_DELAY);
    },
    /** Upload now (the page is being put away). */
    flush() { if (link && timer) push(); },
    /** Start syncing this device's run under a new code. */
    async create() {
      sync = await getSync();
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = newCode();
        const r = await sync.tx(runPath(code), cur => (cur === null ? doc(1) : undefined));
        if (r.committed) {
          link = { code, rev: 1, dirty: false };
          keepLink();
          await follow();
          return code;
        }
      }
      return null;
    },
    /** Take over the run behind a code from another device. */
    async join(code) {
      sync = await getSync();
      const val = await new Promise(resolve => {
        let off = null, done = false;
        off = sync.watch(runPath(code), v => { if (done) return; done = true; setTimeout(() => off?.(), 0); resolve(v); });
      });
      if (!val) return false;
      unlink();
      const data = parse(val);
      if (newer(val, data)) {                                // follow it once this device has the new build
        link = { code, rev: 0, dirty: false };
        keepLink();
        catchUpBuild();
        return true;
      }
      link = { code, rev: val.rev, dirty: false };
      keepLink();
      adopt(data);
      await follow();
      return true;
    },
    unlink,
  };
}
