let games = [];
let dictionary = [];
let mixedGamesAndDictionary = [];

const url = new URL(window.location.href);
const params = new URLSearchParams(url.search);

function _getGamePlayers(g) {
	try{
		if(g.Joueurs.trim() != "") {
			let two = g.Joueurs.split("-");
			if(two.length == 2) {
				return { "min": two[0], "max": two[1] };		
			} else {
				let plus = g.Joueurs.split("+");
				if(plus.length == 2) {
					return { "min": plus[0], "max": null };
				}else {
					return { "min": g.Joueurs, "max": null }; 
				}
			}
		}
		return { "min": null, "max": null };
	}catch(error) {
		return { "min": null, "max": null };
	}
}

function _getGameDuration(g) {
	try{
		if(g.Temps.trim() != "") {
			let two = g.Temps.split("-");
			if(two.length == 2) {
				return { "min": two[0].replace("'", ""), "max": two[1].replace("'", "") };
			}
			return { "min": g.Temps.replace("'", "").replaceAll(">", "").replaceAll("<", ""), "max": null };
		}
		return { "min": null, "max": null };
	}catch(error) {
		return { "min": null, "max": null };
	}
}

function _isNewGame(g) {
	try{
		var date = new Date(g.DateAchat);

		var today = new Date();
	  var oneMonthAgo = new Date();
	  oneMonthAgo.setMonth(today.getMonth() - 1);
	  
	  return date >= oneMonthAgo && date <= today;
	}catch(error) {
		return false;
	}
}

