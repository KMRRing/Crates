#!/bin/sh
# Builds vendor/fairy-stockfish/fairy-stockfish.wasm from Fairy-Stockfish's source (vendor/fairy-stockfish/NOTE.txt):
# the commit there, single-threaded.patch applied, compiled by clang 18 for wasm32-wasi as a reactor (no main(): the
# page's worker calls uci_init and uci_command). Needs git, clang 18 and wasm-ld, dpkg-deb and apt-get (for Ubuntu's
# WASI C library and libc++, fetched into a scratch folder, nothing installed), and a network.
#   sh tools/fairy-stockfish.sh [out.wasm]
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
VENDOR=$ROOT/vendor/fairy-stockfish
OUT=${1:-$VENDOR/fairy-stockfish.wasm}
COMMIT=9f778da667f6e07dae1e85d3e2ea204fc6dee94d
WORK=$(mktemp -d "${TMPDIR:-/tmp}/fairy-XXXXXX")
trap 'rm -rf "$WORK"' EXIT

# the source, at the commit, with the patch
git clone --quiet https://github.com/fairy-stockfish/Fairy-Stockfish.git "$WORK/src"
git -C "$WORK/src" checkout --quiet "$COMMIT"
git -C "$WORK/src" apply "$VENDOR/single-threaded.patch"
SRC=$WORK/src/src

# a WASI sysroot and clang's builtins for wasm32, from Ubuntu's packages, unpacked here
mkdir -p "$WORK/debs" "$WORK/sysroot" "$WORK/resource/lib/wasi"
(cd "$WORK/debs" && apt-get download wasi-libc libc++-18-dev-wasm32 libc++abi-18-dev-wasm32 libclang-rt-18-dev-wasm32)
for d in "$WORK"/debs/*.deb; do dpkg-deb -x "$d" "$WORK/sysroot"; done
SYSROOT=$WORK/sysroot/usr
cp -r /usr/lib/llvm-18/lib/clang/18/include "$WORK/resource/"
cp "$WORK"/sysroot/usr/lib/llvm-18/lib/clang/18/lib/wasi/libclang_rt.builtins-wasm32.a "$WORK/resource/lib/wasi/"
CC="clang --target=wasm32-wasi --sysroot=$SYSROOT -resource-dir $WORK/resource"
CXX="clang++ --target=wasm32-wasi --sysroot=$SYSROOT -resource-dir $WORK/resource"

# no exceptions are thrown (built with -fno-exceptions), one thread never exits, and no tablebase file is mapped
cat > "$WORK/stubs.c" <<'EOF'
#include <stdlib.h>
#include <stddef.h>
void* __cxa_allocate_exception(size_t size) { (void)size; abort(); }
void __cxa_throw(void* e, void* t, void (*d)(void*)) { (void)e; (void)t; (void)d; abort(); }
int __cxa_thread_atexit(void (*dtor)(void*), void* obj, void* dso) { (void)dtor; (void)obj; (void)dso; return 0; }
int madvise(void* addr, size_t len, int advice) { (void)addr; (void)len; (void)advice; return 0; }
EOF
$CC -O2 -c "$WORK/stubs.c" -o "$WORK/stubs.o"

FLAGS="-O3 -std=c++17 -fno-exceptions -DNDEBUG -DLARGEBOARDS -DPRECOMPUTED_MAGICS -DNNUE_EMBEDDING_OFF -DIS_64BIT
  -DUSE_POPCNT -DNO_PREFETCH -DSINGLE_THREADED -DWASI_REACTOR -D_WASI_EMULATED_MMAN -Wno-deprecated-declarations
  -include $VENDOR/wasi-fstream.h"
OBJS=""
for f in benchmark.cpp bitbase.cpp bitboard.cpp endgame.cpp evaluate.cpp material.cpp misc.cpp movegen.cpp \
  movepick.cpp pawns.cpp position.cpp psqt.cpp search.cpp thread.cpp timeman.cpp tt.cpp uci.cpp ucioption.cpp \
  tune.cpp syzygy/tbprobe.cpp nnue/evaluate_nnue.cpp nnue/features/half_ka_v2.cpp partner.cpp parser.cpp piece.cpp \
  variant.cpp xboard.cpp nnue/features/half_ka_v2_variants.cpp wasi.cpp; do
  o="$WORK/$(echo "$f" | tr / _).o"
  $CXX $FLAGS -c "$SRC/$f" -o "$o"
  OBJS="$OBJS $o"
done
# an 8 MB stack for the search's recursion; memory from 64 MB, growing to at most 1 GB
$CXX -O3 -mexec-model=reactor $OBJS "$WORK/stubs.o" -o "$OUT" -lc++abi -lwasi-emulated-mman \
  -Wl,-z,stack-size=8388608 -Wl,--initial-memory=67108864 -Wl,--max-memory=1073741824 -Wl,--strip-all
ls -l "$OUT"
