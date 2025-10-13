import { getDocumentById, getAllDocuments, getDocumentsWithWhere, deleteDocument, setDocument } from './firebase-db.js';
import { getCurrentUser, logout } from './firebase-auth.js';
import { Utilisateurs, Jeux, COLLECTIONS, DIFFICULTE, STYLES } from './records.js';
import Quill from 'https://esm.sh/quill@1.3.7';

const url = new URL(window.location.href);
/*  FILTERS  */
let stylesList = [];
let joueursList = [];
let difficulteList = [];
let proprios = [];

//EditMode
let editMode = false;

let quill;

let nbGames = 0;
let displayedGame = [];
let me = "";

const maximeCatteau = [
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "6 qui prend !",
        "joueurs": [2, 10],
        "duree": [30, 45],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "LOGIQUE", "PLI"],
        "estExtension": false,
        "description": "<p><em>6 qui prend !</em> est un jeu de cartes malicieux où les joueurs doivent poser leurs cartes dans l'ordre croissant sur 4 lignes, en évitant de récupérer des têtes de bœuf.</p><p><u>Objectif :</u> Avoir le moins de points à la fin de la partie.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Azul",
        "joueurs": [2, 4],
        "duree": [30, 45],
        "difficulte": "NIVEAU2",
        "styles": ["ABSTRAIT", "FAMILIAL", "DRAFT"],
        "estExtension": false,
        "description": "<p><em>Azul</em> est un jeu de placement de tuiles où les joueurs doivent décorer un palais en choisissant judicieusement les motifs de carreaux.</p><p><u>Objectif :</u> Créer le plus beau motif et marquer le plus de points.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Concept",
        "joueurs": [4, 12],
        "duree": [40],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Concept</em> est un jeu coopératif où les joueurs doivent faire deviner des mots ou des expressions en utilisant des icônes sur un plateau.</p><p><u>Objectif :</u> Faire deviner le plus de concepts possible.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Cortex Challenge",
        "joueurs": [2, 6],
        "duree": [15, 30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "OBSERVATION", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>Cortex Challenge</em> est un jeu de défis cérébraux où les joueurs s'affrontent sur des épreuves de mémoire, rapidité et logique.</p><p><u>Objectif :</u> Être le premier à remporter 4 défis.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Dixit",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Dixit</em> est un jeu d'imagination et de devinettes où les joueurs inventent des indices pour faire deviner des illustrations oniriques.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner sa carte sans être trop évident.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Echecs",
        "joueurs": [2],
        "duree": [10, 180],
        "difficulte": "NIVEAU4",
        "styles": ["ABSTRAIT", "DUEL", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>Échecs</em> est un jeu de stratégie pur où deux joueurs s'affrontent sur un plateau de 64 cases, chacun avec 16 pièces.</p><p><u>Objectif :</u> Mettre le roi adverse en échec et mat.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Fantasy",
        "joueurs": [2, 4],
        "duree": [30, 60],
        "difficulte": "NIVEAU3",
        "styles": ["CONQUETE", "DEVELOPPEMENT", "GESTION"],
        "estExtension": false,
        "description": "<p><em>Fantasy</em> est un jeu de stratégie où les joueurs développent leur royaume, recrutent des héros et affrontent leurs adversaires dans un univers fantastique.</p><p><u>Objectif :</u> Construire le royaume le plus puissant.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "King of Tokyo",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "DES", "COMBAT"],
        "estExtension": false,
        "description": "<p><em>King of Tokyo</em> est un jeu de dés où les joueurs incarnent des monstres géants s'affrontant pour dominer Tokyo.</p><p><u>Objectif :</u> Être le dernier monstre debout ou accumuler 20 points de victoire.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Les Aventuriers du Rail",
        "joueurs": [2, 5],
        "duree": [30, 60],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "ALIGNEMENT", "GESTION"],
        "estExtension": false,
        "description": "<p><em>Les Aventuriers du Rail</em> est un jeu de stratégie où les joueurs construisent des lignes de chemin de fer pour relier des villes à travers le monde.</p><p><u>Objectif :</u> Compléter le plus de missions secrètes et marquer le plus de points.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Papayoo",
        "joueurs": [2, 6],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "OBSERVATION", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Papayoo</em> est un jeu d'observation et de rapidité où les joueurs doivent repérer des paires de cartes identiques.</p><p><u>Objectif :</u> Être le plus rapide à trouver les paires et marquer le plus de points.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Shit Happens (50 Nuances de Shit)",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Shit Happens</em> est un jeu d'ambiance où les joueurs doivent classer des événements embarrassants ou drôles par ordre de gravité.</p><p><u>Objectif :</u> Faire rire et marquer le plus de points en devinant l'ordre des événements.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Skull King",
        "joueurs": [2, 8],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["PLI", "BLUFF", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Skull King</em> est un jeu de plis où les joueurs doivent prédire combien de plis ils vont remporter, tout en essayant de deviner les annonces des autres.</p><p><u>Objectif :</u> Marquer le plus de points en réussissant ses annonces.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "Splendor",
        "joueurs": [2, 4],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "GESTION", "DEVELOPPEMENT"],
        "estExtension": false,
        "description": "<p><em>Splendor</em> est un jeu de stratégie où les joueurs incarnent des marchands de la Renaissance, collectionnant des gemmes pour acheter des cartes et attirer l'attention des nobles.</p><p><u>Objectif :</u> Accumuler le plus de points de prestige.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "The Crew",
        "joueurs": [2, 5],
        "duree": [20],
        "difficulte": "NIVEAU3",
        "styles": ["COOPERATIF", "PLI", "ENIGME"],
        "estExtension": false,
        "description": "<p><em>The Crew</em> est un jeu coopératif de plis où les joueurs doivent remplir des missions en communiquant avec un langage limité.</p><p><u>Objectif :</u> Réussir toutes les missions ensemble.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "The Crew - Mission sous-marine",
        "joueurs": [2, 5],
        "duree": [20],
        "difficulte": "NIVEAU3",
        "styles": ["COOPERATIF", "PLI", "ENIGME"],
        "estExtension": true,
        "description": "<p><em>The Crew - Mission sous-marine</em> est une extension du jeu The Crew, proposant de nouvelles missions et défis sous-marins.</p><p><u>Objectif :</u> Réussir les nouvelles missions en équipe.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "maxime.catteau13@gmail.com",
        "nom": "The Gang",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["BLUFF", "DEDUCATION_SOCIALE", "PARTY"],
        "estExtension": false,
        "description": "<p><em>The Gang</em> est un jeu de bluff et de déduction où les joueurs doivent deviner qui ment et qui dit la vérité.</p><p><u>Objectif :</u> Être le dernier joueur en jeu ou marquer le plus de points.</p>",
        "ageMinimal": "10"
    }
];

