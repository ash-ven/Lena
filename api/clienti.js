const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");

const router = express.Router();

// Tutto quello che sta in questo file è solo per PT con login valido
router.use(richiediLogin, richiediRuolo("pt"));

// Dato l'utente loggato, trova il suo "pt.id"
async function ptDi(utenteId) {
  const r = await db.query("SELECT id FROM pt WHERE utente_id = $1", [utenteId]);
  return r.rows[0] ? r.rows[0].id : null;
}

// GET /api/clienti: i MIEI clienti
router.get("/", async (req, res) => {
  try {
    const ptId = await ptDi(req.utente.id);
    const r = await db.query(
      "SELECT id, nome, cognome FROM cliente WHERE pt_id = $1 ORDER BY cognome, nome",
      [ptId]
    );
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: "Errore del server" });
  }
});

// POST /api/clienti  { nome, cognome }
router.post("/", async (req, res) => {
  try {
    const nome = String(req.body.nome || "").trim();
    const cognome = String(req.body.cognome || "").trim();
    if (!nome || !cognome) return res.status(400).json({ errore: "Servono nome e cognome" });

    const ptId = await ptDi(req.utente.id);
    const r = await db.query(
      "INSERT INTO cliente (pt_id, nome, cognome) VALUES ($1, $2, $3) RETURNING id, nome, cognome",
      [ptId, nome, cognome]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: "Errore del server" });
  }
});

// POST /api/clienti/:id/schede  { dati }   (dati = l'oggetto prodotto dal convertitore)
router.post("/:id/schede", async (req, res) => {
  try {
    const clienteId = Number(req.params.id);
    if (!Number.isInteger(clienteId)) return res.status(400).json({ errore: "Id cliente non valido" });

    const dati = req.body.dati;
    const inizio = dati && dati.inizio;
    const settimane = dati && dati.settimane;
    if (typeof inizio !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(inizio))
      return res.status(400).json({ errore: "Scheda non valida: manca la data di inizio" });
    if (!Number.isInteger(settimane) || settimane < 1 || settimane > 52)
      return res.status(400).json({ errore: "Scheda non valida: settimane fuori range" });

    // Il cliente è davvero MIO? (se no, rispondo "non trovato": non rivelo che esiste)
    const ptId = await ptDi(req.utente.id);
    const c = await db.query("SELECT id FROM cliente WHERE id = $1 AND pt_id = $2", [clienteId, ptId]);
    if (!c.rows[0]) return res.status(404).json({ errore: "Cliente non trovato" });

    const r = await db.query(
      "INSERT INTO scheda (cliente_id, inizio, settimane, dati) VALUES ($1, $2, $3, $4) RETURNING id",
      [clienteId, inizio, settimane, dati]
    );
    res.status(201).json({ id: r.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: "Errore del server" });
  }
});

module.exports = router;