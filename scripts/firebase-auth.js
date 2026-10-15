import { app } from "./firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

/** Renvoie l'utilisateur connecté ou redirige vers la page de connexion. */
async function requireUser() {
    const user = await getCurrentUser();
    if (!user) {
        window.location.replace("./index.html");
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

export { app, auth, getCurrentUser, requireUser, logout };