const guillaumeMons = [
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Apéro clash ! Pour lancer la discussion",
        "joueurs": [3, 10],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "AMBIANCE"],
        "estExtension": false,
        "description": "<p><em>Apéro clash !</em> est un jeu d'ambiance idéal pour lancer des discussions et des débats entre amis autour de questions décalées.</p><p><u>Objectif :</u> Faire réagir et s'amuser en groupe.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Trash - N'y joue pas avec ta mère",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Trash</em> est un jeu d'ambiance où les joueurs doivent deviner des mots ou expressions à partir d'indices souvent décalés ou osés.</p><p><u>Objectif :</u> Faire rire et marquer le plus de points.</p>",
        "ageMinimal": "18"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Apocalypse le Défi de la Grande Guerre",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU3",
        "styles": ["COOPERATIF", "NARRATIF", "GESTION"],
        "estExtension": false,
        "description": "<p><em>Apocalypse</em> est un jeu coopératif où les joueurs doivent survivre à la Première Guerre mondiale en gérant ressources et stratégies.</p><p><u>Objectif :</u> Surmonter les défis ensemble et gagner la guerre.</p>",
        "ageMinimal": "14"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Blanc Manger Coco",
        "joueurs": [4, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Blanc Manger Coco</em> est un jeu d'ambiance où les joueurs doivent faire deviner des mots à l'aide de cartes illustrées, souvent avec humour.</p><p><u>Objectif :</u> Faire deviner le plus de mots possible.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Burger Quiz",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "CULTURE_G", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Burger Quiz</em> est un jeu de quiz décalé inspiré de l'émission culte, avec des questions variées et des défis rigolos.</p><p><u>Objectif :</u> Répondre correctement et s'amuser en équipe.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Cluedo",
        "joueurs": [2, 6],
        "duree": [45],
        "difficulte": "NIVEAU2",
        "styles": ["ENQUETE", "DEDUCTION", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Cluedo</em> est un jeu d'enquête où les joueurs doivent découvrir qui a commis un meurtre, avec quelle arme et dans quelle pièce.</p><p><u>Objectif :</u> Résoudre l'énigme en premier.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Concept",
        "joueurs": [4, 12],
        "duree": [40],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Concept</em> est un jeu coopératif où les joueurs doivent faire deviner des mots ou des expressions en utilisant des icônes sur un plateau.</p><p><u>Objectif :</u> Faire deviner le plus de concepts possible.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Contrario",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Contrario</em> est un jeu d'ambiance où les joueurs doivent trouver des réponses originales et inattendues à des questions posées.</p><p><u>Objectif :</u> Marquer le plus de points en étant le plus créatif.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Death Note Le Jeu d'Enquête",
        "joueurs": [3, 6],
        "duree": [60],
        "difficulte": "NIVEAU3",
        "styles": ["ENQUETE", "DEDUCTION", "NARRATIF"],
        "estExtension": false,
        "description": "<p><em>Death Note Le Jeu d'Enquête</em> est un jeu narratif où les joueurs incarnent des enquêteurs cherchant à démasquer Kira.</p><p><u>Objectif :</u> Résoudre l'enquête avant la fin de la partie.</p>",
        "ageMinimal": "14"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Dixit",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Dixit</em> est un jeu d'imagination et de devinettes où les joueurs inventent des indices pour faire deviner des illustrations oniriques.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner sa carte sans être trop évident.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "E-Penser - Le Jeu",
        "joueurs": [2, 6],
        "duree": [45],
        "difficulte": "NIVEAU2",
        "styles": ["ENIGME", "LOGIQUE", "CULTURE_G"],
        "estExtension": false,
        "description": "<p><em>E-Penser</em> est un jeu de réflexion et de culture générale inspiré de la chaîne YouTube du même nom.</p><p><u>Objectif :</u> Résoudre des énigmes et répondre à des questions pour marquer des points.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Exploding Kittens",
        "joueurs": [2, 5],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "STRATEGIQUE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Exploding Kittens</em> est un jeu de cartes où les joueurs doivent éviter de piquer un chat explosif.</p><p><u>Objectif :</u> Être le dernier joueur en vie.</p>",
        "ageMinimal": "7"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Hitster Music Bingo",
        "joueurs": [2, 20],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "MUSIQUE", "AMBIANCE"],
        "estExtension": false,
        "description": "<p><em>Hitster Music Bingo</em> est un jeu musical où les joueurs doivent reconnaître des extraits de chansons pour remplir leur grille de bingo.</p><p><u>Objectif :</u> Compléter sa grille en premier.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "iKnow",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "CULTURE_G", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>iKnow</em> est un jeu de quiz où les joueurs doivent deviner les réponses les plus populaires à des questions variées.</p><p><u>Objectif :</u> Marquer le plus de points en devinant les réponses majoritaires.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Jeu De Loto",
        "joueurs": [2, 10],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "CHANCE", "AMBIANCE"],
        "estExtension": false,
        "description": "<p><em>Jeu De Loto</em> est un classique où les joueurs tirent des numéros au hasard et les placent sur leur grille.</p><p><u>Objectif :</u> Compléter sa grille en premier.</p>",
        "ageMinimal": "5"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Le Tribunal",
        "joueurs": [4, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Le Tribunal</em> est un jeu d'ambiance où les joueurs doivent plaider pour ou contre des situations absurdes.</p><p><u>Objectif :</u> Convaincre le tribunal et marquer des points.</p>",
        "ageMinimal": "14"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Les Aventuriers du Rail - Europe",
        "joueurs": [2, 5],
        "duree": [45],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "ALIGNEMENT", "GESTION"],
        "estExtension": true,
        "description": "<p><em>Les Aventuriers du Rail - Europe</em> est une extension du célèbre jeu de construction de lignes ferroviaires, avec de nouvelles cartes et stratégies.</p><p><u>Objectif :</u> Compléter le plus de missions secrètes et marquer le plus de points.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Limite Limite - La Totale",
        "joueurs": [4, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Limite Limite - La Totale</em> est un jeu d'ambiance où les joueurs doivent faire deviner des mots en utilisant des indices, mais sans dépasser certaines limites.</p><p><u>Objectif :</u> Faire deviner le plus de mots possible.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Limite Limite Limite",
        "joueurs": [4, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Limite Limite Limite</em> est une version encore plus déjantée du jeu Limite Limite, avec des mots et des situations toujours plus fous.</p><p><u>Objectif :</u> Faire rire et marquer le plus de points.</p>",
        "ageMinimal": "18"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Little Secret",
        "joueurs": [4, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Little Secret</em> est un jeu d'ambiance où les joueurs doivent deviner les secrets des autres en posant des questions.</p><p><u>Objectif :</u> Découvrir le plus de secrets possible.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Loups-Garous de Thiercelieux Best Of",
        "joueurs": [8, 20],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "NARRATIF"],
        "estExtension": false,
        "description": "<p><em>Loups-Garous de Thiercelieux Best Of</em> est un jeu de rôle et de déduction où les joueurs incarnent des villageois ou des loups-garous.</p><p><u>Objectif :</u> Survivre ou éliminer l'équipe adverse selon son rôle.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Monopoly Game Of Thrones",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "GESTION", "THEMATIQUE"],
        "estExtension": false,
        "description": "<p><em>Monopoly Game Of Thrones</em> est une version thématique du Monopoly, inspirée de l'univers de Game of Thrones.</p><p><u>Objectif :</u> Devenir le joueur le plus riche en achetant et en développant des propriétés.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Monopoly Super Electronique",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "GESTION", "ELECTRONIQUE"],
        "estExtension": false,
        "description": "<p><em>Monopoly Super Electronique</em> est une version moderne du Monopoly, avec une tour électronique pour gérer les transactions.</p><p><u>Objectif :</u> Être le dernier joueur en jeu et posséder le plus de richesses.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Oriflamme",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU3",
        "styles": ["BLUFF", "DEDUCATION_SOCIALE", "STRATEGIQUE"],
        "estExtension": false,
        "description": "<p><em>Oriflamme</em> est un jeu de bluff et de déduction où les joueurs incarnent des familles nobles cherchant à influencer le roi.</p><p><u>Objectif :</u> Être la famille la plus influente à la fin de la partie.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Pigeon Pigeon",
        "joueurs": [3, 8],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "OBSERVATION", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Pigeon Pigeon</em> est un jeu d'observation et de rapidité où les joueurs doivent repérer des pigeons identiques sur des cartes.</p><p><u>Objectif :</u> Être le plus rapide à trouver les pigeons et marquer des points.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Puissance 4",
        "joueurs": [2],
        "duree": [10],
        "difficulte": "NIVEAU1",
        "styles": ["ABSTRAIT", "LOGIQUE", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Puissance 4</em> est un jeu de stratégie pure où les joueurs doivent aligner 4 jetons de leur couleur.</p><p><u>Objectif :</u> Aligner 4 jetons avant son adversaire.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Risk",
        "joueurs": [2, 6],
        "duree": [60, 180],
        "difficulte": "NIVEAU3",
        "styles": ["CONQUETE", "STRATEGIQUE", "GESTION"],
        "estExtension": false,
        "description": "<p><em>Risk</em> est un jeu de conquête où les joueurs doivent dominer le monde en attaquant et défendant des territoires.</p><p><u>Objectif :</u> Éliminer tous les adversaires ou accomplir des missions secrètes.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Secret Hitler",
        "joueurs": [5, 10],
        "duree": [45],
        "difficulte": "NIVEAU2",
        "styles": ["DEDUCATION_SOCIALE", "NARRATIF", "PARTY"],
        "estExtension": false,
        "description": "<p><em>Secret Hitler</em> est un jeu de déduction sociale où les joueurs doivent démasquer Hitler avant qu'il ne prenne le pouvoir.</p><p><u>Objectif :</u> Empêcher Hitler de gagner ou l'aider à prendre le contrôle selon son rôle.</p>",
        "ageMinimal": "13"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Simon",
        "joueurs": [1],
        "duree": [10],
        "difficulte": "NIVEAU1",
        "styles": ["OBSERVATION", "MEMOIRE", "ELECTRONIQUE"],
        "estExtension": false,
        "description": "<p><em>Simon</em> est un jeu électronique de mémoire où le joueur doit répéter des séquences de sons et de lumières de plus en plus longues.</p><p><u>Objectif :</u> Répéter la séquence la plus longue possible.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Skyjo",
        "joueurs": [2, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "GESTION", "CARTES"],
        "estExtension": false,
        "description": "<p><em>Skyjo</em> est un jeu de cartes où les joueurs doivent collecter le moins de points possible en retournant ou échangeant des cartes.</p><p><u>Objectif :</u> Avoir le moins de points à la fin de la partie.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Speed Bac",
        "joueurs": [2, 6],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "RAPIDITE", "CULTURE_G"],
        "estExtension": false,
        "description": "<p><em>Speed Bac</em> est un jeu de rapidité où les joueurs doivent trouver des mots correspondant à une catégorie avant les autres.</p><p><u>Objectif :</u> Être le plus rapide et marquer le plus de points.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "T'imagines Si ...",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "NARRATIF", "CREATIVITE"],
        "estExtension": false,
        "description": "<p><em>T'imagines Si ...</em> est un jeu d'imagination où les joueurs doivent inventer des histoires à partir de situations improbables.</p><p><u>Objectif :</u> Faire rire et marquer le plus de points.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Ta Mère En Slip",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Ta Mère En Slip</em> est un jeu d'ambiance où les joueurs doivent faire deviner des expressions populaires ou vulgaires.</p><p><u>Objectif :</u> Faire deviner le plus d'expressions possible.</p>",
        "ageMinimal": "18"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Ta Mère En Slip 2",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Ta Mère En Slip 2</em> est la suite du jeu d'ambiance où les joueurs doivent faire deviner des expressions toujours plus décalées.</p><p><u>Objectif :</u> Faire rire et marquer le plus de points.</p>",
        "ageMinimal": "18"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "That's Not a Hat",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>That's Not a Hat</em> est un jeu d'ambiance où les joueurs doivent faire deviner des objets ou des situations absurdes.</p><p><u>Objectif :</u> Faire deviner le plus d'objets possible.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Time Up Party",
        "joueurs": [4, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Time Up Party</em> est un jeu d'ambiance où les joueurs doivent faire deviner des mots en un temps limité, avec des contraintes de plus en plus difficiles.</p><p><u>Objectif :</u> Faire deviner le plus de mots possible en équipe.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Trivial Pursuit - Classic Edition",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["CULTURE_G", "FAMILIAL", "ENIGME"],
        "estExtension": false,
        "description": "<p><em>Trivial Pursuit - Classic Edition</em> est un jeu de quiz où les joueurs doivent répondre à des questions de culture générale pour remplir leur camembert.</p><p><u>Objectif :</u> Remplir son camembert en premier.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Trivial Pursuit - Décennie 2010-2020",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["CULTURE_G", "FAMILIAL", "ENIGME"],
        "estExtension": false,
        "description": "<p><em>Trivial Pursuit - Décennie 2010-2020</em> est une édition spécialisée sur les années 2010-2020, avec des questions d'actualité et de culture générale.</p><p><u>Objectif :</u> Remplir son camembert en premier.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Trivial Pursuit - Histoire de France",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU3",
        "styles": ["CULTURE_G", "HISTOIRE", "ENIGME"],
        "estExtension": false,
        "description": "<p><em>Trivial Pursuit - Histoire de France</em> est une édition centrée sur l'histoire de France, avec des questions variées et pointues.</p><p><u>Objectif :</u> Remplir son camembert en premier.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Trou Noir",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Trou Noir</em> est un jeu d'ambiance où les joueurs doivent éviter de se faire aspirer par un trou noir en répondant à des questions décalées.</p><p><u>Objectif :</u> Survivre le plus longtemps possible.</p>",
        "ageMinimal": "14"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Twister",
        "joueurs": [2, 4],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "PHYSIQUE", "AMBIANCE"],
        "estExtension": false,
        "description": "<p><em>Twister</em> est un jeu physique où les joueurs doivent placer leurs mains et leurs pieds sur des cercles de couleur, sans tomber.</p><p><u>Objectif :</u> Être le dernier joueur encore en équilibre.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Longueur d'onde",
        "joueurs": [2, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "COOPERATIF"],
        "estExtension": false,
        "description": "<p><em>Longueur d'onde</em> est un jeu coopératif où les joueurs doivent deviner les pensées des autres en choisissant des cartes sur un spectre.</p><p><u>Objectif :</u> Marquer le plus de points en étant sur la même longueur d'onde.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Cabanga",
        "joueurs": [2, 6],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "RAPIDITE", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Cabanga</em> est un jeu de rapidité et de déduction où les joueurs doivent trouver des mots en commun sur leurs cartes.</p><p><u>Objectif :</u> Être le plus rapide à trouver le mot commun.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "guillaume.monspro@gmail.com",
        "nom": "Insider Black",
        "joueurs": [4, 8],
        "duree": [20],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "BLUFF"],
        "estExtension": false,
        "description": "<p><em>Insider Black</em> est un jeu de déduction sociale où les joueurs doivent découvrir qui est l'insider parmi eux.</p><p><u>Objectif :</u> Démasquer l'insider ou, si on est l'insider, ne pas se faire prendre.</p>",
        "ageMinimal": "12"
    }
];

