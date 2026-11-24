# 🎲 Tapis-Vert

**Tapis-Vert** est une **ludothèque privée en ligne** développée en **HTML, CSS et JavaScript Vanilla**, utilisant **Firebase** pour l’authentification et la base de données.  
Le site permet de gérer une collection de **jeux de société personnels**, ainsi que ceux de la **famille et des amis**.

👉 Le projet est hébergé sur **GitHub Pages**.

---

## ✨ Fonctionnalités

- 🔐 **Authentification Firebase**
  - Connexion sécurisée des utilisateurs, par **email / mot de passe** ou avec un **compte Google**
  - Un compte Google n'a accès à la ludothèque que si son email est déclaré dans la collection `utilisateurs`
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
  - Bouton « Surprends-moi » dans la barre d'outils du haut (à côté d'« Ajouter un jeu » et « Wishlist ») : tire un jeu au sort parmi ceux affichés
  - Bouton flottant ↑ pour remonter en haut de la page, visible dès qu'on a fait défiler la page

- 🖼️ **Image de chaque jeu**
  - Par **lien** (collé ou trouvé par le remplissage automatique), par **fichier**, par **photo**
    (appareil photo du téléphone), en **collant** une image ou en la **glissant** sur la vignette
  - Les images importées sont réduites (800 px max) et compressées (WebP) sur l'appareil, puis enregistrées
    avec le jeu : pas besoin de Firebase Storage (offre payante), affichage hors ligne, présentes dans les liens de visualisation
  - « Garder une copie » : transforme l'image d'un lien en image enregistrée, qui survit à la disparition du site d'origine
  - Lien d'image mort : signalé dans le formulaire, et le dé 🎲 remplace l'image cassée sur la carte

- 🔎 **Recherche et tri**
  - Recherche par nom, sans tenir compte des accents ni des majuscules
  - Tri par nom, ajout récent, note ou durée ; recherche et tri sont conservés dans l'URL (favoris)

- 📴 **Hors ligne et résilience**
  - L'application s'installe (PWA) et s'ouvre sans réseau (service worker)
  - Les jeux s'affichent instantanément depuis l'appareil (cache Firestore persistant), puis se mettent à jour
    en temps réel, y compris les modifications des autres membres
  - Les modifications faites hors ligne sont conservées et envoyées automatiquement au retour du réseau
  - Aucune dépendance à un CDN tiers pour l'interface : Quill, DOMPurify et les icônes sont embarqués
  - Si l'éditeur de mise en forme ne se charge pas, un éditeur simple prend le relais
  - Si les jeux d'une personne sont inaccessibles, les autres s'affichent quand même

- 💾 **Sauvegarde**
  - Export complet en JSON (images comprises) ou en CSV lisible par Excel

- ⭐ **Wishlist**
  - Liste de jeux souhaités
  - Distinction claire entre jeux possédés et jeux désirés

- ✉️ **Emprunter un jeu**
  - Sur les jeux d'un autre propriétaire, un bouton « Emprunter » ouvre un email (lien `mailto:`) pré-rempli
    à destination du propriétaire, avec le nom du jeu ; les co-propriétaires du compte (personnes rattachées) sont mis en CC
  - Absent de la wishlist, des jeux déjà prêtés et de ses propres jeux (ou ceux de sa famille)
  - Aucun envoi côté serveur : c'est la messagerie de l'utilisateur qui s'ouvre

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

