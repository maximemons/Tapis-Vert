class Utilisateurs {
	constructor(email, prenom, nom, acces = [], liens = []) {
		this.email = email;
        this.prenom = prenom;
        this.nom = nom;
        this.acces = acces;
        this.liens = liens;
	}
};

class Jeux {
    constructor(proprio, nom, joueurs = [], duree = [], difficulte, styles = [], estExtension = false, estPrete, description, image, video, emplacement, ageMinimal, dateAchat, id, wishlist, note) {
        this.proprio = proprio;
        this.nom = nom;
        this.joueurs = joueurs;
        this.duree = duree;
        this.difficulte = difficulte;
        this.styles = styles;
        this.estExtension = estExtension;
        this.estPrete = estPrete;
        this.description = description;
        this.image = image;
        this.video = video;
        this.emplacement = emplacement;
        this.ageMinimal = ageMinimal;
        this.dateAchat = dateAchat;
        this.id = id;
        this.wishlist = wishlist;
        this.note = note;
    }
}

const COLLECTIONS = {
    UTILISATEURS: "utilisateurs",
    JEUX: "jeux"
}

const DIFFICULTE = {
    NIVEAU1: "Très accessible",
    NIVEAU2: "Facile",
    NIVEAU3: "Intermédiaire",
    NIVEAU4: "Exigeant",
    NIVEAU5: "Complexe/Expert",
    NIVEAU6: "Épique"
}

const STYLES = {
    JEU_4X: "4X (Explore, Expand, Exploit, Exterminate)",
    ABSTRAIT: "Abstrait",
    AMBIANCE: "Ambiance",
    ALIGNEMENT: "Connexion / Alignement",
    CONQUETE: "Conquête / Guerre",
    CONSTRUCTION: "Construction physique",
    CONSTRUCTION_MOTEUR: "Construction de moteur",
    COMBO: "Combo / Enchaînement d’actions",
    COOPERATIF: "Coopératif",
    COOP_NARRATIF: "Coopératif narratif",
    CCG: "Cartes à collectionner (CCG/TCG)",
    CAMPAGNE: "Campagne / Scénarios",
    BAGBUILDING: "Bag-building / Dice-building",
    BLUFF: "Bluff",
    DEDUCTION: "Déduction logique",
    DEDUCTION_SOCIALE: "Déduction sociale",
    DECKBUILDING: "Deck-building",
    DEVELOPPEMENT: "Développement / Civilisation",
    DESSIN: "Dessin / Créativité",
    DIPLOMATIE: "Diplomatie",
    DRAFT: "Draft",
    DUEL: "Duel",
    ECONOMIQUE: "Économique",
    ENIGME: "Énigmes / Réflexion / Logique",
    ENQUETE: "Enquête / Mystère",
    ESCAPE: "Escape game",
    ESCARMOUCHE: "Combat tactique / Escarmouche",
    FAMILIAL: "Familial",
    GESTION: "Gestion / Ressources",
    HAND_MANAGEMENT: "Gestion de main",
    HYBRIDE: "Hybride / Numérique",
    JDR: "Jeu de rôle (JdR)",
    PLI: "Jeu de plis",
    LOGIQUE: "Logique",
    MAJORITE: "Majorité / Contrôle de zones",
    NARRATIF: "Narratif / Aventure",
    OBSERVATION: "Observation / Rapidité",
    PARTY: "Party Game",
    PLACEMENT_OUVRIERS: "Placement d’ouvriers",
    SEMI_COOP: "Semi-coopératif",
    SOLO: "Solo / Soloable",
    TUILES: "Tuiles / Polyominos"
};

export { Utilisateurs, Jeux, COLLECTIONS, DIFFICULTE, STYLES };