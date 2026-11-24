import { test } from "node:test";
import assert from "node:assert/strict";
import * as W from "../scripts/wikidata.js";
import { fauxFetch } from "./fixtures/wikimedia.mjs";

test("rechercherJeux : ne garde que les jeux", async () => {
  const journal = [];
  const r = await W.rechercherJeux("azul", { fetchImpl: fauxFetch(journal) });
  assert.deepEqual(r.map(x => x.id), ["Q1", "Q3"], "la couleur Q2 est exclue");
  assert.equal(r[0].description, "jeu de société de Michael Kiesling");
  assert.ok(journal.every(u => u.includes("origin=*")), "CORS anonyme");
});

test("rechercherJeux : texte trop court = aucune requête", async () => {
  const journal = [];
  assert.deepEqual(await W.rechercherJeux("a", { fetchImpl: fauxFetch(journal) }), []);
  assert.equal(journal.length, 0);
});

test("recupererFiche : jeu complet", async () => {
  const f = await W.recupererFiche("Q1", { fetchImpl: fauxFetch() });
  assert.deepEqual(f.joueurs, [2, 4]);
  assert.deepEqual(f.duree, [30, 45], "valeur dépréciée ignorée");
  assert.equal(f.ageMinimal, 8);
  assert.deepEqual(f.styles.sort(), ["DRAFT", "FAMILIAL", "TUILES"]);
  assert.equal(f.estExtension, false);
  assert.equal(f.image, "https://upload.wikimedia.org/azul-box.jpg", "repli sur l'image Wikipédia EN");
  assert.ok(f.description.includes("&lt;abstrait&gt;"), "texte échappé");
  assert.ok(f.description.includes("fr.wikipedia.org/wiki/Azul_(jeu)") && f.description.includes("boardgamegeek.com/boardgame/230802"), "sources citées");
});

test("recupererFiche : extension, heures, solo, image Commons, sans Wikipédia", async () => {
  const f = await W.recupererFiche("Q3", { fetchImpl: fauxFetch() });
  assert.equal(f.estExtension, true);
  assert.deepEqual(f.duree, [60]);
  assert.ok(f.styles.includes("SOLO"));
  assert.equal(f.image, "https://commons.wikimedia.org/wiki/Special:FilePath/Azul_summer_pavilion.jpg?width=640");
  assert.equal(f.description, "", "identifiant BGG invalide ignoré, rien à citer");
});

test("recupererFiche : élément inexistant", async () => {
  await assert.rejects(W.recupererFiche("Q999", { fetchImpl: fauxFetch() }), /introuvable/);
});

test("deduireStyles", () => {
  assert.deepEqual(W.deduireStyles(["Social deduction game", "déduction"]), ["DEDUCTION_SOCIALE", "DEDUCTION"]);
  assert.deepEqual(W.deduireStyles(["jeu coopératif"], [2, 2]), ["COOPERATIF", "DUEL"]);
  assert.deepEqual(W.deduireStyles(["Worker Placement", "inconnu"]), ["PLACEMENT_OUVRIERS"]);
});

test("recherche en français : jeu sans nom français sur Wikidata, trouvé via Wikipédia FR", async () => {
  const r = await W.rechercherJeux("aventuriers du", { fetchImpl: fauxFetch() });
  assert.deepEqual(r.map(x => x.id), ["Q4"], "le film homonyme est exclu");
  assert.equal(r[0].nom, "Les Aventuriers du rail", "nom français affiché");
  assert.ok(r[0].description.includes("VO : Ticket to Ride"), "nom d'origine rappelé");
});

test("recherche : mots dans le désordre ou au milieu du titre", async () => {
  const r = await W.rechercherJeux("rail aventuriers", { fetchImpl: fauxFetch() });
  assert.deepEqual(r.map(x => x.id), ["Q4"]);
});

test("recherche : nom d'une autre langue (alias allemand)", async () => {
  const r = await W.rechercherJeux("Zug um Zug", { fetchImpl: fauxFetch() });
  assert.equal(r[0]?.nom, "Les Aventuriers du rail");
});

test("recherche : pas de doublon quand plusieurs sources trouvent le même jeu", async () => {
  const r = await W.rechercherJeux("Azul", { fetchImpl: fauxFetch() });
  assert.deepEqual(r.map(x => x.id), ["Q1", "Q3"]);
});

test("recherche : Wikipédia en panne, Wikidata répond quand même", async () => {
  const r = await W.rechercherJeux("Azul", { fetchImpl: fauxFetch([], { enPanne: ["wikipedia.org"] }) });
  assert.deepEqual(r.map(x => x.id), ["Q1", "Q3"]);
});

test("recherche : toutes les sources en panne = erreur remontée", async () => {
  await assert.rejects(W.rechercherJeux("Azul", { fetchImpl: fauxFetch([], { enPanne: ["wikipedia.org", "wikidata.org"] }) }));
});

test("fiche : titre français repris de Wikipédia si Wikidata n'a que l'anglais", async () => {
  const f = await W.recupererFiche("Q4", { fetchImpl: fauxFetch() });
  assert.equal(f.nom, "Les Aventuriers du rail");
  assert.deepEqual(f.joueurs, [2, 5]);
});

test("titreSansPrecision", () => {
  assert.equal(W.titreSansPrecision("Azul (jeu)"), "Azul");
  assert.equal(W.titreSansPrecision("7 Wonders"), "7 Wonders");
});