const celineMons = [
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Abalone",
        "joueurs": [2],
        "duree": [30],
        "difficulte": "NIVEAU3",
        "styles": ["ABSTRAIT", "DUEL", "STRATEGIQUE"],
        "estExtension": false,
        "description": "<p><em>Abalone</em> est un jeu de stratégie abstrait où deux joueurs s'affrontent en poussant des billes pour éliminer celles de l'adversaire.</p><p><u>Objectif :</u> Expulser 6 billes adverses du plateau.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Apérôle - Les Disparus de Marckam High",
        "joueurs": [4, 8],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["NARRATIF", "ENQUETE", "COOPERATIF"],
        "estExtension": false,
        "description": "<p><em>Apérôle - Les Disparus de Marckam High</em> est un jeu narratif où les joueurs incarnent des lycéens enquêtant sur une disparition mystérieuse.</p><p><u>Objectif :</u> Résoudre l'énigme avant la fin de la partie.</p>",
        "ageMinimal": "14"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Au Pire tu Meurs !",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Au Pire tu Meurs !</em> est un jeu d'ambiance où les joueurs doivent inventer des fins tragiques ou comiques à des situations absurdes.</p><p><u>Objectif :</u> Faire rire et marquer le plus de points.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Black Stories",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["ENQUETE", "DEDUCTION", "NARRATIF"],
        "estExtension": false,
        "description": "<p><em>Black Stories</em> est un jeu d'enquête où les joueurs doivent résoudre des énigmes macabres en posant des questions au meneur de jeu.</p><p><u>Objectif :</u> Découvrir la solution de chaque énigme.</p>",
        "ageMinimal": "14"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Citadelles",
        "joueurs": [2, 7],
        "duree": [30, 60],
        "difficulte": "NIVEAU3",
        "styles": ["DEVELOPPEMENT", "GESTION", "STRATEGIQUE"],
        "estExtension": false,
        "description": "<p><em>Citadelles</em> est un jeu de construction de ville où les joueurs incarnent des personnages aux pouvoirs spéciaux pour développer leur cité.</p><p><u>Objectif :</u> Construire la ville la plus prospère.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Concept",
        "joueurs": [4, 12],
        "duree": [40],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Concept</em> est un jeu coopératif où les joueurs doivent faire deviner des mots ou des expressions en utilisant des icônes sur un plateau.</p><p><u>Objectif :</u> Faire deviner le plus de concepts possible.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dékal",
        "joueurs": [2, 6],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "RAPIDITE", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Dékal</em> est un jeu de rapidité et de déduction où les joueurs doivent trouver des mots en commun sur leurs cartes.</p><p><u>Objectif :</u> Être le plus rapide à trouver le mot commun.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dixit",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Dixit</em> est un jeu d'imagination et de devinettes où les joueurs inventent des indices pour faire deviner des illustrations oniriques.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner sa carte sans être trop évident.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dixit 9 Anniversary",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": true,
        "description": "<p><em>Dixit 9 Anniversary</em> est une extension anniversaire de Dixit, avec de nouvelles cartes illustrées pour enrichir le jeu de base.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner ses cartes.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dixit Disney Edition",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "THEMATIQUE"],
        "estExtension": false,
        "description": "<p><em>Dixit Disney Edition</em> est une version thématique de Dixit, avec des illustrations inspirées de l'univers Disney.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner ses cartes Disney.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dixit 8 Harmonies",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": true,
        "description": "<p><em>Dixit 8 Harmonies</em> est une extension de Dixit, avec de nouvelles cartes illustrées pour varier les parties.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner ses cartes.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dixit Odyssey",
        "joueurs": [3, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": true,
        "description": "<p><em>Dixit Odyssey</em> est une extension de Dixit permettant de jouer jusqu'à 12 joueurs, avec de nouvelles cartes et règles.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner ses cartes.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Dixit 7 Revelations",
        "joueurs": [3, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "NARRATIF", "DEDUCTION_SOCIALE"],
        "estExtension": true,
        "description": "<p><em>Dixit 7 Revelations</em> est une extension de Dixit, avec de nouvelles cartes illustrées pour enrichir le jeu de base.</p><p><u>Objectif :</u> Marquer le plus de points en faisant deviner ses cartes.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Echecs",
        "joueurs": [2],
        "duree": [10, 180],
        "difficulte": "NIVEAU4",
        "styles": ["ABSTRAIT", "DUEL", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>Échecs</em> est un jeu de stratégie pur où deux joueurs s'affrontent sur un plateau de 64 cases, chacun avec 16 pièces.</p><p><u>Objectif :</u> Mettre le roi adverse en échec et mat.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Escape the room - Le Secret de la Retraite du Dr Gravely",
        "joueurs": [2, 5],
        "duree": [60],
        "difficulte": "NIVEAU3",
        "styles": ["COOPERATIF", "ENIGME", "ESCAPE"],
        "estExtension": false,
        "description": "<p><em>Escape the room - Le Secret de la Retraite du Dr Gravely</em> est un jeu d'énigmes coopératif où les joueurs doivent résoudre des mystères pour s'échapper d'une pièce.</p><p><u>Objectif :</u> Résoudre toutes les énigmes en moins d'une heure.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Exploding Kittens : NSFW Edition",
        "joueurs": [2, 5],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "STRATEGIQUE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Exploding Kittens : NSFW Edition</em> est une version adulte du jeu de cartes où les joueurs doivent éviter de piquer un chat explosif, avec des illustrations et des cartes plus osées.</p><p><u>Objectif :</u> Être le dernier joueur en vie.</p>",
        "ageMinimal": "17"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Fantasy",
        "joueurs": [2, 4],
        "duree": [30, 60],
        "difficulte": "NIVEAU3",
        "styles": ["CONQUETE", "DEVELOPPEMENT", "GESTION"],
        "estExtension": false,
        "description": "<p><em>Fantasy</em> est un jeu de stratégie où les joueurs développent leur royaume, recrutent des héros et affrontent leurs adversaires dans un univers fantastique.</p><p><u>Objectif :</u> Construire le royaume le plus puissant.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Fish & Cheat",
        "joueurs": [2, 6],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "BLUFF", "CARTES"],
        "estExtension": false,
        "description": "<p><em>Fish & Cheat</em> est un jeu de cartes où les joueurs doivent mentir et bluff pour se débarrasser de leurs cartes.</p><p><u>Objectif :</u> Être le premier à se débarrasser de toutes ses cartes.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Little Secret",
        "joueurs": [4, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "FAMILIAL"],
        "estExtension": false,
        "description": "<p><em>Little Secret</em> est un jeu d'ambiance où les joueurs doivent deviner les secrets des autres en posant des questions.</p><p><u>Objectif :</u> Découvrir le plus de secrets possible.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Les Loups-Garous de Thiercelieux",
        "joueurs": [8, 20],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "NARRATIF"],
        "estExtension": false,
        "description": "<p><em>Les Loups-Garous de Thiercelieux</em> est un jeu de rôle et de déduction où les joueurs incarnent des villageois ou des loups-garous.</p><p><u>Objectif :</u> Survivre ou éliminer l'équipe adverse selon son rôle.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Loup-Garou Pour Un Crépuscule",
        "joueurs": [8, 20],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "NARRATIF"],
        "estExtension": true,
        "description": "<p><em>Loup-Garou Pour Un Crépuscule</em> est une extension du jeu Les Loups-Garous de Thiercelieux, ajoutant de nouveaux rôles et mécaniques.</p><p><u>Objectif :</u> Survivre ou éliminer l'équipe adverse selon son rôle.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Maudit Mot Dit",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Maudit Mot Dit</em> est un jeu d'ambiance où les joueurs doivent faire deviner des mots en évitant certains mots interdits.</p><p><u>Objectif :</u> Faire deviner le plus de mots possible.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Pour Combien ?",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Pour Combien ?</em> est un jeu d'ambiance où les joueurs doivent deviner le prix d'objets insolites ou décalés.</p><p><u>Objectif :</u> Être le plus proche du bon prix et marquer des points.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Presque Vrai",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Presque Vrai</em> est un jeu d'ambiance où les joueurs doivent inventer des réponses plausibles à des questions insolites.</p><p><u>Objectif :</u> Tromper les autres et marquer le plus de points.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Réveille pas Cthulhu !",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Réveille pas Cthulhu !</em> est un jeu d'ambiance où les joueurs doivent éviter de réveiller Cthulhu en répondant à des questions.</p><p><u>Objectif :</u> Ne pas réveiller Cthulhu et marquer le plus de points.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Rubik's Race",
        "joueurs": [2],
        "duree": [10],
        "difficulte": "NIVEAU2",
        "styles": ["ABSTRAIT", "RAPIDITE", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>Rubik's Race</em> est un jeu de rapidité et de logique où deux joueurs s'affrontent pour compléter un motif sur un plateau en déplaçant des cubes.</p><p><u>Objectif :</u> Compléter son motif avant l'adversaire.</p>",
        "ageMinimal": "7"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Saboteur",
        "joueurs": [3, 10],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["DEDUCATION_SOCIALE", "GESTION", "SEMI_COOP"],
        "estExtension": false,
        "description": "<p><em>Saboteur</em> est un jeu de cartes où les joueurs incarnent des nains cherchant de l'or, mais certains sont des saboteurs.</p><p><u>Objectif :</u> Trouver l'or ou saboter la mission selon son rôle.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Scooby-Doo ! Escape",
        "joueurs": [1, 5],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["COOPERATIF", "ENIGME", "NARRATIF"],
        "estExtension": false,
        "description": "<p><em>Scooby-Doo ! Escape</em> est un jeu d'énigmes coopératif où les joueurs doivent résoudre des mystères pour s'échapper, inspiré de l'univers de Scooby-Doo.</p><p><u>Objectif :</u> Résoudre toutes les énigmes en moins d'une heure.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Skyjo",
        "joueurs": [2, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "GESTION", "CARTES"],
        "estExtension": false,
        "description": "<p><em>Skyjo</em> est un jeu de cartes où les joueurs doivent collecter le moins de points possible en retournant ou échangeant des cartes.</p><p><u>Objectif :</u> Avoir le moins de points à la fin de la partie.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Taco Chat Bouc Cheese Pizza",
        "joueurs": [2, 8],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "RAPIDITE", "OBSERVATION"],
        "estExtension": false,
        "description": "<p><em>Taco Chat Bouc Cheese Pizza</em> est un jeu de rapidité et d'observation où les joueurs doivent repérer des symboles identiques sur des cartes.</p><p><u>Objectif :</u> Être le plus rapide à trouver les symboles et marquer des points.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "That's Not a Hat",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "HUMOUR", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>That's Not a Hat</em> est un jeu d'ambiance où les joueurs doivent faire deviner des objets ou des situations absurdes.</p><p><u>Objectif :</u> Faire deviner le plus d'objets possible.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "The Game",
        "joueurs": [1, 5],
        "duree": [20],
        "difficulte": "NIVEAU2",
        "styles": ["COOPERATIF", "CARTES", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>The Game</em> est un jeu coopératif de cartes où les joueurs doivent se débarrasser de toutes leurs cartes en les posant dans l'ordre croissant ou décroissant.</p><p><u>Objectif :</u> Se débarrasser de toutes les cartes ensemble.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Time's Up !",
        "joueurs": [4, 12],
        "duree": [45],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Time's Up !</em> est un jeu d'ambiance où les joueurs doivent faire deviner des célébrités ou des personnages en un temps limité, avec des contraintes de plus en plus difficiles.</p><p><u>Objectif :</u> Faire deviner le plus de cartes possible en équipe.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Touché Coulé",
        "joueurs": [2],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["ABSTRAIT", "DUEL", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>Touché Coulé</em> est un jeu de stratégie où deux joueurs placent leurs bateaux sur une grille et tentent de couler ceux de l'adversaire.</p><p><u>Objectif :</u> Couler tous les bateaux adverses en premier.</p>",
        "ageMinimal": "7"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Uno",
        "joueurs": [2, 10],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "CARTES", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Uno</em> est un jeu de cartes où les joueurs doivent se débarrasser de toutes leurs cartes en respectant des règles de couleur et de valeur.</p><p><u>Objectif :</u> Être le premier à n'avoir plus de cartes en main.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "celinemons59120@gmail.com",
        "nom": "Uno Flip !",
        "joueurs": [2, 10],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "CARTES", "RAPIDITE"],
        "estExtension": true,
        "description": "<p><em>Uno Flip !</em> est une version double-face d'Uno, avec des règles et des cartes encore plus folles.</p><p><u>Objectif :</u> Être le premier à se débarrasser de toutes ses cartes.</p>",
        "ageMinimal": "7"
    }
];

