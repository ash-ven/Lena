require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const db = require("./db");
const { router: rottaAuth } = require("./auth");
const rottaClienti = require("./clienti");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/api/auth", rottaAuth);
app.use("/api/clienti", rottaClienti);

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

const PORTA = process.env.PORT || 3001;
const server = app.listen(PORTA, () => {
  console.log(`API Lena su http://localhost:${PORTA}`);
});

// Se la porta è occupata (o c'è un altro errore all'avvio), lo dice chiaramente e si ferma
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`La porta ${PORTA} è già occupata da un altro programma. Chiudilo e riprova.`);
  } else {
    console.error(err);
  }
  process.exit(1);
});