import Quill from "https://esm.sh/quill@1.3.7";
import { getAllDocuments, getDocumentsWithWhere, setDocument, deleteDocument } from "./firebase-db.js";
import { requireUser, logout } from "./firebase-auth.js";
import { Jeux, COLLECTIONS, DIFFICULTE, STYLES } from "./records.js";
import {
    construireGroupes, filtreDepuisParams, filtreVersParams, jeuCorrespond,
    trierParNom, estExpire, titreParDefaut, slug
} from "./logic.js";
import {
    $, el, ouvrirDialog, demander, notifier, afficherGrille, afficherFiche, tirerAuSort,
    remplirFiltres, lireFiltres, compteur, nettoyerHtml
} from "./ui.js";
import {
    listerPartages, creerPartage, synchroniserTousLesPartages, revoquerPartage, lienDuPartage
} from "./partages.js";
import { initSaisieAuto } from "./saisie-auto.js";
import { qrSvg, qrPng } from "./qrcode.js";
import { app } from "./firebase-app.js";

/* ---------- État ---------- */

const state = {
    moi: "",
    famille: { libelle: "", emails: [] },
    groupes: [],
    jeux: [],
    filtre: {},
    jeuxAffiches: [],
    partages: [],
    partagesEtat: null
};

let quill = null;

const estAMoi = (jeu) => state.famille.emails.includes(jeu.proprio);
const proprios = () => [state.famille, ...state.groupes];

/* ---------- Chargement ---------- */

async function chargerJeux(emails) {
    // Requêtes « in » par paquets de 30 (limite Firestore) au lieu d'une requête par email.
    const paquets = [];
    for (let i = 0; i < emails.length; i += 30) paquets.push(emails.slice(i, i + 30));
    const resultats = await Promise.all(paquets.map(p =>
        getDocumentsWithWhere(COLLECTIONS.JEUX, [{ field: "proprio", operator: "in", value: p }])
    ));
    return resultats.flat().map(Jeux.fromDoc);
}

async function init() {
    const user = await requireUser();
    state.moi = user.email;

    const users = await getAllDocuments(COLLECTIONS.UTILISATEURS);
    const { famille, groupes } = construireGroupes(state.moi, users);
    state.famille = famille;
    state.groupes = groupes;

    const emails = [...new Set(proprios().flatMap(p => p.emails))];
    state.jeux = await chargerJeux(emails);
    state.filtre = filtreDepuisParams(new URL(location.href).searchParams, famille.emails.join(","));

    initFormulaireJeu();
    brancherEvenements();
    afficher();

    // Les partages sont mis à jour en arrière-plan : on récupère aussi les changements
    // faits par les autres membres de la famille depuis la dernière visite.
    // Lecture test silencieuse : en cas de problème, le diagnostic s'affiche dans la fenêtre des liens.
    chargerPartages().then(ok => ok && synchroniserPartages()).catch(console.error);
}

/* ---------- Affichage ---------- */

function afficher() {
    const { filtre } = state;
    const duProprio = state.jeux.filter(j => jeuCorrespond(j, { proprio: filtre.proprio }));
    const possedes = duProprio.filter(j => !j.wishlist);
    const souhaites = trierParNom(duProprio.filter(j => j.wishlist));

    remplirFiltres($("#filtres"), { jeux: possedes, filtre, proprios: proprios() });

    state.jeuxAffiches = trierParNom(possedes.filter(j => jeuCorrespond(j, filtre)));
    $("#resultsCount").textContent = compteur(state.jeuxAffiches.length);

    afficherGrille($("#grid"), state.jeuxAffiches, (jeu) => ({
        onOuvrir: (j) => afficherFiche($("#dlgFiche"), j),
        actions: estAMoi(jeu) ? [
            { icone: "trash", titre: "Supprimer", onClick: () => supprimer(jeu) },
            { icone: "pencil", titre: "Modifier", onClick: () => editer(jeu) },
            jeu.estPrete
                ? { icone: "rotate-left", titre: `Retour de prêt (${jeu.estPrete})`, onClick: () => retourPret(jeu) }
                : { icone: "paper-plane", titre: "Prêter", onClick: () => preter(jeu) }
        ] : []
    }));

    $("#wishlistCount").textContent = `(${souhaites.length})`;
    afficherGrille($("#wishlistGrid"), souhaites, (jeu) => ({
        onOuvrir: (j) => afficherFiche($("#dlgFiche"), j),
        actions: estAMoi(jeu) ? [
            { icone: "trash", titre: "Supprimer", onClick: () => supprimer(jeu) },
            { icone: "pencil", titre: "Modifier", onClick: () => editer(jeu) },
            { icone: "euro-sign", titre: "Marquer comme acheté", onClick: () => acheter(jeu) }
        ] : []
    }));
}