const antoineMoreau = [
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "7 Wonders Duel",
        "joueurs": [2],
        "duree": [30],
        "difficulte": "NIVEAU3",
        "styles": ["DUEL", "DEVELOPPEMENT", "GESTION"],
        "estExtension": false,
        "description": "<p><em>7 Wonders Duel</em> est un jeu de stratégie pour deux joueurs, où chacun développe sa civilisation en construisant des bâtiments, en recrutant des armées et en développant sa science.</p><p><u>Objectif :</u> Obtenir la victoire militaire, scientifique ou par supériorité culturelle.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Akropolis",
        "joueurs": [2, 4],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "TUILES", "CONSTRUCTION"],
        "estExtension": false,
        "description": "<p><em>Akropolis</em> est un jeu de placement de tuiles où les joueurs construisent une cité grecque en optimisant l'espace et les ressources.</p><p><u>Objectif :</u> Construire la cité la plus prospère et marquer le plus de points.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Burger Quiz",
        "joueurs": [2, 6],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "CULTURE_G", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Burger Quiz</em> est un jeu de quiz décalé inspiré de l'émission culte, avec des questions variées et des défis rigolos.</p><p><u>Objectif :</u> Répondre correctement et s'amuser en équipe.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Carcassonne",
        "joueurs": [2, 5],
        "duree": [30, 60],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "MAJORITE", "TUILES"],
        "estExtension": false,
        "description": "<p><em>Carcassonne</em> est un jeu de placement de tuiles où les joueurs construisent un paysage médiéval et placent leurs pions pour contrôler villes, routes, monastères et champs.</p><p><u>Objectif :</u> Marquer le plus de points en contrôlant les zones du plateau.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Cartographer",
        "joueurs": [1, 100],
        "duree": [30, 45],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "TUILES", "CONSTRUCTION_MOTEUR"],
        "estExtension": false,
        "description": "<p><em>Cartographer</em> est un jeu de placement de tuiles où les joueurs dessinent des cartes en plaçant des territoires et en remplissant des objectifs.</p><p><u>Objectif :</u> Remplir ses objectifs de carte pour marquer le plus de points.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Cartographers - Extension Pack de Parchemins 4, 5 et 6",
        "joueurs": [1, 100],
        "duree": [30, 45],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "TUILES", "CONSTRUCTION_MOTEUR"],
        "estExtension": true,
        "description": "<p><em>Cartographers - Extension Pack de Parchemins 4, 5 et 6</em> ajoute de nouveaux objectifs et mécaniques au jeu de base Cartographers.</p><p><u>Objectif :</u> Remplir ses objectifs de carte pour marquer le plus de points.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Codenames",
        "joueurs": [2, 8],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "COOPERATIF"],
        "estExtension": false,
        "description": "<p><em>Codenames</em> est un jeu d'équipe où les joueurs doivent faire deviner des mots à leurs coéquipiers en utilisant des indices à un seul mot.</p><p><u>Objectif :</u> Faire deviner tous ses mots en premier.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Contrario",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Contrario</em> est un jeu d'ambiance où les joueurs doivent trouver des réponses originales et inattendues à des questions posées.</p><p><u>Objectif :</u> Marquer le plus de points en étant le plus créatif.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Dobble",
        "joueurs": [2, 8],
        "duree": [10],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "OBSERVATION", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Dobble</em> est un jeu d'observation et de rapidité où les joueurs doivent repérer le symbole identique entre deux cartes.</p><p><u>Objectif :</u> Être le plus rapide à trouver le symbole commun.</p>",
        "ageMinimal": "6"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Exploding Kittens : Édition Festive",
        "joueurs": [2, 5],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "STRATEGIQUE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Exploding Kittens : Édition Festive</em> est une version thématique du jeu de cartes où les joueurs doivent éviter de piquer un chat explosif, avec des illustrations et des cartes de Noël.</p><p><u>Objectif :</u> Être le dernier joueur en vie.</p>",
        "ageMinimal": "7"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Harmonies",
        "joueurs": [2, 5],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "PLACEMENT_OUVRIERS", "DEVELOPPEMENT"],
        "estExtension": false,
        "description": "<p><em>Harmonies</em> est un jeu de placement d'ouvriers et de développement où les joueurs construisent un village en harmonie avec la nature.</p><p><u>Objectif :</u> Développer le village le plus harmonieux et marquer le plus de points.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Kesse tu fa la ? Québec",
        "joueurs": [3, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "HUMOUR"],
        "estExtension": false,
        "description": "<p><em>Kesse tu fa la ? Québec</em> est un jeu d'ambiance où les joueurs doivent deviner des expressions ou des situations typiques du Québec.</p><p><u>Objectif :</u> Faire deviner le plus d'expressions possible.</p>",
        "ageMinimal": "16"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Mimtoo",
        "joueurs": [3, 12],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DESSIN", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Mimtoo</em> est un jeu d'ambiance où les joueurs doivent faire deviner des mots en les dessinant ou en les mimant.</p><p><u>Objectif :</u> Faire deviner le plus de mots possible.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Mr Jack - London",
        "joueurs": [2],
        "duree": [30],
        "difficulte": "NIVEAU3",
        "styles": ["DUEL", "DEDUCTION", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>Mr Jack - London</em> est un jeu de déduction pour deux joueurs, où l'un incarne Jack l'Éventreur et l'autre un inspecteur cherchant à le démasquer.</p><p><u>Objectif :</u> Dévoiler ou protéger l'identité de Jack l'Éventreur.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Now!",
        "joueurs": [3, 8],
        "duree": [20],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "RAPIDITE", "DEDUCATION_SOCIALE"],
        "estExtension": false,
        "description": "<p><em>Now!</em> est un jeu de rapidité et de déduction où les joueurs doivent être les premiers à poser leur main sur la bonne carte.</p><p><u>Objectif :</u> Être le plus rapide et marquer le plus de points.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Quarto",
        "joueurs": [2],
        "duree": [15],
        "difficulte": "NIVEAU2",
        "styles": ["ABSTRAIT", "LOGIQUE", "DUEL"],
        "estExtension": false,
        "description": "<p><em>Quarto</em> est un jeu de stratégie abstrait où les joueurs doivent aligner quatre pièces partageant une caractéristique commune.</p><p><u>Objectif :</u> Aligner quatre pièces avant son adversaire.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "6 qui Surprend",
        "joueurs": [2, 10],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "LOGIQUE", "PLI"],
        "estExtension": false,
        "description": "<p><em>6 qui Surprend</em> est un jeu de cartes malicieux où les joueurs doivent poser leurs cartes dans l'ordre croissant sur 4 lignes, avec des effets surprises.</p><p><u>Objectif :</u> Avoir le moins de points à la fin de la partie.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Skyjo",
        "joueurs": [2, 8],
        "duree": [30],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "GESTION", "CARTES"],
        "estExtension": false,
        "description": "<p><em>Skyjo</em> est un jeu de cartes où les joueurs doivent collecter le moins de points possible en retournant ou échangeant des cartes.</p><p><u>Objectif :</u> Avoir le moins de points à la fin de la partie.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Solstis",
        "joueurs": [2, 4],
        "duree": [30],
        "difficulte": "NIVEAU2",
        "styles": ["FAMILIAL", "PLACEMENT_OUVRIERS", "DEVELOPPEMENT"],
        "estExtension": false,
        "description": "<p><em>Solstis</em> est un jeu de placement d'ouvriers où les joueurs développent leur village en optimisant leurs actions selon les saisons.</p><p><u>Objectif :</u> Développer le village le plus prospère et marquer le plus de points.</p>",
        "ageMinimal": "10"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "The Game",
        "joueurs": [1, 5],
        "duree": [20],
        "difficulte": "NIVEAU2",
        "styles": ["COOPERATIF", "CARTES", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>The Game</em> est un jeu coopératif de cartes où les joueurs doivent se débarrasser de toutes leurs cartes en les posant dans l'ordre croissant ou décroissant.</p><p><u>Objectif :</u> Se débarrasser de toutes les cartes ensemble.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "The Mind",
        "joueurs": [2, 4],
        "duree": [20],
        "difficulte": "NIVEAU2",
        "styles": ["COOPERATIF", "CARTES", "LOGIQUE"],
        "estExtension": false,
        "description": "<p><em>The Mind</em> est un jeu coopératif où les joueurs doivent poser leurs cartes dans l'ordre croissant sans communiquer.</p><p><u>Objectif :</u> Réussir à poser toutes les cartes dans le bon ordre.</p>",
        "ageMinimal": "8"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Time's Up Party",
        "joueurs": [4, 12],
        "duree": [45],
        "difficulte": "NIVEAU1",
        "styles": ["PARTY", "DEDUCATION_SOCIALE", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Time's Up Party</em> est un jeu d'ambiance où les joueurs doivent faire deviner des célébrités ou des personnages en un temps limité, avec des contraintes de plus en plus difficiles.</p><p><u>Objectif :</u> Faire deviner le plus de cartes possible en équipe.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Trivial Pursuit - Classic Edition",
        "joueurs": [2, 6],
        "duree": [60],
        "difficulte": "NIVEAU2",
        "styles": ["CULTURE_G", "FAMILIAL", "ENIGME"],
        "estExtension": false,
        "description": "<p><em>Trivial Pursuit - Classic Edition</em> est un jeu de quiz où les joueurs doivent répondre à des questions de culture générale pour remplir leur camembert.</p><p><u>Objectif :</u> Remplir son camembert en premier.</p>",
        "ageMinimal": "12"
    },
    {
        "proprio": "moreauantoine59@gmail.com",
        "nom": "Uno All Wild",
        "joueurs": [2, 10],
        "duree": [15],
        "difficulte": "NIVEAU1",
        "styles": ["FAMILIAL", "CARTES", "RAPIDITE"],
        "estExtension": false,
        "description": "<p><em>Uno All Wild</em> est une version d'Uno où toutes les cartes sont des cartes spéciales, pour des parties encore plus folles.</p><p><u>Objectif :</u> Être le premier à se débarrasser de toutes ses cartes.</p>",
        "ageMinimal": "7"
    }
];

