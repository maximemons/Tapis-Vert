// Logique métier pure : aucun accès au DOM ni au réseau, pour pouvoir la tester sous Node.

/* ---------- Utilisateurs & groupes ---------- */

const uniq = (list) => [...new Set(list.filter(Boolean))];

export function nomCourt(user) {
    if (!user) return "";
    const initiale = (user.nom || "").trim().charAt(0);
    return initiale ? `${user.prenom} ${initiale}.` : `${user.prenom || ""}`.trim();
}

/**
 * Construit la « famille » de l'utilisateur connecté (lui + ses liens) et la liste
 * des autres groupes auxquels il a accès. Ne modifie jamais les objets reçus
 * (l'ancienne version faisait des push() sur user.liens).
 */
export function construireGroupes(monEmail, users) {
    const parId = new Map(users.map(u => [u.id, u]));
    const moi = parId.get(monEmail);
    const libelle = (emails) => emails.map(e => parId.get(e)).filter(Boolean).map(nomCourt).join(" & ");

    const familleEmails = uniq([monEmail, ...(moi?.liens || [])]).sort();
    const famille = { libelle: libelle(familleEmails) || monEmail, emails: familleEmails };
    const cleFamille = familleEmails.join(",");

    const acces = moi?.acces || [];
    const idsAcces = acces.includes("*")
        ? users.map(u => u.id).filter(id => !familleEmails.includes(id))
        : uniq(acces);

    const vus = new Set([cleFamille]);
    const groupes = [];
    for (const id of idsAcces) {
        const u = parId.get(id);
        if (!u) continue; // email inconnu dans « acces » : on l'ignore au lieu de planter
        const emails = uniq([u.id, ...(u.liens || [])]).sort();
        const cle = emails.join(",");
        if (vus.has(cle)) continue;
        vus.add(cle);
        groupes.push({ libelle: libelle(emails), emails });
    }
    groupes.sort((a, b) => a.libelle.localeCompare(b.libelle, "fr", { sensitivity: "base" }));
    return { famille, groupes };
}

/* ---------- Filtres ---------- */

export const TOUS = "ALL";

export const DUREES = {
    "15": { libelle: "< 15 min", bornes: [0, 15] },
    "15-30": { libelle: "15–30 min", bornes: [15, 30] },
    "30-45": { libelle: "30–45 min", bornes: [30, 45] },
    "60": { libelle: "≈ 1 h", bornes: [45, 60] },
    "90": { libelle: "≈ 1 h 30", bornes: [60, 90] },
    "120": { libelle: "> 2 h", bornes: [90, Infinity] }
};

// Noms des paramètres d'URL conservés pour ne pas casser les favoris existants.
const PARAMS = {
    proprio: "ownerFilter",
    style: "styleFilter",
    joueur: "playerFilter",
    duree: "durationFilter",
    difficulte: "difficultyFilter"
};

export function filtreDepuisParams(params, proprioParDefaut = "") {
    const filtre = {};
    for (const [cle, nom] of Object.entries(PARAMS)) {
        const v = params.get(nom);
        if (v && v.trim()) filtre[cle] = v.trim();
    }
    if (!filtre.proprio) filtre.proprio = proprioParDefaut;
    // Ordre des emails normalisé : les anciens favoris restent compatibles avec la liste déroulante.
    if (filtre.proprio && filtre.proprio !== TOUS) filtre.proprio = filtre.proprio.split(",").map(e => e.trim()).sort().join(",");
    return filtre;
}

export function filtreVersParams(filtre) {
    const params = new URLSearchParams();
    for (const [cle, nom] of Object.entries(PARAMS)) {
        if (filtre[cle]) params.set(nom, filtre[cle]);
    }
    return params;
}

export function jeuCorrespond(jeu, filtre = {}) {
    if (filtre.proprio && filtre.proprio !== TOUS) {
        if (!filtre.proprio.split(",").includes(jeu.proprio)) return false;
    }
    if (filtre.difficulte && (jeu.difficulte || "").toLowerCase() !== filtre.difficulte.toLowerCase()) {
        return false;
    }
    if (filtre.style && !(jeu.styles || []).some(s => s.toLowerCase() === filtre.style.toLowerCase())) {
        return false;
    }
    if (filtre.duree) {
        const [minF, maxF] = DUREES[filtre.duree]?.bornes || [0, Infinity];
        const d = jeu.duree || [];
        if (d.length === 0) return false; // durée inconnue : ne correspond à aucune tranche
        const minJ = d[0];
        const maxJ = d[1] ?? d[0];
        if (maxJ < minF || minJ > maxF) return false;
    }
    if (filtre.joueur) {
        const nb = parseInt(filtre.joueur, 10);
        const j = jeu.joueurs || [];
        if (j.length === 0) return false;
        const minJ = j[0];
        const maxJ = j[1] ?? j[0];
        if (nb < minJ || nb > maxJ) return false;
    }
    return true;
}

