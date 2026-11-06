// La libreria degli esercizi del trainer: si riempie da sola.
// Ogni volta che una scheda viene salvata (dall'editor o da un Excel), i nomi degli esercizi e i loro video vengono ricordati.
// L'editor li propone quando il trainer scrive un nome già usato, e ricompila il video.
const db = require("./db");

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

module.exports = { chiaveNome, eserciziDellaScheda, imparaDallaScheda, cerca };
