const express = require("express");
const db = require("./db");
const { richiediLogin, richiediRuolo } = require("./auth");
const { idDa } = require("./aiuti");
const { richiediCondizioniPt } = require("./consensi");

const router = express.Router();
router.use(richiediLogin);
// il professionista passa da qui solo se ha accettato le condizioni d'uso; il cliente non è toccato
router.use((req, res, next) => (req.utente.ruolo === "pt" ? richiediCondizioniPt(req, res, next) : next()));

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

// ---------- salvataggio delle registrazioni ----------
const MAX_VOCI = 200;
const TIPI = ["kg", "rip", "serie", "fatto"];
// Chiave = "settimana|giorno|resto", come in modello-scheda.html. Il "resto" può essere:
//   "1"    → blocco 1 del giorno            (esercizio o circuito intero)
//   "1|0"  → esercizio 0 del circuito 1     (kg di un esercizio del circuito)
//   "R|3"  → voce 3 del riscaldamento
//   "S"    → lo stretching
const FORMA_CHIAVE = /^(\d{1,2})\|(\w{1,10})\|(\d{1,3}(\|\d{1,3})?|R\|\d{1,3}|S)$/;

// Controlla una voce; restituisce un messaggio di errore oppure la voce "pulita".
function controllaVoce(voce, scheda, idGiorni) {
  if (!voce || typeof voce !== "object") return { errore: "voce non valida" };
  const { tipo, chiave } = voce;
  if (!TIPI.includes(tipo)) return { errore: `tipo non ammesso (ammessi: ${TIPI.join(", ")})` };

  const m = typeof chiave === "string" && chiave.match(FORMA_CHIAVE);
  if (!m) return { errore: "chiave con formato non valido (atteso es. \"2|A|1\")" };
  const settimana = Number(m[1]);
  if (settimana < 1 || settimana > scheda.settimane) return { errore: "settimana fuori dalla scheda" };
  if (idGiorni && !idGiorni.has(m[2])) return { errore: "giorno che non esiste nella scheda" };

  // valore vuoto = cancella questa voce
  if (voce.valore === null || voce.valore === undefined || String(voce.valore).trim() === "")
    return { tipo, chiave, valore: null };
  if (typeof voce.valore !== "string" && typeof voce.valore !== "number") return { errore: "valore non valido" };
  const valore = String(voce.valore).trim();

  if (tipo === "serie" && !/^\d{1,2}$/.test(valore)) return { errore: "per «serie» il valore è un numero da 0 a 99" };
  if (tipo === "fatto" && valore !== "1") return { errore: "per «fatto» il valore è 1 (o vuoto per togliere la spunta)" };
  if (valore.length > 40) return { errore: "valore troppo lungo (massimo 40 caratteri)" };
  return { tipo, chiave, valore };
}

// PUT /api/schede/:id/registrazioni  { voci: [ { tipo, chiave, valore }, ... ] }
// Solo il cliente proprietario della scheda. Tutto in una transazione: o si salva tutto o niente.
router.put("/:id/registrazioni", richiediRuolo("cliente"), async (req, res) => {
  const voci = (req.body || {}).voci;
  if (!Array.isArray(voci) || voci.length === 0)
    return res.status(400).json({ errore: "Serve una lista «voci» con almeno un elemento" });
  if (voci.length > MAX_VOCI)
    return res.status(400).json({ errore: `Troppe voci in una volta (massimo ${MAX_VOCI})` });

  const giorni = Array.isArray(req.scheda.giorni) ? req.scheda.giorni : null;
  const idGiorni = giorni ? new Set(giorni.map((g) => String(g.id))) : null;

  const pulite = [];
  for (let i = 0; i < voci.length; i++) {
    const v = controllaVoce(voci[i], req.scheda, idGiorni);
    if (v.errore) return res.status(400).json({ errore: `Voce ${i + 1}: ${v.errore}` });
    pulite.push(v);
  }

  const esito = await db.transazione(async (client) => {
    let salvate = 0, cancellate = 0;
    for (const v of pulite) {
      if (v.valore === null) {
        const r = await client.query(
          "DELETE FROM registrazione WHERE scheda_id = $1 AND tipo = $2 AND chiave = $3",
          [req.scheda.id, v.tipo, v.chiave]
        );
        cancellate += r.rowCount;
      } else {
        await client.query(
          `INSERT INTO registrazione (scheda_id, tipo, chiave, valore) VALUES ($1, $2, $3, $4)
           ON CONFLICT (scheda_id, tipo, chiave) DO UPDATE SET valore = EXCLUDED.valore, aggiornata_il = now()`,
          [req.scheda.id, v.tipo, v.chiave, v.valore]
        );
        salvate++;
      }
    }
    return { salvate, cancellate };
  });
  res.json(esito);
});

async function leggiRegistrazioni(schedaId) {
  const r = await db.query(
    "SELECT tipo, chiave, valore, aggiornata_il FROM registrazione WHERE scheda_id = $1 ORDER BY tipo, chiave",
    [schedaId]
  );
  return r.rows;
}

module.exports = { router, schedaAccessibile, leggiRegistrazioni };
