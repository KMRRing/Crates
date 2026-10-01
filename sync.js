// Firebase Realtime Database adapter for playing together (loaded only when needed).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction, update, onDisconnect }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// Same Firebase project as CroatiaQuiz ("croatiabio"). Web config is public by design;
// access is governed by the database rules (see README).
const CONFIG = {
  apiKey: "AIzaSyCfl6mWI_7cf2VYnpxXB9WwTU_weoH8vA0",
  authDomain: "croatiabio.firebaseapp.com",
  projectId: "croatiabio",
  storageBucket: "croatiabio.firebasestorage.app",
  messagingSenderId: "113693793639",
  appId: "1:113693793639:web:b24cbab9ade143042523c2",
};
const DB_URLS = [
  "https://croatiabio-default-rtdb.europe-west1.firebasedatabase.app",
  "https://croatiabio-default-rtdb.firebaseio.com",
];

async function resolveDbUrl() {
  for (const url of DB_URLS) {
    try {
      const res = await fetch(url + "/.json?shallow=true");
      if (res.status !== 404) return url;      // 200/401/403 all mean the instance exists
    } catch { /* try the next one */ }
  }
  return DB_URLS[0];
}

export async function connect() {
  const app = initializeApp(CONFIG, "crates");
  const db = getDatabase(app, await resolveDbUrl());
  const auth = getAuth(app);
  const user = await new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, u => { if (u) { off(); resolve(u); } });
    signInAnonymously(auth).catch(reject);
  });

  return {
    uid: user.uid,
    watch(path, cb, onError) {
      return onValue(ref(db, path), snap => cb(snap.val()), err => onError?.(err));
    },
    async tx(path, fn) {
      const r = await runTransaction(ref(db, path), fn, { applyLocally: false });
      return { committed: r.committed, value: r.snapshot.val() };
    },
    update(path, obj) {
      return update(ref(db, path), obj);
    },
    /** Marks path online while connected and offline on disconnect; returns a function that stops it. */
    presence(path) {
      const off = onValue(ref(db, ".info/connected"), snap => {
        if (snap.val() !== true) return;
        onDisconnect(ref(db, path)).update({ online: false });
        update(ref(db, path), { online: true });
      });
      return () => { off(); onDisconnect(ref(db, path)).cancel(); };
    },
  };
}
