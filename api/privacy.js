// Rotte della privacy: le versioni correnti dei testi e l'accettazione delle condizioni d'uso del professionista.
const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { VERSIONE_INFORMATIVA, VERSIONE_CONDIZIONI_PT } = require("./config");
const { TIPO_CONDIZIONI, haAccettato, registraConsenso } = require("./consensi");

const router = express.Router();

// GET /api/privacy/versioni: pubblica. Le pagine la usano per mostrare la versione e per mandarla con la registrazione.
router.get("/versioni", (req, res) => {
  res.json({ informativa_cliente: VERSIONE_INFORMATIVA, condizioni_pt: VERSIONE_CONDIZIONI_PT });
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
