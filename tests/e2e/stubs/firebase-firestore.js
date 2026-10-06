// Faux Firestore en mémoire, persisté dans localStorage pour survivre aux navigations.
const KEY = "__fakedb";
export class Timestamp {
  constructor(ms) { this.ms = ms; }
  static fromMillis(ms) { return new Timestamp(ms); }
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
}
const enc = (v) => JSON.stringify(v, (k, x) => (x instanceof Timestamp ? { __ts: x.ms } : x));
const dec = (s) => JSON.parse(s, (k, x) => (x && typeof x === "object" && "__ts" in x ? new Timestamp(x.__ts) : x));
const load = () => dec(localStorage.getItem(KEY) || "{}");
const save = (db) => localStorage.setItem(KEY, enc(db));
window.__ops = window.__ops || [];
const log = (op, path) => { window.__ops.push(`${op} ${path}`); };
const user = () => sessionStorage.getItem("__user");
const denied = () => { const e = new Error("Missing or insufficient permissions."); e.code = "permission-denied"; throw e; };

export function getFirestore() { return {}; }
export const serverTimestamp = () => new Timestamp(Date.now());
export function collection(db, ...path) { return { type: "coll", path: path.join("/") }; }
export function doc(dbOrColl, ...path) {
  if (dbOrColl && dbOrColl.type === "coll" && path.length === 0)
    return { type: "doc", path: `${dbOrColl.path}/${Math.random().toString(36).slice(2, 12)}`, get id() { return this.path.split("/").pop(); } };
  const p = path.join("/");
  return { type: "doc", path: p, id: p.split("/").pop() };
}
export function where(field, op, value) { return { field, op, value }; }
export function query(coll, ...w) { return { ...coll, wheres: [...(coll.wheres || []), ...w] }; }

// Simulation des règles publiées (localStorage.__regles) :
//   "absentes"       : aucune règle pour les partages -> tout accès refusé
//   "anciennes"      : lecture OK, création de partagesPrives refusée
//   "public-refuse"  : création de la partie publique refusée (test de l'annulation)
const regles = () => localStorage.getItem("__regles") || "ok";
const estPartage = (path) => /^partages(Prives)?\//.test(path);
function checkRegles(op, path, data) {
  const r = regles();
  if (r === "absentes" && estPartage(path)) denied();
  if (r === "anciennes" && op === "set" && path.startsWith("partagesPrives/")) denied();
  if (r === "public-refuse" && op === "set" && /^partages\/[^/]+$/.test(path)) denied();
  if (op === "set" && path.startsWith("partagesPrives/") && ((data.titre || "").length > 120 || (data.libelle || "").length > 80)) denied();
}

function checkPublicRead(path) {
  // Simulation minimale des règles pour un visiteur anonyme
  if (user()) return;
  const parts = path.split("/");
  if (parts[0] !== "partages") denied();
  const pub = load()["partages/" + parts[1]];
  if (!pub) denied();
  if (pub.expireLe && pub.expireLe.toMillis() <= Date.now()) denied();
}

export async function getDoc(ref) {
  checkPublicRead(ref.path);
  if (user()) checkRegles("get", ref.path);
  log("get", ref.path);
  const d = load()[ref.path];
  return { id: ref.id, exists: () => !!d, data: () => d };
}
export async function getDocs(q) {
  checkPublicRead(q.path + "/x");
  if (!user() && q.path.split("/").length === 1) denied();
  if (user()) checkRegles("query", q.path + "/x");
  log("query", q.path);
  const db = load();
  const depth = q.path.split("/").length + 1;
  const docs = Object.entries(db)
    .filter(([p]) => p.startsWith(q.path + "/") && p.split("/").length === depth)
    .filter(([, d]) => (q.wheres || []).every(w => {
      const v = d[w.field];
      if (w.op === "==") return v === w.value;
      if (w.op === "in") return w.value.includes(v);
      if (w.op === "array-contains") return Array.isArray(v) && v.includes(w.value);
      throw new Error("op " + w.op);
    }))
    .map(([p, d]) => ({ id: p.split("/").pop(), data: () => d, ref: { type: "doc", path: p, id: p.split("/").pop() } }));
  return { docs };
}
function write(fn) { if (!user()) denied(); const db = load(); fn(db); save(db); }
export async function setDoc(ref, data) { log("set", ref.path); if (user()) checkRegles("set", ref.path, data); write(db => { db[ref.path] = JSON.parse(enc(data), (k, x) => x && x.__ts ? new Timestamp(x.__ts) : x); }); }
export async function updateDoc(ref, data) { log("update", ref.path); write(db => { db[ref.path] = { ...db[ref.path], ...data }; }); }
export async function deleteDoc(ref) { log("delete", ref.path); if (user()) checkRegles("delete", ref.path); write(db => { delete db[ref.path]; }); }
export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data) => ops.push(() => setDoc(ref, data)),
    delete: (ref) => ops.push(() => deleteDoc(ref)),
    commit: async () => { for (const o of ops) await o(); }
  };
}
