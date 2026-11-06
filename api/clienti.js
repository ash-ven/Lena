const express = require("express");
const crypto = require("crypto");
const db = require("./db");
const { richiediLogin, richiediRuolo, hashCodice } = require("./auth");
const { idDa } = require("./aiuti");

const router = express.Router();
const DURATA_INVITO_GIORNI = 7;

// Tutto quello che sta in questo file è solo per PT con login valido
router.use(richiediLogin, richiediRuolo("pt"));

// Dato l'utente loggato, trova il suo "pt.id" e lo mette in req.ptId
router.use(async (req, res, next) => {
  const r = await db.query("SELECT id FROM pt WHERE utente_id = $1", [req.utente.id]);
  if (!r.rows[0]) return res.status(403).json({ errore: "Non hai il permesso" });
  req.ptId = r.rows[0].id;
  next();
});

// Per le rotte con ":id": il cliente esiste ed è MIO? Se no, "non trovato"
// (non diciamo "non è tuo": così non riveliamo che esiste).
router.param("id", async (req, res, next, valore) => {
  const clienteId = idDa(valore);
  if (!clienteId) return res.status(404).json({ errore: "Cliente non trovato" });
  const r = await db.query(
    "SELECT id, utente_id FROM cliente WHERE id = $1 AND pt_id = $2",
    [clienteId, req.ptId]
  );
  if (!r.rows[0]) return res.status(404).json({ errore: "Cliente non trovato" });
  req.cliente = r.rows[0];
  next();
});

// GET /api/clienti: i MIEI clienti
router.get("/", async (req, res) => {
  const r = await db.query(
    `SELECT id, nome, cognome, (utente_id IS NOT NULL) AS registrato
       FROM cliente WHERE pt_id = $1 ORDER BY cognome, nome`,
    [req.ptId]
  );
  res.json(r.rows);
});

// POST /api/clienti  { nome, cognome }
router.post("/", async (req, res) => {
  const corpo = req.body || {};
  const nome = String(corpo.nome || "").trim();
  const cognome = String(corpo.cognome || "").trim();
  if (!nome || !cognome) return res.status(400).json({ errore: "Servono nome e cognome" });
  if (nome.length > 100 || cognome.length > 100) return res.status(400).json({ errore: "Nome o cognome troppo lunghi" });

  const r = await db.query(
    "INSERT INTO cliente (pt_id, nome, cognome) VALUES ($1, $2, $3) RETURNING id, nome, cognome",
    [req.ptId, nome, cognome]
  );
  res.status(201).json(r.rows[0]);
});

// POST /api/clienti/:id/invito: crea il codice con cui il cliente si registra.
// Il codice si vede SOLO in questa risposta: nel database resta solo la sua impronta.
router.post("/:id/invito", async (req, res) => {
  if (req.cliente.utente_id) return res.status(409).json({ errore: "Questo cliente ha già un account" });

  const codice = crypto.randomBytes(32).toString("base64url");   // 43 caratteri, impossibile da indovinare
  const scadeIl = await db.transazione(async (client) => {
    // un nuovo invito annulla quelli vecchi non usati: resta valido un solo link alla volta
    await client.query("DELETE FROM invito WHERE cliente_id = $1 AND usato_il IS NULL", [req.cliente.id]);
    const r = await client.query(
      `INSERT INTO invito (cliente_id, codice_hash, scade_il)
       VALUES ($1, $2, now() + make_interval(days => $3)) RETURNING scade_il`,
      [req.cliente.id, hashCodice(codice), DURATA_INVITO_GIORNI]
    );
    return r.rows[0].scade_il;
  });
  res.status(201).json({ codice, scade_il: scadeIl });
});

// POST /api/clienti/:id/schede  { dati }   (dati = l'oggetto prodotto dal convertitore)
router.post("/:id/schede", async (req, res) => {
  const dati = (req.body || {}).dati;
  const inizio = dati && dati.inizio;
  const settimane = dati && dati.settimane;
  if (typeof inizio !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(inizio))
    return res.status(400).json({ errore: "Scheda non valida: manca la data di inizio" });
  if (!Number.isInteger(settimane) || settimane < 1 || settimane > 52)
    return res.status(400).json({ errore: "Scheda non valida: settimane fuori range" });

  const r = await db.query(
    "INSERT INTO scheda (cliente_id, inizio, settimane, dati) VALUES ($1, $2, $3, $4) RETURNING id",
    [req.cliente.id, inizio, settimane, dati]
  );
  res.status(201).json({ id: r.rows[0].id });
});

// GET /api/clienti/:id/schede: l'elenco delle schede del cliente, senza il JSON pesante
router.get("/:id/schede", async (req, res) => {
  const r = await db.query(
    `SELECT s.id, s.inizio, s.settimane, s.dati -> 'info' ->> 'titolo' AS titolo, s.creata_il, s.aggiornata_il,
            (SELECT count(*)::int FROM registrazione g WHERE g.scheda_id = s.id) AS registrazioni
       FROM scheda s WHERE s.cliente_id = $1
      ORDER BY s.creata_il DESC, s.id DESC`,
    [req.cliente.id]
  );
  res.json(r.rows);
});

module.exports = router;
