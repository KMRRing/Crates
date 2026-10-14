// Fairy-Stockfish, built as a WebAssembly reactor for WASI (vendor/fairy-stockfish/NOTE.txt), started with the little
// of WASI it asks for: its standard output, read back line by line, and the clocks. It has no files, no arguments and
// no environment. The page's worker (uci-fairy.js) runs it, and so do the tests, in Node.
//
// The engine is single-threaded: uci_command() runs a command to its end before it returns, a "go" its whole search,
// so a search must be given a limit (nodes, depth or a time), never "infinite".

const EBADF = 8, ENOENT = 44, ESPIPE = 70;

/** Starts the engine from its WebAssembly bytes; `onLine(text)` gets each line it writes. Resolves { command(line) }. */
export async function startWasi(bytes, onLine) {
  let memory = null, carry = "";
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  const view = () => new DataView(memory.buffer);
  const write = (fd, text) => {
    if (fd !== 1) { if (text.trim()) console.warn(text.trim()); return; }
    carry += text;
    for (let i = carry.indexOf("\n"); i >= 0; i = carry.indexOf("\n")) { const line = carry.slice(0, i); carry = carry.slice(i + 1); onLine(line); }
  };
  const wasi = {
    environ_get: () => 0,
    environ_sizes_get: (count, size) => { view().setUint32(count, 0, true); view().setUint32(size, 0, true); return 0; },
    clock_time_get: (id, precision, at) => {
      const ns = id === 0 ? BigInt(Date.now()) * 1000000n : BigInt(Math.round(performance.now() * 1e6));
      view().setBigUint64(at, ns, true);
      return 0;
    },
    fd_close: () => 0,
    fd_fdstat_get: (fd, at) => {                                  // the standard streams are character devices; there's nothing else
      if (fd > 2) return EBADF;
      const v = view();
      v.setUint8(at, 2); v.setUint16(at + 2, 0, true); v.setBigUint64(at + 8, 0n, true); v.setBigUint64(at + 16, 0n, true);
      return 0;
    },
    fd_filestat_get: () => EBADF,
    fd_pread: () => EBADF,
    fd_prestat_get: () => EBADF,                                  // no directory is open to it
    fd_prestat_dir_name: () => EBADF,
    fd_read: (fd, iovs, n, read) => { view().setUint32(read, 0, true); return fd === 0 ? 0 : EBADF; },
    fd_seek: fd => (fd <= 2 ? ESPIPE : EBADF),
    fd_write: (fd, iovs, n, written) => {
      const v = view();
      let total = 0, text = "";
      for (let k = 0; k < n; k++) {
        const at = v.getUint32(iovs + 8 * k, true), len = v.getUint32(iovs + 8 * k + 4, true);
        text += decoder.decode(new Uint8Array(memory.buffer, at, len), { stream: true });
        total += len;
      }
      v.setUint32(written, total, true);
      write(fd, text);
      return 0;
    },
    path_open: () => ENOENT,
    proc_exit: code => { throw new Error(`the engine stopped (${code})`); },
  };
  const { instance } = await WebAssembly.instantiate(bytes, { wasi_snapshot_preview1: wasi });
  const x = instance.exports;
  memory = x.memory;
  x._initialize();
  x.uci_init();
  const size = x.uci_size();
  return {
    command(line) {
      const b = encoder.encode(String(line));
      if (b.length > size) throw new Error("a command too long for the engine");
      new Uint8Array(memory.buffer, x.uci_buffer(), b.length).set(b);
      x.uci_command(b.length);
    },
  };
}
