const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { leggiRegistrazioni } = require("./schede");

const router = express.Router();
router.use(richiediLogin, richiediRuolo("cliente"));

// GET /api/me/scheda: la MIA scheda più recente, con tutto quello che ho segnato
router.get("/scheda", async (req, res) => {
  const r = await db.query(
    `SELECT s.id, s.inizio, s.settimane, s.creata_il, s.aggiornata_il, s.dati
       FROM scheda s JOIN cliente c ON c.id = s.cliente_id
      WHERE c.utente_id = $1
      ORDER BY s.creata_il DESC, s.id DESC
      LIMIT 1`,
    [req.utente.id]
  );
  if (!r.rows[0]) return res.status(404).json({ errore: "Non hai ancora una scheda" });
  res.json({ scheda: r.rows[0], registrazioni: await leggiRegistrazioni(r.rows[0].id) });
});

module.exports = router;
