// La libreria degli esercizi del trainer: si riempie da sola.
// Ogni volta che una scheda viene salvata (dall'editor o da un Excel), i nomi degli esercizi e i loro video vengono ricordati.
// L'editor li propone quando il trainer scrive un nome già usato, e ricompila il video.
const db = require("./db");
const { ESERCIZI } = require("./catalogo-esercizi");

// "  Squat   Bulgaro " e "squat bulgaro" sono lo stesso esercizio; anche "Pressè" e "presse".
const chiaveNome = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Tutti gli esercizi (nome + eventuale video) di una scheda, una sola volta ciascuno.
// Se lo stesso nome compare con e senza video, vale quello col video.
function eserciziDellaScheda(dati) {
  const trovati = new Map();
  const aggiungi = (nome, video) => {
    const k = chiaveNome(nome);
    if (!k || k.length > 200) return;
    const v = typeof video === "string" && /^https?:\/\/\S+$/.test(video) && video.length <= 2000 ? video : null;
    const prima = trovati.get(k);
    if (!prima) trovati.set(k, { chiave: k, nome: String(nome).trim().replace(/\s+/g, " ").slice(0, 200), video: v });
    else if (v && !prima.video) prima.video = v;
  };
  for (const e of (dati.riscaldamento && dati.riscaldamento.esercizi) || []) if (Array.isArray(e)) aggiungi(e[0], e[1]);
  for (const g of dati.giorni || []) {
    for (const b of g.blocchi || []) {
      if (b.tipo === "circuito") for (const e of b.esercizi || []) aggiungi(e.nome, e.video);
      else aggiungi(b.nome, b.video);
    }
  }
  return [...trovati.values()];
}

// Ricorda gli esercizi di una scheda salvata. Il video nuovo sostituisce il vecchio; se il nuovo manca, resta il vecchio.
async function imparaDallaScheda(ptId, dati) {
  const lista = eserciziDellaScheda(dati);
  for (const e of lista) {
    await db.query(
      `INSERT INTO esercizio_libreria (pt_id, chiave, nome, video) VALUES ($1, $2, $3, $4)
       ON CONFLICT (pt_id, chiave) DO UPDATE
         SET nome = EXCLUDED.nome, video = COALESCE(EXCLUDED.video, esercizio_libreria.video),
             usi = esercizio_libreria.usi + 1, ultimo_uso = now()`,
      [ptId, e.chiave, e.nome, e.video]
    );
  }
  return lista.length;
}

// Gli esercizi che iniziano (o contengono) quello che il trainer sta scrivendo, i più usati per primi. Max 8.
async function cerca(ptId, testo) {
  const k = chiaveNome(testo);
  const escape = (s) => s.replace(/[\\%_]/g, "\\$&");
  const r = await db.query(
    `SELECT nome, video, usi FROM esercizio_libreria
      WHERE pt_id = $1 AND chiave LIKE $2
      ORDER BY (chiave LIKE $3) DESC, usi DESC, nome
      LIMIT 8`,
    [ptId, `%${escape(k)}%`, `${escape(k)}%`]
  );
  return r.rows;
}

// L'elenco di partenza (catalogo-esercizi.js), già con la chiave di confronto. Si calcola una volta sola.
const CATALOGO = (() => {
  const viste = new Set(), lista = [];
  for (const nome of ESERCIZI) { const k = chiaveNome(nome); if (k && !viste.has(k)) { viste.add(k); lista.push({ chiave: k, nome }); } }
  return lista;
})();

// Max 8 suggerimenti: prima gli esercizi del trainer (come cerca), poi quelli dell'elenco di partenza che non ha già.
// Quelli dell'elenco non hanno video né usi: { nome, video: null, usi: 0 }. Si confronta con includes, quindi % e _ non fanno da jolly.
async function cercaConCatalogo(ptId, testo) {
  const suoi = await cerca(ptId, testo);
  if (suoi.length >= 8) return suoi;
  const k = chiaveNome(testo);
  if (!k) return suoi;
  const gia = new Set(suoi.map((e) => chiaveNome(e.nome)));
  const trovati = CATALOGO.filter((e) => e.chiave.includes(k) && !gia.has(e.chiave));
  trovati.sort((a, b) => (b.chiave.startsWith(k) - a.chiave.startsWith(k)) || a.nome.localeCompare(b.nome, "it"));
  return suoi.concat(trovati.slice(0, 8 - suoi.length).map((e) => ({ nome: e.nome, video: null, usi: 0 })));
}

// ---------- riempire la libreria dalle schede GIÀ salvate ----------
// La libreria impara solo dalle schede salvate dopo la sua introduzione: questa serve una volta sola per quelle di prima.
// Dalle schede più vecchie alle più nuove: il nome vale l'ultimo scritto, il video l'ultimo presente, "usi" = in quante schede compare.
function aggregaSchede(listaDati) {
  const tot = new Map();
  for (const dati of listaDati) {
    for (const e of eserciziDellaScheda(dati)) {
      const p = tot.get(e.chiave);
      if (!p) tot.set(e.chiave, { chiave: e.chiave, nome: e.nome, video: e.video, usi: 1 });
      else { p.nome = e.nome; if (e.video) p.video = e.video; p.usi += 1; }
    }
  }
  return tot;
}

// Si può rilanciare quante volte si vuole senza danni: non cambia i nomi già in libreria, aggiunge un video solo dove manca,
// e "usi" non cresce oltre quanto vero. Con esegui=false non scrive niente: dice solo cosa farebbe.
async function riempiDallaStoria({ esegui = false, ptId = null } = {}) {
  const r = await db.query(
    `SELECT p.id AS pt_id, p.nome AS pt_nome, s.dati
       FROM scheda s JOIN cliente c ON c.id = s.cliente_id JOIN pt p ON p.id = c.pt_id
      WHERE ($1::int IS NULL OR p.id = $1)
      ORDER BY p.id, s.creata_il, s.id`, [ptId]);
  const perPt = new Map();
  for (const riga of r.rows) {
    if (!perPt.has(riga.pt_id)) perPt.set(riga.pt_id, { pt_id: riga.pt_id, pt_nome: riga.pt_nome, schede: [] });
    perPt.get(riga.pt_id).schede.push(riga.dati);
  }
  const esito = [];
  for (const gruppo of perPt.values()) {
    const esercizi = aggregaSchede(gruppo.schede);
    const gia = new Set((await db.query("SELECT chiave FROM esercizio_libreria WHERE pt_id = $1", [gruppo.pt_id])).rows.map((x) => x.chiave));
    const nuovi = [...esercizi.keys()].filter((k) => !gia.has(k)).length;
    if (esegui) {
      for (const e of esercizi.values()) {
        await db.query(
          `INSERT INTO esercizio_libreria (pt_id, chiave, nome, video, usi) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (pt_id, chiave) DO UPDATE
             SET video = COALESCE(esercizio_libreria.video, EXCLUDED.video), usi = GREATEST(esercizio_libreria.usi, EXCLUDED.usi)`,
          [gruppo.pt_id, e.chiave, e.nome, e.video, e.usi]);
      }
    }
    esito.push({ pt_id: gruppo.pt_id, pt_nome: gruppo.pt_nome, schede: gruppo.schede.length, esercizi: esercizi.size, nuovi });
  }
  return esito;
}

module.exports = { chiaveNome, eserciziDellaScheda, imparaDallaScheda, cerca, cercaConCatalogo, CATALOGO, aggregaSchede, riempiDallaStoria };
