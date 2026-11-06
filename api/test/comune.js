// Aiuti condivisi dai test che parlano con il server vero (non è un test: il nome non finisce in .test.js)
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });
const bcrypt = require("bcryptjs");
const db = require("../db");
const { VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT } = require("../config");

// Il consenso che la registrazione di un cliente deve mandare
const CONSENSO = { accettaInformativa: true, versioneInformativa: VERSIONE_INFORMATIVA };

// Un codice unico per ogni esecuzione: tutti i dati di prova hanno l'email ...<RUN>@test.lena e si cancellano insieme
const RUN = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const email = (nome) => `${nome}.${RUN}@test.lena`;
const PASSWORD = "PasswordDiProva123";

function avvia(app) {
  return new Promise((ok) => { const s = app.listen(0, () => ok(s)); });   // porta 0 = "dammene una libera"
}

// Una "sessione" ricorda il cookie come un browser e lo rimanda a ogni richiesta
function sessione(base) {
  let cookie = null;
  const chiama = async (metodo, percorso, corpo) => {
    const headers = {};
    if (corpo !== undefined) headers["Content-Type"] = "application/json";
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(base() + percorso, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
    for (const c of res.headers.getSetCookie()) {
      if (!c.startsWith("lena_sessione=")) continue;
      const valore = c.split(";")[0];
      cookie = valore === "lena_sessione=" ? null : valore;
    }
    const testo = await res.text();
    let json = null;
    try { json = JSON.parse(testo); } catch (e) { /* non è JSON */ }
    return { stato: res.status, json, testo, headers: res.headers };
  };
  chiama.cookie = () => cookie;
  return chiama;
}

// "accetta": se il PT ha già accettato le condizioni d'uso (di default sì: come un PT che ha già fatto il primo accesso)
async function creaPt(nomeEmail, nome, accetta = true) {
  const hash = await bcrypt.hash(PASSWORD, 4);   // costo basso: è solo per i test
  const u = await db.query("INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'pt') RETURNING id", [email(nomeEmail), hash]);
  const pt = await db.query("INSERT INTO pt (utente_id, nome) VALUES ($1, $2) RETURNING id", [u.rows[0].id, nome]);
  if (accetta) await db.query("INSERT INTO consenso (utente_id, tipo, versione) VALUES ($1, 'condizioni_pt', $2)", [u.rows[0].id, VERSIONE_CONDIZIONI_PT]);
  return { utenteId: u.rows[0].id, ptId: pt.rows[0].id };
}

// La scheda d'esempio (quella usata anche nella documentazione), copiata per poterla modificare
const datiProva = (nome = "Anna", cognome = "Rossi") => {
  const d = JSON.parse(JSON.stringify(require("../esempio/scheda-esempio.json")));
  d.info.nome = nome; d.info.cognome = cognome;
  return d;
};

// Cancella TUTTO ciò che hanno creato i test (e controlla che sia sparito)
async function pulisci() {
  await db.query("DELETE FROM utente WHERE email LIKE $1", [`%.${RUN}@test.lena`]);
  const r = await db.query("SELECT count(*)::int AS n FROM utente WHERE email LIKE $1", [`%.${RUN}@test.lena`]);
  return r.rows[0].n;
}

module.exports = { CONSENSO, VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT, RUN, email, PASSWORD, avvia, sessione, creaPt, datiProva, pulisci, db };
