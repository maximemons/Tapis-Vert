"""Tests de bout en bout : Firebase est remplacé par un faux Firestore en mémoire.
Prérequis : pip install playwright && playwright install chromium
            npm install --no-save jsqr@1.4.0 pngjs@7.0.0 ; pip install pillow
Lancer    : python3 tests/e2e/e2e.py
"""
import json, re, sys, threading, http.server, functools, time
from playwright.sync_api import sync_playwright

import os
ICI = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(ICI, "..", ".."))
STUB = lambda f: os.path.join(ICI, "stubs", f)
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
# Image de test servie par un « site externe » autorisant la copie (CORS)
def png_test(l, h):
    from PIL import Image as Img
    import io, random
    random.seed(1)
    im = Img.new("RGB", (l, h))
    px = im.load()
    for x in range(0, l, 4):
        for y in range(0, h, 4):
            c = ((x * 7 + random.randint(0, 60)) % 256, (y * 5) % 256, (x + y + random.randint(0, 90)) % 256)
            for dx in range(4):
                for dy in range(4):
                    if x + dx < l and y + dy < h: px[x + dx, y + dy] = c
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()
PNG_LIEN = png_test(900, 1200)

def route(r):
    u = r.request.url
    if "images.test/boite.png" in u:
        return r.fulfill(body=PNG_LIEN, content_type="image/png", headers={"Access-Control-Allow-Origin": "*"})
    if "gstatic.com/firebasejs" in u:
        return r.fulfill(path=STUBS[u.split("/")[-1]], content_type="application/javascript")
    if u.endswith(".css"): return r.fulfill(body="", content_type="text/css")
    return r.fulfill(body="", status=404)