getCurrentUser().then(async (user) => {
    if(!user) {
        logout();
    }
    
    //Get User Preference
    me = user.email;
    const userPreference = await getUtilisateurFromDB(user.email);
    const allUsers = await getAllDocuments(COLLECTIONS.UTILISATEURS);
    
    const accessList = getAccessList(userPreference.email, allUsers);
    const famillyUsers = getDisplayNameAndEmails(userPreference.email, allUsers);
    
    proprios.push({"displayName": famillyUsers.displayName, "email": famillyUsers.email.join()} );
    accessList.forEach(access => proprios.push({"displayName": access.displayName, "email": access.email.join()}));
    //Get Games
    const games = await getAllGamesFromAccessAndFamilly(accessList, famillyUsers);
    //Display Games
    displayGames(games, getFilter(), famillyUsers.email);
    document.getElementById("resultsCount").innerText = nbGames == 0 ? "Aucun jeu trouvé !" : `${nbGames} jeu(x) trouvé(s)`;
    //Get Filters
    for(let i = 0; i < proprios.length; i++) {
        let option = document.createElement("option");
        option.value = proprios[i].email;
        option.text = proprios[i].displayName;
        document.getElementById("ownerSelect").appendChild(option);
    }
    stylesList.forEach(style => {
        let option = document.createElement("option");
        option.value = style;
        option.text = STYLES[style];
        
        document.getElementById("styleSelect").appendChild(option);
    });
    joueursList.forEach(style => {
        let option = document.createElement("option");
        option.value = style;
        option.text = style;
        
        document.getElementById("playersSelect").appendChild(option);
    });
    difficulteList.forEach(style => {
        let option = document.createElement("option");
        option.value = style;
        option.text = DIFFICULTE[style];
        
        document.getElementById("difficultySelect").appendChild(option);
    });
    
    applayFilter();
    
    document.getElementById("ownerSelect").addEventListener("change", () => setFilters());
    document.getElementById("styleSelect").addEventListener("change", () => setFilters());
    document.getElementById("playersSelect").addEventListener("change", () => setFilters());
    document.getElementById("durationSelect").addEventListener("change", () => setFilters());
    document.getElementById("difficultySelect").addEventListener("change", () => setFilters());
    
    document.getElementById("logout").addEventListener("click", logout);
    document.getElementById("editPencil").addEventListener("click", toggleEdit);
    document.getElementById("editCreate").addEventListener("click", () => showCreateModal(undefined));
    
    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link']
            ]
        }
    });

    for (const [key, value] of Object.entries(DIFFICULTE)) {
        let opt = document.createElement("option");
        opt.text = value;
        opt.value = key;

        document.getElementById("difficulte").appendChild(opt);
    }
    for (const [key, value] of Object.entries(STYLES)) {
        let opt = document.createElement("option");
        opt.text = value;
        opt.value = key;

        document.getElementById("style").appendChild(opt);
    }

    //document.getElementById("surpriseBtn").addEventListener("click", randomGame);
    document.getElementById("surpriseBtn").addEventListener("click", async() => {
        importGames(prompt("Qui"));
    })
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function importGames(jsonArray) {
  for (const item of jsonArray) {
	await setDocument(COLLECTIONS.JEUX, undefined, item);
    await sleep(1000);
  }
}

