const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { NOME_COOKIE, opzioniCookie, emailPulita, hashCodice } = require("./aiuti");
const { VERSIONE_INFORMATIVA } = require("./config");
const { TIPO_INFORMATIVA, registraConsenso } = require("./consensi");
const { inviaEmail } = require("./posta");
const crypto = require("crypto");

const router = express.Router();
const DURATA_SESSIONE = 7 * 24 * 3600 * 1000;   // 7 giorni

// Un hash finto, per confrontare la password anche quando l'email non esiste:
// così la risposta ci mette lo stesso tempo e non rivela quali email sono registrate.
const HASH_FINTO = bcrypt.hashSync("password-finta", 12);

// Crea il "pass" (JWT) e lo mette nel cookie
function apriSessione(res, utente) {
  const token = jwt.sign({ id: utente.id, ruolo: utente.ruolo }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
  res.cookie(NOME_COOKIE, token, { ...opzioniCookie(), maxAge: DURATA_SESSIONE });
}

// POST /api/auth/login  { email, password, ruolo? }
// "ruolo" ("pt" o "cliente") dice da quale porta della home si entra. Se c'è e l'account è dell'altro tipo,
// NON si apre nessuna sessione. Si controlla solo dopo la password giusta, così non si scopre chi ha un account.
// Una stessa email non può essere insieme PT e cliente: la colonna "email" è UNIQUE e "ruolo" è una sola.
router.post("/login", async (req, res) => {
  const corpo = req.body || {};
  const email = String(corpo.email || "").toLowerCase().trim();
  const password = String(corpo.password || "");
  const ruoloScelto = corpo.ruolo == null ? null : String(corpo.ruolo);
  if (ruoloScelto !== null && ruoloScelto !== "pt" && ruoloScelto !== "cliente") return res.status(400).json({ errore: "Ruolo non valido" });

  const r = await db.query("SELECT id, password_hash, ruolo FROM utente WHERE email = $1", [email]);
  const utente = r.rows[0];

  const ok = await bcrypt.compare(password, utente ? utente.password_hash : HASH_FINTO);
  if (!utente || !ok) return res.status(401).json({ errore: "Email o password non corrette" });

  if (ruoloScelto && ruoloScelto !== utente.ruolo) {
    return res.status(403).json({ errore: "Questo account è di un altro tipo", codice: "RUOLO_SBAGLIATO", ruolo: utente.ruolo });
  }
  apriSessione(res, utente);
  res.json({ id: utente.id, ruolo: utente.ruolo });
});

// POST /api/auth/registra-cliente  { codice, email, password }
// Il cliente usa il codice ricevuto dal PT per crearsi l'account. Poi è già dentro (cookie).
const ERRORE_INVITO = "Invito non valido o scaduto";
router.post("/registra-cliente", async (req, res) => {
  const corpo = req.body || {};
  const codice = String(corpo.codice || "");
  const email = emailPulita(corpo.email);
  const password = String(corpo.password || "");

  if (!codice || codice.length > 100) return res.status(400).json({ errore: ERRORE_INVITO });
  if (!email) return res.status(400).json({ errore: "Email non valida" });
  if (password.length < 10) return res.status(400).json({ errore: "La password deve avere almeno 10 caratteri" });
  // bcrypt usa solo i primi 72 byte: oltre, il resto verrebbe ignorato senza dirlo
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ errore: "La password è troppo lunga (massimo 72 caratteri)" });

  // Il consenso: senza aver accettato l'informativa (la versione corrente) non ci si registra
  if (corpo.accettaInformativa !== true) {
    return res.status(400).json({ errore: "Per registrarti devi leggere e accettare l'informativa privacy.", codice: "CONSENSO_MANCANTE" });
  }
  if (corpo.versioneInformativa !== VERSIONE_INFORMATIVA) {
    return res.status(400).json({ errore: "L'informativa è stata aggiornata: ricarica la pagina e leggila di nuovo.", codice: "VERSIONE_INFORMATIVA_CAMBIATA" });
  }

  // l'hash della password si calcola prima: è lento e non serve tenere il database bloccato intanto
  const passwordHash = await bcrypt.hash(password, 12);

  const esito = await db.transazione(async (client) => {
    // Invito valido = esiste, non scaduto, non usato, e il cliente non ha già un account.
    // "FOR UPDATE" blocca le due righe: se arrivano due registrazioni insieme con lo stesso
    // codice, la seconda aspetta la prima e poi trova l'invito già usato.
    const inv = await client.query(
      `SELECT i.id, i.cliente_id
         FROM invito i JOIN cliente c ON c.id = i.cliente_id
        WHERE i.codice_hash = $1 AND i.usato_il IS NULL AND i.scade_il > now() AND c.utente_id IS NULL
        FOR UPDATE OF i, c`,
      [hashCodice(codice)]
    );
    if (!inv.rows[0]) return { stato: 400, errore: ERRORE_INVITO };
    const { id: invitoId, cliente_id: clienteId } = inv.rows[0];

    // "ON CONFLICT DO NOTHING": se l'email esiste già non dà errore, semplicemente non restituisce righe
    const u = await client.query(
      `INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'cliente')
       ON CONFLICT (email) DO NOTHING RETURNING id, ruolo`,
      [email, passwordHash]
    );
    if (!u.rows[0]) return { stato: 409, errore: "Questa email è già registrata" };

    await client.query("UPDATE cliente SET utente_id = $1 WHERE id = $2", [u.rows[0].id, clienteId]);
    // il consenso si salva nella stessa transazione: o c'è l'account CON il consenso, o non c'è niente
    await registraConsenso(client, u.rows[0].id, TIPO_INFORMATIVA, VERSIONE_INFORMATIVA);
    await client.query("UPDATE invito SET usato_il = now() WHERE id = $1", [invitoId]);
    return { stato: 201, utente: u.rows[0] };
  });

  if (esito.errore) return res.status(esito.stato).json({ errore: esito.errore });
  apriSessione(res, esito.utente);
  res.status(201).json({ id: esito.utente.id, ruolo: esito.utente.ruolo });
});

