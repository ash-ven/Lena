const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const { NOME_COOKIE, opzioniCookie, emailPulita } = require("./aiuti");

const router = express.Router();
const DURATA_SESSIONE = 7 * 24 * 3600 * 1000;   // 7 giorni

// Un hash finto, per confrontare la password anche quando l'email non esiste:
// così la risposta ci mette lo stesso tempo e non rivela quali email sono registrate.
const HASH_FINTO = bcrypt.hashSync("password-finta", 12);

// L'impronta (sha256) di un codice di invito: nel database salviamo solo questa.
function hashCodice(codice) {
  return crypto.createHash("sha256").update(codice).digest("hex");
}

// Crea il "pass" (JWT) e lo mette nel cookie
function apriSessione(res, utente) {
  const token = jwt.sign({ id: utente.id, ruolo: utente.ruolo }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: "7d",
  });
  res.cookie(NOME_COOKIE, token, { ...opzioniCookie(), maxAge: DURATA_SESSIONE });
}

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  const corpo = req.body || {};
  const email = String(corpo.email || "").toLowerCase().trim();
  const password = String(corpo.password || "");

  const r = await db.query("SELECT id, password_hash, ruolo FROM utente WHERE email = $1", [email]);
  const utente = r.rows[0];

  const ok = await bcrypt.compare(password, utente ? utente.password_hash : HASH_FINTO);
  if (!utente || !ok) return res.status(401).json({ errore: "Email o password non corrette" });

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
    await client.query("UPDATE invito SET usato_il = now() WHERE id = $1", [invitoId]);
    return { stato: 201, utente: u.rows[0] };
  });

  if (esito.errore) return res.status(esito.stato).json({ errore: esito.errore });
  apriSessione(res, esito.utente);
  res.status(201).json({ id: esito.utente.id, ruolo: esito.utente.ruolo });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(NOME_COOKIE, opzioniCookie());
  res.json({ ok: true });
});

// Il "guardiano": lascia passare solo chi ha un pass valido
function richiediLogin(req, res, next) {
  try {
    const dati = jwt.verify(req.cookies[NOME_COOKIE], process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.utente = { id: dati.id, ruolo: dati.ruolo };
  } catch (err) {
    return res.status(401).json({ errore: "Devi fare il login" });
  }
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

module.exports = { router, richiediLogin, richiediRuolo, hashCodice };
