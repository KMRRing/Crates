# Reads a torch.save zip without torch, and safely: the pickle may name only the few things a saved state dict is made of (an
# ordered dict, tensors rebuilt from raw storages); anything else is refused, so a downloaded file cannot run code.
import sys, zipfile, pickle, numpy as np, collections
DT = {"FloatStorage": np.float32, "HalfStorage": np.float16, "LongStorage": np.int64, "IntStorage": np.int32, "BoolStorage": np.bool_, "ByteStorage": np.uint8}
def load(path):
    z = zipfile.ZipFile(path); root = z.namelist()[0].split("/")[0]
    class Storage:
        def __init__(s, kind, key): s.kind, s.key = kind, key
    def rebuild(storage, offset, size, stride, *a):
        buf = np.frombuffer(z.read(f"{root}/data/{storage.key}"), dtype=DT[storage.kind])
        if not size: return buf[offset:offset + 1].reshape(())
        return np.lib.stride_tricks.as_strided(buf[offset:], shape=size, strides=[s * buf.itemsize for s in stride]).copy()
    ALLOWED = {("collections", "OrderedDict"): collections.OrderedDict, ("torch._utils", "_rebuild_tensor_v2"): rebuild,
               ("torch._utils", "_rebuild_parameter"): (lambda t, *a: t)}
    class U(pickle.Unpickler):
        def find_class(s, mod, name):
            if (mod, name) in ALLOWED: return ALLOWED[(mod, name)]
            if mod == "torch" and name in DT: return name
            raise pickle.UnpicklingError(f"refused: {mod}.{name}")
        def persistent_load(s, pid):
            tag, kind, key, loc, n = pid
            if tag != "storage" or kind not in DT: raise pickle.UnpicklingError(f"refused storage {pid!r}")
            return Storage(kind, key)
    return U(z.open(f"{root}/data.pkl")).load()
