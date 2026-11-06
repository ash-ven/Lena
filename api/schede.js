const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { idDa } = require("./aiuti");

const router = express.Router();
router.use(richiediLogin);

// LA regola di accesso alle schede, in un posto solo:
// - il PT vede solo le schede dei SUOI clienti
// - il cliente vede solo le SUE schede
// Se la scheda non esiste o non è tua, la risposta è la stessa: null (→ 404).
async function schedaAccessibile(utente, schedaId, colonne = "s.id") {
  const condizione =
    utente.ruolo === "pt"
      ? "c.pt_id = (SELECT id FROM pt WHERE utente_id = $2)"
      : "c.utente_id = $2";
  const r = await db.query(
    `SELECT ${colonne} FROM scheda s JOIN cliente c ON c.id = s.cliente_id
      WHERE s.id = $1 AND ${condizione}`,
    [schedaId, utente.id]
  );
  return r.rows[0] || null;
}

// Per le rotte con ":id": controlla subito che la scheda sia accessibile
router.param("id", async (req, res, next, valore) => {
  const schedaId = idDa(valore);
  const s = schedaId && (await schedaAccessibile(req.utente, schedaId, "s.id, s.settimane, s.dati -> 'giorni' AS giorni"));
  if (!s) return res.status(404).json({ errore: "Scheda non trovata" });
  req.scheda = s;
  next();
});

// GET /api/schede/:id: la scheda completa (solo PT)
router.get("/:id", richiediRuolo("pt"), async (req, res) => {
  const r = await db.query(
    "SELECT id, cliente_id, inizio, settimane, creata_il, aggiornata_il, dati FROM scheda WHERE id = $1",
    [req.scheda.id]
  );
  res.json(r.rows[0]);
});

// GET /api/schede/:id/registrazioni: cosa ha segnato il cliente (solo PT: il cliente le riceve con /api/me/scheda)
router.get("/:id/registrazioni", richiediRuolo("pt"), async (req, res) => {
  res.json(await leggiRegistrazioni(req.scheda.id));
});

async function leggiRegistrazioni(schedaId) {
  const r = await db.query(
    "SELECT tipo, chiave, valore, aggiornata_il FROM registrazione WHERE scheda_id = $1 ORDER BY tipo, chiave",
    [schedaId]
  );
  return r.rows;
}

module.exports = { router, schedaAccessibile, leggiRegistrazioni };
