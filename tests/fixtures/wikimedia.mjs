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
  Q900: { id: "Q900", labels: { fr: { value: "jeu de société familial" }, en: { value: "family board game" } } },
  Q901: { id: "Q901", labels: { en: { value: "tile placement" } } },
  Q902: { id: "Q902", labels: { fr: { value: "draft" } } },
  Q903: { id: "Q903", labels: { fr: { value: "extension de jeu de société" } } }
};

export const RESUMES = {
  "fr/Azul_(jeu)": {
    type: "standard", extract: "Azul est un jeu de société <abstrait> sorti en 2017.",
    content_urls: { desktop: { page: "https://fr.wikipedia.org/wiki/Azul_(jeu)" } }
  },
  "en/Azul_(board_game)": { type: "standard", extract: "Azul is…", originalimage: { source: "https://upload.wikimedia.org/azul-box.jpg" } }
};

/** Faux fetch : répond selon l'URL, comme les vraies API. */
export function fauxFetch(journal = []) {
  return async (url) => {
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
      if (action === "wbgetentities") {
        const entities = {};
        for (const id of u.searchParams.get("ids").split("|")) entities[id] = ENTITES[id] || { id, missing: "" };
        return json({ entities });
      }
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
