// Menu « Comptes » : réservé à l'administrateur (ADMIN dans records.js).
// Chargé à la demande par dashboard.js, uniquement quand l'administrateur est connecté.
// Ce module n'est qu'une interface : ce sont les règles Firestore (estAdmin) qui
// empêchent réellement quiconque d'autre d'écrire dans « utilisateurs ».
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
    initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-app.js";
import { db, doc, writeBatch, getAllDocuments } from "./firebase-db.js";
import { COLLECTIONS, ADMIN } from "./records.js";
import {
    nomCourt, normaliserEmail, emailValide, foyerDe, planLier, planDelier, planSuppression, accesNettoyes
} from "./logic.js";
import { $, el, icone, ouvrirDialog, demander, notifier } from "./ui.js";

const etat = {
    users: [],
    modifie: false,    // au moins une écriture : on proposera de recharger la page
    edite: null,       // email du compte ouvert dans la fenêtre « Modifier »
    recherche: ""
};

/* ---------- Données ---------- */

const trouver = (email) => etat.users.find(u => u.id === email);
const nomDe = (email) => {
    const u = trouver(email);
    return u ? (nomCourt(u) || email) : email;
};
const nomComplet = (u) => [u.prenom, u.nom].filter(Boolean).join(" ") || u.id;
const listeNoms = (emails) => emails.map(nomDe).join(", ");

async function charger() {
    const users = await getAllDocuments(COLLECTIONS.UTILISATEURS);
    etat.users = users.sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), "fr", { sensitivity: "base" }));
}

function verifierReseau() {
    if (navigator.onLine === false) {
        notifier("La gestion des comptes nécessite une connexion internet.", "erreur");
        return false;
    }
    return true;
}

/**
 * Applique un plan { email: champs } (+ créations / suppressions) en une seule écriture
 * atomique : soit tout passe, soit rien (jamais de liens à moitié réciproques).
 */
async function appliquer(plan, { creer = {}, supprimer = [] } = {}) {
    const lot = writeBatch(db);
    for (const [email, champs] of Object.entries(creer)) lot.set(doc(db, COLLECTIONS.UTILISATEURS, email), champs);
    for (const [email, champs] of Object.entries(plan)) lot.update(doc(db, COLLECTIONS.UTILISATEURS, email), champs);
    for (const email of supprimer) lot.delete(doc(db, COLLECTIONS.UTILISATEURS, email));
    await lot.commit();
    etat.modifie = true;
    await charger();
}

function erreurAdmin(e) {
    console.error(e);
    const message = e?.code === "permission-denied"
        ? "Firebase refuse la modification : vérifiez que les règles de firestore.rules ont bien été publiées."
        : "La modification a échoué. Vérifiez votre connexion puis réessayez.";
    notifier(message, "erreur");
}

/* ---------- Création du mot de passe (Firebase Authentication) ---------- */

// Créer un compte avec l'auth principale connecterait le nouveau compte à la place de
// l'administrateur. On passe donc par une seconde instance Firebase, en mémoire seulement.
let authSecondaire = null;
function getAuthSecondaire() {
    if (!authSecondaire) {
        const app = getApps().find(a => a.name === "tv-admin") || initializeApp(firebaseConfig, "tv-admin");
        authSecondaire = initializeAuth(app, { persistence: inMemoryPersistence });
        authSecondaire.languageCode = "fr";
    }
    return authSecondaire;
}

function motDePasseAleatoire() {
    const octets = crypto.getRandomValues(new Uint8Array(24));
    return btoa(String.fromCharCode(...octets)) + "aA1!";
}

/** @returns message à afficher à l'administrateur */
async function creerAccesMotDePasse(email) {
    const auth = getAuthSecondaire();
    try {
        await createUserWithEmailAndPassword(auth, email, motDePasseAleatoire());
    } catch (e) {
        if (e?.code === "auth/email-already-in-use") {
            await sendPasswordResetEmail(auth, email).catch(() => {});
            return "Un accès existait déjà pour cette adresse : un email pour (re)définir son mot de passe lui a été envoyé.";
        }
        if (e?.code === "auth/operation-not-allowed" || e?.code === "auth/admin-restricted-operation") {
            return "Compte ajouté, mais Firebase n'autorise pas la création de mots de passe depuis le site "
                + "(Authentication > Paramètres > Actions des utilisateurs). Créez l'accès depuis la console Firebase.";
        }
        throw e;
    } finally {
        await signOut(auth).catch(() => {});
    }
    await sendPasswordResetEmail(auth, email);
    return "Compte ajouté. Un email lui a été envoyé pour choisir son mot de passe.";
}

/* ---------- Fenêtre principale ---------- */

function resumeCompte(u) {
    const foyer = foyerDe(u.id, etat.users).filter(e => e !== u.id);
    const acces = Array.isArray(u.acces) ? u.acces : [];
    return el("div", { class: "compte-resume" },
        el("span", {}, foyer.length ? `Ludothèque commune avec ${listeNoms(foyer)}` : "Ludothèque personnelle"),
        el("span", {}, acces.includes("*")
            ? "Voit tous les jeux"
            : acces.length ? `Voit aussi les jeux de ${listeNoms(acces)}` : "Ne voit que sa ludothèque"));
}

