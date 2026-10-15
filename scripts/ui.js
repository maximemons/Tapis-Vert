// Composants d'interface partagés entre le tableau de bord (édition) et la vue lecture seule.
// Règle d'or : aucune donnée utilisateur n'est injectée via innerHTML, sauf la description
// qui passe obligatoirement par DOMPurify.
import DOMPurify from "https://esm.sh/dompurify@3.1.6";
import { DIFFICULTE, STYLES } from "./records.js";
import {
    DUREES, TOUS, facettes, formatPlage, etoiles, urlHttpSure, urlIntegrationYoutube
} from "./logic.js";

/* ---------- Utilitaires DOM ---------- */

export const $ = (sel, racine = document) => racine.querySelector(sel);

/** Crée un élément : el("div", { class: "x", onclick: fn }, enfant1, "texte"...) */
export function el(tag, attrs = {}, ...enfants) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (k === "class") n.className = v;
        else if (k === "dataset") Object.assign(n.dataset, v);
        else if (v === true) n.setAttribute(k, "");
        else n.setAttribute(k, v);
    }
    for (const e of enfants.flat()) {
        if (e === undefined || e === null || e === false) continue;
        n.append(e instanceof Node ? e : document.createTextNode(String(e)));
    }
    return n;
}

const icone = (nom) => el("i", { class: `fas fa-${nom}`, "aria-hidden": "true" });

/* ---------- Nettoyage HTML (descriptions Quill) ---------- */

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer nofollow");
    }
});

export function nettoyerHtml(html) {
    return DOMPurify.sanitize(html || "", {
        ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "ol", "ul", "li", "a", "span", "h1", "h2", "h3", "blockquote"],
        ALLOWED_ATTR: ["href", "class", "target", "rel"],
        ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i
    });
}

const htmlVide = (html) => !html || !html.replace(/<[^>]*>/g, "").trim();

/* ---------- Boîtes de dialogue (<dialog> natif) ---------- */
// Corrige l'ancien système où chaque ouverture ajoutait des listeners sans les retirer
// (cliquer « Oui » pouvait supprimer plusieurs jeux d'un coup).

let dialogOuvert = null;

window.addEventListener("popstate", () => {
    // Geste « retour » sur mobile : ferme la fenêtre au lieu de quitter la page.
    if (dialogOuvert?.open) dialogOuvert.close("retour");
});

export function ouvrirDialog(dlg) {
    if (!dlg.dataset.init) {
        dlg.dataset.init = "1";
        // Clic sur le fond = fermeture
        dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close("fond"); });
        dlg.addEventListener("close", () => { if (dialogOuvert === dlg) dialogOuvert = null; });
    }
    // Une seule entrée d'historique « factice » à la fois, réutilisée si elle existe déjà.
    if (history.state?.tvDialog) history.replaceState({ tvDialog: true }, "");
    else history.pushState({ tvDialog: true }, "");
    dialogOuvert = dlg;
    dlg.returnValue = "";
    dlg.showModal();
}

/** Ouvre un <dialog> contenant un <form method="dialog"> et résout avec le bouton cliqué. */
export function demander(dlg, { focus } = {}) {
    return new Promise((resolve) => {
        dlg.addEventListener("close", () => resolve(dlg.returnValue), { once: true });
        ouvrirDialog(dlg);
        if (focus) focus.focus();
    });
}

/* ---------- Notifications ---------- */

export function notifier(message, type = "info") {
    let zone = $("#toasts");
    if (!zone) {
        // popover : la zone passe dans la « top layer », au-dessus des <dialog> ouverts.
        zone = el("div", { id: "toasts", popover: "manual", role: "status", "aria-live": "polite" });
        document.body.append(zone);
    }
    const t = el("div", { class: `toast toast-${type}` }, message);
    zone.append(t);
    if (zone.showPopover) {
        if (zone.matches(":popover-open")) zone.hidePopover(); // remonte au premier plan
        zone.showPopover();
    }
    setTimeout(() => {
        t.remove();
        if (!zone.children.length && zone.matches?.(":popover-open")) zone.hidePopover();
    }, type === "erreur" ? 6000 : 3500);
}