- 🛡️ **Gestion des comptes (administrateur)**
  - Bouton « Comptes » visible uniquement pour l'administrateur (`ADMIN` dans `scripts/records.js`)
  - Ajouter un compte : email, prénom, nom ; option « Créer un mot de passe » (la personne reçoit un email
    pour le choisir) ou connexion Google seule
  - Supprimer un compte : il ne peut plus se connecter et est retiré des autres comptes ; ses jeux sont conservés
  - **Ludothèque commune** (champ `liens`) : « Céline et Léo partagent la même ludothèque ».
    Les liens sont toujours réciproques ; associer quelqu'un à un foyer existant l'ajoute à tout le foyer
  - **Peut aussi voir les jeux de** (champ `acces`) : « Céline peut voir les jeux de Roger » (et de son foyer),
    en lecture et emprunt seulement ; ou « Toutes les ludothèques » (`*`)
  - Chaque modification est une écriture groupée Firestore : tout passe ou rien

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
├── sw.js                 Service worker : application disponible hors ligne
├── manifest.webmanifest  Installation (PWA) ; icons/ et favicon.ico
│
├── scripts/
│   ├── admin.js          Menu « Comptes » (administrateur uniquement, chargé à la demande)
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
│   ├── images.js         Import d'images (fichier, photo, lien) : réduction et compression
│   ├── editeur.js        Éditeur de description (Quill, chargé à la demande, avec repli)
│   ├── icones.js         Icônes SVG embarquées (Font Awesome Free, CC BY 4.0)
│   ├── pwa.js            Service worker et suivi du réseau
│   ├── vendor/           Bibliothèques embarquées : qrcode-generator 1.4.4 (MIT),
│   │                     Quill 2.0.3 (BSD-3), DOMPurify 3.4.17 (Apache-2.0 / MPL-2.0)
│   ├── dashboard.js      Tableau de bord
│   ├── partage.js        Vue lecture seule
│   └── index.js          Connexion
│
├── styles/
│   ├── common.css
│   ├── index.css
│   ├── dashboard.css     (aussi utilisé par partage.html)
│   └── vendor/quill-2.0.3.snow.css
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
   - Depuis la version 2, les règles **vérifient qui peut lire les jeux** (famille, champ `acces`, liens des
     personnes de `acces`) au lieu de laisser tout compte connecté tout lire, et **valident les jeux écrits**
     (champs autorisés, taille des images ≤ 400 000 caractères).
   - Les `liens` entre comptes doivent être **réciproques** (A lié à B et B lié à A), comme dans `construireGroupes()`.
   - Si les jeux d'une personne n'apparaissent plus après publication, le tableau de bord le signale
     (« n'ont pas pu être chargés ») : vérifiez son document `utilisateurs` et ses `liens`.
2. **Activer la connexion Google** (une seule fois) :
   - console Firebase > Authentication > « Sign-in method » > ajouter **Google** > activer > « Enregistrer » ;
   - Authentication > Paramètres > « Domaines autorisés » : ajouter `maximemons.github.io`
     (sans cela, la page affiche « Ce site n'est pas autorisé pour la connexion Google ») ;
   - pour chaque personne qui se connecte avec Google, créer dans Firestore le document
     `utilisateurs/<son adresse Gmail>` (mêmes champs que les autres : `prenom`, `nom`, `liens`…).
     Un compte Google absent de cette collection est refusé, par la page **et** par les règles.
   - ⚠ Si une personne a déjà un compte email / mot de passe **non vérifié** avec la même adresse Gmail,
     Firebase remplace son mot de passe par la connexion Google lors de sa première connexion Google.
3. **Menu « Comptes » (version 2.1)** :
   - les règles autorisent l'écriture dans `utilisateurs` au seul administrateur (`estAdmin()`), dont l'email
     doit être **vérifié** (toujours le cas avec une connexion Google) ;
   - ⚠ **tout** compte, y compris email / mot de passe, doit désormais avoir son document `utilisateurs` pour se
     connecter (avant, un compte mot de passe était toujours accepté). Vérifiez avant de publier que chaque
     personne a bien son document ;
   - pour créer des mots de passe depuis le site, la création de comptes doit rester autorisée :
     Authentication > Paramètres > « Actions des utilisateurs » > « Activer la création » cochée.
     Sans risque : un compte créé par un inconnu n'a pas de document `utilisateurs` et ne voit rien ;
   - supprimer un compte depuis le site efface son document (accès coupé) mais pas son identifiant dans
     Firebase Authentication : on peut le supprimer à la main dans la console si on le souhaite ;
   - changer d'administrateur : modifier `ADMIN` dans `scripts/records.js` **et** `estAdmin()` dans `firestore.rules`.
4. Pousser sur la branche servie par GitHub Pages.
5. À **chaque mise en ligne**, incrémenter `VERSION` dans `sw.js` : les appareils récupèrent alors la nouvelle version.
   (Les fichiers du site passent toujours par le réseau d'abord : la copie locale ne sert que sans réseau.)

Aucun index composite n'est nécessaire.

---

## 🧪 Tests

```bash
npm test                                   # tests unitaires (Node 20+)
npm install --no-save jsqr@1.4.0 pngjs@7.0.0   # prérequis (décodage des QR codes)
pip install playwright pillow && playwright install chromium
python3 tests/e2e/e2e.py                   # 114 vérifications de bout en bout
CHROMIUM=/chemin/vers/chromium python3 tests/e2e/e2e.py   # avec un Chromium déjà installé
```
