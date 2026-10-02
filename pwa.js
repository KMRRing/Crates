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
