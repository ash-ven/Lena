require("dotenv").config();
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const [email, password, nome] = process.argv.slice(2);
if (!email || !password || !nome) {
  console.log('Uso: node crea-pt.js email password "Nome del PT"');
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
      [email.toLowerCase().trim(), hash]
    );
    await client.query("INSERT INTO pt (utente_id, nome) VALUES ($1, $2)", [u.rows[0].id, nome]);
    await client.query("COMMIT");
    console.log("PT creato, utente id", u.rows[0].id);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Errore:", err.message);
  } finally {
    client.release();
    await db.end();
  }
})();