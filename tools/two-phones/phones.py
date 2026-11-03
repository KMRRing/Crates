"""Two phones for Playwright (Python): docs/coop.md, "Looking at it".

    from phones import Rig
    rig = Rig()                                   # starts server.mjs, one browser
    host = rig.phone("H", name="Korbi", size=(390, 664))
    guest = rig.phone("G", name="Sarah", size=(390, 664))
    host.open("slitherlink.html")                 # both phones are on pair code TEST, so they are partners
    guest.open("slitherlink.html?watch=1")
    ...
    rig.close()

Each phone is its own browser context (its own storage, as a phone has), on the database in memory (server.mjs). Run it with
`python` (the container's `python3` has no Playwright); Chromium only, so nothing here says how Safari behaves.
"""
import json
import os
import subprocess
import time
import urllib.parse
import urllib.request

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SHIM = open(os.path.join(HERE, "shim.js")).read()


class Phone:
    def __init__(self, rig, uid, name, pid, size, theme, mode, scale, touch):
        self.rig, self.uid, self.name = rig, uid, name
        self.context = rig.browser.new_context(viewport={"width": size[0], "height": size[1]}, device_scale_factor=scale, has_touch=touch, is_mobile=touch)
        keys = {"pair:code": rig.pair, "pair:me": pid, "crates:name": name, "suite:theme": theme, "suite:mode": mode}
        setup = "".join(f"if (localStorage.getItem({json.dumps(k)}) === null) localStorage.setItem({json.dumps(k)}, {json.dumps(v)});" for k, v in keys.items())
        self.context.add_init_script(f"window.__phone = {{ uid: {json.dumps(uid)} }}; try {{ {setup} }} catch (e) {{}}\n{SHIM}")
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda e: self.errors.append(str(e)))
        self.page.on("console", lambda m: self.errors.append(m.text) if m.type == "error" else None)

    def open(self, path, wait=True):
        self.page.goto(f"{self.rig.url}/{path}")
        if wait:
            self.page.wait_for_load_state("load")
        return self

    def look(self, theme, mode):
        """Theme (codex, modern, kontor) and day or night, then the page again."""
        self.page.evaluate("([t, m]) => { localStorage.setItem('suite:theme', t); localStorage.setItem('suite:mode', m); }", [theme, mode])
        self.page.reload()

    def eval(self, js, arg=None):
        return self.page.evaluate(js, arg)

    def wait(self, js, timeout=15000):
        self.page.wait_for_function(js, timeout=timeout)

    def shot(self, name, full=False):
        path = os.path.join(self.rig.out, name)
        self.page.screenshot(path=path, full_page=full)
        return path

    def scrolls(self):
        """Whether the page scrolls (the suite's rule is that it never does)."""
        return self.page.evaluate("document.documentElement.scrollHeight > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1")


class Rig:
    def __init__(self, port=8777, pair="TEST", out="/tmp"):
        self.port, self.pair, self.out = port, pair, out
        self.url = f"http://localhost:{port}"
        self.server = subprocess.Popen(["node", os.path.join(HERE, "server.mjs"), str(port)], stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT)
        for _ in range(60):
            try:
                urllib.request.urlopen(self.url + "/", timeout=1)
                break
            except Exception:
                time.sleep(0.1)
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch()
        self.phones = []

    def phone(self, uid, name, pid=None, size=(390, 664), theme="codex", mode="day", scale=1, touch=True):
        p = Phone(self, uid, name, pid or f"pid{uid}", size, theme, mode, scale, touch)
        self.phones.append(p)
        return p

    def ctl(self, op, **kw):
        q = urllib.parse.urlencode({"op": op, **kw})
        return json.loads(urllib.request.urlopen(f"{self.url}/__db/ctl?{q}", data=b"{}").read())

    def read(self, path):
        return self.ctl("read", path=path).get("v")

    def offline(self, phone):
        self.ctl("offline", uid=phone.uid)

    def online(self, phone):
        self.ctl("online", uid=phone.uid)

    def close(self):
        for p in self.phones:
            try:
                p.context.close()
            except Exception:
                pass
        self.browser.close()
        self.pw.stop()
        self.server.terminate()
