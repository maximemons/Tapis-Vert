// Faux Firebase Auth : l'utilisateur courant vit dans sessionStorage (__user, __provider).
const user = () => {
  const e = sessionStorage.getItem("__user");
  if (!e) return null;
  const provider = sessionStorage.getItem("__provider") || "password";
  return { email: e, getIdTokenResult: async () => ({ signInProvider: provider }) };
};
const erreur = (code) => { const err = new Error(code); err.code = code; return err; };
export function getAuth() { return {}; }
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb(user()), 0); return () => {}; }
export async function signOut() { sessionStorage.removeItem("__user"); sessionStorage.removeItem("__provider"); }
export async function signInWithEmailAndPassword(a, e, p) { if (p !== "ok") throw erreur("auth/invalid-credential"); sessionStorage.setItem("__user", e); sessionStorage.setItem("__provider", "password"); }
export async function sendPasswordResetEmail() {}
// Connexion Google : le compte « choisi » est window.__googleEmail (absent = fenêtre fermée).
export class GoogleAuthProvider { setCustomParameters(p) { this.params = p; } }
export async function signInWithPopup() {
  const e = window.__googleEmail;
  if (!e) throw erreur("auth/popup-closed-by-user");
  sessionStorage.setItem("__user", e); sessionStorage.setItem("__provider", "google.com");
  return { user: user() };
}
export async function signInWithRedirect() { throw erreur("auth/operation-not-supported-in-this-environment"); }
export async function getRedirectResult() { return null; }
