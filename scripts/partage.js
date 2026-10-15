// Vue publique en lecture seule d'une ludothèque, accessible via un lien de visualisation.
// Aucune authentification : l'accès dépend uniquement du jeton présent dans l'URL
// et des règles Firestore (lien révoqué ou expiré => accès refusé).
import { db, collection, getDocs, getDocumentById } from "./firebase-db.js";
import { COLLECTIONS } from "./records.js";
import { estJetonValide, filtreDepuisParams, filtreVersParams, jeuCorrespond, trierParNom } from "./logic.js";
import { $, afficherGrille, afficherFiche, tirerAuSort, remplirFiltres, lireFiltres, compteur } from "./ui.js";

const state = { jeux: [], filtre: {}, jeuxAffiches: [] };

function etat(message) {
    $("#contenu").hidden = true;
    $("#etat").hidden = false;
    $("#etat").textContent = message;
    $(".pied").hidden = true;
}

function afficher() {
    const possedes = state.jeux.filter(j => !j.wishlist);
    remplirFiltres($("#filtres"), { jeux: possedes, filtre: state.filtre });
    state.jeuxAffiches = trierParNom(possedes.filter(j => jeuCorrespond(j, state.filtre)));
    $("#resultsCount").textContent = compteur(state.jeuxAffiches.length);

    const options = { onOuvrir: (j) => afficherFiche($("#dlgFiche"), j) }; // aucune action d'édition
    afficherGrille($("#grid"), state.jeuxAffiches, options);

    const souhaites = trierParNom(state.jeux.filter(j => j.wishlist));
    $("#wishlist").hidden = souhaites.length === 0;
    $("#wishlistCount").textContent = `(${souhaites.length})`;
    afficherGrille($("#wishlistGrid"), souhaites, options);
}

async function init() {
    const jeton = decodeURIComponent(location.hash.slice(1));
    if (!estJetonValide(jeton)) {
        return etat("Ce lien est incomplet. Vérifiez que vous l'avez copié en entier.");
    }

    let partage;
    try {
        partage = await getDocumentById(COLLECTIONS.PARTAGES, jeton);
    } catch (e) {
        // permission-denied : lien expiré (les règles refusent la lecture)
        if (e?.code !== "permission-denied") throw e;
    }
    if (!partage) {
        return etat("Ce lien n'est plus valide : il a été révoqué ou il a expiré. Demandez un nouveau lien à la personne qui vous l'a envoyé.");
    }

    const snap = await getDocs(collection(db, COLLECTIONS.PARTAGES, jeton, COLLECTIONS.PARTAGES_JEUX));
    state.jeux = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    state.filtre = filtreDepuisParams(new URL(location.href).searchParams);
    delete state.filtre.proprio;

    document.title = `${partage.titre} – Tapis Vert`;
    $("#titre").textContent = partage.titre || "Ludothèque";
    if (partage.majLe?.toDate) {
        $("#majLe").textContent = `le ${partage.majLe.toDate().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`;
    }

    $("#etat").hidden = true;
    $("#contenu").hidden = false;
    afficher();

    $("#filtres").addEventListener("change", () => {
        state.filtre = lireFiltres($("#filtres"));
        const url = new URL(location.href);
        url.search = filtreVersParams(state.filtre).toString(); // le #jeton est conservé
        history.replaceState(history.state, "", url);
        afficher();
    });
    $("#surpriseBtn").addEventListener("click", () => tirerAuSort($("#dlgSurprise"), state.jeuxAffiches));
}

init().catch((e) => {
    console.error(e);
    etat("Impossible de charger la ludothèque. Vérifiez votre connexion puis rechargez la page.");
});
