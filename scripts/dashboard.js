import { getDocumentById, getAllDocuments, getDocumentsWithWhere, deleteDocument, setDocument } from './firebase-db.js';
import { getCurrentUser, logout } from './firebase-auth.js';
import { Utilisateurs, Jeux, COLLECTIONS, DIFFICULTE, STYLES } from './records.js';
import Quill from 'https://esm.sh/quill@1.3.7';
//import 'https://esm.sh/quill@1.3.7/dist/quill.snow.css';

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
    document.getElementById("editCreate").addEventListener("click", showCreateModal);
    
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

    document.getElementById("surpriseBtn").addEventListener("click", randomGame);
});

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

    el.addEventListener("click", () => showGameDetails(game.id));
    
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
                delBtn.addEventListener("click", function(){alert("A venir");});
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
        const [minJ, maxJ] = game.joueurs || [0, 0];
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
    
    if(params.has("styleSelect"))
        result.style = params.get('styleSelect');
    if(params.has("styleSelect"))
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
    document.getElementById("modal-content").style.margin = "15% auto";
    document.getElementById("modal").style.display = "block";
    document.getElementById("modal-delete").style.display = "block";
    
    document.getElementById("delOui").addEventListener("click", async () => {
        await deleteDocument(COLLECTIONS.JEUX, gameId);
        window.location.reload();
    });
    
    document.getElementById("delNon").addEventListener("click", () => {
        document.getElementById("modal").style.display = "none";
        document.getElementById("modal-delete").style.display = "none";
    });
}

async function showCreateModal() {
    document.getElementById("modal-content").style.margin = "15px auto";
    document.getElementById("modal").style.display = "block";
    document.getElementById("modal-create").style.display = "block";
    
    const cancelBtn = document.getElementById("cancelBtn");
    const saveBtn = document.getElementById("saveBtn");
    const titreInput = document.getElementById("titre");
    const joueursMinInput = document.getElementById("joueurs_min");
    const titreError = document.getElementById("titreError");
    const joueursMinError = document.getElementById("joueursMinError");
    
    cancelBtn.onclick = function() {
        document.getElementById("modal").style.display = "none";
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

        await setDocument(COLLECTIONS.JEUX, undefined, JSON.parse(JSON.stringify(jeu)));
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

    document.getElementById("modal-content").style.margin = "15% auto";
    modalContent.style.display = "block";
    document.getElementById("modal").style.display = "block";

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
        document.getElementById("modal").style.display = "none";
        modalContent.style.display = "none";
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

function showGameDetails(gameId) {
    alert("A venir");
}