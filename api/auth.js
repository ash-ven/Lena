const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const router = express.Router();
const NOME_COOKIE = "lena_sessione";

// Un hash finto, per confrontare la password anche quando l'email non esiste:
// così la risposta ci mette lo stesso tempo e non rivela quali email sono registrate.
const HASH_FINTO = bcrypt.hashSync("password-finta", 12);

// POST /api/auth/login  { email, password }
router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").toLowerCase().trim();
    const password = String(req.body.password || "");

    const r = await db.query("SELECT id, password_hash, ruolo FROM utente WHERE email = $1", [email]);
    const utente = r.rows[0];

    const ok = await bcrypt.compare(password, utente ? utente.password_hash : HASH_FINTO);
    if (!utente || !ok) return res.status(401).json({ errore: "Email o password non corrette" });

    const token = jwt.sign({ id: utente.id, ruolo: utente.ruolo }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.cookie(NOME_COOKIE, token, {
      httpOnly: true,                                    // il JavaScript della pagina non può leggerlo
      sameSite: "lax",                                   // non viene inviato da siti esterni
      secure: process.env.NODE_ENV === "production",     // in produzione solo su https
      maxAge: 7 * 24 * 3600 * 1000,                      // 7 giorni
    });
    res.json({ id: utente.id, ruolo: utente.ruolo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errore: "Errore del server" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(NOME_COOKIE);
  res.json({ ok: true });
});

// Il "guardiano": lascia passare solo chi ha un pass valido
function richiediLogin(req, res, next) {
  try {
    const dati = jwt.verify(req.cookies[NOME_COOKIE], process.env.JWT_SECRET);
    req.utente = { id: dati.id, ruolo: dati.ruolo };
    next();
  } catch (err) {
    res.status(401).json({ errore: "Devi fare il login" });
  }
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
  res.json(r.rows[0]);
});

module.exports = { router, richiediLogin, richiediRuolo };