async function getUtilisateurFromDB(email) {
    const userPreference = await getDocumentById(COLLECTIONS.UTILISATEURS, email);
    if(userPreference == undefined) 
        return undefined;
    
    return new Utilisateurs(
        userPreference.id,
        userPreference.prenom,
        userPreference.nom,
        userPreference.acces || [],
        userPreference.liens || []
    );
} 

function getAccessList(email, users) {
    const user = users.find(u => u.id === email);
    if (!user) return [];
    
    if (user.acces.includes("*")) {
        const excludedEmails = user.liens || [];
        excludedEmails.push(email);
        return users
        .filter(u => !excludedEmails.includes(u.id))
        .map(u => ({
            displayName: `${u.prenom} ${u.nom.charAt(0)}.`,
            email: [u.id]
        }));
    } else {
        return user.acces.map(acc => {
            const accUser = users.find(u => u.id === acc);
            return {
                displayName: `${accUser.prenom} ${accUser.nom.charAt(0)}.`,
                email: [accUser.id]
            };
        });
    }
}

function getDisplayNameAndEmails(email, users) {
    const user = users.find(u => u.id === email);
    if (!user) return { displayName: "", email: [] };
    
    // Récupérer les emails liés (liens + email de base)
    let emails = [user.id];
    if (user.liens && user.liens.length > 0) {
        emails = [...emails, ...user.liens];
    }
    
    // Récupérer les noms associés
    const linkedUsers = users.filter(u => emails.includes(u.id));
    const displayName = linkedUsers
    .map(u => `${u.prenom} ${u.nom.charAt(0)}.`)
    .join(" & ");
    
    return {
        displayName,
        email: [...new Set(emails)]
    };
}

async function getAllGamesFromAccessAndFamilly(accessList, famillyUsers) {
    const allEmails = [...new Set([...accessList.flatMap(item => item.email), ...famillyUsers.email])];
    
    const fetchPromises = allEmails.map(async (email) => {
        const fetch = await getDocumentsWithWhere(COLLECTIONS.JEUX, [
            { field: "proprio", operator: "==", value: email }
        ]);
        return fetch.map(jeu => new Jeux(
            jeu.proprio,
            jeu.nom,
            jeu.joueurs || [],
            jeu.duree || [],
            jeu.difficulte,
            jeu.styles || [],
            jeu.estExtension || false,
            jeu.estPrete,
            jeu.description,
            jeu.image,
            jeu.video,
            jeu.emplacement,
            jeu.ageMinimal || 0,
            jeu.dateAchat,
            jeu.id
        ));
    });
    
    const results = await Promise.all(fetchPromises);
    const games = results.flat();
    
    return games;
}

