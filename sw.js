// Service worker Tapis Vert : l'application s'ouvre même sans réseau.
// Les données (jeux) sont gérées à part, par le cache hors ligne de Firestore.
// Incrémenter VERSION à chaque mise en ligne pour renouveler la copie locale.
const VERSION = "tapis-vert-v2.0.0";

const COQUILLE = [
    "./",
    "./index.html",
    "./dashboard.html",
    "./partage.html",
    "./404.html",
    "./404.jpg",
    "./manifest.webmanifest",
    "./favicon.ico",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png",
    "./styles/common.css",
    "./styles/index.css",
    "./styles/dashboard.css",
    "./styles/vendor/quill-2.0.3.snow.css",
    "./scripts/dashboard.js",
    "./scripts/editeur.js",
    "./scripts/firebase-app.js",
    "./scripts/firebase-auth.js",
    "./scripts/firebase-db.js",
    "./scripts/icones.js",
    "./scripts/images.js",
    "./scripts/index.js",
    "./scripts/logic.js",
    "./scripts/partage.js",
    "./scripts/partages.js",
    "./scripts/pwa.js",
    "./scripts/qrcode.js",
    "./scripts/records.js",
    "./scripts/saisie-auto.js",
    "./scripts/ui.js",
    "./scripts/wikidata.js",
    "./scripts/vendor/purify-3.4.17.es.mjs",
    "./scripts/vendor/qrcode-generator-1.4.4.js",
    "./scripts/vendor/quill-2.0.3.js"
];

// Bibliothèques Firebase : versionnées dans l'URL, donc immuables -> cache d'abord.
const FIREBASE = "https://www.gstatic.com/firebasejs/";
const MODULES_FIREBASE = ["firebase-app.js", "firebase-auth.js", "firebase-firestore.js"]
    .map(f => `${FIREBASE}12.19.0/${f}`);

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(VERSION);
        // Fichier par fichier : un seul échec ne doit pas empêcher l'installation.
        await Promise.all(COQUILLE.map(url => cache.add(new Request(url, { cache: "reload" })).catch(() => {})));
        await Promise.all(MODULES_FIREBASE.map(url => cache.add(new Request(url, { mode: "cors" })).catch(() => {})));
        await self.skipWaiting();
    })());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const cles = await caches.keys();
        await Promise.all(cles.filter(k => k.startsWith("tapis-vert-") && k !== VERSION).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

const delai = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("délai")), ms));

// Fichiers du site : réseau d'abord (toujours la dernière version, HTML et JS cohérents),
// copie locale si le réseau est absent ou trop lent.
async function reseauDabord(request) {
    const cache = await caches.open(VERSION);
    try {
        const reponse = await Promise.race([fetch(request), delai(4000)]);
        if (reponse.ok) cache.put(request, reponse.clone());
        return reponse;
    } catch {
        const copie = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
        if (copie) return copie;
        if (request.mode === "navigate") {
            const page = new URL(request.url).pathname.endsWith("partage.html") ? "./partage.html" : "./index.html";
            const repli = await cache.match(page);
            if (repli) return repli;
        }
        return Response.error();
    }
}

async function cacheDabord(request) {
    const cache = await caches.open(VERSION);
    const copie = await cache.match(request);
    if (copie) return copie;
    const reponse = await fetch(request);
    if (reponse.ok) cache.put(request, reponse.clone());
    return reponse;
}

self.addEventListener("fetch", (event) => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    if (url.origin === self.location.origin) {
        event.respondWith(reseauDabord(request));
    } else if (request.url.startsWith(FIREBASE)) {
        event.respondWith(cacheDabord(request));
    }
    // Tout le reste (Firestore, authentification, Wikidata, images externes) : navigateur, sans interception.
});