SEED = {
  "utilisateurs/a@x.fr": {"prenom": "Alice", "nom": "Martin", "liens": ["b@x.fr"], "acces": ["*"]},
  "utilisateurs/b@x.fr": {"prenom": "Bob", "nom": "Martin", "liens": ["a@x.fr"]},
  "utilisateurs/c@x.fr": {"prenom": "Chloé", "nom": "Durand", "liens": ["c2@x.fr"]},
  "utilisateurs/c2@x.fr": {"prenom": "Clément", "nom": "Durand", "liens": ["c@x.fr"]},
  "jeux/g1": {"proprio": "a@x.fr", "nom": "Azul", "joueurs": [2, 4], "duree": [30, 45], "styles": ["FAMILIAL"], "difficulte": "NIVEAU2", "note": 4,
              "description": "<p>Super <b>jeu</b><img src=x onerror=\"window.__xss=1\"><script>window.__xss=2</script><a href=\"javascript:window.__xss=3\">lien</a></p>",
              "emplacement": "Grenier", "dateAchat": "2024-01-01", "video": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
  "jeux/g2": {"proprio": "b@x.fr", "nom": "Brass", "joueurs": [3, 4], "duree": [120], "styles": ["ECONOMIQUE"], "estPrete": "Tonton Paul", "image": "javascript:alert(1)"},
  "jeux/g3": {"proprio": "a@x.fr", "nom": "Codenames", "joueurs": [2, 8], "duree": [15], "styles": ["PARTY"]},
  "jeux/w1": {"proprio": "a@x.fr", "nom": "Wingspan", "joueurs": [1, 5], "wishlist": True},
  "jeux/c1": {"proprio": "c@x.fr", "nom": "Carcassonne", "joueurs": [2, 5], "duree": [30, 45], "ageMinimal": 7},
  "jeux/c2": {"proprio": "c@x.fr", "nom": "Dobble", "joueurs": [2, 8], "estPrete": "Tonton Paul"},
  "jeux/cw": {"proprio": "c@x.fr", "nom": "Catan", "joueurs": [3, 4], "wishlist": True},
}

ok = 0
def check(cond, msg):
    global ok
    if not cond:
        print("❌", msg); sys.exit(1)
    ok += 1; print("✅", msg)

with sync_playwright() as p:
    # CHROMIUM=/chemin/vers/chromium : navigateur déjà installé (sinon celui de Playwright)
    chemin = os.environ.get("CHROMIUM")
    b = p.chromium.launch(executable_path=chemin, args=["--no-sandbox", "--no-zygote", "--single-process"]) if chemin else p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1100, "height": 900}, service_workers="block")
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
    # Les refus de permission simulés (scénarios de règles Firestore) sont journalisés volontairement
    page.on("console", lambda m: m.type == "error" and "404" not in m.text and "insufficient permissions" not in m.text and erreurs.append(m.text))
    introuvables = []
    ctx.on("response", lambda r: r.status == 404 and introuvables.append(r.url))

    page.goto(BASE + "/index.html")
    page.evaluate("s => { localStorage.clear(); localStorage.setItem('__fakedb', s); }", json.dumps(SEED))

    # --- Connexion Google
    page.click("#googleBtn"); page.wait_for_timeout(200)
    check(page.text_content("#error") == "" and page.url.endswith("/index.html"), "google : fenêtre fermée sans message d'erreur")
    page.evaluate("window.__googleEmail = 'inconnu@gmail.com'"); page.click("#googleBtn")
    page.wait_for_function("document.querySelector('#error').textContent.length > 0")
    check("pas accès" in page.text_content("#error"), "google : compte non déclaré refusé")
    check(page.evaluate("sessionStorage.getItem('__user')") is None, "google : compte refusé déconnecté")
    page.evaluate("window.__googleEmail = 'a@x.fr'"); page.click("#googleBtn")
    page.wait_for_url("**/dashboard.html"); page.wait_for_selector("#grid .card")
    check(True, "google : compte déclaré connecté")
    page.evaluate("sessionStorage.setItem('__user', 'intrus@gmail.com'); sessionStorage.setItem('__provider', 'google.com')")
    page.goto(BASE + "/dashboard.html"); page.wait_for_url("**/index.html*")
    page.wait_for_function("document.querySelector('#error').textContent.length > 0")
    check("pas accès" in page.text_content("#error"), "google : tableau de bord interdit à un compte non déclaré")

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

    # Nom français absent de Wikidata, retrouvé via Wikipédia FR
    page.click("#cancelBtn"); page.click("#editCreate")
    page.type("#titre", "aventuriers du", delay=30)
    page.wait_for_selector("#suggestions li:has-text('Les Aventuriers du rail')")
    check("VO : Ticket to Ride" in page.text_content("#suggestions"), "recherche en français, nom d'origine rappelé")
    page.click("#suggestions li:has-text('Les Aventuriers du rail')")
    page.wait_for_selector("#autoInfo.succes")
    check(page.input_value("#titre") == "Les Aventuriers du rail" and page.input_value("#joueurs_max") == "5", "titre français conservé et fiche remplie")
    page.screenshot(path=CAPTURES + "/07-recherche-fr.png")

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
    check(page.locator("#grid .card").count() == 5, "tous les propriétaires")
    check(page.locator("#grid .card:has-text('Carcassonne') [aria-label='Supprimer'], #grid .card:has-text('Carcassonne') [aria-label='Modifier'], #grid .card:has-text('Carcassonne') [aria-label='Prêter']").count() == 0, "pas de suppression, modification ni prêt sur les jeux des autres")

    # --- Emprunter : simple lien mailto vers le propriétaire, pour les jeux des autres uniquement
    bouton = page.locator("#grid .card:has-text('Carcassonne') a.card-action:has-text('Emprunter')")
    check(bouton.count() == 1, "bouton Emprunter sur un jeu disponible d'un autre")
    from urllib.parse import urlparse, parse_qs, unquote
    href = bouton.get_attribute("href")
    mail = urlparse(href)
    qs = parse_qs(mail.query)
    corps = qs["body"][0]
    check(mail.scheme == "mailto" and unquote(mail.path) == "c@x.fr", f"mailto adressé au propriétaire : {mail.path}")
    check("Carcassonne" in qs["subject"][0], "objet avec le nom du jeu")
    check("Carcassonne" in corps and "Par avance merci" in corps, "corps de la demande")
    check(qs.get("cc") == ["c2@x.fr"], f"co-propriétaire en CC : {qs.get('cc')}")
    page.evaluate("window.__marqueur = 1")
    bouton.evaluate("a => a.addEventListener('click', e => e.preventDefault())")  # on ne quitte pas la page pendant le test
    bouton.click()
    check(page.locator("#dlgFiche[open]").count() == 0, "clic sur Emprunter n'ouvre pas la fiche")
    check(page.locator("#grid .card:has-text('Dobble')").count() == 1 and page.locator("#grid .card:has-text('Dobble') .card-action").count() == 0, "pas d'Emprunter sur un jeu déjà prêté")
    check(page.locator("#grid .card:has-text('Azul') a.card-action, #grid .card:has-text('Brass') a.card-action").count() == 0, "pas d'Emprunter sur mes jeux ni ceux de ma famille")
    page.screenshot(path=CAPTURES + "/emprunter.png")
    check(page.locator("#wishlistGrid .card:has-text('Catan')").count() == 1 and page.locator("#wishlistGrid a.card-action").count() == 0, "pas d'Emprunter sur la wishlist d'un autre")
    page.select_option("#ownerSelect", "a@x.fr,b@x.fr")

    # --- Surprise sans résultat ne plante plus
    page.select_option("#durationSelect", "15")
    page.click("#surpriseBtn")
    check("Aucun jeu" in page.text_content("#dlgSurprise"), "tirage au sort sans jeu : message")
    page.click("#dlgSurprise button")
    page.select_option("#durationSelect", "")

    # --- Diagnostic : règles Firestore non publiées
    page.evaluate("localStorage.__regles = 'absentes'")
    page.reload(); page.wait_for_selector("#grid .card"); page.wait_for_timeout(500)
    check(page.locator(".toast-erreur").count() == 0, "règles absentes : aucune alerte intempestive au chargement")
    page.click("#partagesBtn")
    page.wait_for_selector("#partagesDiagnostic:not([hidden])")
    diag = page.text_content("#partagesDiagnostic")
    check("pas encore activés" in diag and "firestore.rules" in diag, "règles absentes : cause expliquée")
    check(page.get_attribute("#partagesDiagnostic a", "href") == "https://console.firebase.google.com/project/tapis-test/firestore/rules", "lien direct vers les règles du projet")
    check(page.is_disabled("#creerPartageBtn"), "création désactivée tant que les règles manquent")
    page.screenshot(path=CAPTURES + "/08-diagnostic.png")
    page.evaluate("localStorage.removeItem('__regles')")
    page.click("#partagesDiagnostic button:has-text('Revérifier')")
    page.wait_for_selector("#partagesDiagnostic", state="hidden")
    check(page.is_enabled("#creerPartageBtn"), "après publication des règles : « Revérifier » réactive la création")

    # --- Diagnostic : règles publiées mais obsolètes
    page.evaluate("localStorage.__regles = 'anciennes'")
    page.fill("#partageLibelle", "Test"); page.click("#creerPartageBtn")
    page.wait_for_selector("#partagesDiagnostic:not([hidden])")
    check("Republiez" in page.text_content("#partagesDiagnostic") and "enregistrement du lien" in page.text_content(".toast-erreur"), "règles obsolètes : étape fautive indiquée")

    # --- Échec à mi-chemin : pas de lien fantôme
    page.evaluate("localStorage.__regles = 'public-refuse'")
    page.click("#creerPartageBtn")
    page.wait_for_function("document.querySelector('#creerPartageBtn').textContent === 'Créer le lien'")
    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    check(not any(k.startswith("partages") for k in db), "échec à la publication : tout est annulé, aucun lien fantôme")
    page.evaluate("localStorage.removeItem('__regles')")
    page.keyboard.press("Escape")
    page.reload(); page.wait_for_selector("#grid .card")

    # --- Création de liens de visualisation
    page.click("#partagesBtn")
    page.wait_for_selector("#dlgPartages[open] .vide")
    check(page.locator("#partagesDiagnostic:not([hidden])").count() == 0, "règles OK : pas de diagnostic")
    page.fill("#partageLibelle", "Mamie"); page.check("#partageWishlist"); page.click("#creerPartageBtn")
    page.wait_for_selector("#listePartages .partage")

    # --- QR code du nouveau lien, affiché d'office
    page.wait_for_selector("#listePartages .qr-panneau:not([hidden]) svg")
    check(page.get_attribute("#listePartages .partage button:has-text('QR code')", "aria-expanded") == "true", "QR code du nouveau lien affiché directement")
    with page.expect_download() as dl:
        page.click("#listePartages .qr-panneau button:has-text('Télécharger')")
    fichier = CAPTURES + "/qr-telecharge.png"
    dl.value.save_as(fichier)
    check(dl.value.suggested_filename == "qr-ludotheque-mamie.png", f"nom du fichier : {dl.value.suggested_filename}")
    import subprocess
    lu = json.loads(subprocess.run(["node", os.path.join(ICI, "decoder-qr.mjs"), fichier], capture_output=True, text=True, cwd=ROOT).stdout)
    lien_affiche = page.input_value("#listePartages .lien")
    check(lu["texte"] == lien_affiche, f"le QR code téléchargé se scanne vers le bon lien ({lu['largeur']}×{lu['hauteur']} px)")
    page.screenshot(path=CAPTURES + "/09-qr.png")
    page.click("#listePartages .partage button:has-text('QR code')")
    check(page.locator("#listePartages .qr-panneau:not([hidden])").count() == 0, "QR code repliable")
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

    # --- Images : fichier, photo, copie depuis un lien, lien mort
    page.keyboard.press("Escape")
    photo = CAPTURES + "/photo-test.png"
    open(photo, "wb").write(png_test(1600, 1200))
    page.click("#editCreate"); page.fill("#titre", "Splendor"); page.fill("#joueurs_min", "2")
    check(page.get_attribute("#imagePhoto", "capture") == "environment" and page.get_attribute("#imagePhoto", "accept") == "image/*", "bouton Photo : appareil photo arrière proposé sur téléphone")
    page.set_input_files("#imageFichier", photo)
    page.wait_for_selector("#imageInfo.succes")
    src = page.get_attribute("#imageApercu", "src")
    check(src.startswith("data:image/webp;base64,") and len(src) <= 180000, f"fichier : image réduite et compressée ({len(src) // 1024} Ko)")
    check(page.is_disabled("#image") and "Image importée" in page.get_attribute("#image", "placeholder"), "lien désactivé tant qu'une image est importée")
    page.click("#saveBtn")
    page.wait_for_selector("#grid .card:has-text('Splendor') img")
    page.wait_for_function("(() => { const c = [...document.querySelectorAll('#grid .card')].find(c => c.textContent.includes('Splendor')); const i = c && c.querySelector('img'); return i && i.complete && i.naturalWidth > 0; })()")
    taille = page.evaluate("(() => { const i = [...document.querySelectorAll('#grid .card')].find(c => c.textContent.includes('Splendor')).querySelector('img'); return [i.naturalWidth, i.naturalHeight]; })()")
    check(taille == [800, 600], f"image ramenée à 800 px de large, proportions gardées : {taille}")
    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    splendor = next(v for k, v in db.items() if k.startswith("jeux/") and v.get("nom") == "Splendor")
    check(splendor["image"] == src and splendor.get("ajouteLe"), "image importée enregistrée avec le jeu (et date d'ajout)")

    page.click("#grid .card:has-text('Splendor') [aria-label='Modifier']")
    page.wait_for_selector("#dlgJeu[open]")
    check(page.get_attribute("#imageApercu", "src") == src and page.is_visible("#imageRetirer"), "édition : image importée reprise")
    page.click("#imageRetirer")
    check(page.is_enabled("#image") and page.is_hidden("#imageApercu"), "retirer l'image")
    page.fill("#image", "https://images.test/boite.png")
    page.wait_for_selector("#imageCopie:visible")
    page.click("#imageCopie")
    page.wait_for_selector("#imageInfo.succes")
    copie = page.get_attribute("#imageApercu", "src")
    check(copie.startswith("data:image/") and page.input_value("#image") == "", "copie de l'image d'un lien (ne dépend plus du site)")
    page.click("#imageRetirer")
    page.fill("#image", "https://images.test/mort.jpg")
    page.wait_for_selector("#imageInfo.erreur")
    check("ne s'affiche pas" in page.text_content("#imageInfo"), "lien d'image mort : signalé dans le formulaire")
    page.click("#saveBtn"); page.wait_for_function("!document.querySelector('#dlgJeu').open")
    page.wait_for_selector("#grid .card:has-text('Splendor') .card-placeholder")
    page.wait_for_timeout(300)
    check(page.locator("#grid .card:has-text('Splendor') img").count() == 0, "lien d'image mort : la carte affiche le dé au lieu d'une image cassée")

    # --- Description : listes à puces conservées (Quill 2)
    page.click("#editCreate"); page.fill("#titre", "Kingdomino"); page.fill("#joueurs_min", "2")
    page.click("#editor .ql-editor")
    page.keyboard.type("- premier"); page.keyboard.press("Enter"); page.keyboard.type("second")
    page.click("#saveBtn"); page.wait_for_selector("#grid .card:has-text('Kingdomino')")
    db = page.evaluate("JSON.parse(localStorage.__fakedb)")
    kingdo_id, kingdo = next((k, v) for k, v in db.items() if k.startswith("jeux/") and v.get("nom") == "Kingdomino")
    check("<ul>" in kingdo["description"] and "<li>premier</li>" in kingdo["description"], f"liste à puces enregistrée : {kingdo['description']}")

    # --- Recherche et tri
    page.fill("#rechercheInput", "kingdo")
    page.wait_for_function("document.querySelectorAll('#grid .card').length === 1")
    check("q=kingdo" in page.url and "Kingdomino" in page.text_content("#grid"), "recherche par nom (URL mise à jour)")
    page.fill("#rechercheInput", "AZÛL")
    page.wait_for_function("document.querySelector('#grid').textContent.includes('Azul') && document.querySelectorAll('#grid .card').length === 1")
    check(True, "recherche sans tenir compte des accents ni des majuscules")
    page.fill("#rechercheInput", "")
    page.wait_for_function("document.querySelectorAll('#grid .card').length > 1")
    page.select_option("#triSelect", "recents")
    premier = page.eval_on_selector("#grid .card h3", "h => h.firstChild.textContent")
    check(premier == "Kingdomino" and "sort=recents" in page.url, f"tri « ajoutés récemment » : {premier}")
    page.select_option("#triSelect", "nom")

    # --- Sauvegarde / export
    page.click("#exportBtn"); page.wait_for_selector("#dlgExport[open]")
    with page.expect_download() as dl:
        page.click("#dlgExport [data-export=json]")
    sauvegarde = json.loads(open(dl.value.path(), encoding="utf-8").read())
    noms = sorted(j["nom"] for j in sauvegarde["jeux"])
    check(sauvegarde["format"] == "tapis-vert/1" and "Splendor" in noms and "Carcassonne" not in noms, f"export JSON : jeux de la famille uniquement ({len(noms)})")
    check(dl.value.suggested_filename.startswith("tapis-vert-alice-m-bob-m-") and dl.value.suggested_filename.endswith(".json"), f"nom de la sauvegarde : {dl.value.suggested_filename}")
    page.click("#exportBtn"); page.wait_for_selector("#dlgExport[open]")
    with page.expect_download() as dl:
        page.click("#dlgExport [data-export=csv]")
    csv = open(dl.value.path(), encoding="utf-8").read()
    check(csv.startswith("\ufeffNom;Propriétaire;") and "Kingdomino" in csv, "export CSV lisible par Excel")

    # --- Modification hors ligne : l'interface ne reste pas bloquée
    page.evaluate("localStorage.__horsLigne = '1'")
    page.click("#grid .card:has-text('Kingdomino') [aria-label='Modifier']")
    page.wait_for_selector("#dlgJeu[open]")
    page.fill("#titre", "Kingdomino Origins"); page.click("#saveBtn")
    page.wait_for_function("!document.querySelector('#dlgJeu').open", timeout=10000)
    page.wait_for_selector(".toast:has-text('Enregistré sur cet appareil')")
    check("Kingdomino Origins" in page.text_content("#grid"), "hors ligne : modification affichée et mise en attente")
    page.evaluate("localStorage.removeItem('__horsLigne')")

    # --- Mobile
    m = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block"); m.route(re.compile(r"^https://"), route)
    mp = m.new_page(); mp.goto(BASE + "/index.html")
    mp.evaluate("s => { localStorage.setItem('__fakedb', s); sessionStorage.setItem('__user', 'a@x.fr'); }", json.dumps(db))
    mp.goto(BASE + "/dashboard.html"); mp.wait_for_selector("#grid .card")
    mp.click("#partagesBtn"); mp.wait_for_selector("#listePartages .partage")
    mp.screenshot(path=CAPTURES + "/05-mobile-partages.png")
    check(mp.evaluate("document.documentElement.scrollWidth <= innerWidth"), "mobile : pas de débordement horizontal")
    mp.go_back(); mp.wait_for_timeout(300)
    check(mp.locator("#dlgPartages[open]").count() == 0 and mp.url.endswith("dashboard.html"), "mobile : « retour » ferme la fenêtre sans quitter la page")

    print("404 :", sorted(set(introuvables)))
    check(all(("youtube" in u or "wikimedia" in u or "images.test" in u) for u in introuvables), "seuls 404 = médias externes bloqués par le banc de test")
    check(not erreurs, f"aucune erreur JS : {erreurs}")
    b.close()

    # --- Mode hors ligne : l'application s'ouvre sans réseau (service worker)
    b2 = p.chromium.launch(executable_path=chemin, args=["--no-sandbox"]) if chemin else p.chromium.launch()
    sw = b2.new_context()
    sw.route(re.compile(r"^https://"), route)
    sp = sw.new_page()
    sp.goto(BASE + "/index.html")
    sp.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null || (navigator.serviceWorker.ready.then(() => location.reload()), false)", timeout=15000)
    sp.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
    sp.wait_for_timeout(1500)  # copie locale terminée
    sw.set_offline(True)
    sp.reload(); sp.wait_for_selector("#loginForm")
    check(sp.locator("#googleBtn").count() == 1, "hors ligne : la page de connexion s'ouvre depuis la copie locale")
    sp.goto(BASE + "/partage.html#" + "x" * 32); sp.wait_for_selector("#etat")
    check(True, "hors ligne : la page de partage s'ouvre aussi")
    b2.close()

    print(f"\n{ok} vérifications OK")
