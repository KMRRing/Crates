# Writes Ataraxos's policy (pretrained/final_run/model42400.pthw, MIT licence) as one little-endian float16 file in a fixed order,
# with a JSON list of each tensor's name, shape and offset (pack-net.mjs packs that for the app). No torch needed: readpt.py reads
# the checkpoint, and refuses anything in it but tensors.   python3 -I vendor/ataraxos/export.py model42400.pthw net.bin
import sys, os, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from readpt import load
d = load(sys.argv[1]); out = sys.argv[2]
P = "_orig_mod.module."
names = ["positional_encoding", "embedder.weight", "embedder.bias"]
for i in range(8):
    names += [f"transformer.{i}.{n}" for n in ["layer_norm1.weight", "layer_norm1.bias", "mha.qkv_proj.weight", "mha.qkv_proj.bias", "mha.out_proj.weight", "mha.out_proj.bias", "layer_norm2.weight", "layer_norm2.bias", "linear1.weight", "linear1.bias", "linear2.weight", "linear2.bias"]]
names += ["norm_out.weight", "norm_out.bias", "qk_proj.weight", "qk_proj.bias", "value_head.weight", "value_head.bias"]
assert set(P + n for n in names) == set(d.keys()), set(d.keys()) ^ set(P + n for n in names)
meta, parts, off = [], [], 0
for n in names:
    a = np.ascontiguousarray(d[P + n], dtype=np.float32)
    meta.append({"name": n, "shape": list(a.shape), "offset": off}); off += a.size
    parts.append(a.astype("<f2").tobytes())
open(out, "wb").write(b"".join(parts))
json.dump({"count": off, "tensors": meta}, open(out + ".json", "w"))
print(off, "values,", sum(len(p) for p in parts) / 1e6, "MB")
# the largest error float16 makes, against float32
print("max f16 error", max(float(np.abs(d[P + n].astype(np.float16).astype(np.float32) - d[P + n]).max()) for n in names))
