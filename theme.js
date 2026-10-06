// Almanac's look, chosen on the games screen (More, Settings): the theme (Almanac, the default; Modern; Kontor) and
// day or night (following the phone unless set). A plain script in every page's head, so the look is set before the
// page draws and never flashes the wrong one.
(function () {
  try {
    var t = localStorage.getItem("suite:theme"), m = localStorage.getItem("suite:mode");
    if (t === "modern" || t === "kontor") document.documentElement.dataset.theme = t;
    if (m === "day" || m === "night") document.documentElement.dataset.mode = m;
  } catch (e) { /* private mode: Almanac, following the phone */ }
})();
