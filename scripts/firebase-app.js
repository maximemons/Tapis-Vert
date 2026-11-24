import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// Configuration web Firebase : ces identifiants sont publics par nature.
// La sécurité repose sur les règles Firestore (voir firestore.rules), pas sur leur secret.
const firebaseConfig = {
  apiKey: "AIzaSyAOWtGXCFHum0o_MM6voaL_sDpHSaxLII4",
  authDomain: "tapis-v.firebaseapp.com",
  projectId: "tapis-v",
  storageBucket: "tapis-v.firebasestorage.app",
  messagingSenderId: "777012348059",
  appId: "1:777012348059:web:5cac6dab87032fef0f723e"
};

const app = initializeApp(firebaseConfig);

export { app };
