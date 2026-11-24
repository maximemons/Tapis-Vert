// Images de jeux importées depuis l'appareil (fichier, photo, presse-papiers, glisser-déposer)
// ou copiées depuis un lien.
//
// Firebase Storage exigerait l'offre payante : l'image est donc réduite et compressée sur
// l'appareil, puis enregistrée directement dans le document du jeu (data URL). Résultat :
// elle s'affiche hors ligne, apparaît dans les liens de visualisation et ne dépend plus
// d'un site externe qui pourrait disparaître.
import { dimensionsReduites, poidsDataUrl, TAILLE_MAX_IMAGE } from "./logic.js";

const COTE_MAX = 800;          // px : largement suffisant pour une carte et une fiche
const CIBLE = 180000;          // caractères visés (~130 Ko), bien sous la limite des règles
const QUALITES = [0.82, 0.72, 0.62, 0.5];

export class ErreurImage extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
    }
}

/** Décode un fichier image en tenant compte de l'orientation EXIF des photos de téléphone. */
async function decoder(blob) {
    if (!blob.type.startsWith("image/") && blob.type !== "") {
        throw new ErreurImage("Ce fichier n'est pas une image.");
    }
    if (typeof createImageBitmap === "function") {
        try {
            return await createImageBitmap(blob, { imageOrientation: "from-image" });
        } catch { /* format non pris en charge par createImageBitmap : on tente <img> */ }
    }
    const url = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await img.decode();
        return img;
    } catch (e) {
        throw new ErreurImage("Cette image n'a pas pu être lue. Essayez une photo au format JPEG ou PNG.", e);
    } finally {
        URL.revokeObjectURL(url);
    }
}

function encoder(source, largeur, hauteur, type, qualite) {
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (type === "image/jpeg") {
        ctx.fillStyle = "#fff"; // JPEG sans transparence : fond blanc plutôt que noir
        ctx.fillRect(0, 0, largeur, hauteur);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, largeur, hauteur);
    return canvas.toDataURL(type, qualite);
}

/** WebP si le navigateur sait l'encoder (sinon il renvoie du PNG), JPEG à défaut. */
let typeSortie = null;
function formatDeSortie() {
    if (!typeSortie) {
        const essai = document.createElement("canvas");
        essai.width = essai.height = 1;
        typeSortie = essai.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    }
    return typeSortie;
}

/**
 * Réduit et compresse une image.
 * @param {Blob} blob fichier choisi, photo prise, image collée ou téléchargée
 * @returns {Promise<string>} data URL prête à être enregistrée
 */
export async function compresserImage(blob) {
    if (!blob || !blob.size) throw new ErreurImage("Le fichier est vide.");
    if (blob.size > 40 * 1024 * 1024) throw new ErreurImage("Cette image est trop lourde (plus de 40 Mo).");
    const source = await decoder(blob);
    const l0 = source.width || source.naturalWidth;
    const h0 = source.height || source.naturalHeight;
    if (!l0 || !h0) throw new ErreurImage("Cette image semble vide ou endommagée.");

    const type = formatDeSortie();
    let { largeur, hauteur } = dimensionsReduites(l0, h0, COTE_MAX);
    try {
        // On baisse d'abord la qualité, puis la taille, jusqu'à passer sous la cible.
        for (let essai = 0; essai < 6; essai++) {
            for (const qualite of QUALITES) {
                const data = encoder(source, largeur, hauteur, type, qualite);
                if (data.length <= CIBLE) return data;
            }
            ({ largeur, hauteur } = dimensionsReduites(largeur, hauteur, Math.round(Math.max(largeur, hauteur) * 0.75)));
        }
        const dernier = encoder(source, largeur, hauteur, type, 0.5);
        if (dernier.length <= TAILLE_MAX_IMAGE) return dernier;
        throw new ErreurImage("Impossible de réduire suffisamment cette image.");
    } finally {
        source.close?.();
    }
}

/**
 * Télécharge l'image d'un lien et en garde une copie compressée.
 * Échoue si le site d'origine interdit cette copie (CORS) : le lien reste alors utilisable tel quel.
 */
export async function copierDepuisLien(url, { delai = 15000 } = {}) {
    const controle = new AbortController();
    const minuterie = setTimeout(() => controle.abort(), delai);
    let reponse;
    try {
        reponse = await fetch(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer", signal: controle.signal });
    } catch (e) {
        throw new ErreurImage(
            e?.name === "AbortError"
                ? "Le site de l'image ne répond pas."
                : "Ce site ne permet pas de copier son image. Le lien reste utilisable, ou importez l'image depuis un fichier.",
            e);
    } finally {
        clearTimeout(minuterie);
    }
    if (!reponse.ok) throw new ErreurImage(`L'image est introuvable à cette adresse (erreur ${reponse.status}).`);
    return compresserImage(await reponse.blob());
}

/** Premier fichier image d'un DataTransfer (glisser-déposer, presse-papiers). */
export function imageDuTransfert(transfert) {
    return [...(transfert?.files || [])].find(f => f.type.startsWith("image/")) || null;
}

export { poidsDataUrl };
