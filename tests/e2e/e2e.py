"""Tests de bout en bout : Firebase est remplacé par un faux Firestore en mémoire.
Prérequis : pip install playwright && playwright install chromium
            npm install --no-save dompurify@3.1.6
Lancer    : python3 tests/e2e/e2e.py
"""
import json, re, sys, threading, http.server, functools, time
from playwright.sync_api import sync_playwright

import os
ICI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(ICI, "..", ".."))
STUB = lambda f: os.path.join(ICI, "stubs", f)
DOMPURIFY = os.path.join(ROOT, "node_modules", "dompurify", "dist", "purify.es.mjs")
CAPTURES = os.path.join(ICI, "captures")
os.makedirs(CAPTURES, exist_ok=True)
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(H, directory=ROOT)
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{PORT}"

STUBS = {
    "firebase-app.js": STUB("firebase-app.js"),
    "firebase-auth.js": STUB("firebase-auth.js"),
    "firebase-firestore.js": STUB("firebase-firestore.js"),
}
def route(r):
    u = r.request.url
    if "gstatic.com/firebasejs" in u:
        return r.fulfill(path=STUBS[u.split("/")[-1]], content_type="application/javascript")
    if "esm.sh/quill" in u: return r.fulfill(path=STUB("quill.js"), content_type="application/javascript")
    if "esm.sh/dompurify" in u: return r.fulfill(path=DOMPURIFY, content_type="application/javascript")
    if u.endswith(".css"): return r.fulfill(body="", content_type="text/css")
    return r.fulfill(body="", status=404)

