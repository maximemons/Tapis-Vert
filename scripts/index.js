import { auth, getCurrentUser } from './firebase-auth.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorDiv = document.getElementById('error');
const successDiv = document.getElementById('success');

// Déjà connecté : on file directement au tableau de bord.
getCurrentUser().then(user => { if (user) window.location.replace('dashboard.html'); });

// Messages compréhensibles au lieu des codes Firebase bruts.
// Volontairement identiques pour « email inconnu » et « mauvais mot de passe ».
const MESSAGES = {
    'auth/invalid-email': "L'adresse email n'est pas valide.",
    'auth/invalid-credential': "Email ou mot de passe incorrect.",
    'auth/wrong-password': "Email ou mot de passe incorrect.",
    'auth/user-not-found': "Email ou mot de passe incorrect.",
    'auth/user-disabled': "Ce compte est désactivé.",
    'auth/too-many-requests': "Trop de tentatives. Réessayez dans quelques minutes.",
    'auth/network-request-failed': "Connexion impossible. Vérifiez votre réseau."
};
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