function appliquerFiltres() {
    state.filtre = lireFiltres($("#filtres"));
    const url = new URL(location.href);
    url.search = filtreVersParams(state.filtre).toString();
    // Plus de rechargement complet de la page à chaque changement de filtre.
    history.replaceState(history.state, "", url);
    afficher();
}

/* ---------- Mises à jour locales + synchro des partages ---------- */

function majLocale(jeu) {
    const i = state.jeux.findIndex(j => j.id === jeu.id);
    if (i >= 0) state.jeux[i] = jeu; else state.jeux.push(jeu);
    afficher();
    planifierSynchro();
}

function suppressionLocale(id) {
    state.jeux = state.jeux.filter(j => j.id !== id);
    afficher();
    planifierSynchro();
}

let minuterieSynchro = null;
function planifierSynchro() {
    clearTimeout(minuterieSynchro);
    minuterieSynchro = setTimeout(synchroniserPartages, 1500);
}

async function synchroniserPartages() {
    if (!state.partages.length) return;
    const erreurs = await synchroniserTousLesPartages(state.partages, state.jeux);
    if (erreurs.length) {
        console.error(erreurs);
        notifier("Certains liens de visualisation n'ont pas pu être mis à jour. Ils le seront à la prochaine visite.", "erreur");
    }
}

function erreur(e) {
    console.error(e);
    const message = e?.code === "permission-denied"
        ? "Action refusée : vous n'avez pas les droits nécessaires."
        : "L'opération a échoué. Vérifiez votre connexion puis réessayez.";
    notifier(message, "erreur");
}

/* ---------- Actions sur les jeux ---------- */

function preparer(dlgId, jeu) {
    const dlg = $(dlgId);
    dlg.querySelectorAll(".nom-jeu").forEach(n => { n.textContent = jeu.nom; });
    return dlg;
}

async function supprimer(jeu) {
    if (await demander(preparer("#dlgSuppression", jeu)) !== "oui") return;
    try {
        await deleteDocument(COLLECTIONS.JEUX, jeu.id);
        suppressionLocale(jeu.id);
        notifier(`« ${jeu.nom} » supprimé.`);
    } catch (e) { erreur(e); }
}

async function preter(jeu) {
    const dlg = preparer("#dlgPret", jeu);
    const champ = $("#emprunteur");
    champ.value = "";
    if (await demander(dlg, { focus: champ }) !== "oui") return;
    const qui = champ.value.trim();
    if (!qui) return notifier("Indique le nom de l'emprunteur pour prêter le jeu.", "erreur");
    await enregistrer(new Jeux({ ...jeu, estPrete: qui }), `« ${jeu.nom} » prêté à ${qui}.`);
}

async function retourPret(jeu) {
    const dlg = preparer("#dlgRetour", jeu);
    $(".emprunteur-actuel", dlg).textContent = `Prêté à ${jeu.estPrete}.`;
    if (await demander(dlg) !== "oui") return;
    await enregistrer(new Jeux({ ...jeu, estPrete: undefined }), `« ${jeu.nom} » est de retour.`);
}

async function acheter(jeu) {
    const dlg = preparer("#dlgAchat", jeu);
    const date = $("#dateAchatWishlist");
    date.value = new Date().toISOString().slice(0, 10);
    if (await demander(dlg, { focus: date }) !== "oui") return;
    await enregistrer(new Jeux({ ...jeu, wishlist: false, dateAchat: date.value }), `« ${jeu.nom} » ajouté à la ludothèque.`);
}

async function enregistrer(jeu, message) {
    try {
        const id = await setDocument(COLLECTIONS.JEUX, jeu.id, jeu.toDoc());
        jeu.id = id;
        majLocale(jeu);
        if (message) notifier(message);
        return true;
    } catch (e) {
        erreur(e);
        return false;
    }
}

/* ---------- Formulaire de création / édition ---------- */

