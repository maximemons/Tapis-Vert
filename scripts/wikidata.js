// Récupération automatique des informations d'un jeu à partir de son nom.
//
// Sources (gratuites, sans clé, appelables depuis le navigateur) :
//   - Wikidata    : joueurs, durée, âge, image, genres / mécaniques, extension, lien BGG
//   - Wikipédia   : résumé en français (description) et image de repli
//
// BoardGameGeek n'est pas utilisé : depuis 2025 son API exige un jeton d'application,
// qui serait visible de tous dans un site 100 % client.
//
// Aucun accès au DOM : `fetch` est injectable, le module est testé sous Node.
import { STYLES } from "./records.js";

const API = "https://www.wikidata.org/w/api.php";
const P = {
    NATURE: "P31",
    GENRE: "P136",
    MECANIQUE: "P4151",
    IMAGE: "P18",
    JOUEURS_MIN: "P1872",
    JOUEURS_MAX: "P1873",
    DUREE: "P2047",
    AGE_MIN: "P2899",
    BGG: "P2339"
};
// Classes « jeu » courantes : jeu de société, jeu de cartes
const CLASSES_JEU = new Set(["Q131436", "Q142714"]);
// Unités de durée -> minutes
const UNITES_MINUTES = { Q7727: 1, Q25235: 60, Q11574: 1 / 60 };

/* ---------- Requêtes ---------- */

