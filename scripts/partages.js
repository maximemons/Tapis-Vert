// Liens de visualisation en lecture seule, révocables.
//
// Modèle Firestore :
//   partagesPrives/{jeton}       privé  : proprios[], creePar, libelle, titre, inclureWishlist, expireLe, creeLe
//   partages/{jeton}             public : titre, inclureWishlist, expireLe, majLe
//   partages/{jeton}/jeux/{id}   public : copie épurée de chaque jeu (cf. projeterJeuPourPartage)
//
// Le jeton (192 bits aléatoires) est le seul secret : il n'apparaît que dans le
// fragment (#) de l'URL, qui n'est jamais envoyé au serveur d'hébergement.
// Révoquer = supprimer le document public : l'accès est coupé immédiatement par les règles.
import {
    db, doc, collection, getDocs, writeBatch, serverTimestamp, Timestamp,
    getDocumentsWithWhere, setDocument, updateDocument, deleteDocument
} from "./firebase-db.js";
import { COLLECTIONS } from "./records.js";
import { genererJeton, projeterJeuPourPartage, jeuxDuPartage, differences, estExpire } from "./logic.js";
import { nettoyerHtml } from "./ui.js";

const TAILLE_LOT = 400; // limite Firestore : 500 opérations par batch

const versMs = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);

export function lienDuPartage(jeton) {
    return new URL(`partage.html#${jeton}`, window.location.href).href;
}

export async function listerPartages(monEmail) {
    const docs = await getDocumentsWithWhere(COLLECTIONS.PARTAGES_PRIVES, [
        { field: "proprios", operator: "array-contains", value: monEmail }
    ]);
    return docs
        .map(d => ({
            jeton: d.id,
            proprios: d.proprios || [],
            creePar: d.creePar,
            libelle: d.libelle || "",
            titre: d.titre || "",
            inclureWishlist: d.inclureWishlist === true,
            expireLe: versMs(d.expireLe),
            creeLe: versMs(d.creeLe)
        }))
        .sort((a, b) => (b.creeLe || 0) - (a.creeLe || 0));
}

/**
 * @param expireDansJours nombre de jours avant expiration, ou null pour « jamais »
 */
export async function creerPartage({ monEmail, proprios, libelle, titre, inclureWishlist, expireDansJours }, jeux) {
    const jeton = genererJeton();
    const expireLe = expireDansJours
        ? Timestamp.fromMillis(Date.now() + expireDansJours * 24 * 3600 * 1000)
        : null;

    // 1. Partie privée d'abord : les règles exigent qu'elle existe pour créer la partie publique.
    await setDocument(COLLECTIONS.PARTAGES_PRIVES, jeton, {
        proprios, creePar: monEmail, libelle, titre, inclureWishlist, expireLe, creeLe: serverTimestamp()
    });
    // 2. Partie publique (sans aucun email).
    await setDocument(COLLECTIONS.PARTAGES, jeton, {
        titre, inclureWishlist, expireLe, majLe: serverTimestamp()
    });

    const partage = { jeton, proprios, inclureWishlist, libelle, titre, expireLe: versMs(expireLe), creePar: monEmail };
    await synchroniserPartage(partage, jeux);
    return partage;
}

/** Aligne la copie publique sur l'état réel des jeux. N'écrit que ce qui a changé. */
export async function synchroniserPartage(partage, jeux) {
    const voulus = new Map(
        jeuxDuPartage(jeux, partage).map(j => [j.id, projeterJeuPourPartage(j, { nettoyerHtml })])
    );
    const snap = await getDocs(collection(db, COLLECTIONS.PARTAGES, partage.jeton, COLLECTIONS.PARTAGES_JEUX));
    const existants = new Map(snap.docs.map(d => [d.id, d.data()]));
    const { aEcrire, aSupprimer } = differences(voulus, existants);

    const operations = [
        ...aEcrire.map(({ id, data }) => (b) => b.set(doc(db, COLLECTIONS.PARTAGES, partage.jeton, COLLECTIONS.PARTAGES_JEUX, id), data)),
        ...aSupprimer.map(id => (b) => b.delete(doc(db, COLLECTIONS.PARTAGES, partage.jeton, COLLECTIONS.PARTAGES_JEUX, id)))
    ];
    for (let i = 0; i < operations.length; i += TAILLE_LOT) {
        const batch = writeBatch(db);
        operations.slice(i, i + TAILLE_LOT).forEach(op => op(batch));
        await batch.commit();
    }
    if (operations.length) {
        await updateDocument(COLLECTIONS.PARTAGES, partage.jeton, { majLe: serverTimestamp() });
    }
    return operations.length;
}

/** Synchronise tous les partages actifs ; les erreurs sont remontées sans bloquer les autres. */
export async function synchroniserTousLesPartages(partages, jeux) {
    const actifs = partages.filter(p => !estExpire(p.expireLe));
    const resultats = await Promise.allSettled(actifs.map(p => synchroniserPartage(p, jeux)));
    return resultats.filter(r => r.status === "rejected").map(r => r.reason);
}

/** Révocation : coupe l'accès immédiatement puis nettoie les données. Idempotent. */
export async function revoquerPartage(jeton) {
    await deleteDocument(COLLECTIONS.PARTAGES, jeton);

    const snap = await getDocs(collection(db, COLLECTIONS.PARTAGES, jeton, COLLECTIONS.PARTAGES_JEUX));
    for (let i = 0; i < snap.docs.length; i += TAILLE_LOT) {
        const batch = writeBatch(db);
        snap.docs.slice(i, i + TAILLE_LOT).forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
    await deleteDocument(COLLECTIONS.PARTAGES_PRIVES, jeton);
}