function afficherListe() {
    const liste = $("#listeComptes");
    const filtre = normaliserEmail(etat.recherche);
    const visibles = etat.users.filter(u => !filtre
        || u.id.includes(filtre) || nomComplet(u).toLowerCase().includes(filtre));
    $("#comptesCompteur").textContent = `(${etat.users.length})`;
    if (!visibles.length) {
        liste.replaceChildren(el("li", { class: "vide" }, filtre ? "Aucun compte ne correspond à cette recherche." : "Aucun compte pour l'instant."));
        return;
    }
    liste.replaceChildren(...visibles.map(u => el("li", { class: "compte" },
        el("div", { class: "compte-entete" },
            el("strong", {}, nomComplet(u)),
            el("span", { class: "compte-email" }, u.id),
            u.id === ADMIN ? el("span", { class: "compte-badge" }, "Administrateur") : null),
        resumeCompte(u),
        el("div", { class: "compte-actions" },
            el("button", { type: "button", class: "btn", onclick: () => ouvrirCompte(u.id) }, icone("pencil"), " Modifier"),
            u.id === ADMIN ? null
                : el("button", { type: "button", class: "btn btn-danger-texte", onclick: () => supprimerCompte(u.id) }, icone("trash"), " Supprimer"))
    )));
}

async function ajouterCompte(e) {
    e.preventDefault();
    const email = normaliserEmail($("#compteEmail").value);
    const prenom = $("#comptePrenom").value.trim();
    const nom = $("#compteNom").value.trim();
    if (!emailValide(email)) return notifier("Adresse email invalide.", "erreur");
    if (!prenom) return notifier("Le prénom est obligatoire.", "erreur");
    if (trouver(email)) return notifier("Ce compte existe déjà.", "erreur");
    if (!verifierReseau()) return;

    const bouton = $("#ajouterCompteBtn");
    bouton.disabled = true;
    try {
        await appliquer({}, { creer: { [email]: { prenom, nom, liens: [], acces: [] } } });
        let message = "Compte ajouté. Il peut se connecter avec Google.";
        if ($("#compteMotDePasse").checked) {
            try {
                message = await creerAccesMotDePasse(email);
            } catch (err) {
                console.error(err);
                message = "Compte ajouté, mais l'accès par mot de passe n'a pas pu être créé. Il peut utiliser « Mot de passe oublié » sur la page de connexion.";
            }
        }
        notifier(message);
        $("#formCompte").reset();
        afficherListe();
        ouvrirCompte(email); // pour l'associer tout de suite
    } catch (err) {
        erreurAdmin(err);
    } finally {
        bouton.disabled = false;
    }
}

async function supprimerCompte(email) {
    const u = trouver(email);
    if (!u || email === ADMIN) return;
    const dlg = $("#dlgSupprimerCompte");
    dlg.querySelector(".nom-compte").textContent = nomComplet(u);
    if (await demander(dlg) !== "oui") return;
    if (!verifierReseau()) return;
    try {
        await appliquer(planSuppression(email, etat.users), { supprimer: [email] });
        notifier(`Compte de ${nomComplet(u)} supprimé.`);
        afficherListe();
    } catch (e) {
        erreurAdmin(e);
    }
}

/* ---------- Fenêtre « Modifier un compte » ---------- */

/** Foyers des autres comptes (une case par ludothèque, pas par personne). */
function autresFoyers(email) {
    const monFoyer = foyerDe(email, etat.users);
    const vus = new Set();
    const foyers = [];
    for (const u of etat.users) {
        if (monFoyer.includes(u.id)) continue;
        const membres = foyerDe(u.id, etat.users).filter(e => trouver(e));
        const cle = membres.join(",");
        if (vus.has(cle)) continue;
        vus.add(cle);
        foyers.push(membres);
    }
    return foyers.sort((a, b) => listeNoms(a).localeCompare(listeNoms(b), "fr", { sensitivity: "base" }));
}

function afficherCompte() {
    const u = trouver(etat.edite);
    if (!u) return $("#dlgCompte").close();
    const acces = Array.isArray(u.acces) ? u.acces : [];
    $("#dlgCompteTitre").textContent = nomComplet(u);
    $("#dlgCompteEmail").textContent = u.id;

    // Ludothèque commune
    const foyer = foyerDe(u.id, etat.users).filter(e => e !== u.id);
    $("#foyerActuel").replaceChildren(foyer.length
        ? el("p", {}, `Partage sa ludothèque avec ${listeNoms(foyer)}. Chacun peut ajouter, modifier et prêter les jeux des autres.`)
        : el("p", { class: "aide-discrete" }, "Ludothèque personnelle : personne d'autre ne gère ses jeux."));
    $("#quitterFoyerBtn").hidden = !foyer.length;

    const select = $("#lierAvec");
    select.replaceChildren(el("option", { value: "" }, "-- Choisir une personne --"),
        ...etat.users.filter(x => x.id !== u.id && !foyer.includes(x.id))
            .map(x => el("option", { value: x.id }, nomComplet(x))));

    // Visibilité
    $("#voitTout").checked = acces.includes("*");
    const foyers = autresFoyers(u.id);
    $("#listeAcces").replaceChildren(...(foyers.length ? foyers.map((membres, i) => {
        const id = `acces-${i}`;
        return el("li", { class: "checkbox-group" },
            el("input", { type: "checkbox", id, value: membres.join(","), checked: membres.some(e => acces.includes(e)) }),
            el("label", { for: id }, listeNoms(membres)));
    }) : [el("li", { class: "vide" }, "Aucune autre ludothèque.")]));
    majVoitTout();
}

