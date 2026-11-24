import { app } from "./firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { db, doc, getDoc } from "./firebase-db.js";
import { ADMIN } from "./records.js";

const auth = getAuth(app);

/** Résout l'utilisateur courant une seule fois (le listener est ensuite détaché). */
function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            resolve(user);
        }, reject);
    });
}

/**
 * Un compte n'est accepté que si son email figure dans la collection « utilisateurs »
 * (même règle que firestore.rules), qu'il se connecte par mot de passe ou avec Google.
 * Supprimer une personne depuis le menu « Comptes » lui coupe donc l'accès.
 * L'administrateur est toujours accepté, pour ne jamais pouvoir s'enfermer dehors.
 */
async function estAutorise(user) {
    if (!user?.email) return false;
    if (user.email.toLowerCase() === ADMIN) return true;
    try {
        const snap = await getDoc(doc(db, "utilisateurs", user.email));
        return snap.exists();
    } catch (error) {
        // Refus des règles = compte inconnu. Autre erreur (réseau…) : les règles protègent de toute façon.
        return error?.code !== "permission-denied";
    }
}

/** Renvoie l'utilisateur connecté et autorisé, ou redirige vers la page de connexion. */
async function requireUser() {
    const user = await getCurrentUser();
    if (!user || !(await estAutorise(user))) {
        if (user) await signOut(auth).catch(() => {});
        window.location.replace(user ? "./index.html#refuse" : "./index.html");
        // On ne résout jamais : la page est en train d'être quittée.
        return new Promise(() => {});
    }
    return user;
}

async function logout() {
    try {
        await signOut(auth);
    } finally {
        window.location.replace("./index.html");
    }
}

export { app, auth, getCurrentUser, estAutorise, requireUser, logout };
