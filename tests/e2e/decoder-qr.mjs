// Décode un QR code dans une image PNG : node decoder-qr.mjs fichier.png
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const jsQR = require("jsqr");
const png = PNG.sync.read(readFileSync(process.argv[2]));
const r = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
process.stdout.write(JSON.stringify({ texte: r?.data ?? null, largeur: png.width, hauteur: png.height }));
