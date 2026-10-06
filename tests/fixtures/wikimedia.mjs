// Réponses simulées au format des API Wikidata (wbsearchentities / wbgetentities)
// et Wikipédia REST (page/summary). Partagées entre tests unitaires et e2e.
const item = (id) => ({ "entity-type": "item", "numeric-id": +id.slice(1), id });
const claim = (value, rank = "normal") => ({ rank, mainsnak: { snaktype: "value", datavalue: { value } } });
const qte = (n, unit = "1") => ({ amount: `+${n}`, unit: unit === "1" ? "1" : `http://www.wikidata.org/entity/${unit}` });

export const ENTITES = {
  Q1: { // Le jeu
    id: "Q1",
    labels: { fr: { value: "Azul" }, en: { value: "Azul" } },
    descriptions: { fr: { value: "jeu de société de Michael Kiesling" } },
    sitelinks: { frwiki: { title: "Azul (jeu)" }, enwiki: { title: "Azul (board game)" } },
    claims: {
      P31: [claim(item("Q131436"))],
      P136: [claim(item("Q900"))],
      P4151: [claim(item("Q901")), claim(item("Q902"))],
      P1872: [claim(qte(2))],
      P1873: [claim(qte(4))],
      P2047: [claim(qte(30, "Q7727")), claim(qte(45, "Q7727")), claim(qte(99, "Q7727"), "deprecated")],
      P2899: [claim(qte(8, "Q577"))],
      P2339: [claim("230802")]
    }
  },
  Q2: { // Homonyme qui n'est pas un jeu
    id: "Q2", labels: { fr: { value: "azul" } }, descriptions: { fr: { value: "couleur" } },
    claims: { P31: [claim(item("Q1075"))] }
  },
  Q3: { // Extension, durée en heures, solo, image Commons, pas d'article Wikipédia
    id: "Q3",
    labels: { fr: { value: "Azul : Pavillon d'été" } },
    descriptions: {},
    sitelinks: {},
    claims: {
      P31: [claim(item("Q903"))],
      P1872: [claim(qte(1))], P1873: [claim(qte(4))],
      P2047: [claim(qte(1, "Q25235"))],
      P18: [claim("Azul summer pavilion.jpg")],
      P2339: [claim("<script>")]
    }
  },
  Q4: { // Jeu sans nom français sur Wikidata, mais avec un article sur Wikipédia FR
    id: "Q4",
    labels: { en: { value: "Ticket to Ride" } },
    aliases: { de: [{ value: "Zug um Zug" }] },
    descriptions: { en: { value: "board game by Alan R. Moon" } },
    sitelinks: { frwiki: { title: "Les Aventuriers du rail" } },
    claims: { P31: [claim(item("Q131436"))], P1872: [claim(qte(2))], P1873: [claim(qte(5))], P2339: [claim("9209")] }
  },
  Q5: { // Article homonyme qui n'est pas un jeu
    id: "Q5", labels: { fr: { value: "Les Aventuriers" } }, descriptions: { fr: { value: "film de 1967" } },
    sitelinks: { frwiki: { title: "Les Aventuriers (film)" } }, claims: { P31: [claim(item("Q11424"))] }
  },
  Q900: { id: "Q900", labels: { fr: { value: "jeu de société familial" }, en: { value: "family board game" } } },
  Q901: { id: "Q901", labels: { en: { value: "tile placement" } } },
  Q902: { id: "Q902", labels: { fr: { value: "draft" } } },
  Q903: { id: "Q903", labels: { fr: { value: "extension de jeu de société" } } }
};

// Articles de Wikipédia FR : titre, élément Wikidata, redirections
export const ARTICLES_FR = [
  { title: "Les Aventuriers du rail", qid: "Q4", redirects: ["Aventuriers du rail", "Ticket to Ride"] },
  { title: "Les Aventuriers (film)", qid: "Q5", redirects: [] },
  { title: "Azul (jeu)", qid: "Q1", redirects: [] }
];

const plat = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const RESUMES = {
  "fr/Azul_(jeu)": {
    type: "standard", extract: "Azul est un jeu de société <abstrait> sorti en 2017.",
    content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Azul_(jeu)" } }
  },
  "en/Azul_(board_game)": { type: "standard", extract: "Azul is…", originalimage: { source: "https://upload.wikimedia.org/azul-box.jpg" } }
};

/** Faux fetch : répond selon l'URL, comme les vraies API. */
export function fauxFetch(journal = [], { enPanne = [] } = {}) {
  return async (url) => {
    if (enPanne.some(h => url.includes(h))) throw new TypeError("Failed to fetch");
    journal.push(url);
    const u = new URL(url);
    const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
    if (u.hostname === "www.wikidata.org") {
      const action = u.searchParams.get("action");
      if (u.searchParams.get("origin") !== "*") return json({}, 403);
      if (action === "wbsearchentities") {
        const s = u.searchParams.get("search").toLowerCase();
        return json({ search: Object.values(ENTITES).filter(e => e.labels?.fr?.value.toLowerCase().startsWith(s))
          .map(e => ({ id: e.id, label: e.labels.fr.value })) });
      }
      if (action === "query" && u.searchParams.get("list") === "search") {
        // Recherche multilingue sur tous les noms et alias, filtrée par haswbstatement
        const brut = u.searchParams.get("srsearch");
        const prop = (brut.match(/haswbstatement:(P\d+)/) || [])[1];
        const mots = plat(brut.replace(/haswbstatement:\S+/, "")).split(/\s+/).filter(Boolean);
        const search = Object.values(ENTITES).filter(e => {
          if (prop && !e.claims?.[prop]) return false;
          const noms = [...Object.values(e.labels || {}).map(l => l.value),
                        ...Object.values(e.aliases || {}).flat().map(a => a.value)].map(plat).join(" | ");
          return mots.every(m => noms.includes(m));
        }).map(e => ({ title: e.id }));
        return json({ query: { search } });
      }
      if (action === "wbgetentities") {
        const entities = {};
        for (const id of u.searchParams.get("ids").split("|")) entities[id] = ENTITES[id] || { id, missing: "" };
        return json({ entities });
      }
    }
    if (u.hostname === "fr.wikipedia.org" && u.pathname === "/w/api.php") {
      if (u.searchParams.get("origin") !== "*") return json({}, 403);
      const gen = u.searchParams.get("generator");
      let trouves = [];
      if (gen === "prefixsearch") {
        const q = plat(u.searchParams.get("gpssearch"));
        trouves = ARTICLES_FR.filter(a => [a.title, ...a.redirects].some(t => plat(t).startsWith(q)));
      } else if (gen === "search") {
        const mots = [...u.searchParams.get("gsrsearch").matchAll(/intitle:(\S+)/g)].map(m => plat(m[1]));
        trouves = ARTICLES_FR.filter(a => mots.every(m => plat(a.title).includes(m)));
      }
      return json({ query: { pages: trouves.map((a, index) => ({ title: a.title, index, pageprops: { wikibase_item: a.qid } })) } });
    }
    const m = u.hostname.match(/^(fr|en)\.wikipedia\.org$/);
    if (m) {
      const titre = decodeURIComponent(u.pathname.split("/").pop());
      const r = RESUMES[`${m[1]}/${titre}`];
      return r ? json(r) : json({ title: "Not found" }, 404);
    }
    return json({}, 404);
  };
}
