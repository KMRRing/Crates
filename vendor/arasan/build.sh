#!/bin/bash
# Builds vendor/arasan/arasan.wasm from Arasan's source (vendor/arasan/NOTE.txt): the commit there, arasan-wasi.patch
# applied, compiled by clang 18 for wasm32-wasi as a reactor (no main(): the page's worker calls uci_init and
# uci_command), with WebAssembly SIMD standing in for the x86 SSE instructions its network code is written in
# (wasi-shim/immintrin.h; thread, mutex, condition_variable, pthread.h and fstream stand in for the threads and files a
# page can't have). Needs git, clang 18 and wasm-ld, dpkg-deb and apt-get (for Ubuntu's WASI C library and libc++,
# fetched into a scratch folder, nothing installed), and a network. Also writes arasan.nnue.z, the network packed for
# the page (the .nnue file deflated raw, which the page's DecompressionStream undoes).
#   bash vendor/arasan/build.sh [out folder]
set -e
VENDOR=$(cd "$(dirname "$0")" && pwd)
OUTDIR=${1:-$VENDOR}
COMMIT=84a67879b4b6c03fe5e2773ff22b9ceab1982375
WORK=$(mktemp -d "${TMPDIR:-/tmp}/arasan-XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# the source, at the commit, with the patch (its Fathom tablebase code is a submodule that isn't fetched: not used)
git clone --quiet https://github.com/jdart1/arasan-chess.git "$WORK/repo"
git -C "$WORK/repo" checkout --quiet "$COMMIT"
git -C "$WORK/repo" apply "$VENDOR/arasan-wasi.patch"
SRC=$WORK/repo/src
NET=$WORK/repo/network/arasanv9-20261023.nnue

# a WASI sysroot and clang's builtins for wasm32, from Ubuntu's packages, unpacked here
mkdir -p "$WORK/debs" "$WORK/sysroot" "$WORK/resource/lib/wasi"
(cd "$WORK/debs" && apt-get download wasi-libc libc++-18-dev-wasm32 libc++abi-18-dev-wasm32 libclang-rt-18-dev-wasm32)
for d in "$WORK"/debs/*.deb; do dpkg-deb -x "$d" "$WORK/sysroot"; done
SYSROOT=$WORK/sysroot/usr
cp -r /usr/lib/llvm-18/lib/clang/18/include "$WORK/resource/"
cp "$WORK"/sysroot/usr/lib/llvm-18/lib/clang/18/lib/wasi/libclang_rt.builtins-wasm32.a "$WORK/resource/lib/wasi/"
CXX="clang++ --target=wasm32-wasi --sysroot=$SYSROOT -resource-dir $WORK/resource"

# no exception is thrown (its two `throw` statements are replaced by abort()), so the C++ runtime's two entry points just stop
cat > "$WORK/stubs.c" <<'EOF'
#include <stdlib.h>
#include <stddef.h>
void* __cxa_allocate_exception(size_t size) { (void)size; abort(); }
void __cxa_throw(void* e, void* t, void (*d)(void*)) { (void)e; (void)t; (void)d; abort(); }
EOF
$CXX -O2 -x c -c "$WORK/stubs.c" -o "$WORK/stubs.o"

# the SSE4.1 code path (the one the network's int8 and int16 arithmetic is written for), over WebAssembly SIMD
NETBYTES=$(stat -c %s "$NET")
FLAGS="-O3 -std=c++17 -fno-rtti -fno-exceptions -fno-strict-aliasing -DNDEBUG -w -msimd128 -I$VENDOR/wasi-shim -I$SRC -I$SRC/nnue
  -DSIMD -DSSE2 -DSSSE3 -DSSE41 -DUSE_POPCNT -D_64BIT -DARASAN_VERSION=26.1 -DNETWORK=arasanv9-20261023.nnue -DNETWORK_BYTES=$NETBYTES
  -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_MMAN -D_WASI_EMULATED_PROCESS_CLOCKS"
FILES="protocol bench tester input globals board boardio material chess attacks bitutil chessio epdrec bhash scoring see movearr
  notation options bitprobe bookread bookwrit search searchc learn movegen hash calctime eco legal stats threadp threadc evaluate
  nnue/features/ppfeature wasm"
OBJS=""
for f in $FILES; do
  o="$WORK/$(basename "$f").o"
  $CXX $FLAGS -c "$SRC/$f.cpp" -o "$o" &
  OBJS="$OBJS $o"
  while [ "$(jobs -r | wc -l)" -ge 2 ]; do sleep 0.3; done
done
wait
for o in $OBJS; do [ -f "$o" ] || { echo "missing $o"; exit 1; }; done
# an 8 MB stack for the search's recursion; memory from 128 MB (the network is read into 28 MB and kept in another 28),
# growing to at most 1 GB
$CXX -O3 -mexec-model=reactor $OBJS "$WORK/stubs.o" -o "$OUTDIR/arasan.wasm" -lc++abi -lwasi-emulated-signal -lwasi-emulated-mman \
  -lwasi-emulated-process-clocks -Wl,-z,stack-size=8388608 -Wl,--initial-memory=134217728 -Wl,--max-memory=1073741824 -Wl,--strip-all
node "$VENDOR/pack-net.mjs" "$NET" "$OUTDIR/arasan.nnue.z"
ls -l "$OUTDIR/arasan.wasm" "$OUTDIR/arasan.nnue.z"