function regrouperProprietairesParTitre(liste) {
	const resultat = [];

    // Créer un objet pour regrouper les titres
    const groupes = {};

    liste.forEach(item => {
    	const titre = item.Titre.trim();
    	const proprietaire = item.Proprietaires.trim();
    	const pret = item.Pret.trim();

        // Si le titre n'existe pas encore dans l'objet, on l'ajoute
        if (!groupes[titre]) {
        	groupes[titre] = {
        		Titre: titre,
        		Proprietaires: [],
        		Pret: [],
        		Nouveau: []
        	};
        }

        // Ajouter le propriétaire au tableau des propriétaires pour ce titre
        groupes[titre].Proprietaires.push(proprietaire);
        groupes[titre].Pret.push({proprietaire: proprietaire, estPrete: pret != "", pret: pret});
        groupes[titre].Nouveau.push({proprietaire: proprietaire, estNouvelAchat: _isNewGame(item)});
      });

    // Convertir l'objet en tableau
    for (const titre in groupes) {
    	resultat.push(groupes[titre]);
    }

    return resultat;
  }
  function mixGamesAndDictionary() {
  	let dictionaryTitles = [];
  	dictionary.forEach((e) => {
  		dictionaryTitles.push(e.titre);
  	});

  	let gamesWithOwners = regrouperProprietairesParTitre(games);

  	gamesWithOwners.forEach((e) => {
  		let bestMatch = findBestMatch(e.Titre, dictionaryTitles);
  		if(bestMatch.score > 0.85) {
  			let _match = dictionary[dictionaryTitles.indexOf(bestMatch.match)];
  			_match.pret = e.Pret;
  			_match.proprios = e.Proprietaires;
  			_match.estNouvelAchat = e.Nouveau
  			mixedGamesAndDictionary.push(dictionary[dictionaryTitles.indexOf(bestMatch.match)]);

  		}else {
  			duree = _getGameDuration(e);
  			joueur = _getGamePlayers(e);
  			mixedGamesAndDictionary.push({
  				"titre": e.Titre + "*",
  				"duree_min": duree[0],
  				"duree_max": duree[1],
  				"joueur_min": joueur[0],
  				"joueur_max": joueur[1],
  				"difficulte": null,
  				"image": "",
  				"video": "",
  				"extension": "",
  				"styles": "",
  				"description": "",
  				"pret": e.Pret,
  				"proprios": e.Proprietaires,
  				"estNouvelAchat": e.Nouveau
  			});
  		}
  	});

  	mixedGamesAndDictionary.sort((a, b) => a.titre.localeCompare(b.titre));
  	mixedGamesAndDictionary = [...new Set(mixedGamesAndDictionary)];
  }

  function renderFilters(ownerParam, styleParam, playersParam, durationParam) {
  	const styleSelect = document.getElementById("styleSelect");
  	const playersSelect = document.getElementById("playersSelect");
  	const ownerSelect = document.getElementById("ownerSelect");
  	ownerSelect.innerHTML = '<option value="">-- Propriétaire --</option>';
  	styleSelect.innerHTML = '<option value="">-- Style --</option>';
  	playersSelect.innerHTML = '<option value="">-- Joueurs --</option>';

  	const owners = new Set();
  	const styles = new Set();
  	const players = new Set();

  	mixedGamesAndDictionary.forEach((g) => {
  		if(g.styles != "") {
  			let styleList = g.styles.split(";");
  			styleList.forEach((s) => styles.add(s));
  		}
  		for (let n = g.joueur_min; n <= g.joueur_max; n++) players.add(n);
  			g.proprios.forEach((p) => {
  				owners.add(p);
  			});
  	});

  	[...owners].sort().forEach((s) => {
  		let selected = (ownerParam != null && ownerParam == s) ? "selected": "";
  		ownerSelect.innerHTML += `<option value="${s}" ${selected}>${s}</option>`;
  	});
  	[...styles].sort().forEach((s) => {
  		let selected = (styleParam != null && styleParam == s) ? "selected": "";
  		styleSelect.innerHTML += `<option value="${s}" ${selected}>${s}</option>`;
  	});
  	[...players].sort((a, b) => a - b).forEach((p) => {
  		let selected = (playersParam != null && playersParam == s) ? "selected": "";
  		playersSelect.innerHTML += `<option value="${p}" ${selected}>${p}</option>`;
  	});

  	if(durationParam != null) {
  		let durationSelect = document.getElementById("durationSelect");
  		let options = durationSelect.getElementsByTagName("option");
  		for(let i = 0; i < options.length; i++) {
  			if(options[i].value == durationParam) {
  				options[i].setAttribute("selected", "true");
  				break;
  			}
  		}
  	}
  }

  function matches(g) {
  	const owner = document.getElementById("ownerSelect").value;
  	const style = document.getElementById("styleSelect").value;
  	const players = document.getElementById("playersSelect").value;
  	const duration = document.getElementById("durationSelect").value;

  	if(owner && !g.proprios.includes(owner)) return false;
  	if (style && !g.styles.includes(style)) return false;
  	if (players) {
  		const n = +players;
  		if (n < g.joueur_min || n > g.joueur_max) return false;
  	}
  	if (duration) {
  		if (duration == "<15" && g.duree_min >= 15) return false;
  		if (duration == "15-30" && (g.duree_min < 15 || g.duree_min > 30)) return false;
  		if (duration == "30-45" && (g.duree_min < 30 || g.duree_min > 45)) return false;
  		if (duration == "60" && (g.duree_min < 50 || g.duree_min > 90)) return false;
  		if (duration == "90" && (g.duree_min < 90 || g.duree_min > 120)) return false;
  		if (duration == ">120" && g.duree_min <= 120) return false;
  	}
  	return true;
  }

  function showDescription(game) {
  	window.location = "game/game.html?game=" + game;
  }

  function _displayDuration(e) {
  	if(e.duree_min == null || e.duree_min == "") {
  		if(e.duree_max == null || e.duree_max == "") {
  			return "∞";
  		}
  		return e.duree_max;
  	}else {
  		if(e.duree_max == null || e.duree_max == "") {
  			return e.duree_min;
  		}
  		if(e.duree_min == e.duree_max) {
  			return e.duree_min;
  		}
  		return e.duree_min + "-" + e.duree_max;
  	}
  }

  function formatListeNoms(noms) {
	  if (!noms || noms.length === 0) return "";
	  if (noms.length === 1) return noms[0];
	  if (noms.length === 2) return noms.join(" et ");
	  return noms.slice(0, -1).join(" ") + " et " + noms[noms.length - 1];
	}

  function estPrete(jeu) {
  	if(params.has("owner") && params.get("owner").trim() != ""){
  		const p = jeu.pret;
  		for(let i = 0; i < p.length; i++) {
  			if(p[i].proprietaire === params.get("owner") && p[i].estPrete) {
  				return {estPrete: true, pretesA: p[i].pret};
  			}
  		}
  		return {estPrete: false, pretesA: ''};
  	}else {
  		if (!jeu.pret || !Array.isArray(jeu.pret)) {
	    	return { estPrete: false, pretesA: "" };
		  }

		  const estPrete = jeu.pret.every(item => item.estPrete === true);
		  const noms = jeu.pret
		    .filter(item => item.estPrete === true && item.pret)
		    .map(item => item.pret);

		  return { estPrete, pretesA: formatListeNoms(noms) };
  	}
	}

	function displayNew(g) {
		let na = g.estNouvelAchat;
		if(params.has("owner") && params.get("owner").trim() != ""){
			for(let i = 0; i < na.length; i++) {
				if(na[i].proprietaire == params.get("owner") && na[i].estNouvelAchat){
					return true;
				}
			}
			return false;
		} else {
			for(let i = 0; i < na.length; i++) {
				if(na[i].estNouvelAchat) {
					return true;
				}
			}
			return false;
		}
	}


  function renderGrid() {
  	const grid = document.getElementById("grid");
  	const resultsCount = document.getElementById("resultsCount");
  	grid.innerHTML = "";

  	const visible = mixedGamesAndDictionary.filter(matches);
  	resultsCount.textContent = `${visible.length} jeu(x) trouvé(s)`;

  	if (!visible.length) {
  		grid.textContent = "Aucun résultat";
  		return;
  	}

  	visible.forEach((g) => {
  		const el = document.createElement("div");

  		let st = g.styles.length == 0 ? "" : (g.styles.split(";").sort().map((s) => `<span class='tag'>${s}</span>`).join(""));
  		let dur = _displayDuration(g);
  		let imageSrc = g.image == "" ? ("https://maximemons.github.io/Media-Server/tapis_vert/img/" + g.titre.replaceAll(" ", "_").replaceAll(":", "").replaceAll("?", "_").toLowerCase() + ".jpg") : g.image
  		const extension = g.extension == true ? "<sup class='extension'>extension</sup>" : "";
  		el.className = "card";
  		el.innerHTML = `
  		<img src="${imageSrc}" alt="${g.titre}">
  		<h3>${g.titre}${extension}</h3>
  		<div class='info'>⏱ ${dur} min • 👥 ${g.joueur_min}-${g.joueur_max}</div>
  		<div class='tags'>${st}</div>
  		`;

  		let clone = { ...g };
  		delete clone.proprios;
  		delete clone.pret;
  		el.setAttribute("onclick", "showDescription(\"" + encodeURI(JSON.stringify(clone)).replaceAll("&","%26") + "\")");

  		if(displayNew(g)) {
  			el.classList.add("new");
  		}
  		let isGameLent = estPrete(g);
  		if(isGameLent.estPrete) {
  			el.classList.add("rented");
    		el.setAttribute("title", "Prêté à " + isGameLent.pretesA);
  		}
    grid.appendChild(el);
  });
  }

  document.getElementById("styleSelect").setAttribute("onchange", "changeFilter(this)");
  document.getElementById("playersSelect").setAttribute("onchange", "changeFilter(this)")
  document.getElementById("durationSelect").setAttribute("onchange", "changeFilter(this)")
  document.getElementById("ownerSelect").setAttribute("onchange", "changeFilter(this)")

  document.getElementById("surpriseBtn").onclick = () => {
  	let cards = document.getElementsByClassName("card");
  	let finalCards = [];
  	for(let i = 0; i < cards.length; i++) {
  		if(!cards[i].classList.contains("rented")) {
  			finalCards.push(cards[i]);
  		}
  	}

  	if(finalCards.length == 0) {
  		return alert("Aucun jeu trouvé avec ces filtres !");
  	}else {
  		finalCards[Math.floor(Math.random() * finalCards.length)].click()
  	}
  };

  function changeFilter(select) {
  	let id = select.id;
  	let value = select.value;

  	if(value.startsWith("--")) {
  		params.delete(id.replaceAll("Select", ""));
  	}else {
  		params.set(id.replaceAll("Select", ""), value);
  	}
  	window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);

  	renderGrid();
  }

  async function initPage() {
  	games = await getGameLibrary();
  	dictionary = await getGamesDictionary();

  	mixGamesAndDictionary();
  	renderFilters(params.get("owner"), params.get("style"), params.get("players"), params.get("duration"));
  	renderGrid();

  	updateGameDictionaryIfNecessary();
  	updateGameLibraryIfNecessary();
  }

  initPage();
