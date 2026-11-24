// Lancer avec : node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as L from "../scripts/logic.js";
import { Jeux } from "../scripts/records.js";

const users = [
  { id: "a@x.fr", prenom: "Alice", nom: "Martin", liens: ["b@x.fr"], acces: ["*"] },
  { id: "b@x.fr", prenom: "Bob", nom: "Martin", liens: ["a@x.fr"] },
  { id: "c@x.fr", prenom: "Chloé", nom: "Durand", liens: [] },
  { id: "d@x.fr", prenom: "Dan", nom: "Petit", liens: ["e@x.fr"] },
  { id: "e@x.fr", prenom: "Eve", nom: "Petit", liens: ["d@x.fr"] },
];

test("construireGroupes : famille + accès '*' dédoublonnés, sans muter l'entrée", () => {
  const avant = JSON.stringify(users);
  const { famille, groupes } = L.construireGroupes("a@x.fr", users);
  assert.deepEqual(famille.emails, ["a@x.fr", "b@x.fr"]);
  assert.equal(famille.libelle, "Alice M. & Bob M.");
  assert.deepEqual(groupes.map(g => g.emails.join(",")), ["c@x.fr", "d@x.fr,e@x.fr"]);
  assert.equal(JSON.stringify(users), avant);
});

test("construireGroupes : email inconnu dans acces ignoré", () => {
  const u = [{ id: "z@x.fr", prenom: "Zoé", nom: "Z", acces: ["inconnu@x.fr", "c@x.fr"] }, users[2]];
  const { groupes } = L.construireGroupes("z@x.fr", u);
  assert.deepEqual(groupes.map(g => g.emails[0]), ["c@x.fr"]);
});

const jeu = (o) => new Jeux({ id: "1", proprio: "a@x.fr", nom: "Azul", joueurs: [2, 4], duree: [30, 45], styles: ["FAMILIAL"], difficulte: "NIVEAU2", ...o });

test("jeuCorrespond", () => {
  assert.ok(L.jeuCorrespond(jeu(), { proprio: "a@x.fr,b@x.fr", joueur: "3", duree: "30-45" }));
  assert.ok(L.jeuCorrespond(jeu(), { proprio: L.TOUS }));
  assert.ok(!L.jeuCorrespond(jeu(), { proprio: "c@x.fr" }));
  assert.ok(!L.jeuCorrespond(jeu(), { joueur: "5" }));
  assert.ok(!L.jeuCorrespond(jeu(), { duree: "120" }));
  assert.ok(!L.jeuCorrespond(jeu({ duree: [] }), { duree: "15" }));
  assert.ok(L.jeuCorrespond(jeu({ joueurs: [2] }), { joueur: "2" }));
  assert.ok(!L.jeuCorrespond(jeu(), { style: "SOLO" }));
});

test("filtres <-> paramètres d'URL (noms historiques conservés)", () => {
  const p = new URLSearchParams("ownerFilter=ALL&playerFilter=3");
  const f = L.filtreDepuisParams(p, "a@x.fr");
  assert.deepEqual(f, { proprio: "ALL", joueur: "3" });
  assert.equal(L.filtreDepuisParams(new URLSearchParams(), "a@x.fr").proprio, "a@x.fr");
  assert.equal(L.filtreVersParams(f).toString(), "ownerFilter=ALL&playerFilter=3");
});

test("facettes", () => {
  const f = L.facettes([jeu(), jeu({ joueurs: [1], styles: ["SOLO", "FAMILIAL"], difficulte: "" })]);
  assert.deepEqual(f.joueurs, [1, 2, 3, 4]);
  assert.deepEqual(f.styles, ["FAMILIAL", "SOLO"]);
  assert.deepEqual(f.difficultes, ["NIVEAU2"]);
});

test("urlHttpSure bloque les schémas dangereux", () => {
  assert.equal(L.urlHttpSure("javascript:alert(1)"), "");
  assert.equal(L.urlHttpSure("data:text/html,x"), "");
  assert.equal(L.urlHttpSure(" https://ex.com/a.jpg "), "https://ex.com/a.jpg");
});

test("urlIntegrationYoutube", () => {
  const id = "dQw4w9WgXcQ";
  for (const u of [`https://www.youtube.com/watch?v=${id}&t=3`, `https://youtu.be/${id}`, `https://m.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`])
    assert.equal(L.urlIntegrationYoutube(u), `https://www.youtube-nocookie.com/embed/${id}`);
  assert.equal(L.urlIntegrationYoutube("https://evil.com/watch?v=" + id), "");
});

