// Crea un account da PT.
// Uso (dalla cartella api):   node crea-pt.js email password "Nome del PT"
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const { emailPulita } = require("./aiuti");

const [emailGrezza, password, nomeGrezzo] = process.argv.slice(2);
if (!emailGrezza || !password || !nomeGrezzo) {
  console.log('Uso: node crea-pt.js email password "Nome del PT"');
  process.exit(1);
}

// Controlli prima di toccare il database (gli stessi dell'iscrizione dei clienti)
const email = emailPulita(emailGrezza);
const nome = nomeGrezzo.trim();
const problemi = [];
if (!email) problemi.push("L'email non sembra valida (esempio: nome@esempio.it).");
if (password.length < 10) problemi.push(`La password è troppo corta: servono almeno 10 caratteri (ne hai scritti ${password.length}).`);
// bcrypt legge solo i primi 72 byte: oltre, il resto verrebbe ignorato senza dirlo
if (Buffer.byteLength(password) > 72) problemi.push("La password è troppo lunga: al massimo 72 caratteri.");
if (!nome) problemi.push("Il nome non può essere vuoto.");
if (nome.length > 100) problemi.push("Il nome è troppo lungo (massimo 100 caratteri).");
if (problemi.length) {
  console.error("Non ho creato l'account:\n - " + problemi.join("\n - "));
  process.exit(1);
}

const db = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(password, 12);
    const u = await client.query(
      "INSERT INTO utente (email, password_hash, ruolo) VALUES ($1, $2, 'pt') RETURNING id",
      [email, hash]
    );
    await client.query("INSERT INTO pt (utente_id, nome) VALUES ($1, $2)", [u.rows[0].id, nome]);
    await client.query("COMMIT");
    console.log("PT creato, utente id", u.rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err.code === "23505" ? "Esiste già un account con questa email." : "Errore: " + err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
})();