/* ---------- Cartes de jeu ---------- */

const estPrete = (jeu) => jeu.prete === true || Boolean(jeu.estPrete);

/**
 * @param jeu      Jeux complet (propriétaire) ou copie épurée (lecture seule)
 * @param actions  [{ icone, titre, onClick, class? }] – vide en lecture seule
 * @param onOuvrir callback d'ouverture de la fiche
 */
export function carteJeu(jeu, { actions = [], onOuvrir } = {}) {
    const image = urlHttpSure(jeu.image);
    const carte = el("article", {
        class: `card${estPrete(jeu) ? " rented" : ""}`,
        tabindex: "0",
        "aria-label": jeu.nom
    },
        image
            ? el("img", { src: image, alt: "", loading: "lazy", referrerpolicy: "no-referrer" })
            : el("div", { class: "card-placeholder", "aria-hidden": "true" }, "🎲"),
        el("h3", {}, jeu.nom, jeu.estExtension ? el("sup", { class: "extension" }, "extension") : null),
        el("div", { class: "info" }, `⏱ ${jeu.duree?.length ? `${formatPlage(jeu.duree)} min` : "–"} · 👥 ${formatPlage(jeu.joueurs)}`),
        el("div", { class: "tags" }, (jeu.styles || []).map(s => el("span", {}, STYLES[s] || s))),
        jeu.note > 0 ? el("div", { class: "notes", "aria-label": `${jeu.note} étoile(s) sur 5` }, etoiles(jeu.note)) : null
    );

    if (actions.length) {
        carte.append(el("div", { class: "card-actions" }, actions.map(a =>
            el("button", {
                type: "button",
                class: `card-action ${a.class || ""}`,
                title: a.titre,
                "aria-label": a.titre,
                onclick: (e) => { e.stopPropagation(); a.onClick(); }
            }, icone(a.icone))
        )));
    }
    if (onOuvrir) {
        carte.addEventListener("click", () => onOuvrir(jeu));
        carte.addEventListener("keydown", (e) => {
            if (e.target === carte && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOuvrir(jeu); }
        });
    }
    return carte;
}

export function afficherGrille(grille, jeux, options) {
    grille.replaceChildren(...jeux.map(j => carteJeu(j, typeof options === "function" ? options(j) : options)));
}

/* ---------- Fiche détaillée ---------- */

export function afficherFiche(dlg, jeu) {
    const image = urlHttpSure(jeu.image);
    const video = urlIntegrationYoutube(jeu.video);
    const meta = (libelle, valeur) => valeur
        ? el("div", { class: "meta-item" }, el("div", { class: "meta-label" }, libelle), el("div", { class: "meta-value" }, valeur))
        : null;

    const description = el("div", { class: "game-description" });
    if (!htmlVide(jeu.description)) description.innerHTML = nettoyerHtml(jeu.description);

    const contenu = el("div", { class: "fiche" },
        el("header", { class: "fiche-entete" },
            el("h2", {}, jeu.nom, jeu.estExtension ? el("sup", { class: "extension" }, "extension") : null),
            el("button", { type: "button", class: "modal-close", "aria-label": "Fermer", onclick: () => dlg.close() }, "×")
        ),
        image ? el("img", { class: "game-cover", src: image, alt: "", referrerpolicy: "no-referrer" }) : null,
        estPrete(jeu) ? el("p", { class: "badge-prete" }, "Actuellement prêté") : null,
        el("div", { class: "game-meta" },
            meta("Joueurs", jeu.joueurs?.length ? formatPlage(jeu.joueurs, " à ") : ""),
            meta("Durée", jeu.duree?.length ? `${formatPlage(jeu.duree)} min` : ""),
            meta("Difficulté", DIFFICULTE[jeu.difficulte] || ""),
            meta("Âge min.", jeu.ageMinimal > 0 ? `${jeu.ageMinimal} ans` : ""),
            meta("Avis", jeu.note > 0 ? etoiles(jeu.note) : "")
        ),
        jeu.styles?.length ? el("div", { class: "tags tags-fiche" }, jeu.styles.map(s => el("span", {}, STYLES[s] || s))) : null,
        htmlVide(jeu.description) ? null : description,
        video ? el("iframe", {
            class: "game-video", src: video, title: `Vidéo de présentation de ${jeu.nom}`,
            allow: "encrypted-media; picture-in-picture", allowfullscreen: true, loading: "lazy",
            referrerpolicy: "strict-origin-when-cross-origin"
        }) : null,
        jeu.emplacement ? el("p", { class: "game-location" }, jeu.emplacement) : null
    );

    dlg.replaceChildren(contenu);
    // À la fermeture on vide la fiche : coupe la vidéo qui continuait de tourner.
    dlg.addEventListener("close", () => dlg.replaceChildren(), { once: true });
    ouvrirDialog(dlg);
}