test("projection : aucune donnée personnelle", () => {
  const p = L.projeterJeuPourPartage(jeu({ estPrete: "Tonton Paul", emplacement: "Grenier", dateAchat: "2024-01-01", image: "javascript:x" }));
  assert.equal(p.prete, true);
  assert.equal(p.image, "");
  for (const champ of ["proprio", "estPrete", "emplacement", "dateAchat"]) assert.ok(!(champ in p), champ);
  assert.ok(!JSON.stringify(p).includes("@"));
});

test("jeuxDuPartage respecte proprios et wishlist", () => {
  const js = [jeu(), jeu({ id: "2", wishlist: true }), jeu({ id: "3", proprio: "c@x.fr" })];
  assert.deepEqual(L.jeuxDuPartage(js, { proprios: ["a@x.fr"], inclureWishlist: false }).map(j => j.id), ["1"]);
  assert.deepEqual(L.jeuxDuPartage(js, { proprios: ["a@x.fr"], inclureWishlist: true }).map(j => j.id), ["1", "2"]);
});

test("differences : écrit uniquement ce qui change", () => {
  const voulus = new Map([["1", { a: 1, b: [1, 2] }], ["2", { a: 2 }]]);
  const existants = new Map([["1", { b: [1, 2], a: 1 }], ["3", { a: 3 }]]);
  const d = L.differences(voulus, existants);
  assert.deepEqual(d.aEcrire.map(e => e.id), ["2"]);
  assert.deepEqual(d.aSupprimer, ["3"]);
});

test("jetons", () => {
  const j = L.genererJeton();
  assert.equal(j.length, 32);
  assert.ok(L.estJetonValide(j));
  assert.notEqual(j, L.genererJeton());
  assert.ok(!L.estJetonValide("court"));
  assert.ok(!L.estJetonValide("../../utilisateurs/xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"));
});

test("Jeux : normalisation et toDoc", () => {
  const j = new Jeux({ id: "x", nom: "A", ageMinimal: "8", note: "3", estPrete: "  ", joueurs: ["2", "4"] });
  assert.equal(j.ageMinimal, 8);
  assert.equal(j.note, 3);
  assert.equal(j.estPrete, undefined);
  assert.deepEqual(j.joueurs, [2, 4]);
  const d = j.toDoc();
  assert.ok(!("id" in d) && !("estPrete" in d));
});

test("filtreDepuisParams normalise l'ordre des emails", () => {
  const f = L.filtreDepuisParams(new URLSearchParams("ownerFilter=b@x.fr,a@x.fr"));
  assert.equal(f.proprio, "a@x.fr,b@x.fr");
});

test("titre par défaut borné à la limite des règles Firestore", () => {
  const long = Array.from({ length: 12 }, (_, i) => `Prénom${i} N.`).join(" & ");
  const t = L.titreParDefaut(long);
  assert.ok(t.length <= L.LIMITES_PARTAGE.titre && t.endsWith("…"), `${t.length} caractères`);
  assert.equal(L.titreParDefaut("Alice M."), "Ludothèque de Alice M.");
});

test("slug pour les noms de fichiers", () => {
  assert.equal(L.slug("Mamie & Papi Côté"), "mamie-papi-cote");
  assert.equal(L.slug("***"), "lien");
});

test("peutEmprunter : jeu d'un autre, disponible, hors wishlist", () => {
  const moi = ["a@x.fr", "b@x.fr"];
  assert.ok(L.peutEmprunter(jeu({ proprio: "c@x.fr" }), moi));
  assert.ok(!L.peutEmprunter(jeu({ proprio: "a@x.fr" }), moi), "mon jeu");
  assert.ok(!L.peutEmprunter(jeu({ proprio: "b@x.fr" }), moi), "jeu de ma famille");
  assert.ok(!L.peutEmprunter(jeu({ proprio: "c@x.fr", estPrete: "Paul" }), moi), "déjà prêté");
  assert.ok(!L.peutEmprunter(jeu({ proprio: "c@x.fr", wishlist: true }), moi), "wishlist");
  assert.ok(!L.peutEmprunter(jeu({ proprio: "pas-un-email" }), moi), "propriétaire sans email valide");
  assert.ok(!L.peutEmprunter(jeu({ proprio: undefined }), moi));
  // Version épurée (liens de lecture seule) : pas de propriétaire -> jamais d'emprunt
  assert.ok(!L.peutEmprunter({ nom: "Azul", prete: false }, moi));
});

