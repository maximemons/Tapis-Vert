import { auth, getCurrentUser, estAutorise } from './firebase-auth.js';
import {
    signInWithEmailAndPassword, sendPasswordResetEmail, signOut,
    GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const googleBtn = document.getElementById('googleBtn');
const errorDiv = document.getElementById('error');
const successDiv = document.getElementById('success');

// Messages compréhensibles au lieu des codes Firebase bruts.
// Volontairement identiques pour « email inconnu » et « mauvais mot de passe ».
const MESSAGES = {
    'auth/invalid-email': "L'adresse email n'est pas valide.",
    'auth/invalid-credential': "Email ou mot de passe incorrect.",
    'auth/wrong-password': "Email ou mot de passe incorrect.",
    'auth/user-not-found': "Email ou mot de passe incorrect.",
    'auth/user-disabled': "Ce compte est désactivé.",
    'auth/too-many-requests': "Trop de tentatives. Réessayez dans quelques minutes.",
    'auth/network-request-failed': "Connexion impossible. Vérifiez votre réseau.",
    'auth/account-exists-with-different-credential': "Un compte existe déjà avec cet email : connectez-vous avec votre mot de passe.",
    'auth/operation-not-allowed': "La connexion Google n'est pas activée pour ce site.",
    'auth/unauthorized-domain': "Ce site n'est pas autorisé pour la connexion Google (domaine à ajouter dans Firebase).",
    'auth/popup-blocked': "La fenêtre Google a été bloquée par le navigateur. Autorisez les pop-ups et réessayez."
};
const REFUS_GOOGLE = "Ce compte Google n'a pas accès à cette ludothèque. Demandez à l'administrateur de l'ajouter.";
const message = (error) => MESSAGES[error?.code] || "La connexion a échoué. Réessayez.";

function afficher(erreur, succes = "") {
    errorDiv.textContent = erreur;
    successDiv.textContent = succes;
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email || !passwordInput.value) return afficher("Saisissez votre email et votre mot de passe.");
    loginBtn.disabled = true;
    try {
        await signInWithEmailAndPassword(auth, email, passwordInput.value);
        window.location.replace('dashboard.html');
    } catch (error) {
        afficher(message(error));
        loginBtn.disabled = false;
    }
});

// Accès au tableau de bord, sauf pour un compte Google inconnu (déconnecté aussitôt).
async function entrer(user) {
    if (await estAutorise(user)) return window.location.replace('dashboard.html');
    await signOut(auth).catch(() => {});
    afficher(REFUS_GOOGLE);
    loginBtn.disabled = false;
    googleBtn.disabled = false;
}

// Déjà connecté, ou retour d'une connexion Google par redirection : on file au tableau de bord.
(async () => {
    if (location.hash === '#refuse') {
        afficher(REFUS_GOOGLE);
        history.replaceState(null, '', location.pathname + location.search);
    }
    try {
        const retour = await getRedirectResult(auth);
        if (retour?.user) return entrer(retour.user);
    } catch (error) {
        afficher(message(error));
    }
    const user = await getCurrentUser();
    if (user) entrer(user);
})();

googleBtn.addEventListener('click', async () => {
    const fournisseur = new GoogleAuthProvider();
    fournisseur.setCustomParameters({ prompt: 'select_account' });
    afficher("");
    googleBtn.disabled = true;
    loginBtn.disabled = true;
    try {
        const resultat = await signInWithPopup(auth, fournisseur);
        await entrer(resultat.user);
    } catch (error) {
        const code = error?.code;
        // Pop-up impossible (bloquée, appli installée…) : on passe par une redirection.
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            try { return await signInWithRedirect(auth, fournisseur); } catch (e) { error = e; }
        }
        // Fenêtre fermée par l'utilisateur : rien à signaler.
        if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') afficher(message(error));
        googleBtn.disabled = false;
        loginBtn.disabled = false;
    }
});

document.getElementById("forgetPwd").addEventListener('click', async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return afficher("Saisissez d'abord votre email.");
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        if (error?.code === 'auth/invalid-email') return afficher(message(error));
        // Autres erreurs : on ne révèle pas si le compte existe.
    }
    afficher("", "Si un compte existe pour cet email, un lien de réinitialisation vient d'être envoyé. Pensez à vérifier vos spams.");
});

// EASTER EGG
const el = document.getElementById('myEgg');
const text = el.textContent.trim();
el.replaceChildren(...[...text].map(ch => {
    const span = document.createElement('span');
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    return span;
}));
el.addEventListener('mousedown', e => e.preventDefault());
el.addEventListener('selectstart', e => e.preventDefault());

function triggerGlitch() {
    el.classList.add('active');
    setTimeout(() => el.classList.remove('active'), 800);
}
el.addEventListener('click', triggerGlitch);
el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerGlitch();
    }
});
