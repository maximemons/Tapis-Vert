const user = () => { const e = sessionStorage.getItem("__user"); return e ? { email: e } : null; };
export function getAuth() { return {}; }
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(user()), 0); return () => {}; }
export async function signOut() { sessionStorage.removeItem("__user"); }
export async function signInWithEmailAndPassword(a, e, p) { if (p !== "ok") { const err = new Error("x"); err.code = "auth/invalid-credential"; throw err; } sessionStorage.setItem("__user", e); }
export async function sendPasswordResetEmail() {}