let jeuEnEdition = null;
let saisieAuto = null;

function initFormulaireJeu() {
    const difficulte = $("#difficulte");
    Object.entries(DIFFICULTE).forEach(([k, v]) => difficulte.append(el("option", { value: k }, v)));
    const style = $("#style");
    Object.entries(STYLES).forEach(([k, v]) => style.append(el("option", { value: k }, v)));

    $("#jeuForm").addEventListener("submit", (e) => { e.preventDefault(); sauvegarderFormulaire(); });
    $("#cancelBtn").addEventListener("click", () => $("#dlgJeu").close());
    $("#dlgJeu").addEventListener("close", reinitialiserFormulaire);
    $("#image").addEventListener("input", majApercuImage);
    $("#style").addEventListener("change", majStylesChoisis);
    $("#imageApercu").addEventListener("error", () => { $("#imageApercu").hidden = true; });
    // Un champ modifié à la main n'est plus signalé comme « rempli automatiquement »
    $("#jeuForm").addEventListener("input", (e) => e.target.classList?.remove("auto-rempli"));

    saisieAuto = initSaisieAuto({
        input: $("#titre"),
        liste: $("#suggestions"),
        info: $("#autoInfo"),
        capturer: capturerFormulaire,
        restaurer: restaurerFormulaire,
        appliquer: appliquerFiche
    });
}

function majStylesChoisis() {
    const choisis = [...$("#style").selectedOptions].map(o => o.text);
    $("#stylesChoisis").textContent = choisis.length ? `Sélectionnés : ${choisis.join(", ")}` : "";
}

function majApercuImage() {
    const apercu = $("#imageApercu");
    const url = $("#image").value.trim();
    apercu.hidden = !/^https?:\/\//i.test(url);
    if (!apercu.hidden && apercu.getAttribute("src") !== url) apercu.src = url;
}

/* ---------- Remplissage automatique ---------- */

const CHAMPS_AUTO = ["#image", "#joueurs_min", "#joueurs_max", "#duree_min", "#duree_max", "#age_min"];

function capturerFormulaire() {
    return {
        valeurs: Object.fromEntries(CHAMPS_AUTO.map(id => [id, $(id).value])),
        extension: $("#extension").checked,
        styles: [...$("#style").selectedOptions].map(o => o.value),
        description: getQuill().root.innerHTML
    };
}

function restaurerFormulaire(etat) {
    Object.entries(etat.valeurs).forEach(([id, v]) => { $(id).value = v; });
    $("#extension").checked = etat.extension;
    [...$("#style").options].forEach(o => { o.selected = etat.styles.includes(o.value); });
    getQuill().clipboard.dangerouslyPasteHTML(etat.description);
    document.querySelectorAll("#jeuForm .auto-rempli").forEach(n => n.classList.remove("auto-rempli"));
    majApercuImage();
    majStylesChoisis();
}

/** Remplit uniquement les champs vides ; renvoie ce qui a été rempli ou laissé tel quel. */
function appliquerFiche(fiche) {
    const remplis = [];
    const ignores = [];
    const marquer = (...ids) => ids.forEach(id => $(id).classList.add("auto-rempli"));
    const vide = (...ids) => ids.every(id => !$(id).value.trim());
    const tenter = (libelle, disponible, estVide, remplir) => {
        if (!disponible) return;
        if (!estVide) { ignores.push(libelle); return; }
        remplir();
        remplis.push(libelle);
    };

    tenter("joueurs", fiche.joueurs.length, vide("#joueurs_min", "#joueurs_max"), () => {
        $("#joueurs_min").value = fiche.joueurs[0];
        $("#joueurs_max").value = fiche.joueurs[1] ?? "";
        marquer("#joueurs_min", "#joueurs_max");
    });
    tenter("durée", fiche.duree.length, vide("#duree_min", "#duree_max"), () => {
        $("#duree_min").value = fiche.duree[0];
        $("#duree_max").value = fiche.duree[1] ?? "";
        marquer("#duree_min", "#duree_max");
    });
    tenter("âge minimal", fiche.ageMinimal > 0, vide("#age_min"), () => {
        $("#age_min").value = fiche.ageMinimal;
        marquer("#age_min");
    });
    tenter("image", fiche.image, vide("#image"), () => {
        $("#image").value = fiche.image;
        marquer("#image");
        majApercuImage();
    });
    const stylesSelect = $("#style");
    tenter(`styles (${fiche.styles.length})`, fiche.styles.length, stylesSelect.selectedOptions.length === 0, () => {
        [...stylesSelect.options].forEach(o => { o.selected = fiche.styles.includes(o.value); });
        marquer("#style");
        majStylesChoisis();
    });
    if (fiche.estExtension && !$("#extension").checked) {
        $("#extension").checked = true;
        remplis.push("extension");
    }
    const q = getQuill();
    tenter("description", fiche.description, !q.getText().trim(), () => {
        q.clipboard.dangerouslyPasteHTML(nettoyerHtml(fiche.description));
        $("#editor").classList.add("auto-rempli");
    });
    return { remplis, ignores };
}