/** Valeurs proposées dans les listes de filtres, calculées sur tous les jeux visibles. */
export function facettes(jeux) {
    const styles = new Set();
    const joueurs = new Set();
    const difficultes = new Set();
    for (const jeu of jeux) {
        (jeu.styles || []).forEach(s => styles.add(s));
        const [min, max] = jeu.joueurs || [];
        if (Number.isFinite(min)) {
            const fin = Number.isFinite(max) ? Math.min(max, min + 30) : min; // garde-fou
            for (let i = min; i <= fin; i++) joueurs.add(i);
        }
        if (jeu.difficulte) difficultes.add(jeu.difficulte);
    }
    return {
        styles: [...styles].sort(),
        joueurs: [...joueurs].sort((a, b) => a - b),
        difficultes: [...difficultes].sort()
    };
}

export function trierParNom(jeux) {
    return [...jeux].sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr", { sensitivity: "base" }));
}

/* ---------- Affichage ---------- */

export function formatPlage(valeurs, separateur = " – ") {
    if (!Array.isArray(valeurs) || valeurs.length === 0) return "–";
    if (valeurs.length === 1 || valeurs[0] === valeurs[1]) return `${valeurs[0]}`;
    return `${valeurs[0]}${separateur}${valeurs[1]}`;
}

export function etoiles(note) {
    const n = Math.max(0, Math.min(5, Number(note) || 0));
    return "⭐".repeat(n);
}

/** N'accepte que les URL http(s) : bloque javascript:, data:, etc. */
export function urlHttpSure(url) {
    if (typeof url !== "string" || !url.trim()) return "";
    try {
        const u = new URL(url.trim());
        return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch {
        return "";
    }
}

/** Transforme n'importe quel lien YouTube en URL d'intégration youtube-nocookie. */
export function urlIntegrationYoutube(url) {
    const sure = urlHttpSure(url);
    if (!sure) return "";
    const u = new URL(sure);
    const hote = u.hostname.replace(/^www\.|^m\./, "");
    let id = "";
    if (hote === "youtu.be") id = u.pathname.slice(1);
    else if (hote === "youtube.com" || hote === "youtube-nocookie.com") {
        if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
        else {
            const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
            if (m) id = m[1];
        }
    }
    return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : "";
}

/* ---------- Partage en lecture seule ---------- */

/**
 * Copie épurée d'un jeu, destinée aux liens de visualisation.
 * Exclus volontairement (données personnelles / privées) : propriétaire (email),
 * nom de l'emprunteur, emplacement dans la maison, date d'achat.
 */
export function projeterJeuPourPartage(jeu, { nettoyerHtml = (h) => h } = {}) {
    return {
        nom: jeu.nom || "",
        image: urlHttpSure(jeu.image),
        joueurs: jeu.joueurs || [],
        duree: jeu.duree || [],
        difficulte: jeu.difficulte || "",
        styles: jeu.styles || [],
        estExtension: jeu.estExtension === true,
        prete: Boolean(jeu.estPrete && String(jeu.estPrete).trim()),
        description: nettoyerHtml(jeu.description || ""),
        video: urlIntegrationYoutube(jeu.video),
        ageMinimal: Number(jeu.ageMinimal) || 0,
        note: Number(jeu.note) > 0 ? Number(jeu.note) : -1,
        wishlist: jeu.wishlist === true
    };
}

/** Sélectionne les jeux couverts par un partage. */
export function jeuxDuPartage(jeux, partage) {
    return jeux.filter(j => partage.proprios.includes(j.proprio) && (partage.inclureWishlist || !j.wishlist));
}

export function jsonStable(valeur) {
    if (Array.isArray(valeur)) return `[${valeur.map(jsonStable).join(",")}]`;
    if (valeur && typeof valeur === "object") {
        return `{${Object.keys(valeur).sort().map(k => `${JSON.stringify(k)}:${jsonStable(valeur[k])}`).join(",")}}`;
    }
    return JSON.stringify(valeur);
}

/**
 * Calcule les écritures minimales pour aligner la copie publique sur les jeux réels.
 * voulus / existants : Map<id, objet>.
 */
export function differences(voulus, existants) {
    const aEcrire = [];
    const aSupprimer = [];
    for (const [id, data] of voulus) {
        const actuel = existants.get(id);
        if (!actuel || jsonStable(actuel) !== jsonStable(data)) aEcrire.push({ id, data });
    }
    for (const id of existants.keys()) {
        if (!voulus.has(id)) aSupprimer.push(id);
    }
    return { aEcrire, aSupprimer };
}

/** Jeton non devinable (192 bits) encodé en base64url. */
export function genererJeton(cryptoImpl = globalThis.crypto, octets = 24) {
    const buf = new Uint8Array(octets);
    cryptoImpl.getRandomValues(buf);
    let bin = "";
    buf.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function estJetonValide(jeton) {
    return typeof jeton === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(jeton);
}

export function estExpire(expireLeMs, maintenantMs = Date.now()) {
    return Number.isFinite(expireLeMs) && expireLeMs <= maintenantMs;
}

/* ---------- Limites des liens de visualisation (identiques à firestore.rules) ---------- */

export const LIMITES_PARTAGE = { libelle: 80, titre: 120 };

export function tronquer(texte, max) {
    const t = (texte || "").trim();
    return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function titreParDefaut(libelleFamille) {
    return tronquer(`Ludothèque de ${libelleFamille || "la famille"}`, LIMITES_PARTAGE.titre);
}

/** Nom de fichier sûr : « Mamie & Papi » -> « mamie-papi » */
export function slug(texte) {
    return (texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "lien";
}
