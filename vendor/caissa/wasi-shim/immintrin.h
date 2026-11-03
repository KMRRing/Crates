// The few x86 SSE intrinsics Caissa's network code uses (its SSE4 path), written over WebAssembly SIMD, so the same
// source and the same arithmetic run in a browser. A stand-in for <immintrin.h> for the WebAssembly build only.
#pragma once
#include <wasm_simd128.h>

typedef v128_t __m128i;
typedef v128_t __m128;

#define _MM_HINT_T0 3
#define _MM_SHUFFLE(z, y, x, w) (((z) << 6) | ((y) << 4) | ((x) << 2) | (w))
#define _MM_DENORMALS_ZERO_ON 0
#define _MM_FLUSH_ZERO_ON 0
#define _MM_SET_DENORMALS_ZERO_MODE(x) ((void)(x))
#define _MM_SET_FLUSH_ZERO_MODE(x) ((void)(x))

static inline void _mm_prefetch(const char*, int) {}

static inline __m128i _mm_load_si128(const __m128i* p) { return wasm_v128_load(p); }
static inline __m128i _mm_loadu_si128(const __m128i* p) { return wasm_v128_load(p); }
static inline void _mm_store_si128(__m128i* p, __m128i a) { wasm_v128_store(p, a); }
static inline void _mm_storeu_si128(__m128i* p, __m128i a) { wasm_v128_store(p, a); }

static inline __m128i _mm_setzero_si128() { return wasm_i32x4_splat(0); }
static inline __m128i _mm_set1_epi16(short x) { return wasm_i16x8_splat(x); }
static inline __m128i _mm_set1_epi32(int x) { return wasm_i32x4_splat(x); }

static inline __m128i _mm_add_epi16(__m128i a, __m128i b) { return wasm_i16x8_add(a, b); }
static inline __m128i _mm_sub_epi16(__m128i a, __m128i b) { return wasm_i16x8_sub(a, b); }
static inline __m128i _mm_add_epi32(__m128i a, __m128i b) { return wasm_i32x4_add(a, b); }
static inline __m128i _mm_min_epi16(__m128i a, __m128i b) { return wasm_i16x8_min(a, b); }
static inline __m128i _mm_max_epi16(__m128i a, __m128i b) { return wasm_i16x8_max(a, b); }
static inline __m128i _mm_cmpeq_epi32(__m128i a, __m128i b) { return wasm_i32x4_eq(a, b); }

#define _mm_slli_epi16(a, n) wasm_i16x8_shl((a), (n))
#define _mm_srai_epi32(a, n) wasm_i32x4_shr((a), (n))

// the high 16 bits of each signed 16 x 16 product
static inline __m128i _mm_mulhi_epi16(__m128i a, __m128i b) {
  const __m128i lo = wasm_i32x4_shr(wasm_i32x4_extmul_low_i16x8(a, b), 16);
  const __m128i hi = wasm_i32x4_shr(wasm_i32x4_extmul_high_i16x8(a, b), 16);
  return wasm_i16x8_narrow_i32x4(lo, hi);
}

// pairs of signed 16-bit products added into 32 bits
static inline __m128i _mm_madd_epi16(__m128i a, __m128i b) { return wasm_i32x4_dot_i16x8(a, b); }

// pairs of (unsigned byte of a) x (signed byte of b) products added into 16 bits, saturating
static inline __m128i _mm_maddubs_epi16(__m128i a, __m128i b) {
  const __m128i lo = wasm_i16x8_mul(wasm_u16x8_extend_low_u8x16(a), wasm_i16x8_extend_low_i8x16(b));
  const __m128i hi = wasm_i16x8_mul(wasm_u16x8_extend_high_u8x16(a), wasm_i16x8_extend_high_i8x16(b));
  return wasm_i16x8_add_sat(wasm_i16x8_shuffle(lo, hi, 0, 2, 4, 6, 8, 10, 12, 14), wasm_i16x8_shuffle(lo, hi, 1, 3, 5, 7, 9, 11, 13, 15));
}

static inline __m128i _mm_packs_epi32(__m128i a, __m128i b) { return wasm_i16x8_narrow_i32x4(a, b); }
static inline __m128i _mm_packus_epi16(__m128i a, __m128i b) { return wasm_u8x16_narrow_i16x8(a, b); }

static inline __m128 _mm_castsi128_ps(__m128i a) { return a; }
static inline int _mm_movemask_ps(__m128 a) { return (int)wasm_i32x4_bitmask(a); }
static inline int _mm_cvtsi128_si32(__m128i a) { return wasm_i32x4_extract_lane(a, 0); }
#define _mm_shuffle_epi32(a, imm) \
  wasm_i32x4_shuffle((a), (a), (imm) & 3, ((imm) >> 2) & 3, ((imm) >> 4) & 3, ((imm) >> 6) & 3)
