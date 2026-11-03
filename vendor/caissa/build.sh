#!/bin/bash
# Builds vendor/caissa/caissa.wasm from Caissa's source (vendor/caissa/NOTE.txt): the commit there, caissa-wasi.patch
# applied, compiled by clang 18 for wasm32-wasi as a reactor (no main(): the page's worker calls uci_init and
# uci_command), with WebAssembly SIMD standing in for the x86 SSE4 instructions its network code is written in
# (wasi-shim/immintrin.h; thread, mutex and condition_variable stand in for the threads a page can't have). Needs git,
# clang 18 and wasm-ld, dpkg-deb and apt-get (for Ubuntu's WASI C library and libc++, fetched into a scratch folder,
# nothing installed), and a network.
#   bash vendor/caissa/build.sh [out.wasm]
set -e
VENDOR=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-$VENDOR/caissa.wasm}
COMMIT=324f1f903eadbb889180e7b0b097af5fa6748f44
WORK=$(mktemp -d "${TMPDIR:-/tmp}/caissa-XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# the source, at the commit, with the patch
git clone --quiet https://github.com/Witek902/Caissa.git "$WORK/src"
git -C "$WORK/src" checkout --quiet "$COMMIT"
git -C "$WORK/src" apply "$VENDOR/caissa-wasi.patch"
SRC=$WORK/src/src

# a WASI sysroot and clang's builtins for wasm32, from Ubuntu's packages, unpacked here
mkdir -p "$WORK/debs" "$WORK/sysroot" "$WORK/resource/lib/wasi"
(cd "$WORK/debs" && apt-get download wasi-libc libc++-18-dev-wasm32 libc++abi-18-dev-wasm32 libclang-rt-18-dev-wasm32)
for d in "$WORK"/debs/*.deb; do dpkg-deb -x "$d" "$WORK/sysroot"; done
SYSROOT=$WORK/sysroot/usr
cp -r /usr/lib/llvm-18/lib/clang/18/include "$WORK/resource/"
cp "$WORK"/sysroot/usr/lib/llvm-18/lib/clang/18/lib/wasi/libclang_rt.builtins-wasm32.a "$WORK/resource/lib/wasi/"
CXX="clang++ --target=wasm32-wasi --sysroot=$SYSROOT -resource-dir $WORK/resource"

# no exceptions are thrown (built with -fno-exceptions), so the C++ runtime's two entry points just stop
cat > "$WORK/stubs.c" <<'EOF'
#include <stdlib.h>
#include <stddef.h>
void* __cxa_allocate_exception(size_t size) { (void)size; abort(); }
void __cxa_throw(void* e, void* t, void (*d)(void*)) { (void)e; (void)t; (void)d; abort(); }
EOF
$CXX -O2 -x c -c "$WORK/stubs.c" -o "$WORK/stubs.o"

# the SSE4 code path (the one the network's int8 and int16 arithmetic is written for), over WebAssembly SIMD
FLAGS="-O3 -std=c++20 -fno-rtti -fno-exceptions -fno-math-errno -fno-trapping-math -DCONFIGURATION_FINAL -DNDEBUG
  -DCAISSA_VERSION=\"2.0.12\" -DCAISSA_DEFAULT_EVALFILE=\"<empty>\" -D_WASI_EMULATED_SIGNAL -D_WASI_EMULATED_MMAN
  -DUSE_SSE -DUSE_SSE2 -DUSE_SSE4 -msimd128 -w -I$VENDOR/wasi-shim"
OBJS=""
for f in "$SRC"/backend/*.cpp "$SRC"/frontend/*.cpp; do
  o="$WORK/$(basename "$f" .cpp).o"
  $CXX $FLAGS -c "$f" -o "$o" &
  OBJS="$OBJS $o"
  while [ "$(jobs -r | wc -l)" -ge 2 ]; do sleep 0.3; done
done
wait
for o in $OBJS; do [ -f "$o" ] || { echo "missing $o"; exit 1; }; done
# an 8 MB stack for the search's recursion; memory from 128 MB (the network is 76 MB), growing to at most 1 GB
$CXX -O3 -mexec-model=reactor $OBJS "$WORK/stubs.o" -o "$OUT" -lc++abi -lwasi-emulated-signal -lwasi-emulated-mman \
  -Wl,-z,stack-size=8388608 -Wl,--initial-memory=134217728 -Wl,--max-memory=1073741824 -Wl,--strip-all
ls -l "$OUT"
