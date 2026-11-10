const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { richiediCondizioniPt } = require("./consensi");
const { idDa } = require("./aiuti");
const { creaInvito, creaScheda, esportaCliente, cancellaCliente } = require("./operazioni");

const router = express.Router();

// Tutto quello che sta in questo file è solo per PT con login valido
// ...e solo dopo aver accettato le condizioni d'uso (versione corrente): altrimenti 403 con codice CONDIZIONI_DA_ACCETTARE
router.use(richiediLogin, richiediRuolo("pt"), richiediCondizioniPt);

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

// La scheda riassuntiva di un cliente (o di tutti i miei clienti): è la stessa per l'elenco e per la pagina del cliente.
// Una sola query: i conteggi e le date si calcolano nel database.
async function riassuntoClienti(ptId, clienteId) {
  const r = await db.query(
    `SELECT c.id, c.nome, c.cognome, c.creato_il, c.ultima_attivita, c.rapporto_finito_il,
            (c.utente_id IS NOT NULL) AS registrato, (c.foto IS NOT NULL) AS ha_foto, c.foto_aggiornata_il,
            (SELECT min(s.inizio) FROM scheda s WHERE s.cliente_id = c.id) AS in_allenamento_dal,
            -- l'ultimo giorno della scheda più recente (quella che vede il cliente) e quanti giorni mancano, contando "oggi" in Italia
            (SELECT s.inizio + s.settimane * 7 - 1 FROM scheda s WHERE s.cliente_id = c.id ORDER BY s.creata_il DESC, s.id DESC LIMIT 1) AS scheda_scade_il,
            (SELECT s.inizio + s.settimane * 7 - 1 - (now() AT TIME ZONE 'Europe/Rome')::date FROM scheda s WHERE s.cliente_id = c.id ORDER BY s.creata_il DESC, s.id DESC LIMIT 1) AS giorni_alla_scadenza,
            (SELECT count(*)::int FROM scheda s WHERE s.cliente_id = c.id) AS schede,
            (SELECT s.id FROM scheda s WHERE s.cliente_id = c.id ORDER BY s.creata_il DESC, s.id DESC LIMIT 1) AS scheda_recente_id,
            (SELECT max(g.aggiornata_il) FROM registrazione g JOIN scheda s ON s.id = g.scheda_id WHERE s.cliente_id = c.id) AS ultimo_progresso,
            (SELECT i.scade_il FROM invito i WHERE i.cliente_id = c.id AND i.usato_il IS NULL AND i.scade_il > now()
              ORDER BY i.id DESC LIMIT 1) AS invito_scade_il
       FROM cliente c
      WHERE c.pt_id = $1 AND ($2::int IS NULL OR c.id = $2)
      ORDER BY c.cognome, c.nome, c.id`,
    [ptId, clienteId || null]
  );
  // "invito_attivo" = esiste un invito non usato e non scaduto
  return r.rows.map((c) => ({ ...c, invito_attivo: c.invito_scade_il !== null }));
}

// GET /api/clienti: i MIEI clienti, con lo stato di ognuno
router.get("/", async (req, res) => {
  res.json(await riassuntoClienti(req.ptId));
});

// GET /api/clienti/:id: un cliente mio, con lo stesso riassunto dell'elenco (404 se non è mio: lo decide router.param)
router.get("/:id", async (req, res) => {
  const [cliente] = await riassuntoClienti(req.ptId, req.cliente.id);
  res.json(cliente);
});

// GET /api/clienti/:id/foto: la foto di un cliente mio
router.get("/:id/foto", async (req, res) => {
  const r = await db.query("SELECT foto FROM cliente WHERE id = $1", [req.cliente.id]);
  if (!r.rows[0].foto) return res.status(404).json({ errore: "Nessuna foto" });
  res.type("image/jpeg").send(r.rows[0].foto);
});

