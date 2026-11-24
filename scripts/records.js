// Modèle de données et constantes. Module pur (aucun import réseau) : testable sous Node.

class Utilisateurs {
    constructor(email, prenom, nom, acces = [], liens = []) {
        this.email = email;
        this.prenom = prenom;
        this.nom = nom;
        this.acces = acces;
        this.liens = liens;
    }
}

class Jeux {
    constructor({
        id, proprio, nom, joueurs = [], duree = [], difficulte = "", styles = [],
        estExtension = false, estPrete, description = "", image = "", video = "",
        emplacement = "", ageMinimal = 0, dateAchat = "", wishlist = false, note = -1
    } = {}) {
        this.id = id;
        this.proprio = proprio;
        this.nom = nom ?? "";
        this.joueurs = Array.isArray(joueurs) ? joueurs.map(Number).filter(Number.isFinite) : [];
        this.duree = Array.isArray(duree) ? duree.map(Number).filter(Number.isFinite) : [];
        this.difficulte = difficulte || "";
        this.styles = Array.isArray(styles) ? styles : [];
        this.estExtension = estExtension === true;
        this.estPrete = typeof estPrete === "string" && estPrete.trim() ? estPrete.trim() : undefined;
        this.description = description || "";
        this.image = image || "";
        this.video = video || "";
        this.emplacement = emplacement || "";
        this.ageMinimal = Number(ageMinimal) || 0;
        this.dateAchat = dateAchat || "";
        this.wishlist = wishlist === true;
        this.note = Number(note) > 0 ? Number(note) : -1;
    }

    static fromDoc(doc) {
        return new Jeux(doc);
    }

    get estPreteActuellement() {
        return Boolean(this.estPrete);
    }

    /** Objet à écrire dans Firestore (sans l'id, sans les champs undefined). */
    toDoc() {
        const { id, ...data } = this;
        return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    }
}

const COLLECTIONS = {
    UTILISATEURS: "utilisateurs",
    JEUX: "jeux",
    // Partie publique d'un lien de visualisation (lisible par quiconque connaît le jeton)
    PARTAGES: "partages",
    // Partie privée (propriétaires, libellé) : jamais lisible sans être connecté
    PARTAGES_PRIVES: "partagesPrives",
    // Sous-collection de PARTAGES contenant la copie épurée des jeux
    PARTAGES_JEUX: "jeux"
};

const DIFFICULTE = {
    NIVEAU1: "Très accessible",
    NIVEAU2: "Facile",
    NIVEAU3: "Intermédiaire",
    NIVEAU4: "Exigeant",
    NIVEAU5: "Complexe/Expert",
    NIVEAU6: "Épique"
};

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
