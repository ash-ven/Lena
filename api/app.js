// Costruisce l'applicazione (rotte + protezioni) senza avviarla.
// La usa server.js per partire davvero, e i test per avviarne una loro copia.
const express = require("express");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const db = require("./db");
const { router: rottaAuth } = require("./auth");
const rottaClienti = require("./clienti");
const { router: rottaSchede } = require("./schede");
const rottaMe = require("./me");

// Prima di partire: la configurazione indispensabile c'è?
// Restituisce l'elenco dei problemi (vuoto = tutto ok). Non stampa mai il valore del segreto.
function problemiConfigurazione(env = process.env) {
  const problemi = [];
  if (!env.DATABASE_URL) problemi.push("manca DATABASE_URL in api/.env");
  if (!env.JWT_SECRET) problemi.push("manca JWT_SECRET in api/.env");
  else if (env.JWT_SECRET === "CAMBIAMI") problemi.push("JWT_SECRET vale ancora «CAMBIAMI»: mettine uno vero");
  else if (env.JWT_SECRET.length < 32) problemi.push("JWT_SECRET è troppo corto (almeno 32 caratteri)");
  return problemi;
}

function creaApp(opzioni = {}) {
  const {
    limiteAccesso = 10,     // tentativi SBAGLIATI di login/registrazione per IP...
    limiteGenerale = 600,   // ...e richieste in totale per IP...
    finestraMinuti = 15,    // ...ogni 15 minuti
  } = opzioni;

  const app = express();

  app.use(helmet());                         // intestazioni di sicurezza standard (e toglie "X-Powered-By")
  app.use(express.json({ limit: "1mb" }));   // legge il corpo JSON (massimo 1 MB)
  app.use(cookieParser());

  const risposta429 = { errore: "Troppe richieste: riprova tra qualche minuto" };
  const generale = rateLimit({
    windowMs: finestraMinuti * 60 * 1000, limit: limiteGenerale,
    standardHeaders: "draft-8", legacyHeaders: false, message: risposta429,
  });
  // Contano solo i tentativi andati male: chi entra al primo colpo non "consuma" tentativi.
  const accesso = rateLimit({
    windowMs: finestraMinuti * 60 * 1000, limit: limiteAccesso, skipSuccessfulRequests: true,
    standardHeaders: "draft-8", legacyHeaders: false, message: risposta429,
  });

  app.use("/api", generale);
  app.use(["/api/auth/login", "/api/auth/registra-cliente"], accesso);

  app.use("/api/auth", rottaAuth);
  app.use("/api/clienti", rottaClienti);
  app.use("/api/schede", rottaSchede);
  app.use("/api/me", rottaMe);

  // controllo: il server è acceso e vede il database?
  app.get("/api/salute", async (req, res) => {
    try {
      const r = await db.query("SELECT count(*)::int AS utenti FROM utente");
      res.json({ ok: true, utenti: r.rows[0].utenti });
    } catch (err) {
      console.error(err);
      res.status(500).json({ ok: false, errore: "database non raggiungibile" });
    }
  });

  // Indirizzo che non esiste
  app.use((req, res) => res.status(404).json({ errore: "Indirizzo non trovato" }));

  // Il gestore centrale degli errori: in Express 5 ogni errore (anche nelle funzioni async)
  // arriva qui. Al client va un messaggio generico; i dettagli restano nel log del server.
  app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") return res.status(400).json({ errore: "Il corpo della richiesta non è JSON valido" });
    if (err.type === "entity.too.large") return res.status(413).json({ errore: "Richiesta troppo grande" });
    console.error(`[errore] ${req.method} ${req.originalUrl}`, err);
    if (res.headersSent) return next(err);
    res.status(500).json({ errore: "Errore del server" });
  });

  return app;
}

module.exports = { creaApp, problemiConfigurazione };