function majVoitTout() {
    const tout = $("#voitTout").checked;
    $("#listeAcces").querySelectorAll("input").forEach(c => { c.disabled = tout; });
    $("#listeAcces").classList.toggle("desactive", tout);
}

function ouvrirCompte(email) {
    etat.edite = email;
    // Prénom / nom remplis à l'ouverture seulement : associer quelqu'un ensuite
    // n'efface pas ce qui vient d'être tapé.
    const u = trouver(email);
    $("#editPrenom").value = u?.prenom || "";
    $("#editNom").value = u?.nom || "";
    afficherCompte();
    ouvrirDialog($("#dlgCompte"));
}

async function lier() {
    const autre = $("#lierAvec").value;
    if (!autre || !verifierReseau()) return;
    const plan = planLier(etat.edite, autre, etat.users);
    try {
        if (Object.keys(plan).length) await appliquer(plan);
        notifier(`${nomDe(etat.edite)} et ${nomDe(autre)} partagent maintenant la même ludothèque.`);
        afficherCompte();
        afficherListe();
    } catch (e) {
        erreurAdmin(e);
    }
}

async function quitterFoyer() {
    if (!verifierReseau()) return;
    try {
        await appliquer(planDelier(etat.edite, etat.users));
        notifier(`${nomDe(etat.edite)} a de nouveau sa propre ludothèque.`);
        afficherCompte();
        afficherListe();
    } catch (e) {
        erreurAdmin(e);
    }
}

async function enregistrerCompte(e) {
    e.preventDefault();
    const u = trouver(etat.edite);
    if (!u) return;
    const prenom = $("#editPrenom").value.trim();
    const nom = $("#editNom").value.trim();
    if (!prenom) return notifier("Le prénom est obligatoire.", "erreur");
    if (!verifierReseau()) return;

    // Une case cochée = une ludothèque. On garde le membre déjà présent dans « acces »
    // s'il y en a un, sinon le premier : les règles étendent l'accès à tout son foyer.
    const ancien = Array.isArray(u.acces) ? u.acces : [];
    const coches = [...$("#listeAcces").querySelectorAll("input:checked")].map(c => {
        const membres = c.value.split(",");
        return membres.find(m => ancien.includes(m)) || membres[0];
    });
    const acces = accesNettoyes(u.id, coches, $("#voitTout").checked, etat.users);

    const bouton = $("#enregistrerCompteBtn");
    bouton.disabled = true;
    try {
        await appliquer({ [u.id]: { prenom, nom, acces } });
        notifier("Compte enregistré.");
        $("#dlgCompte").close();
        afficherListe();
    } catch (err) {
        erreurAdmin(err);
    } finally {
        bouton.disabled = false;
    }
}

/* ---------- Branchement ---------- */

let branche = false;
function brancher() {
    if (branche) return;
    branche = true;
    $("#formCompte").addEventListener("submit", ajouterCompte);
    $("#rechercheComptes").addEventListener("input", (e) => { etat.recherche = e.target.value; afficherListe(); });
    $("#dlgAdmin [data-fermer]").addEventListener("click", () => $("#dlgAdmin").close());
    $("#dlgAdmin").addEventListener("close", () => {
        if (!etat.modifie) return;
        etat.modifie = false;
        notifier("Comptes mis à jour. Rechargez la page pour voir l'effet sur votre propre ludothèque.");
    });

    $("#formEditCompte").addEventListener("submit", enregistrerCompte);
    $("#dlgCompte [data-fermer]").addEventListener("click", () => $("#dlgCompte").close());
    $("#annulerCompteBtn").addEventListener("click", () => $("#dlgCompte").close());
    $("#lierBtn").addEventListener("click", lier);
    $("#quitterFoyerBtn").addEventListener("click", quitterFoyer);
    $("#voitTout").addEventListener("change", majVoitTout);
}

/** Ouvre le menu « Comptes » (appelé par dashboard.js). */
export async function ouvrirAdmin() {
    brancher();
    ouvrirDialog($("#dlgAdmin"));
    $("#listeComptes").replaceChildren(el("li", { class: "vide" }, "Chargement des comptes…"));
    try {
        await charger();
        afficherListe();
    } catch (e) {
        erreurAdmin(e);
    }
}
