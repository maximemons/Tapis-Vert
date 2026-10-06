# 🎲 Tapis-Vert

**Tapis-Vert** est une **ludothèque privée en ligne** développée en **HTML, CSS et JavaScript Vanilla**, utilisant **Firebase** pour l’authentification et la base de données.  
Le site permet de gérer une collection de **jeux de société personnels**, ainsi que ceux de la **famille et des amis**.

👉 Le projet est hébergé sur **GitHub Pages**.

---

## ✨ Fonctionnalités

- 🔐 **Authentification Firebase**
  - Connexion sécurisée des utilisateurs
  - Accès personnalisé à la ludothèque

- 🎲 **Gestion des jeux de société**
  - Ajout, modification et suppression de jeux
  - Gestion des informations principales (joueurs, durée, type, etc.)
  - **Remplissage automatique** : en tapant le nom, une liste de jeux est proposée ; en choisir un remplit
    joueurs, durée, âge, image, styles, extension et description (avec sources), sans écraser les champs déjà saisis

- 👨‍👩‍👧‍👦 **Ludothèque partagée**
  - Jeux personnels, familiaux ou appartenant à des amis
  - Filtrage par propriétaire

- 🔍 **Recherche & filtres**
  - Recherche rapide par nom
  - Filtres pour naviguer facilement dans la collection

- ⭐ **Wishlist**
  - Liste de jeux souhaités
  - Distinction claire entre jeux possédés et jeux désirés

- 🔄 **Gestion des prêts**
  - Suivi des jeux prêtés
  - Vision rapide des jeux actuellement indisponibles

- 🔗 **Liens de visualisation (lecture seule)**
  - Créés à la demande depuis le tableau de bord (bouton de partage)
  - Consultables sans compte, sans aucune possibilité de modification
  - Un lien par destinataire (« Mamie », « Collègues »…), avec expiration optionnelle et wishlist au choix
  - Liste des liens existants, révocables à tout moment (effet immédiat)
  - QR code par lien, affiché à l'écran et téléchargeable en image (avec le titre) pour l'imprimer ou l'envoyer
  - Diagnostic intégré : si Firebase refuse l'accès, la fenêtre explique pourquoi et comment corriger
  - Données personnelles exclues : emails, nom des emprunteurs, emplacement, date d'achat

---

## 🛠️ Technologies utilisées

- **HTML5**
- **CSS3**
- **JavaScript Vanilla**
- **Firebase**
  - Authentication
  - Firestore Database
- **GitHub Pages** (hébergement)

---

## 📁 Structure du projet

```txt
/
├── index.html            Connexion
├── dashboard.html        Tableau de bord (édition)
├── partage.html          Vue publique en lecture seule (partage.html#<jeton>)
├── 404.html / 404.jpg
├── firestore.rules       Règles de sécurité (à déployer !)
│
├── scripts/
│   ├── firebase-app.js   Initialisation Firebase
│   ├── firebase-auth.js  Authentification
│   ├── firebase-db.js    Accès Firestore
│   ├── records.js        Modèle de données et constantes
│   ├── logic.js          Logique métier pure (filtres, groupes, projection des partages)
│   ├── ui.js             Composants partagés (cartes, fiche, filtres, dialogues)
│   ├── partages.js       Création, synchronisation et révocation des liens
│   ├── wikidata.js       Récupération des infos d'un jeu (Wikidata + Wikipédia)
│   ├── saisie-auto.js    Autocomplétion du titre dans le formulaire
│   ├── qrcode.js         QR codes des liens (SVG à l'écran, PNG à télécharger)
│   └── vendor/qrcode-generator-1.4.4.js   Moteur QR code (MIT, Kazuhiko Arase)
│   ├── dashboard.js      Tableau de bord
│   ├── partage.js        Vue lecture seule
│   └── index.js          Connexion
│
├── styles/
│   ├── common.css
│   ├── index.css
│   └── dashboard.css     (aussi utilisé par partage.html)
│
└── tests/
    ├── logic.test.mjs    Tests unitaires (node --test)
    └── e2e/              Tests de bout en bout (Playwright + faux Firestore)
```

---

## 🔗 Fonctionnement des liens de visualisation

| Collection | Visibilité | Contenu |
|---|---|---|
| `partagesPrives/{jeton}` | Propriétaires uniquement | propriétaires, créateur, libellé, titre, options, dates |
| `partages/{jeton}` | Quiconque connaît le jeton | titre, wishlist incluse, expiration, date de mise à jour |
| `partages/{jeton}/jeux/{id}` | Quiconque connaît le jeton | copie épurée des jeux |

- Le jeton fait 192 bits aléatoires et n'apparaît que dans le fragment `#` de l'URL, jamais transmis au serveur.
- La copie publique est resynchronisée automatiquement après chaque modification et à chaque ouverture du tableau de bord (seules les différences sont écrites).
- **Révoquer** supprime le document public (accès coupé immédiatement par les règles), puis la copie et la partie privée.
- Un lien expiré est refusé par les règles Firestore elles-mêmes, pas seulement par l'interface.

---

## 🪄 Remplissage automatique

Sources : **Wikidata** (joueurs, durée, âge minimal, image, genres et mécaniques, extension, identifiant BoardGameGeek)
et **Wikipédia** (résumé en français, image de repli). Gratuites, sans clé, appelées directement depuis le navigateur.

- La recherche fonctionne en français : elle interroge en parallèle Wikipédia FR (titres et redirections,
  y compris mots dans le désordre) et Wikidata (noms français, puis noms et alias de toutes les langues).
  Le nom français est privilégié, le nom d'origine est rappelé dans la liste (« VO : Ticket to Ride »).
- Seuls les champs vides sont remplis ; les champs remplis sont surlignés et l'opération peut être annulée.
- Les genres et mécaniques Wikidata sont traduits en styles de l'application par mots-clés (`REGLES_STYLES` dans `wikidata.js`).
- La difficulté et la vidéo ne sont pas disponibles dans ces sources.
- Les résumés Wikipédia sont sous licence CC BY-SA : la description générée cite toujours sa source.
- BoardGameGeek n'est pas interrogé directement : son API exige depuis 2025 un jeton d'application, qui serait public dans ce site sans serveur.
- La couverture dépend de Wikidata : très bonne pour les jeux connus, partielle pour les jeux récents ou confidentiels.

---

## 🚀 Mise en production

1. **Publier les règles** `firestore.rules` dans Firebase. ⚠ Pousser le fichier sur GitHub ne suffit pas :
   console Firebase > Firestore Database > onglet « Règles » > remplacer tout le contenu > « Publier »
   (ou `firebase deploy --only firestore:rules`). Sans cette étape, la création de liens est refusée ;
   la fenêtre des liens l'indique et propose un bouton « Revérifier » une fois les règles publiées.
2. Pousser sur la branche servie par GitHub Pages.

Aucun index composite n'est nécessaire.

---

## 🧪 Tests

```bash
npm test                                   # tests unitaires (Node 20+)
npm install --no-save dompurify@3.1.6 jsqr@1.4.0 pngjs@7.0.0   # prérequis (décodage des QR codes)
pip install playwright && playwright install chromium
python3 tests/e2e/e2e.py                   # 80 vérifications de bout en bout
```
