// Autocomplétion du titre d'un jeu : suggestions Wikidata pendant la frappe, puis
// remplissage automatique des champs vides quand un jeu est choisi.
import { rechercherJeux, recupererFiche } from "./wikidata.js";
import { el } from "./ui.js";

const DELAI_MS = 350;

/**
 * @param input      champ titre
 * @param liste      <ul role="listbox"> des suggestions
 * @param info       zone de statut sous le champ
 * @param capturer   () => état actuel du formulaire (pour l'annulation)
 * @param restaurer  (état) => void
 * @param appliquer  (fiche) => { remplis: string[], ignores: string[] }
 */
export function initSaisieAuto({ input, liste, info, capturer, restaurer, appliquer }) {
    const cache = new Map();
    let minuterie = null;
    let controleur = null;
    let resultats = [];
    let actif = -1;
    let derniereRecherche = "";

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", liste.id);
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("autocomplete", "off");

    function fermer() {
        liste.hidden = true;
        liste.replaceChildren();
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        resultats = [];
        actif = -1;
    }

    function surligner(i) {
        actif = i;
        [...liste.children].forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
        if (i >= 0) {
            input.setAttribute("aria-activedescendant", liste.children[i].id);
            liste.children[i].scrollIntoView({ block: "nearest" });
        } else input.removeAttribute("aria-activedescendant");
    }

    function afficher(items) {
        resultats = items;
        if (!items.length) return fermer();
        liste.replaceChildren(...items.map((r, i) => el("li", {
            id: `${liste.id}-${i}`,
            role: "option",
            "aria-selected": "false",
            // mousedown plutôt que click : se déclenche avant la perte de focus du champ
            onmousedown: (e) => { e.preventDefault(); choisir(i); }
        },
            el("span", { class: "suggestion-nom" }, r.nom),
            r.description ? el("span", { class: "suggestion-desc" }, r.description) : null
        )));
        liste.hidden = false;
        input.setAttribute("aria-expanded", "true");
        actif = -1;
    }

    function statut(message, { annulable = null, type = "" } = {}) {
        info.hidden = !message;
        info.className = `auto-info ${type}`.trim();
        info.replaceChildren(message || "");
        if (annulable) {
            info.append(" ", el("button", {
                type: "button", class: "lien-bouton",
                onclick: () => { restaurer(annulable); statut("Remplissage annulé."); }
            }, "Annuler"));
        }
    }

    async function rechercher(texte) {
        controleur?.abort();
        if (cache.has(texte)) return afficher(cache.get(texte));
        controleur = new AbortController();
        try {
            const r = await rechercherJeux(texte, { signal: controleur.signal });
            cache.set(texte, r);
            // On n'affiche que si la saisie n'a pas changé entre-temps
            if (input.value.trim() === texte && document.activeElement === input) afficher(r);
        } catch (e) {
            if (e.name !== "AbortError") console.warn("Suggestions indisponibles :", e);
        }
    }

    async function choisir(i) {
        const r = resultats[i];
        if (!r) return;
        fermer();
        input.value = r.nom;
        derniereRecherche = r.nom;
        controleur?.abort();
        controleur = new AbortController();
        statut(`Récupération des informations sur « ${r.nom} »…`, { type: "chargement" });
        const avant = capturer();
        try {
            const fiche = await recupererFiche(r.id, { signal: controleur.signal });
            const { remplis, ignores } = appliquer(fiche);
            if (!remplis.length) {
                statut(ignores.length
                    ? "Les champs étaient déjà remplis : rien n'a été modifié."
                    : "Aucune information supplémentaire n'est disponible pour ce jeu.");
                return;
            }
            let message = `Rempli automatiquement : ${remplis.join(", ")}.`;
            if (ignores.length) message += ` Champs déjà saisis conservés : ${ignores.join(", ")}.`;
            statut(message, { annulable: avant, type: "succes" });
        } catch (e) {
            if (e.name === "AbortError") return;
            console.warn(e);
            statut("Impossible de récupérer les informations. Vous pouvez remplir les champs à la main.", { type: "erreur" });
        }
    }

    input.addEventListener("input", () => {
        clearTimeout(minuterie);
        const texte = input.value.trim();
        if (texte.length < 3 || texte === derniereRecherche) return fermer();
        minuterie = setTimeout(() => rechercher(texte), DELAI_MS);
    });

    input.addEventListener("keydown", (e) => {
        if (liste.hidden) return;
        if (e.key === "ArrowDown") { e.preventDefault(); surligner(Math.min(actif + 1, resultats.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); surligner(Math.max(actif - 1, -1)); }
        else if (e.key === "Enter" && actif >= 0) { e.preventDefault(); choisir(actif); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermer(); } // ne ferme pas la fenêtre
    });

    input.addEventListener("blur", () => setTimeout(fermer, 150));

    return {
        reinitialiser() {
            clearTimeout(minuterie);
            controleur?.abort();
            derniereRecherche = "";
            fermer();
            statut("");
        }
    };
}
