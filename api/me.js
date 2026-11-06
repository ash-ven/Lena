const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { leggiRegistrazioni } = require("./schede");
const { NOME_COOKIE, opzioniCookie } = require("./aiuti");
const { esportaCliente, cancellaCliente } = require("./operazioni");
const { vista } = require("./profilo-trainer");

// Le rotte del cliente su se stesso. È una funzione per poter scegliere il limite dei tentativi (i test lo alzano o lo abbassano).
function creaRotteMe({ limiteRiconferma = 5, finestraMinuti = 15 } = {}) {
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

  // ---------- il mio trainer: solo il SUO profilo, mai quello di un altro ----------
  // GET /api/me/trainer
  router.get("/trainer", async (req, res) => {
    const r = await db.query(
      `SELECT p.nome, p.bio, p.contatto, (p.foto IS NOT NULL) AS ha_foto, p.foto_aggiornata_il
         FROM pt p JOIN cliente c ON c.pt_id = p.id WHERE c.utente_id = $1`, [req.utente.id]);
    if (!r.rows[0]) return res.status(404).json({ errore: "Non ho trovato il tuo trainer" });
    res.json(vista(r.rows[0]));
  });
  // GET /api/me/trainer/foto
  router.get("/trainer/foto", async (req, res) => {
    const r = await db.query("SELECT p.foto FROM pt p JOIN cliente c ON c.pt_id = p.id WHERE c.utente_id = $1", [req.utente.id]);
    if (!r.rows[0] || !r.rows[0].foto) return res.status(404).json({ errore: "Nessuna foto" });
    res.type("image/jpeg").send(r.rows[0].foto);
  });

  // ---------- i miei diritti: scaricare i miei dati e cancellare il mio account ----------

  // Il cliente di questo utente (null se non c'è: non dovrebbe succedere, ma non deve far crollare niente)
  const miaScheda = async (utenteId) => (await db.query("SELECT id FROM cliente WHERE utente_id = $1", [utenteId])).rows[0] || null;

  // GET /api/me/esporta: TUTTO ciò che Lena ha su di me, in un file. Stessa logica dell'esportazione fatta dal professionista.
  router.get("/esporta", async (req, res) => {
    const c = await miaScheda(req.utente.id);
    const dati = c && (await esportaCliente(c.id));
    if (!dati) return res.status(404).json({ errore: "Non ho trovato i tuoi dati" });
    res.attachment("lena-i-miei-dati.json");
    res.json(dati);
  });

  // Riconferma della password: 5 tentativi ogni 15 minuti PER UTENTE (contano solo quelli andati male)
  const riconferma = rateLimit({
    windowMs: finestraMinuti * 60 * 1000, limit: limiteRiconferma, skipSuccessfulRequests: true,
    keyGenerator: (req) => `utente:${req.utente.id}`,
    standardHeaders: "draft-8", legacyHeaders: false,
    message: { errore: "Troppi tentativi: riprova tra qualche minuto." },
  });

  // DELETE /api/me/account  { password, conferma: true }
  // Cancella il mio account e tutto ciò che mi riguarda (stessa cancellazione che può fare il professionista):
  // utente, consensi, record cliente, schede, progressi, inviti. Poi chiude la sessione.
  router.delete("/account", riconferma, async (req, res) => {
    const corpo = req.body || {};
    if (corpo.conferma !== true) return res.status(400).json({ errore: "Serve la conferma: spunta la casella.", codice: "CONFERMA_MANCANTE" });

    const u = await db.query("SELECT password_hash FROM utente WHERE id = $1", [req.utente.id]);
    const ok = await bcrypt.compare(String(corpo.password || ""), u.rows[0].password_hash);
    if (!ok) return res.status(403).json({ errore: "La password non è corretta.", codice: "PASSWORD_ERRATA" });

    await db.transazione(async (client) => {
      const c = await client.query("SELECT id FROM cliente WHERE utente_id = $1", [req.utente.id]);
      if (c.rows[0]) await cancellaCliente(client, c.rows[0].id);
      await client.query("DELETE FROM utente WHERE id = $1 AND ruolo = 'cliente'", [req.utente.id]);   // (se non c'era il record cliente)
    });
    res.clearCookie(NOME_COOKIE, opzioniCookie());
    res.status(204).end();
  });

  return router;
}

module.exports = creaRotteMe;
