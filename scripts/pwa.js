// Mode hors ligne : service worker (copie locale de l'application) et suivi du réseau.

/** Enregistre le service worker ; sans effet si le navigateur ne le permet pas. */
export function enregistrerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    const enregistrer = () => navigator.serviceWorker.register("./sw.js").catch((e) => {
        console.warn("Mode hors ligne indisponible :", e);
    });
    if (document.readyState === "complete") enregistrer();
    else window.addEventListener("load", enregistrer, { once: true });
}

/** Bandeau discret + rappels quand la connexion tombe ou revient. */
export function surveillerReseau({ horsLigne, enLigne } = {}) {
    const maj = (premierPassage = false) => {
        const coupe = navigator.onLine === false;
        document.documentElement.classList.toggle("hors-ligne", coupe);
        if (premierPassage) return;
        (coupe ? horsLigne : enLigne)?.();
    };
    window.addEventListener("online", () => maj());
    window.addEventListener("offline", () => maj());
    maj(true);
    if (navigator.onLine === false) horsLigne?.();
}