// POST /api/auth/registra-pt  { nome, email, password }
// Un trainer si crea l'account da solo. Poi è già dentro (cookie). Le condizioni d'uso da trainer le accetta
// al primo accesso (richiediCondizioniPt). Chi gestisce Lena può chiudere l'iscrizione con REGISTRAZIONE_PT=chiusa.
router.post("/registra-pt", async (req, res) => {
  if (String(process.env.REGISTRAZIONE_PT || "").trim().toLowerCase() === "chiusa") {
    return res.status(403).json({ errore: "Le iscrizioni dei trainer sono chiuse al momento.", codice: "ISCRIZIONE_CHIUSA" });
  }
  const corpo = req.body || {};
  const nome = String(corpo.nome || "").trim();
  const email = emailPulita(corpo.email);
  const password = String(corpo.password || "");

  if (!nome) return res.status(400).json({ errore: "Scrivi il tuo nome" });
  if (nome.length > 100) return res.status(400).json({ errore: "Il nome è troppo lungo (massimo 100 caratteri)" });
  if (!email) return res.status(400).json({ errore: "Email non valida" });
  if (password.length < 10) return res.status(400).json({ errore: "La password deve avere almeno 10 caratteri" });
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ errore: "La password è troppo lunga (massimo 72 caratteri)" });

  const passwordHash = await bcrypt.hash(password, 12);
  const esito = await db.transazione(async (client) => {
    const u = await client.query(
      `INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'pt')
       ON CONFLICT (email) DO NOTHING RETURNING id, ruolo`,
      [email, passwordHash]
    );
    if (!u.rows[0]) return { stato: 409, errore: "Questa email è già registrata" };
    await client.query("INSERT INTO pt (utente_id, nome) VALUES ($1, $2)", [u.rows[0].id, nome]);
    return { stato: 201, utente: u.rows[0] };
  });

  if (esito.errore) return res.status(esito.stato).json({ errore: esito.errore });
  apriSessione(res, esito.utente);
  res.status(201).json({ id: esito.utente.id, ruolo: esito.utente.ruolo });
});

// ---------- recupero della password ----------
// Il link per scegliere una nuova password arriva per email, vale 1 ora e si usa una volta sola.
// La risposta è SEMPRE la stessa, che l'email abbia un account o no: altrimenti si scoprirebbe chi è registrato.
// Per questo la risposta parte subito e l'invio dell'email (più lento) avviene dopo.
const DURATA_RECUPERO_MINUTI = 60;
const ATTESA_RECUPERO_SECONDI = 120;   // non si manda un'altra email allo stesso account prima di 2 minuti (niente «bombardamento»)
const ERRORE_RECUPERO = "Questo link non è valido: può essere scaduto, già usato o copiato in modo incompleto. Chiedine uno nuovo.";

async function mandaLinkRecupero(email) {
  const r = await db.query("SELECT id FROM utente WHERE email = $1", [email]);
  if (!r.rows[0]) return;
  const utenteId = r.rows[0].id;
  // online il link deve puntare al sito vero: senza URL_BASE non si manda niente (meglio nessuna email che un link a localhost)
  if (process.env.NODE_ENV === "production" && !process.env.URL_BASE) { console.error("# [recupero password] Manca URL_BASE: email non inviata"); return; }
  const recente = await db.query(
    "SELECT 1 FROM reimposta_password WHERE utente_id = $1 AND creato_il > now() - make_interval(secs => $2)", [utenteId, ATTESA_RECUPERO_SECONDI]);
  if (recente.rows[0]) return;
  const codice = crypto.randomBytes(32).toString("base64url");
  await db.transazione(async (client) => {
    await client.query("DELETE FROM reimposta_password WHERE utente_id = $1 AND usato_il IS NULL", [utenteId]);   // resta valido un solo link
    await client.query(
      "INSERT INTO reimposta_password (utente_id, codice_hash, scade_il) VALUES ($1, $2, now() + make_interval(mins => $3))",
      [utenteId, hashCodice(codice), DURATA_RECUPERO_MINUTI]);
  });
  const base = (process.env.URL_BASE || `http://localhost:${process.env.PORT || 3001}`).replace(/\/+$/, "");
  await inviaEmail({
    a: email,
    oggetto: "Lena: scegli una nuova password",
    testo: `Hai chiesto di cambiare la password di Lena.\n\nApri questo link e scegline una nuova (vale ${DURATA_RECUPERO_MINUTI} minuti e si può usare una volta sola):\n\n${base}/nuova-password.html?codice=${codice}\n\nSe non sei stato tu, ignora questa email: la tua password non cambia.\n`,
  });
}