/* ---------- Tirage au sort ---------- */

export function tirerAuSort(dlg, jeux) {
    const titre = $(".surprise-titre", dlg);
    const zone = $(".surprise-jeu", dlg);
    if (!jeux.length) {
        titre.textContent = "Aucun jeu ne correspond aux filtres";
        zone.replaceChildren(el("p", {}, "Élargis tes critères puis relance le dé."));
    } else {
        const jeu = jeux[Math.floor(Math.random() * jeux.length)];
        const image = urlHttpSure(jeu.image);
        titre.textContent = "✨ Tu peux jouer à ✨";
        zone.replaceChildren(
            el("h3", {}, jeu.nom),
            image ? el("img", { src: image, alt: "", referrerpolicy: "no-referrer" }) : null
        );
    }
    ouvrirDialog(dlg);
}

/* ---------- Filtres ---------- */

function remplirSelect(select, placeholder, options, valeur) {
    select.replaceChildren(
        el("option", { value: "" }, placeholder),
        ...options.map(([v, libelle]) => el("option", { value: v }, libelle))
    );
    // Si la valeur de l'URL n'existe plus dans les options, on la garde visible quand même.
    if (valeur && !options.some(([v]) => String(v) === String(valeur))) {
        select.append(el("option", { value: valeur }, valeur));
    }
    select.value = valeur ?? "";
}

/**
 * Remplit les listes de filtres. `proprios` est optionnel (absent en lecture seule).
 * Les facettes sont calculées sur tous les jeux du propriétaire sélectionné, et non
 * plus sur les jeux déjà filtrés (qui faisaient disparaître des options).
 */
export function remplirFiltres(racine, { jeux, filtre, proprios }) {
    const f = facettes(jeux);
    const owner = $("#ownerSelect", racine);
    if (owner && proprios) {
        owner.replaceChildren(
            el("option", { value: TOUS }, "Tous les propriétaires"),
            ...proprios.map(p => el("option", { value: p.emails.join(",") }, p.libelle))
        );
        owner.value = filtre.proprio || TOUS;
    }
    remplirSelect($("#styleSelect", racine), "Style", f.styles.map(s => [s, STYLES[s] || s]), filtre.style);
    remplirSelect($("#playersSelect", racine), "Joueurs", f.joueurs.map(n => [n, `${n} joueur${n > 1 ? "s" : ""}`]), filtre.joueur);
    remplirSelect($("#durationSelect", racine), "Durée", Object.entries(DUREES).map(([k, d]) => [k, d.libelle]), filtre.duree);
    remplirSelect($("#difficultySelect", racine), "Difficulté", f.difficultes.map(d => [d, DIFFICULTE[d] || d]), filtre.difficulte);
}

export function lireFiltres(racine) {
    const v = (id) => $(id, racine)?.value?.trim() || "";
    const filtre = { style: v("#styleSelect"), joueur: v("#playersSelect"), duree: v("#durationSelect"), difficulte: v("#difficultySelect") };
    if ($("#ownerSelect", racine)) filtre.proprio = v("#ownerSelect") || TOUS;
    return Object.fromEntries(Object.entries(filtre).filter(([, x]) => x));
}

export function compteur(n, vide = "Aucun jeu ne correspond à ces filtres.") {
    return n === 0 ? vide : `${n} jeu${n > 1 ? "x" : ""} trouvé${n > 1 ? "s" : ""}`;
}
