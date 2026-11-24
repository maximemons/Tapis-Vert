// Éditeur de description : Quill 2 (copie locale, chargée seulement quand on édite un jeu).
// Si Quill ne peut pas être chargé, un éditeur simple prend le relais avec la même interface :
// le formulaire reste toujours utilisable.

const QUILL_JS = new URL("./vendor/quill-2.0.3.js", import.meta.url).href;
const QUILL_CSS = new URL("../styles/vendor/quill-2.0.3.snow.css", import.meta.url).href;
const DELAI = 10000;

function chargerScript(src) {
    return new Promise((resolve, reject) => {
        if (window.Quill) return resolve(window.Quill);
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        const minuterie = setTimeout(() => reject(new Error("délai dépassé")), DELAI);
        s.onload = () => { clearTimeout(minuterie); window.Quill ? resolve(window.Quill) : reject(new Error("Quill absent")); };
        s.onerror = () => { clearTimeout(minuterie); reject(new Error("chargement impossible")); };
        document.head.append(s);
    });
}

function chargerCss(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.append(l);
}

/** Quill 2 avec une interface réduite et stable. */
function adapterQuill(quill) {
    return {
        root: quill.root,
        simple: false,
        getText: () => quill.getText(),
        // getSemanticHTML produit de vraies listes <ul>/<ol> (le HTML interne de Quill 2 ne le fait pas)
        getHtml: () => quill.getSemanticHTML().replace(/&nbsp;/g, " ").replace(/\u00a0/g, " "),
        setHtml: (html) => {
            quill.setContents([{ insert: "\n" }], "silent");
            if (html) quill.clipboard.dangerouslyPasteHTML(html, "silent");
        },
        vider: () => quill.setContents([{ insert: "\n" }], "silent")
    };
}

/** Éditeur de secours : zone éditable sans barre d'outils. */
function editeurSimple(conteneur) {
    const root = document.createElement("div");
    root.className = "ql-editor editeur-simple";
    root.contentEditable = "true";
    root.setAttribute("role", "textbox");
    root.setAttribute("aria-multiline", "true");
    root.setAttribute("aria-label", "Description");
    conteneur.replaceChildren(root);
    return {
        root,
        simple: true,
        getText: () => root.innerText || root.textContent || "",
        getHtml: () => root.innerHTML,
        setHtml: (html) => { root.innerHTML = html || ""; },
        vider: () => { root.innerHTML = ""; }
    };
}

let promesse = null;

/**
 * Crée (une seule fois) l'éditeur dans le conteneur. Ne rejette jamais.
 * @param {(texte: string) => void} [onSecours] appelé si l'éditeur de secours est utilisé
 */
export function creerEditeur(selecteur, { onSecours } = {}) {
    promesse ??= (async () => {
        const conteneur = document.querySelector(selecteur);
        try {
            chargerCss(QUILL_CSS);
            const Quill = await chargerScript(QUILL_JS);
            const quill = new Quill(conteneur, {
                theme: "snow",
                modules: { toolbar: [["bold", "italic", "underline"], [{ list: "ordered" }, { list: "bullet" }], ["link"]] }
            });
            return adapterQuill(quill);
        } catch (e) {
            console.warn("Éditeur enrichi indisponible, éditeur simple utilisé :", e);
            onSecours?.("L'éditeur de mise en forme n'a pas pu être chargé : la description reste modifiable en texte simple.");
            return editeurSimple(conteneur);
        }
    })();
    return promesse;
}