function displayGames(games, filter, familyEmail) {
    //Trier les jeux dans l'ordre alphabétique
    games.sort((a, b) => 
        a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' })
);

//On récupére la grille
const grid = document.getElementById("grid");
grid.innerHTML = "";

let setStyles = new Set();
let setJoueurs = new Set();
let setDifficulte = new Set();

// On filtre les jeux
const gamesThatMatchFilter = filter == undefined ? games : [];
if(filter) {
    games.forEach(game => { if(gameMatchFilter(game, filter)) gamesThatMatchFilter.push(game); });
} 

nbGames = gamesThatMatchFilter.length;
displayedGame = gamesThatMatchFilter;

// On affiche la grille
gamesThatMatchFilter.forEach(game => {
    const el = document.createElement("div");

    el.addEventListener("click", (event) => showGameDetails(event, game.id));
    
    const extension = game.estExtension == true ? "<sup class='extension'>extension</sup>" : "";
    el.classList.add("card");
    if(game.estPrete != undefined && game.estPrete.trim() != "")
        el.classList.add("rented");
    el.innerHTML = `
  		<img src="${game.image}" alt="${game.nom}">
  		<h3>${game.nom}${extension}</h3>
  		<div class='info'>⏱ ${displayDuree(game.duree)} min • 👥 ${displayJoueurs(game.joueurs)}</div>
  		<div class='tags'>${displayStyles(game.styles)}</div>
  		`;
    
    if(familyEmail.indexOf(game.proprio) > -1) {
        const delBtnDiv = document.createElement("div");
        for(let i = 0; i < 3; i++) {
            const delBtn = document.createElement("button");
            delBtn.classList.add("delBtn");
            delBtn.innerHTML = `<i class='fas fa-${i == 0 ? "trash" : (i == 1 ? "pencil" : "paper-plane")}'></i>`;
            if(i == 0) {
                delBtn.addEventListener("click", () => deleteGame(game.id));
            }else if(i == 1) {
                delBtn.addEventListener("click", () => showCreateModal(game.id));
            }else {
                if(game.estPrete != undefined && game.estPrete.trim() != "") {
                    delBtn.style.transform = "rotate(180deg)";
                }
                delBtn.addEventListener("click", () => lent(game.id, (game.estPrete != undefined && game.estPrete.trim() != "")));
            }
            delBtnDiv.appendChild(delBtn);
        }
        
        el.appendChild(delBtnDiv);
    }
    
    grid.appendChild(el);
    
    game.styles.forEach(s => setStyles.add(s));
    
    if(game.joueurs.length == 1)
        setJoueurs.add(game.joueurs[0]);
    else if(game.joueurs.length == 2) {
        for (let i = game.joueurs[0]; i <= game.joueurs[1]; i++) {
            setJoueurs.add(i);
        }
    }
    setDifficulte.add(game.difficulte);
});

stylesList = Array.from(setStyles).sort();
joueursList = Array.from(setJoueurs).sort((a, b) => a - b);
difficulteList = Array.from(setDifficulte).sort();
}

function displayDuree(duree) {
    if (!Array.isArray(duree) || duree.length === 0) return "-";
    if (duree.length === 1) return `${duree[0]}`;
    return `${duree[0]} - ${duree[1]}`;
}
function displayJoueurs(joueurs) {
    if (!Array.isArray(joueurs) || joueurs.length === 0) return "-";
    if (joueurs.length === 1) return `${joueurs[0]}`;
    return `${joueurs[0]} - ${joueurs[1]}`;
}
function displayStyles(styles) {
    if (!Array.isArray(styles) || styles.length === 0) return "";
    let display = [];
    styles.forEach(s => display.push(`<span>${STYLES[s]}</span>`));
    return display.join('');
}

function gameMatchFilter(game, filter) {
    if (!filter || ['style', 'joueur', 'duree', 'difficulte', 'proprio'].every(key => !filter[key]?.trim?.())) {
        return true;
    }
    if (filter.difficulte && filter.difficulte.trim() !== "") {
        if (game.difficulte?.toLowerCase() !== filter.difficulte.toLowerCase()) return false;
    }
    
    if (filter.style && filter.style.trim() !== "") {
        const stylesgame = game.styles || [];
        if (!stylesgame.some(s => s.toLowerCase() === filter.style.toLowerCase())) return false;
    }
    
    if (filter.duree && filter.duree.trim() !== "") {
        const dureefilter = filter.duree.trim();
        const [mingame, maxgame] = game.duree || [0, 0];
        const dureeMap = {
            "15": [0, 15],
            "15-30": [15, 30],
            "30-45": [30, 45],
            "60": [45, 60],
            "90": [60, 90],
            "120": [90, Infinity]
        };
        const [minfilter, maxfilter] = dureeMap[dureefilter] || [0, Infinity];
        if (maxgame < minfilter || mingame > maxfilter) return false;
    }
    
    if (filter.joueur && filter.joueur.trim() !== "") {
        const nb = parseInt(filter.joueur.trim(), 10);
        let [minJ, maxJ] = game.joueurs || [0, 0];
        if(maxJ == undefined) maxJ = minJ;
        if (nb < minJ || nb > maxJ) return false;
    }
    
    if (filter.proprio && filter.proprio.trim !== "") {
        let isIn = false;
        filter.proprio.split(",").forEach(email => {
            if(game.proprio == email)
                isIn = true;
        });
        
        if(!isIn) return false;
    }
    
    return true;
}

function getFilter() {
    const params = url.searchParams;
    let result = {};
    
    if(params.has("styleFilter"))
        result.style = params.get('styleFilter');
    if(params.has("playerFilter"))
        result.joueur = params.get('playerFilter');
    if(params.has("durationFilter"))
        result.duree = params.get('durationFilter');
    if(params.has("difficultyFilter"))
        result.difficulte = params.get('difficultyFilter');
    if(params.has("ownerFilter"))
        result.proprio = params.get('ownerFilter');
    return result;
}

function applayFilter() {
    const params = url.searchParams;
    
    if(params.has("ownerFilter"))
        document.getElementById("ownerSelect").value = params.get("ownerFilter");
    if(params.has("styleFilter"))
        document.getElementById("styleSelect").value = params.get("styleFilter");
    if(params.has("playerFilter"))
        document.getElementById("playersSelect").value = params.get("playerFilter");
    if(params.has("durationFilter"))
        document.getElementById("durationSelect").value = params.get("durationFilter");
    if(params.has("difficultyFilter"))
        document.getElementById("difficultySelect").value = params.get("difficultyFilter");
}

function setFilters() {
    url.search = "";
    const params = url.searchParams;
    
    if(document.getElementById("ownerSelect").value.trim() != "")
        params.append("ownerFilter", document.getElementById("ownerSelect").value);
    if(document.getElementById("styleSelect").value.trim() != "")
        params.append("styleFilter", document.getElementById("styleSelect").value);
    if(document.getElementById("playersSelect").value.trim() != "")
        params.append("playerFilter", document.getElementById("playersSelect").value);
    if(document.getElementById("durationSelect").value.trim() != "")
        params.append("durationFilter", document.getElementById("durationSelect").value);
    if(document.getElementById("difficultySelect").value.trim() != "")
        params.append("difficultyFilter", document.getElementById("difficultySelect").value);
    
    window.location = url;
}

function toggleEdit() {
    let editorButton = document.getElementById("editPencil");
    let allDelBtns = document.getElementsByClassName("delBtn");
    
    editMode = !editMode;
    if(editMode) editorButton.classList.add("strikeBtn");
    else editorButton.classList.remove("strikeBtn");
    
    Array.from(document.getElementsByClassName("delBtn")).forEach(btn => {
        btn.style.display = editMode ? "inline" : "none";
    });
}

async function deleteGame(gameId) {
    let modal = document.getElementById("modal");
    let modalContent = document.getElementById("modal-delete");

    openModal(modal, modalContent, false);
    
    document.getElementById("delOui").addEventListener("click", async () => {
        await deleteDocument(COLLECTIONS.JEUX, gameId);
        window.location.reload();
    });
    
    document.getElementById("delNon").addEventListener("click", () => {
        closeModal(modal, modalContent);
    });
}

