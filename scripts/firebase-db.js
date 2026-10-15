import {
    getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc,
    deleteDoc, writeBatch, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { app } from "./firebase-app.js";

// Note : l'ancienne fonction checkAuth() ajoutait un listener onAuthStateChanged à
// chaque appel sans jamais le détacher, et empêchait toute lecture anonyme.
// Le contrôle d'accès est désormais entièrement assuré par les règles Firestore.

const db = getFirestore(app);
const versObjet = (snap) => ({ id: snap.id, ...snap.data() });

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

async function updateDocument(collectionName, docId, data) {
    await updateDoc(doc(db, collectionName, docId), data);
}

async function deleteDocument(collectionName, docId) {
    await deleteDoc(doc(db, collectionName, docId));
}

export {
    db, doc, collection, getDocs, getDoc, writeBatch, serverTimestamp, Timestamp,
    getAllDocuments, getDocumentsWithWhere, getDocumentById,
    setDocument, updateDocument, deleteDocument
};
