// Imposta una nuova password a un account esistente (per l'ambiente di sviluppo: serve l'accesso al database).
// Le password non si possono "leggere" (nel database c'è solo la loro impronta): si può solo sceglierne una nuova.
// Uso (dalla cartella api):   node reimposta-password.js email nuovaPassword
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const { emailPulita } = require("./aiuti");

const [emailGrezza, password] = process.argv.slice(2);
if (!emailGrezza || !password) { console.log("Uso: node reimposta-password.js email nuovaPassword"); process.exit(1); }
const email = emailPulita(emailGrezza);
const problemi = [];
if (!email) problemi.push("L'email non sembra valida.");
if (password.length < 10) problemi.push(`La password è troppo corta: servono almeno 10 caratteri (ne hai scritti ${password.length}).`);
if (Buffer.byteLength(password) > 72) problemi.push("La password è troppo lunga: al massimo 72 caratteri.");
if (problemi.length) { console.error("Non ho cambiato nulla:\n - " + problemi.join("\n - ")); process.exit(1); }

const db = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    const hash = await bcrypt.hash(password, 12);
    const r = await db.query("UPDATE utente SET password_hash = $2 WHERE email = $1 RETURNING id, ruolo", [email, hash]);
    if (!r.rows[0]) { console.error("Non esiste nessun account con questa email."); process.exitCode = 1; }
    else console.log(`Password cambiata per ${email} (${r.rows[0].ruolo}, utente id ${r.rows[0].id}).`);
  } catch (err) {
    console.error("Errore: " + err.message); process.exitCode = 1;
  } finally { await db.end(); }
})();
