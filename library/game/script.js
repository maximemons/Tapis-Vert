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

function initPageGame() {
	const url = new URL(window.location.href);
	const params = new URLSearchParams(url.search);

	if(!params.has("game")) {
		history.back();
	}

	const game = JSON.parse(decodeURI(params.get("game")));
	console.log(game);

	let titres = document.getElementsByClassName("titre");
	for(var i = 0; i < titres.length; i++) {
		titres[i].innerText = game.titre;
	}
	document.getElementById("image").src = game.image == "" ? ("https://maximemons.github.io/Media-Server/tapis_vert/img/" + game.titre.replaceAll(" ", "_").replaceAll(":", "").replaceAll("?", "_").toLowerCase() + ".jpg") : game.image;
	document.getElementById("image").alt = game.titre;
	document.getElementById("duree").innerText = _displayDuration(game) + " min";
	document.getElementById("joueurs").innerText = game.joueur_min + " - " + game.joueur_max;
	document.getElementById("difficulte").innerText = game.difficulte;

	if(!(game.description == "" || game.description == null || game.description == undefined)) {
		document.getElementById("description").innerHTML = game.description;
		document.getElementById("description").parentElement.removeAttribute("style");
	}
	if(!(game.video == "" || game.video == null || game.video == undefined)) {
		let video = '<iframe width="560" height="315" src="' + game.video + '" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen=""></iframe>'
		document.getElementById("video").innerHTML = video;
		document.getElementById("video").parentElement.removeAttribute("style");
	}
}

initPageGame();
