// Almanac's look, chosen on the games screen (More, Settings): Deco (the default), Modern or Kontor. A plain script in
// every page's head, so the look is set before the page draws and never flashes the wrong one.
(function () {
  try {
    var t = localStorage.getItem("suite:theme");
    if (t === "modern" || t === "kontor") document.documentElement.dataset.theme = t;
  } catch (e) { /* private mode: Deco */ }
})();
