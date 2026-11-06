require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const app = express();
const db = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());

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
app.listen(PORTA, () => console.log(`API Lena su http://localhost:${PORTA}`));