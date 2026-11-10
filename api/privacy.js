// Rotte della privacy: le versioni correnti dei testi e l'accettazione delle condizioni d'uso del professionista.
const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT } = require("./config");
const { TIPO_CONDIZIONI, haAccettato, registraConsenso } = require("./consensi");
const { hashCodice } = require("./aiuti");

const router = express.Router();

// GET /api/privacy/versioni: pubblica. Le pagine la usano per mostrare la versione e per mandarla con la registrazione.
router.get("/versioni", (req, res) => {
  res.json({ informativa_cliente: VERSIONE_INFORMATIVA, condizioni_pt: VERSIONE_CONDIZIONI_PT });
});

// GET /api/privacy/titolare?codice=...: pubblica. Chi ha un invito valido (non usato, non scaduto) vede chi sarà il titolare
// dei suoi dati PRIMA di registrarsi. Un codice sbagliato dà sempre 404, qualunque sia il motivo.
router.get("/titolare", async (req, res) => {
  const codice = typeof req.query.codice === "string" ? req.query.codice : "";
  if (!codice || codice.length > 100) return res.status(404).json({ errore: "Non trovato" });
  const r = await db.query(
    `SELECT p.titolare_nome AS nome, p.titolare_indirizzo AS indirizzo, p.titolare_email AS email
       FROM invito i JOIN cliente c ON c.id = i.cliente_id JOIN pt p ON p.id = c.pt_id
      WHERE i.codice_hash = $1 AND i.usato_il IS NULL AND i.scade_il > now() AND c.utente_id IS NULL`,
    [hashCodice(codice)]
  );
  const t = r.rows[0];
  if (!t || !t.nome || !t.indirizzo || !t.email) return res.status(404).json({ errore: "Non trovato" });
  res.json(t);
});

// Le due rotte seguenti sono del professionista, ma NON passano dal "guardiano" delle condizioni: servono proprio ad accettarle.
router.use("/condizioni-pt", richiediLogin, richiediRuolo("pt"));

// GET /api/privacy/condizioni-pt: ho già accettato la versione corrente?
router.get("/condizioni-pt", async (req, res) => {
  res.json({ versione: VERSIONE_CONDIZIONI_PT, accettate: await haAccettato(req.utente.id, TIPO_CONDIZIONI, VERSIONE_CONDIZIONI_PT) });
});

// POST /api/privacy/condizioni-pt  { versione }: accetto la versione corrente (deve essere proprio quella che ho letto)
router.post("/condizioni-pt", async (req, res) => {
  const versione = String((req.body || {}).versione || "");
  if (versione !== VERSIONE_CONDIZIONI_PT) {
    return res.status(409).json({ errore: "Le condizioni sono cambiate: ricarica la pagina e leggile di nuovo.", codice: "VERSIONE_CAMBIATA", versione: VERSIONE_CONDIZIONI_PT });
  }
  await registraConsenso(db, req.utente.id, TIPO_CONDIZIONI, versione);
  res.json({ versione, accettate: true });
});

module.exports = router;