function urlApi(params) {
    const u = new URL(API);
    Object.entries({ format: "json", origin: "*", ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.href;
}

async function getJson(url, { fetchImpl = globalThis.fetch, signal } = {}) {
    const r = await fetchImpl(url, { signal });
    if (!r.ok) throw new Error(`HTTP ${r.status} sur ${new URL(url).hostname}`);
    return r.json();
}

/** Valeurs « normales » d'une propriété (ignore les rangs dépréciés et les « valeur inconnue »). */
function valeurs(entite, prop) {
    return (entite?.claims?.[prop] || [])
        .filter(c => c.rank !== "deprecated" && c.mainsnak?.snaktype === "value")
        .map(c => c.mainsnak.datavalue?.value)
        .filter(v => v !== undefined && v !== null);
}

const idsItems = (entite, prop) => valeurs(entite, prop).map(v => v.id).filter(Boolean);

function nombres(entite, prop) {
    return valeurs(entite, prop).map(v => parseFloat(v.amount)).filter(Number.isFinite);
}

export function estUnJeu(entite) {
    if (!entite?.claims) return false;
    return Boolean(
        entite.claims[P.BGG] || entite.claims[P.JOUEURS_MIN] ||
        idsItems(entite, P.NATURE).some(id => CLASSES_JEU.has(id))
    );
}

/** Titre d'article Wikipédia sans précision entre parenthèses : « Azul (jeu) » -> « Azul ». */
export function titreSansPrecision(titre) {
    return (titre || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

/** Nom à afficher, en français dès que possible (libellé FR, sinon titre Wikipédia FR, sinon anglais). */
export function nomFrancais(entite) {
    return entite?.labels?.fr?.value
        || titreSansPrecision(entite?.sitelinks?.frwiki?.title)
        || entite?.labels?.en?.value
        || "";
}

const API_WIKIPEDIA_FR = "https://fr.wikipedia.org/w/api.php";

function urlWikipediaFr(params) {
    const u = new URL(API_WIKIPEDIA_FR);
    Object.entries({ action: "query", format: "json", formatversion: "2", origin: "*", ...params })
        .forEach(([k, v]) => u.searchParams.set(k, v));
    return u.href;
}

/** Identifiants Wikidata des articles Wikipédia FR renvoyés par un générateur, dans l'ordre de pertinence. */
function qidsDepuisWikipedia(reponse) {
    return (reponse?.query?.pages || [])
        .slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map(p => p.pageprops?.wikibase_item)
        .filter(Boolean);
}

/**
 * Suggestions pour un nom saisi : [{ id, nom, description }].
 *
 * Wikidata seul ne suffit pas en français : beaucoup de jeux n'y ont qu'un nom anglais
 * (« Ticket to Ride » pour « Les Aventuriers du Rail »). On interroge donc en parallèle :
 *   1. Wikipédia FR, titres commençant par la saisie (redirections comprises)
 *   2. Wikidata, noms et alias en français
 *   3. Wikidata, tous noms et alias dans toutes les langues, limité aux jeux ayant un identifiant BGG
 *   4. Wikipédia FR, recherche plein texte dans les titres (mots dans le désordre, au milieu…)
 * Les résultats sont fusionnés dans cet ordre, dédoublonnés, puis filtrés pour ne garder que des jeux.
 * Une source en panne n'empêche pas les autres de répondre.
 */
export async function rechercherJeux(texte, { fetchImpl, signal, limite = 8 } = {}) {
    const q = (texte || "").trim();
    if (q.length < 2) return [];
    const opts = { fetchImpl, signal };
    const motsTitre = q.split(/\s+/).filter(m => m.length > 1).map(m => `intitle:${m.replace(/[":]/g, "")}`).join(" ");

    const sources = await Promise.allSettled([
        getJson(urlWikipediaFr({
            generator: "prefixsearch", gpssearch: q, gpslimit: "15", gpsnamespace: "0",
            redirects: "1", prop: "pageprops", ppprop: "wikibase_item"
        }), opts).then(qidsDepuisWikipedia),
        getJson(urlApi({
            action: "wbsearchentities", search: q, language: "fr", uselang: "fr", type: "item", limit: 20
        }), opts).then(r => (r.search || []).map(x => x.id)),
        getJson(urlApi({
            action: "query", list: "search", srsearch: `${q} haswbstatement:${P.BGG}`, srnamespace: "0", srlimit: "15"
        }), opts).then(r => (r.query?.search || []).map(x => x.title)),
        motsTitre
            ? getJson(urlWikipediaFr({
                generator: "search", gsrsearch: motsTitre, gsrlimit: "15", gsrnamespace: "0",
                prop: "pageprops", ppprop: "wikibase_item"
            }), opts).then(qidsDepuisWikipedia)
            : Promise.resolve([])
    ]);

    if (signal?.aborted) throw new DOMException("Recherche annulée", "AbortError");
    const reussies = sources.filter(s => s.status === "fulfilled");
    if (!reussies.length) throw sources[0].reason;

    const ids = [...new Set(reussies.flatMap(s => s.value).filter(id => /^Q\d+$/.test(id)))].slice(0, 50);
    if (!ids.length) return [];

    const details = await getJson(urlApi({
        action: "wbgetentities", ids: ids.join("|"), props: "claims|labels|descriptions|sitelinks",
        languages: "fr|en", sitefilter: "frwiki"
    }), opts);

    return ids
        .map(id => details.entities?.[id])
        .filter(estUnJeu)
        .slice(0, limite)
        .map(e => {
            const nom = nomFrancais(e) || e.id;
            const description = e.descriptions?.fr?.value || e.descriptions?.en?.value || "";
            const nomAnglais = e.labels?.en?.value;
            // Aide à reconnaître le jeu quand le nom français diffère du nom d'origine
            const vo = nomAnglais && nomAnglais.toLowerCase() !== nom.toLowerCase() ? `VO : ${nomAnglais}` : "";
            return { id: e.id, nom, description: [description, vo].filter(Boolean).join(" · ") };
        });
}

/* ---------- Analyse (pure) ---------- */

/** Durées en minutes, toutes valeurs confondues -> [min, max] ou [] */
export function dureesEnMinutes(entite) {
    const minutes = valeurs(entite, P.DUREE)
        .map(v => {
            const unite = (v.unit || "").split("/").pop();
            const facteur = UNITES_MINUTES[unite];
            const n = parseFloat(v.amount);
            return facteur && Number.isFinite(n) ? Math.round(n * facteur) : NaN;
        })
        .filter(n => Number.isFinite(n) && n > 0 && n < 100000);
    if (!minutes.length) return [];
    const min = Math.min(...minutes);
    const max = Math.max(...minutes);
    return min === max ? [min] : [min, max];
}

// Mots-clés (en minuscules, sans accents) -> style de l'application. L'ordre compte :
// les expressions les plus précises d'abord (« déduction sociale » avant « déduction »).
const REGLES_STYLES = [
    [/semi[- ]?coop/, "SEMI_COOP"],
    [/cooperati.*narrati|narrati.*cooperati/, "COOP_NARRATIF"],
    [/cooperati|co-op/, "COOPERATIF"],
    [/deduction sociale|social deduction|hidden role|role cache|loup-garou|werewolf/, "DEDUCTION_SOCIALE"],
    [/deduction/, "DEDUCTION"],
    [/deck[- ]?(building|construction)|construction de (deck|paquet)/, "DECKBUILDING"],
    [/bag[- ]?building|dice[- ]?building|pool building/, "BAGBUILDING"],
    [/worker placement|placement d.ouvriers/, "PLACEMENT_OUVRIERS"],
    [/engine[- ]?building|construction de moteur/, "CONSTRUCTION_MOTEUR"],
    [/tile[- ]?(placement|laying|based)|pose de tuiles|polyomino|jeu de tuiles/, "TUILES"],
    [/area (control|majority)|majorit|controle de (zone|territoire)/, "MAJORITE"],
    [/trick[- ]?taking|jeu de plis|levees/, "PLI"],
    [/hand management|gestion de (la )?main/, "HAND_MANAGEMENT"],
    [/draft/, "DRAFT"],
    [/bluff/, "BLUFF"],
    [/party game|jeu d.ambiance/, "PARTY"],
    [/escape/, "ESCAPE"],
    [/enquete|mystere|murder|detective/, "ENQUETE"],
    [/role[- ]?playing|jeu de role/, "JDR"],
    [/legacy|campagne|campaign/, "CAMPAGNE"],
    [/collectible card|cartes a collectionner|trading card/, "CCG"],
    [/\b4x\b/, "JEU_4X"],
    [/wargame|jeu de guerre|conquete/, "CONQUETE"],
    [/civili[sz]ation/, "DEVELOPPEMENT"],
    [/econom|commerce|trading game/, "ECONOMIQUE"],
    [/abstra/, "ABSTRAIT"],
    [/famil/, "FAMILIAL"],
    [/drawing|dessin/, "DESSIN"],
    [/puzzle|enigme|casse-tete/, "ENIGME"],
    [/dexterity|adresse|stacking|empilement/, "CONSTRUCTION"],
    [/real[- ]?time|temps reel|speed|rapidite|observation/, "OBSERVATION"],
    [/negociation|negotiation|diplomat/, "DIPLOMATIE"],
    [/connection|alignement|tile connection/, "ALIGNEMENT"],
    [/narrati|storytelling|aventure|adventure/, "NARRATIF"],
    [/app[- ]driven|hybride|numerique/, "HYBRIDE"],
    [/miniatures|skirmish|escarmouche/, "ESCARMOUCHE"],
    [/gestion|resource management/, "GESTION"]
];

const sansAccents = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function deduireStyles(libellesGenres, joueurs = []) {
    const styles = new Set();
    for (const l of libellesGenres) {
        const t = sansAccents(l);
        for (const [motif, style] of REGLES_STYLES) {
            if (motif.test(t)) { styles.add(style); break; }
        }
    }
    if (joueurs[0] === 1) styles.add("SOLO");
    if (joueurs[0] === 2 && (joueurs[1] ?? 2) === 2) styles.add("DUEL");
    return [...styles].filter(s => s in STYLES);
}

export function urlImageCommons(fichier, largeur = 640) {
    if (!fichier) return "";
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fichier.replace(/ /g, "_"))}?width=${largeur}`;
}

const echapper = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Construit la fiche à partir des données brutes.
 * @param entite      entité Wikidata du jeu
 * @param libelles    Map<Qid, libellé> des genres, mécaniques et natures
 * @param resumes     { fr?: résumé REST Wikipédia FR, en?: résumé EN } (pour image / texte)
 */
export function construireFiche(entite, libelles, resumes = {}) {
    const lib = (id) => libelles.get(id) || "";
    const jMin = nombres(entite, P.JOUEURS_MIN)[0];
    const jMax = nombres(entite, P.JOUEURS_MAX)[0];
    const joueurs = Number.isFinite(jMin)
        ? (Number.isFinite(jMax) && jMax > jMin ? [jMin, jMax] : [jMin])
        : (Number.isFinite(jMax) ? [jMax] : []);

    const natures = idsItems(entite, P.NATURE).map(lib);
    const genres = [...idsItems(entite, P.GENRE), ...idsItems(entite, P.MECANIQUE)].map(lib).filter(Boolean);

    const fichier = valeurs(entite, P.IMAGE)[0];
    const image = urlImageCommons(fichier)
        || resumes.fr?.originalimage?.source || resumes.fr?.thumbnail?.source
        || resumes.en?.originalimage?.source || resumes.en?.thumbnail?.source || "";

    // Description : résumé Wikipédia FR, sinon description courte Wikidata. Sources citées
    // (le texte de Wikipédia est sous licence CC BY-SA, l'attribution est obligatoire).
    const paragraphes = [];
    if (resumes.fr?.extract) paragraphes.push(`<p>${echapper(resumes.fr.extract)}</p>`);
    else if (entite.descriptions?.fr?.value) paragraphes.push(`<p>${echapper(entite.descriptions.fr.value)}</p>`);
    const liens = [];
    const pageFr = resumes.fr?.content_urls?.desktop?.page;
    if (resumes.fr?.extract && pageFr) liens.push(`<a href="${echapper(pageFr)}">Wikipédia</a>`);
    const bgg = valeurs(entite, P.BGG)[0];
    if (bgg && /^\d+$/.test(bgg)) liens.push(`<a href="https://boardgamegeek.com/boardgame/${bgg}">BoardGameGeek</a>`);
    if (liens.length) paragraphes.push(`<p>Source : ${liens.join(" · ")}</p>`);

    return {
        wikidataId: entite.id,
        nom: nomFrancais(entite),
        joueurs,
        duree: dureesEnMinutes(entite),
        ageMinimal: nombres(entite, P.AGE_MIN).find(n => n > 0 && n < 100) || 0,
        image,
        styles: deduireStyles(genres, joueurs),
        estExtension: natures.some(n => /extension|expansion/i.test(n)),
        description: paragraphes.join("")
    };
}

/* ---------- Récupération complète ---------- */

async function resumeWikipedia(langue, titre, opts) {
    if (!titre) return undefined;
    const url = `https://${langue}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titre.replace(/ /g, "_"))}`;
    try {
        const r = await getJson(url, opts);
        return r.type === "disambiguation" ? undefined : r;
    } catch {
        return undefined; // le résumé est un bonus : son absence ne doit pas tout faire échouer
    }
}

export async function recupererFiche(id, { fetchImpl, signal } = {}) {
    const opts = { fetchImpl, signal };
    const data = await getJson(urlApi({
        action: "wbgetentities", ids: id, props: "claims|labels|descriptions|sitelinks", languages: "fr|en"
    }), opts);
    const entite = data.entities?.[id];
    if (!entite || entite.missing !== undefined) throw new Error(`Élément ${id} introuvable`);

    const aLibeller = [...new Set([P.NATURE, P.GENRE, P.MECANIQUE].flatMap(p => idsItems(entite, p)))].slice(0, 50);
    const [libs, fr, en] = await Promise.all([
        aLibeller.length
            ? getJson(urlApi({ action: "wbgetentities", ids: aLibeller.join("|"), props: "labels", languages: "fr|en" }), opts)
            : Promise.resolve({ entities: {} }),
        resumeWikipedia("fr", entite.sitelinks?.frwiki?.title, opts),
        resumeWikipedia("en", entite.sitelinks?.enwiki?.title, opts)
    ]);

    // On garde les deux langues : les règles de styles reconnaissent le français et l'anglais.
    const libelles = new Map();
    for (const [qid, e] of Object.entries(libs.entities || {})) {
        libelles.set(qid, [e.labels?.fr?.value, e.labels?.en?.value].filter(Boolean).join(" / "));
    }
    return construireFiche(entite, libelles, { fr, en });
}