test("lienEmprunt : mailto encodé, sans CC par défaut", () => {
  const url = L.lienEmprunt(jeu({ proprio: "c+jeux@x.fr", nom: "Azul & Co ?" }));
  assert.ok(url.startsWith("mailto:c%2Bjeux@x.fr?subject="), url);
  const q = new URL(url).searchParams;
  assert.equal(q.get("subject"), "Emprunt du jeu « Azul & Co ? »");
  assert.equal(q.get("cc"), null);
  const corps = q.get("body");
  assert.match(corps, /t'emprunter « Azul & Co \? »/);
  assert.ok(corps.includes("\r\n") && corps.endsWith("Par avance merci !"));
  assert.ok(!url.includes(" ") && !url.includes("\n"));
});

test("lienEmprunt : co-propriétaires en CC", () => {
  const url = L.lienEmprunt(jeu({ proprio: "d@x.fr" }), ["e@x.fr", "f+g@x.fr"]);
  assert.ok(url.startsWith("mailto:d@x.fr?cc=e@x.fr,f%2Bg@x.fr&subject="), url);
  assert.equal(new URL(url).searchParams.get("cc"), "e@x.fr,f+g@x.fr");
});

test("coProprietaires : autres membres du compte, propriétaire exclu", () => {
  const { groupes } = L.construireGroupes("a@x.fr", users);
  assert.deepEqual(L.coProprietaires(jeu({ proprio: "d@x.fr" }), groupes), ["e@x.fr"]);
  assert.deepEqual(L.coProprietaires(jeu({ proprio: "e@x.fr" }), groupes), ["d@x.fr"]);
  assert.deepEqual(L.coProprietaires(jeu({ proprio: "c@x.fr" }), groupes), []);
  assert.deepEqual(L.coProprietaires(jeu({ proprio: "inconnu@x.fr" }), groupes), []);
});

/* ---------- Images importées ---------- */

const PIXEL = "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

test("urlImageSure : liens http(s) et images importées raster acceptés, le reste refusé", () => {
  assert.equal(L.urlImageSure("https://exemple.fr/a.jpg"), "https://exemple.fr/a.jpg");
  assert.equal(L.urlImageSure(PIXEL), PIXEL);
  assert.equal(L.urlImageSure("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="), "", "SVG refusé (peut contenir du script)");
  assert.equal(L.urlImageSure("data:text/html;base64,PGI+"), "");
  assert.equal(L.urlImageSure("data:image/png;base64,<script>"), "", "base64 invalide");
  assert.equal(L.urlImageSure("javascript:alert(1)"), "");
  assert.equal(L.urlImageSure(`data:image/png;base64,${"A".repeat(L.TAILLE_MAX_IMAGE)}`), "", "trop lourde");
});

test("image importée conservée dans la copie publique d'un partage", () => {
  const p = L.projeterJeuPourPartage({ nom: "X", image: PIXEL, proprio: "a@x.fr" });
  assert.equal(p.image, PIXEL);
});

test("poids et dimensions des images", () => {
  assert.equal(L.poidsDataUrl("data:image/png;base64,AAAA"), 3);
  assert.equal(L.poidsDataUrl("data:image/png;base64,AA=="), 1);
  assert.equal(L.formatPoids(500), "500 o");
  assert.equal(L.formatPoids(150 * 1024), "150 Ko");
  assert.equal(L.formatPoids(1536 * 1024), "1,5 Mo");
  assert.deepEqual(L.dimensionsReduites(4000, 3000, 800), { largeur: 800, hauteur: 600 });
  assert.deepEqual(L.dimensionsReduites(300, 900, 800), { largeur: 267, hauteur: 800 });
  assert.deepEqual(L.dimensionsReduites(200, 100, 800), { largeur: 200, hauteur: 100 }, "jamais agrandie");
  assert.deepEqual(L.dimensionsReduites(0, 100, 800), { largeur: 0, hauteur: 0 });
});

/* ---------- Recherche et tri ---------- */

test("recherche : sans accents ni majuscules, tous les mots doivent figurer", () => {
  const j = { nom: "Les Aventuriers du Rail : Europe" };
  assert.ok(L.jeuCorrespond(j, { recherche: "aventurier" }));
  assert.ok(L.jeuCorrespond(j, { recherche: "EUROPE rail" }));
  assert.ok(L.jeuCorrespond({ nom: "Azul" }, { recherche: "AZÛL" }));
  assert.ok(!L.jeuCorrespond(j, { recherche: "rail asie" }));
  assert.ok(L.jeuCorrespond(j, { recherche: "   " }), "recherche vide = tout");
});

test("recherche et tri conservés dans l'URL", () => {
  const params = L.filtreVersParams({ recherche: "azul", tri: "recents", joueur: "2" });
  assert.equal(params.get("q"), "azul");
  assert.equal(params.get("sort"), "recents");
  const f = L.filtreDepuisParams(params, "a@x.fr");
  assert.equal(f.recherche, "azul");
  assert.equal(f.tri, "recents");
});

test("trier : récents, notes, durée ; à égalité ordre alphabétique ; tri inconnu = nom", () => {
  const jeux = [
    { nom: "Brass", ajouteLe: 10, note: 4, duree: [120] },
    { nom: "Azul", note: 4, duree: [30, 45] },
    { nom: "Codenames", ajouteLe: 30, note: -1, duree: [15] },
    { nom: "Dixit", ajouteLe: 20, note: 5 }
  ];
  const noms = (t) => L.trier(jeux, t).map(j => j.nom);
  assert.deepEqual(noms("recents"), ["Codenames", "Dixit", "Brass", "Azul"]);
  assert.deepEqual(noms("note"), ["Dixit", "Azul", "Brass", "Codenames"]);
  assert.deepEqual(noms("duree"), ["Codenames", "Azul", "Brass", "Dixit"]);
  assert.deepEqual(noms("nimporte"), ["Azul", "Brass", "Codenames", "Dixit"]);
  assert.deepEqual(jeux.map(j => j.nom), ["Brass", "Azul", "Codenames", "Dixit"], "entrée non modifiée");
});

/* ---------- Export ---------- */

test("versCsv : en-tête, séparateur ;, guillemets, formules neutralisées, images importées masquées", () => {
  const csv = L.versCsv([
    { nom: "=HYPERLINK(\"x\")", proprio: "a@x.fr", joueurs: [2, 4], styles: ["FAMILIAL"], estExtension: true, note: -1, image: PIXEL },
    { nom: "Azul; édition \"spéciale\"", proprio: "a@x.fr", joueurs: [2], difficulte: "NIVEAU2", image: "https://x.fr/a.jpg" }
  ], { libelles: { difficulte: { NIVEAU2: "Facile" }, styles: { FAMILIAL: "Familial" } } });
  assert.ok(csv.startsWith("\uFEFFNom;Propriétaire;Joueurs;"));
  const lignes = csv.split("\r\n");
  assert.equal(lignes.length, 3);
  const l1 = lignes.find(l => l.includes("Azul"));
  const l2 = lignes.find(l => l.includes("HYPERLINK"));
  assert.ok(l1.startsWith('"Azul; édition ""spéciale"""'), l1);
  assert.ok(l1.includes(";Facile;") && l1.includes("https://x.fr/a.jpg"));
  assert.ok(l2.startsWith(`"'=HYPERLINK(""x"")"`), l2);
  assert.ok(l2.includes(";2-4;") && l2.includes(";Familial;") && l2.includes(";oui;") && l2.includes("(image importée)"));
});

test("versJson : sauvegarde complète et triée, rechargeable", () => {
  const j = new Jeux({ id: "g1", proprio: "a@x.fr", nom: "Azul", joueurs: [2, 4], image: PIXEL, ajouteLe: 123 });
  const s = JSON.parse(L.versJson([j], { auteur: "a@x.fr", date: new Date("2026-01-02T03:04:05Z") }));
  assert.equal(s.format, "tapis-vert/1");
  assert.equal(s.exporteLe, "2026-01-02T03:04:05.000Z");
  assert.equal(s.jeux[0].id, "g1");
  assert.equal(s.jeux[0].image, PIXEL);
  assert.equal(s.jeux[0].ajouteLe, 123);
  assert.deepEqual(new Jeux(s.jeux[0]).toDoc(), j.toDoc());
});

test("Jeux : date d'ajout facultative et validée", () => {
  assert.equal(new Jeux({ nom: "x" }).ajouteLe, undefined);
  assert.equal(new Jeux({ nom: "x", ajouteLe: "abc" }).ajouteLe, undefined);
  assert.equal(new Jeux({ nom: "x", ajouteLe: 5 }).ajouteLe, 5);
  assert.ok(!("ajouteLe" in new Jeux({ nom: "x" }).toDoc()), "absente du document si inconnue");
});

/* ---------- Administration des comptes ---------- */

const comptes = [
  { id: "celine@x.fr", prenom: "Céline", nom: "M", liens: [], acces: [] },
  { id: "leo@x.fr", prenom: "Léo", nom: "V", liens: [], acces: [] },
  { id: "roger@x.fr", prenom: "Roger", nom: "R", liens: ["rose@x.fr"], acces: [] },
  { id: "rose@x.fr", prenom: "Rose", nom: "R", liens: ["roger@x.fr"], acces: ["celine@x.fr"] },
];
// Applique un plan comme le ferait l'écriture groupée Firestore
const appliquerPlan = (users, plan) => users.map(u => ({ ...u, ...(plan[u.id] || {}) }));

test("admin : emails normalisés et validés, administrateur reconnu", () => {
  assert.equal(L.normaliserEmail("  Pro.Maxime@Gmail.com "), "pro.maxime@gmail.com");
  assert.ok(L.emailValide("a@b.fr"));
  assert.ok(!L.emailValide("a@b"));
  assert.ok(!L.emailValide("a/b@c.fr"));
  assert.ok(L.estAdmin("PRO.maxime.mons@gmail.com", "pro.maxime.mons@gmail.com"));
  assert.ok(!L.estAdmin("", "pro.maxime.mons@gmail.com"));
});

test("admin : lier deux comptes = même ludothèque, liens réciproques", () => {
  const plan = L.planLier("celine@x.fr", "leo@x.fr", comptes);
  assert.deepEqual(plan, { "celine@x.fr": { liens: ["leo@x.fr"] }, "leo@x.fr": { liens: ["celine@x.fr"] } });
  const apres = appliquerPlan(comptes, plan);
  const { famille } = L.construireGroupes("leo@x.fr", apres);
  assert.deepEqual(famille.emails, ["celine@x.fr", "leo@x.fr"]);
});

test("admin : lier à un foyer existant fusionne tout le foyer", () => {
  const plan = L.planLier("leo@x.fr", "roger@x.fr", comptes);
  const apres = appliquerPlan(comptes, plan);
  for (const e of ["leo@x.fr", "roger@x.fr", "rose@x.fr"]) {
    assert.deepEqual(L.foyerDe(e, apres), ["leo@x.fr", "roger@x.fr", "rose@x.fr"]);
  }
  assert.deepEqual(L.planLier("leo@x.fr", "rose@x.fr", apres), {}); // déjà liés : rien à écrire
});

test("admin : délier ne casse pas le reste du foyer", () => {
  const lie = appliquerPlan(comptes, L.planLier("leo@x.fr", "roger@x.fr", comptes));
  const apres = appliquerPlan(lie, L.planDelier("leo@x.fr", lie));
  assert.deepEqual(L.foyerDe("leo@x.fr", apres), ["leo@x.fr"]);
  assert.deepEqual(L.foyerDe("rose@x.fr", apres), ["roger@x.fr", "rose@x.fr"]);
});

test("admin : suppression retirée des liens et accès des autres", () => {
  const plan = L.planSuppression("roger@x.fr", comptes);
  assert.deepEqual(plan, { "rose@x.fr": { liens: [] } });
  const plan2 = L.planSuppression("celine@x.fr", comptes);
  assert.deepEqual(plan2, { "rose@x.fr": { acces: [] } });
});

test("admin : accès nettoyés (voit tout, foyer exclu, inconnus ignorés)", () => {
  assert.deepEqual(L.accesNettoyes("celine@x.fr", ["roger@x.fr"], true, comptes), ["*"]);
  assert.deepEqual(L.accesNettoyes("roger@x.fr", ["rose@x.fr", "celine@x.fr", "zz@x.fr", "celine@x.fr"], false, comptes), ["celine@x.fr"]);
  // Céline voit les jeux de Roger… et donc aussi ceux de Rose (même foyer)
  const u = appliquerPlan(comptes, { "celine@x.fr": { acces: ["roger@x.fr"] } });
  assert.deepEqual(L.construireGroupes("celine@x.fr", u).groupes.map(g => g.emails.join(",")), ["roger@x.fr,rose@x.fr"]);
});
