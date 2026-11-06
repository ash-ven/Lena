const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { idDa } = require("./aiuti");
const { creaInvito, creaScheda } = require("./operazioni");

const router = express.Router();

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

  const { codice, scadeIl } = await creaInvito(req.cliente.id);
  res.status(201).json({ codice, scade_il: scadeIl });
});

// POST /api/clienti/:id/schede  { dati }   (dati = l'oggetto prodotto dal convertitore)
router.post("/:id/schede", async (req, res) => {
  const dati = (req.body || {}).dati;
  const r = await creaScheda(req.cliente.id, dati);
  if (r.errore) return res.status(400).json({ errore: `Scheda non valida: ${r.errore}` });
  res.status(201).json({ id: r.id });
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

// ---------- GDPR: diritto alla cancellazione e alla portabilità ----------

// DELETE /api/clienti/:id: cancella il cliente e TUTTO ciò che lo riguarda.
// Schede, registrazioni e inviti se ne vanno "a cascata" con il cliente;
// l'account (utente) invece va cancellato a mano, perché cliente.utente_id è ON DELETE SET NULL.
router.delete("/:id", async (req, res) => {
  await db.transazione(async (client) => {
    const r = await client.query(
      "DELETE FROM cliente WHERE id = $1 AND pt_id = $2 RETURNING utente_id",
      [req.cliente.id, req.ptId]
    );
    const utenteId = r.rows[0] && r.rows[0].utente_id;
    if (utenteId) await client.query("DELETE FROM utente WHERE id = $1 AND ruolo = 'cliente'", [utenteId]);
  });
  res.status(204).end();
});

// GET /api/clienti/:id/esporta: tutti i dati del cliente in un unico file JSON
router.get("/:id/esporta", async (req, res) => {
  const id = req.cliente.id;
  const [anagrafica, schede, registrazioni, inviti] = await Promise.all([
    db.query(
      `SELECT c.id, c.nome, c.cognome, c.creato_il, p.nome AS personal_trainer,
              u.email, u.creato_il AS account_creato_il
         FROM cliente c JOIN pt p ON p.id = c.pt_id LEFT JOIN utente u ON u.id = c.utente_id
        WHERE c.id = $1`, [id]),
    db.query(
      "SELECT id, inizio, settimane, creata_il, aggiornata_il, dati FROM scheda WHERE cliente_id = $1 ORDER BY creata_il, id",
      [id]),
    db.query(
      `SELECT g.scheda_id, g.tipo, g.chiave, g.valore, g.aggiornata_il
         FROM registrazione g JOIN scheda s ON s.id = g.scheda_id
        WHERE s.cliente_id = $1 ORDER BY g.scheda_id, g.tipo, g.chiave`, [id]),
    // degli inviti diamo solo le date: l'impronta del codice non è un dato del cliente
    db.query("SELECT creato_il, scade_il, usato_il FROM invito WHERE cliente_id = $1 ORDER BY creato_il", [id]),
  ]);

  const perScheda = new Map(schede.rows.map((s) => [s.id, { ...s, registrazioni: [] }]));
  for (const g of registrazioni.rows) {
    const { scheda_id, ...resto } = g;
    perScheda.get(scheda_id).registrazioni.push(resto);
  }

  res.attachment(`lena-cliente-${id}.json`);   // il browser lo scarica come file
  res.json({
    esportato_il: new Date().toISOString(),
    cliente: anagrafica.rows[0],
    schede: [...perScheda.values()],
    inviti: inviti.rows,
  });
});

module.exports = router;
