// The seabirds of Landfall's coasts: what each kind is, how far from its rock it ranges, and its shape as it flies, for the page's
// sheet and the scene's skein. Pure: drawing onto a canvas the caller gives.
export const BIRDS = {
  gannet: { name: "gannets", one: "gannet", range: "sixty or seventy miles", words: "big white birds with black wing-tips, flying in a line low over the swell" },
  tern: { name: "terns", one: "tern", range: "twenty miles", words: "slender, grey-backed, with forked tails, quick and buoyant, never far from land" },
  puffin: { name: "puffins", one: "puffin", range: "a dozen miles", words: "small and dumpy, whirring low and straight, beaks full of fish at dusk" },
};
/**
 * A bird's silhouette, centred at (x, y), `s` px across the wings, wings at `flap` (-1 down to 1 up): a gannet's long straight wings
 * and pointed tail, a tern's angled wings and forked tail, a puffin's stubby wings and round body.
 */
export function drawBird(ctx, kind, x, y, s, flap = 0, colour = "#1c2026") {
  const w = s / 2, up = flap * w * 0.34;
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = colour;
  // a wing from the shoulder (sx, 0) through the wrist to the tip: broad at the root, fine at the tip, the wrist lifted by the flap
  const wing = (dir, span, root, wrist, droop) => {
    const sx = dir * w * 0.08, wx = dir * span * 0.45, wy = -up - wrist, tx = dir * span, ty = -up * 0.55 + droop;
    ctx.beginPath(); ctx.moveTo(sx, -root * 0.5); ctx.quadraticCurveTo(wx * 0.6, wy - root * 0.4, wx, wy - root * 0.25); ctx.lineTo(tx, ty);
    ctx.lineTo(wx, wy + root * 0.35); ctx.quadraticCurveTo(wx * 0.6, wy + root * 0.5, sx, root * 0.6); ctx.closePath(); ctx.fill();
  };
  if (kind === "puffin") {
    wing(-1, w * 0.62, w * 0.2, w * 0.02, w * 0.05); wing(1, w * 0.62, w * 0.2, w * 0.02, w * 0.05);
    ctx.beginPath(); ctx.ellipse(0, w * 0.02, w * 0.17, w * 0.24, 0, 0, 6.283); ctx.fill();
  } else if (kind === "tern") {
    wing(-1, w, w * 0.1, w * 0.18, w * 0.12); wing(1, w, w * 0.1, w * 0.18, w * 0.12);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.06, w * 0.17, 0, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-w * 0.04, w * 0.12); ctx.lineTo(-w * 0.13, w * 0.42); ctx.lineTo(0, w * 0.22); ctx.lineTo(w * 0.13, w * 0.42); ctx.lineTo(w * 0.04, w * 0.12); ctx.closePath(); ctx.fill();
  } else {
    wing(-1, w, w * 0.15, w * 0.04, w * 0.06); wing(1, w, w * 0.15, w * 0.04, w * 0.06);
    ctx.beginPath(); ctx.moveTo(0, -w * 0.3); ctx.quadraticCurveTo(w * 0.09, 0, 0, w * 0.38); ctx.quadraticCurveTo(-w * 0.09, 0, 0, -w * 0.3); ctx.fill();
  }
  ctx.restore();
}
