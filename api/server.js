require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const db = require("./db");
const { router: rottaAuth } = require("./auth");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", rottaAuth);

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
// In Express 5 questa funzione viene chiamata anche se l'avvio fallisce,
// e in quel caso riceve l'errore: lo controlliamo invece di dire "tutto ok".
app.listen(PORTA, (err) => {
  if (err) {
    if (err.code === "EADDRINUSE") {
      console.error(`La porta ${PORTA} è già occupata da un altro programma (forse un vecchio server ancora acceso). Chiudilo e riprova.`);
    } else {
      console.error("Il server non è partito:", err.message);
    }
    process.exit(1);
  }
  console.log(`API Lena su http://localhost:${PORTA}`);
});