// POST /api/auth/password-dimenticata  { email }
router.post("/password-dimenticata", async (req, res) => {
  const email = emailPulita((req.body || {}).email);
  if (!email) return res.status(400).json({ errore: "Scrivi un indirizzo email valido, per esempio nome@esempio.it." });
  res.json({ ok: true });
  try { await mandaLinkRecupero(email); } catch (err) { console.error("# [recupero password]", err.message); }
});

// POST /api/auth/nuova-password  { codice, password }
router.post("/nuova-password", async (req, res) => {
  const corpo = req.body || {};
  const codice = String(corpo.codice || "");
  const password = String(corpo.password || "");
  if (!codice || codice.length > 100) return res.status(400).json({ errore: ERRORE_RECUPERO });
  if (password.length < 10) return res.status(400).json({ errore: "La password deve avere almeno 10 caratteri" });
  if (Buffer.byteLength(password) > 72) return res.status(400).json({ errore: "La password è troppo lunga (massimo 72 caratteri)" });
  const passwordHash = await bcrypt.hash(password, 12);
  const ok = await db.transazione(async (client) => {
    const t = await client.query(
      "SELECT id, utente_id FROM reimposta_password WHERE codice_hash = $1 AND usato_il IS NULL AND scade_il > now() FOR UPDATE", [hashCodice(codice)]);
    if (!t.rows[0]) return false;
    // nuova password + tutti gli accessi aperti finora smettono di valere (vedi richiediLogin)
    await client.query("UPDATE utente SET password_hash = $2, sessioni_dal = now() WHERE id = $1", [t.rows[0].utente_id, passwordHash]);
    await client.query("UPDATE reimposta_password SET usato_il = now() WHERE id = $1", [t.rows[0].id]);
    await client.query("DELETE FROM reimposta_password WHERE utente_id = $1 AND usato_il IS NULL", [t.rows[0].utente_id]);
    return true;
  });
  if (!ok) return res.status(400).json({ errore: ERRORE_RECUPERO });
  res.json({ ok: true });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(NOME_COOKIE, opzioniCookie());
  res.json({ ok: true });
});

// Il "guardiano": lascia passare solo chi ha un pass valido
// Oltre alla firma del pass controlla nel database che l'utente esista ancora (una query in più a richiesta):
// così, dopo una cancellazione, il vecchio cookie smette subito di valere. Il ruolo lo prende dal database,
// non dal pass: se un ruolo cambia, vale subito quello nuovo.
async function richiediLogin(req, res, next) {
  let dati;
  try {
    dati = jwt.verify(req.cookies[NOME_COOKIE], process.env.JWT_SECRET, { algorithms: ["HS256"] });
  } catch (err) {
    return res.status(401).json({ errore: "Devi fare il login" });
  }
  const r = await db.query("SELECT id, ruolo, sessioni_dal FROM utente WHERE id = $1", [dati.id]);
  if (!r.rows[0]) return res.status(401).json({ errore: "Devi fare il login" });
  // un accesso aperto prima dell'ultimo cambio di password non vale più (iat è in secondi: si confronta in secondi)
  if (r.rows[0].sessioni_dal && !(dati.iat >= Math.floor(r.rows[0].sessioni_dal.getTime() / 1000))) return res.status(401).json({ errore: "Devi fare il login" });
  req.utente = { id: r.rows[0].id, ruolo: r.rows[0].ruolo };
  next();
}

// Un secondo guardiano: lascia passare solo un certo ruolo ("pt" o "cliente")
function richiediRuolo(ruolo) {
  return (req, res, next) => {
    if (req.utente.ruolo !== ruolo) return res.status(403).json({ errore: "Non hai il permesso" });
    next();
  };
}

// GET /api/auth/me: chi sono io?
router.get("/me", richiediLogin, async (req, res) => {
  const r = await db.query("SELECT id, email, ruolo FROM utente WHERE id = $1", [req.utente.id]);
  // il pass è valido ma l'utente non esiste più (es. cancellato): come se non avesse fatto il login
  if (!r.rows[0]) return res.status(401).json({ errore: "Devi fare il login" });
  res.json(r.rows[0]);
});

module.exports = { router, richiediLogin, richiediRuolo };