function getQuill() {
    if (!quill) {
        quill = new Quill("#editor", {
            theme: "snow",
            modules: { toolbar: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"]] }
        });
    }
    return quill;
}

function editer(jeu) {
    jeuEnEdition = jeu || null;
    const v = (id, val) => { $(id).value = val ?? ""; };
    $("#dlgJeuTitre").textContent = jeu ? `Modifier « ${jeu.nom} »` : "Ajouter un jeu";
    const q = getQuill();
    if (jeu) {
        v("#titre", jeu.nom);
        v("#image", jeu.image);
        v("#joueurs_min", jeu.joueurs[0]);
        v("#joueurs_max", jeu.joueurs[1]);
        v("#duree_min", jeu.duree[0]);
        v("#duree_max", jeu.duree[1]);
        v("#difficulte", jeu.difficulte);
        v("#age_min", jeu.ageMinimal || "");
        v("#date_achat", jeu.dateAchat);
        v("#video", jeu.video);
        v("#emplacement", jeu.emplacement);
        v("#note", jeu.note > 0 ? jeu.note : -1);
        $("#extension").checked = jeu.estExtension;
        $("#wishlistInput").checked = jeu.wishlist;
        [...$("#style").options].forEach(o => { o.selected = jeu.styles.includes(o.value); });
        q.clipboard.dangerouslyPasteHTML(nettoyerHtml(jeu.description));
        majApercuImage();
    }
    majStylesChoisis();
    ouvrirDialog($("#dlgJeu"));
    $("#titre").focus();
}

function reinitialiserFormulaire() {
    jeuEnEdition = null;
    $("#jeuForm").reset();
    quill?.setContents([{ insert: "\n" }]);
    document.querySelectorAll("#jeuForm .error-message").forEach(n => { n.style.display = "none"; });
    document.querySelectorAll("#jeuForm .auto-rempli").forEach(n => n.classList.remove("auto-rempli"));
    $("#imageApercu").hidden = true;
    saisieAuto?.reinitialiser();
    $("#dlgJeu .modal-body").scrollTop = 0;
}

const entier = (id) => {
    const n = parseInt($(id).value, 10);
    return Number.isFinite(n) ? n : undefined;
};

async function sauvegarderFormulaire() {
    const titre = $("#titre").value.trim();
    const joueursMin = entier("#joueurs_min");
    $("#titreError").style.display = titre ? "none" : "block";
    $("#joueursMinError").style.display = joueursMin ? "none" : "block";
    if (!titre) return $("#titre").focus();
    if (!joueursMin) return $("#joueurs_min").focus();

    const joueursMax = entier("#joueurs_max");
    const dureeMin = entier("#duree_min");
    const dureeMax = entier("#duree_max");
    const html = quill.root.innerHTML;

    const jeu = new Jeux({
        // En édition, on conserve le propriétaire et l'état de prêt (l'ancienne version
        // réattribuait le jeu à l'utilisateur courant et effaçait le prêt).
        ...(jeuEnEdition || {}),
        proprio: jeuEnEdition?.proprio || state.moi,
        nom: titre,
        image: $("#image").value.trim(),
        joueurs: joueursMax && joueursMax !== joueursMin ? [joueursMin, Math.max(joueursMin, joueursMax)] : [joueursMin],
        duree: [dureeMin, dureeMax].filter(d => d !== undefined).sort((a, b) => a - b),
        difficulte: $("#difficulte").value,
        styles: [...$("#style").selectedOptions].map(o => o.value).filter(Boolean),
        estExtension: $("#extension").checked,
        description: quill.getText().trim() ? nettoyerHtml(html) : "",
        video: $("#video").value.trim(),
        emplacement: $("#emplacement").value.trim(),
        ageMinimal: entier("#age_min") || 0,
        dateAchat: $("#date_achat").value,
        wishlist: $("#wishlistInput").checked,
        note: parseInt($("#note").value, 10)
    });

    const bouton = $("#saveBtn");
    bouton.disabled = true;
    const ok = await enregistrer(jeu, jeuEnEdition ? "Modifications enregistrées." : `« ${titre} » ajouté.`);
    bouton.disabled = false;
    if (ok) $("#dlgJeu").close();
}

/* ---------- Liens de visualisation ---------- */

// État de la fonctionnalité, déterminé par une lecture test au chargement :
//   "ok"               tout fonctionne
//   "regles-absentes"  Firestore refuse même la lecture : firestore.rules n'a pas été publié
//   "regles-anciennes" la lecture passe mais la création est refusée : règles publiées obsolètes
//   "reseau"           Firestore injoignable
let qrAOuvrir = null;

async function chargerPartages() {
    try {
        state.partages = await listerPartages(state.moi);
        if (state.partagesEtat !== "regles-anciennes") state.partagesEtat = "ok";
    } catch (e) {
        console.warn("Liens de visualisation indisponibles :", e);
        state.partages = [];
        state.partagesEtat = e?.code === "permission-denied" ? "regles-absentes" : "reseau";
    }
    afficherPartages();
    return state.partagesEtat === "ok";
}

const urlConsoleRegles = () => {
    const projet = app?.options?.projectId;
    return projet
        ? `https://console.firebase.google.com/project/${encodeURIComponent(projet)}/firestore/rules`
        : "https://console.firebase.google.com/";
};

function afficherDiagnostic() {
    const zone = $("#partagesDiagnostic");
    const etat = state.partagesEtat;
    const bloque = etat === "regles-absentes" || etat === "reseau";
    $("#formPartage").querySelectorAll("input, select, button").forEach(n => { n.disabled = bloque; });

    if (!etat || etat === "ok") {
        zone.hidden = true;
        zone.replaceChildren();
        return;
    }
    const etapes = el("ol", {},
        el("li", {}, "Ouvrez ", el("a", { href: urlConsoleRegles(), target: "_blank", rel: "noopener" }, "les règles Firestore de votre projet"), " dans la console Firebase."),
        el("li", {}, "Remplacez tout le contenu par celui du fichier firestore.rules du projet."),
        el("li", {}, "Cliquez sur « Publier », attendez une minute, puis sur « Revérifier » ci-dessous.")
    );
    const reverifier = el("button", { type: "button", class: "btn" }, "Revérifier");
    reverifier.addEventListener("click", async () => {
        reverifier.disabled = true;
        state.partagesEtat = null;
        const ok = await chargerPartages();
        if (ok) notifier("Les liens de visualisation sont opérationnels.");
    });

    const contenus = {
        "regles-absentes": [
            el("strong", {}, "Les liens de visualisation ne sont pas encore activés."),
            el("p", {}, "Firestore refuse l'accès aux liens : les règles de sécurité du projet n'ont pas été mises à jour. Le fichier firestore.rules du dépôt GitHub n'est pas appliqué automatiquement, il faut le publier une fois dans Firebase."),
            etapes, reverifier
        ],
        "regles-anciennes": [
            el("strong", {}, "Firestore a refusé la création du lien."),
            el("p", {}, "Les règles publiées dans Firebase ne correspondent pas à la version actuelle du fichier firestore.rules. Republiez-les :"),
            etapes, reverifier
        ],
        reseau: [
            el("strong", {}, "Impossible de joindre Firestore."),
            el("p", {}, "Vérifiez votre connexion internet puis réessayez."),
            reverifier
        ]
    };
    zone.replaceChildren(...contenus[etat]);
    zone.hidden = false;
}

const formatDate = (ms) => new Date(ms).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const icone = (nom) => el("i", { class: `fas fa-${nom}`, "aria-hidden": "true" });

function panneauQr(p, lien) {
    const panneau = el("div", { class: "qr-panneau", id: `qr-${p.jeton}`, hidden: true });
    panneau.dataset.lien = lien;
    return panneau;
}

function remplirPanneauQr(panneau, p) {
    if (panneau.childElementCount) return;
    const lien = panneau.dataset.lien;
    try {
        const telecharger = el("button", { type: "button", class: "btn btn-primaire" }, icone("download"), " Télécharger l'image");
        telecharger.addEventListener("click", () => telechargerQr(p, lien));
        panneau.append(
            el("div", { class: "qr-image" }, qrSvg(lien, { libelle: `QR code du lien pour ${p.libelle}` })),
            el("div", { class: "qr-texte" },
                el("p", {}, "À scanner avec l'appareil photo d'un téléphone. L'image téléchargée comporte le titre de la ludothèque : idéale à imprimer ou à envoyer."),
                el("p", { class: "aide-discrete" }, "Le QR code donne exactement le même accès que le lien : révoquer le lien le désactive aussi."),
                telecharger
            )
        );
    } catch (e) {
        console.error(e);
        panneau.append(el("p", {}, "Le QR code n'a pas pu être généré. Rechargez la page puis réessayez."));
    }
}

async function telechargerQr(p, lien) {
    try {
        const blob = await qrPng(lien, { titre: p.titre || "Ludothèque" });
        const url = URL.createObjectURL(blob);
        const a = el("a", { href: url, download: `qr-ludotheque-${slug(p.libelle)}.png`, hidden: true });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
        erreur(e);
    }
}

function basculerQr(bouton, panneau, p) {
    const ouvrir = panneau.hidden;
    if (ouvrir) remplirPanneauQr(panneau, p);
    panneau.hidden = !ouvrir;
    bouton.setAttribute("aria-expanded", String(ouvrir));
}

function afficherPartages() {
    afficherDiagnostic();
    const liste = $("#listePartages");
    if (!state.partages.length) {
        liste.replaceChildren(el("li", { class: "vide" },
            state.partagesEtat === "ok"
                ? "Aucun lien pour l'instant. Créez-en un ci-dessus pour partager votre ludothèque."
                : "Aucun lien disponible."));
        return;
    }
    liste.replaceChildren(...state.partages.map(p => {
        const expire = estExpire(p.expireLe);
        const lien = lienDuPartage(p.jeton);
        const details = [
            p.creeLe ? `créé le ${formatDate(p.creeLe)}` : null,
            p.expireLe ? (expire ? `expiré le ${formatDate(p.expireLe)}` : `expire le ${formatDate(p.expireLe)}`) : "sans expiration",
            p.inclureWishlist ? "wishlist incluse" : null,
            p.creePar !== state.moi ? `créé par ${p.creePar.split("@")[0]}` : null
        ].filter(Boolean).join(", ");

        const champ = el("input", { type: "text", readonly: true, value: lien, "aria-label": `Lien pour ${p.libelle}`, class: "lien" });
        champ.addEventListener("focus", () => champ.select());

        const panneau = panneauQr(p, lien);
        const boutonQr = el("button", { type: "button", class: "btn", "aria-expanded": "false", "aria-controls": panneau.id }, icone("qrcode"), " QR code");
        boutonQr.addEventListener("click", () => basculerQr(boutonQr, panneau, p));

        const partager = navigator.share
            ? el("button", { type: "button", class: "btn", title: "Envoyer le lien (SMS, messagerie…)" }, icone("share-from-square"), " Envoyer")
            : null;
        partager?.addEventListener("click", () => {
            navigator.share({ title: p.titre, text: `${p.titre} : découvre nos jeux de société`, url: lien }).catch(() => {});
        });

        const revoquer = el("button", { type: "button", class: "btn btn-danger" }, expire ? "Supprimer" : "Révoquer");
        let confirmation = null;
        revoquer.addEventListener("click", async () => {
            // Double clic de confirmation, sans empiler une seconde boîte de dialogue.
            if (!confirmation) {
                revoquer.textContent = "Confirmer ?";
                confirmation = setTimeout(() => { confirmation = null; revoquer.textContent = expire ? "Supprimer" : "Révoquer"; }, 4000);
                return;
            }
            clearTimeout(confirmation);
            revoquer.disabled = true;
            try {
                await revoquerPartage(p.jeton);
                state.partages = state.partages.filter(x => x.jeton !== p.jeton);
                afficherPartages();
                notifier(`Lien « ${p.libelle} » révoqué : il ne fonctionne plus, son QR code non plus.`);
            } catch (e) {
                revoquer.disabled = false;
                erreur(e);
            }
        });

        const item = el("li", { class: `partage${expire ? " partage-expire" : ""}` },
            el("div", { class: "partage-entete" },
                el("strong", {}, p.libelle || "Sans nom"),
                el("span", { class: "partage-details" }, details)
            ),
            expire ? null : el("div", { class: "partage-lien" }, champ),
            el("div", { class: "partage-actions" },
                expire ? null : el("button", { type: "button", class: "btn", onclick: () => copier(lien) }, icone("copy"), " Copier"),
                expire ? null : el("a", { class: "btn", href: lien, target: "_blank", rel: "noopener" }, icone("eye"), " Voir"),
                expire ? null : boutonQr,
                expire ? null : partager,
                revoquer
            ),
            expire ? null : panneau
        );
        if (qrAOuvrir === p.jeton && !expire) basculerQr(boutonQr, panneau, p);
        return item;
    }));
    qrAOuvrir = null;
}

async function copier(texte) {
    try {
        await navigator.clipboard.writeText(texte);
        notifier("Lien copié.");
    } catch {
        notifier("Copie impossible : sélectionnez le lien et copiez-le manuellement.", "erreur");
    }
}

function messageErreurCreation(e) {
    if (e?.code !== "permission-denied") {
        return "La création du lien a échoué. Vérifiez votre connexion puis réessayez.";
    }
    state.partagesEtat = "regles-anciennes";
    afficherDiagnostic();
    const etapes = { prive: "enregistrement du lien", public: "publication du lien", copie: "copie des jeux" };
    return `Création refusée par Firestore (étape : ${etapes[e.etape] || "inconnue"}). Suivez les indications dans la fenêtre.`;
}

async function soumettrePartage(e) {
    e.preventDefault();
    const libelle = $("#partageLibelle").value.trim();
    if (!libelle) {
        $("#partageLibelle").focus();
        return notifier("Indiquez pour qui est ce lien.", "erreur");
    }
    const bouton = $("#creerPartageBtn");
    bouton.disabled = true;
    bouton.textContent = "Création…";
    try {
        const partage = await creerPartage({
            monEmail: state.moi,
            proprios: state.famille.emails,
            libelle,
            titre: $("#partageTitre").value.trim() || titreParDefaut(state.famille.libelle),
            inclureWishlist: $("#partageWishlist").checked,
            expireDansJours: parseInt($("#partageExpiration").value, 10) || null
        }, state.jeux);
        partage.creeLe = Date.now();
        state.partages.unshift(partage);
        if (state.partagesEtat === "regles-anciennes") state.partagesEtat = "ok";
        $("#formPartage").reset();
        $("#partageTitre").value = titreParDefaut(state.famille.libelle);
        qrAOuvrir = partage.jeton; // le QR code du nouveau lien s'affiche directement
        afficherPartages();
        try {
            await navigator.clipboard.writeText(lienDuPartage(partage.jeton));
            notifier(`Lien « ${partage.libelle} » créé et copié.`);
        } catch {
            notifier(`Lien « ${partage.libelle} » créé.`);
        }
    } catch (err) {
        console.error(err);
        notifier(messageErreurCreation(err), "erreur");
    } finally {
        bouton.disabled = state.partagesEtat === "regles-absentes" || state.partagesEtat === "reseau";
        bouton.textContent = "Créer le lien";
    }
}

/* ---------- Événements ---------- */

function brancherEvenements() {
    $("#filtres").addEventListener("change", appliquerFiltres);
    $("#logout").addEventListener("click", logout);
    $("#editCreate").addEventListener("click", () => editer(null));
    $("#surpriseBtn").addEventListener("click", () => tirerAuSort($("#dlgSurprise"), state.jeuxAffiches));

    $("#partageTitre").value = titreParDefaut(state.famille.libelle);
    $("#partagesBtn").addEventListener("click", () => {
        ouvrirDialog($("#dlgPartages"));
        chargerPartages();
    });
    $("#dlgPartages [data-fermer]").addEventListener("click", () => $("#dlgPartages").close());
    $("#formPartage").addEventListener("submit", soumettrePartage);
}

init().catch((e) => {
    erreur(e);
    $("#resultsCount").textContent = "Impossible de charger la ludothèque. Rechargez la page.";
});
