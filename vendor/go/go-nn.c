/* The arithmetic of Go's network, written for the Codex (own code, MIT with the rest of the site; see NOTE.txt).
   Freestanding C over WebAssembly SIMD: a convolution, a batch norm with activation, the adds and the global pooling that
   a KataGo-format residual network is built from. go-net.js reads the net's file and orders these calls.

   Every tensor is NHWC (channels fastest) with a border of two zero cells around the H x W board, so a 5x5 or a 3x3
   filter never tests an edge. Only the inside is ever written, so the border stays zero. Channel counts are multiples
   of four. */
#include <wasm_simd128.h>

#define B 2
typedef unsigned int size_t;

typedef v128_t v;
#define LD(p) wasm_v128_load(p)
#define ST(p, x) wasm_v128_store(p, x)
#define SPLAT(f) wasm_f32x4_splat(f)
#define MUL(a, b) wasm_f32x4_mul(a, b)
#define ADD(a, b) wasm_f32x4_add(a, b)

/* out = (add ? out : 0) + conv(in, w). w is laid out (ky, kx, ic, oc) as the net file has it. */
void conv(const float *in, int IC, const float *w, float *out, int OC, int H, int W, int K, int add) {
  const int r = K / 2, Wp = W + 2 * B;
  for (int y = 0; y < H; y++) {
    for (int x = 0; x < W; x += 2) {
      const int two = x + 1 < W;
      float *o0 = out + ((y + B) * Wp + x + B) * OC;
      float *o1 = o0 + OC;
      int ocb = 0;
      for (; ocb + 16 <= OC; ocb += 16) {
        v a00 = SPLAT(0), a01 = a00, a02 = a00, a03 = a00, a10 = a00, a11 = a00, a12 = a00, a13 = a00;
        if (add) {
          a00 = LD(o0 + ocb); a01 = LD(o0 + ocb + 4); a02 = LD(o0 + ocb + 8); a03 = LD(o0 + ocb + 12);
          if (two) { a10 = LD(o1 + ocb); a11 = LD(o1 + ocb + 4); a12 = LD(o1 + ocb + 8); a13 = LD(o1 + ocb + 12); }
        }
        for (int ky = -r; ky <= r; ky++) {
          for (int kx = -r; kx <= r; kx++) {
            const float *p0 = in + ((y + B + ky) * Wp + x + B + kx) * IC;
            const float *p1 = two ? p0 + IC : p0;
            const float *wp = w + ((size_t)((ky + r) * K + kx + r) * IC) * OC + ocb;
            for (int ic = 0; ic < IC; ic++, wp += OC) {
              v s0 = SPLAT(p0[ic]), s1 = SPLAT(p1[ic]);
              v b0 = LD(wp), b1 = LD(wp + 4), b2 = LD(wp + 8), b3 = LD(wp + 12);
              a00 = ADD(a00, MUL(s0, b0)); a01 = ADD(a01, MUL(s0, b1)); a02 = ADD(a02, MUL(s0, b2)); a03 = ADD(a03, MUL(s0, b3));
              a10 = ADD(a10, MUL(s1, b0)); a11 = ADD(a11, MUL(s1, b1)); a12 = ADD(a12, MUL(s1, b2)); a13 = ADD(a13, MUL(s1, b3));
            }
          }
        }
        ST(o0 + ocb, a00); ST(o0 + ocb + 4, a01); ST(o0 + ocb + 8, a02); ST(o0 + ocb + 12, a03);
        if (two) { ST(o1 + ocb, a10); ST(o1 + ocb + 4, a11); ST(o1 + ocb + 8, a12); ST(o1 + ocb + 12, a13); }
      }
      for (; ocb + 4 <= OC; ocb += 4) {
        v a0 = SPLAT(0), a1 = a0;
        if (add) { a0 = LD(o0 + ocb); if (two) a1 = LD(o1 + ocb); }
        for (int ky = -r; ky <= r; ky++) {
          for (int kx = -r; kx <= r; kx++) {
            const float *p0 = in + ((y + B + ky) * Wp + x + B + kx) * IC;
            const float *p1 = two ? p0 + IC : p0;
            const float *wp = w + ((size_t)((ky + r) * K + kx + r) * IC) * OC + ocb;
            for (int ic = 0; ic < IC; ic++, wp += OC) {
              v b = LD(wp);
              a0 = ADD(a0, MUL(SPLAT(p0[ic]), b));
              a1 = ADD(a1, MUL(SPLAT(p1[ic]), b));
            }
          }
        }
        ST(o0 + ocb, a0);
        if (two) ST(o1 + ocb, a1);
      }
    }
  }
}

/* out = act(x * scale + bias) per channel, inside the board only (x and out may be the same tensor). */
void bnact(const float *x, const float *scale, const float *bias, float *out, int C, int H, int W, int relu) {
  const int Wp = W + 2 * B;
  const v zero = SPLAT(0);
  for (int y = 0; y < H; y++) {
    for (int xx = 0; xx < W; xx++) {
      const size_t at = (size_t)((y + B) * Wp + xx + B) * C;
      for (int c = 0; c < C; c += 4) {
        v t = ADD(MUL(LD(x + at + c), LD(scale + c)), LD(bias + c));
        if (relu) t = wasm_f32x4_max(t, zero);
        ST(out + at + c, t);
      }
    }
  }
}

/* a += b */
void addto(float *a, const float *b, int C, int H, int W) {
  const int Wp = W + 2 * B;
  for (int y = 0; y < H; y++) {
    for (int x = 0; x < W; x++) {
      const size_t at = (size_t)((y + B) * Wp + x + B) * C;
      for (int c = 0; c < C; c += 4) ST(a + at + c, ADD(LD(a + at + c), LD(b + at + c)));
    }
  }
}

/* a[pos, c] += bias[c] */
void addbias(float *a, const float *bias, int C, int H, int W) {
  const int Wp = W + 2 * B;
  for (int y = 0; y < H; y++) {
    for (int x = 0; x < W; x++) {
      const size_t at = (size_t)((y + B) * Wp + x + B) * C;
      for (int c = 0; c < C; c += 4) ST(a + at + c, ADD(LD(a + at + c), LD(bias + c)));
    }
  }
}

/* mean[c] and max[c] over the board of an activated tensor. */
void gpool(const float *x, int C, int H, int W, float *mean, float *max) {
  const int Wp = W + 2 * B;
  for (int c = 0; c < C; c++) { mean[c] = 0; max[c] = -1e30f; }
  for (int y = 0; y < H; y++) {
    for (int xx = 0; xx < W; xx++) {
      const float *p = x + (size_t)((y + B) * Wp + xx + B) * C;
      for (int c = 0; c < C; c++) {
        mean[c] += p[c];
        if (p[c] > max[c]) max[c] = p[c];
      }
    }
  }
  const float inv = 1.0f / (float)(H * W);
  for (int c = 0; c < C; c++) mean[c] *= inv;
}
