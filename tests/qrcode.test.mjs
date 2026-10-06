// Vérifie que les QR codes produits se décodent réellement vers le bon lien.
// Prérequis : npm install --no-save jsqr@1.4.0
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { matriceQr, cheminQr } from "../scripts/qrcode.js";

const require = createRequire(import.meta.url);
// Chargé comme un <script> classique, exactement comme dans le navigateur
const contexte = {};
vm.runInNewContext(readFileSync(new URL("../scripts/vendor/qrcode-generator-1.4.4.js", import.meta.url), "utf8"), contexte);
const moteur = contexte.qrcode;
let jsQR = null;
try { jsQR = require("jsqr"); } catch { /* décodage ignoré si jsqr absent */ }

function pixels(m, marge = 4, echelle = 4) {
  const cote = (m.taille + 2 * marge) * echelle;
  const data = new Uint8ClampedArray(cote * cote * 4).fill(255);
  for (let l = 0; l < m.taille; l++) for (let c = 0; c < m.taille; c++) {
    if (!m.sombre(l, c)) continue;
    for (let y = 0; y < echelle; y++) for (let x = 0; x < echelle; x++) {
      const i = (((l + marge) * echelle + y) * cote + (c + marge) * echelle + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { data, cote };
}

const LIEN = "https://maximemons.github.io/Tapis-Vert/partage.html#r7ja_wAHti6SFvsYeuzRY6AvrH_mQ2x-";

test("le QR code se décode vers le lien exact", { skip: !jsQR && "jsqr non installé" }, () => {
  const { data, cote } = pixels(matriceQr(LIEN, moteur));
  const lu = jsQR(data, cote, cote);
  assert.equal(lu?.data, LIEN);
});

test("taille adaptée à un lien de partage (lisible sur téléphone)", () => {
  const m = matriceQr(LIEN, moteur);
  assert.ok(m.taille >= 21 && m.taille <= 49, `taille ${m.taille}`);
});

test("chemin SVG : marge blanche et un carré par module sombre", () => {
  const m = matriceQr("abc", moteur);
  const { d, cote } = cheminQr(m);
  assert.equal(cote, m.taille + 8);
  let sombres = 0;
  for (let l = 0; l < m.taille; l++) for (let c = 0; c < m.taille; c++) if (m.sombre(l, c)) sombres++;
  assert.equal((d.match(/M/g) || []).length, sombres);
  assert.ok(d.startsWith("M4 4"), "le coin du motif de repérage est décalé de la marge");
});

test("erreur explicite si le moteur n'est pas chargé", () => {
  assert.throws(() => matriceQr("x", undefined), /non chargé/);
});
