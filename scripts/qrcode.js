// QR codes des liens de visualisation, générés entièrement dans le navigateur
// (aucun service tiers : le jeton du lien ne quitte pas la page).
// Moteur : qrcode-generator 1.4.4 (MIT), chargé par scripts/vendor/qrcode-generator-1.4.4.js.

const SVG_NS = "http://www.w3.org/2000/svg";

/** Matrice du QR code : { taille, sombre(ligne, colonne) }. Correction d'erreur « M » (~15 %). */
export function matriceQr(texte, moteur = globalThis.qrcode) {
    if (typeof moteur !== "function") throw new Error("Générateur de QR code non chargé");
    const qr = moteur(0, "M"); // 0 = version choisie automatiquement selon la longueur
    qr.addData(texte);
    qr.make();
    const taille = qr.getModuleCount();
    return { taille, sombre: (l, c) => qr.isDark(l, c) };
}

/** Chemin SVG d'une matrice (un carré par module sombre), avec marge blanche réglementaire. */
export function cheminQr({ taille, sombre }, marge = 4) {
    let d = "";
    for (let l = 0; l < taille; l++) {
        for (let c = 0; c < taille; c++) {
            if (sombre(l, c)) d += `M${c + marge} ${l + marge}h1v1h-1z`;
        }
    }
    return { d, cote: taille + 2 * marge };
}

/** Élément <svg> affichable (net à toutes les tailles). */
export function qrSvg(texte, { libelle = "QR code du lien" } = {}) {
    const { d, cote } = cheminQr(matriceQr(texte));
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${cote} ${cote}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", libelle);
    svg.setAttribute("shape-rendering", "crispEdges");
    const fond = document.createElementNS(SVG_NS, "rect");
    fond.setAttribute("width", cote);
    fond.setAttribute("height", cote);
    fond.setAttribute("fill", "#fff");
    const modules = document.createElementNS(SVG_NS, "path");
    modules.setAttribute("d", d);
    modules.setAttribute("fill", "#000");
    svg.append(fond, modules);
    return svg;
}

/**
 * Image PNG prête à imprimer ou envoyer : titre au-dessus, QR code, consigne en dessous.
 * @returns Promise<Blob>
 */
export function qrPng(texte, { titre = "", legende = "Scannez pour voir la ludothèque", pixelsParModule = 12 } = {}) {
    const m = matriceQr(texte);
    const marge = 4;
    const coteQr = (m.taille + 2 * marge) * pixelsParModule;
    const largeur = Math.max(coteQr, 480);
    const hautTitre = titre ? 90 : 20;
    const hautLegende = legende ? 70 : 20;
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hautTitre + coteQr + hautLegende;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const x0 = Math.round((largeur - coteQr) / 2) + marge * pixelsParModule;
    const y0 = hautTitre + marge * pixelsParModule;
    ctx.fillStyle = "#000";
    for (let l = 0; l < m.taille; l++) {
        for (let c = 0; c < m.taille; c++) {
            if (m.sombre(l, c)) ctx.fillRect(x0 + c * pixelsParModule, y0 + l * pixelsParModule, pixelsParModule, pixelsParModule);
        }
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#0E6B3B";
    const police = (taille, graisse = "") => `${graisse} ${taille}px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.trim();
    if (titre) {
        let taille = 34;
        ctx.font = police(taille, "bold");
        while (ctx.measureText(titre).width > largeur - 40 && taille > 16) ctx.font = police(--taille, "bold");
        ctx.fillText(titre, largeur / 2, 58, largeur - 40);
    }
    if (legende) {
        ctx.font = police(22);
        ctx.fillStyle = "#333";
        ctx.fillText(legende, largeur / 2, hautTitre + coteQr + 40, largeur - 40);
    }
    return new Promise((ok, ko) => canvas.toBlob(b => (b ? ok(b) : ko(new Error("Export PNG impossible"))), "image/png"));
}
