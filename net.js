// Loads the Firebase connection once, on first need (together mode, or a synced solo run). A page in an offline party
// (lan.html: no internet) runs in a frame of the page that holds the phones' links, and gets its database from there
// instead: the host phone's, answering the same calls the same way (lan.js).
let promise = null;
/** The offline party round this page, or null: what lan.html offers its frame (connect, invite, leave, host). */
export const lan = (() => { try { return window.parent !== window ? window.parent.__lan || null : null; } catch { return null; } })();
export function getSync() {
  if (window.__cratesSync) return Promise.resolve(window.__cratesSync);   // test harness
  promise = promise || (lan ? lan.connect(window) : import("./sync.js").then(m => m.connect()));
  return promise;
}