SEED = {
  "utilisateurs/a@x.fr": {"prenom": "Alice", "nom": "Martin", "liens": ["b@x.fr"], "acces": ["*"]},
  "utilisateurs/b@x.fr": {"prenom": "Bob", "nom": "Martin", "liens": ["a@x.fr"]},
  "utilisateurs/c@x.fr": {"prenom": "Chloé", "nom": "Durand"},
  "jeux/g1": {"proprio": "a@x.fr", "nom": "Azul", "joueurs": [2, 4], "duree": [30, 45], "styles": ["FAMILIAL"], "difficulte": "NIVEAU2", "note": 4,
              "description": "<p>Super <b>jeu</b><img src=x onerror=\"window.__xss=1\"><script>window.__xss=2</script><a href=\"javascript:window.__xss=3\">lien</a></p>",
              "emplacement": "Grenier", "dateAchat": "2024-01-01", "video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
  "jeux/g2": {"proprio": "b@x.fr", "nom": "Brass", "joueurs": [3, 4], "duree": [120], "styles": ["ECONOMIQUE"], "estPrete": "Tonton Paul", "image": "javascript:alert(1)"},
  "jeux/g3": {"proprio": "a@x.fr", "nom": "Codenames", "joueurs": [2, 8], "duree": [15], "styles": ["PARTY"]},
  "jeux/w1": {"proprio": "a@x.fr", "nom": "Wingspan", "joueurs": [1, 5], "wishlist": True},
  "jeux/c1": {"proprio": "c@x.fr", "nom": "Carcassonne", "joueurs": [2, 5]},
}

ok = 0
def check(cond, msg):
    global ok
    if not cond:
        print("❌", msg); sys.exit(1)
    ok += 1; print("✅", msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1100, "height": 900})
    ctx.route(re.compile(r"^https://"), route)
    ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin=BASE)
    # Les appels Wikidata / Wikipédia sont servis par les réponses simulées des tests unitaires
    ctx.add_init_script("""
      const vraiFetch = window.fetch.bind(window); let faux = null;
      window.__wm = [];
      window.fetch = async (url, opts) => {
        const u = String(url);
        if (!/wikidata\\.org|wikipedia\\.org/.test(u)) return vraiFetch(url, opts);
        if (window.__wmPanne) throw new TypeError('Failed to fetch');
        faux ??= (await import('/tests/fixtures/wikimedia.mjs')).fauxFetch(window.__wm);
        return faux(u);
      };
    """)
    page = ctx.new_page()
    erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("console", lambda m: m.type == "error" and "404" not in m.text and erreurs.append(m.text))
    introuvables = []
    ctx.on("response", lambda r: r.status == 404 and introuvables.append(r.url))

    page.goto(BASE + "/index.html")
    page.evaluate("s => { localStorage.clear(); localStorage.setItem('__fakedb', s); }", json.dumps(SEED))

    # --- Connexion
    page.fill("#email", "a@x.fr"); page.fill("#password", "faux"); page.press("#password", "Enter")
    page.wait_for_function("document.querySelector('#error').textContent.length > 0")
    check("incorrect" in page.text_content("#error"), "connexion : message d'erreur lisible")
    page.fill("#password", "ok"); page.click("#loginBtn")
    page.wait_for_url("**/dashboard.html")
    page.wait_for_selector("#grid .card")

    # --- Affichage par défaut : famille
    noms = page.eval_on_selector_all("#grid .card h3", "els => els.map(e => e.firstChild.textContent)")
    check(noms == ["Azul", "Brass", "Codenames"], f"jeux de la famille triés : {noms}")
    check(page.locator("#wishlistGrid .card").count() == 1, "wishlist affichée")
    check(page.locator("#grid .card.rented").count() == 1, "badge prêté")
    check(page.eval_on_selector("#ownerSelect", "s => s.selectedOptions[0].text") == "Alice M. & Bob M.", "propriétaire par défaut = famille")
    check(page.locator("#grid .card img").count() == 0 and page.locator("#grid .card-placeholder").count() == 3, "image javascript: rejetée (placeholder)")

    # --- XSS dans la fiche
    page.click("#grid .card:has-text('Azul') h3")
    page.wait_for_selector("#dlgFiche[open] .game-description")
    html = page.inner_html("#dlgFiche .game-description")
    check(page.evaluate("window.__xss") is None and "onerror" not in html and "script" not in html and "javascript:" not in html, "description nettoyée (XSS bloqué)")
    check("youtube-nocookie.com/embed/dQw4w9WgXcQ" in page.get_attribute("#dlgFiche iframe", "src"), "vidéo YouTube intégrée (nocookie)")
    check("Grenier" in page.text_content("#dlgFiche"), "emplacement visible pour le propriétaire")
    page.screenshot(path=CAPTURES + "/01-fiche.png")
    page.keyboard.press("Escape")
    # L'événement « close » d'un <dialog> est asynchrone : on attend qu'il ait vidé la fiche.
    page.wait_for_function("!document.querySelector('#dlgFiche').open && !document.querySelector('#dlgFiche iframe')", timeout=2000)
    check(True, "fermeture Échap + vidéo coupée")

    # --- Bug historique : listeners empilés sur la suppression
    page.click("#grid .card:has-text('Azul') [aria-label='Supprimer']")
    page.click("#dlgSuppression button[value=non]")
    page.click("#grid .card:has-text('Codenames') [aria-label='Supprimer']")
    page.click("#dlgSuppression button[value=oui]")
    page.wait_for_function("!document.querySelector('#grid').textContent.includes('Codenames')")
    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    check("jeux/g1" in db and "jeux/g3" not in db, "annuler puis supprimer un autre jeu : un seul jeu supprimé")

    # --- Édition d'un jeu d'un autre membre de la famille : proprio et prêt conservés
    page.click("#grid .card:has-text('Brass') [aria-label='Modifier']")
    page.wait_for_selector("#dlgJeu[open]")
    check(page.input_value("#titre") == "Brass", "formulaire pré-rempli")
    page.fill("#titre", "Brass Birmingham"); page.click("#saveBtn")
    page.wait_for_function("!document.querySelector('#dlgJeu').open")
    g2 = page.evaluate("JSON.parse(localStorage.__fakedb)['jeux/g2']")
    check(g2["proprio"] == "b@x.fr" and g2["estPrete"] == "Tonton Paul" and g2["nom"] == "Brass Birmingham", "édition : propriétaire et prêt conservés")

    # --- Création : validation puis enregistrement
    page.click("#editCreate"); page.click("#saveBtn")
    check(page.is_visible("#titreError") and page.locator("#dlgJeu[open]").count() == 1, "validation du formulaire")
    page.fill("#titre", "Dixit"); page.fill("#joueurs_min", "3"); page.fill("#joueurs_max", "8"); page.press("#joueurs_max", "Enter")
    page.wait_for_selector("#grid .card:has-text('Dixit')")
    check(page.locator("#dlgJeu[open]").count() == 0, "création avec Entrée")
    page.click("#editCreate")
    check(page.input_value("#titre") == "", "formulaire réinitialisé à la réouverture")

    # --- Remplissage automatique depuis le nom
    page.type("#titre", "Azu", delay=40)
    page.wait_for_selector("#suggestions:not([hidden]) li")
    sugg = page.eval_on_selector_all("#suggestions .suggestion-nom", "els => els.map(e => e.textContent)")
    check(sugg == ["Azul", "Azul : Pavillon d'été"], f"suggestions limitées aux jeux : {sugg}")
    check(page.get_attribute("#titre", "aria-expanded") == "true", "combobox accessible (aria-expanded)")
    page.keyboard.press("Escape")
    check(page.locator("#suggestions:not([hidden])").count() == 0 and page.locator("#dlgJeu[open]").count() == 1, "Échap ferme la liste sans fermer la fenêtre")
    page.type("#titre", "l", delay=40)
    page.wait_for_selector("#suggestions:not([hidden]) li")
    page.fill("#joueurs_min", "3")  # saisi à la main avant le choix : doit être conservé
    page.focus("#titre"); page.type("#titre", " ", delay=10); page.keyboard.press("Backspace")
    page.wait_for_selector("#suggestions:not([hidden]) li")
    page.keyboard.press("ArrowDown"); page.keyboard.press("Enter")
    page.wait_for_selector("#autoInfo.succes")
    check(page.locator("#dlgJeu[open]").count() == 1, "Entrée dans la liste ne soumet pas le formulaire")
    info = page.text_content("#autoInfo")
    check("durée" in info and "âge minimal" in info and "description" in info and "conservés : joueurs" in info, f"statut clair : {info}")
    check(page.input_value("#titre") == "Azul", "titre normalisé")
    check(page.input_value("#joueurs_min") == "3" and page.input_value("#joueurs_max") == "", "champ saisi à la main conservé")
    check([page.input_value("#duree_min"), page.input_value("#duree_max"), page.input_value("#age_min")] == ["30", "45", "8"], "durée et âge remplis")
    styles = page.eval_on_selector("#style", "s => [...s.selectedOptions].map(o => o.value).sort()")
    check(styles == ["DRAFT", "FAMILIAL", "TUILES"], f"styles déduits : {styles}")
    check(page.text_content("#stylesChoisis") == "Sélectionnés : Draft, Familial, Tuiles / Polyominos", "styles choisis visibles")
    check(page.input_value("#image") == "https://upload.wikimedia.org/azul-box.jpg", "image récupérée")
    desc = page.inner_html("#editor .ql-editor")
    check("Azul est un jeu" in desc and "&lt;abstrait&gt;" in desc and "boardgamegeek.com/boardgame/230802" in desc, "description + sources")
    check(page.locator("#jeuForm .auto-rempli").count() >= 5, "champs remplis signalés")
    page.screenshot(path=CAPTURES + "/06-saisie-auto.png")
    page.click("#autoInfo button:has-text('Annuler')")
    check(page.input_value("#duree_min") == "" and page.input_value("#joueurs_min") == "3" and page.inner_text("#editor .ql-editor").strip() == "", "annulation : retour à l'état précédent")
    check(page.text_content("#stylesChoisis") == "", "annulation : styles vidés")

    # Extension détectée
    page.fill("#titre", ""); page.fill("#joueurs_min", "")
    page.type("#titre", "Azul :", delay=30)
    page.wait_for_selector("#suggestions li:has-text('Pavillon')")
    page.click("#suggestions li:has-text('Pavillon')")
    page.wait_for_selector("#autoInfo.succes")
    check(page.is_checked("#extension") and page.input_value("#joueurs_min") == "1" and page.input_value("#duree_min") == "60", "extension, solo et durée en heures")

    # Panne réseau : message utile, pas de plantage
    page.click("#cancelBtn"); page.click("#editCreate")
    check(page.locator("#autoInfo:not([hidden])").count() == 0 and page.locator("#jeuForm .auto-rempli").count() == 0, "statut effacé à la réouverture")
    page.type("#titre", "Azu", delay=40)
    page.wait_for_selector("#suggestions:not([hidden]) li")
    page.evaluate("window.__wmPanne = true")
    page.click("#suggestions li >> nth=0")
    page.wait_for_selector("#autoInfo.erreur")
    check("à la main" in page.text_content("#autoInfo"), "panne Wikidata : message explicite")
    page.evaluate("window.__wmPanne = false")
    check(all("origin=*" in u for u in page.evaluate("window.__wm") if "wikidata" in u), "requêtes Wikidata en CORS anonyme")
    page.keyboard.press("Escape")

    # --- Filtres sans rechargement
    page.evaluate("window.__marqueur = 1")
    page.select_option("#playersSelect", "8")
    check(page.evaluate("window.__marqueur") == 1 and "playerFilter=8" in page.url, "filtre appliqué sans rechargement, URL mise à jour")
    check(page.locator("#grid .card").count() == 1, "filtre joueurs = 8 → Dixit seul")
    page.select_option("#playersSelect", "")
    page.select_option("#ownerSelect", "ALL")
    check(page.locator("#grid .card").count() == 4, "tous les propriétaires")
    check(page.locator("#grid .card:has-text('Carcassonne') .card-actions").count() == 0, "pas d'actions sur les jeux des autres")
    page.select_option("#ownerSelect", "a@x.fr,b@x.fr")

    # --- Surprise sans résultat ne plante plus
    page.select_option("#durationSelect", "15")
    page.click("#surpriseBtn")
    check("Aucun jeu" in page.text_content("#dlgSurprise"), "tirage au sort sans jeu : message")
    page.click("#dlgSurprise button")
    page.select_option("#durationSelect", "")

    # --- Création de liens de visualisation
    page.click("#partagesBtn")
    page.wait_for_selector("#dlgPartages[open] .vide")
    page.fill("#partageLibelle", "Mamie"); page.check("#partageWishlist"); page.click("#creerPartageBtn")
    page.wait_for_selector("#listePartages .partage")
    lien = page.input_value("#listePartages .lien")
    jeton = lien.split("#")[1]
    check(re.fullmatch(r"[A-Za-z0-9_-]{32}", jeton) is not None and "/partage.html#" in lien, "lien généré avec jeton dans le fragment")
    check(page.evaluate("navigator.clipboard.readText()") == lien, "lien copié automatiquement")
    page.fill("#partageLibelle", "Collègues"); page.select_option("#partageExpiration", ""); page.click("#creerPartageBtn")
    page.wait_for_function("document.querySelectorAll('#listePartages .partage').length === 2")
    check(True, "deuxième lien (sans expiration, sans wishlist)")
    page.screenshot(path=CAPTURES + "/02-partages.png")

    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    publics = {k: v for k, v in db.items() if k.startswith("partages/")}
    texte_public = json.dumps(publics)
    check("@" not in texte_public, "aucun email dans les données publiques")
    check("Tonton Paul" not in texte_public and "Grenier" not in texte_public and "2024-01-01" not in texte_public, "ni emprunteur, ni emplacement, ni date d'achat")
    check(db[f"partagesPrives/{jeton}"]["proprios"] == ["a@x.fr", "b@x.fr"], "partie privée : propriétaires")
    jeux_mamie = sorted(k.split("/")[-1] for k in db if k.startswith(f"partages/{jeton}/jeux/"))
    check(len(jeux_mamie) == 4 and "w1" in jeux_mamie and "c1" not in jeux_mamie, f"périmètre du lien Mamie : {jeux_mamie}")
    page.keyboard.press("Escape")

    # --- Visiteur anonyme
    v = ctx.new_page()
    v.on("pageerror", lambda e: erreurs.append("visiteur: " + str(e)))
    v.goto(lien)
    v.wait_for_selector("#grid .card")
    check(v.text_content("#titre") == "Ludothèque de Alice M. & Bob M.", "titre du partage")
    check(v.locator("#grid .card").count() == 3 and v.locator(".card-actions").count() == 0, "lecture seule : jeux visibles, aucune action")
    check(v.locator("#wishlistGrid .card").count() == 1, "wishlist incluse")
    check("@" not in v.content(), "aucun email dans la page visiteur")
    check(v.locator("#ownerSelect").count() == 0 and v.locator("#editCreate").count() == 0, "pas de filtre propriétaire ni d'ajout")
    v.click("#grid .card:has-text('Brass') h3")
    v.wait_for_selector("#dlgFiche[open]")
    check("Actuellement prêté" in v.text_content("#dlgFiche") and "Tonton" not in v.text_content("#dlgFiche"), "prêt signalé sans le nom de l'emprunteur")
    v.screenshot(path=CAPTURES + "/03-visiteur-fiche.png")
    v.keyboard.press("Escape")
    v.select_option("#playersSelect", "8")
    check(v.url.endswith("#" + jeton) and "playerFilter=8" in v.url, "filtres visiteur : jeton conservé dans l'URL")
    v.select_option("#playersSelect", "")
    v.screenshot(path=CAPTURES + "/04-visiteur.png", full_page=True)

    # --- Synchronisation après modification
    page.click("#grid .card:has-text('Azul') [aria-label='Prêter']")
    page.fill("#emprunteur", "Julie"); page.click("#dlgPret button[value=oui]")
    page.wait_for_selector("#grid .card.rented:has-text('Azul')")
    page.wait_for_timeout(2200)
    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    check(db[f"partages/{jeton}/jeux/g1"]["prete"] is True and "Julie" not in json.dumps(db[f"partages/{jeton}/jeux/g1"]), "synchro automatique du lien après un prêt")
    page.evaluate("window.__ops = []")
    page.reload(); page.wait_for_selector("#grid .card"); page.wait_for_timeout(800)
    ecritures = [o for o in page.evaluate("window.__ops") if o.startswith(("set", "delete", "update"))]
    check(ecritures == [], f"pas d'écriture inutile au chargement : {ecritures}")
    v.reload(); v.wait_for_selector("#grid .card.rented:has-text('Azul')")
    check(True, "le visiteur voit la mise à jour")

    # --- Révocation
    page.click("#partagesBtn"); page.wait_for_selector("#listePartages .partage")
    item = page.locator("#listePartages .partage:has-text('Mamie')")
    item.locator("button:has-text('Révoquer')").click()
    check(item.locator("button:has-text('Confirmer')").count() == 1, "révocation : confirmation demandée")
    item.locator("button:has-text('Confirmer')").click()
    page.wait_for_function("!document.querySelector('#listePartages').textContent.includes('Mamie')")
    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    check(not any(jeton in k for k in db), "révocation : toutes les données du lien supprimées")
    v.reload(); v.wait_for_selector("#etat:not([hidden])")
    check("plus valide" in v.text_content("#etat"), "visiteur : lien révoqué refusé")

    # --- Lien expiré
    page.evaluate("""() => { const db = JSON.parse(localStorage.__fakedb);
        const k = Object.keys(db).find(k => /^partages\\/[^/]+$/.test(k));
        db[k].expireLe = {__ts: Date.now() - 1000}; localStorage.__fakedb = JSON.stringify(db); window.__exp = k.split('/')[1]; }""")
    exp = page.evaluate("window.__exp")
    v.goto(BASE + "/partage.html#" + exp); v.reload(); v.wait_for_selector("#etat:not([hidden])")
    check("expiré" in v.text_content("#etat"), "visiteur : lien expiré refusé")
    v.goto(BASE + "/partage.html#abc"); v.reload(); v.wait_for_selector("#etat:not([hidden])")
    check("incomplet" in v.text_content("#etat"), "visiteur : lien tronqué")

    # --- Mobile
    m = b.new_context(viewport={"width": 390, "height": 844}); m.route(re.compile(r"^https://"), route)
    mp = m.new_page(); mp.goto(BASE + "/index.html")
    mp.evaluate("s => { localStorage.setItem('__fakedb', s); sessionStorage.setItem('__user', 'a@x.fr'); }", json.dumps(db))
    mp.goto(BASE + "/dashboard.html"); mp.wait_for_selector("#grid .card")
    mp.click("#partagesBtn"); mp.wait_for_selector("#listePartages .partage")
    mp.screenshot(path=CAPTURES + "/05-mobile-partages.png")
    check(mp.evaluate("document.documentElement.scrollWidth <= innerWidth"), "mobile : pas de débordement horizontal")
    mp.go_back(); mp.wait_for_timeout(300)
    check(mp.locator("#dlgPartages[open]").count() == 0 and mp.url.endswith("dashboard.html"), "mobile : « retour » ferme la fenêtre sans quitter la page")

    print("404 :", sorted(set(introuvables)))
    check(all(("youtube" in u or "wikimedia" in u) for u in introuvables), "seuls 404 = médias externes bloqués par le banc de test")
    check(not erreurs, f"aucune erreur JS : {erreurs}")
    print(f"\n{ok} vérifications OK")
    b.close()
