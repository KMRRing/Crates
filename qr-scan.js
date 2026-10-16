// The camera, reading QR codes: an offline party's phones link by showing each other codes (lan-link.js), read here.
// Safari has no barcode reader of its own, so frames go to a worker running jsQR (qr-worker.js): a square from the
// middle of the picture, a few times a second, while the last one is still being read nothing more is sent.
const SIDE = 640;                 // pixels a frame is read at: a code across a third of the picture still reads
const EVERY = 120;                // milliseconds between frames

/**
 * Opens the back camera in `video` and reads codes until want(text) says one is wanted (else onOther(text) hears it:
 * a code of another kind). Returns { done, stop }: done resolves with the code wanted, or null once stopped; rejects
 * when there's no camera to be had (refused, or none).
 */
export function scanQr(video, { want = () => true, onOther = () => {} } = {}) {
  let stream = null, worker = null, timer = 0, busy = false, stopped = false, n = 0, finish;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  function stop(result = null) {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    worker?.terminate();
    stream?.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    finish?.(result);
  }
  const done = new Promise((resolve, reject) => {
    finish = resolve;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      } catch (e) { stopped = true; reject(e); return; }
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      video.setAttribute("playsinline", "");          // a phone would otherwise take it full screen
      video.muted = true;
      video.srcObject = stream;
      try { await video.play(); } catch { /* it plays when it can */ }
      worker = new Worker("qr-worker.js");
      worker.onmessage = e => {
        busy = false;
        const text = e.data.text;
        if (!text || stopped) return;
        if (want(text)) stop(text); else onOther(text);
      };
      timer = setInterval(() => {
        if (busy || stopped || video.readyState < 2 || !video.videoWidth) return;
        const vw = video.videoWidth, vh = video.videoHeight, side = Math.min(vw, vh), scale = Math.min(1, SIDE / side);
        canvas.width = canvas.height = Math.round(side * scale);
        ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        busy = true;
        worker.postMessage({ id: ++n, width: img.width, height: img.height, data: img.data.buffer }, [img.data.buffer]);
      }, EVERY);
    })();
  });
  return { done, stop: () => stop(null) };
}
