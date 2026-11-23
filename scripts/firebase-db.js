import {
    initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
    collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc,
    deleteDoc, writeBatch, serverTimestamp, Timestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { app } from "./firebase-app.js";

// Cache persistant (IndexedDB) partagé entre onglets : la ludothèque s'affiche instantanément
// depuis l'appareil, reste consultable hors ligne, et les modifications faites hors ligne sont
// conservées puis envoyées au retour du réseau. Si IndexedDB est indisponible (navigation privée
// de certains navigateurs), on retombe sur le cache mémoire classique.
function creerDb() {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        });
    } catch (e) {
        console.warn("Cache hors ligne indisponible, mode en ligne uniquement :", e);
        return getFirestore(app);
    }
}
const db = creerDb();
const versObjet = (snap) => ({ id: snap.id, ...snap.data() });

/* ---------- Écritures tolérantes aux coupures ---------- */

// Hors ligne, une écriture Firestore est appliquée tout de suite sur l'appareil mais sa promesse
// ne se résout qu'au retour du réseau. Plutôt que de bloquer l'interface, on attend au plus DELAI ms :
// passé ce délai, l'écriture est considérée « en attente » (elle partira automatiquement).
const DELAI = 6000;

/**
 * @returns {Promise<{ enAttente: boolean, confirmation: Promise<void> }>}
 *   enAttente : true si le serveur n'a pas encore confirmé ; confirmation : promesse finale
 *   (à surveiller pour signaler un refus tardif, ex. droits insuffisants).
 */
async function tolerant(promesse) {
    let minuterie;
    const delai = new Promise(r => { minuterie = setTimeout(() => r("delai"), DELAI); });
    try {
        const premier = await Promise.race([promesse.then(() => "ok"), delai]);
        return { enAttente: premier === "delai", confirmation: promesse };
    } finally {
        clearTimeout(minuterie);
    }
}

async function getAllDocuments(collectionName) {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(versObjet);
}

async function getDocumentsWithWhere(collectionName, whereClauses) {
    const contraintes = whereClauses.map(c => where(c.field, c.operator, c.value));
    const snapshot = await getDocs(query(collection(db, collectionName), ...contraintes));
    return snapshot.docs.map(versObjet);
}

/** Renvoie le document ou null s'il n'existe pas. */
async function getDocumentById(collectionName, docId) {
    const snap = await getDoc(doc(db, collectionName, docId));
    return snap.exists() ? versObjet(snap) : null;
}

/** Crée (id auto si docId absent) ou remplace un document. Renvoie l'id. */
async function setDocument(collectionName, docId, data) {
    const ref = docId ? doc(db, collectionName, docId) : doc(collection(db, collectionName));
    await setDoc(ref, data);
    return ref.id;
}

/**
 * Comme setDocument, sans bloquer hors ligne. L'id est connu immédiatement (généré sur l'appareil).
 * @returns {Promise<{ id: string, enAttente: boolean, confirmation: Promise<void> }>}
 */
async function enregistrerDocument(collectionName, docId, data) {
    const ref = docId ? doc(db, collectionName, docId) : doc(collection(db, collectionName));
    return { id: ref.id, ...(await tolerant(setDoc(ref, data))) };
}

/** Comme deleteDocument, sans bloquer hors ligne. */
async function supprimerDocument(collectionName, docId) {
    return tolerant(deleteDoc(doc(db, collectionName, docId)));
}

async function updateDocument(collectionName, docId, data) {
    await updateDoc(doc(db, collectionName, docId), data);
}

async function deleteDocument(collectionName, docId) {
    await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Écoute en temps réel les documents d'une collection vérifiant field == value.
 * onData(docs, { depuisCache }) est appelé d'abord avec le cache de l'appareil (affichage
 * immédiat), puis à chaque changement, y compris ceux faits par les autres membres.
 * @returns fonction de désabonnement
 */
function ecouter(collectionName, field, value, onData, onError) {
    const q = query(collection(db, collectionName), where(field, "==", value));
    return onSnapshot(q, { includeMetadataChanges: true },
        (snap) => onData(snap.docs.map(versObjet), { depuisCache: snap.metadata.fromCache }),
        onError);
}

export {
    db, doc, collection, getDocs, getDoc, writeBatch, serverTimestamp, Timestamp,
    getAllDocuments, getDocumentsWithWhere, getDocumentById,
    setDocument, updateDocument, deleteDocument,
    enregistrerDocument, supprimerDocument, ecouter
};
