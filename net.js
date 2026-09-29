// Loads the Firebase connection once, on first need (together mode, or a synced solo run).
let promise = null;
export function getSync() {
  if (window.__cratesSync) return Promise.resolve(window.__cratesSync);   // test harness
  promise = promise || import("./sync.js").then(m => m.connect());
  return promise;
}
