// I consensi: chi ha accettato quale versione di quale testo.
const db = require("./db");
const { VERSIONE_CONDIZIONI_PT } = require("./config");

const TIPO_INFORMATIVA = "informativa_cliente";
const TIPO_CONDIZIONI = "condizioni_pt";

// "conn" può essere il database o un client di transazione: così si può salvare il consenso nella stessa transazione di un'altra cosa
async function haAccettato(utenteId, tipo, versione, conn = db) {
  const r = await conn.query("SELECT 1 FROM consenso WHERE utente_id = $1 AND tipo = $2 AND versione = $3", [utenteId, tipo, versione]);
  return r.rows.length > 0;
}

// Se c'è già la stessa accettazione non fa niente e non dà errore
async function registraConsenso(conn, utenteId, tipo, versione) {
  await conn.query(
    "INSERT INTO consenso (utente_id, tipo, versione) VALUES ($1, $2, $3) ON CONFLICT (utente_id, tipo, versione) DO NOTHING",
    [utenteId, tipo, versione]
  );
}

// Il "guardiano" delle rotte del professionista: finché non ha accettato la versione CORRENTE delle condizioni d'uso
// risponde 403 con un codice che il sito riconosce (e porta alla schermata delle condizioni).
// Va messo DOPO richiediLogin e richiediRuolo("pt").
async function richiediCondizioniPt(req, res, next) {
  if (!(await haAccettato(req.utente.id, TIPO_CONDIZIONI, VERSIONE_CONDIZIONI_PT))) {
    return res.status(403).json({ errore: "Per continuare devi accettare le condizioni d'uso.", codice: "CONDIZIONI_DA_ACCETTARE" });
  }
  next();
}

module.exports = { TIPO_INFORMATIVA, TIPO_CONDIZIONI, haAccettato, registraConsenso, richiediCondizioniPt };
