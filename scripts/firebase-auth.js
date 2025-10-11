import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOWtGXCFHum0o_MM6voaL_sDpHSaxLII4",
  authDomain: "tapis-v.firebaseapp.com",
  projectId: "tapis-v",
  storageBucket: "tapis-v.firebasestorage.app",
  messagingSenderId: "777012348059",
  appId: "1:777012348059:web:5cac6dab87032fef0f723e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

function getCurrentUser() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, (user) => {
            resolve(user);
        }, reject);
    });
}

async function logout() {
    try {
        await signOut(auth);
        window.location.href = "https://maximemons.github.io/Tapis-Vert/";
    } catch (error) {
        console.error("Erreur lors de la déconnexion :", error);
    }
}

export { app, auth, getCurrentUser, logout };