async function showCreateModal(gameId) {
    let modal = document.getElementById("modal");
    let modalContent = document.getElementById("modal-create");
    
    const cancelBtn = document.getElementById("cancelBtn");
    const saveBtn = document.getElementById("saveBtn");
    const titreInput = document.getElementById("titre");
    const joueursMinInput = document.getElementById("joueurs_min");
    const titreError = document.getElementById("titreError");
    const joueursMinError = document.getElementById("joueursMinError");
    
    if(gameId != undefined) {
        let jeu = await getDocumentById(COLLECTIONS.JEUX, gameId);
        document.getElementById("titre").value = jeu.nom;
        document.getElementById("image").value = jeu.image || "";
        document.getElementById("joueurs_min").value = jeu.joueurs[0] || "";
        document.getElementById("joueurs_max").value = jeu.joueurs[1] || "";
        document.getElementById("duree_min").value = jeu.duree[0] || "";
        document.getElementById("duree_max").value = jeu.duree[1] || "";
        if(jeu.difficulte != undefined && jeu.difficulte != "")
            document.getElementById("difficulte").value = jeu.difficulte;
        document.getElementById("extension").checked = jeu.estExtension;
        document.getElementById("age_min").value = jeu.ageMinimal;
        document.getElementById("date_achat").value = jeu.dateAchat;
        quill.root.innerHTML = jeu.description;
        document.getElementById("video").value = jeu.video;
        document.getElementById("emplacement").value = jeu.emplacement;
        let styles = document.getElementById("style");
        for(let i = 0; i < styles.options.length; i++) {
            if (jeu.styles.includes(styles.options[i].value)) {
                styles.options[i].selected = true;
            }
        }
    }

    openModal(modal, modalContent, true, titreInput);

    cancelBtn.onclick = function() {
        closeModal(modal, modalContent);
        resetFormAndScrollTop();
    }
    
    saveBtn.onclick = async function() {
        let isValid = true;
        titreError.style.display = "none";
        joueursMinError.style.display = "none";
        
        if (!titreInput.value.trim()) {
            titreError.style.display = "block";
            isValid = false;
        }
        if (!joueursMinInput.value.trim()) {
            joueursMinError.style.display = "block";
            isValid = false;
        }
        
        if (!isValid) {
            return;
        }
        
        const descriptionContent = document.querySelector('.ql-editor').innerHTML;
        document.getElementById('description').value = descriptionContent;
        //proprio, nom, joueurs = [], duree = [], difficulte, styles = [], estExtension = false, estPrete, description, image, video, emplacement, ageMinimal, dateAchat, id)
        let joueurs = [parseInt(joueursMinInput.value)];
        if(document.getElementById('joueurs_max').value != "")
            joueurs.push(parseInt(document.getElementById('joueurs_max').value));
        let duree = [];
        if(document.getElementById('duree_min').value != "")
            duree.push(parseInt(document.getElementById('duree_min').value));
        if(document.getElementById('duree_max').value != "")
            duree.push(parseInt(document.getElementById('duree_max').value));
        const jeu = new Jeux(
            me,
            titreInput.value,
            joueurs,
            duree,
            document.getElementById('difficulte').value,
            Array.from(document.getElementById('style').selectedOptions).map(opt => opt.value),
            document.getElementById('extension').checked,
            undefined,
            descriptionContent,
            document.getElementById('image').value,
            document.getElementById('video').value,
            document.getElementById('emplacement').value,
            document.getElementById('age_min').value,
            document.getElementById('date_achat').value
        );

        if(gameId != undefined) {
            await setDocument(COLLECTIONS.JEUX, gameId, JSON.parse(JSON.stringify(jeu)));
        }else {
            await setDocument(COLLECTIONS.JEUX, undefined, JSON.parse(JSON.stringify(jeu)));
        }
        modal.style.display = "none";
        window.location.reload();
    }
}

function resetFormAndScrollTop() {
    const form = document.getElementById('jeuForm');
    form.reset();
    quill.setContents([{ insert: '\n' }]);
    document.querySelectorAll('.error-message').forEach(el => {
        el.style.display = 'none';
    });
    form.parentElement.scrollTop = 0;
}

async function lent(gameId, back) {
    let modalContent = back ? document.getElementById("modal-back-lent") : document.getElementById("modal-lent");
    let modal = document.getElementById("modal");
    openModal(modal, modalContent, false, back ? undefined : document.getElementById("renter"));

    let btnOui = !back ? document.getElementById("lentOui") : document.getElementById("backLentOui");
    let btnNon = !back ? document.getElementById("lentNon") : document.getElementById("backLentNon");


    btnOui.addEventListener("click", async () => {
        if(!back && document.getElementById("renter").value.trim() == "")
            return;

        let jeu = await getDocumentById(COLLECTIONS.JEUX, gameId);
        
        if(back) {
            jeu.estPrete = undefined;
        }else {
            jeu.estPrete = document.getElementById("renter").value;
        }
        
        await setDocument(COLLECTIONS.JEUX, gameId, JSON.parse(JSON.stringify(jeu)));
        window.location.reload();
    });
    
    btnNon.addEventListener("click", () => {
        closeModal(modal, modalContent);

        if(back)
            document.getElementById("renter").value = "";
    });
}

function randomGame() {
    let selectedGame = displayedGame[Math.floor(Math.random() * nbGames)];
    
    let randomModal = document.getElementById("modal-random");
    randomModal.innerHTML = "<center><h2>✨ Tu peux jouer à ✨</h2>";
    randomModal.innerHTML += `<h4>${selectedGame.nom}</h4>`;
    if(selectedGame.image != undefined && selectedGame.image.trim() != "")
        randomModal.innerHTML += `<img src="${selectedGame.image}" style='height:150px;'/>`;
    randomModal.innerHTML += "</center><br/><button id='randomOk' style='margin-top: 15px'>C'est noté !</button>";

    document.getElementById("modal-content").style.margin = "15% auto";
    document.getElementById("modal").style.display = "block";
    randomModal.style.display = "block";

    document.getElementById("randomOk").addEventListener("click", () => {
        document.getElementById("modal").style.display = "none";
        randomModal.style.display = "none";
    });
}

async function showGameDetails(event, gameId) {
    const eventSrc = event.srcElement;
    if(eventSrc.tagName.toLowerCase() == "button" || eventSrc.tagName.toLowerCase() == "i")
        return; 
    
    let game = await getDocumentById(COLLECTIONS.JEUX, gameId);

    document.getElementById("modal-content").style.margin = "15px auto";
    const modal = document.getElementById("modal");
    const modalContent = document.getElementById("modal-show-game");

    document.getElementById("modal-show-game-title").innerText = game.nom;
    if(game.image != undefined && game.image.trim() != "")
        document.getElementById("modal-show-game-image").src = game.image;
    else
        document.getElementById("modal-show-game-image").style.display = "none";
    document.getElementById("modal-show-game-joueurs").innerText = game.joueurs.join(" à ");
    document.getElementById("modal-show-game-duree").innerText = game.duree.join("-") + " min";
    document.getElementById("modal-show-game-difficulte").innerText = DIFFICULTE[game.difficulte] || "";

    let styles = [];
    game.styles.forEach(style => {
        styles.push(STYLES[style]);
    }); 

    document.getElementById("modal-show-game-styles").innerText = styles.join(", ");
    document.getElementById("modal-show-game-age-min").innerText = game.ageMinimal || "";
    if(game.description != undefined && game.description.trim != "")
        document.getElementById("modal-show-game-description").innerHTML = game.description
    else
        document.getElementById("modal-show-game-description").style.display = "none";
    if(game.video != undefined && game.video.trim() != "") 
        document.getElementById("modal-show-game-video").src = game.video.replaceAll("https://www.youtube.com/watch?v=", "https://www.youtube.com/embed/");
    else
        document.getElementById("modal-show-game-video").style.display = "none";
    if(game.emplacement != undefined && game.emplacement.trim() != "")
        document.getElementById("modal-show-game-emplacement").innerText = game.emplacement;
    else
        document.getElementById("modal-show-game-emplacement").style.display = "none";

    openModal(modal, modalContent, true);
    document.getElementById("modal-show-game-close-cross").addEventListener("click", () => closeModal(modal, modalContent));
}

function openModal(modal, modalContent, fullPage, element) {
    document.getElementById("modal-content").style.margin = (fullPage == undefined || fullPage == false) ? "15% auto" : "15px auto";
    
    document.getElementsByTagName("body")[0].addEventListener("keydown", (event) => {
        if (event.key === "Escape")
            closeModal(modal, modalContent);
    });

    modalContent.style.display = "block";
    modal.style.display = "block";

    try {
        element.focus();
    } catch(e) {}
}

function closeModal(modal, modalContent) {
    modal.style.display = "none";
    modalContent.style.display = "none";

    document.getElementsByTagName("body")[0].removeEventListener("keydown", closeModal);
}
