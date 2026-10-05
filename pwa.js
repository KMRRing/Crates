// Offline play and updates. sw.js keeps every file of every game on the device, so the games open and play
// without a connection (playing together still needs one). A new version is fetched in the background and waits:
// it takes over when the app goes off screen, and the page reloads onto it when it comes back. Taking over in the
// middle of a game could mix old code with new.
const supported = "serviceWorker" in navigator;
const ready = supported ? navigator.serviceWorker.register("./sw.js").catch(() => null) : Promise.resolve(null);

if (supported) {
  let swapped = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { swapped = true; });
  document.addEventListener("visibilitychange", async () => {
    const reg = await ready;
    if (document.hidden) reg?.waiting?.postMessage("take-over");
    else if (swapped) location.reload();
  });
}

/**
 * Loads the newest version right away (another device is already on it): fetch it, let it take over, and reload
 * onto it. Without a service worker, reloads past the browser's cache instead.
 */
export async function reloadFresh() {
  const reg = await ready;
  if (!reg) {
    const own = performance.getEntriesByType("resource").map(e => e.name).filter(u => u.startsWith(location.origin));
    await Promise.all([location.href, ...own].map(u => fetch(u, { cache: "reload" }).catch(() => null)));
    location.reload();
    return;
  }
  try { await reg.update(); } catch { /* offline: carry on with what we have */ }
  const next = reg.installing || reg.waiting;
  if (!next) { location.reload(); return; }
  await new Promise(resolve => {
    const settled = () => ["installed", "activated", "redundant"].includes(next.state);
    if (settled()) resolve(); else next.addEventListener("statechange", () => { if (settled()) resolve(); });
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
  (reg.waiting || next).postMessage("take-over");
  setTimeout(() => location.reload(), 4000);   // in case the switch is never announced
}

/**
 * The Update button: throws away every stored copy of the app and loads it fresh from the network. Saves,
 * stats and settings are kept. Checks the connection first, since without one, emptying the store would leave
 * no app at all; returns false (and changes nothing) when offline.
 */
export async function hardUpdate() {
  // the device says whether it's offline; sw.js is never stored, so this request also proves the site answers
  const online = navigator.onLine && await fetch(`./sw.js?check=${Date.now()}`, { cache: "no-store" }).then(r => r.ok, () => false);
  if (!online) return false;
  const urls = new Set([location.href.split("#")[0]]);
  if ("caches" in window) {
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) urls.add(request.url);
      await caches.delete(key);
    }
  }
  // with the store empty, these go to the network and refresh the browser's own copies on the way
  await Promise.all([...urls].map(u => fetch(u, { cache: "reload" }).catch(() => null)));
  for (const reg of (await navigator.serviceWorker?.getRegistrations?.()) || []) await reg.unregister();
  try { sessionStorage.setItem("crates:games", "1"); } catch { /* private mode */ }   // come back to the games screen
  location.reload();
  return true;
}

// A double tap must never zoom the page: the viewport is capped at scale 1 and every element is touch-action:
// manipulation, and this catches whatever is left (a double tap that reaches the document as a dblclick).
document.addEventListener("dblclick", e => { if (!e.target.closest("input, textarea, select, [contenteditable]")) e.preventDefault(); }, { passive: false });
