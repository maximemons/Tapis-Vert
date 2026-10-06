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
