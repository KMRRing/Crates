// Reads a QR code off one of the camera's frames for qr-scan.js, away from the page: a frame takes the decoder tens of
// milliseconds on a phone, which on the page would make the camera's picture stutter. A classic worker, so it can load
// the decoder (vendor/jsqr.js) with importScripts.
importScripts("vendor/jsqr.js");

self.onmessage = e => {
  const { id, width, height, data } = e.data;
  let text = null;
  try {
    // dark on light only: the codes it reads are drawn that way (qr.js), and trying them inverted would halve its speed
    const hit = self.jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: "dontInvert" });
    text = hit?.data || null;
  } catch { /* a frame it can't make out */ }
  self.postMessage({ id, text });
};