// PUT /api/clienti/:id/rapporto  { concluso: true | false }
// Il professionista segna il rapporto come concluso (o lo riapre). Serve a decidere quando cancellare i dati del cliente
// (vedi conservazione.js). Non toglie l'accesso al cliente e si può annullare in qualsiasi momento.
router.put("/:id/rapporto", async (req, res) => {
  const concluso = (req.body || {}).concluso;
  if (typeof concluso !== "boolean") return res.status(400).json({ errore: "Serve «concluso»: true oppure false" });
  const r = await db.query(
    "UPDATE cliente SET rapporto_finito_il = CASE WHEN $2 THEN COALESCE(rapporto_finito_il, now()) ELSE NULL END WHERE id = $1 RETURNING rapporto_finito_il",
    [req.cliente.id, concluso]
  );
  res.json({ rapporto_finito_il: r.rows[0].rapporto_finito_il });
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

// ---------- note private del trainer su questo cliente (un solo campo di testo) ----------
// Le vede solo il trainer; il cliente le riceve se scarica i propri dati (esportaCliente). NON contano come "attività" del cliente.
const MAX_NOTE = 2000;
router.get("/:id/note", async (req, res) => {
  const r = await db.query("SELECT note_trainer, note_trainer_aggiornate_il FROM cliente WHERE id = $1", [req.cliente.id]);
  res.json({ testo: r.rows[0].note_trainer || "", aggiornateIl: r.rows[0].note_trainer_aggiornate_il });
});
router.put("/:id/note", async (req, res) => {
  const grezzo = (req.body || {}).testo;
  if (grezzo !== undefined && grezzo !== null && typeof grezzo !== "string") return res.status(400).json({ errore: "Le note devono essere un testo" });
  const testo = String(grezzo || "").replace(/\r\n/g, "\n").trim();
  if ([...testo].length > MAX_NOTE) return res.status(400).json({ errore: `Le note possono avere al massimo ${MAX_NOTE} caratteri` });
  if (/[\u0000-\u0008\u000B-\u001F\u007F]/.test(testo)) return res.status(400).json({ errore: "Le note contengono caratteri non ammessi" });
  const r = await db.query(
    `UPDATE cliente SET note_trainer = NULLIF($2, ''), note_trainer_aggiornate_il = CASE WHEN $2 = '' THEN NULL ELSE now() END
      WHERE id = $1 RETURNING note_trainer, note_trainer_aggiornate_il`, [req.cliente.id, testo]);
  res.json({ testo: r.rows[0].note_trainer || "", aggiornateIl: r.rows[0].note_trainer_aggiornate_il });
});

// POST /api/clienti/:id/invito: crea il codice con cui il cliente si registra.
// Il codice si vede SOLO in questa risposta: nel database resta solo la sua impronta.
router.post("/:id/invito", async (req, res) => {
  if (req.cliente.utente_id) return res.status(409).json({ errore: "Questo cliente ha già un account" });

  // L'informativa che il cliente leggerà mostra i dati del suo trainer (il titolare): senza, non si invita nessuno
  const t = await db.query("SELECT titolare_nome, titolare_indirizzo, titolare_email FROM pt WHERE id = $1", [req.ptId]);
  if (!t.rows[0] || !t.rows[0].titolare_nome || !t.rows[0].titolare_indirizzo || !t.rows[0].titolare_email) {
    return res.status(409).json({ errore: "Prima di invitare un cliente compila i dati per l'informativa privacy nella pagina «Il tuo profilo».", codice: "DATI_TITOLARE_MANCANTI" });
  }

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
// La logica è in operazioni.js: la usa anche il cliente dalla sua pagina «Il mio account».

// DELETE /api/clienti/:id: cancella il cliente e TUTTO ciò che lo riguarda (schede, progressi, inviti e il suo account)
router.delete("/:id", async (req, res) => {
  await db.transazione((client) => cancellaCliente(client, req.cliente.id, req.ptId));
  res.status(204).end();
});

// GET /api/clienti/:id/esporta: tutti i dati del cliente in un unico file JSON
router.get("/:id/esporta", async (req, res) => {
  const dati = await esportaCliente(req.cliente.id);
  res.attachment(`lena-cliente-${req.cliente.id}.json`);   // il browser lo scarica come file
  res.json(dati);
});

module.exports = router;
